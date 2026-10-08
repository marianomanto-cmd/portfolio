// Primera barrera de la clave simple (D-21). Toda ruta pide sesión salvo la
// entrada y los estáticos. Cada Server Action y Route Handler vuelve a
// verificarla con exigirSesion(): el proxy no es la única defensa.
//
// Además, en cada pedido:
// - un POST (o cualquier método que cambie algo) que no viene de una página
//   de este mismo sitio se rechaza con 403, antes de mirar la sesión (CSRF);
// - la respuesta lleva una Content-Security-Policy con un nonce nuevo, que
//   Next lee del pedido y les pone a sus scripts (src/app/layout.tsx se lo
//   pone al script del tema). Por eso todas las páginas se arman por pedido.
// Los demás encabezados de seguridad están en next.config.mjs.
//
// Next 16 corre el proxy en Node por defecto: sesion.ts usa Web Crypto, que
// existe ahí.

import { NextResponse, type NextRequest } from 'next/server'
import { esRutaPublica, urlDeEntrada } from '@/app/login/_lib/rutas'
import { metodoSeguro, mismoOrigen, nuevoNonce, politicaDeContenido } from '@/app/login/_lib/seguridad'
import { COOKIE_SESION, modoDemo, tokenValido } from '@/lib/server/sesion'

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (!metodoSeguro(request.method) && !mismoOrigen(request.headers)) {
    return NextResponse.json({ error: 'Pedido de otro sitio: rechazado.' }, { status: 403 })
  }

  if (modoDemo() || esRutaPublica(pathname) || (await tokenValido(request.cookies.get(COOKIE_SESION)?.value))) {
    return seguirConPolitica(request)
  }

  // Una página: a la entrada, recordando adónde ibas.
  if (request.method === 'GET' || request.method === 'HEAD') {
    return NextResponse.redirect(new URL(urlDeEntrada(pathname, search), request.url))
  }
  // Un POST (Server Action o Route Handler) no se redirige: se rechaza, y la
  // pantalla muestra el error.
  return NextResponse.json({ error: 'Sesión vencida: volvé a entrar.' }, { status: 401 })
}

function seguirConPolitica(request: NextRequest): NextResponse {
  const nonce = nuevoNonce()
  const politica = politicaDeContenido(nonce, process.env.NODE_ENV === 'development')
  const encabezados = new Headers(request.headers)
  encabezados.set('x-nonce', nonce)
  encabezados.set('content-security-policy', politica)
  const respuesta = NextResponse.next({ request: { headers: encabezados } })
  respuesta.headers.set('content-security-policy', politica)
  return respuesta
}

// El matcher solo saca lo obvio (los estáticos de Next); el resto lo decide
// esRutaPublica, que tiene tests. Un matcher más ambicioso podría dejar pasar
// sin clave una ruta que empiece parecido. Los prefetch de los links también
// pasan por acá: traen datos y piden sesión como cualquier página.
export const config = {
  matcher: ['/((?!_next/static/|_next/image|favicon\\.ico$).*)'],
}
