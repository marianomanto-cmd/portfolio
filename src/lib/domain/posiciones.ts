// Tenencias derivadas de las operaciones (spec: "las posiciones no son una
// tabla"; D-22, D-23). PPC por promedio ponderado, en pesos y en dólares.
//
// Costo de cada alta:
//   apertura → cantidad × PPP del bróker (+ comisiones). Sin PPP: "sin dato".
//              En USD: costo ÷ CCL de compra si lo declaraste; si no, "sin dato" (D-14).
//   compra   → importe liquidado si se conoce; si no, cantidad × precio + comisiones.
//              Sin precio: pendiente (D-19). En USD: costo ÷ CCL del día de la compra.
// Una venta o un vencimiento sacan costo en proporción a la cantidad. Un
// ajuste de ratio cambia la cantidad sin tocar el costo.

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
  etiquetas: Etiqueta[]
  /** Primera alta de la tenencia vigente (fecha real si la apertura la tiene). */
  fecha_inicio: Fecha | null
  /** true si fecha_inicio es la de la apertura en la app y no la de compra. */
  desde_apertura: boolean
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
function costosAlta(o: Operacion): { ars: Decimal | null; usd: Decimal | null; motivoArs: string | null; motivoUsd: string | null; etiquetas: Etiqueta[] } {
  const base = costoAlta(o)
  const etiquetas: Etiqueta[] = []
  if (base === null) {
    const motivo =
      o.tipo === 'apertura'
        ? 'La apertura no tiene PPP del bróker.'
        : 'Compra con precio pendiente: el bróker todavía no informó el PPP.'
    if (o.tipo === 'compra') etiquetas.push('pendiente')
    return { ars: null, usd: null, motivoArs: motivo, motivoUsd: motivo, etiquetas }
  }
  if (o.moneda === 'USD') {
    const ars = o.ccl_del_dia ? base.times(o.ccl_del_dia) : null
    return {
      ars,
      usd: base,
      motivoArs: ars ? null : 'Operación en dólares sin CCL del día.',
      motivoUsd: null,
      etiquetas,
    }
  }
  if (o.ccl_del_dia === null) {
    return {
      ars: base,
      usd: null,
      motivoArs: null,
      motivoUsd:
        o.tipo === 'apertura'
          ? 'Falta el CCL de compra de la apertura (podés declararlo).'
          : 'Falta el CCL del día de la operación.',
      etiquetas,
    }
  }
  if (o.tipo === 'apertura') etiquetas.push('declarado')
  return { ars: base, usd: base.div(o.ccl_del_dia), motivoArs: null, motivoUsd: null, etiquetas }
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
        fecha_inicio: null,
        desde_apertura: false,
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
        }
        t.cantidad = t.cantidad.plus(o.cantidad)
        t.costo_ars = t.costo_ars === null || c.ars === null ? null : t.costo_ars.plus(c.ars)
        t.costo_usd = t.costo_usd === null || c.usd === null ? null : t.costo_usd.plus(c.usd)
        if (c.ars === null) t.motivo_ars ??= c.motivoArs
        if (c.usd === null) t.motivo_usd ??= c.motivoUsd
        t.etiquetas = [...new Set([...t.etiquetas, ...c.etiquetas])]
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
      case 'renta':
      case 'amortizacion':
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
      t.fecha_inicio = null
      t.desde_apertura = false
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
  if (costo === null) return sinDato(motivo ?? 'Falta el costo de una parte de la tenencia.', insumosOperaciones(t), { etiquetas: t.etiquetas })
  const ppc = costo.div(t.cantidad)
  return calc(
    ppc,
    `${monto(costo, moneda, { decimales: 2 })} ÷ ${numero(t.cantidad, 4, { min: 0 })} = ${monto(ppc, moneda, { decimales: 4 })}`,
    insumosOperaciones(t),
    {
      etiquetas: t.etiquetas,
      explicacion:
        moneda === 'ARS'
          ? 'Precio promedio que pagaste por cada título, en pesos (promedio ponderado).'
          : 'Precio promedio que pagaste por cada título, pasado a dólares al CCL del día de cada compra.',
    },
  )
}

/** Costo total con su traza. */
export function costoCalc(t: Tenencia, moneda: 'ARS' | 'USD'): Calc {
  const costo = moneda === 'ARS' ? t.costo_ars : t.costo_usd
  const motivo = moneda === 'ARS' ? t.motivo_ars : t.motivo_usd
  if (costo === null) return sinDato(motivo ?? 'Falta el costo de una parte de la tenencia.', insumosOperaciones(t), { etiquetas: t.etiquetas })
  const partes = t.operaciones
    .filter((o) => o.tipo === 'apertura' || o.tipo === 'compra')
    .map((o) => {
      const c = costoAlta(o)
      if (c === null) return 'sin dato'
      if (moneda === 'ARS') return monto(o.moneda === 'USD' && o.ccl_del_dia ? c.times(o.ccl_del_dia) : c, 'ARS', { decimales: 2 })
      if (o.moneda === 'USD') return monto(c, 'USD', { decimales: 2 })
      return `${monto(c, 'ARS', { decimales: 2 })} ÷ ${numero(o.ccl_del_dia ?? CERO, 2)}`
    })
  return calc(costo, `${partes.join(' + ')} = ${monto(costo, moneda, { decimales: 2 })}`, insumosOperaciones(t), {
    etiquetas: t.etiquetas,
    explicacion: 'Lo que te costó la tenencia que tenés hoy (las ventas sacan costo en proporción).',
  })
}
