// PLACEHOLDER — lo reemplaza la persona que construye las pantallas con datos de
// ejemplo inventados (docs/vision.md, Apéndice B) para el modo demo y los tests
// de layout. Nunca datos reales (D-24).
import type { VistaCartera, VistaExposicion, VistaHoy, VistaRegistro } from './contratos'

export function ejemploHoy(): VistaHoy {
  throw new Error('ejemploHoy: no implementado')
}
export function ejemploCartera(): VistaCartera {
  throw new Error('ejemploCartera: no implementado')
}
export function ejemploExposicion(_modo: 'financiero' | 'total'): VistaExposicion {
  throw new Error('ejemploExposicion: no implementado')
}
export function ejemploRegistro(): VistaRegistro {
  throw new Error('ejemploRegistro: no implementado')
}
