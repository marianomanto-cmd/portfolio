import localFont from 'next/font/local'

// Las fuentes del sistema visual (D-157), servidas desde la propia app: el
// build no depende de la red y la CSP (font-src 'self') no se toca. Los
// archivos vienen de los paquetes @fontsource-variable, en versión exacta.
//
// - Newsreader (serif, con eje de tamaño óptico): solo la lectura de cada
//   pantalla. La itálica es el énfasis.
// - JetBrains Mono: toda cifra, los rótulos y los eyebrows (--font-mono).
// - Geist (la interfaz) sigue saliendo del paquete `geist` (layout.tsx).
//
// Solo el subconjunto latino: alcanza para el castellano (á, ñ, ¿, ¡), el
// signo menos (U+2212), "·", "›" y el espacio fino de las duraciones.

export const newsreader = localFont({
  src: [
    { path: '../../node_modules/@fontsource-variable/newsreader/files/newsreader-latin-opsz-normal.woff2', style: 'normal', weight: '200 800' },
    { path: '../../node_modules/@fontsource-variable/newsreader/files/newsreader-latin-opsz-italic.woff2', style: 'italic', weight: '200 800' },
  ],
  variable: '--font-newsreader',
  display: 'swap',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
})

export const jetbrainsMono = localFont({
  src: [{ path: '../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2', style: 'normal', weight: '100 800' }],
  variable: '--font-jetbrains',
  display: 'swap',
  fallback: ['ui-monospace', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
})
