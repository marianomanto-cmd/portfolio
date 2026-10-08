// Tenencias derivadas de las operaciones (spec: "las posiciones no son una
// tabla"; D-22, D-23). PPC por promedio ponderado, en pesos y en dólares.
//
// Costo de cada alta:
//   apertura → cantidad × PPP del bróker (+ comisiones). Sin PPP: "sin dato".
//              En USD: costo ÷ CCL de compra si lo declaraste; si no, "sin dato" (D-14).
//   compra   → importe liquidado si se conoce; si no, cantidad × precio + comisiones.
//              Sin precio: pendiente (D-19). En USD: costo ÷ CCL del día de la compra.
// Una venta o un vencimiento sacan costo en proporción a la cantidad. Un
// ajuste de ratio cambia la cantidad sin tocar el costo. Una amortización
// devuelve capital: baja el costo en lo cobrado, sin pasar de cero (B16). Una
// renta (cupón o dividendo) no toca el costo: es un ingreso que pasa del título
// a la liquidez y se ve en la frase del día en que se cobra; el resultado de
// Cartera es el del título, sin los cupones cobrados (decisión de la fase 1a).
//
// Etiquetas por moneda (B17): "declarado" (CCL de compra de una apertura) solo
// toca el costo y el PPC en dólares; "pendiente" (D-19) toca las dos.

import { calc, sinDato, type Calc, type Etiqueta, type Insumo } from './calc'
import { CERO, Decimal, monto, numero } from './dinero'
import { fechaCorta } from './fechas'
import type { Fecha, Operacion } from './tipos'

export interface Tenencia {
  cuenta_id: number
  activo_id: number
  cantidad: Decimal
  /** Costo total de la cantidad actual. null = sin dato (motivo en motivo_ars). */
  costo_ars: Decimal | null
  costo_usd: Decimal | null
  motivo_ars: string | null
  motivo_usd: string | null
  /** Unión de las etiquetas de las dos monedas. */
  etiquetas: Etiqueta[]
  etiquetas_ars: Etiqueta[]
  etiquetas_usd: Etiqueta[]
  /** Primera alta de la tenencia vigente (fecha real si la apertura la tiene). */
  fecha_inicio: Fecha | null
  /** true si fecha_inicio es la de la apertura en la app y no la de compra. */
  desde_apertura: boolean
  /** true si fecha_inicio es la fecha de compra que declaraste en la apertura. */
  fecha_declarada: boolean
  /** Alguna apertura de la tenencia no tiene CCL de compra (se puede declarar, B13). */
  apertura_sin_ccl: boolean
  /** Operaciones que componen la tenencia vigente (para la traza). */
  operaciones: Operacion[]
}

const clave = (o: { cuenta_id: number; activo_id: number }) => `${o.cuenta_id}:${o.activo_id}`

function ordenar(ops: readonly Operacion[]): Operacion[] {
  return [...ops].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.id - b.id))
}

/** Costo de un alta en la moneda de la operación, o null si no se conoce. */
export function costoAlta(o: Operacion): Decimal | null {
  if (o.importe !== null && (o.tipo === 'compra' || o.tipo === 'apertura')) return o.importe
  if (o.precio === null) return null
  return o.cantidad.times(o.precio).plus(o.comisiones)
}

/** Lo que entró por una baja (venta/vencimiento) en la moneda de la operación. */
export function ingresoBaja(o: Operacion): Decimal | null {
  if (o.importe !== null) return o.importe
  if (o.precio === null) return null
  return o.cantidad.times(o.precio).minus(o.comisiones)
}

/** Costo de un alta en ARS y en USD. */
function costosAlta(o: Operacion): { ars: Decimal | null; usd: Decimal | null; motivoArs: string | null; motivoUsd: string | null; etArs: Etiqueta[]; etUsd: Etiqueta[] } {
  const base = costoAlta(o)
  if (base === null) {
    const motivo =
      o.tipo === 'apertura'
        ? 'La apertura no tiene PPP del bróker.'
        : 'Compra con precio pendiente: el bróker todavía no informó el PPP.'
    const et: Etiqueta[] = o.tipo === 'compra' ? ['pendiente'] : []
    return { ars: null, usd: null, motivoArs: motivo, motivoUsd: motivo, etArs: et, etUsd: et }
  }
  if (o.moneda === 'USD') {
    const ars = o.ccl_del_dia ? base.times(o.ccl_del_dia) : null
    return {
      ars,
      usd: base,
      motivoArs: ars ? null : 'Operación en dólares sin CCL del día.',
      motivoUsd: null,
      etArs: ars && o.tipo === 'apertura' ? ['declarado'] : [],
      etUsd: [],
    }
  }
  if (o.ccl_del_dia === null) {
    return {
      ars: base,
      usd: null,
      motivoArs: null,
      motivoUsd:
        o.tipo === 'apertura'
          ? 'Falta el CCL de compra de la apertura: declaralo para ver el PPC y el resultado en dólares.'
          : 'Falta el CCL del día de la operación.',
      etArs: [],
      etUsd: [],
    }
  }
  return { ars: base, usd: base.div(o.ccl_del_dia), motivoArs: null, motivoUsd: null, etArs: [], etUsd: o.tipo === 'apertura' ? ['declarado'] : [] }
}

