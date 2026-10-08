// Primera barrera de la clave simple (D-21). Toda ruta pide sesión salvo la
// entrada y los estáticos. Cada Server Action y Route Handler vuelve a
// verificarla con exigirSesion(): el proxy no es la única defensa.
//
// Next 16 corre el proxy en Node por defecto: sesion.ts usa Web Crypto
// (crypto.subtle) y Buffer, que existen ahí.

import { NextResponse, type NextRequest } from 'next/server'
import { esRutaPublica, urlDeEntrada } from '@/app/login/_lib/rutas'
import { COOKIE_SESION, modoDemo, tokenValido } from '@/lib/server/sesion'

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  if (modoDemo() || esRutaPublica(pathname)) return NextResponse.next()

  const token = request.cookies.get(COOKIE_SESION)?.value
  if (await tokenValido(token)) return NextResponse.next()

  // Una página: a la entrada, recordando adónde ibas.
  if (request.method === 'GET' || request.method === 'HEAD') {
    return NextResponse.redirect(new URL(urlDeEntrada(pathname, search), request.url))
  }
  // Un POST (Server Action o Route Handler) no se redirige: se rechaza, y la
  // pantalla muestra el error.
  return NextResponse.json({ error: 'Sesión vencida: volvé a entrar.' }, { status: 401 })
}

// El matcher solo saca lo obvio (los estáticos de Next); el resto lo decide
// esRutaPublica, que tiene tests. Un matcher más ambicioso podría dejar pasar
// sin clave una ruta que empiece parecido.
export const config = {
  matcher: ['/((?!_next/static/|_next/image|favicon\\.ico$).*)'],
}
