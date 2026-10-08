// Clave simple (D-21). Una sola persona: la contraseña está en APP_PASSWORD y
// la sesión es una cookie firmada con HMAC-SHA256 (Web Crypto, corre igual en
// el proxy y en Node). Se verifica en el proxy y otra vez en cada Server Action
// y Route Handler (D-57 de la visión): el proxy solo es una primera barrera.

export const COOKIE_SESION = 'sesion'
const DURACION_MS = 30 * 24 * 60 * 60 * 1000

/** Modo demo: datos de ejemplo y sin clave. Nunca en producción. */
export function modoDemo(): boolean {
  return process.env.PORTFOLIO_DEMO === '1' && process.env.VERCEL_ENV !== 'production'
}

function secreto(): string | null {
  return process.env.SESSION_SECRET || process.env.APP_PASSWORD || null
}

async function firmar(mensaje: string, clave: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(clave),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const firma = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(mensaje))
  return Buffer.from(firma).toString('base64url')
}

function igualesEnTiempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

export async function crearTokenSesion(ahora = Date.now()): Promise<string> {
  const s = secreto()
  if (!s) throw new Error('Falta APP_PASSWORD')
  const vence = String(ahora + DURACION_MS)
  return `${vence}.${await firmar(vence, s)}`
}

export async function tokenValido(token: string | undefined, ahora = Date.now()): Promise<boolean> {
  if (!token) return false
  const s = secreto()
  if (!s) return false
  const [vence, firma] = token.split('.')
  if (!vence || !firma || !/^\d+$/.test(vence)) return false
  if (Number(vence) < ahora) return false
  return igualesEnTiempoConstante(firma, await firmar(vence, s))
}

export async function claveCorrecta(intento: string): Promise<boolean> {
  const clave = process.env.APP_PASSWORD
  if (!clave) return false
  // Comparación de HMACs para no filtrar la longitud ni el contenido por tiempos.
  const s = 'comparacion-de-clave'
  return igualesEnTiempoConstante(await firmar(intento, s), await firmar(clave, s))
}

export const OPCIONES_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: DURACION_MS / 1000,
}

/** Para Server Actions y Route Handlers: lanza si no hay sesión válida. */
export async function exigirSesion(): Promise<void> {
  if (modoDemo()) return
  const { cookies } = await import('next/headers')
  const token = (await cookies()).get(COOKIE_SESION)?.value
  if (!(await tokenValido(token))) throw new Error('Sesión vencida: volvé a entrar.')
}
