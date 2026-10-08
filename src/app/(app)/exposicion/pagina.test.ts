// Exposición sin datos, renderizada como la manda el servidor: un "sin dato"
// dice qué falta y lleva a la acción (visión §4.0), nunca un vacío sin
// explicación. Con hechos inventados, sin base.
import { createElement as h, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { Hechos } from '@/lib/domain/tipos'
import { armarExposicion } from '@/lib/vistas/armar'
import { hechosEjemplo, hechosVacios, HOY_EJEMPLO } from '@/lib/vistas/ejemplo'

let hechos: Hechos = hechosVacios()
vi.mock('next/link', () => ({
  default: (p: { href: string; children: unknown; className?: string }) => h('a', { href: p.href, className: p.className }, p.children as never),
}))
vi.mock('@/lib/vistas', () => ({ vistaExposicion: async (m: 'financiero' | 'total') => armarExposicion(hechos, HOY_EJEMPLO, m) }))

const texto = (html: string) => html.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

async function pagina(): Promise<string> {
  const { default: P } = await import('./page')
  return renderToStaticMarkup((await P({ searchParams: Promise.resolve({}) })) as ReactElement)
}

describe('Exposición sin datos', () => {
  it('sin ninguna carga: dice que aparece con la primera carga y lleva a Cargar; sin barras vacías', async () => {
    hechos = hechosVacios()
    const html = await pagina()
    expect(html).toMatch(/<a href="\/carga"[^>]*>[^<]*Hacer la primera carga/)
    const composicion = texto(html.slice(html.indexOf('id="composicion"'), html.indexOf('id="concentracion"')))
    expect(composicion).toContain('sin dato · aparece con tu primera carga')
    expect(html).not.toContain('role="img"')
  })

  it('con el leasing sin capital pendiente: lleva a Datos › Leasing', async () => {
    hechos = hechosEjemplo()
    hechos.pasivo_saldos = []
    const html = await pagina()
    expect(html).toMatch(/<a href="\/datos\/leasing"[^>]*>[^<]*capital pendiente/)
  })

  it('con todo cargado no aparece ninguno de los dos', async () => {
    hechos = hechosEjemplo()
    const html = await pagina()
    expect(html).not.toContain('Hacer la primera carga')
    expect(html).not.toContain('href="/datos/leasing"')
  })
})
