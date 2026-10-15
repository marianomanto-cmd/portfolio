// La dirección de cada vista del Balance: la fecha y el agrupamiento viven en
// la URL (se pueden guardar como favorito); en modo demo, también el estado.

export interface ParametrosBalance {
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

export function rutaBalance(p: ParametrosBalance): string {
  const q = new URLSearchParams()
  if (p.fecha && p.fecha !== p.ultima) q.set('fecha', p.fecha)
  if (p.agrupar && p.agrupar !== 'cuenta') q.set('agrupar', p.agrupar)
  if (p.comparar && p.comparar !== p.primera) q.set('comparar', p.comparar)
  if (p.demo) q.set('demo', p.demo)
  const s = q.toString()
  return s ? `/patrimonio?${s}` : '/patrimonio'
}

/** Un parámetro de búsqueda como texto (el primero, si vino repetido). */
export function unParametro(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v ?? null
}
