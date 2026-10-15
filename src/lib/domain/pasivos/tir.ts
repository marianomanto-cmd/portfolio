// Tasa implícita del contrato de leasing (D-143): la TIR de sus flujos netos,
// como TEA en días/365, y su TEM equivalente. No es la deuda: lo único que netea
// el patrimonio sigue siendo el valor de cancelación informado (D-130), y la
// deuda "según cuadro de marcha" que sale de esta tasa va rotulada "estimado".
//
// Flujos (decisión del lead, 14/10): −monto financiado neto en la fecha de
// desembolso (la entrega del bien), + el canon neto de cada cuota en su
// vencimiento, + la opción de compra neta en su fecha. El IVA, el seguro y la
// percepción no entran: no son financiación. Sin el monto financiado o sin la
// fecha de desembolso, sin dato ("Completar el contrato"): nunca se toma
// fecha_inicio en su lugar.
//
// Búsqueda: bisección en coma flotante para acercarse, y Newton en Decimal
// (precisión 40) hasta |VPN| < 0,01 con la tasa que se devuelve. El VPN final
// se recalcula exacto en Decimal: es el control.

import { calc, deCalc, sinDato, type Calc, type Etiqueta, type Insumo } from '../calc'
import { CERO, Decimal, monto, porcentaje, UNO } from '../dinero'
import { diasEntre, fechaLarga } from '../fechas'
import type { Fecha } from '../tipos'
import type { ContratoPasivo, Cuota } from './tipos'

export interface Flujo {
  fecha: Fecha
  monto: Decimal
}

const ANIO = new Decimal(365)
const TOLERANCIA = new Decimal('0.01')

/** VPN de los flujos a la TEA `r`, descontados en días/365 desde `t0`. */
export function vpn(flujos: readonly Flujo[], r: Decimal, t0: Fecha): Decimal {
  const base = UNO.plus(r)
  return flujos.reduce((a, f) => a.plus(f.monto.div(base.pow(new Decimal(diasEntre(t0, f.fecha)).div(ANIO)))), CERO)
}

/** Derivada del VPN respecto de r. */
function dvpn(flujos: readonly Flujo[], r: Decimal, t0: Fecha): Decimal {
  const base = UNO.plus(r)
  return flujos.reduce((a, f) => {
    const t = new Decimal(diasEntre(t0, f.fecha)).div(ANIO)
    return a.minus(f.monto.times(t).div(base.pow(t.plus(1))))
  }, CERO)
}

function vpnFlotante(flujos: readonly { t: number; m: number }[], r: number): number {
  let s = 0
  for (const f of flujos) s += f.m / Math.pow(1 + r, f.t)
  return s
}

/**
 * La TIR (TEA) de unos flujos con el primero negativo y el resto positivos, o
 * null si no converge. Devuelve la tasa y el VPN exacto a esa tasa.
 */
export function tir(flujos: readonly Flujo[]): { tea: Decimal; vpn: Decimal } | null {
  if (flujos.length < 2) return null
  const t0 = flujos.reduce((m, f) => (f.fecha < m ? f.fecha : m), flujos[0].fecha)
  const fl = flujos.map((f) => ({ t: diasEntre(t0, f.fecha) / 365, m: f.monto.toNumber() }))
  // Bisección en flotante entre −99% y 10.000% anual: el VPN de un préstamo baja con la tasa.
  let lo = -0.99
  let hi = 100
  let flo = vpnFlotante(fl, lo)
  const fhi = vpnFlotante(fl, hi)
  if (!Number.isFinite(flo) || !Number.isFinite(fhi) || Math.sign(flo) === Math.sign(fhi)) return null
  for (let i = 0; i < 200 && hi - lo > 1e-12; i++) {
    const mid = (lo + hi) / 2
    const fm = vpnFlotante(fl, mid)
    if (Math.sign(fm) === Math.sign(flo)) {
      lo = mid
      flo = fm
    } else hi = mid
  }
  // Newton en Decimal desde la aproximación, hasta |VPN| < 0,000000001 (converge en pocas vueltas).
  let r = new Decimal((lo + hi) / 2)
  for (let i = 0; i < 20; i++) {
    const v = vpn(flujos, r, t0)
    if (v.abs().lt('0.000000001')) break
    const d = dvpn(flujos, r, t0)
    if (d.isZero()) break
    const siguiente = r.minus(v.div(d))
    if (!siguiente.isFinite() || siguiente.lte(-1)) break
    r = siguiente
  }
  r = r.toDecimalPlaces(16)
  const final = vpn(flujos, r, t0)
  if (final.abs().gte(TOLERANCIA)) return null
  return { tea: r, vpn: final }
}

/** TEM equivalente a una TEA: (1 + TEA)^(1/12) − 1. */
export function temDeTea(tea: Calc): Calc {
  if (tea.valor === null) return sinDato(tea.motivo ?? 'Sin la tasa anual del contrato no hay tasa mensual.', [deCalc('TEA del contrato', tea, 'fraccion')])
  const tem = UNO.plus(tea.valor).pow(UNO.div(12)).minus(1).toDecimalPlaces(16)
  return calc(tem, `(1 + ${porcentaje(tea.valor, { decimales: 4 })})^(1/12) − 1 = ${porcentaje(tem, { decimales: 4 })}`, [deCalc('TEA del contrato', tea, 'fraccion')], {
    explicacion: 'La tasa mensual equivalente a la anual del contrato: capitalizada 12 veces da la TEA.',
  })
}