/**
 * Tenencias al cierre de `hasta` (inclusive). Si `hasta` es null, todas las
 * operaciones. Devuelve solo las tenencias con cantidad distinta de cero.
 */
export function tenencias(ops: readonly Operacion[], hasta: Fecha | null = null): Map<string, Tenencia> {
  const out = new Map<string, Tenencia>()
  for (const o of ordenar(ops)) {
    if (hasta !== null && o.fecha > hasta) continue
    const k = clave(o)
    let t = out.get(k)
    if (!t) {
      t = {
        cuenta_id: o.cuenta_id,
        activo_id: o.activo_id,
        cantidad: CERO,
        costo_ars: CERO,
        costo_usd: CERO,
        motivo_ars: null,
        motivo_usd: null,
        etiquetas: [],
        etiquetas_ars: [],
        etiquetas_usd: [],
        fecha_inicio: null,
        desde_apertura: false,
        fecha_declarada: false,
        apertura_sin_ccl: false,
        operaciones: [],
      }
      out.set(k, t)
    }
    switch (o.tipo) {
      case 'apertura':
      case 'compra': {
        const c = costosAlta(o)
        if (t.cantidad.isZero()) {
          t.fecha_inicio = o.tipo === 'apertura' && o.fecha_origen ? o.fecha_origen : o.fecha
          t.desde_apertura = o.tipo === 'apertura' && !o.fecha_origen
          t.fecha_declarada = o.tipo === 'apertura' && !!o.fecha_origen
        }
        if (o.tipo === 'apertura' && o.ccl_del_dia === null && o.moneda === 'ARS') t.apertura_sin_ccl = true
        t.cantidad = t.cantidad.plus(o.cantidad)
        t.costo_ars = t.costo_ars === null || c.ars === null ? null : t.costo_ars.plus(c.ars)
        t.costo_usd = t.costo_usd === null || c.usd === null ? null : t.costo_usd.plus(c.usd)
        if (c.ars === null) t.motivo_ars ??= c.motivoArs
        if (c.usd === null) t.motivo_usd ??= c.motivoUsd
        t.etiquetas_ars = [...new Set([...t.etiquetas_ars, ...c.etArs])]
        t.etiquetas_usd = [...new Set([...t.etiquetas_usd, ...c.etUsd])]
        t.etiquetas = [...new Set([...t.etiquetas_ars, ...t.etiquetas_usd])]
        t.operaciones.push(o)
        break
      }
      case 'venta':
      case 'vencimiento': {
        if (t.cantidad.isZero()) break
        const factor = Decimal.min(o.cantidad.div(t.cantidad), 1)
        if (t.costo_ars !== null) t.costo_ars = t.costo_ars.minus(t.costo_ars.times(factor))
        if (t.costo_usd !== null) t.costo_usd = t.costo_usd.minus(t.costo_usd.times(factor))
        t.cantidad = t.cantidad.minus(o.cantidad)
        t.operaciones.push(o)
        break
      }
      case 'ajuste_ratio':
        t.cantidad = t.cantidad.plus(o.cantidad)
        t.operaciones.push(o)
        break
      case 'amortizacion': {
        // Devuelve capital: baja el costo en lo cobrado, sin pasar de cero (B16).
        if (o.importe !== null) {
          const ars = o.moneda === 'USD' ? (o.ccl_del_dia ? o.importe.times(o.ccl_del_dia) : null) : o.importe
          const usd = o.moneda === 'USD' ? o.importe : o.ccl_del_dia ? o.importe.div(o.ccl_del_dia) : null
          if (t.costo_ars !== null) t.costo_ars = ars === null ? null : Decimal.max(t.costo_ars.minus(ars), 0)
          if (t.costo_usd !== null) t.costo_usd = usd === null ? null : Decimal.max(t.costo_usd.minus(usd), 0)
          if (ars === null) t.motivo_ars ??= 'Amortización en dólares sin CCL del día.'
          if (usd === null) t.motivo_usd ??= 'Amortización sin CCL del día.'
        }
        t.operaciones.push(o)
        break
      }
      case 'renta':
        t.operaciones.push(o)
        break
    }
    if (t.cantidad.isZero() || t.cantidad.isNegative()) {
      // Tenencia cerrada: lo próximo que entre arranca de cero.
      t.cantidad = CERO
      t.costo_ars = CERO
      t.costo_usd = CERO
      t.motivo_ars = null
      t.motivo_usd = null
      t.etiquetas = []
      t.etiquetas_ars = []
      t.etiquetas_usd = []
      t.fecha_inicio = null
      t.desde_apertura = false
      t.fecha_declarada = false
      t.apertura_sin_ccl = false
      t.operaciones = []
    }
  }
  for (const [k, t] of out) if (t.cantidad.isZero()) out.delete(k)
  return out
}

