// TEM implícita de un bono o una letra que vas a tener hasta el vencimiento
// (plan §6 D.2; D-146): la tasa por 30 días que iguala el valor de hoy con los
// pagos que faltan, cada uno descontado por sus días corridos.
//   Un solo pago:   TEM = (pago ÷ valor de hoy)^(30 ÷ días) − 1
//   Varios pagos:   valor de hoy = Σ pago_i ÷ (1 + TEM)^(días_i ÷ 30), por bisección.

import { calc, sinDato, type Calc } from '../calc'
import { Decimal, monto, numero, porcentaje } from '../dinero'

const UNO = new Decimal(1)
const TREINTA = new Decimal(30)

export interface PagoFuturo {
  dias: number
  monto: Decimal
}

function vp(pagos: readonly PagoFuturo[], tem: Decimal): Decimal {
  let t = new Decimal(0)
  for (const p of pagos) t = t.plus(p.monto.div(UNO.plus(tem).pow(new Decimal(p.dias).div(TREINTA))))
  return t
}

/** La TEM como fracción (0,021 = 2,1% por 30 días), o null si no se puede (sin pagos, días ≤ 0, valor ≤ 0). */
export function temImplicitaValor(valorHoy: Decimal, pagos: readonly PagoFuturo[]): Decimal | null {
  const ps = pagos.filter((p) => p.dias > 0 && p.monto.gt(0))
  if (!valorHoy.gt(0) || ps.length === 0) return null
  if (ps.length === 1) return ps[0].monto.div(valorHoy).pow(TREINTA.div(ps[0].dias)).minus(UNO)
  let lo = new Decimal('-0.99')
  let hi = new Decimal(5)
  if (vp(ps, lo).lt(valorHoy) || vp(ps, hi).gt(valorHoy)) return null
  for (let i = 0; i < 200; i++) {
    const mid = lo.plus(hi).div(2)
    if (vp(ps, mid).gt(valorHoy)) lo = mid
    else hi = mid
    if (hi.minus(lo).lt('1e-18')) break
  }
  return lo.plus(hi).div(2)
}

/** La TEM implícita con su traza. */
export function temImplicita(ticker: string, valorHoy: Decimal | null, pagos: readonly PagoFuturo[]): Calc {
  if (valorHoy === null) return sinDato(`Falta el valor de hoy de ${ticker}.`)
  if (pagos.length === 0) return sinDato(`Falta el pago al vencimiento de ${ticker}: cargalo para saber su TEM.`)
  const tem = temImplicitaValor(valorHoy, pagos)
  if (tem === null) return sinDato(`No se pudo calcular la TEM de ${ticker} con esos pagos.`)
  const formula =
    pagos.length === 1
      ? `(${monto(pagos[0].monto, 'ARS', { decimales: 2 })} ÷ ${monto(valorHoy, 'ARS', { decimales: 2 })})^(30 ÷ ${pagos[0].dias}) − 1 = ${porcentaje(tem, { decimales: 3 })}`
      : `la TEM que iguala ${monto(valorHoy, 'ARS', { decimales: 2 })} con ${pagos.length} pagos = ${porcentaje(tem, { decimales: 3 })}`
  return calc(
    tem,
    formula,
    [
      { nombre: `Valor de hoy de ${ticker}`, valor: valorHoy.toFixed(), unidad: 'ARS' },
      ...pagos.map((p) => ({ nombre: `Pago en ${numero(new Decimal(p.dias), 0)} días`, valor: p.monto.toFixed(), unidad: 'ARS' as const })),
    ],
    { explicacion: 'La tasa por 30 días que te da tener el título hasta el vencimiento, comprado al precio de hoy (calculada, no informada).' },
  )
}
