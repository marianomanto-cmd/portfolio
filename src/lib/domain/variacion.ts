// Variación entre dos cargas y su desglose activo / tipo de cambio (spec: "si
// subo 10% en pesos pero el CCL subió 12%, perdí plata en dólares"; D-35 de la
// investigación de mercado).
//
// Por partida (posición, saldo, bien o deuda), con V0 y V1 su valor en cada
// carga y F_i los flujos del intervalo (compras, ventas, cobros, aportes),
// cada uno convertido al CCL de su propia fecha (ccl_i):
//
//   Resultado ARS = V1 − V0 − ΣF_i            Resultado USD = V1/CCL1 − V0/CCL0 − ΣF_i/ccl_i
//
// Si la partida arriesga dólares (CEDEAR, dólares, bien en USD):
//   en pesos:   activo = Resultado USD × CCL1
//               TC     = V0_usd × (CCL1 − CCL0) + Σ F_usd_i × (CCL1 − ccl_i)
//   en dólares: todo es activo.
// Si arriesga pesos (LECAP, bono, pesos, deuda en pesos):
//   en dólares: activo = Resultado ARS ÷ CCL0
//               TC     = V1_ars × (1/CCL1 − 1/CCL0) + Σ F_ars_i × (1/CCL0 − 1/ccl_i)
//   en pesos:   todo es activo.
// Las dos partes suman exacto el resultado (se verifica en cada cálculo).
//
// Sin atribuir: una posición o un saldo sin dato nuevo en el intervalo (precio
// o saldo arrastrado) no tiene con qué separar activo de TC; su resultado
// entero va a "sin atribuir" hasta la próxima observación (D-35, D-64).

import { calc, deCalc, sinDato, type Calc, type Insumo } from './calc'
import { CERO, Decimal, monto, numero, porcentaje } from './dinero'
import { cclA, foto, indexar, type Foto, type Indices, type ItemFoto } from './foto'
import { costoAlta, ingresoBaja } from './posiciones'
import type { Fecha, Hechos, Moneda } from './tipos'

export interface Flujo {
  fecha: Fecha
  descripcion: string
  ars: Decimal
  usd: Decimal
  ccl: Decimal
  inferido: boolean
  carga_id: number
}

export interface Contribucion {
  clave: string
  nombre: string
  clase: ItemFoto['clase']
  moneda_riesgo: Moneda
  v0: { ars: Decimal; usd: Decimal } | null
  v1: { ars: Decimal; usd: Decimal } | null
  flujos: Flujo[]
  resultado: { ars: Decimal; usd: Decimal }
  activo: { ars: Decimal; usd: Decimal }
  tc: { ars: Decimal; usd: Decimal }
  sin_atribuir: { ars: Decimal; usd: Decimal }
  /** true si no hubo dato nuevo en el intervalo. */
  arrastrado: boolean
}

export interface Variacion {
  desde: Fecha
  hasta: Fecha
  ccl0: Calc
  ccl1: Calc
  /** Partidas que no se pudieron calcular (falta precio o CCL). */
  faltantes: { clave: string; nombre: string; motivo: string }[]
  contribuciones: Contribucion[]
}

const enRango = (f: Fecha, d0: Fecha, d1: Fecha) => f > d0 && f <= d1

function valores(i: ItemFoto | undefined): { ars: Decimal; usd: Decimal } | null | 'falta' {
  if (!i) return null
  if (i.valor_ars.valor === null || i.valor_usd.valor === null) return 'falta'
  return { ars: i.valor_ars.valor, usd: i.valor_usd.valor }
}

function cclEn(ix: Indices, fecha: Fecha): Decimal | null {
  return cclA(ix, fecha).calc.valor
}

/** Flujos de una posición en el intervalo. Positivo = entra valor a la partida. */
function flujosPosicion(h: Hechos, ix: Indices, i: ItemFoto, d0: Fecha, d1: Fecha, ccl1: Decimal): Flujo[] | 'falta' {
  const precio1 = i.precio.valor
  const out: Flujo[] = []
  for (const o of h.operaciones) {
    if (o.cuenta_id !== i.cuenta?.id || o.activo_id !== i.activo?.id || !enRango(o.fecha, d0, d1)) continue
    const cclOp = o.ccl_del_dia ?? cclEn(ix, o.fecha) ?? ccl1
    let ars: Decimal | null = null
    let inferido = false
    let cclFlujo = cclOp
    switch (o.tipo) {
      case 'apertura':
        // Una tenencia que aparece no es ganancia: entra a su valor del día.
        if (precio1 === null) return 'falta'
        ars = o.cantidad.times(precio1)
        cclFlujo = ccl1
        break
      case 'compra': {
        const c = costoAlta(o)
        if (c === null) {
          if (precio1 === null) return 'falta'
          ars = o.cantidad.times(precio1)
          inferido = true
        } else ars = o.moneda === 'USD' ? c.times(cclOp) : c
        break
      }
      case 'venta':
      case 'vencimiento': {
        const c = ingresoBaja(o)
        if (c === null) {
          if (precio1 === null) return 'falta'
          ars = o.cantidad.times(precio1).negated()
          inferido = true
        } else ars = (o.moneda === 'USD' ? c.times(cclOp) : c).negated()
        break
      }
      case 'renta':
      case 'amortizacion':
        if (o.importe === null) return 'falta'
        ars = (o.moneda === 'USD' ? o.importe.times(cclOp) : o.importe).negated()
        break
      case 'ajuste_ratio':
        continue
    }
    if (ars === null) continue
    out.push({
      fecha: o.fecha,
      descripcion: `${o.tipo} del ${o.fecha}`,
      ars,
      usd: ars.div(cclFlujo),
      ccl: cclFlujo,
      inferido,
      carga_id: o.carga_id,
    })
  }
  return out
}