export function tenenciaClave(cuenta_id: number, activo_id: number): string {
  return `${cuenta_id}:${activo_id}`
}

function insumosOperaciones(t: Tenencia): Insumo[] {
  return t.operaciones.map((o) => ({
    nombre: `${o.tipo} del ${fechaCorta(o.fecha)}`,
    valor: o.cantidad.toFixed(),
    unidad: 'cantidad' as const,
    origen: { carga_id: o.carga_id },
  }))
}

/** Cantidad con su traza. */
export function cantidadCalc(t: Tenencia): Calc {
  const partes = t.operaciones.map((o) => {
    const signo = o.tipo === 'venta' || o.tipo === 'vencimiento' ? '−' : '+'
    return `${signo} ${numero(o.cantidad, 4, { min: 0 })} (${o.tipo} ${fechaCorta(o.fecha)})`
  })
  return calc(t.cantidad, `${partes.join(' ')} = ${numero(t.cantidad, 4, { min: 0 })}`, insumosOperaciones(t), {
    explicacion: 'Cuántos títulos tenés, sumando y restando tus operaciones registradas.',
  })
}

/** PPC por unidad en la moneda pedida. */
export function ppcCalc(t: Tenencia, moneda: 'ARS' | 'USD'): Calc {
  const costo = moneda === 'ARS' ? t.costo_ars : t.costo_usd
  const motivo = moneda === 'ARS' ? t.motivo_ars : t.motivo_usd
  const etiquetas = moneda === 'ARS' ? t.etiquetas_ars : t.etiquetas_usd
  if (costo === null) return sinDato(motivo ?? 'Falta el costo de una parte de la tenencia.', insumosOperaciones(t), { etiquetas })
  const ppc = costo.div(t.cantidad)
  return calc(
    ppc,
    `${monto(costo, moneda, { decimales: 2 })} ÷ ${numero(t.cantidad, 4, { min: 0 })} = ${monto(ppc, moneda, { decimales: 4 })}`,
    insumosOperaciones(t),
    {
      etiquetas,
      explicacion:
        moneda === 'ARS'
          ? 'Precio promedio que pagaste por cada título, en pesos (promedio ponderado).'
          : 'Precio promedio que pagaste por cada título, pasado a dólares al CCL del día de cada compra.',
    },
  )
}

/**
 * Costo total con su traza. La fórmula repite la cuenta de tenencias(): cada
 * alta suma, cada baja saca su proporción y cada amortización resta lo
 * cobrado (B26), para que lo de la izquierda dé lo de la derecha.
 */
export function costoCalc(t: Tenencia, moneda: 'ARS' | 'USD'): Calc {
  const costo = moneda === 'ARS' ? t.costo_ars : t.costo_usd
  const motivo = moneda === 'ARS' ? t.motivo_ars : t.motivo_usd
  const etiquetas = moneda === 'ARS' ? t.etiquetas_ars : t.etiquetas_usd
  if (costo === null) return sinDato(motivo ?? 'Falta el costo de una parte de la tenencia.', insumosOperaciones(t), { etiquetas })
  const fm = (d: Decimal) => monto(d, moneda, { decimales: 2 })
  let expr = ''
  let q = CERO
  for (const o of t.operaciones) {
    if (o.tipo === 'apertura' || o.tipo === 'compra') {
      const c = costoAlta(o)
      let termino: string
      if (c === null) termino = 'sin dato'
      else if (moneda === 'ARS') termino = fm(o.moneda === 'USD' && o.ccl_del_dia ? c.times(o.ccl_del_dia) : c)
      else if (o.moneda === 'USD') termino = fm(c)
      else termino = `${monto(c, 'ARS', { decimales: 2 })} ÷ ${numero(o.ccl_del_dia ?? CERO, 2)}`
      expr = expr ? `${expr} + ${termino}` : termino
      q = q.plus(o.cantidad)
    } else if ((o.tipo === 'venta' || o.tipo === 'vencimiento') && !q.isZero()) {
      expr = `(${expr}) × (1 − ${numero(o.cantidad, 4, { min: 0 })} ÷ ${numero(q, 4, { min: 0 })})`
      q = q.minus(o.cantidad)
    } else if (o.tipo === 'ajuste_ratio') {
      q = q.plus(o.cantidad)
    } else if (o.tipo === 'amortizacion' && o.importe !== null) {
      const cobrado = moneda === o.moneda ? o.importe : moneda === 'ARS' ? o.importe.times(o.ccl_del_dia ?? CERO) : o.importe.div(o.ccl_del_dia ?? 1)
      expr = `${expr} − ${fm(cobrado)} (amortización ${fechaCorta(o.fecha)})`
    }
  }
  return calc(costo, `${expr || fm(CERO)} = ${fm(costo)}`, insumosOperaciones(t), {
    etiquetas,
    explicacion: 'Lo que te costó la tenencia que tenés hoy: las ventas sacan costo en proporción y las amortizaciones restan lo cobrado.',
  })
}
