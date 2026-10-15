// Adaptador de las cuotas del leasing a lo que proyecta Flujo (plan §6 D.2).
//
// PUNTO DE INTEGRACIÓN (lead, plan §10): la amortización de cada cuota sale de
// aperturaCuota() de Pasivos (src/lib/domain/pasivos/cuadro.ts, en otra rama).
// Mientras tanto queda null: el flujo de caja anda igual (usa la cuota entera,
// que es lo que se debita) y el patrimonio neto completo proyectado dice "sin
// dato" con su motivo. Al integrar: pasar `amortizacion` desde aperturaCuota.

import type { Etiqueta } from '../calc'
import { unicas } from '../calc'
import { CERO, type Decimal } from '../dinero'
import { cargosPorCuota } from '../pasivos/cargos'
import type { CargoExtra, ContratoPasivo, Cuota, FuenteCuota } from '../pasivos/tipos'
import type { Fecha } from '../tipos'
import type { BaseProyeccion, CuotaBase } from './tipos'

function etiquetaFuente(f: FuenteCuota): Etiqueta | null {
  if (f === 'supuesto') return 'supuesto'
  if (f === 'a_confirmar') return 'a_confirmar'
  return null
}

/** Lo que suman los cargos extra que se debitan con cada cuota (la regla de pasivos/cargos.ts), por `${pasivo_id}-${nro}`. */
export function importeCargosPorCuota(cuotas: readonly Pick<Cuota, 'pasivo_id' | 'nro' | 'fecha_vencimiento'>[], cargos: readonly CargoExtra[]): Map<string, Decimal> {
  return new Map([...cargosPorCuota(cuotas, cargos)].map(([clave, ks]) => [clave, ks.reduce((a, k) => a.plus(k.importe), CERO)]))
}

/** total = canon + IVA + seguro + percepción + cargos extra de la cuota (lo que se debita). Etiquetas: proyectado, y supuesto / a confirmar por campo. */
export function cuotaBase(
  c: Cuota,
  contrato: Pick<ContratoPasivo, 'pagador_habitual'> | null = null,
  amortizacion: string | null = null,
  cargos: Decimal | null = null,
): CuotaBase {
  const total = c.canon_neto.plus(c.iva_canon).plus(c.seguro).plus(c.otros_conceptos).plus(cargos ?? CERO)
  const etiquetas: Etiqueta[] = []
  if (c.estado === 'proyectada') etiquetas.push('proyectado')
  for (const f of [c.fuente_canon, c.fuente_seguro, c.fuente_otros]) {
    const e = etiquetaFuente(f)
    if (e) etiquetas.push(e)
  }
  return {
    pasivo_id: c.pasivo_id,
    nro: c.nro,
    fecha_vencimiento: c.fecha_vencimiento,
    fecha_pago: c.fecha_pago,
    partes: {
      canon: c.canon_neto.toFixed(),
      iva: c.iva_canon.toFixed(),
      seguro: c.seguro.toFixed(),
      percepcion: c.otros_conceptos.toFixed(),
      ...(cargos && !cargos.isZero() ? { cargos: cargos.toFixed() } : {}),
    },
    total: total.toFixed(),
    amortizacion,
    iva_y_percepcion: c.iva_canon.plus(c.otros_conceptos).toFixed(),
    pagada: c.pagada,
    pagador: c.pagador ?? contrato?.pagador_habitual ?? null,
    etiquetas: unicas(etiquetas),
  }
}

/** Un leasing sin cuadro de marcha cargado (o con el cuadro incompleto, sin la cuota del mes) cuyo plazo cubre el mes. */
export interface LeasingSinCuadro {
  pasivo_id: number
  nombre: string
  pagador: 'titular' | 'empresa' | null
  /** Cuántas cuotas tiene cargadas (0 = falta el cuadro entero) de cuántas dice el contrato. */
  cargadas?: number
  totales?: number
}

const mesNum = (f: string) => Number(f.slice(0, 4)) * 12 + Number(f.slice(5, 7)) - 1

/**
 * Los leasings que no tienen ninguna cuota cargada (falta importar el cuadro
 * de marcha) y cuyo plazo cubre `mes`: desde el mes de inicio hasta el mes de
 * inicio + cuotas_totales, los dos incluidos (de más, nunca de menos: un mes
 * de más dice "sin dato", uno de menos inventaría una cuota de $ 0). Con el
 * cuadro cargado, manda el cuadro.
 */
export function leasingsSinCuadro(base: Pick<BaseProyeccion, 'cuotas' | 'pasivos'>, mes: Fecha): LeasingSinCuadro[] {
  const m = mesNum(mes)
  return (base.pasivos ?? [])
    .filter((p) => (p.tipo ?? 'leasing') === 'leasing' && p.fecha_inicio && p.cuotas_totales)
    .filter((p) => {
      const ini = mesNum(p.fecha_inicio as string)
      return m >= ini && m <= ini + (p.cuotas_totales as number)
    })
    .map((p) => ({ p, propias: base.cuotas.filter((c) => c.pasivo_id === p.id) }))
    // Con el cuadro completo, manda el cuadro (un mes sin cuota no se paga). Incompleto (por ejemplo, después
    // de deshacer una planilla con un pago completado después), el mes que no tiene su cuota es "sin dato".
    .filter(({ p, propias }) => propias.length === 0 || (propias.length < (p.cuotas_totales as number) && !propias.some((c) => mesNum(c.fecha_vencimiento) === m)))
    .map(({ p, propias }) => ({ pasivo_id: p.id, nombre: p.nombre, pagador: p.pagador_habitual, cargadas: propias.length, totales: p.cuotas_totales as number }))
}

/**
 * Los meses del plazo de un leasing que no tienen su cuota en un cuadro de
 * marcha incompleto (menos cuotas que el contrato), con la misma ventana que
 * leasingsSinCuadro. Sin cuadro, o con el cuadro completo, ninguno (con el
 * completo manda el cuadro: un mes sin cuota no se paga).
 */
export function mesesSinCuota(p: Pick<ContratoPasivo, 'fecha_inicio' | 'cuotas_totales'>, vencimientos: readonly Fecha[]): Fecha[] {
  if (!p.fecha_inicio || !p.cuotas_totales || vencimientos.length === 0 || vencimientos.length >= p.cuotas_totales) return []
  const con = new Set(vencimientos.map(mesNum))
  const ini = mesNum(p.fecha_inicio)
  const out: Fecha[] = []
  for (let m = ini; m <= ini + p.cuotas_totales; m++) if (!con.has(m)) out.push(`${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}-01`)
  return out
}

/** El motivo del "sin dato" de la cuota de un leasing sin cuadro de marcha (o con el cuadro incompleto). */
export function motivoSinCuadro(l: Pick<LeasingSinCuadro, 'nombre' | 'cargadas' | 'totales'>): string {
  if (l.cargadas && l.totales)
    return `El cuadro de marcha de «${l.nombre}» tiene ${l.cargadas} de ${l.totales} cuotas y no la de este mes: importá la planilla completa en Datos › Leasing (no se cuenta como $ 0).`
  return `Falta el cuadro de marcha de «${l.nombre}»: importalo en Datos › Leasing para saber la cuota de cada mes (no se cuenta como $ 0).`
}
