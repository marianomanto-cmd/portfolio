// "Cargar el pago al vencimiento" de una letra o un bono (plan §6 D.4, D.7):
// el pago por VN del aviso de licitación se guarda en flujos_bono como un solo
// pago (amortización del VN + lo que capitalizó), y la vista previa dice cuánto
// cobrarías por tu tenencia. Puro, con test.

import { calc, deCalc, sinDato, vista, type CalcVista } from '../calc'
import { Decimal, monto, numero } from '../dinero'
import { fechaCorta } from '../fechas'
import type { Fecha } from '../tipos'

/**
 * Un pago único al vencimiento por 1 VN, partido como lo guarda flujos_bono:
 * se devuelve el VN (amortización 1) y el resto es lo que capitalizó (interés).
 * Si el pago es menor que 1 VN (un bono que ya amortizó), todo es amortización.
 */
export function pagoUnico(pagoPorVn: string): { amortizacion: string; interes: string } {
  const p = new Decimal(pagoPorVn)
  if (!p.isFinite() || p.lte(0)) throw new Error('El pago por VN tiene que ser mayor que cero.')
  if (p.gte(1)) return { amortizacion: '1', interes: p.minus(1).toFixed() }
  return { amortizacion: p.toFixed(), interes: '0' }
}

/** "Cobrarías $X por tus N VN": la vista previa del pago, en pesos y en dólares (al CCL de tu última carga), con su traza. */
export function vistaPreviaPago(
  pagoPorVn: string | null,
  vn: string | null,
  ticker: string,
  fecha: Fecha | null,
  ccl: string | null,
): { ars: CalcVista; usd: CalcVista } {
  if (vn === null) {
    const c = vista(sinDato(`No se sabe cuántos VN de ${ticker} tenés en tu última carga.`))
    return { ars: c, usd: c }
  }
  if (pagoPorVn === null) {
    const c = vista(sinDato(`Falta el pago al vencimiento por VN de ${ticker}.`, [{ nombre: `VN de ${ticker}`, valor: vn, unidad: 'cantidad' }]))
    return { ars: c, usd: c }
  }
  const p = new Decimal(pagoPorVn)
  const n = new Decimal(vn)
  const total = p.times(n)
  const ars = calc(total, `${numero(n, 0)} VN × $ ${numero(p, 6, { min: 2 })} = ${monto(total, 'ARS', { decimales: 2 })}`, [
    { nombre: `VN de ${ticker} en tu última carga`, valor: n.toFixed(), unidad: 'cantidad' },
    { nombre: `Pago por VN${fecha ? ` el ${fechaCorta(fecha)}` : ''}`, valor: p.toFixed(), unidad: 'ARS' },
  ], { explicacion: 'Lo que cobrarías al vencimiento si mantenés la tenencia de hoy. Sale del pago que cargás, no de un supuesto.' })
  if (ccl === null) return { ars: vista(ars), usd: vista(sinDato('Falta el CCL de tu última carga.', [deCalc('En pesos', ars, 'ARS')])) }
  const t = new Decimal(ccl)
  const usd = total.div(t)
  return {
    ars: vista(ars),
    usd: vista(
      calc(usd, `${monto(total, 'ARS', { decimales: 2 })} ÷ ${numero(t, 2)} = ${monto(usd, 'USD')}`, [deCalc('En pesos', ars, 'ARS'), { nombre: 'CCL de tu última carga', valor: t.toFixed(), unidad: 'ratio' }], {
        explicacion: 'En dólares al CCL de hoy: una referencia, no el dólar del día del pago.',
      }),
    ),
  }
}
