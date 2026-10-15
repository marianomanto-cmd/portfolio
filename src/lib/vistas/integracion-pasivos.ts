// Lo que Pasivos le da a las otras pantallas en la integración (plan §10):
// funciones puras sobre los hechos (leerHechos) y los hechos de Pasivos
// (leerPasivos), con la forma que ya esperan Balance (ExtrasBalance), Flujo
// (la amortización de cada cuota para su adaptador) y Hoy (la cuota que vence,
// en Atención). Nada se guarda: todo se calcula, con su traza.

import type { Calc, DobleCalc } from '@/lib/domain/calc'
import { diasEntre, fechaCorta, fechaLarga } from '@/lib/domain/fechas'
import { aperturasCuotas, capitalSegunCuadro, cuotasAlDia, dobleDeCuota, resumenLeasing, totalCuota } from '@/lib/domain/pasivos/cuadro'
import { tirContrato } from '@/lib/domain/pasivos/tir'
import type { ContratoPasivo, HechosPasivos } from '@/lib/domain/pasivos/tipos'
import type { Fecha, Hechos } from '@/lib/domain/tipos'
import { cclDeHoy, fechaCclDeHoy } from './armar-pasivos'

type HechosCcl = Pick<Hechos, 'tipos_cambio' | 'feriados'>

function leasings(hp: HechosPasivos): ContratoPasivo[] {
  return hp.contratos.filter((c) => hp.cuotas.some((q) => q.pasivo_id === c.id))
}

/**
 * Para Balance (`ExtrasBalance.segunCuadro`): la deuda según el cuadro de
 * marcha a una fecha de carga, por pasivo_id, en pesos y en dólares al CCL de
 * esa fecha. Solo los pasivos con cuadro de marcha; sin tasa, "sin dato".
 */
export function segunCuadroAl(h: HechosCcl, hp: HechosPasivos): (fecha: Fecha) => ReadonlyMap<number, DobleCalc> {
  const tasas = new Map(leasings(hp).map((c) => [c.id, tirContrato(c, hp.cuotas.filter((q) => q.pasivo_id === c.id))]))
  return (fecha) => {
    const ccl = cclDeHoy(h, fecha)
    // El CCL es el de esa fecha de carga (el último hasta ahí), no el de hoy: la traza lo dice.
    const fc = fechaCclDeHoy(h, fecha)
    const rotulo = fc ? `CCL del ${fechaLarga(fc)}` : 'CCL de esa fecha'
    const out = new Map<number, DobleCalc>()
    for (const c of leasings(hp)) {
      const propias = cuotasAlDia(hp.cuotas.filter((q) => q.pasivo_id === c.id), fecha)
      out.set(c.id, capitalSegunCuadro(c, propias, tasas.get(c.id) as Calc, fecha, ccl, rotulo))
    }
    return out
  }
}

/**
 * Los hechos con la deuda según el cuadro de marcha de cada pasivo que tiene
 * cuadro (Hechos.deuda_segun_cuadro), para que haya una sola deuda en toda la
 * app (D-131, revisión de la entrega 4): la informada por el acreedor › la
 * según el cuadro de marcha › la estimada a mano. El motor la usa en Hoy,
 * Exposición, Evolución y el Balance; Pasivos y Flujo siguen el mismo orden. A
 * cada fecha cuenta las cuotas pagadas hasta esa fecha; sin la tasa del
 * contrato es "sin dato" y el motor usa la deuda cargada.
 */
export function conDeudaSegunCuadro(h: Hechos, hp: HechosPasivos): Hechos {
  if (leasings(hp).length === 0) return h
  const segun = segunCuadroAl(h, hp)
  const porFecha = new Map<Fecha, ReadonlyMap<number, DobleCalc>>()
  const monedas = new Map(hp.contratos.map((c) => [c.id, c.moneda]))
  return {
    ...h,
    deuda_segun_cuadro: (pasivo_id, fecha) => {
      let m = porFecha.get(fecha)
      if (!m) {
        m = segun(fecha)
        porFecha.set(fecha, m)
      }
      const d = m.get(pasivo_id)
      if (!d) return null
      return monedas.get(pasivo_id) === 'USD' ? d.usd : d.ars
    },
  }
}

