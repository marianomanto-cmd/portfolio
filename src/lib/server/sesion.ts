// Clave simple (D-21). Una sola persona: la contraseña está en APP_PASSWORD y
// la sesión es una cookie firmada con HMAC-SHA256 (Web Crypto: corre igual en
// el proxy y en Node). Se verifica en el proxy y otra vez en cada Server Action
// y Route Handler (D-57 de la visión): el proxy solo es una primera barrera.
//
// Claves (nada de esto se guarda en ningún lado; se deriva en cada instancia):
//   maestra = HMAC(SESSION_SECRET, APP_PASSWORD)          si hay SESSION_SECRET
//           = PBKDF2-SHA256(APP_PASSWORD, 210.000 vueltas) si no
//   sesión  = HMAC(maestra, "portfolio/sesion/v1")   → firma la cookie
//   lectura = HMAC(maestra, "portfolio/lectura/v1")  → firma las lecturas de Cargar
// Cada uso tiene su propia clave (separación de dominio): una firma de un
// lado nunca sirve del otro. Cambiar APP_PASSWORD o SESSION_SECRET cierra
// todas las sesiones abiertas. Sin SESSION_SECRET, PBKDF2 hace caro probar
// claves contra una cookie robada; con SESSION_SECRET (32 bytes al azar) no
// hay nada que probar.

export const COOKIE_SESION = 'sesion'
export const DURACION_SESION_MS = 30 * 24 * 60 * 60 * 1000
/** Tolerancia para relojes apenas distintos entre instancias. */
const DESFASE_MS = 5 * 60 * 1000
const VUELTAS_PBKDF2 = 210_000
/** Una clave más larga que esto no es un intento de buena fe. */
const LARGO_MAXIMO_CLAVE = 512

/**
 * Modo demo: datos de ejemplo y sin clave. Nunca en producción: si Vercel dice
 * que es producción, PORTFOLIO_DEMO no cuenta.
 */
export function modoDemo(): boolean {
  if (process.env.VERCEL_ENV === 'production' || process.env.VERCEL_TARGET_ENV === 'production') return false
  return process.env.PORTFOLIO_DEMO === '1'
}

// ───────────── Claves ─────────────

const texto = new TextEncoder()
type Proposito = 'sesion' | 'lectura'

async function hmac(clave: BufferSource, mensaje: BufferSource): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', clave, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', k, mensaje)
}

async function derivarMaestra(clave: string, secreto: string): Promise<ArrayBuffer> {
  if (secreto) return hmac(texto.encode(secreto), texto.encode(`portfolio/maestra/v1\u0000${clave}`))
  const base = await crypto.subtle.importKey('raw', texto.encode(clave), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: texto.encode('portfolio/sesion/v1'), iterations: VUELTAS_PBKDF2 },
    base,
    256,
  )
}

// La derivación cuesta (~0,1 s con PBKDF2): se hace una vez por instancia y
// por valor de las variables, y se rehace sola si cambian.
let cacheMaestra: { id: string; maestra: Promise<ArrayBuffer> } | null = null
const cacheClaves = new Map<string, Promise<ArrayBuffer>>()

/**
 * La clave de un propósito, en bytes (32), o null si falta APP_PASSWORD.
 * Para firmar con node:crypto: `createHmac('sha256', Buffer.from(bytes))`.
 */
export async function claveDerivada(proposito: Proposito): Promise<Uint8Array | null> {
  const clave = process.env.APP_PASSWORD
  if (!clave) return null
  const secreto = process.env.SESSION_SECRET ?? ''
  const id = `${secreto.length}:${secreto}\u0000${clave}`
  if (cacheMaestra?.id !== id) {
    cacheMaestra = { id, maestra: derivarMaestra(clave, secreto) }
    cacheClaves.clear()
  }
  let sub = cacheClaves.get(proposito)
  if (!sub) {
    sub = cacheMaestra.maestra.then((m) => hmac(m, texto.encode(`portfolio/${proposito}/v1`)))
    cacheClaves.set(proposito, sub)
  }
  try {
    // Una copia: quien la recibe no puede tocar la guardada.
    return new Uint8Array(await sub).slice()
  } catch (e) {
    // Una derivación que falló no queda guardada.
    cacheMaestra = null
    cacheClaves.clear()
    throw e
  }
}

