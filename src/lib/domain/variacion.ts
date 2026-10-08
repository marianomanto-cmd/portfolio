// Variación entre dos cargas y su desglose activo / tipo de cambio (spec: "si
// subo 10% en pesos pero el CCL subió 12%, perdí plata en dólares"; D-35 de la
// investigación de mercado, atribución anclada de visión 4.2).
//
// Por partida (posición, saldo, bien o deuda), con V0 y V1 su valor en cada
// carga y F_i los flujos del intervalo (compras, ventas, cobros, aportes),
// cada uno convertido a su propio CCL (ccl_i):
//
//   Resultado ARS = V1 − V0 − ΣF_i            Resultado USD = V1/CCL1 − V0/CCL0 − ΣF_i/ccl_i
//
// D-35 sobre un intervalo (a0, a1]:
// Si la partida arriesga dólares (CEDEAR, dólares, bien en USD):
//   en pesos:   activo = Resultado USD × CCL1          (de lo cual interacción = Resultado USD × (CCL1 − CCL0))
//               TC     = V0_usd × (CCL1 − CCL0) + Σ F_usd_i × (CCL1 − ccl_i)
//   en dólares: todo es activo.
// Si arriesga pesos (LECAP, bono, pesos, deuda en pesos):
//   en dólares: activo = Resultado ARS ÷ CCL0
//               TC     = V1_ars × (1/CCL1 − 1/CCL0) + Σ F_ars_i × (1/CCL0 − 1/ccl_i)
//                        (de lo cual interacción = Resultado ARS × (1/CCL1 − 1/CCL0))
//   en pesos:   todo es activo.
//
// Atribución anclada (visión 4.2, decisión A de la fase 1a, provisoria): una
// posición o un saldo se desglosa por intervalos entre OBSERVACIONES FRESCAS.
// Una observación del día d es fresca si ese día se tipeó un CCL y además:
//   - posición: hay una cotización del activo del día d, o la cantidad es 0
//     (cerrada o todavía no abierta: vale 0 exacto, no necesita precio);
//   - saldo: hay un saldo de esa cuenta y moneda del día d, o todavía no se
//     cargó nunca (vale 0 hasta que aparece; ver saldo inicial más abajo).
// Con a0 = última observación fresca ≤ d0 y a1 = última ≤ d1:
//   - si a1 > a0: activo y TC = D-35 sobre (a0, a1] (CCL tipeados en a0 y a1,
//     flujos de (a0, a1] cada uno a su CCL); sin atribuir = R − activo − TC
//     (devuelve lo que una carga express o media dejó pendiente antes);
//   - si no hubo observación fresca en (d0, d1]: activo = TC = 0 y todo el
//     resultado queda "sin atribuir".
// Así cada día suma exacto, un período es la suma exacta de sus días, una
// carga express entre dos completas no cambia el desglose del período, y
// "sin atribuir" de un período = pendiente al final − pendiente al principio.
// Bienes y deudas mantienen su último dato en su propia moneda: el CCL nuevo
// es tipo de cambio (o licuación), salvo que en el intervalo no se haya
// tipeado ningún CCL: entonces queda todo sin atribuir.
//
// Flujos fijos (no dependen del intervalo, para que los días sumen):
//   - apertura: entra a su valor del día de la apertura (cantidad × precio de
//     ese día, al CCL de ese día). Es externa: no es ganancia.
//   - saldo inicial: la primera vez que aparece un saldo entra como flujo
//     externo por lo que valía (B01).
//   - compra con precio pendiente (D-19): al precio del día de la compra,
//     marcada "inferido"; la pata de caja la cancela.
//   - las dos patas de una operación usan el mismo CCL: ccl_del_dia, si no el
//     CCL tipeado ese día, si no el último anterior (B03).

import { calc, deCalc, sinDato, type Calc, type Etiqueta, type Insumo } from './calc'
import { CERO, Decimal, monto, numero, porcentaje } from './dinero'
import { fechaCorta } from './fechas'
import { foto, indexar, type Foto, type Indices, type ItemFoto } from './foto'
import { costoAlta, ingresoBaja } from './posiciones'
import type { Fecha, Hechos, Moneda, Operacion } from './tipos'

/** Un monto en las dos monedas. */
export interface Doble {
  ars: Decimal
  usd: Decimal
}

export interface Flujo {
  fecha: Fecha
  descripcion: string
  ars: Decimal
  usd: Decimal
  ccl: Decimal
  inferido: boolean
  carga_id: number
  /**
   * Plata que entra o sale del patrimonio sin ser resultado: aporte, retiro,
   * transferencia, apertura, saldo inicial, cambio del capital de una deuda.
   * Las patas de una operación (compra, venta, cobro) son internas: se
   * cancelan entre el título y la caja.
   */
  externo: boolean
}

/** El intervalo entre observaciones frescas con que se atribuyó una partida. */
export interface Anclaje {
  desde: Fecha
  hasta: Fecha
  ccl0: Decimal
  ccl1: Decimal
  v0: Doble
  v1: Doble
  flujos: Flujo[]
  resultado: Doble
}

export interface Contribucion {
  clave: string
  nombre: string
  clase: ItemFoto['clase']
  moneda_riesgo: Moneda
  v0: Doble | null
  v1: Doble | null
  flujos: Flujo[]
  resultado: Doble
  activo: Doble
  tc: Doble
  sin_atribuir: Doble
  /**
   * Término cruzado de D-35 (B28): en pesos va dentro de "activo" si la
   * partida arriesga dólares; en dólares va dentro de "TC" si arriesga pesos.
   */
  interaccion: Doble
  /** true si no hubo observación fresca en el intervalo: todo queda sin atribuir. */
  arrastrado: boolean
  /** Intervalo anclado de la atribución (posiciones y saldos), si lo hubo. */
  ancla: Anclaje | null
  /** Algún flujo usa un precio inferido (compra con precio pendiente, D-19). */
  inferido: boolean
}

export interface Variacion {
  desde: Fecha
  hasta: Fecha
  ccl0: Calc
  ccl1: Calc
  /** true si se tipeó un CCL en (desde, hasta]. */
  ccl_nuevo: boolean
  /** Partidas que no se pudieron calcular (falta precio o CCL). */
  faltantes: { clave: string; nombre: string; motivo: string }[]
  contribuciones: Contribucion[]
}

const CERO2: Doble = { ars: CERO, usd: CERO }
const UNO = new Decimal(1)
const enRango = (f: Fecha, d0: Fecha, d1: Fecha) => f > d0 && f <= d1

/** Fechas con datos cargados (tipo de cambio, precios o saldos), ascendente. */
export function fechasDeCarga(h: Hechos): Fecha[] {
  const s = new Set<Fecha>()
  for (const t of h.tipos_cambio) s.add(t.fecha)
  for (const c of h.cotizaciones) s.add(c.fecha)
  for (const x of h.saldos) s.add(x.fecha)
  return [...s].sort()
}

