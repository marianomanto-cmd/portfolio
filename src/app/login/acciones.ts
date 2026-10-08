'use server'

// Entrar y salir (D-21). La clave vive en APP_PASSWORD; la sesión es una
// cookie firmada (src/lib/server/sesion.ts). `salir` es el único "Salir" de
// la app: lo usan Ajustes y cualquier otra pantalla que lo necesite.

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  COOKIE_SESION,
  OPCIONES_COOKIE,
  claveCorrecta,
  crearTokenSesion,
  modoDemo,
} from '@/lib/server/sesion'
import {
  DEMORA_FALLO_MS,
  anotarError,
  anotarExito,
  esperaPendiente,
  origenDelPedido,
  textoEspera,
  type Registro,
} from './_lib/intentos'
import { destinoSeguro } from './_lib/rutas'

export interface EstadoEntrada {
  error: string | null
}

// Errores recientes por origen, en la memoria de esta instancia (_lib/intentos.ts).
const registro: Registro = new Map()

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function entrar(_previo: EstadoEntrada, form: FormData): Promise<EstadoEntrada> {
  const desde = destinoSeguro(String(form.get('desde') ?? ''))
  if (modoDemo()) redirect(desde)
  if (!process.env.APP_PASSWORD) {
    return { error: 'Falta configurar APP_PASSWORD en Vercel.' }
  }
  const clave = String(form.get('clave') ?? '')
  if (clave === '') return { error: 'Escribí la clave.' }

  const origen = origenDelPedido(await headers())
  const espera = esperaPendiente(registro, origen, Date.now())
  if (espera > 0) {
    // Trabado: la clave ni se mira (si no, los intentos en paralelo pasarían).
    await dormir(DEMORA_FALLO_MS)
    return { error: `Demasiados intentos seguidos. ${textoEspera(espera)} y probá de nuevo.` }
  }

  if (!(await claveCorrecta(clave))) {
    const traba = anotarError(registro, origen, Date.now())
    await dormir(DEMORA_FALLO_MS)
    return {
      error: traba > 0 ? `Esa no es la clave. ${textoEspera(traba)} antes de probar otra vez.` : 'Esa no es la clave. Probá de nuevo.',
    }
  }

  anotarExito(registro, origen)
  const token = await crearTokenSesion()
  ;(await cookies()).set(COOKIE_SESION, token, OPCIONES_COOKIE)
  redirect(desde)
}

/** Cierra la sesión de este dispositivo: borra la cookie y vuelve a la entrada. */
export async function salir(): Promise<void> {
  ;(await cookies()).set(COOKIE_SESION, '', { ...OPCIONES_COOKIE, maxAge: 0 })
  redirect('/login')
}
