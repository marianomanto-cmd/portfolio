import 'server-only'

// Lo que Flujo y escenarios lee de la base, además de los Hechos (plan §6 D.3):
// ingresos y gastos declarados, cronogramas de bonos, escenarios, valores
// recordados, lo cargado con "Cargar ingreso" y el leasing (contrato, cuotas y
// cargos extra), que lee Pasivos (leerPasivos, cacheado por pedido).
//
// Tolerante a las migraciones que todavía no se aplicaron: si falta una columna
// o una tabla nueva (F1 a F4 de Flujo), lee lo que hay y sigue.

import { cache } from 'react'
import { dec, decReq, Decimal } from '@/lib/domain/dinero'
import type { Supuestos } from '@/lib/domain/flujo/tipos'
import type { HechosPasivos } from '@/lib/domain/pasivos/tipos'
import type { Fecha, Moneda } from '@/lib/domain/tipos'
import type { RecurrenteBase } from '@/lib/domain/flujo/tipos'
import { leerPasivos } from './hechos-pasivos'
import { leerTodo } from './supabase'

type Fila = Record<string, unknown>
const s = (v: unknown) => (v === null || v === undefined ? null : String(v))
const n = (v: unknown) => Number(v)

export interface FlujoBonoFila {
  activo_id: number
  fecha: Fecha
  interes: Decimal | null
  amortizacion: Decimal
  fuente: string | null
}

export interface EscenarioGuardado {
  id: number
  nombre: string
  supuestos: unknown
  archivado: boolean
  actualizado_en: string
}

export interface FlujoCargado {
  id: number
  fecha: Fecha
  sentido: 'ingreso' | 'gasto'
  concepto: 'mensual' | 'extraordinario'
  moneda: Moneda
  monto: string
  cuenta_id: number | null
  cripto_usado: string | null
  pesos_recibidos: string | null
  anulado: boolean
  carga_id: number
  notas: string | null
  lote: string | null
  revertida: boolean
  creado_en: string | null
}

export interface DatosFlujo {
  recurrentes: RecurrenteBase[]
  flujos_bono: FlujoBonoFila[]
  escenarios: EscenarioGuardado[]
  recordados: Record<string, string>
  flujos: FlujoCargado[]
  /** El leasing, como lo lee Pasivos (contratos, cuotas y cargos extra). */
  leasing: HechosPasivos
}

/** ¿El error es "falta la columna o la tabla" (una migración que todavía no se aplicó)? */
function faltaEnLaBase(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e)
  return /does not exist|Could not find|schema cache|column .* not found/i.test(m)
}

async function leerOVacio<T>(tabla: string, columnas: string, orden: string[], alternativa?: string): Promise<T[]> {
  try {
    return await leerTodo<T>(tabla, columnas, orden)
  } catch (e) {
    if (!faltaEnLaBase(e)) throw e
    if (alternativa) {
      try {
        return await leerTodo<T>(tabla, alternativa, orden)
      } catch (e2) {
        if (!faltaEnLaBase(e2)) throw e2
      }
    }
    return []
  }
}