// ───────────── Contexto (índices y fotos memorizadas por Hechos) ─────────────

interface Contexto {
  h: Hechos
  ix: Indices
  hoy: Fecha
  fotos: Map<Fecha, Foto>
  /** CCL tipeado por fecha (solo los días con CCL). */
  cclTipeado: Map<Fecha, Decimal>
  fechasCcl: Fecha[]
  cotFechas: Map<number, Set<Fecha>>
  saldoFechas: Map<string, Fecha[]>
  opsPorPos: Map<string, Operacion[]>
  cantidades: Map<string, { fecha: Fecha; q: Decimal }[]>
  cargas: Fecha[]
  /** Intervalos entre cargas consecutivas ya calculados (Cartera los suma por fila). */
  intervalos: Map<string, Variacion>
}

const cache = new WeakMap<Hechos, Map<Fecha, Contexto>>()

function ordenarOps(ops: readonly Operacion[]): Operacion[] {
  return [...ops].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.id - b.id))
}

export function contexto(h: Hechos, hoy: Fecha): Contexto {
  let porHoy = cache.get(h)
  if (!porHoy) {
    porHoy = new Map()
    cache.set(h, porHoy)
  }
  const ya = porHoy.get(hoy)
  if (ya) return ya
  const ix = indexar(h)
  const cclTipeado = new Map<Fecha, Decimal>()
  for (const t of h.tipos_cambio) if (t.ccl !== null) cclTipeado.set(t.fecha, t.ccl)
  const cotFechas = new Map<number, Set<Fecha>>()
  for (const c of h.cotizaciones) {
    const s = cotFechas.get(c.activo_id) ?? new Set<Fecha>()
    s.add(c.fecha)
    cotFechas.set(c.activo_id, s)
  }
  const saldoFechas = new Map<string, Fecha[]>()
  for (const s of h.saldos) {
    const k = `${s.cuenta_id}:${s.moneda}`
    saldoFechas.set(k, [...(saldoFechas.get(k) ?? []), s.fecha])
  }
  for (const l of saldoFechas.values()) l.sort()
  const opsPorPos = new Map<string, Operacion[]>()
  for (const o of ordenarOps(h.operaciones)) {
    const k = `${o.cuenta_id}:${o.activo_id}`
    opsPorPos.set(k, [...(opsPorPos.get(k) ?? []), o])
  }
  // Cantidad después de cada operación, con la misma regla que tenencias():
  // una baja sobre una tenencia cerrada no hace nada y nada queda negativo.
  const cantidades = new Map<string, { fecha: Fecha; q: Decimal }[]>()
  for (const [k, ops] of opsPorPos) {
    let q = CERO
    const l: { fecha: Fecha; q: Decimal }[] = []
    for (const o of ops) {
      if (o.tipo === 'apertura' || o.tipo === 'compra' || o.tipo === 'ajuste_ratio') q = q.plus(o.cantidad)
      else if ((o.tipo === 'venta' || o.tipo === 'vencimiento') && !q.isZero()) q = q.minus(o.cantidad)
      if (q.lte(0)) q = CERO
      l.push({ fecha: o.fecha, q })
    }
    cantidades.set(k, l)
  }
  const c: Contexto = {
    h,
    ix,
    hoy,
    fotos: new Map(),
    cclTipeado,
    fechasCcl: [...cclTipeado.keys()].sort(),
    cotFechas,
    saldoFechas,
    opsPorPos,
    cantidades,
    cargas: fechasDeCarga(h),
    intervalos: new Map(),
  }
  porHoy.set(hoy, c)
  return c
}

function fotoEn(ctx: Contexto, d: Fecha): Foto {
  let f = ctx.fotos.get(d)
  if (!f) {
    // Sin traza: estas fotos solo aportan valores a la atribución y al cuadre.
    f = foto(ctx.h, d, { hoy: ctx.hoy, ix: ctx.ix, traza: false })
    ctx.fotos.set(d, f)
  }
  return f
}

function cantidadEn(ctx: Contexto, k: string, d: Fecha): Decimal {
  let q = CERO
  for (const x of ctx.cantidades.get(k) ?? []) {
    if (x.fecha > d) break
    q = x.q
  }
  return q
}

/** CCL de una fecha para convertir un flujo: el tipeado ese día, si no el último anterior, si no el primero posterior. */
function cclDe(ctx: Contexto, d: Fecha): Decimal | null {
  let r: Decimal | null = null
  for (const f of ctx.fechasCcl) {
    if (f <= d) r = ctx.cclTipeado.get(f)!
    else return r ?? ctx.cclTipeado.get(f)!
  }
  return r
}

/** Precio del día de una operación: la última cotización en o antes de esa fecha, si no la primera posterior. */
function precioDia(ctx: Contexto, activo_id: number, d: Fecha): Decimal | null {
  const l = ctx.ix.cotizaciones.get(String(activo_id)) ?? []
  let r: Decimal | null = null
  for (const c of l) {
    if (c.fecha <= d) r = c.precio_pesos
    else return r ?? c.precio_pesos
  }
  return r
}

type Ref =
  | { clase: 'posicion'; cuenta_id: number; activo_id: number }
  | { clase: 'saldo'; cuenta_id: number; moneda: Moneda }
  | { clase: 'bien' | 'pasivo' }

function refDe(clave: string): Ref {
  const [p, a, b] = clave.split(':')
  if (p === 'p') return { clase: 'posicion', cuenta_id: Number(a), activo_id: Number(b) }
  if (p === 's') return { clase: 'saldo', cuenta_id: Number(a), moneda: b as Moneda }
  return { clase: p === 'b' ? 'bien' : 'pasivo' }
}

/** ¿La partida tiene una observación fresca el día d? (decisión A) */
function fresca(ctx: Contexto, ref: Ref, d: Fecha): boolean {
  if (!ctx.cclTipeado.has(d)) return false
  if (ref.clase === 'posicion') {
    if (ctx.cotFechas.get(ref.activo_id)?.has(d)) return true
    return cantidadEn(ctx, `${ref.cuenta_id}:${ref.activo_id}`, d).isZero()
  }
  if (ref.clase === 'saldo') {
    const fs = ctx.saldoFechas.get(`${ref.cuenta_id}:${ref.moneda}`) ?? []
    return fs.length === 0 || fs[0] > d || fs.includes(d)
  }
  return false
}

/** Última observación fresca en o antes de d. */
function anclaEn(ctx: Contexto, ref: Ref, d: Fecha): Fecha | null {
  for (let i = ctx.fechasCcl.length - 1; i >= 0; i--) {
    const f = ctx.fechasCcl[i]
    if (f <= d && fresca(ctx, ref, f)) return f
  }
  return null
}

