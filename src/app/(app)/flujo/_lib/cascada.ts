// La cascada del mes (handoff, captura 10: "de ingreso a excedente"): los
// ingresos en dólares (al cripto), los pesos fijos, el reintegro del IVA si lo
// declaraste, los gastos fijos y la cuota del leasing, hasta el excedente
// invertible. Cada paso es una cifra de la vista con su traza (MesActual): acá
// solo se ordenan y se apilan. Pura, con test (cascada.test.ts). Si falta un
// paso, la cascada no se dibuja a medias: dice qué falta (D-165).

import type { CalcVista } from '@/lib/domain/calc'
import { Decimal } from '@/lib/domain/dinero'
import type { Par } from '@/lib/vistas/contratos'
import type { MesActual } from '@/lib/vistas/contratos-flujo'

export type PasoCascada = 'usd' | 'pesos' | 'reintegro' | 'gastos' | 'cuota' | 'excedente'

export interface BarraCascada {
  clave: PasoCascada
  nombre: string
  /** El par de la vista (pesos y dólares), con su traza. */
  par: Par
  /** El paso con signo, en pesos: lo que entra suma, lo que sale resta. El excedente, el resultado. */
  valor: number
  /** De dónde a dónde va la barra (en pesos). */
  desde: number
  hasta: number
}

export type Cascada = { barras: BarraCascada[]; motivo: null } | { barras: null; motivo: string }

const n = (c: CalcVista) => (c.valor === null ? null : new Decimal(c.valor))

/**
 * Los pasos de la cascada, en pesos. Un paso en cero que no es el excedente no
 * se dibuja (no declaraste ingreso en dólares, la cuota la paga la empresa):
 * es un cero real, no un dato que falta. Un paso sin dato frena la cascada.
 */
export function cascada(m: Pick<MesActual, 'ingreso_usd' | 'ingreso_pesos' | 'reintegro' | 'gastos' | 'cuota' | 'excedente'>): Cascada {
  const pasos: { clave: PasoCascada; nombre: string; par: Par; signo: 1 | -1 }[] = [
    { clave: 'usd', nombre: 'Ingresos USD × cripto', par: m.ingreso_usd, signo: 1 },
    { clave: 'pesos', nombre: 'Pesos fijos', par: m.ingreso_pesos, signo: 1 },
    ...(m.reintegro ? [{ clave: 'reintegro' as const, nombre: 'Reintegro de IVA', par: m.reintegro, signo: 1 as const }] : []),
    { clave: 'gastos', nombre: 'Gastos fijos', par: m.gastos, signo: -1 },
    { clave: 'cuota', nombre: 'Cuota leasing', par: m.cuota, signo: -1 },
  ]
  for (const p of [...pasos, { nombre: 'Excedente', par: m.excedente }]) {
    if (p.par.ars.valor === null) return { barras: null, motivo: p.par.ars.motivo || `Falta un dato: ${p.nombre.toLowerCase()}.` }
  }
  const barras: BarraCascada[] = []
  let corrido = new Decimal(0)
  for (const p of pasos) {
    const v = (n(p.par.ars) as Decimal).times(p.signo)
    if (v.isZero()) continue
    const hasta = corrido.plus(v)
    barras.push({ clave: p.clave, nombre: p.nombre, par: p.par, valor: v.toNumber(), desde: Decimal.min(corrido, hasta).toNumber(), hasta: Decimal.max(corrido, hasta).toNumber() })
    corrido = hasta
  }
  const e = n(m.excedente.ars) as Decimal
  barras.push({ clave: 'excedente', nombre: 'Excedente', par: m.excedente, valor: e.toNumber(), desde: Math.min(0, e.toNumber()), hasta: Math.max(0, e.toNumber()) })
  return { barras, motivo: null }
}
