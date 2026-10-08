// Encabezados de seguridad para toda respuesta (páginas, Server Actions, Route
// Handlers y estáticos). La Content-Security-Policy no va acá: lleva un nonce
// distinto por pedido y la arma el proxy (src/proxy.ts, D-21). Los valores
// están probados en src/app/login/_lib/seguridad.test.ts y en tests/e2e/auth.spec.ts.
export const ENCABEZADOS_SEGURIDAD = [
  // Nadie puede meter la app en un iframe (clickjacking). frame-ancestors
  // 'none' en la CSP dice lo mismo para los navegadores nuevos.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Los links a otros sitios no se llevan la ruta (ni el ?desde= de la entrada).
  { key: 'Referrer-Policy', value: 'same-origin' },
  // La app no usa cámara, micrófono, ubicación, pagos ni USB. Pegar capturas
  // y copiar una cifra no piden permiso: no se tocan.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  // Solo HTTPS por dos años. En http://localhost el navegador lo ignora.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // Otros sitios no pueden incrustar nada de acá (ni imágenes ni scripts).
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  // App privada: que ningún buscador la indexe (también la entrada y los estáticos).
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Carpeta de salida. NEXT_DIST_DIR permite levantar un segundo servidor
  // (o un build de prueba) sin pisar el `.next` de otro que ya corre:
  //   NEXT_DIST_DIR=.next-c npx next dev -p 3300
  // Sin la variable (Vercel, CI) es la de siempre. Las .next-*/ están en .gitignore.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // `next dev` escribe un bloque de reglas para agentes en CLAUDE.md y
  // AGENTS.md cuando detecta uno; CLAUDE.md es nuestro y no se toca.
  agentRules: false,
  // El indicador de Next tapaba la barra lateral en desarrollo.
  devIndicators: false,
  // Sin "X-Powered-By: Next.js".
  poweredByHeader: false,
  // exceljs y el SDK de Anthropic corren en Node (no Edge).
  serverExternalPackages: ['exceljs'],
  experimental: {
    // Las capturas y el Excel viajan en Server Actions (límite por defecto: 1 MB).
    serverActions: { bodySizeLimit: '8mb' },
  },
  async headers() {
    return [{ source: '/:path*', headers: ENCABEZADOS_SEGURIDAD }]
  },
}

export default nextConfig
