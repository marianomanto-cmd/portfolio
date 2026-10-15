// Evolución y PnL (entrega 4, plan §4 B.2). El puente del período, el
// resultado de cada partida partido en realizado y no realizado, el PnL por
// mes, la serie del patrimonio y del capital aportado, lo que ya traías al día
// cero, la sensibilidad al CCL y el estado de resultados.
//
// Nada se vuelve a valuar acá: todo sale del motor (foto(), variacion(),
// parteCalc(), detalleContribucion(), tenencias(), costoCalc()). Estas
// funciones solo leen lo que el motor ya calculó y lo agrupan, con su traza.
//
// Cuotas del leasing pagadas desde una cuenta que la app sigue (D-137): el
// débito baja el saldo de esa cuenta y, sin más, el motor lo leería como una
// pérdida. Para el puente cada una es un flujo externo (una salida, no una
// pérdida): se agregan a los hechos como retiros de esa cuenta con un número de
// carga propio (negativo, que ninguna carga real tiene) y el motor las atribuye
// con su CCL del día, exacto. El puente las separa en su renglón.
//
// Realizado y no realizado (D-135), por posición, en (d0, d1], con el PPC
// promedio de Cartera:
//   realizado     = cobros de ventas y vencimientos + rentas − costo de lo vendido
//   no realizado  = V1 − V0 − aperturas a su valor del día − compras + costo de lo vendido + amortizaciones
//   realizado + no realizado = V1 − V0 − ΣF = resultado (exacto, sin residuo).
// En dólares, cada flujo a su CCL y el costo en dólares (al CCL de cada compra).
// Solo hace falta el PPC cuando hay una venta: si es "sin dato", realizado y no
// realizado lo son, y el resultado sigue conocido.

import { calc, deCalc, sinDato, unicas, type Calc, type DobleCalc, type Etiqueta, type Insumo } from './calc'
import { COLOR_BIEN, COLOR_LIQUIDEZ_ARS, COLOR_PASIVO, COLOR_SIN_ELEGIR } from './colores'
import { CERO, Decimal, monto, numero, porcentaje } from './dinero'
import { diasEntre, fechaCorta, sumarDias } from './fechas'
import type { FlujoReal, RecurrenteBase } from './flujo/tipos'
import { financieros, foto, indexar, sumaCalc, type Foto, type Indices, type ItemFoto } from './foto'
import type { AperturaCuota, Cuota } from './pasivos/tipos'
import { costoCalc, tenencias, type Tenencia } from './posiciones'
import type { Fecha, Hechos, MovimientoCapital, Moneda, Operacion } from './tipos'
import {
  CAMBIO_DE_DEUDA,
  detalleContribucion,
  enVista,
  faltantesEnVista,
  fechasDeCarga,
  parteCalc,
  variacion,
  type Contribucion,
  type Flujo,
  type Parte,
  type Variacion,
  type Vista,
} from './variacion'

export type { Vista }

type K = 'ars' | 'usd'
const kDe = (m: Moneda): K => (m === 'ARS' ? 'ars' : 'usd')
const MONEDAS: Moneda[] = ['ARS', 'USD']
const fm = (d: Decimal, m: Moneda, signo = true) => monto(d, m, { decimales: 2, signo })
const sinPunto = (s: string) => s.trim().replace(/\.+$/, '')
const CIERRA = new Decimal('1e-12')

/** Par de cálculos armado moneda por moneda. */
function doble(f: (m: Moneda) => Calc): DobleCalc {
  return { ars: f('ARS'), usd: f('USD') }
}

/** El motivo de "un solo día de historia" (D-136). */
export const MOTIVO_SEGUNDA_CARGA = 'Necesita una segunda carga: con una sola no hay período que comparar.'

function sinSegunda(explicacion?: string): DobleCalc {
  return doble(() => sinDato(MOTIVO_SEGUNDA_CARGA, [], { explicacion }))
}

// ───────────── Cuotas del leasing pagadas desde tus cuentas (D-137) ─────────────

/** Número de carga de una cuota en el puente: negativo, para no chocar con ninguna carga real. */
const BASE_CUOTA = -1_000_000_000

export interface CuotaFuera {
  pasivo_id: number
  nro: number
  /** Cuándo salió (o debió salir) la plata: la fecha de pago o, sin ella, el vencimiento. El puente avisa solo las de su período. */
  fecha: Fecha
  motivo: string
}

export interface CuotasEnCuentas {
  /** Los hechos con cada cuota pagada desde una cuenta seguida como un retiro de esa cuenta. */
  hechos: Hechos
  /** carga sintética → la cuota. */
  porCarga: Map<number, { cuota: Cuota; monto: Decimal }>
  /** Pagadas que no entran al puente, con el porqué. */
  fuera: CuotaFuera[]
}

const memoCuotas = new WeakMap<Hechos, WeakMap<readonly Cuota[], CuotasEnCuentas>>()
const SIN_CUOTAS: readonly Cuota[] = Object.freeze([]) as readonly Cuota[]

/** ¿La app sigue la caja en pesos de esa cuenta a esa fecha? (hay un saldo en pesos cargado en o antes). */
function cajaSeguida(h: Hechos, cuenta_id: number, fecha: Fecha): boolean {
  return h.saldos.some((s) => s.cuenta_id === cuenta_id && s.moneda === 'ARS' && s.fecha <= fecha)
}

export function esCargaDeCuota(carga_id: number): boolean {
  return carga_id <= BASE_CUOTA
}

/**
 * Agrega a los hechos las cuotas pagadas desde una cuenta que la app sigue,
 * como retiros de esa cuenta en la fecha del pago (D-137). Las que no tienen
 * fecha de pago o cuenta, o cuya cuenta no tiene saldo en pesos cargado, no
 * entran y se dice por qué. Memorizado por hechos y lista: el motor cachea por
 * objeto de hechos, y así todo el armado usa el mismo.
 */
export function cuotasEnCuentas(h: Hechos, cuotas: readonly Cuota[] = SIN_CUOTAS): CuotasEnCuentas {
  let porH = memoCuotas.get(h)
  if (!porH) {
    porH = new WeakMap()
    memoCuotas.set(h, porH)
  }
  const ya = porH.get(cuotas)
  if (ya) return ya
  const porCarga = new Map<number, { cuota: Cuota; monto: Decimal }>()
  const fuera: CuotaFuera[] = []
  const movimientos: MovimientoCapital[] = []
  for (const c of cuotas) {
    if (!c.pagada) continue
    const total = c.canon_neto.plus(c.iva_canon).plus(c.seguro).plus(c.otros_conceptos)
    const pagado = c.monto_pagado ?? total
    if (c.fecha_pago === null) {
      fuera.push({ pasivo_id: c.pasivo_id, nro: c.nro, fecha: c.fecha_vencimiento, motivo: `La cuota ${c.nro} está pagada, pero sin fecha de pago: no se sabe en qué período salió la plata.` })
      continue
    }
    if (c.cuenta_pago_id === null) {
      fuera.push({ pasivo_id: c.pasivo_id, nro: c.nro, fecha: c.fecha_pago, motivo: `La cuota ${c.nro} no dice desde qué cuenta se pagó: se cuenta como plata de afuera.` })
      continue
    }
    if (!cajaSeguida(h, c.cuenta_pago_id, c.fecha_pago)) {
      const cuenta = h.cuentas.find((x) => x.id === c.cuenta_pago_id)?.nombre ?? 'la cuenta'
      fuera.push({ pasivo_id: c.pasivo_id, nro: c.nro, fecha: c.fecha_pago, motivo: `La cuota ${c.nro} salió de ${cuenta}, que no tiene saldo en pesos cargado a esa fecha: la app no sigue esa caja.` })
      continue
    }
    const carga = BASE_CUOTA - (c.pasivo_id * 10_000 + c.nro)
    porCarga.set(carga, { cuota: c, monto: pagado })
    movimientos.push({
      id: carga,
      fecha: c.fecha_pago,
      fecha_acreditacion: null,
      tipo: 'retiro',
      cuenta_origen_id: c.cuenta_pago_id,
      cuenta_destino_id: null,
      moneda_origen: 'ARS',
      monto_origen: pagado,
      moneda_destino: null,
      monto_destino: null,
      tc_aplicado: null,
      impuesto: CERO,
      carga_id: carga,
      notas: `cuota ${c.nro} del leasing`,
    })
  }
  const r: CuotasEnCuentas = { hechos: movimientos.length ? { ...h, movimientos: [...h.movimientos, ...movimientos] } : h, porCarga, fuera }
  porH.set(cuotas, r)
  return r
}

/** Un flujo con el nombre que entiende el dueño (la cuota del leasing no es "un retiro"). */
function rotularFlujo(f: Flujo, cc: CuotasEnCuentas): Flujo {
  const q = cc.porCarga.get(f.carga_id)
  if (!q) return f
  return { ...f, descripcion: `cuota ${q.cuota.nro} del leasing, pagada el ${fechaCorta(f.fecha)}`, carga_id: q.cuota.carga_id }
}

/** La variación con las cuotas rotuladas (objetos nuevos: la del motor está en su caché y no se toca). */
function rotular(v: Variacion, cc: CuotasEnCuentas): { v: Variacion; cuotas: Set<Flujo> } {
  const cuotas = new Set<Flujo>()
  if (cc.porCarga.size === 0) return { v, cuotas }
  const contribuciones = v.contribuciones.map((c) => {
    if (!c.flujos.some((f) => esCargaDeCuota(f.carga_id))) return c
    const flujos = c.flujos.map((f) => {
      if (!esCargaDeCuota(f.carga_id)) return f
      const r = rotularFlujo(f, cc)
      cuotas.add(r)
      return r
    })
    return { ...c, flujos }
  })
  return { v: { ...v, contribuciones }, cuotas }
}

/**
 * La variación del motor con las cuotas pagadas desde tus cuentas como flujos
 * (D-137), y los hechos que la producen: para la frase del período y quien
 * necesite la misma variación que el puente.
 */
export function variacionConCuotas(h: Hechos, d0: Fecha, d1: Fecha, hoy: Fecha, cuotas: readonly Cuota[] = SIN_CUOTAS): { v: Variacion; hechos: Hechos } {
  const cc = cuotasEnCuentas(h, cuotas)
  return { v: rotular(variacion(cc.hechos, d0, d1, { hoy }), cc).v, hechos: cc.hechos }
}

// ───────────── Patrimonio de una vista ─────────────

const EXPL_PATRIMONIO: Record<Vista, Record<Moneda, string>> = {
  financiero: {
    ARS: 'Todo lo invertible: títulos y liquidez de tus cuentas, en pesos (D-03).',
    USD: 'Todo lo invertible: títulos y liquidez de tus cuentas, en dólares al CCL de la carga (D-03).',
  },
  total: {
    ARS: 'Financiero + bienes (casa, auto) − deudas (el leasing), en pesos.',
    USD: 'Financiero + bienes (casa, auto) − deudas (el leasing), en dólares al CCL de la carga.',
  },
}

