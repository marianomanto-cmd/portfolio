import 'server-only'

import { redirect } from 'next/navigation'
import { urlDeEntrada } from '@/app/login/_lib/rutas'
import { exigirSesion } from '@/lib/server/sesion'
import { Aviso } from '../../carga/_componentes/ui'
import { leerDatos, type DatosPantalla } from './servidor'

/** Sesión (segunda barrera, D-21) y datos de la subpantalla. */
export async function datosDe(ruta: string): Promise<DatosPantalla> {
  try {
    await exigirSesion()
  } catch {
    redirect(urlDeEntrada(ruta))
  }
  return leerDatos()
}

export function AvisoDatos({ datos }: { datos: DatosPantalla }) {
  if (!datos.aviso) return null
  return <Aviso tono={datos.modo === 'error' ? 'error' : datos.modo === 'sin_base' ? 'aviso' : 'neutro'}>{datos.aviso}</Aviso>
}
