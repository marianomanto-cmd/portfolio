// Exposición (con el balance adentro, D-156) renderizada como la manda el
// servidor: un "sin dato" dice qué falta y lleva a la acción (visión §4.0),
// nunca un vacío sin explicación. Con hechos inventados, sin base.
import { createElement as h, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { Hechos } from '@/lib/domain/tipos'
import { armarBalance } from '@/lib/vistas/armar-balance'
import { armarExposicionPantalla } from '@/lib/vistas/armar-exposicion'
import { hechosEjemplo, hechosVacios, HOY_EJEMPLO } from '@/lib/vistas/ejemplo'

let hechos: Hechos = hechosVacios()
vi.mock('next/link', () => ({
  default: (p: { href: string; children: unknown; className?: string }) => h('a', { href: p.href, className: p.className }, p.children as never),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined }) }))
vi.mock('@/lib/vistas', () => ({ vistaExposicion: async (m: 'financiero' | 'total') => armarExposicionPantalla(hechos, HOY_EJEMPLO, m) }))
vi.mock('@/lib/vistas/balance', () => ({ vistaBalance: async (p: object) => armarBalance(hechos, HOY_EJEMPLO, p) }))

const texto = (html: string) => html.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

async function pagina(sp: Record<string, string> = {}): Promise<string> {
  const { default: P } = await import('./page')
  return renderToStaticMarkup((await P({ searchParams: Promise.resolve(sp) })) as ReactElement)
}

/** El HTML de la tarjeta de la frase del detalle (aria-label "Tu exposición al peso"). */
const frase = (html: string) => {
  const i = html.indexOf('aria-label="Tu exposición al peso"')
  expect(i).toBeGreaterThan(-1)
  return html.slice(i, html.indexOf('</section>', i))
}

describe('Exposición sin datos', () => {
  it('sin ninguna carga: dice que aparece con la primera carga y lleva a Cargar; sin barras vacías', async () => {
    hechos = hechosVacios()
    const html = await pagina()
    expect(html).toMatch(/<a href="\/carga"[^>]*>[^<]*Hacer la primera carga/)
    const i = html.indexOf('id="composicion"')
    expect(texto(html.slice(i, i + 800))).toContain('sin dato · aparece con tu primera carga')
    expect(html).not.toContain('role="img"')
    // La lectura lo dice con palabras, sin "sin dato" ni ceros.
    expect(texto(html.slice(html.indexOf('<h1'), html.indexOf('</h1>')))).toBe('Todavía no hay cargas: tu exposición aparece con la primera.')
  })

  it('con el leasing sin capital pendiente: lleva a Datos › Leasing', async () => {
    hechos = hechosEjemplo()
    hechos.pasivo_saldos = []
    const html = await pagina()
    expect(frase(html)).toMatch(/<a href="\/datos\/leasing"[^>]*>[^<]*capital pendiente/)
  })

  it('con todo cargado no aparece ninguno de los dos', async () => {
    hechos = hechosEjemplo()
    const html = await pagina()
    expect(html).not.toContain('Hacer la primera carga')
    expect(frase(html)).not.toContain('href="/datos/leasing"')
  })
})

describe('Exposición con el balance adentro (D-156)', () => {
  it('un solo h1 (la lectura), el gráfico de largo y corto, la apertura, el detalle y el balance', async () => {
    hechos = hechosEjemplo()
    const html = await pagina()
    expect(html.match(/<h1[ >]/g)).toHaveLength(1)
    const t = texto(html)
    expect(t).toContain('Patrimonio · ¿Cuánto estoy jugado al peso?')
    expect(t).toMatch(/estás largo en pesos por \$ [\d.]+\./)
    for (const x of ['Largo y corto · en pesos de hoy', 'Activos en pesos', 'Pasivos en pesos', 'Neto en pesos', 'Activos en dólares', 'Apertura de activos', 'Top 1', 'Top 3', 'El detalle: tu exposición', 'El detalle: tu balance', 'Estado de situación patrimonial'])
      expect(t, x).toContain(x)
    // Al imprimir sale solo el balance: lo de arriba no se imprime.
    expect(html).toContain('data-imprimible="balance"')
  })

  it('cambiar qué netea conserva lo que eligió el balance (fecha y agrupamiento)', async () => {
    hechos = hechosEjemplo()
    const html = await pagina({ fecha: '2026-10-08', agrupar: 'clase' })
    expect(html).toContain('href="/exposicion?vista=total&amp;fecha=2026-10-08&amp;agrupar=clase"')
    expect(texto(html)).toContain('Balance al jue 08/10/2026')
  })
})
