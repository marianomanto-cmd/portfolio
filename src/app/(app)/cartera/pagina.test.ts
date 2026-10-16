// Posiciones renderizada como la manda el servidor, en el modo demo (números
// inventados, D-24): la pregunta, la lectura (el único h1), las cuatro cifras
// clave con su traza y, debajo, la tabla. Lo que falta, "sin dato" con la
// suma parcial a la vista (D-65), nunca cero.
import { createElement as h, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: (p: { href: string; children: unknown; className?: string }) => h('a', { href: p.href, className: p.className }, p.children as never),
}))
vi.mock('@/lib/server/sesion', () => ({ modoDemo: () => true }))

const texto = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

async function pagina(sp: Record<string, string> = {}): Promise<string> {
  const { default: Pagina } = await import('./page')
  return renderToStaticMarkup((await Pagina({ searchParams: Promise.resolve(sp) })) as ReactElement)
}

describe('Posiciones (modo demo)', () => {
  it('la pregunta y la lectura: el único h1, con un solo énfasis', async () => {
    const html = await pagina()
    expect(texto(html)).toContain('Patrimonio · ¿Qué tengo y cómo le va a cada cosa?')
    const h1 = [...html.matchAll(/<h1[^>]*>(.*?)<\/h1>/g)]
    expect(h1).toHaveLength(1)
    expect(texto(h1[0][1])).toBe('Seis posiciones. SPY explica casi tres cuartos de lo que ganaste en pesos.')
    expect([...h1[0][1].matchAll(/<em>/g)]).toHaveLength(1)
  })

  it('las cuatro cifras clave, cada una en pesos y en dólares y con su traza', async () => {
    const t = texto(await pagina())
    expect(t).toContain('Valor de la cartera $ 104.271.540 US$ 67.350')
    // Al resultado en dólares le faltan filas: "sin dato" y la suma parcial, rotulada.
    expect(t).toContain('Resultado total +$ 8.533.500 sin dato En dólares, suma parcial (3 de 6): +US$ 1.630')
    expect(t).toContain('Mejor · SPY +16,6% +6,8% USD')
    expect(t).toContain('Peor en dólares · T30J7 +2,4% −3,5% USD')
  })

  it('cada cifra clave abre su traza', async () => {
    const html = await pagina()
    const i = html.indexOf('Valor de la cartera')
    const cifras = html.slice(i, html.indexOf('posiciones y 3 saldos', i))
    // Valor (2), resultado (2 + la suma parcial), mejor (2) y peor (2).
    expect([...cifras.matchAll(/<button[^>]*aria-controls/g)].length).toBe(9)
  })

  it('sin posiciones (día cero): lo dice, sin cifras inventadas', async () => {
    const html = await pagina({ demo: 'vacio' })
    const t = texto(html)
    expect(t).toContain('Todavía no tenés posiciones : aparecen con tu primera carga.')
    expect(html).toContain('href="/carga"')
    expect(t).not.toMatch(/\$ 0\b/)
  })
})
