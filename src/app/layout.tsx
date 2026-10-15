import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { headers } from 'next/headers'
import type { ReactNode } from 'react'
import { jetbrainsMono, newsreader } from './fuentes'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Portfolio', template: '%s · Portfolio' },
  description: 'Tu cartera en pesos y en dólares, con el desglose entre activo y tipo de cambio.',
  applicationName: 'Portfolio',
  // App privada de un solo usuario: que no la indexe nadie.
  robots: { index: false, follow: false },
  formatDetection: { telephone: false },
  // El logo del sistema (D-157): un círculo casi negro con el borde sangría.
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cdefs%3E%3CradialGradient id='g' cx='50%25' cy='40%25' r='60%25'%3E%3Cstop offset='0' stop-color='%232a0f1c'/%3E%3Cstop offset='.7' stop-color='%230b0810'/%3E%3C/radialGradient%3E%3C/defs%3E%3Ccircle cx='16' cy='16' r='13' fill='url(%23g)' stroke='%23f23a5e' stroke-width='2.5'/%3E%3C/svg%3E",
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // El oscuro es el tema por defecto (D-157); el claro se elige en Ajustes.
  colorScheme: 'dark light',
  themeColor: '#0a0810',
}

// Aplica tema, paleta, modo privado y barra lateral guardados ANTES de pintar,
// para que no parpadee. localStorage puede no existir o tirar (ventana privada,
// datos bloqueados): todo va en try/catch y sin preferencias queda el oscuro,
// el tema por defecto (D-157). "sistema" sigue al sistema (data-theme="system").
// La Content-Security-Policy solo deja correr scripts con el nonce del pedido
// (src/proxy.ts): este lo lleva. Leer el nonce hace que toda página se arme
// por pedido, que es lo que la política necesita.
const PREFERENCIAS = `(function(){try{var d=document.documentElement,s=window.localStorage;var t=s.getItem('portfolio:tema');if(t==='claro')d.setAttribute('data-theme','light');else if(t==='oscuro')d.setAttribute('data-theme','dark');else if(t==='sistema')d.setAttribute('data-theme','system');if(s.getItem('portfolio:paleta')==='daltonica')d.setAttribute('data-paleta','daltonica');if(s.getItem('portfolio:privado')==='1')d.setAttribute('data-privado','1');var n=s.getItem('portfolio:nav');if(n==='expandida'||n==='colapsada')d.setAttribute('data-nav',n);}catch(e){}})();`

export default async function RootLayout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined
  return (
    <html lang="es-AR" suppressHydrationWarning className={`${GeistSans.variable} ${jetbrainsMono.variable} ${newsreader.variable}`}>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: PREFERENCIAS }} />
      </head>
      <body className="min-h-dvh bg-bg text-text antialiased">{children}</body>
    </html>
  )
}