/** Las partes del patrimonio de una vista; sin bienes o sin el leasing, el total es "sin dato" (D-126). */
function partesPatrimonio(h: Hechos, f: Foto, vistaSel: Vista, m: Moneda): { nombre: string; calc: Calc }[] {
  const items = vistaSel === 'financiero' ? financieros(f) : f.items
  const partes = items.map((i) => ({ nombre: i.nombre, calc: m === 'ARS' ? i.valor_ars : i.valor_usd }))
  if (vistaSel === 'total') {
    if (h.bienes.length === 0) partes.push({ nombre: 'Tus bienes (casa, auto)', calc: sinDato('Todavía no cargaste tus bienes (casa, auto): los cargás en Datos › Bienes.') })
    if (h.pasivos.length === 0) partes.push({ nombre: 'La deuda del leasing', calc: sinDato('Todavía no cargaste el leasing: lo cargás en Datos › Leasing.') })
  }
  return partes
}

/** El patrimonio de la vista en una foto, en las dos monedas, con su traza. */
export function patrimonio(h: Hechos, f: Foto, vistaSel: Vista): DobleCalc {
  return doble((m) => sumaCalc(partesPatrimonio(h, f, vistaSel, m), m, EXPL_PATRIMONIO[vistaSel][m]))
}

// ───────────── La deuda estimada (D-154) ─────────────

/** Las etiquetas que dicen qué tan firme es un valor: una deuda estimada (o según cuadro, supuesta…) las pasa a todo lo que sale de ella. */
const FIRMEZA: readonly Etiqueta[] = ['estimado', 'supuesto', 'a_confirmar', 'proyectado']

/** Las etiquetas de firmeza que llevan esas partidas en su valor (en alguna de las fotos). */
function firmeza(items: readonly ItemFoto[]): Etiqueta[] {
  return unicas(items.flatMap((i) => [...i.valor_ars.etiquetas, ...i.valor_usd.etiquetas]).filter((e) => FIRMEZA.includes(e)))
}

/** Las deudas de unas fotos (la de salida y la de llegada). */
const deudasDe = (fotos: readonly Foto[]): ItemFoto[] => fotos.flatMap((f) => f.items.filter((i) => i.clase === 'pasivo'))

/** El cálculo con etiquetas sumadas (la traza no cambia). */
function conEtiquetas(c: Calc, es: readonly Etiqueta[]): Calc {
  return es.length ? { ...c, etiquetas: unicas([...c.etiquetas, ...es]) } : c
}

/** ¿Alguna deuda pone algo (distinto de cero) en esa parte y esa moneda? Solo ahí el estimado de la deuda pesa. */
function deudaPesa(v: Variacion, parte: Parte, k: K): boolean {
  return v.contribuciones.some((c) => c.clase === 'pasivo' && !c[parte][k].isZero())
}

// ───────────── El puente (HO-2, visión 4.7) ─────────────

export type ClaveLinea =
  | 'inicial'
  | 'aportes'
  | 'cuotas'
  | 'amortizacion'
  | 'activo'
  | 'tc'
  | 'sin_atribuir'
  | 'final'
  | 'de_lo_cual_bienes'
  | 'de_lo_cual_bienes_tc'
  | 'de_lo_cual_deuda'

export interface LineaPuente {
  clave: ClaveLinea
  nombre: string
  ars: Calc
  usd: Calc
  /** "De lo cual": se muestra debajo de su línea y no se suma. */
  informativa: boolean
}

export interface CuadrePuente {
  /** true si cierra en las dos monedas; null si no se puede verificar. */
  ok: boolean | null
  /** final − inicial − todas las líneas, en cada moneda (0 si cierra); "sin dato" si no se puede verificar. */
  ars: Calc
  usd: Calc
  detalle: string
}

export interface Puente {
  desde: Fecha
  hasta: Fecha
  vista: Vista
  lineas: LineaPuente[]
  cuadre: CuadrePuente
  /** Cuotas pagadas que no entran (sin fecha, sin cuenta o desde una caja que la app no sigue). */
  cuotas_fuera: CuotaFuera[]
}

const NOMBRE_LINEA: Record<ClaveLinea, string> = {
  inicial: 'Patrimonio al inicio',
  aportes: 'Aportes, retiros y altas',
  cuotas: 'Cuotas del leasing pagadas desde tus cuentas',
  amortizacion: 'Amortización de la deuda',
  activo: 'Resultado por tus activos',
  tc: 'Resultado por el tipo de cambio',
  sin_atribuir: 'Sin atribuir',
  final: 'Patrimonio al final',
  de_lo_cual_bienes: 'de lo cual: revaluación de bienes',
  de_lo_cual_bienes_tc: 'de lo cual: el dólar sobre tus bienes',
  de_lo_cual_deuda: 'de lo cual: el dólar sobre la deuda en pesos',
}

const EXPL_LINEA: Partial<Record<ClaveLinea, string>> = {
  aportes:
    'Plata que entró o salió de la app sin ser ganancia ni pérdida: aportes y retiros, tenencias y saldos que aparecieron (aperturas, saldo inicial) y operaciones cuya plata fue a una cuenta sin saldo cargado.',
  cuotas: 'Lo que salió de tus cuentas para pagar el leasing. Es una salida de plata, no una pérdida de tus inversiones (visión 4.7).',
  amortizacion:
    'Lo que cambió la deuda del leasing entre las dos cargas: con una cuota en el medio, sobre todo su amortización (la parte de la cuota que no es gasto: vuelve a tu patrimonio como deuda menos). Con la deuda según el cuadro de marcha, entre cuotas también suma el interés que corre hasta la próxima cuota (la deuda sube un poco cada día); el estado de resultados cuenta ese interés con la cuota, así que hasta que vence queda en "no explicado".',
  de_lo_cual_bienes: 'La parte de "por tus activos" que viene de una valuación nueva de tus bienes.',
  de_lo_cual_bienes_tc:
    'La parte de "por el tipo de cambio" que viene de tus bienes (visión 4.7): si el CCL sube, en dólares un bien valuado en pesos (la camioneta) vale menos, y en pesos uno valuado en dólares (la casa) vale más.',
  de_lo_cual_deuda: 'La parte de "por el tipo de cambio" que viene de la deuda en pesos: si el CCL sube, en dólares debés menos (se licúa).',
}

function esCambioDeCapital(c: Contribucion, f: Flujo): boolean {
  return c.clase === 'pasivo' && f.descripcion === CAMBIO_DE_DEUDA
}

function motivoFaltantes(faltan: Variacion['faltantes']): string {
  return faltan.map((f) => `${f.nombre} (${sinPunto(f.motivo)})`).join('; ')
}

/** Suma de los flujos que elige `elegir`, con su traza. */
function lineaFlujos(
  v: Variacion,
  H: Hechos,
  vistaSel: Vista,
  clave: ClaveLinea,
  elegir: (c: Contribucion, f: Flujo) => boolean,
): LineaPuente {
  const explicacion = EXPL_LINEA[clave]
  const una = (m: Moneda): Calc => {
    const k = kDe(m)
    const sel = v.contribuciones.filter((c) => enVista(c, vistaSel)).flatMap((c) => c.flujos.filter((f) => elegir(c, f)).map((f) => ({ c, f })))
    const total = sel.reduce((a, x) => a.plus(x.f[k]), CERO)
    const insumos: Insumo[] = sel.map(({ c, f }) => ({
      nombre: `${c.nombre}: ${f.descripcion}${f.inferido ? ' (inferido)' : ''}`,
      valor: f[k].toFixed(),
      unidad: m,
      origen: { carga_id: f.carga_id },
    }))
    const etiquetas: Etiqueta[] = sel.some((x) => x.f.inferido) ? ['inferido'] : []
    const faltan = faltantesEnVista(v, H, vistaSel)
    if (faltan.length)
      return sinDato(`No se puede calcular: ${motivoFaltantes(faltan)}. Suma parcial: ${fm(total, m)}.`, insumos, { etiquetas: ['parcial', ...etiquetas], explicacion })
    const formula = !sel.length
      ? `ninguno en el período = ${monto(CERO, m)}`
      : sel.length > 6
        ? `${sel.length} movimientos (los ves en los insumos) = ${fm(total, m)}`
        : `${sel.map(({ c, f }) => `${c.nombre}, ${f.descripcion} ${fm(f[k], m)}`).join(' + ')} = ${fm(total, m)}`
    return calc(total, formula, insumos, { explicacion, etiquetas })
  }
  return { clave, nombre: NOMBRE_LINEA[clave], ars: una('ARS'), usd: una('USD'), informativa: false }
}

/** Una parte (activo, TC o sin atribuir) de las partidas de una clase, con su traza. */
function parteDeClase(v: Variacion, clase: 'bien' | 'pasivo', parte: Parte, m: Moneda, explicacion: string): Calc {
  const k = kDe(m)
  const cs = v.contribuciones.filter((c) => c.clase === clase)
  const total = cs.reduce((a, c) => a.plus(c[parte][k]), CERO)
  const insumos: Insumo[] = cs.map((c) => ({ nombre: c.nombre, valor: c[parte][k].toFixed(), unidad: m, calc: detalleContribucion(c, parte, m, v) }))
  const faltan = v.faltantes.filter((f) => f.clave.startsWith(clase === 'bien' ? 'b:' : 'd:'))
  if (faltan.length) return sinDato(`No se puede calcular: ${motivoFaltantes(faltan)}. Suma parcial: ${fm(total, m)}.`, insumos, { etiquetas: ['parcial'], explicacion })
  const visibles = cs.filter((c) => !c[parte][k].isZero())
  const formula = visibles.length ? `${visibles.map((c) => `${c.nombre} ${fm(c[parte][k], m)}`).join(' + ')} = ${fm(total, m)}` : `nada en el período = ${monto(CERO, m)}`
  return calc(total, formula, insumos, { explicacion })
}

/**
 * El puente del período (visión 4.7, D-137): del patrimonio al inicio al del
 * final, línea por línea. Con una sola carga (d1 ≤ d0) las líneas son "sin
 * dato · necesita una segunda carga", nunca cero. El cuadre se calcula
 * (final − inicial − líneas = 0), no es un residuo.
 */