function valores(i: ItemFoto | undefined): Doble | null | 'falta' {
  if (!i) return null
  if (i.valor_ars.valor === null || i.valor_usd.valor === null) return 'falta'
  return { ars: i.valor_ars.valor, usd: i.valor_usd.valor }
}

// ───────────── Flujos ─────────────

/** Flujos de una posición en (desde, hasta]. Positivo = entra valor a la partida. */
function flujosPosicion(ctx: Contexto, cuenta_id: number, activo_id: number, desde: Fecha, hasta: Fecha): Flujo[] | 'falta' {
  const out: Flujo[] = []
  for (const o of ctx.opsPorPos.get(`${cuenta_id}:${activo_id}`) ?? []) {
    if (!enRango(o.fecha, desde, hasta) || o.tipo === 'ajuste_ratio') continue
    const cclOp = o.ccl_del_dia ?? cclDe(ctx, o.fecha)
    if (cclOp === null) return 'falta'
    let ars: Decimal
    let inferido = false
    let ccl = cclOp
    let externo = false
    let descripcion = `${o.tipo} del ${fechaCorta(o.fecha)}`
    switch (o.tipo) {
      case 'apertura': {
        // Una tenencia que aparece no es ganancia: entra a su valor del día de
        // la apertura (precio y CCL de ese día; el CCL de compra declarado es
        // para el PPC, no para el flujo).
        const p = precioDia(ctx, activo_id, o.fecha)
        const c = cclDe(ctx, o.fecha)
        if (p === null || c === null) return 'falta'
        ars = o.cantidad.times(p)
        ccl = c
        externo = true
        descripcion = `apertura del ${fechaCorta(o.fecha)} (entra a su valor de ese día)`
        break
      }
      case 'compra': {
        const c = costoAlta(o)
        if (c === null) {
          const p = precioDia(ctx, activo_id, o.fecha)
          if (p === null) return 'falta'
          ars = o.cantidad.times(p)
          inferido = true
        } else ars = o.moneda === 'USD' ? c.times(cclOp) : c
        break
      }
      case 'venta':
      case 'vencimiento': {
        const c = ingresoBaja(o)
        if (c === null) {
          const p = precioDia(ctx, activo_id, o.fecha)
          if (p === null) return 'falta'
          ars = o.cantidad.times(p).negated()
          inferido = true
        } else ars = (o.moneda === 'USD' ? c.times(cclOp) : c).negated()
        break
      }
      case 'renta':
      case 'amortizacion':
        if (o.importe === null) return 'falta'
        ars = (o.moneda === 'USD' ? o.importe.times(cclOp) : o.importe).negated()
        break
      default:
        continue
    }
    out.push({ fecha: o.fecha, descripcion, ars, usd: ars.div(ccl), ccl, inferido, carga_id: o.carga_id, externo })
  }
  return out
}

/**
 * Flujos de un saldo en (desde, hasta]: movimientos de capital (externos) y
 * la pata de caja de cada operación (interna, al mismo CCL que la del título).
 * Si el saldo aparece por primera vez en el intervalo, entra como saldo
 * inicial externo (B01); lo que se movió antes de esa primera observación
 * ya está adentro del saldo y no cuenta dos veces.
 */
function flujosSaldo(ctx: Contexto, cuenta_id: number, moneda: Moneda, desde: Fecha, hasta: Fecha): Flujo[] | 'falta' {
  const out: Flujo[] = []
  let falta = false
  const agregar = (fecha: Fecha, enMoneda: Decimal, descripcion: string, carga_id: number, o: { inferido?: boolean; ccl?: Decimal | null; externo: boolean }) => {
    const c = o.ccl ?? cclDe(ctx, fecha)
    if (c === null) {
      falta = true
      return
    }
    const ars = moneda === 'ARS' ? enMoneda : enMoneda.times(c)
    const usd = moneda === 'USD' ? enMoneda : enMoneda.div(c)
    out.push({ fecha, descripcion, ars, usd, ccl: c, inferido: o.inferido ?? false, carga_id, externo: o.externo })
  }
  for (const m of ctx.h.movimientos) {
    const fDestino = m.fecha_acreditacion ?? m.fecha
    if (m.cuenta_destino_id === cuenta_id && m.moneda_destino === moneda && m.monto_destino && enRango(fDestino, desde, hasta))
      agregar(fDestino, m.monto_destino, `${m.tipo} recibido el ${fechaCorta(fDestino)}`, m.carga_id, { externo: true })
    if (m.cuenta_origen_id === cuenta_id && m.moneda_origen === moneda && m.monto_origen && enRango(m.fecha, desde, hasta))
      agregar(m.fecha, m.monto_origen.negated(), `${m.tipo} enviado el ${fechaCorta(m.fecha)}`, m.carga_id, { externo: true })
  }
  for (const o of ctx.h.operaciones) {
    if (o.cuenta_id !== cuenta_id || o.moneda !== moneda || !enRango(o.fecha, desde, hasta)) continue
    const ccl = o.ccl_del_dia ?? cclDe(ctx, o.fecha)
    const cuando = fechaCorta(o.fecha)
    if (o.tipo === 'compra') {
      const c = costoAlta(o)
      const p = c === null ? precioDia(ctx, o.activo_id, o.fecha) : null
      if (c !== null) agregar(o.fecha, c.negated(), `pago de una compra del ${cuando}`, o.carga_id, { ccl, externo: false })
      else if (p !== null) agregar(o.fecha, o.cantidad.times(p).negated(), `pago de una compra del ${cuando} (precio pendiente)`, o.carga_id, { ccl, inferido: true, externo: false })
    } else if (o.tipo === 'venta' || o.tipo === 'vencimiento') {
      const c = ingresoBaja(o)
      const p = c === null ? precioDia(ctx, o.activo_id, o.fecha) : null
      if (c !== null) agregar(o.fecha, c, `cobro de ${o.tipo} del ${cuando}`, o.carga_id, { ccl, externo: false })
      else if (p !== null) agregar(o.fecha, o.cantidad.times(p), `cobro de ${o.tipo} del ${cuando} (inferido)`, o.carga_id, { ccl, inferido: true, externo: false })
    } else if ((o.tipo === 'renta' || o.tipo === 'amortizacion') && o.importe) {
      agregar(o.fecha, o.importe, `cobro de ${o.tipo} del ${cuando}`, o.carga_id, { ccl, externo: false })
    }
  }
  // Saldo inicial (B01).
  const lista = ctx.ix.saldos.get(`${cuenta_id}:${moneda}`) ?? []
  const primero = lista[0]
  if (primero && enRango(primero.fecha, desde, hasta)) {
    const antes = out.filter((f) => f.fecha <= primero.fecha)
    const yaAdentro = antes.reduce((a, f) => a.plus(moneda === 'ARS' ? f.ars : f.usd), CERO)
    agregar(primero.fecha, primero.monto.minus(yaAdentro), `saldo inicial: primera carga de esta cuenta (${fechaCorta(primero.fecha)})`, primero.carga_id, { externo: true })
  }
  if (falta) return 'falta'
  return out.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))
}

