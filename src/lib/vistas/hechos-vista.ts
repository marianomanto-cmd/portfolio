import 'server-only'

// Los hechos que leen las pantallas: los de la base (leerHechos) con la deuda
// según el cuadro de marcha de Pasivos (conDeudaSegunCuadro), para que el motor
// use la misma deuda que Balance, Pasivos y Flujo (D-131, revisión de la
// entrega 4). Cargar y Datos siguen leyendo los hechos de la base, sin ella.
// cache(): una sola lectura por pedido, como leerHechos y leerPasivos.

import { cache } from 'react'
import type { Hechos } from '@/lib/domain/tipos'
import { leerHechos } from '@/lib/server/hechos'
import { leerPasivos } from '@/lib/server/hechos-pasivos'
import { conDeudaSegunCuadro } from './integracion-pasivos'

export const leerHechosVista: () => Promise<Hechos> = cache(async () => {
  const [h, hp] = await Promise.all([leerHechos(), leerPasivos()])
  return conDeudaSegunCuadro(h, hp)
})
