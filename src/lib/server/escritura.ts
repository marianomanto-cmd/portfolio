import 'server-only'
// STUB — lo implementa la capa de escritura (funciones de Postgres confirmar_carga,
// revertir_lote y altas manuales). Todo pasa por funciones de la base para que
// cada carga sea una sola transacción (docs/datos.md, regla 3).
import type { ActivoNuevo, ConfirmacionCarga, ResultadoConfirmacion } from '@/lib/carga/contratos'

export async function confirmarCarga(_c: ConfirmacionCarga): Promise<ResultadoConfirmacion> {
  throw new Error('confirmarCarga: no implementado')
}
export async function revertirLote(_lote: string, _motivo: string): Promise<void> {
  throw new Error('revertirLote: no implementado')
}
export async function crearActivo(_a: ActivoNuevo & { ratio?: string | null; color?: string | null }): Promise<number> {
  throw new Error('crearActivo: no implementado')
}
/** Sube un archivo de carga al bucket privado. Devuelve la ruta y su sha256. */
export async function subirArchivo(_bytes: Uint8Array, _tipo: string, _nombre: string): Promise<{ path: string; sha256: string }> {
  throw new Error('subirArchivo: no implementado')
}