/** Flujos de un saldo: movimientos de capital y efectos de caja de las operaciones. */
function flujosSaldo(h: Hechos, ix: Indices, i: ItemFoto, d0: Fecha, d1: Fecha, precios1: Map<number, Decimal | null>, ccl1: Decimal): Flujo[] {
  const cuenta = i.cuenta?.id
  const moneda = i.moneda_riesgo
  const out: Flujo[] = []
  const agregar = (fecha: Fecha, enMoneda: Decimal, descripcion: string, carga_id: number, inferido = false) => {
    const c = cclEn(ix, fecha) ?? ccl1
    const ars = moneda === 'ARS' ? enMoneda : enMoneda.times(c)
    const usd = moneda === 'USD' ? enMoneda : enMoneda.div(c)
    out.push({ fecha, descripcion, ars, usd, ccl: c, inferido, carga_id })
  }
  for (const m of h.movimientos) {
    const fDestino = m.fecha_acreditacion ?? m.fecha
    if (m.cuenta_destino_id === cuenta && m.moneda_destino === moneda && m.monto_destino && enRango(fDestino, d0, d1))
      agregar(fDestino, m.monto_destino, `${m.tipo} recibido`, m.carga_id)
    if (m.cuenta_origen_id === cuenta && m.moneda_origen === moneda && m.monto_origen && enRango(m.fecha, d0, d1))
      agregar(m.fecha, m.monto_origen.negated(), `${m.tipo} enviado`, m.carga_id)
  }
  for (const o of h.operaciones) {
    if (o.cuenta_id !== cuenta || o.moneda !== moneda || !enRango(o.fecha, d0, d1)) continue
    if (o.tipo === 'compra') {
      const c = costoAlta(o)
      const p = precios1.get(o.activo_id) ?? null
      if (c !== null) agregar(o.fecha, c.negated(), 'pago de una compra', o.carga_id)
      else if (p !== null) agregar(o.fecha, o.cantidad.times(p).negated(), 'pago de una compra (inferido)', o.carga_id, true)
    } else if (o.tipo === 'venta' || o.tipo === 'vencimiento') {
      const c = ingresoBaja(o)
      const p = precios1.get(o.activo_id) ?? null
      if (c !== null) agregar(o.fecha, c, `cobro de ${o.tipo}`, o.carga_id)
      else if (p !== null) agregar(o.fecha, o.cantidad.times(p), `cobro de ${o.tipo} (inferido)`, o.carga_id, true)
    } else if ((o.tipo === 'renta' || o.tipo === 'amortizacion') && o.importe) {
      agregar(o.fecha, o.importe, `cobro de ${o.tipo}`, o.carga_id)
    }
  }
  return out
}

function sumar(fs: Flujo[], k: 'ars' | 'usd'): Decimal {
  return fs.reduce((a, f) => a.plus(f[k]), CERO)
}

const TOLERANCIA = new Decimal('1e-18')

