// La pantalla de error de la app (calidad.md §5) no sabe si el error vino de un
// guardado: no puede prometer que "nada se guardó". Manda al Registro.
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: (p: { href: string; children: unknown; className?: string }) => h('a', { href: p.href, className: p.className }, p.children as never),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }))

const { default: ErrorApp } = await import('./error')

describe('error.tsx', () => {
  it('no dice que nada se guardó: dice que no sabe y lleva al Registro', () => {
    const html = renderToStaticMarkup(h(ErrorApp, { error: Object.assign(new Error('se cortó'), { digest: 'abc' }), reset: () => {} }))
    expect(html).not.toContain('Nada se guardó')
    expect(html).toContain('no sé si se guardó: mirá el Registro antes de volver a intentar.')
    expect(html).toContain('href="/registro"')
  })
})
