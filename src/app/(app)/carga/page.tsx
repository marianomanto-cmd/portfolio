import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { urlDeEntrada } from '@/app/login/_lib/rutas'
import { exigirSesion } from '@/lib/server/sesion'
import { contextoCarga } from './_lib/servidor'
import { PantallaCarga } from './_componentes/pantalla-carga'

export const metadata: Metadata = { title: 'Cargar' }

// Leer una captura con Claude y confirmar una carga pueden tardar.
export const maxDuration = 60

export default async function PaginaCarga() {
  // El proxy ya pidió la sesión; esto es la segunda barrera (D-21).
  try {
    await exigirSesion()
  } catch {
    redirect(urlDeEntrada('/carga'))
  }
  const contexto = await contextoCarga()
  return <PantallaCarga contexto={contexto} />
}
