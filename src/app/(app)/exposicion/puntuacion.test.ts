// Exposición, la frase del neto (en "El detalle: tu exposición"): cada cifra
// es un botón, y la puntuación que la rodea va pegada a ella (sin corte de
// renglón). Antes, a 390 px quedaban un "(" al final de un renglón y un ";" al
// principio del siguiente. Datos del ejemplo (D-24).
import { createElement as h, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { armarBalance } from '@/lib/vistas/armar-balance'
import { armarExposicionPantalla } from '@/lib/vistas/armar-exposicion'
import { hechosEjemplo, HOY_EJEMPLO } from '@/lib/vistas/ejemplo'

vi.mock('next/link', () => ({
  default: (p: { href: string; children: unknown; className?: string }) => h('a', { href: p.href, className: p.className }, p.children as never),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined }) }))
vi.mock('@/lib/vistas', () => ({ vistaExposicion: async (m: 'financiero' | 'total') => armarExposicionPantalla(hechosEjemplo(), HOY_EJEMPLO, m) }))
vi.mock('@/lib/vistas/balance', () => ({ vistaBalance: async (p: object) => armarBalance(hechosEjemplo(), HOY_EJEMPLO, p) }))

const texto = (html: string) => html.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

describe('Exposición: la puntuación de la frase del neto va pegada a su cifra', () => {
  it('"(" y ";" quedan dentro de un bloque sin corte, con la cifra', async () => {
    const { default: P } = await import('./page')
    const html = renderToStaticMarkup((await P({ searchParams: Promise.resolve({}) })) as ReactElement)
    const i = html.indexOf('Estás ')
    const frase = html.slice(i, html.indexOf('</p>', i))
    // Cada bloque sin corte, como texto plano.
    const bloques = [...frase.matchAll(/<span class="whitespace-nowrap">((?:(?!<span class="whitespace-nowrap">)[\s\S])*?)<\/span>(?=\s|[a-zñ]|$)/g)].map((m) => texto(m[1]))
    expect(bloques.some((b) => /^\( ?\$ [\d.,]+ M ?,$/.test(b))).toBe(true)
    expect(bloques.some((b) => /^\( ?\$ [\d.,]+ M ?\)\.$/.test(b))).toBe(true)
    expect(bloques.some((b) => /^US\$ [\d.]+ ?;$/.test(b))).toBe(true)
    // El texto se lee igual que antes.
    expect(texto(frase)).toMatch(/tus pesos financieros \( ?\$ [\d.,]+ M ?, US\$ [\d.]+ ?\) superan lo que debés del leasing/)
  })
})