function sumar(fs: readonly Flujo[], k: 'ars' | 'usd'): Decimal {
  return fs.reduce((a, f) => a.plus(f[k]), CERO)
}

/** D-35 sobre un intervalo, para una partida. Las partes suman exacto el resultado. */
export function d35(
  riesgo: Moneda,
  v0: Doble,
  v1: Doble,
  ccl0: Decimal,
  ccl1: Decimal,
  flujos: readonly Flujo[],
): { resultado: Doble; activo: Doble; tc: Doble; interaccion: Doble } {
  const Ra = v1.ars.minus(v0.ars).minus(sumar(flujos, 'ars'))
  const Ru = v1.usd.minus(v0.usd).minus(sumar(flujos, 'usd'))
  if (riesgo === 'USD') {
    const tcArs = v0.usd.times(ccl1.minus(ccl0)).plus(flujos.reduce((a, f) => a.plus(f.usd.times(ccl1.minus(f.ccl))), CERO))
    return {
      resultado: { ars: Ra, usd: Ru },
      activo: { ars: Ru.times(ccl1), usd: Ru },
      tc: { ars: tcArs, usd: CERO },
      interaccion: { ars: Ru.times(ccl1.minus(ccl0)), usd: CERO },
    }
  }
  const inv0 = UNO.div(ccl0)
  const inv1 = UNO.div(ccl1)
  const tcUsd = v1.ars.times(inv1.minus(inv0)).plus(flujos.reduce((a, f) => a.plus(f.ars.times(inv0.minus(UNO.div(f.ccl)))), CERO))
  return {
    resultado: { ars: Ra, usd: Ru },
    activo: { ars: Ra, usd: Ra.div(ccl0) },
    tc: { ars: CERO, usd: tcUsd },
    interaccion: { ars: CERO, usd: Ra.times(inv1.minus(inv0)) },
  }
}

const TOLERANCIA = new Decimal('1e-18')
const limpiar = (d: Decimal) => (d.abs().lt(TOLERANCIA) ? CERO : d)

// ───────────── Un intervalo entre dos cargas consecutivas ─────────────

function intervalo(ctx: Contexto, d0: Fecha, d1: Fecha): Variacion {
  const k = `${d0}|${d1}`
  let v = ctx.intervalos.get(k)
  if (!v) {
    v = calcularIntervalo(ctx, d0, d1)
    ctx.intervalos.set(k, v)
  }
  return v
}

function calcularIntervalo(ctx: Contexto, d0: Fecha, d1: Fecha): Variacion {
  const f0 = fotoEn(ctx, d0)
  const f1 = fotoEn(ctx, d1)
  const cclNuevo = ctx.fechasCcl.some((d) => enRango(d, d0, d1))
  const out: Variacion = { desde: d0, hasta: d1, ccl0: f0.ccl, ccl1: f1.ccl, ccl_nuevo: cclNuevo, faltantes: [], contribuciones: [] }
  const ccl0 = f0.ccl.valor
  const ccl1 = f1.ccl.valor
  const m0 = new Map(f0.items.map((i) => [i.clave, i]))
  const m1 = new Map(f1.items.map((i) => [i.clave, i]))
  // Posiciones que abrieron y cerraron dentro del intervalo, o que cobran
  // después de cerrar: no están en ninguna foto pero tienen flujos (B05).
  const sinFoto = new Set<string>()
  for (const o of ctx.h.operaciones) {
    const k = `p:${o.cuenta_id}:${o.activo_id}`
    if (enRango(o.fecha, d0, d1) && !m0.has(k) && !m1.has(k) && ctx.ix.activos.has(o.activo_id)) sinFoto.add(k)
  }
  const claves = [...new Set([...m0.keys(), ...m1.keys(), ...sinFoto])]

  for (const k of claves) {
    const i0 = m0.get(k)
    const i1 = m1.get(k)
    const ref = refDe(k)
    const it = i1 ?? i0
    const activoSinFoto = ref.clase === 'posicion' && !it ? ctx.ix.activos.get(ref.activo_id)! : null
    const nombre = it?.nombre ?? activoSinFoto?.nombre ?? k
    const riesgo: Moneda = it?.moneda_riesgo ?? activoSinFoto?.moneda_riesgo ?? 'ARS'
    if (ccl0 === null || ccl1 === null) {
      out.faltantes.push({ clave: k, nombre, motivo: 'No hay ningún CCL cargado para pasar de una moneda a la otra.' })
      continue
    }
    // Bien o deuda sin dato en d0 y con dato en d1: primera valuación (entra, no es ganancia).
    const primeraVez = (ref.clase === 'bien' || ref.clase === 'pasivo') && i0 !== undefined && i0.fecha_dato === null && i1?.fecha_dato != null
    const v0 = primeraVez ? null : valores(i0)
    const v1 = valores(i1)
    if (v0 === 'falta' || v1 === 'falta') {
      out.faltantes.push({
        clave: k,
        nombre,
        motivo: (v0 === 'falta' ? i0?.valor_ars.motivo : i1?.valor_ars.motivo) ?? 'Falta un dato.',
      })
      continue
    }
    let flujos: Flujo[] | 'falta' = []
    if (ref.clase === 'posicion') flujos = flujosPosicion(ctx, ref.cuenta_id, ref.activo_id, d0, d1)
    else if (ref.clase === 'saldo') flujos = flujosSaldo(ctx, ref.cuenta_id, ref.moneda, d0, d1)
    else if (primeraVez && v1) {
      flujos = [{ fecha: i1!.fecha_dato!, descripcion: `primer dato cargado (${fechaCorta(i1!.fecha_dato!)})`, ars: v1.ars, usd: v1.usd, ccl: ccl1, inferido: false, carga_id: i1!.carga_dato ?? 0, externo: true }]
    } else if (ref.clase === 'pasivo' && v0 && v1) {
      // La baja de capital la paga alguien (vos o la empresa): es un flujo, no
      // un resultado. Se mide en la moneda de la deuda (B06): lo que queda es
      // la licuación (deuda en pesos) o el encarecimiento en pesos (en dólares).
      const usd = riesgo === 'USD'
      const d = usd ? v1.usd.minus(v0.usd) : v1.ars.minus(v0.ars)
      flujos = d.isZero()
        ? []
        : [{ fecha: d1, descripcion: 'cambio del capital informado', ars: usd ? d.times(ccl1) : d, usd: usd ? d : d.div(ccl1), ccl: ccl1, inferido: false, carga_id: i1?.carga_dato ?? 0, externo: true }]
    }
    if (flujos === 'falta') {
      out.faltantes.push({ clave: k, nombre, motivo: 'Falta un precio o un importe para valuar una operación del intervalo.' })
      continue
    }
    const V0 = v0 ?? CERO2
    const V1 = v1 ?? CERO2
    const resultado: Doble = {
      ars: V1.ars.minus(V0.ars).minus(sumar(flujos, 'ars')),
      usd: V1.usd.minus(V0.usd).minus(sumar(flujos, 'usd')),
    }
    let activo = CERO2
    let tc = CERO2
    let interaccion = CERO2
    let ancla: Anclaje | null = null
    let arrastrado = true
    if (ref.clase === 'posicion' || ref.clase === 'saldo') {
      const a0 = anclaEn(ctx, ref, d0)
      const a1 = anclaEn(ctx, ref, d1)
      if (a0 !== null && a1 !== null && a1 > a0) {
        const va0 = valores(fotoEn(ctx, a0).items.find((i) => i.clave === k))
        const va1 = valores(fotoEn(ctx, a1).items.find((i) => i.clave === k))
        const fa = ref.clase === 'posicion' ? flujosPosicion(ctx, ref.cuenta_id, ref.activo_id, a0, a1) : flujosSaldo(ctx, ref.cuenta_id, ref.moneda, a0, a1)
        if (va0 !== 'falta' && va1 !== 'falta' && fa !== 'falta') {
          const c0 = ctx.cclTipeado.get(a0)!
          const c1 = ctx.cclTipeado.get(a1)!
          const x = d35(riesgo, va0 ?? CERO2, va1 ?? CERO2, c0, c1, fa)
          activo = x.activo
          tc = x.tc
          interaccion = x.interaccion
          ancla = { desde: a0, hasta: a1, ccl0: c0, ccl1: c1, v0: va0 ?? CERO2, v1: va1 ?? CERO2, flujos: fa, resultado: x.resultado }
          arrastrado = false
        }
      }
    } else if (cclNuevo) {
      const x = d35(riesgo, V0, V1, ccl0, ccl1, flujos)
      activo = x.activo
      tc = x.tc
      interaccion = x.interaccion
      arrastrado = false
    }
    const sin: Doble = {
      ars: limpiar(resultado.ars.minus(activo.ars).minus(tc.ars)),
      usd: limpiar(resultado.usd.minus(activo.usd).minus(tc.usd)),
    }
    // Invariante: activo + TC + sin atribuir = resultado (a precisión de Decimal).
    if (
      activo.ars.plus(tc.ars).plus(sin.ars).minus(resultado.ars).abs().gt(TOLERANCIA) ||
      activo.usd.plus(tc.usd).plus(sin.usd).minus(resultado.usd).abs().gt(TOLERANCIA)
    ) {
      throw new Error(`Desglose que no cierra en ${nombre}: revisar el motor (D-35).`)
    }
    out.contribuciones.push({
      clave: k,
      nombre,
      clase: ref.clase === 'posicion' || ref.clase === 'saldo' ? ref.clase : (it!.clase as 'bien' | 'pasivo'),
      moneda_riesgo: riesgo,
      v0: v0 ?? null,
      v1: v1 ?? null,
      flujos,
      resultado,
      activo,
      tc,
      sin_atribuir: sin,
      interaccion,
      arrastrado,
      ancla,
      inferido: flujos.some((f) => f.inferido) || (ancla?.flujos.some((f) => f.inferido) ?? false),
    })
  }
  return out
}

