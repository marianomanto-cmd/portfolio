import 'server-only'
// STUB — lo implementa el lector de capturas (Galicia, Mercado Pago).
import type { LecturaCuenta, NombreCuenta } from './contratos'

/** Lee una captura de pantalla con Claude (visión), con doble lectura y chequeo aritmético. */
export async function leerCaptura(
  _imagen: { bytes: Uint8Array; tipo: string },
  _opciones: { pista?: NombreCuenta } = {},
): Promise<LecturaCuenta> {
  throw new Error('leerCaptura: no implementado')
}