export function puente(h: Hechos, d0: Fecha, d1: Fecha, vistaSel: Vista, hoy: Fecha, opciones: { cuotas?: readonly Cuota[]; ix?: Indices } = {}): Puente {
  const cc = cuotasEnCuentas(h, opciones.cuotas)
  const ix = opciones.ix ?? indexar(h)
  const f0 = foto(h, d0, { hoy, ix })
  const f1 = d1 > d0 ? foto(h, d1, { hoy, ix }) : null
  const inicial = patrimonio(h, f0, vistaSel)
  const fin = f1 ? patrimonio(h, f1, vistaSel) : sinSegunda('Tu patrimonio en la carga de llegada del período.')
  const lin = (clave: ClaveLinea, d: DobleCalc, informativa = false): LineaPuente => ({ clave, nombre: NOMBRE_LINEA[clave], ars: d.ars, usd: d.usd, informativa })
  // El aviso de cuotas que no entran habla solo de las de este período (las de antes del día cero no tienen nada que ver).
  const cuotasFuera = cc.fuera.filter((c) => c.fecha > d0 && c.fecha <= d1)
  if (d1 <= d0) {
    const lineas: LineaPuente[] = [
      lin('inicial', inicial),
      lin('aportes', sinSegunda(EXPL_LINEA.aportes)),
      lin('cuotas', sinSegunda(EXPL_LINEA.cuotas)),
      ...(vistaSel === 'total' ? [lin('amortizacion', sinSegunda(EXPL_LINEA.amortizacion))] : []),
      lin('activo', sinSegunda()),
      lin('tc', sinSegunda()),
      lin('sin_atribuir', sinSegunda()),
      lin('final', fin),
    ]
    const n = sinDato<Decimal>(MOTIVO_SEGUNDA_CARGA)
    return { desde: d0, hasta: d1, vista: vistaSel, lineas, cuadre: { ok: null, ars: n, usd: n, detalle: 'Hace falta una segunda carga para el cuadre.' }, cuotas_fuera: cuotasFuera }
  }
  const H = cc.hechos
  const { v } = rotular(variacion(H, d0, d1, { hoy }), cc)
  // D-154: con la deuda estimada, todo lo que sale de ella lleva el chip (la amortización siempre: sin saldo nuevo, su 0 es el del estimado).
  const ed = vistaSel === 'total' ? firmeza(deudasDe([f0, f1 as Foto])) : []
  const parte = (p: Parte): DobleCalc => doble((m) => {
    const c = parteCalc(v, H, vistaSel, p, m)
    return ed.length && deudaPesa(v, p, kDe(m)) ? conEtiquetas(c, ed) : c
  })
  const lineas: LineaPuente[] = [
    lin('inicial', inicial),
    lineaFlujos(v, H, vistaSel, 'aportes', (c, f) => f.externo && !esCargaDeCuotaFlujo(f, cc) && !esCambioDeCapital(c, f)),
    lineaFlujos(v, H, vistaSel, 'cuotas', (_c, f) => esCargaDeCuotaFlujo(f, cc)),
  ]
  if (vistaSel === 'total') {
    const am = lineaFlujos(v, H, vistaSel, 'amortizacion', (c, f) => esCambioDeCapital(c, f))
    lineas.push({ ...am, ars: conEtiquetas(am.ars, ed), usd: conEtiquetas(am.usd, ed) })
  }
  lineas.push(lin('activo', parte('activo')))
  if (vistaSel === 'total') lineas.push(lin('de_lo_cual_bienes', doble((m) => parteDeClase(v, 'bien', 'activo', m, EXPL_LINEA.de_lo_cual_bienes!)), true))
  lineas.push(lin('tc', parte('tc')))
  if (vistaSel === 'total')
    lineas.push(
      lin('de_lo_cual_bienes_tc', doble((m) => parteDeClase(v, 'bien', 'tc', m, EXPL_LINEA.de_lo_cual_bienes_tc!)), true),
      lin(
        'de_lo_cual_deuda',
        doble((m) => {
          const c = parteDeClase(v, 'pasivo', 'tc', m, EXPL_LINEA.de_lo_cual_deuda!)
          return deudaPesa(v, 'tc', kDe(m)) ? conEtiquetas(c, ed) : c
        }),
        true,
      ),
    )
  lineas.push(lin('sin_atribuir', parte('sin_atribuir')), lin('final', fin))
  return { desde: d0, hasta: d1, vista: vistaSel, lineas, cuadre: cuadrePuente(lineas, d0, d1), cuotas_fuera: cuotasFuera }
}

/** Un flujo de cuota ya rotulado conserva la carga de la cuota (positiva): se reconoce por su descripción. */
function esCargaDeCuotaFlujo(f: Flujo, cc: CuotasEnCuentas): boolean {
  if (esCargaDeCuota(f.carga_id)) return true
  return cc.porCarga.size > 0 && /^cuota \d+ del leasing, pagada el /.test(f.descripcion)
}

function cuadrePuente(lineas: LineaPuente[], d0: Fecha, d1: Fecha): CuadrePuente {
  const ini = lineas.find((l) => l.clave === 'inicial')!
  const fin = lineas.find((l) => l.clave === 'final')!
  const partes = lineas.filter((l) => !l.informativa && l.clave !== 'inicial' && l.clave !== 'final')
  const una = (m: Moneda): Calc => {
    const k = kDe(m)
    const todas = [ini, fin, ...partes]
    const falta = todas.find((l) => l[k].valor === null)
    if (falta) return sinDato(`No verificable: ${falta.nombre.toLowerCase()} es "sin dato" (${sinPunto(falta[k].motivo ?? 'falta un dato')}).`)
    const suma = partes.reduce((a, l) => a.plus(l[k].valor as Decimal), CERO)
    const dif = (fin[k].valor as Decimal).minus(ini[k].valor as Decimal).minus(suma)
    const valor = dif.abs().lte(CIERRA) ? CERO : dif
    return calc(
      valor,
      `${monto(fin[k].valor as Decimal, m, { decimales: 2 })} − ${monto(ini[k].valor as Decimal, m, { decimales: 2 })} − (${partes.map((l) => fm(l[k].valor as Decimal, m)).join(' ')}) = ${fm(valor, m)}`,
      [deCalc(`Patrimonio del ${fechaCorta(d1)}`, fin[k], m), deCalc(`Patrimonio del ${fechaCorta(d0)}`, ini[k], m), ...partes.map((l) => deCalc(l.nombre, l[k], m))],
      { explicacion: 'Patrimonio al final − al inicio − cada línea del puente. Tiene que dar 0: no es un residuo, se calcula desde los hechos (D-66). Si no da, es un bug.' },
    )
  }
  const ars = una('ARS')
  const usd = una('USD')
  if (ars.valor === null || usd.valor === null)
    return { ok: null, ars, usd, detalle: ars.valor === null ? (ars.motivo ?? 'No verificable.') : (usd.motivo ?? 'No verificable.') }
  const ok = ars.valor.isZero() && usd.valor.isZero()
  return {
    ok,
    ars,
    usd,
    detalle: ok
      ? 'Patrimonio al final − al inicio = la suma de las líneas, en las dos monedas.'
      : 'No cierra: si no tiene explicación, es un bug. Revisalo.',
  }
}

/** Suma de las cuotas pagadas desde tus cuentas en (d0, d1] (D-137): negativa, cada una a su CCL del día. */
export function cuotasPagadasDesdeCuentas(h: Hechos, cuotas: readonly Cuota[], d0: Fecha, d1: Fecha, hoy: Fecha = d1): DobleCalc {
  if (d1 <= d0) return sinSegunda(EXPL_LINEA.cuotas)
  const cc = cuotasEnCuentas(h, cuotas)
  const { v } = rotular(variacion(cc.hechos, d0, d1, { hoy }), cc)
  const l = lineaFlujos(v, cc.hechos, 'financiero', 'cuotas', (_c, f) => esCargaDeCuotaFlujo(f, cc))
  return { ars: l.ars, usd: l.usd }
}

// ───────────── Resultado por partida, realizado y no realizado (D-135) ─────────────

export interface ResultadoPartida {
  clave: string
  nombre: string
  ticker: string
  cuenta: string | null
  clase: ItemFoto['clase']
  tipo: string
  color: string
  moneda_riesgo: Moneda
  resultado: DobleCalc
  activo: DobleCalc
  tc: DobleCalc
  sin_atribuir: DobleCalc
  realizado: DobleCalc | 'no_aplica'
  no_realizado: DobleCalc | 'no_aplica'
  /** Por qué no aplica (liquidez, bienes, deudas). */
  no_aplica: string | null
}

const NO_APLICA: Record<'saldo' | 'bien' | 'pasivo', string> = {
  saldo: 'La liquidez no tiene costo: su resultado es rendimiento o tipo de cambio.',
  bien: 'Un bien no tiene costo cargado: su resultado es la revaluación.',
  pasivo: 'Una deuda no tiene costo: su resultado es la licuación (o el encarecimiento) por el dólar.',
}

function operacionesDe(h: Hechos, cuenta_id: number, activo_id: number): Operacion[] {
  return h.operaciones
    .filter((o) => o.cuenta_id === cuenta_id && o.activo_id === activo_id)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.id - b.id))
}

/** La tenencia justo antes de una operación (mismo día: las de id menor). */
function tenenciaAntes(ops: readonly Operacion[], o: Operacion): Tenencia | null {
  const antes = ops.filter((x) => x.fecha < o.fecha || (x.fecha === o.fecha && x.id < o.id))
  return tenencias(antes).get(`${o.cuenta_id}:${o.activo_id}`) ?? null
}

const esBaja = (t?: Operacion['tipo']) => t === 'venta' || t === 'vencimiento'

/** Realizado de una posición en el período (cobros de ventas, vencimientos y rentas − costo de lo vendido), en una moneda. */
function realizadoPosicion(h: Hechos, c: Contribucion, d0: Fecha, d1: Fecha, m: Moneda, ticker: string): Calc {
  const k = kDe(m)
  const [, a, b] = c.clave.split(':')
  const ops = operacionesDe(h, Number(a), Number(b))
  const cobros = c.flujos.filter((f) => f.operacion && (esBaja(f.operacion.tipo) || f.operacion.tipo === 'renta'))
  const ingreso = cobros.reduce((x, f) => x.minus(f[k]), CERO)
  const insumos: Insumo[] = cobros.map((f) => ({ nombre: `Cobro: ${f.descripcion}${f.inferido ? ' (inferido)' : ''}`, valor: f[k].negated().toFixed(), unidad: m, origen: { carga_id: f.carga_id } }))
  let costo = CERO
  let falta: string | null = null
  for (const o of ops) {
    if (!esBaja(o.tipo) || !(o.fecha > d0 && o.fecha <= d1)) continue
    const t = tenenciaAntes(ops, o)
    if (!t || t.cantidad.isZero()) continue
    const base = m === 'ARS' ? t.costo_ars : t.costo_usd
    const factor = Decimal.min(o.cantidad.div(t.cantidad), 1)
    if (base === null) {
      falta ??= m === 'ARS' ? (t.motivo_ars ?? 'falta el costo') : (t.motivo_usd ?? 'falta el costo en dólares')
      continue
    }
    const cv = base.times(factor)
    costo = costo.plus(cv)
    insumos.push({
      nombre: `Costo de lo vendido (${o.tipo} del ${fechaCorta(o.fecha)}): ${monto(base, m, { decimales: 2 })} × ${numero(o.cantidad, 4, { min: 0 })} ÷ ${numero(t.cantidad, 4, { min: 0 })}`,
      valor: cv.toFixed(),
      unidad: m,
      origen: { carga_id: o.carga_id },
    })
  }
  const explicacion =
    'Lo que ya concretaste en el período: lo que cobraste por ventas, vencimientos y rentas menos lo que te había costado lo vendido (PPC promedio, como en Cartera). Una amortización baja el costo y no es realizado (D-114).'
  const etiquetas: Etiqueta[] = cobros.some((f) => f.inferido) ? ['inferido'] : []
  if (falta)
    return sinDato(`Falta el costo de ${ticker} (${sinPunto(falta)}): sin él no se separa lo realizado de lo no realizado. El resultado sí se conoce.`, insumos, {
      explicacion,
      etiquetas,
    })
  const r = ingreso.minus(costo)
  const formula = cobros.length ? `cobros ${fm(ingreso, m)} − costo de lo vendido ${monto(costo, m, { decimales: 2 })} = ${fm(r, m)}` : `sin ventas, vencimientos ni rentas en el período = ${monto(CERO, m)}`
  return calc(r, formula, insumos, { explicacion, etiquetas })
}

