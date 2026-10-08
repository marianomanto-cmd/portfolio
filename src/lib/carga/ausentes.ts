// Tenencias que la fuente dejó de listar y el dueño dejó pendientes (venta
// total o vencimiento sin registrar): Hechos.ausentes. Las declara la última
// carga vigente de cada cuenta en lo grabado (grabado.ausentes, que arma
// src/app/(app)/carga/_lib/confirmacion.ts). Mientras sigan pendientes, el
// motor las vale "sin dato" en vez de seguir usando su último precio.
//
// Puro y con tests: la lectura de la base (hechos.ts) solo le pasa las filas.

import type { Activo, Ausente, CargaResumen, Fecha } from '@/lib/domain/tipos'

/** Una carga con el JSON de sus ausentes tal como vino de la base (grabado->ausentes). */
export interface CargaConAusentes {
  id: number
  fecha: Fecha
  cuenta_id: number | null
  estado: CargaResumen['estado']
  ausentes: unknown
}

const entero = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

/**
 * Por cuenta, la carga vigente más reciente (por fecha y, en el mismo día, la
 * última confirmada) y, de sus ausentes, las que no se registraron. El JSON se
 * valida campo por campo: lo que no tiene forma se ignora. Las ausentes
 * grabadas antes de que llevaran activo_id se resuelven por el ticker.
 */
export function ausentesVigentes(cargas: readonly CargaConAusentes[], activos: readonly Pick<Activo, 'id' | 'ticker'>[]): Ausente[] {
  const ultima = new Map<number, CargaConAusentes>()
  for (const c of cargas) {
    if (c.cuenta_id === null || c.estado !== 'vigente') continue
    const u = ultima.get(c.cuenta_id)
    if (!u || c.fecha > u.fecha || (c.fecha === u.fecha && c.id > u.id)) ultima.set(c.cuenta_id, c)
  }
  const porTicker = new Map(activos.map((a) => [a.ticker.toUpperCase(), a.id]))
  const ids = new Set(activos.map((a) => a.id))
  const out: Ausente[] = []
  for (const c of ultima.values()) {
    if (!Array.isArray(c.ausentes)) continue
    const vistos = new Set<number>()
    for (const x of c.ausentes) {
      if (x === null || typeof x !== 'object' || Array.isArray(x)) continue
      const r = x as Record<string, unknown>
      if (r.resolucion === 'registrada') continue
      const activo_id = entero(r.activo_id) ?? (typeof r.ticker === 'string' ? (porTicker.get(r.ticker.toUpperCase()) ?? null) : null)
      if (activo_id === null || !ids.has(activo_id) || vistos.has(activo_id)) continue
      vistos.add(activo_id)
      out.push({ cuenta_id: c.cuenta_id as number, activo_id, fecha: c.fecha, carga_id: c.id })
    }
  }
  return out.sort((a, b) => a.cuenta_id - b.cuenta_id || a.activo_id - b.activo_id)
}
