// STUB — lo implementa el lector de IEB (ver docs/carga-diaria.md).
import type { LecturaCuenta } from './contratos'

/** Lee el Excel "Portafolio" exportado por IEB. Determinístico, sin IA. */
export async function leerExcelIEB(_datos: ArrayBuffer | Uint8Array): Promise<LecturaCuenta> {
  throw new Error('leerExcelIEB: no implementado')
}