function noRealizadoPosicion(c: Contribucion, resultado: Calc, realizado: Calc, m: Moneda): Calc {
  const k = kDe(m)
  const explicacion =
    'Lo que cambió el valor de lo que tenés (y de lo vendido, hasta venderlo), sin la plata que entró o salió: V1 − V0 − aperturas a su valor del día − compras + costo de lo vendido + amortizaciones. Con el realizado suma el resultado, exacto.'
  if (resultado.valor === null || realizado.valor === null)
    return sinDato(realizado.valor === null ? (realizado.motivo ?? 'Falta el realizado.') : (resultado.motivo ?? 'Falta el resultado.'), [deCalc('Resultado', resultado, m), deCalc('Realizado', realizado, m)], {
      explicacion,
      etiquetas: unicas([...resultado.etiquetas, ...realizado.etiquetas]),
    })
  const nr = resultado.valor.minus(realizado.valor)
  const V0 = c.v0?.[k] ?? CERO
  const V1 = c.v1?.[k] ?? CERO
  const suma = (tipos: Operacion['tipo'][]) => c.flujos.filter((f) => f.operacion && tipos.includes(f.operacion.tipo)).reduce((a, f) => a.plus(f[k]), CERO)
  const aperturas = suma(['apertura'])
  const compras = suma(['compra'])
  const amort = suma(['amortizacion']).negated()
  const costoVendido = nr.minus(V1.minus(V0).minus(aperturas).minus(compras).plus(amort))
  return calc(
    nr,
    `${monto(V1, m, { decimales: 2 })} − ${monto(V0, m, { decimales: 2 })}${aperturas.isZero() ? '' : ` − aperturas ${monto(aperturas, m, { decimales: 2 })}`}${compras.isZero() ? '' : ` − compras ${monto(compras, m, { decimales: 2 })}`}${costoVendido.isZero() ? '' : ` + costo de lo vendido ${monto(costoVendido, m, { decimales: 2 })}`}${amort.isZero() ? '' : ` + amortizaciones ${monto(amort, m, { decimales: 2 })}`} = ${fm(nr, m)}`,
    [deCalc('Resultado del período', resultado, m), deCalc('Realizado', realizado, m)],
    { explicacion },
  )
}

/** El color de una partida que no está en ninguna de las dos fotos: el de su clase (D-157). */
function colorDeClase(clase: string): string {
  return clase === 'saldo' ? COLOR_LIQUIDEZ_ARS : clase === 'bien' ? COLOR_BIEN : clase === 'pasivo' ? COLOR_PASIVO : COLOR_SIN_ELEGIR
}

/** Datos de presentación de una partida (de la foto de llegada o de salida; si abrió y cerró adentro, del catálogo). */
function metaPartida(h: Hechos, c: Contribucion, items: Map<string, ItemFoto>, ix: Indices): { ticker: string; cuenta: string | null; tipo: string; color: string } {
  const it = items.get(c.clave)
  if (it) return { ticker: it.ticker, cuenta: it.cuenta?.nombre ?? null, tipo: it.tipo, color: it.color }
  const [p, a, b] = c.clave.split(':')
  if (p === 'p') {
    const act = h.activos.find((x) => x.id === Number(b))
    // El color del activo, el mismo que en las fotos (el del catálogo o el de su familia).
    return { ticker: act?.ticker ?? c.nombre, cuenta: h.cuentas.find((x) => x.id === Number(a))?.nombre ?? null, tipo: act?.tipo ?? 'otro', color: (act && ix.colores.get(act.id)) || COLOR_SIN_ELEGIR }
  }
  return { ticker: c.nombre, cuenta: null, tipo: c.clase, color: colorDeClase(c.clase) }
}

/**
 * Resultado de cada partida de la vista en el período: el resultado y sus
 * partes (D-35), y en las posiciones, realizado y no realizado (D-135). Las
 * partidas sin dato aparecen con su motivo. Con una sola carga, ninguna.
 */
export function resultadosPorPartida(h: Hechos, d0: Fecha, d1: Fecha, hoy: Fecha, opciones: { vista?: Vista; cuotas?: readonly Cuota[]; ix?: Indices } = {}): ResultadoPartida[] {
  if (d1 <= d0) return []
  const vistaSel = opciones.vista ?? 'financiero'
  const cc = cuotasEnCuentas(h, opciones.cuotas)
  const { v } = rotular(variacion(cc.hechos, d0, d1, { hoy }), cc)
  const ix = opciones.ix ?? indexar(h)
  const items = new Map<string, ItemFoto>()
  const f0 = foto(h, d0, { hoy, ix, traza: false })
  const f1 = foto(h, d1, { hoy, ix, traza: false })
  for (const i of f0.items) items.set(i.clave, i)
  for (const i of f1.items) items.set(i.clave, i)
  const out: ResultadoPartida[] = []
  for (const c of v.contribuciones.filter((x) => enVista(x, vistaSel))) {
    const meta = metaPartida(h, c, items, ix)
    // D-154: la fila de una deuda estimada lleva el chip donde la deuda pone algo.
    const ed = c.clase === 'pasivo' ? firmeza([...f0.items, ...f1.items].filter((i) => i.clave === c.clave)) : []
    const det = (p: Parte): DobleCalc =>
      doble((m) => {
        const x = detalleContribucion(c, p, m, v)
        return ed.length && !c[p][kDe(m)].isZero() ? conEtiquetas(x, ed) : x
      })
    const resultado = det('resultado')
    let realizado: DobleCalc | 'no_aplica' = 'no_aplica'
    let noRealizado: DobleCalc | 'no_aplica' = 'no_aplica'
    if (c.clase === 'posicion') {
      const r = doble((m) => realizadoPosicion(h, c, d0, d1, m, meta.ticker))
      realizado = r
      noRealizado = doble((m) => noRealizadoPosicion(c, resultado[kDe(m)], r[kDe(m)], m))
    }
    out.push({
      clave: c.clave,
      nombre: c.nombre,
      ...meta,
      clase: c.clase,
      moneda_riesgo: c.moneda_riesgo,
      resultado,
      activo: det('activo'),
      tc: det('tc'),
      sin_atribuir: det('sin_atribuir'),
      realizado,
      no_realizado: noRealizado,
      no_aplica: c.clase === 'posicion' ? null : NO_APLICA[c.clase],
    })
  }
  for (const f of faltantesEnVista(v, cc.hechos, vistaSel)) {
    const n = sinDato<Decimal>(f.motivo)
    const nd: DobleCalc = { ars: n, usd: n }
    const clase = (f.clave.startsWith('p:') ? 'posicion' : f.clave.startsWith('s:') ? 'saldo' : f.clave.startsWith('b:') ? 'bien' : 'pasivo') as ItemFoto['clase']
    const it = items.get(f.clave)
    out.push({
      clave: f.clave,
      nombre: f.nombre,
      ticker: it?.ticker ?? f.nombre,
      cuenta: it?.cuenta?.nombre ?? null,
      clase,
      tipo: it?.tipo ?? clase,
      color: it?.color ?? colorDeClase(clase),
      moneda_riesgo: it?.moneda_riesgo ?? 'ARS',
      resultado: nd,
      activo: nd,
      tc: nd,
      sin_atribuir: nd,
      realizado: clase === 'posicion' ? nd : 'no_aplica',
      no_realizado: clase === 'posicion' ? nd : 'no_aplica',
      no_aplica: clase === 'posicion' ? null : NO_APLICA[clase as 'saldo' | 'bien' | 'pasivo'],
    })
  }
  return out
}

/** Suma de una columna de resultados por partida (realizado, no realizado…), con "sin dato" si falta alguna. */
export function totalColumna(filas: ResultadoPartida[], sel: (f: ResultadoPartida) => DobleCalc | 'no_aplica', explicacion: string): DobleCalc {
  return doble((m) =>
    sumaCalc(
      filas.flatMap((f) => {
        const d = sel(f)
        return d === 'no_aplica' ? [] : [{ nombre: f.cuenta ? `${f.ticker} (${f.cuenta})` : f.ticker, calc: d[kDe(m)] }]
      }),
      m,
      explicacion,
    ),
  )
}

// ───────────── Agrupar por cuenta o por activo ─────────────

export interface GrupoResultados {
  clave: string
  nombre: string
  /** Las partidas del grupo (sus claves), en el orden de la tabla. */
  claves: string[]
  resultado: DobleCalc
  activo: DobleCalc
  tc: DobleCalc
  sin_atribuir: DobleCalc
  /** 'no_aplica' si ninguna partida del grupo tiene costo (liquidez, bienes, deudas). */
  realizado: DobleCalc | 'no_aplica'
  no_realizado: DobleCalc | 'no_aplica'
}

/** Dónde va una partida: su cuenta, o "Bienes y deudas" (no viven en una cuenta). */
function claveDeGrupo(f: ResultadoPartida, por: 'cuenta' | 'activo'): { clave: string; nombre: string } {
  if (por === 'cuenta') {
    if (f.cuenta) return { clave: `cuenta:${f.cuenta}`, nombre: f.cuenta }
    return f.clase === 'bien' || f.clase === 'pasivo' ? { clave: 'fuera', nombre: 'Bienes y deudas' } : { clave: 'sin-cuenta', nombre: 'Sin cuenta' }
  }
  if (f.clase === 'saldo') return { clave: `liquidez:${f.moneda_riesgo}`, nombre: f.moneda_riesgo === 'USD' ? 'Dólares (liquidez)' : 'Pesos (liquidez)' }
  return { clave: `activo:${f.ticker}`, nombre: f.ticker }
}

/**
 * Los resultados por partida agrupados por cuenta (IEB, Galicia…) o por activo
 * (el mismo ticker en dos cuentas suma junto). Cada columna del grupo es la
 * suma de sus partidas, con su traza; realizado y no realizado "no aplican" si
 * no aplican a ninguna. Agrupar no recalcula nada: solo suma lo que ya está.
 */
export function agruparResultados(filas: ResultadoPartida[], por: 'cuenta' | 'activo'): GrupoResultados[] {
  const grupos = new Map<string, { nombre: string; filas: ResultadoPartida[] }>()
  for (const f of filas) {
    const g = claveDeGrupo(f, por)
    const ya = grupos.get(g.clave)
    if (ya) ya.filas.push(f)
    else grupos.set(g.clave, { nombre: g.nombre, filas: [f] })
  }
  return [...grupos.entries()].map(([clave, g]) => {
    const expl = (que: string) => `${que} de ${g.nombre}: la suma de sus partidas (${g.filas.length}).`
    const aplican = (sel: (f: ResultadoPartida) => DobleCalc | 'no_aplica') => g.filas.some((f) => sel(f) !== 'no_aplica')
    return {
      clave,
      nombre: g.nombre,
      claves: g.filas.map((f) => f.clave),
      resultado: totalColumna(g.filas, (f) => f.resultado, expl('El resultado del período')),
      activo: totalColumna(g.filas, (f) => f.activo, expl('Lo que puso el precio')),
      tc: totalColumna(g.filas, (f) => f.tc, expl('Lo que puso el tipo de cambio')),
      sin_atribuir: totalColumna(g.filas, (f) => f.sin_atribuir, expl('Lo sin atribuir')),
      realizado: aplican((f) => f.realizado) ? totalColumna(g.filas, (f) => f.realizado, expl('Lo realizado')) : 'no_aplica',
      no_realizado: aplican((f) => f.no_realizado) ? totalColumna(g.filas, (f) => f.no_realizado, expl('Lo no realizado')) : 'no_aplica',
    }
  })
}

// ───────────── PnL por mes ─────────────

