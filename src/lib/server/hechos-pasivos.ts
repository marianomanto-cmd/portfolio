import 'server-only'

import { cache } from 'react'
import { dec, decReq } from '@/lib/domain/dinero'
import type { CargoExtra, ContratoPasivo, Cuota, FuenteCuota, HechosPasivos } from '@/lib/domain/pasivos/tipos'
import type { Moneda } from '@/lib/domain/tipos'
import { leerTodo } from './supabase'

// Lee los pasivos con las columnas de la entrega 4, el cuadro de marcha y los
// cargos extra (migración 20261015124724_pasivos_cuadro_marcha), con los montos
// como texto (::text) que pasan a Decimal acá (D-32). Como leerHechos(), una
// sola lectura por render (React cache): Pasivos, Flujo y Balance la comparten.
//
// Lo que no cuenta no llega:
// - una cuota o un cargo de una carga revertida (revertir_lote restaura las
//   cuotas; los cargos quedan con su carga revertida, sin FK, y se ignoran acá);
// - un cargo anulado;
// - los cargos de una planilla vieja: cada planilla importada trae todos sus
//   cargos, así que cuentan los de la última planilla vigente de cada pasivo y
//   los que se cargaron a mano (D-153).

type Fila = Record<string, string | number | boolean | null>

const s = (v: Fila[string] | undefined) => (v === null || v === undefined ? null : String(v))
const n = (v: Fila[string] | undefined) => Number(v)

export const LECTOR_PLANILLA = 'cuadro-marcha-csv@1'

export interface CargaPasivo {
  id: number
  estado: 'vigente' | 'reemplazada' | 'revertida'
  lector: string | null
  /** El pasivo que grabó (grabado->pasivo_id), si es una carga del cuadro de marcha. */
  pasivo_id: number | null
}

export const leerPasivos: () => Promise<HechosPasivos> = cache(leerPasivosDeLaBase)

async function leerPasivosDeLaBase(): Promise<HechosPasivos> {
  const [pasivos, cuotas, cargos, cargas] = await Promise.all([
    leerTodo<Fila>(
      'pasivos',
      'id,nombre,tipo,moneda,fecha_inicio,cuotas_totales,monto_financiado_neto::text,anticipo_neto::text,opcion_compra_neto::text,opcion_compra_fecha,valor_bien::text,alicuota_ganancias::text,fecha_desembolso,pagador_habitual,reintegra_iva,notas',
      ['id'],
    ),
    leerTodo<Fila>(
      'pasivo_cuotas',
      'pasivo_id,nro,fecha_vencimiento,periodo,canon_neto::text,iva_canon::text,seguro::text,otros_conceptos::text,base_ganancias::text,estado,fuente_canon,fuente_seguro,fuente_otros,pagada,fecha_pago,monto_pagado::text,cuenta_pago_id,ccl_del_dia_pago::text,ccl_fuente,pagador,carga_id,notas',
      ['pasivo_id', 'nro'],
    ),
    leerTodo<Fila>('pasivo_cargos', 'id,pasivo_id,fecha,concepto,detalle,importe::text,cuota_nro,fuente,anulado_en,carga_id,notas', ['id']),
    leerTodo<Fila>('cargas', 'id,estado,lector,pasivo:grabado->pasivo_id', ['id'], (q) => q.in('lector', [LECTOR_PLANILLA, 'manual'])),
  ])
  return armarHechosPasivos(pasivos, cuotas, cargos, cargas)
}