/**
 * Para Balance (`ExtrasBalance.referencia`): lo que falta pagar según el cuadro
 * de marcha a una fecha (nominal, nunca se resta), con cuántas cuotas y una nota.
 */
export function referenciaAl(h: HechosCcl, hp: HechosPasivos): (fecha: Fecha) => ReadonlyMap<number, { falta: DobleCalc; cuotas: number | null; nota: string }> {
  return (fecha) => {
    const ccl = cclDeHoy(h, fecha)
    const out = new Map<number, { falta: DobleCalc; cuotas: number | null; nota: string }>()
    for (const c of leasings(hp)) {
      const propias = cuotasAlDia(hp.cuotas.filter((q) => q.pasivo_id === c.id), fecha)
      const r = resumenLeasing(c, propias, hp.cargos, ccl, fecha)
      out.set(c.id, {
        falta: r.falta.total,
        cuotas: r.falta.cuotas,
        nota: `${r.falta.cuotas} cuotas según el cuadro de marcha, sin la opción de compra: canon, IVA, seguro y percepción nominales. No es la deuda.`,
      })
    }
    return out
  }
}

/**
 * Para Flujo: la amortización de cada cuota (lo único que no es gasto), a la
 * tasa del contrato, en pesos con dos decimales; null = sin dato (falta la
 * tasa). La clave es `${pasivo_id}-${nro}`. Flujo la pasa a su adaptador
 * (`cuotaBase(c, contrato, amortizacion)`, src/lib/domain/flujo/cuotas.ts):
 * así no depende de la forma de CuotaBase.
 */
export function amortizacionesParaFlujo(h: HechosCcl, hp: HechosPasivos, hoy: Fecha): ReadonlyMap<string, string | null> {
  const ccl = cclDeHoy(h, hoy)
  const out = new Map<string, string | null>()
  for (const c of hp.contratos) {
    const propias = hp.cuotas.filter((q) => q.pasivo_id === c.id).sort((a, b) => a.nro - b.nro)
    if (!propias.length) continue
    const tea = tirContrato(c, propias)
    for (const a of aperturasCuotas(c, propias, hp.cargos, tea, ccl)) {
      const v = a.amortizacion.ars.valor
      out.set(`${a.pasivo_id}-${a.nro}`, v === null ? null : v.toFixed(2))
    }
  }
  return out
}

/**
 * Para Hoy (Atención, "Hoy toca", visión 4.1): la próxima cuota impaga de cada
 * leasing si vence dentro de `dias` días (10 por defecto) o ya venció.
 */
export function cuotasQueVencen(
  h: HechosCcl,
  hp: HechosPasivos,
  hoy: Fecha,
  dias = 10,
): { pasivo_id: number; nombre: string; nro: number; fecha: Fecha; total: DobleCalc; texto: string; vencida: boolean }[] {
  const ccl = cclDeHoy(h, hoy)
  const out: { pasivo_id: number; nombre: string; nro: number; fecha: Fecha; total: DobleCalc; texto: string; vencida: boolean }[] = []
  for (const c of leasings(hp)) {
    // La primera impaga: si ya venció, se dice (puede ser que la planilla no esté al día).
    const q = hp.cuotas.filter((x) => x.pasivo_id === c.id && !x.pagada).sort((a, b) => a.nro - b.nro)[0]
    if (!q) continue
    const faltan = diasEntre(hoy, q.fecha_vencimiento)
    if (faltan > dias) continue
    const vencida = faltan < 0
    out.push({
      pasivo_id: c.id,
      nombre: c.nombre,
      nro: q.nro,
      fecha: q.fecha_vencimiento,
      total: dobleDeCuota(totalCuota(q), q, ccl),
      vencida,
      texto: vencida
        ? `La cuota ${q.nro} del leasing venció el ${fechaCorta(q.fecha_vencimiento)} y tu planilla no la marca pagada`
        : `Próxima cuota del leasing: ${fechaCorta(q.fecha_vencimiento)}`,
    })
  }
  return out
}
