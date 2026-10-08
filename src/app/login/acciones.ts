'use server'

// Entrar y salir (D-21). La clave vive en APP_PASSWORD; la sesión es una
// cookie firmada (src/lib/server/sesion.ts).

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  COOKIE_SESION,
  OPCIONES_COOKIE,
  claveCorrecta,
  crearTokenSesion,
  modoDemo,
} from '@/lib/server/sesion'
import { destinoSeguro } from './_lib/rutas'

export interface EstadoEntrada {
  error: string | null
}

/** Demora ante una clave equivocada: frena los intentos al voleo sin molestarte a vos. */
const DEMORA_MS = 800

export async function entrar(_previo: EstadoEntrada, form: FormData): Promise<EstadoEntrada> {
  const desde = destinoSeguro(String(form.get('desde') ?? ''))
  if (modoDemo()) redirect(desde)
  if (!process.env.APP_PASSWORD) {
    return { error: 'Falta configurar APP_PASSWORD en Vercel.' }
  }
  const clave = String(form.get('clave') ?? '')
  if (clave === '') return { error: 'Escribí la clave.' }
  if (!(await claveCorrecta(clave))) {
    await new Promise((r) => setTimeout(r, DEMORA_MS))
    return { error: 'Esa no es la clave. Probá de nuevo.' }
  }
  const token = await crearTokenSesion()
  ;(await cookies()).set(COOKIE_SESION, token, OPCIONES_COOKIE)
  redirect(desde)
}

/** Cierra la sesión: borra la cookie y vuelve a la entrada. */
export async function salir(): Promise<void> {
  ;(await cookies()).set(COOKIE_SESION, '', { ...OPCIONES_COOKIE, maxAge: 0 })
  redirect('/login')
}