const sumar2 = (a: Doble, b: Doble): Doble => ({ ars: a.ars.plus(b.ars), usd: a.usd.plus(b.usd) })

/** Une los intervalos consecutivos de un período: el período es la suma exacta de sus días. */
function combinar(partes: Variacion[]): Variacion {
  const primero = partes[0]
  const ultimo = partes[partes.length - 1]
  const faltantes = new Map<string, Variacion['faltantes'][number]>()
  for (const p of partes) for (const f of p.faltantes) if (!faltantes.has(f.clave)) faltantes.set(f.clave, f)
  const porClave = new Map<string, Contribucion>()
  for (const p of partes) {
    for (const c of p.contribuciones) {
      if (faltantes.has(c.clave)) continue
      const prev = porClave.get(c.clave)
      if (!prev) {
        porClave.set(c.clave, { ...c, flujos: [...c.flujos] })
        continue
      }
      porClave.set(c.clave, {
        ...prev,
        v1: c.v1,
        flujos: [...prev.flujos, ...c.flujos],
        resultado: sumar2(prev.resultado, c.resultado),
        activo: sumar2(prev.activo, c.activo),
        tc: sumar2(prev.tc, c.tc),
        sin_atribuir: sumar2(prev.sin_atribuir, c.sin_atribuir),
        interaccion: sumar2(prev.interaccion, c.interaccion),
        arrastrado: prev.arrastrado && c.arrastrado,
        ancla: c.ancla ?? prev.ancla,
        inferido: prev.inferido || c.inferido,
      })
    }
  }
  // v0 de una partida que aparece en un tramo posterior: no existía al inicio.
  for (const c of porClave.values()) {
    const enPrimero = primero.contribuciones.find((x) => x.clave === c.clave)
    if (!enPrimero) c.v0 = null
  }
  return {
    desde: primero.desde,
    hasta: ultimo.hasta,
    ccl0: primero.ccl0,
    ccl1: ultimo.ccl1,
    ccl_nuevo: partes.some((p) => p.ccl_nuevo),
    faltantes: [...faltantes.values()],
    contribuciones: [...porClave.values()],
  }
}

/**
 * Variación de d0 a d1. Si entre las dos hay otras cargas, es la suma exacta
 * de los intervalos entre cargas consecutivas (visión 4.2: "un mes es la suma
 * exacta de sus días").
 */
export function variacion(h: Hechos, d0: Fecha, d1: Fecha, opciones: { hoy?: Fecha } = {}): Variacion {
  const ctx = contexto(h, opciones.hoy ?? d1)
  const cortes = ctx.cargas.filter((d) => d > d0 && d < d1)
  if (cortes.length === 0) return intervalo(ctx, d0, d1)
  const puntos = [d0, ...cortes, d1]
  return combinar(puntos.slice(1).map((b, i) => intervalo(ctx, puntos[i], b)))
}

// ───────────── Desde la compra (decisión E, visión 4.5) ─────────────

export interface TramoDesdeCompra {
  desde: Fecha
  hasta: Fecha
  /** 'compra': el tramo anterior a la primera observación fresca, un intervalo por lote al CCL de compra. */
  tipo: 'compra' | 'intervalo'
  descripcion: string
  activo: Doble
  tc: Doble
  sin_atribuir: Doble
  resultado: Doble
}