// ───────────── Cookie de sesión ─────────────

function aBase64url(b: ArrayBuffer): string {
  let s = ''
  for (const x of new Uint8Array(b)) s += String.fromCharCode(x)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function deBase64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function claveSesion(usos: KeyUsage[]): Promise<CryptoKey | null> {
  const bytes = await claveDerivada('sesion')
  if (!bytes) return null
  return crypto.subtle.importKey('raw', new Uint8Array(bytes), { name: 'HMAC', hash: 'SHA-256' }, false, usos)
}

/** `vence.firma`: vence en ms desde 1970; firma = HMAC-SHA256 en base64url (43 caracteres). */
const FORMA_TOKEN = /^(\d{13,15})\.([A-Za-z0-9_-]{43})$/

export async function crearTokenSesion(ahora = Date.now()): Promise<string> {
  const k = await claveSesion(['sign'])
  if (!k) throw new Error('Falta APP_PASSWORD')
  const vence = String(ahora + DURACION_SESION_MS)
  return `${vence}.${aBase64url(await crypto.subtle.sign('HMAC', k, texto.encode(vence)))}`
}

export async function tokenValido(token: string | undefined | null, ahora = Date.now()): Promise<boolean> {
  if (typeof token !== 'string') return false
  const m = FORMA_TOKEN.exec(token)
  if (!m) return false
  const vence = Number(m[1])
  // Vencido, o con un vencimiento más lejano que el que esta versión emite.
  if (vence <= ahora || vence > ahora + DURACION_SESION_MS + DESFASE_MS) return false
  const k = await claveSesion(['verify'])
  if (!k) return false
  // verify compara en tiempo constante.
  return crypto.subtle.verify('HMAC', k, deBase64url(m[2]), texto.encode(m[1]))
}

// Clave al azar de esta instancia, solo para comparar dos textos en tiempo constante.
const claveComparacion = crypto.getRandomValues(new Uint8Array(32))

/** ¿Es la clave? Compara HMACs en tiempo constante: no filtra largo ni contenido por tiempos. */
export async function claveCorrecta(intento: string): Promise<boolean> {
  const clave = process.env.APP_PASSWORD
  if (!clave || typeof intento !== 'string' || intento.length === 0 || intento.length > LARGO_MAXIMO_CLAVE) return false
  const [a, b] = await Promise.all([hmac(claveComparacion, texto.encode(intento)), hmac(claveComparacion, texto.encode(clave))])
  const x = new Uint8Array(a)
  const y = new Uint8Array(b)
  let r = 0
  for (let i = 0; i < x.length; i++) r |= x[i] ^ y[i]
  return r === 0
}

/**
 * La cookie: solo el servidor la lee (httpOnly), solo viaja por HTTPS en
 * producción (Secure; en http://localhost el navegador la acepta igual), no
 * sale en pedidos de otros sitios salvo al abrir un link (SameSite=Lax) y
 * dura lo mismo que la firma.
 */
export const OPCIONES_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: DURACION_SESION_MS / 1000,
}

/** ¿Hay una sesión válida en este pedido? (o modo demo) */
export async function haySesion(): Promise<boolean> {
  if (modoDemo()) return true
  const { cookies } = await import('next/headers')
  return tokenValido((await cookies()).get(COOKIE_SESION)?.value)
}

/** Para Server Actions y Route Handlers: lanza si no hay sesión válida. */
export async function exigirSesion(): Promise<void> {
  if (!(await haySesion())) throw new Error('Sesión vencida: volvé a entrar.')
}