export interface MesPnl {
  /** Primer día del mes. */
  mes: Fecha
  desde: Fecha
  hasta: Fecha
  /** "parcial, desde el mié 14/10", "parcial, hasta el mié 21/10" o null si es el mes entero. */
  parcial: string | null
  puente: Puente
}

const finDeMes = (mes: Fecha): Fecha => {
  const [a, m] = mes.split('-').map(Number)
  const sig = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`
  return sumarDias(sig, -1)
}
const mesDe = (f: Fecha): Fecha => `${f.slice(0, 7)}-01`

/**
 * El PnL de cada mes del período (desde, hasta]: de la última carga del mes
 * anterior (o `desde`) a la última del mes. Cada mes es la suma exacta de sus
 * días, y los meses suman el período (el motor une los intervalos entre
 * cargas consecutivas).
 */
export function pnlPorMes(h: Hechos, desde: Fecha, hasta: Fecha, vistaSel: Vista, hoy: Fecha, opciones: { cuotas?: readonly Cuota[]; ix?: Indices } = {}): MesPnl[] {
  const todas = fechasDeCarga(h)
  const cargas = todas.filter((d) => d >= desde && d <= hasta)
  if (cargas.length < 2) return []
  const ix = opciones.ix ?? indexar(h)
  const out: MesPnl[] = []
  let ini = cargas[0]
  for (let mes = mesDe(cargas[0]); mes <= mesDe(cargas.at(-1)!); mes = sumarDias(finDeMes(mes), 1)) {
    const fin = [...cargas].reverse().find((d) => d <= finDeMes(mes))
    if (!fin || fin <= ini) continue
    const desdeMes = ini < mes
    // Parcial al final: el período corta antes del cierre del mes (el mes sigue en curso, o hay cargas del mes que quedan afuera).
    const hastaMes = fin === cargas.at(-1) && fin < finDeMes(mes) && (mesDe(hoy) === mes || todas.some((d) => d > fin && d <= finDeMes(mes)))
    const parcial = !desdeMes && hastaMes ? `del ${fechaCorta(ini)} al ${fechaCorta(fin)}` : !desdeMes ? `parcial, desde el ${fechaCorta(ini)}` : hastaMes ? `parcial, hasta el ${fechaCorta(fin)}` : null
    out.push({ mes, desde: ini, hasta: fin, parcial, puente: puente(h, ini, fin, vistaSel, hoy, { cuotas: opciones.cuotas, ix }) })
    ini = fin
  }
  return out
}

// ───────────── Patrimonio en el tiempo y capital aportado ─────────────

export interface PuntoSerie {
  fecha: Fecha
  ars: string | null
  usd: string | null
  /** Ese día algún precio o saldo era viejo (CO-5): el punto se marca hueco en el gráfico. */
  viejo?: boolean
  /** Ese día el patrimonio lleva un estimado (la deuda del leasing estimada, D-154): el gráfico lo rotula. */
  estimado?: boolean
}

/** El patrimonio de la vista en cada fecha de carga (un punto por carga, sin inventar los días sin carga). */
export function serieEvolucion(h: Hechos, vistaSel: Vista, hoy: Fecha, opciones: { ix?: Indices } = {}): PuntoSerie[] {
  const ix = opciones.ix ?? indexar(h)
  return fechasDeCarga(h).map((d) => {
    const f = foto(h, d, { hoy, ix, traza: false })
    const p = patrimonio(h, f, vistaSel)
    const viejo = p.ars.etiquetas.includes('viejo') || p.usd.etiquetas.includes('viejo')
    const estimado = p.ars.etiquetas.includes('estimado') || p.usd.etiquetas.includes('estimado')
    return { fecha: d, ars: p.ars.valor?.toFixed() ?? null, usd: p.usd.valor?.toFixed() ?? null, ...(viejo ? { viejo } : {}), ...(estimado ? { estimado } : {}) }
  })
}

/**
 * Capital aportado: arranca en el patrimonio del día cero y suma la plata que
 * entró y salió (aportes, retiros, altas y las cuotas pagadas desde tus
 * cuentas), cada flujo a su CCL del día, como el puente. Así, patrimonio −
 * capital aportado = lo ganado o perdido desde el día cero, exacto. Si un
 * intervalo tiene una partida sin dato, desde ahí es "sin dato".
 */
export function capitalAportado(h: Hechos, vistaSel: Vista, hoy: Fecha, opciones: { cuotas?: readonly Cuota[]; ix?: Indices } = {}): PuntoSerie[] {
  const serie = serieEvolucion(h, vistaSel, hoy, { ix: opciones.ix })
  if (!serie.length) return []
  const cc = cuotasEnCuentas(h, opciones.cuotas)
  const out: PuntoSerie[] = [{ ...serie[0] }]
  let ars: Decimal | null = serie[0].ars === null ? null : new Decimal(serie[0].ars)
  let usd: Decimal | null = serie[0].usd === null ? null : new Decimal(serie[0].usd)
  for (let i = 1; i < serie.length; i++) {
    const v = variacion(cc.hechos, serie[i - 1].fecha, serie[i].fecha, { hoy })
    if (faltantesEnVista(v, cc.hechos, vistaSel).length) {
      ars = null
      usd = null
    } else {
      const ext = v.contribuciones.filter((c) => enVista(c, vistaSel)).flatMap((c) => c.flujos.filter((f) => f.externo))
      ars = ars === null ? null : ext.reduce((a, f) => a.plus(f.ars), ars)
      usd = usd === null ? null : ext.reduce((a, f) => a.plus(f.usd), usd)
    }
    out.push({ fecha: serie[i].fecha, ars: ars?.toFixed() ?? null, usd: usd?.toFixed() ?? null })
  }
  return out
}

// ───────────── El día cero: lo que ya traías (D-136) ─────────────

export interface FilaDiaCero {
  clave: string
  ticker: string
  nombre: string
  cuenta: string | null
  color: string
  valor: DobleCalc
  costo: DobleCalc
  resultado: DobleCalc
  /** Qué falta para tenerlo en dólares (el CCL de compra de la apertura). */
  pendiente: string | null
}

/**
 * Lo que ya traías al día cero, desde la compra, según el PPP de tus brókers:
 * valor del día cero − costo de la tenencia (costoCalc, lo mismo que Cartera).
 * En dólares, solo donde declaraste el CCL de compra; si no, "sin dato" y el
 * total es la suma parcial.
 */
export function noRealizadoAlDiaCero(h: Hechos, hoy: Fecha, opciones: { ix?: Indices } = {}): { fecha: Fecha; filas: FilaDiaCero[]; total: DobleCalc } | null {
  const fecha = fechasDeCarga(h)[0]
  if (!fecha) return null
  const f = foto(h, fecha, { hoy, ix: opciones.ix ?? indexar(h) })
  const filas: FilaDiaCero[] = []
  for (const i of f.items) {
    if (i.clase !== 'posicion' || !i.tenencia) continue
    const t = i.tenencia
    const costo = { ars: costoCalc(t, 'ARS'), usd: costoCalc(t, 'USD') }
    const valor = { ars: i.valor_ars, usd: i.valor_usd }
    const resultado = doble((m) => {
      const k = kDe(m)
      const val = valor[k]
      const cos = costo[k]
      const explicacion = `Lo que ya ganabas o perdías con ${i.ticker} el día cero, desde la compra, en ${m === 'ARS' ? 'pesos' : 'dólares (cada compra a su CCL)'}: valor − costo según el PPP de tu bróker.`
      if (val.valor === null || cos.valor === null)
        return sinDato(
          cos.valor === null ? (cos.motivo ?? 'Falta el costo.') : (val.motivo ?? 'Falta el valor.'),
          [deCalc('Valor el día cero', val, m), deCalc('Costo', cos, m)],
          { explicacion, etiquetas: cos.etiquetas },
        )
      const r = val.valor.minus(cos.valor)
      return calc(r, `${monto(val.valor, m, { decimales: 2 })} − ${monto(cos.valor, m, { decimales: 2 })} = ${fm(r, m)}`, [deCalc('Valor el día cero', val, m), deCalc('Costo', cos, m)], { explicacion })
    })
    filas.push({
      clave: i.clave,
      ticker: i.ticker,
      nombre: i.nombre,
      cuenta: i.cuenta?.nombre ?? null,
      color: i.color,
      valor,
      costo,
      resultado,
      // Si falta en pesos, falta en las dos: se dice ese motivo. Si falta solo en dólares por la apertura, el CCL de compra.
      pendiente:
        resultado.ars.valor === null
          ? (resultado.ars.motivo ?? null)
          : resultado.usd.valor === null && t.apertura_sin_ccl
            ? `Falta el CCL de compra de ${i.ticker}: sin él, en dólares es «sin dato» (lo vas a poder declarar en Pendientes; en pesos ya está).`
            : resultado.usd.valor === null
              ? (resultado.usd.motivo ?? null)
              : null,
    })
  }
  const explicacion = {
    ARS: 'Lo que ya ganabas o perdías el día cero con tus títulos, desde la compra, en pesos (PPP de tus brókers). No es resultado del período: es el punto de partida.',
    USD: 'Lo mismo en dólares, cada compra a su CCL. Sin el CCL de compra de una apertura, esa fila es "sin dato" y el total, la suma parcial.',
  }
  const total = doble((m) => sumaCalc(filas.map((x) => ({ nombre: x.cuenta ? `${x.ticker} (${x.cuenta})` : x.ticker, calc: x.resultado[kDe(m)] })), m, explicacion[m]))
  return { fecha, filas, total }
}

// ───────────── Sensibilidad al CCL ─────────────

export interface Sensibilidad {
  /** La suba del CCL, como fracción ("0.01"). */
  pct: Decimal
  /** En pesos: cuánto suben tus activos en dólares. */
  ars: Calc
  /** En dólares: cuánto bajan tus pesos. */
  usd: Calc
  /** Lo que arriesga dólares y lo que arriesga pesos, en las dos monedas (la frase dice cada uno en la suya). */
  base_usd: DobleCalc
  base_pesos: DobleCalc
}

/**
 * Si el CCL sube `pct` (sensibilidad, no pronóstico), sobre el financiero de
 * la foto: en pesos, lo que arriesga dólares sube × pct; en dólares, lo que
 * arriesga pesos baja ÷ CCL × (1 − 1 ÷ (1 + pct)).
 */
export function sensibilidadCcl(f: Foto, pct: Decimal): Sensibilidad {
  const fin = financieros(f)
  const usdItems = fin.filter((i) => i.moneda_riesgo === 'USD')
  const arsItems = fin.filter((i) => i.moneda_riesgo === 'ARS')
  const base = (items: ItemFoto[], que: string) =>
    doble((m) => sumaCalc(items.map((i) => ({ nombre: i.nombre, calc: m === 'ARS' ? i.valor_ars : i.valor_usd })), m, `${que}, ${m === 'ARS' ? 'en pesos' : 'en dólares al CCL de la carga'}.`))
  const baseUsdD = base(usdItems, 'Lo que arriesga dólares (CEDEARs, dólares)')
  const basePesosD = base(arsItems, 'Lo que arriesga pesos (bonos, letras, FCI, acciones locales y pesos)')
  const baseUsd = baseUsdD.ars
  const basePesos = basePesosD.ars
  const pctTxt = porcentaje(pct, { decimales: 0 })
  const ars =
    baseUsd.valor === null
      ? sinDato(baseUsd.motivo ?? 'Falta el valor de lo que arriesga dólares.', [deCalc('Lo que arriesga dólares', baseUsd, 'ARS')], { etiquetas: baseUsd.etiquetas })
      : calc(baseUsd.valor.times(pct), `${monto(baseUsd.valor, 'ARS', { decimales: 2 })} × ${pctTxt} = ${fm(baseUsd.valor.times(pct), 'ARS')}`, [deCalc('Lo que arriesga dólares, en pesos', baseUsd, 'ARS')], {
          explicacion: `Cuánto suben en pesos tus activos en dólares si el CCL sube ${pctTxt}. Es una sensibilidad, no un pronóstico.`,
        })
  const ccl = f.ccl.valor
  const factor = pct.div(pct.plus(1))
  const usd =
    basePesos.valor === null || ccl === null
      ? sinDato(basePesos.valor === null ? (basePesos.motivo ?? 'Falta el valor de tus pesos.') : 'Falta el CCL.', [deCalc('Lo que arriesga pesos', basePesos, 'ARS'), deCalc('CCL', f.ccl, 'ratio')], { etiquetas: basePesos.etiquetas })
      : calc(
          basePesos.valor.negated().div(ccl).times(factor),
          `−${monto(basePesos.valor, 'ARS', { decimales: 2 })} ÷ CCL ${numero(ccl, 2)} × (1 − 1 ÷ ${numero(pct.plus(1), 2)}) = ${fm(basePesos.valor.negated().div(ccl).times(factor), 'USD')}`,
          [deCalc('Lo que arriesga pesos', basePesos, 'ARS'), deCalc('CCL', f.ccl, 'ratio')],
          { explicacion: `Cuánto bajan en dólares tus pesos si el CCL sube ${pctTxt}. Es una sensibilidad, no un pronóstico.` },
        )
  return { pct, ars, usd, base_usd: baseUsdD, base_pesos: basePesosD }
}

// ───────────── Estado de resultados del período (D-138) ─────────────

export type ClaveResultado =
  | 'ingresos_mensuales'
  | 'ingresos_extra'
  | 'gastos_fijos'
  | 'gastos_extra'
  | 'leasing'
  | 'leasing_interes'
  | 'leasing_iva'
  | 'leasing_seguro'
  | 'leasing_percepcion'
  | 'leasing_cargos'
  | 'ahorro'
  | 'inversiones'
  | 'inv_realizado'
  | 'inv_no_realizado'
  | 'inv_liquidez'
  | 'inv_activo'
  | 'inv_tc'
  | 'revaluacion'
  | 'licuacion'
  | 'explicada'
  | 'real'
  | 'no_explicado'

export interface LineaResultado {
  clave: ClaveResultado
  nombre: string
  ars: Calc
  usd: Calc
  /** + suma, − resta, = subtotal o total, 'detalle' = renglón de abajo que no se suma. */
  signo: '+' | '−' | '=' | 'detalle'
  /** Un rótulo corto para el chip ("declarado", "estimado", "crédito fiscal de la sociedad"). */
  rotulo: string | null
  /** Texto en lugar del monto cuando no hubo nada (ej. "ninguno cargado"); el monto (0) queda en la traza. */
  nota: string | null
}

export interface EstadoResultados {
  desde: Fecha
  hasta: Fecha
  /** true si el período es el mes en curso con una sola carga: lo patrimonial es "sin dato". */
  un_dia: boolean
  lineas: LineaResultado[]
  no_explicado: DobleCalc
}

export interface EntradasResultados {
  /** La apertura de cada cuota del leasing que pagás vos (de Pasivos: aperturaCuota). */
  leasing: readonly AperturaCuota[]
  /** Lo que cargaste con "Cargar ingreso" y "Cargar gasto" (flujos_reales). */
  flujos: readonly FlujoReal[]
  /** Tus ingresos y gastos declarados, con su vigencia (ingresos_fijos, gastos_fijos). */
  recurrentes: readonly RecurrenteBase[]
  /** ¿La empresa te reintegra el IVA y la percepción del leasing? null = sin declarar. */
  reintegra_iva?: boolean | null
  /** Cuotas pagadas (para el puente: las que salieron de tus cuentas). */
  cuotas?: readonly Cuota[]
  /**
   * Por qué `leasing` está vacío con el cuadro de marcha importado: todas las
   * cuotas las paga la empresa (en tu resultado, $ 0, con esa nota). Ausente o
   * null = falta el cuadro. Sin decir quién paga, la pagás vos (D-155).
   */
  leasing_vacio?: 'empresa' | null
  /**
   * Un cuadro de marcha incompleto: los meses del plazo sin su cuota
   * (mesesSinCuota) y el motivo. Si el período toca uno, el costo del leasing
   * es "sin dato" (nunca $ 0), como en Flujo y en Hoy.
   */
  sin_cuota?: readonly { motivo: string; meses: readonly Fecha[] }[]
}

/** CCL para convertir un flujo de una fecha: el tipeado ese día, si no el último anterior, si no el primero posterior (como el motor). */
function cclDelDia(h: Hechos, fecha: Fecha): { valor: Decimal; fecha: Fecha } | null {
  const ts = h.tipos_cambio.filter((t) => t.ccl !== null).sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
  let r: { valor: Decimal; fecha: Fecha } | null = null
  for (const t of ts) {
    if (t.fecha <= fecha) r = { valor: t.ccl as Decimal, fecha: t.fecha }
    else return r ?? { valor: t.ccl as Decimal, fecha: t.fecha }
  }
  return r
}

interface Tramo {
  mes: Fecha
  desde: Fecha
  hasta: Fecha
  dias: number
  diasMes: number
}

/** (d0, d1] partido por mes calendario. */
function tramosMensuales(d0: Fecha, d1: Fecha): Tramo[] {
  const out: Tramo[] = []
  let desde = sumarDias(d0, 1)
  while (desde <= d1) {
    const mes = mesDe(desde)
    const fin = finDeMes(mes)
    const hasta = fin < d1 ? fin : d1
    out.push({ mes, desde, hasta, dias: diasEntre(desde, hasta) + 1, diasMes: diasEntre(mes, fin) + 1 })
    desde = sumarDias(hasta, 1)
  }
  return out
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const nombreMes = (mes: Fecha) => `${MESES_CORTOS[Number(mes.slice(5, 7)) - 1]}-${mes.slice(2, 4)}`

const CADA: Record<RecurrenteBase['frecuencia'], number> = { mensual: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 }

/** Un monto en una moneda, en las dos, al CCL de una fecha (o con los pesos que recibiste). */
function enDos(h: Hechos, moneda: Moneda, montoD: Decimal, fecha: Fecha, pesosRecibidos: Decimal | null): { ars: Decimal; usd: Decimal; nota: string } | null {
  if (moneda === 'USD' && pesosRecibidos !== null) return { ars: pesosRecibidos, usd: montoD, nota: `${monto(montoD, 'USD', { decimales: 2 })}, recibiste ${monto(pesosRecibidos, 'ARS', { decimales: 2 })}` }
  const c = cclDelDia(h, fecha)
  if (!c) return null
  return moneda === 'USD'
    ? { ars: montoD.times(c.valor), usd: montoD, nota: `${monto(montoD, 'USD', { decimales: 2 })} × CCL ${numero(c.valor, 2)} del ${fechaCorta(c.fecha)}` }
    : { ars: montoD, usd: montoD.div(c.valor), nota: `${monto(montoD, 'ARS', { decimales: 2 })} ÷ CCL ${numero(c.valor, 2)} del ${fechaCorta(c.fecha)}` }
}

/** El dólar cripto que rige a una fecha: el último cargado hasta ese día (o, si no hay, el primero después), como el CCL. */
function criptoDelDia(h: Hechos, fecha: Fecha): { valor: Decimal; fecha: Fecha } | null {
  const ts = h.tipos_cambio.filter((t) => t.cripto_venta !== null).sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
  let r: { valor: Decimal; fecha: Fecha } | null = null
  for (const t of ts) {
    if (t.fecha <= fecha) r = { valor: t.cripto_venta as Decimal, fecha: t.fecha }
    else return r ?? { valor: t.cripto_venta as Decimal, fecha: t.fecha }
  }
  return r
}

/** Un ingreso declarado en dólares se vende al dólar cripto, como en Flujo: en pesos, US$ × cripto; en dólares, los declarados. */
function alCripto(h: Hechos, montoD: Decimal, fecha: Fecha): { ars: Decimal; usd: Decimal; nota: string } | null {
  const c = criptoDelDia(h, fecha)
  if (!c) return null
  return { ars: montoD.times(c.valor), usd: montoD, nota: `${monto(montoD, 'USD', { decimales: 2 })} × cripto ${numero(c.valor, 2)} del ${fechaCorta(c.fecha)}` }
}

interface Partida {
  nombre: string
  ars: Decimal
  usd: Decimal
  origen?: number
  etiquetas: Etiqueta[]
}

/** Una línea de flujos (reales o declarados): suma con su traza; sin ningún dato, "sin dato" con el motivo. */
function lineaDeFlujos(clave: ClaveResultado, nombre: string, signo: LineaResultado['signo'], partes: Partida[] | { falta: string }, explicacion: string, vacio: { nota: string } | null, rotulo: string | null = null): LineaResultado {
  if ('falta' in partes) {
    const n = sinDato<Decimal>(partes.falta, [], { explicacion })
    return { clave, nombre, ars: n, usd: n, signo, rotulo, nota: null }
  }
  const una = (m: Moneda): Calc => {
    const k = kDe(m)
    const total = partes.reduce((a, p) => a.plus(p[k]), CERO)
    const insumos: Insumo[] = partes.map((p) => ({ nombre: p.nombre, valor: p[k].toFixed(), unidad: m, origen: p.origen ? { carga_id: p.origen } : undefined }))
    const formula = partes.length
      ? partes.length > 6
        ? `${partes.length} renglones (los ves en los insumos) = ${monto(total, m, { decimales: 2 })}`
        : `${partes.map((p) => `${p.nombre} ${monto(p[k], m, { decimales: 2 })}`).join(' + ')} = ${monto(total, m, { decimales: 2 })}`
      : `${vacio?.nota ?? 'nada'} = ${monto(CERO, m)}`
    return calc(total, formula, insumos, { explicacion, etiquetas: unicas(partes.flatMap((p) => p.etiquetas)) })
  }
  return { clave, nombre, ars: una('ARS'), usd: una('USD'), signo, rotulo, nota: partes.length === 0 ? (vacio?.nota ?? null) : null }
}

/** Suma con signo de líneas: "sin dato" si falta alguna, con la suma parcial. */
function combinar(clave: ClaveResultado, nombre: string, partes: { l: LineaResultado; signo: 1 | -1 }[], explicacion: string): LineaResultado {
  const una = (m: Moneda): Calc => {
    const k = kDe(m)
    const insumos = partes.map((p) => deCalc(`${p.signo < 0 ? '− ' : ''}${p.l.nombre}`, p.l[k], m))
    const conocidas = partes.filter((p) => p.l[k].valor !== null)
    const suma = conocidas.reduce((a, p) => (p.signo > 0 ? a.plus(p.l[k].valor as Decimal) : a.minus(p.l[k].valor as Decimal)), CERO)
    const faltan = partes.filter((p) => p.l[k].valor === null)
    if (faltan.length) {
      // Sin nada conocido que no sea cero (lo extraordinario "ninguno cargado"), no hay suma parcial: decir "$ 0" sería inventar.
      const hayParcial = conocidas.some((p) => !(p.l[k].valor as Decimal).isZero())
      const lista = faltan.map((p) => p.l.nombre.toLowerCase()).join(', ')
      const motivo =
        faltan.length === partes.length
          ? (faltan[0].l[k].motivo ?? 'Falta un dato.')
          : hayParcial
            ? `Falta${faltan.length > 1 ? 'n' : ''} ${lista}. Suma parcial (${conocidas.length} de ${partes.length}): ${fm(suma, m)}.`
            : faltan.length === 1
              ? (faltan[0].l[k].motivo ?? `Falta ${lista}.`)
              : `Faltan ${lista}: ${faltan.map((p) => sinPunto(p.l[k].motivo ?? 'falta un dato')).join('; ')}.`
      return sinDato(motivo, insumos, { etiquetas: hayParcial ? ['parcial'] : [], explicacion })
    }
    return calc(suma, `${partes.map((p, i) => `${i === 0 ? (p.signo < 0 ? '−' : '') : p.signo < 0 ? ' − ' : ' + '}${monto((p.l[k].valor as Decimal).abs(), m, { decimales: 2 })}${(p.l[k].valor as Decimal).isNegative() ? ' (negativo)' : ''}`).join('')} = ${fm(suma, m)}`, insumos, { explicacion })
  }
  return { clave, nombre, ars: una('ARS'), usd: una('USD'), signo: '=', rotulo: null, nota: null }
}

/** Ingresos o gastos mensuales: por mes, lo cargado si hay; si no, lo declarado (prorrateado por días), rotulado. */
function mensuales(h: Hechos, e: EntradasResultados, tramos: Tramo[], sentido: 'ingreso' | 'gasto'): { partes: Partida[]; declarado: boolean } | { falta: string } {
  const partes: Partida[] = []
  let declarado = false
  let alguno = false
  for (const t of tramos) {
    const reales = e.flujos.filter((f) => !f.anulado && f.sentido === sentido && f.concepto === 'mensual' && f.fecha >= t.desde && f.fecha <= t.hasta)
    for (const f of reales) {
      alguno = true
      const d = enDos(h, f.moneda, new Decimal(f.monto), f.fecha, f.pesos_recibidos === null ? null : new Decimal(f.pesos_recibidos))
      if (!d) return { falta: 'Falta el CCL para pasar a la otra moneda un ingreso o gasto que cargaste.' }
      partes.push({ nombre: `${sentido === 'ingreso' ? 'Ingreso' : 'Gasto'} mensual del ${fechaCorta(f.fecha)} (${d.nota})`, ars: d.ars, usd: d.usd, origen: f.carga_id, etiquetas: [] })
    }
    // Como en Flujo y en Hoy: lo cargado del mes reemplaza a lo declarado; los ingresos, por moneda
    // (cargar los dólares no borra el ingreso en pesos declarado), y los gastos, todos juntos.
    const monedasCargadas = new Set(reales.map((f) => f.moneda))
    const reemplazado = (m: Moneda) => (sentido === 'ingreso' ? monedasCargadas.has(m) : reales.length > 0)
    for (const r of e.recurrentes) {
      if (r.sentido !== sentido || reemplazado(r.moneda)) continue
      const desde = r.vigente_desde > t.desde ? r.vigente_desde : t.desde
      const hasta = r.vigente_hasta !== null && r.vigente_hasta < t.hasta ? r.vigente_hasta : t.hasta
      if (desde > hasta) continue
      const n = CADA[r.frecuencia]
      let factor: Decimal
      let divisor = 1
      let como: string
      if (n === 1) {
        const dias = diasEntre(desde, hasta) + 1
        factor = new Decimal(dias)
        divisor = t.diasMes
        como = dias === t.diasMes ? `${nombreMes(t.mes)}, mes entero` : `${nombreMes(t.mes)}, ${dias} de ${t.diasMes} días`
      } else {
        const primer = r.primer_mes ?? mesDe(r.vigente_desde)
        const meses = (Number(t.mes.slice(0, 4)) - Number(primer.slice(0, 4))) * 12 + Number(t.mes.slice(5, 7)) - Number(primer.slice(5, 7))
        if (meses < 0 || meses % n !== 0) continue
        factor = new Decimal(1)
        como = `${nombreMes(t.mes)}, ${r.frecuencia} (vence en su mes)`
      }
      // Primero se multiplica y después se divide: 3.100.000 × 4 ÷ 31 da exacto 400.000.
      const base = new Decimal(r.monto).times(factor).div(divisor)
      const fecha = t.hasta
      const alDolarCripto = sentido === 'ingreso' && r.moneda === 'USD'
      const d = alDolarCripto ? alCripto(h, base, fecha) : enDos(h, r.moneda, base, fecha, null)
      if (!d)
        return {
          falta: alDolarCripto
            ? 'Falta el dólar cripto para pasar a pesos tus ingresos en dólares: cargalo en tu próxima carga.'
            : 'Falta el CCL para pasar a la otra moneda lo que declaraste.',
        }
      declarado = true
      alguno = true
      partes.push({ nombre: `${r.concepto} declarado (${monto(r.monto, r.moneda, { decimales: 2 })} por mes; ${como}; ${d.nota})`, ars: d.ars, usd: d.usd, etiquetas: ['declarado'] })
    }
  }
  if (!alguno)
    return {
      falta:
        sentido === 'ingreso'
          ? 'No cargaste ingresos en el período ni tenés ingresos declarados: cargalos con "Cargar ingreso" o declaralos en Flujo y escenarios.'
          : 'No cargaste gastos en el período ni tenés gastos fijos declarados: declaralos en Flujo y escenarios.',
    }
  return { partes, declarado }
}

function extraordinarios(h: Hechos, e: EntradasResultados, d0: Fecha, d1: Fecha, sentido: 'ingreso' | 'gasto'): Partida[] | { falta: string } {
  const partes: Partida[] = []
  for (const f of e.flujos) {
    if (f.anulado || f.sentido !== sentido || f.concepto !== 'extraordinario' || !(f.fecha > d0 && f.fecha <= d1)) continue
    const d = enDos(h, f.moneda, new Decimal(f.monto), f.fecha, f.pesos_recibidos === null ? null : new Decimal(f.pesos_recibidos))
    if (!d) return { falta: 'Falta el CCL para pasar a la otra moneda algo que cargaste.' }
    partes.push({ nombre: `${sentido === 'ingreso' ? 'Ingreso' : 'Gasto'} extraordinario del ${fechaCorta(f.fecha)}${f.notas ? ` · ${f.notas}` : ''} (${d.nota})`, ars: d.ars, usd: d.usd, origen: f.carga_id, etiquetas: [] })
  }
  return partes
}

/** Suma de una parte de las cuotas devengadas en el período. */
function parteLeasing(devengadas: readonly AperturaCuota[], sel: (a: AperturaCuota) => DobleCalc, m: Moneda, nombre: string, explicacion: string, etiquetasExtra: Etiqueta[] = []): Calc {
  const k = kDe(m)
  const partes = devengadas.map((a) => ({ nombre: `Cuota ${a.nro} (vence el ${fechaCorta(a.fecha_vencimiento)})`, calc: sel(a)[k] }))
  const s = sumaCalc(partes, m, explicacion)
  if (!partes.length) return calc(CERO, `ninguna cuota vence en el período = ${monto(CERO, m)}`, [], { explicacion })
  return etiquetasExtra.length ? { ...s, etiquetas: unicas([...s.etiquetas, ...etiquetasExtra]), formula: s.formula.replace(/^/, `${nombre}: `) } : { ...s, formula: `${nombre}: ${s.formula}` }
}

/** El resultado de las partidas de una clase (bienes o deudas) en el período, con su traza. */
function resultadoDeClase(v: Variacion, clase: 'bien' | 'pasivo', m: Moneda, explicacion: string): Calc {
  const k = kDe(m)
  const cs = v.contribuciones.filter((c) => c.clase === clase)
  const faltan = v.faltantes.filter((f) => f.clave.startsWith(clase === 'bien' ? 'b:' : 'd:'))
  const total = cs.reduce((a, c) => a.plus(c.resultado[k]), CERO)
  const insumos = cs.map((c) => deCalc(c.nombre, detalleContribucion(c, 'resultado', m, v), m))
  if (faltan.length) return sinDato(`No se puede calcular: ${motivoFaltantes(faltan)}. Suma parcial: ${fm(total, m)}.`, insumos, { etiquetas: ['parcial'], explicacion })
  const nada = clase === 'bien' ? 'ningún bien' : 'ninguna deuda'
  return calc(total, cs.length ? `${cs.map((c) => `${c.nombre} ${fm(c.resultado[k], m)}`).join(' + ')} = ${fm(total, m)}` : `${nada} = ${monto(CERO, m)}`, insumos, { explicacion })
}

/**
 * Estado de resultados del período (D-138, el "profit and loss" que pidió el
 * dueño), en la vista Total:
 *   ingresos (mensual y extraordinario aparte) − gastos fijos − gastos que
 *   cargaste − costo del leasing devengado = ahorro;
 *   + resultado de inversiones + revaluación de bienes + licuación de la deuda
 *   = variación explicada; contra la variación real, la diferencia es "no
 *   explicado" (consumo que no cargaste, plata que quedó afuera…), rotulada
 *   como diferencia, nunca como cuadre.
 * Con una sola carga (un_dia), el período es el mes en curso: lo de flujo se ve
 * y lo patrimonial es "sin dato · necesita una segunda carga".
 */
export function estadoResultados(h: Hechos, e: EntradasResultados, d0: Fecha, d1: Fecha, hoy: Fecha, opciones: { un_dia?: boolean; ix?: Indices } = {}): EstadoResultados {
  const unDia = Boolean(opciones.un_dia) || d1 <= d0
  // Con un solo día, el período del flujo es el mes en curso (el de hoy).
  const [desde, hasta] = unDia ? [sumarDias(mesDe(hoy), -1), finDeMes(mesDe(hoy))] : [d0, d1]
  const tramos = tramosMensuales(desde, hasta)
  const lineas: LineaResultado[] = []

  const ingM = mensuales(h, e, tramos, 'ingreso')
  const lIngM = lineaDeFlujos(
    'ingresos_mensuales',
    'Ingresos mensuales',
    '+',
    'falta' in ingM ? ingM : ingM.partes,
    'Lo que cobraste como ingreso mensual (cargado con "Cargar ingreso"). Un mes sin ingresos cargados usa lo que declaraste en Flujo, prorrateado por los días del período, con el chip "declarado".',
    null,
    !('falta' in ingM) && ingM.declarado ? 'declarado' : null,
  )
  const ingE = extraordinarios(h, e, desde, hasta, 'ingreso')
  const lIngE = lineaDeFlujos('ingresos_extra', 'Ingresos extraordinarios', '+', ingE, 'Lo que cargaste como ingreso extraordinario. No cambia la proyección de tus ingresos mensuales.', { nota: 'ninguno cargado' })
  const gasM = mensuales(h, e, tramos, 'gasto')
  const lGasM = lineaDeFlujos(
    'gastos_fijos',
    'Gastos fijos',
    '−',
    'falta' in gasM ? gasM : gasM.partes,
    'Tus gastos fijos: lo que declaraste en Flujo (no son gastos reales: el chip "declarado" lo recuerda), prorrateado por los días del período. Un mes con el gasto fijo cargado usa lo cargado.',
    null,
    !('falta' in gasM) && gasM.declarado ? 'declarado' : null,
  )
  const gasE = extraordinarios(h, e, desde, hasta, 'gasto')
  const lGasE = lineaDeFlujos('gastos_extra', 'Gastos extraordinarios', '−', gasE, 'Lo que cargaste con "Cargar gasto" como extraordinario.', { nota: 'ninguno cargado' })
  lineas.push(lIngM, lIngE, lGasM, lGasE)

  // Costo del leasing devengado (las cuotas que vencen en el período).
  const hayLeasing = h.pasivos.some((p) => p.tipo === 'leasing')
  let lLeasing: LineaResultado | null = null
  if (hayLeasing) {
    const devengadas = e.leasing.filter((a) => a.fecha_vencimiento > desde && a.fecha_vencimiento <= hasta)
    const sinCuadro = e.leasing.length === 0 && e.leasing_vacio !== 'empresa'
    // Un mes del período sin su cuota en un cuadro incompleto: no se sabe cuánto cuesta (no es $ 0).
    const ultimoDia = (mes: Fecha): Fecha => new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).toISOString().slice(0, 10)
    const faltaCuota = (e.sin_cuota ?? []).find((x) => x.meses.some((mes) => ultimoDia(mes) > desde && mes <= hasta)) ?? null
    const motivoCuadro = 'Falta el cuadro de marcha del leasing: importalo en Datos › Leasing y cada cuota se abre en amortización, interés, IVA, seguro y percepción.'
    const reintegra = e.reintegra_iva ?? null
    const sub = (clave: ClaveResultado, nombre: string, sel: (a: AperturaCuota) => DobleCalc, explicacion: string, rotulo: string | null, etiquetas: Etiqueta[] = []): LineaResultado => {
      if (sinCuadro || faltaCuota) {
        const n = sinDato<Decimal>(sinCuadro ? motivoCuadro : (faltaCuota as { motivo: string }).motivo, [], { explicacion })
        return { clave, nombre, ars: n, usd: n, signo: 'detalle', rotulo, nota: null }
      }
      return {
        clave,
        nombre,
        ars: parteLeasing(devengadas, sel, 'ARS', nombre, explicacion, etiquetas),
        usd: parteLeasing(devengadas, sel, 'USD', nombre, explicacion, etiquetas),
        signo: 'detalle',
        rotulo,
        nota: devengadas.length === 0 ? 'ninguna cuota vence en el período' : null,
      }
    }
    const credito = reintegra === true ? 'te lo reintegra la empresa' : 'crédito fiscal de la sociedad'
    const explIva =
      reintegra === true
        ? 'Lo factura la leasera y la empresa te lo reintegra (lo declaraste): no es gasto tuyo y no se suma.'
        : reintegra === false
          ? 'Crédito fiscal de la sociedad que toma el leasing: no te lo reintegran (lo declaraste), así que es gasto tuyo.'
          : 'Crédito fiscal de la sociedad que toma el leasing: es gasto tuyo mientras no te lo reintegre. Todavía no declaraste si te lo reintegra (chip "a confirmar").'
    const etIva: Etiqueta[] = reintegra === null ? ['a_confirmar'] : []
    const interes = sub('leasing_interes', 'Interés implícito', (a) => a.interes, 'La parte del canon que no baja la deuda, a la tasa implícita del contrato. Es un estimado (D-152).', 'estimado')
    const iva = sub('leasing_iva', 'IVA de la cuota', (a) => a.iva, explIva, credito, etIva)
    const seguro = sub('leasing_seguro', 'Seguro', (a) => a.seguro, 'El seguro de la camioneta que se paga con la cuota.', null)
    const percepcion = sub('leasing_percepcion', 'Percepción de IVA (RG 3337)', (a) => a.percepcion, explIva, credito, etIva)
    const cargos = sub('leasing_cargos', 'Cargos extra', (a) => a.cargos, 'Multas, comisiones, reservas o intereses que la leasera sumó a la cuota.', null)
    const partes = [interes, seguro, cargos, ...(reintegra === true ? [] : [iva, percepcion])].map((l) => ({ l, signo: 1 as const }))
    lLeasing = {
      ...combinar(
        'leasing',
        'Costo del leasing devengado',
        partes,
        'Lo que te cuestan las cuotas que vencen en el período, sin la amortización (que baja la deuda y no es gasto): interés implícito, IVA, seguro, percepción y cargos (D-152).',
      ),
      signo: '−',
      nota: e.leasing_vacio === 'empresa' && e.leasing.length === 0 ? 'la cuota la paga la empresa' : !sinCuadro && !faltaCuota && devengadas.length === 0 ? 'ninguna cuota vence en el período' : null,
    }
    lineas.push(lLeasing, interes, iva, seguro, percepcion, cargos)
  }

  const ahorro = combinar(
    'ahorro',
    'Ahorro del período',
    [
      { l: lIngM, signo: 1 },
      { l: lIngE, signo: 1 },
      { l: lGasM, signo: -1 },
      { l: lGasE, signo: -1 },
      ...(lLeasing ? [{ l: lLeasing, signo: -1 as const }] : []),
    ],
    'Ingresos − gastos − costo del leasing: lo que te quedó del período para ahorrar o invertir.',
  )
  lineas.push(ahorro)

  // Lo patrimonial: inversiones, bienes y deuda, contra la variación real.
  const patr = (clave: ClaveResultado, nombre: string, signo: LineaResultado['signo'], d: DobleCalc, rotulo: string | null = null): LineaResultado => ({ clave, nombre, ars: d.ars, usd: d.usd, signo, rotulo, nota: null })
  if (unDia) {
    const n = sinSegunda()
    lineas.push(
      patr('inversiones', 'Resultado de inversiones', '+', n),
      patr('revaluacion', 'Revaluación de bienes', '+', n),
      patr('licuacion', 'Licuación de la deuda', '+', n),
      patr('explicada', 'Variación del patrimonio explicada', '=', n),
      patr('real', 'Variación real del patrimonio', '=', n),
    )
    lineas.push(patr('no_explicado', 'No explicado', '=', n))
    return { desde, hasta, un_dia: true, lineas, no_explicado: n }
  }
  const cc = cuotasEnCuentas(h, e.cuotas)
  const H = cc.hechos
  const { v } = rotular(variacion(H, d0, d1, { hoy }), cc)
  const inversiones = doble((m) => parteCalc(v, H, 'financiero', 'resultado', m))
  const filas = resultadosPorPartida(h, d0, d1, hoy, { vista: 'financiero', cuotas: e.cuotas, ix: opciones.ix })
  const posiciones = filas.filter((f) => f.clase === 'posicion')
  const liquidez = filas.filter((f) => f.clase === 'saldo')
  const realizado = totalColumna(posiciones, (f) => f.realizado, 'Lo realizado de tus títulos en el período: ventas, vencimientos y rentas menos el costo de lo vendido (D-135).')
  const noRealizado = totalColumna(posiciones, (f) => f.no_realizado, 'Lo no realizado de tus títulos en el período (D-135).')
  const liq = totalColumna(liquidez, (f) => f.resultado, 'El resultado de tu liquidez: rendimiento y tipo de cambio (no tiene costo).')
  const revaluacion = doble((m) =>
    resultadoDeClase(v, 'bien', m, 'Lo que cambió el valor de tus bienes por una valuación nueva o por el dólar (sin las altas). La app no estima valores de bienes (D-04).'),
  )
  const ix = opciones.ix ?? indexar(h)
  const f0 = foto(h, d0, { hoy, ix })
  const f1 = foto(h, d1, { hoy, ix })
  const ed = firmeza(deudasDe([f0, f1]))
  const licuacion = doble((m) => {
    const x = resultadoDeClase(v, 'pasivo', m, 'Lo que cambia tu deuda en pesos por el dólar: si el CCL sube, en dólares debés menos (se licúa). En pesos es 0: la deuda está en pesos.')
    return ed.length && deudaPesa(v, 'resultado', kDe(m)) ? conEtiquetas(x, ed) : x
  })
  const lInv = patr('inversiones', 'Resultado de inversiones', '+', inversiones)
  lineas.push(
    lInv,
    patr('inv_realizado', 'realizado (ventas, vencimientos y rentas)', 'detalle', realizado),
    patr('inv_no_realizado', 'no realizado (lo que seguís teniendo)', 'detalle', noRealizado),
    patr('inv_liquidez', 'liquidez (rendimiento y tipo de cambio)', 'detalle', liq),
    patr('inv_activo', 'por el precio de tus activos', 'detalle', doble((m) => parteCalc(v, H, 'financiero', 'activo', m))),
    patr('inv_tc', 'por el tipo de cambio', 'detalle', doble((m) => parteCalc(v, H, 'financiero', 'tc', m))),
  )
  const lRev = patr('revaluacion', 'Revaluación de bienes', '+', revaluacion)
  const lLic = patr('licuacion', 'Licuación de la deuda', '+', licuacion)
  lineas.push(lRev, lLic)
  const explicada = combinar(
    'explicada',
    'Variación del patrimonio explicada',
    [
      { l: ahorro, signo: 1 },
      { l: lInv, signo: 1 },
      { l: lRev, signo: 1 },
      { l: lLic, signo: 1 },
    ],
    'Ahorro + resultado de inversiones + revaluación de bienes + licuación de la deuda.',
  )
  const p0 = patrimonio(h, f0, 'total')
  const p1 = patrimonio(h, f1, 'total')
  const real = doble((m) => {
    const k = kDe(m)
    const a = p0[k]
    const b = p1[k]
    const explicacion = 'Tu patrimonio total al final menos al inicio (financiero + bienes − deudas).'
    if (a.valor === null || b.valor === null)
      return sinDato(a.valor === null ? (a.motivo ?? 'Falta el patrimonio al inicio.') : (b.motivo ?? 'Falta el patrimonio al final.'), [deCalc('Al final', b, m), deCalc('Al inicio', a, m)], {
        etiquetas: unicas([...a.etiquetas, ...b.etiquetas]),
        explicacion,
      })
    const d = b.valor.minus(a.valor)
    return calc(d, `${monto(b.valor, m, { decimales: 2 })} − ${monto(a.valor, m, { decimales: 2 })} = ${fm(d, m)}`, [deCalc(`Patrimonio total del ${fechaCorta(d1)}`, b, m), deCalc(`Patrimonio total del ${fechaCorta(d0)}`, a, m)], { explicacion })
  })
  const lReal = patr('real', 'Variación real del patrimonio', '=', real)
  const noExplicado = combinar(
    'no_explicado',
    'No explicado',
    [
      { l: lReal, signo: 1 },
      { l: explicada, signo: -1 },
    ],
    'Variación real − variación explicada. Es una diferencia, no un cuadre: consumo que no cargaste, plata que entró o quedó afuera de tus cuentas, cuotas pagadas por otro, una deuda que todavía no se actualizó…',
  )
  lineas.push(explicada, lReal, noExplicado)
  return { desde, hasta, un_dia: false, lineas, no_explicado: { ars: noExplicado.ars, usd: noExplicado.usd } }
}