export type DesdeCompra =
  | { tipo: 'ok'; primera: Fecha; activo: Doble; tc: Doble; sin_atribuir: Doble; resultado: Doble; tramos: TramoDesdeCompra[] }
  | { tipo: 'sin_dato'; motivo: string }
  /** Caso que la suma de intervalos no cubre (una baja o un cambio de ratio antes de la primera observación fresca). */
  | { tipo: 'no_aplica'; motivo: string }

/**
 * Desglose desde la compra de una posición (decisión E, visión 4.5 y D-35):
 * la suma de los intervalos entre cargas consecutivas desde la primera
 * observación fresca de la tenencia, más un tramo anterior a ella: un
 * intervalo por lote, desde su costo al CCL de compra (el de la operación o el
 * que declaraste en la apertura) hasta su valor en esa primera observación.
 * Sin CCL de compra, ese tramo no tiene lado en dólares: "sin dato".
 */
export function desgloseDesdeCompra(h: Hechos, clave: string, hasta: Fecha, opciones: { hoy?: Fecha } = {}): DesdeCompra {
  const ctx = contexto(h, opciones.hoy ?? hasta)
  const ref = refDe(clave)
  if (ref.clase !== 'posicion') return { tipo: 'no_aplica', motivo: 'Solo las posiciones tienen costo de compra.' }
  const k = `${ref.cuenta_id}:${ref.activo_id}`
  const activo = ctx.ix.activos.get(ref.activo_id)
  if (!activo) return { tipo: 'no_aplica', motivo: 'Activo desconocido.' }
  // Operaciones de la tenencia vigente (desde la última vez que quedó en cero).
  const ops: Operacion[] = []
  let q = CERO
  for (const o of ctx.opsPorPos.get(k) ?? []) {
    if (o.fecha > hasta) break
    if (q.isZero() && (o.tipo === 'venta' || o.tipo === 'vencimiento')) continue
    ops.push(o)
    if (o.tipo === 'apertura' || o.tipo === 'compra' || o.tipo === 'ajuste_ratio') q = q.plus(o.cantidad)
    else if (o.tipo === 'venta' || o.tipo === 'vencimiento') q = q.minus(o.cantidad)
    if (q.lte(0)) {
      q = CERO
      ops.length = 0
    }
  }
  if (q.isZero() || ops.length === 0) return { tipo: 'no_aplica', motivo: 'No hay tenencia.' }
  const inicio = ops[0].fecha
  const primera = ctx.fechasCcl.find((d) => d >= inicio && d <= hasta && ctx.cotFechas.get(ref.activo_id)?.has(d) && !cantidadEn(ctx, k, d).isZero())
  if (!primera) return { tipo: 'sin_dato', motivo: 'Todavía no hay una observación fresca (precio y CCL del mismo día) desde la compra: no hay con qué separar activo de tipo de cambio.' }
  if (ops.some((o) => o.fecha <= primera && o.tipo !== 'apertura' && o.tipo !== 'compra' && o.tipo !== 'renta'))
    return { tipo: 'no_aplica', motivo: 'Hubo una venta, una amortización o un cambio de ratio antes de la primera observación fresca.' }
  const ccl1 = ctx.cclTipeado.get(primera)!
  const p1 = fotoEn(ctx, primera).items.find((i) => i.clave === clave)?.precio.valor ?? null
  if (p1 === null) return { tipo: 'sin_dato', motivo: 'Falta el precio de la primera observación.' }
  const tramos: TramoDesdeCompra[] = []
  for (const o of ops) {
    if (o.fecha > primera || (o.tipo !== 'apertura' && o.tipo !== 'compra')) continue
    const base = costoAlta(o)
    if (base === null)
      return { tipo: 'sin_dato', motivo: o.tipo === 'apertura' ? 'La apertura no tiene PPP del bróker.' : 'Compra con precio pendiente: el bróker todavía no informó el PPP.' }
    if (o.ccl_del_dia === null)
      return { tipo: 'sin_dato', motivo: o.tipo === 'apertura' ? 'Falta el CCL de compra de la apertura: declaralo para ver el desglose en dólares.' : 'Falta el CCL del día de la compra.' }
    const v0: Doble = o.moneda === 'USD' ? { ars: base.times(o.ccl_del_dia), usd: base } : { ars: base, usd: base.div(o.ccl_del_dia) }
    const valor = o.cantidad.times(p1)
    const v1: Doble = { ars: valor, usd: valor.div(ccl1) }
    const x = d35(activo.moneda_riesgo, v0, v1, o.ccl_del_dia, ccl1, [])
    const desde = o.tipo === 'apertura' && o.fecha_origen ? o.fecha_origen : o.fecha
    tramos.push({
      desde,
      hasta: primera,
      tipo: 'compra',
      descripcion: `${o.tipo} del ${fechaCorta(desde)} (CCL ${numero(o.ccl_del_dia, 2)}${o.tipo === 'apertura' ? ', declarado' : ''}) → primera observación del ${fechaCorta(primera)}`,
      activo: x.activo,
      tc: x.tc,
      sin_atribuir: CERO2,
      resultado: x.resultado,
    })
  }
  const cargas = ctx.cargas.filter((d) => d >= primera && d <= hasta)
  for (let i = 1; i < cargas.length; i++) {
    const v = intervalo(ctx, cargas[i - 1], cargas[i])
    const f = v.faltantes.find((x) => x.clave === clave)
    if (f) return { tipo: 'sin_dato', motivo: `Entre el ${fechaCorta(cargas[i - 1])} y el ${fechaCorta(cargas[i])}: ${f.motivo}` }
    const c = v.contribuciones.find((x) => x.clave === clave)
    if (!c) continue
    tramos.push({
      desde: cargas[i - 1],
      hasta: cargas[i],
      tipo: 'intervalo',
      descripcion: `${fechaCorta(cargas[i - 1])} → ${fechaCorta(cargas[i])}`,
      activo: c.activo,
      tc: c.tc,
      sin_atribuir: c.sin_atribuir,
      resultado: c.resultado,
    })
  }
  const total = (sel: (t: TramoDesdeCompra) => Doble): Doble => tramos.reduce((a, t) => sumar2(a, sel(t)), CERO2)
  return {
    tipo: 'ok',
    primera,
    activo: total((t) => t.activo),
    tc: total((t) => t.tc),
    sin_atribuir: total((t) => t.sin_atribuir),
    resultado: total((t) => t.resultado),
    tramos,
  }
}

// ───────────── Cuadre (D-66) ─────────────

export interface Cuadre {
  ars_ok: boolean | null
  usd_ok: boolean | null
  detalle: string
}

/**
 * El cuadre que puede fallar (B04): el patrimonio financiero recalculado
 * desde los hechos en las dos fechas, menos los flujos externos (aportes,
 * retiros, aperturas, saldos iniciales), tiene que dar la suma de activo + TC
 * + sin atribuir de cada partida. Solo una partida financiera sin dato lo
 * vuelve "no verificable" (B12).
 */
