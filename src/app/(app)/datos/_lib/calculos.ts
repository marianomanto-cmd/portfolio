// Cálculos de Datos: el ratio vigente de un CEDEAR, la última valuación de un
// bien y el último capital pendiente de un pasivo, en las dos monedas con su
// traza. Sin CCL, la otra moneda es "sin dato" (nunca cero ni estimado).

import { calc, sinDato, vista, type Calc, type CalcVista } from '@/lib/domain/calc'
import { Decimal, monto, numero } from '@/lib/domain/dinero'
import { fechaCorta, fechaLarga } from '@/lib/domain/fechas'
import type { Fecha, Moneda } from '@/lib/domain/tipos'

export interface Ratio {
  activo_id: number
  vigente_desde: Fecha
  ratio: string
}

/** Ratio vigente a una fecha: el último con vigente_desde ≤ fecha. */
export function ratioVigente(ratios: readonly Ratio[], activoId: number, fecha: Fecha): Ratio | null {
  return (
    ratios
      .filter((r) => r.activo_id === activoId && r.vigente_desde <= fecha)
      .sort((a, b) => (a.vigente_desde < b.vigente_desde ? -1 : 1))
      .at(-1) ?? null
  )
}

export interface Valuacion {
  bien_id: number
  fecha: Fecha
  valor: string
  fuente: string
  carga_id: number | null
}

export function ultimaValuacion(vs: readonly Valuacion[], bienId: number): Valuacion | null {
  return vs.filter((v) => v.bien_id === bienId).sort((a, b) => (a.fecha < b.fecha ? -1 : 1)).at(-1) ?? null
}

export interface CCL {
  fecha: Fecha
  valor: string
}

export interface ParVista {
  ars: CalcVista
  usd: CalcVista
}

/**
 * Un monto en su moneda y en la otra, convertido al CCL más reciente. La
 * moneda original es un hecho cargado; la otra es un cálculo con su traza.
 */
export function enDosMonedas(
  valor: string | null,
  moneda: Moneda,
  ccl: CCL | null,
  que: { nombre: string; fecha: Fecha | null; origen?: { carga_id: number; lugar?: string } },
): ParVista {
  if (valor === null) {
    const nada = sinDato(`Todavía no cargaste ${que.nombre}.`)
    return { ars: vista(nada), usd: vista(nada) }
  }
  const v = new Decimal(valor)
  const insumoValor = {
    nombre: `${que.nombre}${que.fecha ? ` (${fechaLarga(que.fecha)})` : ''}`,
    valor: v.toFixed(),
    unidad: moneda,
    origen: que.origen,
  } as const
  const original: Calc = calc(v, `${monto(v, moneda, { decimales: 2 })} = ${que.nombre} cargado${que.fecha ? ` el ${fechaCorta(que.fecha)}` : ''}`, [insumoValor], {
    explicacion: `Lo que cargaste como ${que.nombre}, en ${moneda === 'ARS' ? 'pesos' : 'dólares'}.`,
  })
  let otra: Calc
  if (ccl === null) {
    otra = sinDato(`Falta un CCL cargado para pasar ${moneda === 'ARS' ? 'a dólares' : 'a pesos'}.`, [insumoValor])
  } else {
    const c = new Decimal(ccl.valor)
    const insumoCcl = { nombre: `CCL del ${fechaLarga(ccl.fecha)}`, valor: c.toFixed(), unidad: 'ratio' as const }
    if (moneda === 'ARS') {
      const usd = v.div(c)
      otra = calc(usd, `${monto(v, 'ARS', { decimales: 2 })} ÷ CCL ${numero(c, 2)} = ${monto(usd, 'USD', { decimales: 2 })}`, [insumoValor, insumoCcl], {
        explicacion: 'Lo mismo en dólares, al último CCL que cargaste.',
      })
    } else {
      const ars = v.times(c)
      otra = calc(ars, `${monto(v, 'USD', { decimales: 2 })} × CCL ${numero(c, 2)} = ${monto(ars, 'ARS', { decimales: 2 })}`, [insumoValor, insumoCcl], {
        explicacion: 'Lo mismo en pesos, al último CCL que cargaste.',
      })
    }
  }
  return moneda === 'ARS' ? { ars: vista(original), usd: vista(otra) } : { ars: vista(otra), usd: vista(original) }
}

export interface SaldoPasivo {
  pasivo_id: number
  fecha: Fecha
  capital_pendiente: string
  carga_id: number | null
}

export function ultimoSaldoPasivo(ss: readonly SaldoPasivo[], pasivoId: number): SaldoPasivo | null {
  return ss.filter((s) => s.pasivo_id === pasivoId).sort((a, b) => (a.fecha < b.fecha ? -1 : 1)).at(-1) ?? null
}
