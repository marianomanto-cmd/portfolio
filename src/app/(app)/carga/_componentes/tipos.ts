import type { NombreCuenta } from '@/lib/carga/contratos'
import type { ClaseArchivo, RespuestaLectura } from '../_lib/fuentes'

/** Un archivo soltado o pegado, y su lectura. */
export interface FuenteCarga {
  id: string
  nombre: string
  clase: ClaseArchivo
  /** null en el ejemplo del modo demo (no hay archivo). */
  archivo: File | null
  agregada: number
  estado: 'leyendo' | 'leida' | 'error'
  cuenta: NombreCuenta | null
  respuesta: Extract<RespuestaLectura, { ok: true }> | null
  error: string | null
}
