import 'server-only'

// Arma la vista de Pasivos: los hechos de siempre (CCL, deuda informada o
// estimada, el bien y su valuación) más el cuadro de marcha (leerPasivos). En
// modo demo, el ejemplo inventado del estado pedido (?demo=).

import { hoyCordoba } from '@/lib/domain/fechas'
import { leerPasivos } from '@/lib/server/hechos-pasivos'
import { modoDemo } from '@/lib/server/sesion'
import { armarPasivos } from './armar-pasivos'
import type { VistaPasivos } from './contratos-pasivos'
import { ejemploPasivos, variantePasivos } from './ejemplo-pasivos'
import { leerHechosVista } from './hechos-vista'

export async function vistaPasivos(demo?: unknown): Promise<VistaPasivos> {
  if (modoDemo()) return ejemploPasivos(variantePasivos(demo))
  const [h, hp] = await Promise.all([leerHechosVista(), leerPasivos()])
  return armarPasivos(h, hp, hoyCordoba())
}
