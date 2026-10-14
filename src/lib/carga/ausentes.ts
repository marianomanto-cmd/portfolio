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
 * última confirmada) y, de sus ausentes, las que no se registraron: toda
 * resolución distinta de 'registrada' ('pendiente' y 'sin revisar al guardar').
 * La fecha y la carga de cada una son las de la primera carga de su racha: si
 * la dejaste pendiente varios días seguidos, la del primero, así las fotos de
 * los días del medio tampoco la valúan al último precio (contarla dos veces).
 * El JSON se valida campo por campo: lo que no tiene forma se ignora. Las
 * ausentes grabadas antes de que llevaran activo_id se resuelven por el ticker.
 */
export function ausentesVigentes(cargas: readonly CargaConAusentes[], activos: readonly Pick<Activo, 'id' | 'ticker'>[]): Ausente[] {
  const porCuenta = new Map<number, CargaConAusentes[]>()
  for (const c of cargas) {
    if (c.cuenta_id === null || c.estado !== 'vigente') continue
    porCuenta.set(c.cuenta_id, [...(porCuenta.get(c.cuenta_id) ?? []), c])
  }
  const porTicker = new Map(activos.map((a) => [a.ticker.toUpperCase(), a.id]))
  const ids = new Set(activos.map((a) => a.id))
  const memo = new Map<number, number[]>()
  /** Los activos que una carga declara ausentes y sin registrar, en el orden en que los grabó. */
  const pendientesDe = (c: CargaConAusentes): number[] => {
    const hecho = memo.get(c.id)
    if (hecho) return hecho
    const out: number[] = []
    if (Array.isArray(c.ausentes)) {
      for (const x of c.ausentes) {
        if (x === null || typeof x !== 'object' || Array.isArray(x)) continue
        const r = x as Record<string, unknown>
        if (r.resolucion === 'registrada') continue
        const activo_id = entero(r.activo_id) ?? (typeof r.ticker === 'string' ? (porTicker.get(r.ticker.toUpperCase()) ?? null) : null)
        if (activo_id === null || !ids.has(activo_id) || out.includes(activo_id)) continue
        out.push(activo_id)
      }
    }
    memo.set(c.id, out)
    return out
  }
  const out: Ausente[] = []
  for (const [cuenta_id, lista] of porCuenta) {
    lista.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.id - b.id))
    const ultima = lista[lista.length - 1]
    for (const activo_id of pendientesDe(ultima)) {
      // Hacia atrás, mientras la carga anterior de la cuenta también la declare ausente y sin registrar.
      let desde = ultima
      for (let k = lista.length - 2; k >= 0 && pendientesDe(lista[k]).includes(activo_id); k--) desde = lista[k]
      out.push({ cuenta_id, activo_id, fecha: desde.fecha, carga_id: desde.id })
    }
  }
  return out.sort((a, b) => a.cuenta_id - b.cuenta_id || a.activo_id - b.activo_id)
}