export function variacion(h: Hechos, d0: Fecha, d1: Fecha, opciones: { hoy?: Fecha } = {}): Variacion {
  const ix = indexar(h)
  const f0: Foto = foto(h, d0, { hoy: opciones.hoy ?? d1, ix })
  const f1: Foto = foto(h, d1, { hoy: opciones.hoy ?? d1, ix })
  const out: Variacion = { desde: d0, hasta: d1, ccl0: f0.ccl, ccl1: f1.ccl, faltantes: [], contribuciones: [] }
  const ccl0 = f0.ccl.valor
  const ccl1 = f1.ccl.valor
  const m0 = new Map(f0.items.map((i) => [i.clave, i]))
  const m1 = new Map(f1.items.map((i) => [i.clave, i]))
  const claves = [...new Set([...m0.keys(), ...m1.keys()])]
  const precios1 = new Map<number, Decimal | null>()
  for (const i of f1.items) if (i.activo) precios1.set(i.activo.id, i.precio.valor)

  for (const k of claves) {
    const i0 = m0.get(k)
    const i1 = m1.get(k)
    const ref = (i1 ?? i0) as ItemFoto
    if (ccl0 === null || ccl1 === null) {
      out.faltantes.push({ clave: k, nombre: ref.nombre, motivo: 'Falta el CCL de una de las dos cargas.' })
      continue
    }
    const v0 = valores(i0)
    const v1 = valores(i1)
    if (v0 === 'falta' || v1 === 'falta') {
      out.faltantes.push({
        clave: k,
        nombre: ref.nombre,
        motivo: (v0 === 'falta' ? i0?.valor_ars.motivo : i1?.valor_ars.motivo) ?? 'Falta un dato.',
      })
      continue
    }
    let flujos: Flujo[] | 'falta' = []
    if (ref.clase === 'posicion') flujos = flujosPosicion(h, ix, ref, d0, d1, ccl1)
    else if (ref.clase === 'saldo') flujos = flujosSaldo(h, ix, ref, d0, d1, precios1, ccl1)
    else if (ref.clase === 'pasivo' && v0 && v1) {
      // La baja de capital la paga alguien (vos o la empresa): es un flujo, no
      // un resultado. Lo que queda es la licuación en dólares.
      const d = v1.ars.minus(v0.ars)
      flujos = d.isZero() ? [] : [{ fecha: d1, descripcion: 'cambio del capital informado', ars: d, usd: d.div(ccl1), ccl: ccl1, inferido: false, carga_id: i1?.carga_dato ?? 0 }]
    }
    if (flujos === 'falta') {
      out.faltantes.push({ clave: k, nombre: ref.nombre, motivo: 'Falta el precio para valuar una operación del intervalo.' })
      continue
    }
    const V0a = v0?.ars ?? CERO
    const V0u = v0?.usd ?? CERO
    const V1a = v1?.ars ?? CERO
    const V1u = v1?.usd ?? CERO
    const Ra = V1a.minus(V0a).minus(sumar(flujos, 'ars'))
    const Ru = V1u.minus(V0u).minus(sumar(flujos, 'usd'))
    const arrastrado =
      (ref.clase === 'posicion' || ref.clase === 'saldo') &&
      i0 !== undefined &&
      i1 !== undefined &&
      i1.fecha_dato !== null &&
      i1.fecha_dato <= d0
    const cero = { ars: CERO, usd: CERO }
    let activo = cero
    let tc = cero
    let sin = cero
    if (arrastrado) {
      sin = { ars: Ra, usd: Ru }
    } else if (ref.moneda_riesgo === 'USD') {
      const tcArs = V0u.times(ccl1.minus(ccl0)).plus(flujos.reduce((a, f) => a.plus(f.usd.times(ccl1.minus(f.ccl))), CERO))
      activo = { ars: Ru.times(ccl1), usd: Ru }
      tc = { ars: tcArs, usd: CERO }
    } else {
      const tcUsd = V1a.times(new Decimal(1).div(ccl1).minus(new Decimal(1).div(ccl0))).plus(
        flujos.reduce((a, f) => a.plus(f.ars.times(new Decimal(1).div(ccl0).minus(new Decimal(1).div(f.ccl)))), CERO),
      )
      activo = { ars: Ra, usd: Ra.div(ccl0) }
      tc = { ars: CERO, usd: tcUsd }
    }
    // Invariante: activo + TC + sin atribuir = resultado, exacto (a precisión de Decimal).
    if (
      activo.ars.plus(tc.ars).plus(sin.ars).minus(Ra).abs().gt(TOLERANCIA) ||
      activo.usd.plus(tc.usd).plus(sin.usd).minus(Ru).abs().gt(TOLERANCIA)
    ) {
      throw new Error(`Desglose que no cierra en ${ref.nombre}: revisar el motor (D-35).`)
    }
    out.contribuciones.push({
      clave: k,
      nombre: ref.nombre,
      clase: ref.clase,
      moneda_riesgo: ref.moneda_riesgo,
      v0: v0 ?? null,
      v1: v1 ?? null,
      flujos,
      resultado: { ars: Ra, usd: Ru },
      activo,
      tc,
      sin_atribuir: sin,
      arrastrado,
    })
  }
  return out
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

type Parte = 'resultado' | 'activo' | 'tc' | 'sin_atribuir'

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
    ARS: 'Cambio de partidas sin precio o saldo nuevo: no hay con qué separar activo de tipo de cambio hasta la próxima carga.',
    USD: 'Cambio de partidas sin precio o saldo nuevo: no hay con qué separar activo de tipo de cambio hasta la próxima carga.',
  },
}

