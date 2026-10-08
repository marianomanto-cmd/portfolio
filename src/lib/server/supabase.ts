import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

// Único punto de acceso a la base (D-20). Solo corre en el servidor: la clave
// secreta nunca llega al navegador, y el navegador nunca habla con Supabase.

export class FaltaConfiguracion extends Error {
  constructor(public variable: string) {
    super(`Falta la variable de entorno ${variable}`)
  }
}

let cliente: SupabaseClient<Database> | null = null

// La URL del proyecto no es secreta (D-02): queda fija, y SUPABASE_URL solo la pisa.
const URL_PROYECTO = 'https://zcgynhzddfjzwswekcvl.supabase.co'

export function supabase(): SupabaseClient<Database> {
  if (cliente) return cliente
  const url = process.env.SUPABASE_URL || URL_PROYECTO
  const clave = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) throw new FaltaConfiguracion('SUPABASE_SECRET_KEY')
  cliente = createClient<Database>(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-application-name': 'portfolio' } },
  })
  return cliente
}

export function configurado(): boolean {
  return Boolean(process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)
}

const PAGINA = 1000

/**
 * Lee una tabla o vista entera, paginando. PostgREST corta en 1.000 filas sin
 * avisar (docs/datos.md, regla 2): este helper pide el conteo exacto y falla si
 * llegan menos filas que las contadas.
 *
 * `columnas` tiene que castear a texto todo numeric (`precio::text`): el
 * parser de plata rechaza números (D-32).
 */
export async function leerTodo<T>(
  tabla: string,
  columnas: string,
  orden: string[],
  filtro?: (q: any) => any, // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<T[]> {
  const db = supabase()
  const filas: T[] = []
  let total: number | null = null
  for (let desde = 0; ; desde += PAGINA) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = db.from(tabla as never).select(columnas, { count: 'exact' })
    if (filtro) q = filtro(q)
    for (const o of orden) q = q.order(o, { ascending: true })
    const { data, error, count } = await q.range(desde, desde + PAGINA - 1)
    if (error) throw new Error(`Leyendo ${tabla}: ${error.message}`)
    if (total === null) total = count ?? 0
    filas.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGINA) break
  }
  if (total !== null && filas.length !== total) {
    throw new Error(`Leyendo ${tabla}: llegaron ${filas.length} filas de ${total}`)
  }
  return filas
}
