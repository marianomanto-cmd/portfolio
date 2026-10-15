// Ingresos y gastos declarados, mes por mes (plan §6 D.2). Una fila cuenta en un
// mes si está vigente el último día de ese mes (los flujos del mes se toman a
// fin de mes): así, "cambia desde el 01/02" cierra la fila vieja el 31/01 y el
// mes de enero lleva la vieja y febrero la nueva, sin sumar las dos. Las filas
// anuladas no llegan acá (el lector las saca).

import type { Fecha } from '../tipos'
import type { RecurrenteBase } from './tipos'

/** Último día del mes de una fecha. */
export function finDeMes(mes: Fecha): Fecha {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(Date.UTC(a, m, 0))
  return d.toISOString().slice(0, 10)
}

/** Las filas vigentes en un mes (vigentes su último día). */
export function vigentesEn(rs: readonly RecurrenteBase[], mes: Fecha): RecurrenteBase[] {
  const fin = finDeMes(mes)
  return rs.filter((r) => r.vigente_desde <= fin && (r.vigente_hasta === null || r.vigente_hasta >= fin))
}

const PASO: Record<RecurrenteBase['frecuencia'], number> = { mensual: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 }

function indice(a: Fecha, b: Fecha): number {
  const [a0, m0] = a.split('-').map(Number)
  const [a1, m1] = b.split('-').map(Number)
  return (a1 - a0) * 12 + (m1 - m0)
}

/** ¿Le toca pagarse a este gasto en este mes? (por su frecuencia y su primer mes). */
export function tocaEnMes(g: RecurrenteBase, mes: Fecha): boolean {
  const paso = PASO[g.frecuencia]
  if (paso === 1) return true
  if (!g.primer_mes) return false
  const k = indice(g.primer_mes, mes)
  return k >= 0 && k % paso === 0
}

/** Las filas de un sentido y una moneda que cuentan en un mes (vigentes y, si es un gasto, que le toca). */
export function delMes(rs: readonly RecurrenteBase[], mes: Fecha, sentido: RecurrenteBase['sentido'], moneda: RecurrenteBase['moneda']): RecurrenteBase[] {
  return vigentesEn(rs, mes).filter((r) => r.sentido === sentido && r.moneda === moneda && (sentido === 'ingreso' || tocaEnMes(r, mes)))
}
