import { PANTALLAS_BASE } from './base'
import { PANTALLAS_EVOLUCION } from './evolucion'
import { PANTALLAS_FLUJO } from './flujo'
import { PANTALLAS_PASIVOS } from './pasivos'
import { PANTALLAS_PATRIMONIO } from './patrimonio'
import type { Pantalla } from './tipos'

export type { Pantalla } from './tipos'

const GRUPOS: Record<string, Pantalla[]> = {
  base: PANTALLAS_BASE,
  patrimonio: PANTALLAS_PATRIMONIO,
  evolucion: PANTALLAS_EVOLUCION,
  pasivos: PANTALLAS_PASIVOS,
  flujo: PANTALLAS_FLUJO,
}

/**
 * Las pantallas que recorre el test de layout. Todas, salvo que
 * E2E_PANTALLAS elija grupos ("pasivos" o "base,flujo"): sirve para probar una
 * pantalla mientras se construye. Antes de un deploy corren todas.
 */
export function pantallas(): Pantalla[] {
  const elegidos = (process.env.E2E_PANTALLAS ?? '')
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean)
  for (const g of elegidos) if (!GRUPOS[g]) throw new Error(`E2E_PANTALLAS: no existe el grupo "${g}" (hay: ${Object.keys(GRUPOS).join(', ')})`)
  const grupos = elegidos.length ? elegidos : Object.keys(GRUPOS)
  return grupos.flatMap((g) => GRUPOS[g])
}
