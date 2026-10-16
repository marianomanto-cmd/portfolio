// Pasivos renderizada como la manda el servidor (rediseño del 15/10, D-162):
// la anatomía del handoff en su orden (la pregunta, la lectura, la tira con
// las cuatro cifras, la cuota en pesos y en dólares y las próximas) y, abajo,
// el detalle de siempre, sin perder nada. Con el ejemplo inventado del demo
// (D-24), sin base.
import { createElement as h, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ejemploPasivos, variantePasivos } from '@/lib/vistas/ejemplo-pasivos'

vi.mock('next/link', () => ({
  default: (p: { href: string; children: unknown; className?: string }) => h('a', { href: p.href, className: p.className }, p.children as never),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined, refresh: () => undefined }) }))
vi.mock('@/lib/vistas/pasivos', () => ({ vistaPasivos: async (demo?: unknown) => ejemploPasivos(variantePasivos(demo)) }))
vi.mock('./acciones', () => ({ guardarDatoPasivo: async () => ({ ok: true, mensaje: '' }) }))

const texto = (html: string) => html.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

async function pagina(demo?: string): Promise<string> {
  const { default: P } = await import('./page')
  return renderToStaticMarkup((await P({ searchParams: Promise.resolve(demo ? { demo } : {}) })) as ReactElement)
}

/** Dónde aparece cada cosa en la página; -1 si no está. */
const posiciones = (html: string, marcas: string[]) => marcas.map((m) => html.indexOf(m))

describe('Pasivos: la anatomía del diseño, en su orden', () => {
  it('pregunta → lectura → tira y cuatro cifras → la cuota y las próximas → el detalle', async () => {
    const html = await pagina()
    const orden = posiciones(html, [
      '>Compromisos · ¿Cuánto me falta pagar?</p>',
      '<h1',
      'data-tira=',
      'data-cifra-pasivo="saldo"',
      'data-cifra-pasivo="pagado"',
      'data-cifra-pasivo="falta"',
      'data-cifra-pasivo="opcion"',
      '>La cuota en pesos y en dólares</h2>',
      '>Cuadro de marcha · próximas</h2>',
      'El detalle: tu leasing',
      'La deuda, con su origen',
      'Tasa implícita del contrato',
      'Costo total contra el bien',
      '>Cuadro de marcha</span>',
      'Cada cuota, abierta',
      '>Totales</span>',
      'Recupero fiscal y dólar',
      'El leasing en palabras',
      'El contrato y quién paga',
    ])
    expect(orden.every((i) => i > -1), JSON.stringify(orden)).toBe(true)
    expect([...orden].sort((a, b) => a - b)).toEqual(orden)
    // La lectura es el único h1.
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(texto(html.slice(html.indexOf('<h1'), html.indexOf('</h1>')))).toBe('Pagaste 14 de 35 cuotas. Te faltan 21 , hasta el 1 de julio de 2028.')
  })

  it('la tira: una celda por cuota del contrato (35, nunca un número fijo), con la próxima en sangría', async () => {
    const html = await pagina()
    const tira = html.slice(html.indexOf('data-tira='), html.indexOf('data-cifra-pasivo="saldo"'))
    expect(tira.match(/data-estado="/g)).toHaveLength(35)
    expect(tira.match(/data-estado="pagada"/g)).toHaveLength(14)
    expect(tira.match(/data-estado="proxima"/g)).toHaveLength(1)
    expect(tira).toContain('bg-accent shadow-[var(--glow-accent)]')
    expect(texto(html)).toContain('Leasing de la camioneta · 35 cuotas')
    expect(texto(html)).toContain('Próxima: cuota 15 · 1 de noviembre')
  })

  it('las cuatro cifras, cada una en pesos y en dólares con su traza; el saldo, en sangría clara', async () => {
    const html = await pagina()
    for (const c of ['saldo', 'pagado', 'falta', 'opcion']) {
      const i = html.indexOf(`data-cifra-pasivo="${c}"`)
      const bloque = html.slice(i, html.indexOf('</div>', html.indexOf('</dd>', i)))
      // Dos cifras tocables (pesos y dólares), cada una con su panel de traza.
      expect(bloque.match(/aria-controls=/g)?.length, c).toBe(2)
    }
    const saldo = html.slice(html.indexOf('data-cifra-pasivo="saldo"'), html.indexOf('data-cifra-pasivo="pagado"'))
    expect(saldo).toContain('text-accent-glow')
    expect(texto(saldo)).toContain('estimado')
    expect(texto(saldo)).toContain('Según el cuadro de marcha, al 14/10/2026. Al CCL de hoy.')
  })

  it('el cuadro de marcha de las próximas y el de todas las cuotas van en la Grilla (en el servidor, sus tarjetas)', async () => {
    const html = await pagina()
    expect(html).toContain('data-grilla="Las próximas cuotas, en pesos y en dólares"')
    expect(html).toContain('data-grilla="Cuadro de marcha del leasing: la factura de cada cuota"')
    expect(html).toContain('data-grilla="Lo pagado y lo que falta, abiertos en sus partes"')
  })

  it('"sin dato" con su motivo, nunca $ 0,00, en cada estado del demo con datos que faltan', async () => {
    // (En "completo" hay un cargo extra pagado y ninguno por venir: "lo que falta" de cargos es un cero real.)
    for (const demo of ['cuadro', 'sin-tasa', 'sin-cuadro']) {
      const t = texto(await pagina(demo))
      expect(t, demo).not.toMatch(/\$\s?0,00(?!\d)/)
      expect(t, demo).toContain('sin dato')
    }
  })
})

describe('Pasivos sin cuadro y sin pasivo', () => {
  it('sin cuadro: la tira punteada lo dice, el gráfico y las próximas llevan a importarlo, y el detalle mantiene la deuda y el contrato', async () => {
    const html = await pagina('sin-cuadro')
    const t = texto(html)
    expect(t).toContain('Todavía no importaste el cuadro de marcha: las 35 cuotas van punteadas')
    expect(html.match(/href="\/datos\/leasing#cuadro-de-marcha"/g)?.length).toBeGreaterThanOrEqual(2)
    for (const r of ['La deuda, con su origen', 'El contrato y quién paga']) expect(t).toContain(r)
    expect(t).not.toContain('Cada cuota, abierta')
  })

  it('sin ningún pasivo: la lectura lo dice y lleva a Datos › Leasing', async () => {
    const html = await pagina('sin-pasivo')
    expect(texto(html.slice(html.indexOf('<h1'), html.indexOf('</h1>')))).toContain('Todavía no cargaste ningún pasivo')
    expect(html).toMatch(/<a href="\/datos\/leasing"[^>]*>[^<]*Ir a Datos › Leasing/)
    expect(html).not.toContain('data-tira=')
  })
})