/** Suma de una parte en una vista, con traza por partida (D-65: si falta una, "sin dato"). */
export function parteCalc(v: Variacion, h: Hechos, vista: Vista, parte: Parte, moneda: Moneda): Calc {
  const k = moneda === 'ARS' ? 'ars' : 'usd'
  const cs = v.contribuciones.filter((c) => enVista(c, vista))
  const faltan = faltantesEnVista(v, h, vista)
  const insumos: Insumo[] = cs
    .filter((c) => !c[parte][k].isZero())
    .map((c) => ({
      nombre: c.nombre,
      valor: c[parte][k].toFixed(),
      unidad: moneda,
      calc: detalleContribucion(c, parte, moneda, v),
    }))
  const total = cs.reduce((a, c) => a.plus(c[parte][k]), CERO)
  const explicacion = EXPLICACION[parte][moneda]
  if (faltan.length) {
    return sinDato(
      `No se puede calcular: ${faltan.map((f) => `${f.nombre} (${f.motivo})`).join('; ')}. Suma parcial: ${monto(total, moneda, { decimales: 2, signo: true })}.`,
      insumos,
      { etiquetas: ['parcial'], explicacion },
    )
  }
  const formula = insumos.length
    ? `${insumos.map((i) => `${i.nombre} ${monto(i.valor as string, moneda, { decimales: 2, signo: true })}`).join(' + ')} = ${monto(total, moneda, { decimales: 2, signo: true })}`
    : `${NOMBRE_PARTE[parte]}: nada = ${monto(CERO, moneda)}`
  return calc(total, formula, insumos, { explicacion })
}

function detalleContribucion(c: Contribucion, parte: Parte, moneda: Moneda, v: Variacion): Calc {
  const k = moneda === 'ARS' ? 'ars' : 'usd'
  const ccl0 = v.ccl0.valor as Decimal
  const ccl1 = v.ccl1.valor as Decimal
  const fm = (d: Decimal, m: Moneda = moneda) => monto(d, m, { decimales: 2, signo: true })
  const V0 = c.v0 ?? { ars: CERO, usd: CERO }
  const V1 = c.v1 ?? { ars: CERO, usd: CERO }
  const insumos: Insumo[] = [
    { nombre: `Valor el ${v.desde}`, valor: V0[k].toFixed(), unidad: moneda },
    { nombre: `Valor el ${v.hasta}`, valor: V1[k].toFixed(), unidad: moneda },
    deCalc(`CCL del ${v.desde}`, v.ccl0, 'ratio'),
    deCalc(`CCL del ${v.hasta}`, v.ccl1, 'ratio'),
    ...c.flujos.map((f) => ({
      nombre: `Flujo: ${f.descripcion}${f.inferido ? ' (inferido)' : ''}`,
      valor: f[k].toFixed(),
      unidad: moneda,
      origen: { carga_id: f.carga_id },
    })),
  ]
  const F = c.flujos.reduce((a, f) => a.plus(f[k]), CERO)
  let formula: string
  if (parte === 'resultado' || parte === 'sin_atribuir') {
    formula = `${monto(V1[k], moneda, { decimales: 2 })} − ${monto(V0[k], moneda, { decimales: 2 })}${F.isZero() ? '' : ` − flujos ${fm(F)}`} = ${fm(c[parte][k])}`
  } else if (parte === 'tc' && c.moneda_riesgo === 'USD' && moneda === 'ARS') {
    formula = `${monto(V0.usd, 'USD', { decimales: 2 })} × (${numero(ccl1, 2)} − ${numero(ccl0, 2)})${c.flujos.length ? ' + flujos revaluados' : ''} = ${fm(c.tc.ars)}`
  } else if (parte === 'tc' && c.moneda_riesgo === 'ARS' && moneda === 'USD') {
    formula = `${monto(V1.ars, 'ARS', { decimales: 2 })} × (1/${numero(ccl1, 2)} − 1/${numero(ccl0, 2)})${c.flujos.length ? ' + flujos' : ''} = ${fm(c.tc.usd)}`
  } else if (parte === 'activo' && c.moneda_riesgo === 'USD' && moneda === 'ARS') {
    formula = `resultado en dólares ${fm(c.resultado.usd, 'USD')} × CCL ${numero(ccl1, 2)} = ${fm(c.activo.ars)}`
  } else if (parte === 'activo' && c.moneda_riesgo === 'ARS' && moneda === 'USD') {
    formula = `resultado en pesos ${fm(c.resultado.ars, 'ARS')} ÷ CCL ${numero(ccl0, 2)} = ${fm(c.activo.usd)}`
  } else {
    formula = `todo el resultado de la partida = ${fm(c[parte][k])}`
  }
  return calc(c[parte][k], formula, insumos, { explicacion: EXPLICACION[parte][moneda] })
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