export function cuadre(v: Variacion, h: Hechos, opciones: { hoy?: Fecha } = {}): Cuadre {
  const falt = v.faltantes.filter((f) => f.clave.startsWith('p:') || f.clave.startsWith('s:'))
  if (falt.length) return { ars_ok: null, usd_ok: null, detalle: `No verificable: ${falt.length} partida(s) financiera(s) sin dato.` }
  const ctx = contexto(h, opciones.hoy ?? v.hasta)
  const fin = (d: Fecha, k: 'ars' | 'usd'): Decimal | null => {
    let t = CERO
    for (const i of fotoEn(ctx, d).items) {
      if (i.clase !== 'posicion' && i.clase !== 'saldo') continue
      const x = (k === 'ars' ? i.valor_ars : i.valor_usd).valor
      if (x === null) return null
      t = t.plus(x)
    }
    return t
  }
  const cs = v.contribuciones.filter((c) => c.clase === 'posicion' || c.clase === 'saldo')
  const chequear = (k: 'ars' | 'usd'): boolean | null => {
    const p1 = fin(v.hasta, k)
    const p0 = fin(v.desde, k)
    if (p1 === null || p0 === null) return null
    const externos = cs.reduce((a, c) => a.plus(sumar(c.flujos.filter((f) => f.externo), k)), CERO)
    const partes = cs.reduce((a, c) => a.plus(c.activo[k]).plus(c.tc[k]).plus(c.sin_atribuir[k]), CERO)
    return p1.minus(p0).minus(externos).minus(partes).abs().lte('1e-12')
  }
  const okA = chequear('ars')
  const okU = chequear('usd')
  if (okA === null || okU === null) return { ars_ok: null, usd_ok: null, detalle: 'No verificable: falta un valor del patrimonio financiero.' }
  return {
    ars_ok: okA,
    usd_ok: okU,
    detalle:
      okA && okU
        ? 'Patrimonio de hoy − patrimonio de la carga anterior − aportes y retiros = activos + TC + sin atribuir, en las dos monedas.'
        : 'El desglose no cierra contra el patrimonio recalculado: revisar (puede faltar un saldo que recibió un cobro).',
  }
}

// ───────────── Agregados con traza ─────────────

export type Vista = 'financiero' | 'total'

export function enVista(c: Contribucion, vista: Vista): boolean {
  return vista === 'total' || c.clase === 'posicion' || c.clase === 'saldo'
}

export function faltantesEnVista(v: Variacion, h: Hechos, vista: Vista): Variacion['faltantes'] {
  void h
  return v.faltantes.filter((f) => vista === 'total' || f.clave.startsWith('p:') || f.clave.startsWith('s:'))
}

export type Parte = 'resultado' | 'activo' | 'tc' | 'sin_atribuir'

const NOMBRE_PARTE: Record<Parte, string> = {
  resultado: 'Resultado',
  activo: 'Por los activos',
  tc: 'Por el tipo de cambio',
  sin_atribuir: 'Sin atribuir',
}

const EXPLICACION: Record<Parte, Record<Moneda, string>> = {
  resultado: {
    ARS: 'Cuánto ganaste o perdiste en pesos entre las dos cargas, sin contar la plata que entró o salió.',
    USD: 'Cuánto ganaste o perdiste en dólares entre las dos cargas, sin contar la plata que entró o salió.',
  },
  activo: {
    ARS: 'Lo que se movieron tus activos en sí: el precio en dólares de lo que arriesga dólares, y el precio en pesos de lo que arriesga pesos.',
    USD: 'Lo que se movieron tus activos en sí, medido en dólares.',
  },
  tc: {
    ARS: 'Lo que ganaste en pesos solo porque cambió el CCL, sobre lo que tenías en dólares.',
    USD: 'Lo que ganaste o perdiste en dólares solo porque cambió el CCL, sobre lo que tenías en pesos.',
  },
  sin_atribuir: {
    ARS: 'Cambio de partidas sin precio o saldo nuevo: no hay con qué separar activo de tipo de cambio hasta su próxima observación fresca. Cuando llega, vuelve con el signo opuesto y se atribuye (D-35).',
    USD: 'Cambio de partidas sin precio o saldo nuevo: no hay con qué separar activo de tipo de cambio hasta su próxima observación fresca. Cuando llega, vuelve con el signo opuesto y se atribuye (D-35).',
  },
}

export const EXPLICACION_INFERIDO = 'precio pendiente: se usó el precio del día hasta que llegue el PPP (D-19)'

/** Suma de una parte en una vista, con traza por partida (D-65: si falta una, "sin dato"). */
export function parteCalc(v: Variacion, h: Hechos, vista: Vista, parte: Parte, moneda: Moneda): Calc {
  const k = moneda === 'ARS' ? 'ars' : 'usd'
  const cs = v.contribuciones.filter((c) => enVista(c, vista))
  const faltan = faltantesEnVista(v, h, vista)
  const insumos: Insumo[] = cs
    .filter((c) => !c[parte][k].isZero() || c.inferido)
    .map((c) => ({
      nombre: c.nombre,
      valor: c[parte][k].toFixed(),
      unidad: moneda,
      calc: detalleContribucion(c, parte, moneda, v),
    }))
  const total = cs.reduce((a, c) => a.plus(c[parte][k]), CERO)
  const inferido = cs.some((c) => c.inferido)
  const explicacion = EXPLICACION[parte][moneda] + (inferido ? ` Incluye una compra con ${EXPLICACION_INFERIDO}.` : '')
  if (faltan.length) {
    return sinDato(
      `No se puede calcular: ${faltan.map((f) => `${f.nombre} (${f.motivo})`).join('; ')}. Suma parcial: ${monto(total, moneda, { decimales: 2, signo: true })}.`,
      insumos,
      { etiquetas: ['parcial'], explicacion },
    )
  }
  const visibles = insumos.filter((i) => i.valor !== null && !new Decimal(i.valor).isZero())
  const formula = visibles.length
    ? `${visibles.map((i) => `${i.nombre} ${monto(i.valor as string, moneda, { decimales: 2, signo: true })}`).join(' + ')} = ${monto(total, moneda, { decimales: 2, signo: true })}`
    : `${NOMBRE_PARTE[parte]}: nada = ${monto(CERO, moneda)}`
  return calc(total, formula, insumos, { explicacion })
}

