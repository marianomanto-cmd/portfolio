import 'server-only'

// Arma lo que muestra cada pantalla: lee los hechos de Supabase y llama a los
// armadores puros de ./armar. En modo demo devuelve datos de ejemplo.

import { hoyCordoba } from '@/lib/domain/fechas'
import { leerHechos } from '@/lib/server/hechos'
import { modoDemo } from '@/lib/server/sesion'
import { leerTodo } from '@/lib/server/supabase'
import { armarCartera, armarExposicion, armarHoy } from './armar'
import type { FilaRegistro, VistaCartera, VistaExposicion, VistaHoy, VistaRegistro } from './contratos'
import { ejemploCartera, ejemploExposicion, ejemploHoy, ejemploRegistro } from './ejemplo'

export async function vistaHoy(): Promise<VistaHoy> {
  if (modoDemo()) return ejemploHoy()
  return armarHoy(await leerHechos(), hoyCordoba())
}

export async function vistaCartera(): Promise<VistaCartera> {
  if (modoDemo()) return ejemploCartera()
  return armarCartera(await leerHechos(), hoyCordoba())
}

export async function vistaExposicion(modo: 'financiero' | 'total'): Promise<VistaExposicion> {
  if (modoDemo()) return ejemploExposicion(modo)
  return armarExposicion(await leerHechos(), hoyCordoba(), modo)
}

type Fila = Record<string, string | number | boolean | null>

export async function vistaRegistro(): Promise<VistaRegistro> {
  if (modoDemo()) return ejemploRegistro()
  const [cargas, cuentas, cot, sal, ops] = await Promise.all([
    leerTodo<Fila>(
      'cargas',
      'id,lote,fecha,cuenta_id,origen,archivo_path,estado,creado_en,lector,tiempo_activo_ms',
      ['id'],
    ),
    leerTodo<Fila>('cuentas', 'id,nombre', ['id']),
    leerTodo<Fila>('cotizaciones', 'carga_id,fecha,activo_id', ['fecha', 'activo_id']),
    leerTodo<Fila>('saldos_liquidez', 'carga_id,fecha,cuenta_id,moneda', ['fecha', 'cuenta_id', 'moneda']),
    leerTodo<Fila>('operaciones', 'carga_id,id', ['id']),
  ])
  const nombre = new Map(cuentas.map((c) => [Number(c.id), String(c.nombre)]))
  const contar = (filas: Fila[]) => {
    const m = new Map<number, number>()
    for (const f of filas) m.set(Number(f.carga_id), (m.get(Number(f.carga_id)) ?? 0) + 1)
    return m
  }
  const nCot = contar(cot)
  const nSal = contar(sal)
  const nOps = contar(ops)
  const filas: FilaRegistro[] = cargas
    .map((c) => ({
      carga_id: Number(c.id),
      lote: c.lote === null ? null : String(c.lote),
      fecha: String(c.fecha),
      creado_en: String(c.creado_en),
      cuenta: c.cuenta_id === null ? 'Tipo de cambio' : (nombre.get(Number(c.cuenta_id)) ?? `cuenta ${c.cuenta_id}`),
      origen: c.origen as FilaRegistro['origen'],
      estado: c.estado as FilaRegistro['estado'],
      archivo_path: c.archivo_path === null ? null : String(c.archivo_path),
      lector: c.lector === null ? null : String(c.lector),
      cotizaciones: nCot.get(Number(c.id)) ?? 0,
      saldos: nSal.get(Number(c.id)) ?? 0,
      operaciones: nOps.get(Number(c.id)) ?? 0,
      tiempo_activo_ms: c.tiempo_activo_ms === null ? null : Number(c.tiempo_activo_ms),
    }))
    .sort((a, b) => (a.creado_en < b.creado_en ? 1 : -1))
  return { filas }
}
