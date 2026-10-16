// La dirección de cada vista de Exposición: qué netea (?vista=total) y, desde
// que el balance vive acá (D-156), la fecha, el agrupamiento y la comparación
// del balance. Todo vive en la URL (se puede guardar como favorito); en modo
// demo, también el estado (?demo=…). Cambiar una cosa conserva las demás.

export interface ParametrosExposicion {
  /** 'total' se escribe; 'financiero' es el de por defecto. */
  vista?: string | null
  fecha?: string | null
  /** La última fecha de carga: no hace falta escribirla. */
  ultima?: string | null
  agrupar?: string | null
  /** La fecha del comparativo… */
  comparar?: string | null
  /** …que no se escribe si es la de por defecto (la primera carga). */
  primera?: string | null
  demo?: string | null
}

export function rutaExposicion(p: ParametrosExposicion): string {
  const q = new URLSearchParams()
  if (p.vista === 'total') q.set('vista', 'total')
  if (p.fecha && p.fecha !== p.ultima) q.set('fecha', p.fecha)
  if (p.agrupar && p.agrupar !== 'cuenta') q.set('agrupar', p.agrupar)
  if (p.comparar && p.comparar !== p.primera) q.set('comparar', p.comparar)
  if (p.demo) q.set('demo', p.demo)
  const s = q.toString()
  return s ? `/exposicion?${s}` : '/exposicion'
}

/** Un parámetro de búsqueda como texto (el primero, si vino repetido). */
export function unParametro(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v ?? null
}

/** Lo que el balance pidió por la dirección, para que el selector Financiero · Total lo conserve. */
export function delBalance(sp: Record<string, string | string[] | undefined>): Pick<ParametrosExposicion, 'fecha' | 'agrupar' | 'comparar' | 'demo'> {
  return { fecha: unParametro(sp.fecha), agrupar: unParametro(sp.agrupar), comparar: unParametro(sp.comparar), demo: unParametro(sp.demo) }
}
