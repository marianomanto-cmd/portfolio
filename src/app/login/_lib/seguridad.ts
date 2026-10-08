// Lo que el proxy (src/proxy.ts) agrega a cada pedido, como funciones puras
// con tests: la Content-Security-Policy con su nonce y el control de origen
// de los pedidos que cambian algo (CSRF).

/**
 * Content-Security-Policy con nonce (D-21). Solo corren los scripts que traen
 * el nonce de este pedido (Next se lo pone a los suyos y el layout al script
 * del tema) y los que esos cargan ('strict-dynamic'). Los estilos en línea
 * quedan permitidos: React escribe atributos style y un nonce no los cubre.
 * Nada se conecta, carga ni envía fuera de este mismo sitio: el navegador
 * nunca habla con Supabase ni con Anthropic. En desarrollo React necesita
 * eval para reconstruir las pilas de error del servidor.
 */
export function politicaDeContenido(nonce: string, desarrollo: boolean): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${desarrollo ? ` 'unsafe-eval'` : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `media-src 'self' blob:`,
    `worker-src 'self' blob:`,
    `manifest-src 'self'`,
    `object-src 'none'`,
    `base-uri 'none'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ].join('; ')
}

/** Un nonce nuevo por pedido: 128 bits al azar, en base64. */
export function nuevoNonce(): string {
  const b = crypto.getRandomValues(new Uint8Array(16))
  let s = ''
  for (const x of b) s += String.fromCharCode(x)
  return btoa(s)
}

const SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** GET, HEAD y OPTIONS no cambian nada. */
export function metodoSeguro(metodo: string): boolean {
  return SEGUROS.has(metodo.toUpperCase())
}

interface Encabezados {
  get(nombre: string): string | null
}

/**
 * ¿El pedido viene de una página de este mismo sitio? Para los que cambian
 * algo (POST de Server Actions y de /carga/leer). Next ya controla el Origin
 * de las Server Actions; esto lo hace para todo, Route Handlers incluidos.
 *
 * - Sec-Fetch-Site (lo mandan los navegadores actuales): "same-origin" o
 *   "none" (algo que tipeaste vos) pasan; "same-site" y "cross-site" no.
 * - Origin, si viene, tiene que ser este mismo host (x-forwarded-host, que
 *   pone Vercel, o host). "null" no pasa.
 * - Sin ninguno de los dos no es un navegador (curl, un script): no hay a
 *   quién engañar, y igual tiene que traer la cookie de sesión.
 */
export function mismoOrigen(h: Encabezados): boolean {
  const sitio = h.get('sec-fetch-site')
  if (sitio && sitio !== 'same-origin' && sitio !== 'none') return false
  const origen = h.get('origin')
  if (origen === null) return true
  let host: string
  try {
    const u = new URL(origen)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    host = u.host
  } catch {
    return false
  }
  const propio = (h.get('x-forwarded-host') ?? h.get('host') ?? '').split(',')[0].trim()
  return propio !== '' && host.toLowerCase() === propio.toLowerCase()
}
