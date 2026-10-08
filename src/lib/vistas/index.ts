import 'server-only'
// Arma lo que muestra cada pantalla. En modo demo devuelve datos de ejemplo.
// STUB del modo real — lo implementa el motor.
import { modoDemo } from '@/lib/server/sesion'
import type { VistaCartera, VistaExposicion, VistaHoy, VistaRegistro } from './contratos'
import { ejemploCartera, ejemploExposicion, ejemploHoy, ejemploRegistro } from './ejemplo'

export async function vistaHoy(): Promise<VistaHoy> {
  if (modoDemo()) return ejemploHoy()
  throw new Error('vistaHoy: no implementado')
}
export async function vistaCartera(): Promise<VistaCartera> {
  if (modoDemo()) return ejemploCartera()
  throw new Error('vistaCartera: no implementado')
}
export async function vistaExposicion(modo: 'financiero' | 'total'): Promise<VistaExposicion> {
  if (modoDemo()) return ejemploExposicion(modo)
  throw new Error('vistaExposicion: no implementado')
}
export async function vistaRegistro(): Promise<VistaRegistro> {
  if (modoDemo()) return ejemploRegistro()
  throw new Error('vistaRegistro: no implementado')
}