function detalleContribucion(c: Contribucion, parte: Parte, moneda: Moneda, v: Variacion): Calc {
  const k = moneda === 'ARS' ? 'ars' : 'usd'
  const fm = (d: Decimal, m: Moneda = moneda) => monto(d, m, { decimales: 2, signo: true })
  const V0 = c.v0 ?? CERO2
  const V1 = c.v1 ?? CERO2
  const etiquetas: Etiqueta[] = c.inferido ? ['inferido'] : []
  const insumos: Insumo[] = [
    { nombre: `Valor el ${fechaCorta(v.desde)}`, valor: V0[k].toFixed(), unidad: moneda },
    { nombre: `Valor el ${fechaCorta(v.hasta)}`, valor: V1[k].toFixed(), unidad: moneda },
    deCalc(`CCL del ${fechaCorta(v.desde)}`, v.ccl0, 'ratio'),
    deCalc(`CCL del ${fechaCorta(v.hasta)}`, v.ccl1, 'ratio'),
    ...c.flujos.map((f) => ({
      nombre: `Flujo${f.externo ? ' externo' : ''}: ${f.descripcion}${f.inferido ? ' (inferido)' : ''}`,
      valor: f[k].toFixed(),
      unidad: moneda,
      origen: { carga_id: f.carga_id },
    })),
  ]
  const a = c.ancla
  if (a && (parte === 'activo' || parte === 'tc' || parte === 'sin_atribuir')) {
    insumos.push(
      { nombre: `Observación fresca de partida: ${fechaCorta(a.desde)}`, valor: a.v0[k].toFixed(), unidad: moneda },
      { nombre: `Observación fresca de llegada: ${fechaCorta(a.hasta)}`, valor: a.v1[k].toFixed(), unidad: moneda },
      { nombre: `CCL tipeado el ${fechaCorta(a.desde)}`, valor: a.ccl0.toFixed(), unidad: 'ratio' },
      { nombre: `CCL tipeado el ${fechaCorta(a.hasta)}`, valor: a.ccl1.toFixed(), unidad: 'ratio' },
    )
  }
  const F = c.flujos.reduce((x, f) => x.plus(f[k]), CERO)
  const anclado = a && (a.desde !== v.desde || a.hasta !== v.hasta) ? ` (atribuido entre las observaciones frescas del ${fechaCorta(a.desde)} y del ${fechaCorta(a.hasta)})` : ''
  const c0 = a?.ccl0 ?? (v.ccl0.valor as Decimal)
  const c1 = a?.ccl1 ?? (v.ccl1.valor as Decimal)
  const Rref = a?.resultado ?? c.resultado
  const inter = (m: Moneda) => {
    const x = c.interaccion[m === 'ARS' ? 'ars' : 'usd']
    return x.isZero() ? '' : `; de lo cual: interacción ${fm(x, m)}`
  }
  let formula: string
  let explicacion = EXPLICACION[parte][moneda]
  if (parte === 'resultado') {
    formula = `${monto(V1[k], moneda, { decimales: 2 })} − ${monto(V0[k], moneda, { decimales: 2 })}${F.isZero() ? '' : ` − flujos ${fm(F)}`} = ${fm(c.resultado[k])}`
  } else if (parte === 'sin_atribuir') {
    if (c.arrastrado) {
      formula = `${monto(V1[k], moneda, { decimales: 2 })} − ${monto(V0[k], moneda, { decimales: 2 })}${F.isZero() ? '' : ` − flujos ${fm(F)}`} = ${fm(c.sin_atribuir[k])}, sin observación fresca en el intervalo`
    } else {
      formula = `resultado ${fm(c.resultado[k])} − activo ${fm(c.activo[k])} − TC ${fm(c.tc[k])} = ${fm(c.sin_atribuir[k])}${anclado}`
      if (!c.sin_atribuir[k].isZero()) explicacion = 'Lo que había quedado sin atribuir en cargas anteriores (o queda pendiente ahora): vuelve con el signo opuesto cuando la partida tiene de nuevo una observación fresca.'
    }
  } else if (c.arrastrado) {
    formula = `sin observación fresca (precio o saldo nuevo y CCL del día): no se atribuye = ${fm(CERO)}`
  } else if (parte === 'tc' && c.moneda_riesgo === 'USD' && moneda === 'ARS') {
    const V0a = a?.v0 ?? V0
    formula = `${monto(V0a.usd, 'USD', { decimales: 2 })} × (${numero(c1, 2)} − ${numero(c0, 2)})${(a?.flujos ?? c.flujos).length ? ' + flujos revaluados' : ''} = ${fm(c.tc.ars)}${anclado}`
  } else if (parte === 'tc' && c.moneda_riesgo === 'ARS' && moneda === 'USD') {
    const V1a = a?.v1 ?? V1
    formula = `${monto(V1a.ars, 'ARS', { decimales: 2 })} × (1/${numero(c1, 2)} − 1/${numero(c0, 2)})${(a?.flujos ?? c.flujos).length ? ' + flujos' : ''} = ${fm(c.tc.usd)}${inter('USD')}${anclado}`
  } else if (parte === 'activo' && c.moneda_riesgo === 'USD' && moneda === 'ARS') {
    formula = `resultado en dólares ${fm(Rref.usd, 'USD')} × CCL ${numero(c1, 2)} = ${fm(c.activo.ars)}${inter('ARS')}${anclado}`
  } else if (parte === 'activo' && c.moneda_riesgo === 'ARS' && moneda === 'USD') {
    formula = `resultado en pesos ${fm(Rref.ars, 'ARS')} ÷ CCL ${numero(c0, 2)} = ${fm(c.activo.usd)}${anclado}`
  } else {
    formula = `todo lo atribuido de la partida = ${fm(c[parte][k])}${anclado}`
  }
  if (c.inferido) explicacion += ` Incluye una compra con ${EXPLICACION_INFERIDO}.`
  return calc(c[parte][k], formula, insumos, { explicacion, etiquetas })
}

/** Variación porcentual sobre el valor inicial de la vista. */
export function porcentajeCalc(resultado: Calc, base: Calc, moneda: Moneda): Calc {
  if (resultado.valor === null) return sinDato(resultado.motivo ?? 'Falta el resultado.', [deCalc('Resultado', resultado, moneda)])
  if (base.valor === null || base.valor.isZero()) return sinDato('Falta el valor inicial (o es cero).', [deCalc('Valor inicial', base, moneda)])
  const p = resultado.valor.div(base.valor.abs())
  return calc(
    p,
    `${monto(resultado.valor, moneda, { decimales: 2, signo: true })} ÷ ${monto(base.valor.abs(), moneda, { decimales: 2 })} = ${porcentaje(p, { signo: true })}`,
    [deCalc('Resultado', resultado, moneda), deCalc('Valor al inicio', base, moneda)],
    { explicacion: 'La variación del período sobre lo que valía al empezar.' },
  )
}

/** ¿La partida tiene observación fresca el día d? Exportado para Cartera y para los tests. */
export function observacionFresca(h: Hechos, clave: string, d: Fecha, hoy: Fecha = d): boolean {
  return fresca(contexto(h, hoy), refDe(clave), d)
}
