'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { COOKIE_SESION, modoDemo } from '@/lib/server/sesion'

/** Cierra la sesión de este dispositivo y vuelve a pedir la clave. */
export async function cerrarSesion(): Promise<void> {
  if (!modoDemo()) (await cookies()).delete(COOKIE_SESION)
  redirect('/login')
}
