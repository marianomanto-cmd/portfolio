// Qué rutas quedan abiertas sin sesión y adónde se vuelve después de entrar
// (D-21). Funciones puras: las usa el proxy (src/proxy.ts) y la pantalla de
// entrada, y tienen tests.

/** Rutas que se sirven sin sesión: la entrada y los archivos estáticos. */
export function esRutaPublica(ruta: string): boolean {
  if (ruta === '/login' || ruta.startsWith('/login/')) return true
  if (ruta.startsWith('/_next/')) return true
  if (ruta === '/favicon.ico') return true
  // Íconos y manifiesto de la app (convenciones de metadata de Next).
  if (/^\/(icon|apple-icon)\d*(\.(png|jpe?g|svg|ico|webp))?$/.test(ruta)) return true
  if (ruta.startsWith('/icons/')) return true
  if (ruta === '/manifest.webmanifest' || ruta === '/manifest.json') return true
  return false
}

/**
 * Adónde volver después de entrar. Solo rutas internas: un `desde` que apunta
 * afuera ("//otro.sitio", "https://…", "/\\otro") vuelve a Hoy, para que el
 * link de entrada no sirva para redirigir a otro sitio.
 */
export function destinoSeguro(desde: string | null | undefined): string {
  if (!desde) return '/'
  const d = desde.trim()
  if (!d.startsWith('/')) return '/'
  if (d.startsWith('//') || d.startsWith('/\\')) return '/'
  if (/[\u0000-\u001f]/.test(d)) return '/'
  if (d === '/login' || d.startsWith('/login/') || d.startsWith('/login?')) return '/'
  return d
}

/** La URL de entrada que recuerda adónde ibas: /login?desde=/carga. */
export function urlDeEntrada(ruta: string, busqueda = ''): string {
  const desde = destinoSeguro(ruta + busqueda)
  return desde === '/' ? '/login' : `/login?desde=${encodeURIComponent(desde)}`
}