export const leerFlujo: () => Promise<DatosFlujo> = cache(async () => {
  const [ingresos, gastos, flujosBono, escenarios, recordados, flujos, cargas, leasing] = await Promise.all([
    leerOVacio<Fila>('ingresos_fijos', 'id,concepto,moneda,monto::text,vigente_desde,vigente_hasta,naturaleza,cuenta_destino_id,anulado_en,notas', ['id'], 'id,concepto,moneda,monto::text,vigente_desde,vigente_hasta'),
    leerOVacio<Fila>('gastos_fijos', 'id,concepto,categoria,moneda,monto::text,vigente_desde,vigente_hasta,frecuencia,primer_mes,pagador,anulado_en,notas', ['id'], 'id,concepto,categoria,moneda,monto::text,vigente_desde,vigente_hasta'),
    leerOVacio<Fila>('flujos_bono', 'activo_id,fecha,interes::text,amortizacion::text,fuente', ['activo_id', 'fecha'], 'activo_id,fecha,interes::text,amortizacion::text'),
    leerOVacio<Fila>('escenarios', 'id,nombre,supuestos,archivado_en,actualizado_en', ['id'], 'id,nombre,supuestos,actualizado_en'),
    leerOVacio<Fila>('valores_recordados', 'variable,valor::text', ['variable']),
    leerOVacio<Fila>('flujos_reales', 'id,fecha,sentido,concepto,moneda,monto::text,cuenta_id,cripto_usado::text,pesos_recibidos::text,anulado_en,carga_id,notas', ['fecha', 'id']),
    leerOVacio<Fila>('cargas', 'id,lote,estado,creado_en,lector', ['id']),
    leerPasivos(),
  ])
  const cargaDe = new Map(cargas.map((c) => [n(c.id), c]))
  const recurrentes: RecurrenteBase[] = [
    ...ingresos
      .filter((r) => !r.anulado_en)
      .map(
        (r): RecurrenteBase => ({
          id: n(r.id),
          sentido: 'ingreso',
          concepto: String(r.concepto),
          moneda: r.moneda as Moneda,
          monto: decReq(s(r.monto), 'monto').toFixed(),
          vigente_desde: String(r.vigente_desde),
          vigente_hasta: s(r.vigente_hasta),
          frecuencia: 'mensual',
          primer_mes: null,
          pagador: null,
          naturaleza: s(r.naturaleza),
        }),
      ),
    ...gastos
      .filter((r) => !r.anulado_en)
      .map(
        (r): RecurrenteBase => ({
          id: n(r.id),
          sentido: 'gasto',
          concepto: String(r.concepto),
          moneda: r.moneda as Moneda,
          monto: decReq(s(r.monto), 'monto').toFixed(),
          vigente_desde: String(r.vigente_desde),
          vigente_hasta: s(r.vigente_hasta),
          frecuencia: (s(r.frecuencia) ?? 'mensual') as RecurrenteBase['frecuencia'],
          primer_mes: s(r.primer_mes),
          pagador: (s(r.pagador) as RecurrenteBase['pagador']) ?? null,
          naturaleza: s(r.categoria),
        }),
      ),
  ]
  return {
    recurrentes,
    flujos_bono: flujosBono.map((r) => ({
      activo_id: n(r.activo_id),
      fecha: String(r.fecha),
      interes: dec(s(r.interes)),
      amortizacion: decReq(s(r.amortizacion), 'amortizacion'),
      fuente: s(r.fuente),
    })),
    escenarios: escenarios.map((r) => ({
      id: n(r.id),
      nombre: String(r.nombre),
      supuestos: r.supuestos as Supuestos,
      archivado: Boolean(r.archivado_en),
      actualizado_en: String(r.actualizado_en),
    })),
    recordados: Object.fromEntries(recordados.map((r) => [String(r.variable), String(r.valor)])),
    flujos: flujos.map((r) => {
      const c = cargaDe.get(n(r.carga_id))
      return {
        id: n(r.id),
        fecha: String(r.fecha),
        sentido: r.sentido as FlujoCargado['sentido'],
        concepto: r.concepto as FlujoCargado['concepto'],
        moneda: r.moneda as Moneda,
        monto: decReq(s(r.monto), 'monto').toFixed(),
        cuenta_id: r.cuenta_id === null ? null : n(r.cuenta_id),
        cripto_usado: s(r.cripto_usado),
        pesos_recibidos: s(r.pesos_recibidos),
        anulado: Boolean(r.anulado_en),
        carga_id: n(r.carga_id),
        notas: s(r.notas),
        lote: c ? s(c.lote) : null,
        // Sin carga (no debería pasar: lo cuida el trigger) o revertida: no cuenta.
        revertida: !c || c.estado === 'revertida',
        creado_en: c ? s(c.creado_en) : null,
      }
    }),
    leasing,
  }
})
