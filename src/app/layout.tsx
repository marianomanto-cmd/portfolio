import type { Metadata, Viewport } from 'next'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Portfolio', template: '%s · Portfolio' },
  description: 'Tu cartera en pesos y en dólares, con el desglose entre activo y tipo de cambio.',
  applicationName: 'Portfolio',
  // App privada de un solo usuario: que no la indexe nadie.
  robots: { index: false, follow: false },
  formatDetection: { telephone: false },
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23121722'/%3E%3Ctext x='16' y='22' text-anchor='middle' font-family='system-ui,sans-serif' font-size='17' font-weight='700' fill='%23f6f7f9'%3EP%3C/text%3E%3C/svg%3E",
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7f9' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1117' },
  ],
}

// Aplica tema, paleta, modo privado y barra lateral guardados ANTES de pintar,
// para que no parpadee. localStorage puede no existir o tirar (ventana privada,
// datos bloqueados): todo va en try/catch y sin preferencias se usa el sistema.
const PREFERENCIAS = `(function(){try{var d=document.documentElement,s=window.localStorage;var t=s.getItem('portfolio:tema');if(t==='claro')d.setAttribute('data-theme','light');else if(t==='oscuro')d.setAttribute('data-theme','dark');if(s.getItem('portfolio:paleta')==='daltonica')d.setAttribute('data-paleta','daltonica');if(s.getItem('portfolio:privado')==='1')d.setAttribute('data-privado','1');var n=s.getItem('portfolio:nav');if(n==='expandida'||n==='colapsada')d.setAttribute('data-nav',n);}catch(e){}})();`

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-AR" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFERENCIAS }} />
      </head>
      <body className="min-h-dvh bg-bg text-text antialiased">{children}</body>
    </html>
  )
}