/** De las filas de la base a los hechos (puro: se prueba sin base). */
export function armarHechosPasivos(pasivos: Fila[], cuotas: Fila[], cargos: Fila[], cargas: Fila[]): HechosPasivos {
  const cargasPorId = new Map<number, CargaPasivo>(
    cargas.map((r) => [
      n(r.id),
      { id: n(r.id), estado: r.estado as CargaPasivo['estado'], lector: s(r.lector), pasivo_id: r.pasivo === null || r.pasivo === undefined ? null : n(r.pasivo) },
    ]),
  )
  return {
    contratos: pasivos.map(
      (r): ContratoPasivo => ({
        id: n(r.id),
        nombre: String(r.nombre),
        tipo: r.tipo as ContratoPasivo['tipo'],
        moneda: r.moneda as Moneda,
        fecha_inicio: String(r.fecha_inicio),
        cuotas_totales: n(r.cuotas_totales),
        monto_financiado_neto: dec(s(r.monto_financiado_neto)),
        anticipo_neto: dec(s(r.anticipo_neto)),
        opcion_compra_neto: dec(s(r.opcion_compra_neto)),
        opcion_compra_fecha: s(r.opcion_compra_fecha),
        valor_bien: dec(s(r.valor_bien)),
        alicuota_ganancias: dec(s(r.alicuota_ganancias)),
        fecha_desembolso: s(r.fecha_desembolso),
        pagador_habitual: (s(r.pagador_habitual) as ContratoPasivo['pagador_habitual']) ?? null,
        reintegra_iva: r.reintegra_iva === null || r.reintegra_iva === undefined ? null : Boolean(r.reintegra_iva),
        notas: s(r.notas),
      }),
    ),
    cuotas: cuotas
      .filter((r) => cargasPorId.get(n(r.carga_id))?.estado !== 'revertida')
      .map(
        (r): Cuota => ({
          pasivo_id: n(r.pasivo_id),
          nro: n(r.nro),
          fecha_vencimiento: String(r.fecha_vencimiento),
          periodo: s(r.periodo),
          canon_neto: decReq(s(r.canon_neto), 'canon_neto'),
          iva_canon: decReq(s(r.iva_canon), 'iva_canon'),
          seguro: decReq(s(r.seguro), 'seguro'),
          otros_conceptos: decReq(s(r.otros_conceptos), 'otros_conceptos'),
          estado: r.estado as Cuota['estado'],
          fuente_canon: r.fuente_canon as FuenteCuota,
          fuente_seguro: r.fuente_seguro as FuenteCuota,
          fuente_otros: r.fuente_otros as FuenteCuota,
          pagada: Boolean(r.pagada),
          fecha_pago: s(r.fecha_pago),
          monto_pagado: dec(s(r.monto_pagado)),
          cuenta_pago_id: r.cuenta_pago_id === null || r.cuenta_pago_id === undefined ? null : n(r.cuenta_pago_id),
          ccl_del_dia_pago: dec(s(r.ccl_del_dia_pago)),
          ccl_fuente: s(r.ccl_fuente),
          pagador: (s(r.pagador) as Cuota['pagador']) ?? null,
          base_ganancias: dec(s(r.base_ganancias)),
          carga_id: n(r.carga_id),
          notas: s(r.notas),
        }),
      ),
    cargos: cargosQueCuentan(
      cargos.map(
        (r): CargoExtra => ({
          id: n(r.id),
          pasivo_id: n(r.pasivo_id),
          fecha: String(r.fecha),
          concepto: r.concepto as CargoExtra['concepto'],
          detalle: s(r.detalle),
          importe: decReq(s(r.importe), 'importe'),
          cuota_nro: r.cuota_nro === null || r.cuota_nro === undefined ? null : n(r.cuota_nro),
          fuente: r.fuente as CargoExtra['fuente'],
          anulado: r.anulado_en !== null && r.anulado_en !== undefined,
          carga_id: n(r.carga_id),
          notas: s(r.notas),
        }),
      ),
      [...cargasPorId.values()],
    ),
  }
}

/**
 * Los cargos que cuentan (D-153): sin anular, de una carga que existe y no está
 * revertida, y o bien cargados a mano o de la última planilla vigente de su pasivo.
 */
export function cargosQueCuentan(cargos: readonly CargoExtra[], cargas: readonly CargaPasivo[]): CargoExtra[] {
  const porId = new Map(cargas.map((c) => [c.id, c]))
  const ultimaPlanilla = new Map<number, number>()
  for (const c of cargas) {
    if (c.lector !== LECTOR_PLANILLA || c.estado === 'revertida' || c.pasivo_id === null) continue
    ultimaPlanilla.set(c.pasivo_id, Math.max(ultimaPlanilla.get(c.pasivo_id) ?? 0, c.id))
  }
  return cargos.filter((k) => {
    if (k.anulado) return false
    const c = porId.get(k.carga_id)
    if (!c || c.estado === 'revertida') return false
    if (c.lector === LECTOR_PLANILLA) return ultimaPlanilla.get(k.pasivo_id) === c.id
    return true
  })
}