/** Lo que falta del contrato para calcular su tasa, en castellano ("el monto financiado neto y la fecha de desembolso"). */
export function faltanParaTasa(contrato: ContratoPasivo, cuotas: readonly Cuota[]): string[] {
  const f: string[] = []
  if (contrato.monto_financiado_neto === null) f.push('el monto financiado neto')
  if (contrato.fecha_desembolso === null) f.push('la fecha de desembolso (la entrega del bien)')
  if (contrato.opcion_compra_neto === null || contrato.opcion_compra_fecha === null) f.push('la opción de compra y su fecha')
  const propias = cuotas.filter((c) => c.pasivo_id === contrato.id)
  if (propias.length < contrato.cuotas_totales) f.push(`el cuadro de marcha completo (hay ${propias.length} de ${contrato.cuotas_totales} cuotas)`)
  return f
}

function lista(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`
}

/**
 * TEA implícita del contrato (D-143), con su traza. Etiquetas: las del canon de
 * las cuotas (un canon "supuesto" o "a confirmar" hace supuesta la tasa).
 */
export function tirContrato(contrato: ContratoPasivo, cuotas: readonly Cuota[]): Calc {
  const explicacion =
    'La tasa anual que iguala lo que te financiaron con lo que pagás de canon y opción de compra, en sus fechas (días/365). Sale del contrato y del cuadro de marcha; el IVA, el seguro y la percepción no entran porque no son financiación.'
  const faltan = faltanParaTasa(contrato, cuotas)
  if (faltan.length) return sinDato(`Completar el contrato: falta ${lista(faltan)}.`, [], { explicacion })
  const propias = [...cuotas.filter((c) => c.pasivo_id === contrato.id)].sort((a, b) => a.nro - b.nro)
  const financiado = contrato.monto_financiado_neto as Decimal
  const desembolso = contrato.fecha_desembolso as Fecha
  const opcion = contrato.opcion_compra_neto as Decimal
  const fechaOpcion = contrato.opcion_compra_fecha as Fecha
  if (propias.some((c) => c.fecha_vencimiento <= desembolso)) {
    return sinDato(`Hay cuotas que vencen antes o el mismo día del desembolso (${fechaLarga(desembolso)}): revisá la fecha de desembolso del contrato.`, [], { explicacion })
  }
  const flujos: Flujo[] = [
    { fecha: desembolso, monto: financiado.negated() },
    ...propias.map((c) => ({ fecha: c.fecha_vencimiento, monto: c.canon_neto })),
    { fecha: fechaOpcion, monto: opcion },
  ]
  const r = tir(flujos)
  const canones = propias.reduce((a, c) => a.plus(c.canon_neto), CERO)
  const insumos: Insumo[] = [
    { nombre: 'Monto financiado neto', valor: financiado.toFixed(), unidad: 'ARS' },
    { nombre: 'Fecha de desembolso (entrega del bien)', valor: desembolso, unidad: 'fecha' },
    { nombre: `Cánones netos de las ${propias.length} cuotas`, valor: canones.toFixed(), unidad: 'ARS' },
    { nombre: 'Primera cuota', valor: propias[0].fecha_vencimiento, unidad: 'fecha' },
    { nombre: 'Última cuota', valor: propias[propias.length - 1].fecha_vencimiento, unidad: 'fecha' },
    { nombre: 'Opción de compra neta', valor: opcion.toFixed(), unidad: 'ARS' },
    { nombre: 'Fecha de la opción', valor: fechaOpcion, unidad: 'fecha' },
  ]
  const etiquetas: Etiqueta[] = []
  if (propias.some((c) => c.fuente_canon === 'supuesto')) etiquetas.push('supuesto')
  if (propias.some((c) => c.fuente_canon === 'a_confirmar')) etiquetas.push('a_confirmar')
  if (!r) return sinDato('La tasa del contrato no converge con estos flujos: revisá el monto financiado, las fechas y la opción.', insumos, { explicacion, etiquetas })
  insumos.push({ nombre: 'VPN a esa tasa (control: menos de $ 0,01)', valor: r.vpn.toDecimalPlaces(6).toFixed(), unidad: 'ARS' })
  const formula =
    `TIR de −${monto(financiado, 'ARS', { decimales: 2 })} el ${fechaLarga(desembolso)}, ` +
    `+ ${propias.length} cánones (${monto(canones, 'ARS', { decimales: 2 })}) y + opción ${monto(opcion, 'ARS', { decimales: 2 })} el ${fechaLarga(fechaOpcion)} ` +
    `= TEA ${porcentaje(r.tea, { decimales: 2 })}`
  return calc(r.tea, formula, insumos, { etiquetas, explicacion })
}
