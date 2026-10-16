// Evolución renderizada como la manda el servidor, en cada estado del modo demo
// (números inventados): un h1, ningún "sin dato" que diga 0, cada cifra con su
// traza, el estado de un solo día útil (nunca en blanco) y ningún texto que
// valore o recomiende.
import { createElement as h, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { armarEvolucion } from '@/lib/vistas/armar-evolucion'
import { hechosEjemplo, HOY_EJEMPLO } from '@/lib/vistas/ejemplo'
import { ejemploEvolucion, type DemoEvolucion } from '@/lib/vistas/ejemplo-evolucion'
import { PantallaEvolucion } from './_componentes/pantalla'
import { leerParametros } from './_lib/parametros'

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: () => undefined }) }))

vi.mock('next/link', () => ({
  default: (p: { href: string; children: unknown; className?: string }) => h('a', { href: p.href, className: p.className }, p.children as never),
}))

const texto = (html: string) => html.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

function pagina(demo: DemoEvolucion | null, sp: Record<string, string> = {}): string {
  const v = ejemploEvolucion(leerParametros(sp), demo)
  return renderToStaticMarkup(PantallaEvolucion({ v, demo }) as ReactElement)
}

/** El texto de cada elemento marcado data-sin-dato (hasta su cierre, sin anidar). */
function sinDatos(html: string): string[] {
  const out: string[] = []
  const re = /<span data-cifra="" data-sin-dato=""[^>]*>([\s\S]*?)<\/button>/g
  for (const m of html.matchAll(re)) out.push(texto(m[1]))
  return out
}

describe('Evolución y PnL (modo demo)', () => {
  for (const demo of ['vacio', 'un-dia', 'semana', 'mes', null] as const) {
    it(`${demo ?? 'por defecto'}: un h1, ningún "sin dato" en cero y ninguna valoración`, () => {
      const html = pagina(demo)
      expect(html.match(/<h1[ >]/g)).toHaveLength(1)
      for (const t of sinDatos(html)) {
        expect(t).toContain('sin dato')
        expect(t).not.toMatch(/\$\s?0([,.]0+)?\b/)
      }
      expect(texto(html)).not.toMatch(/\b(mejor|conviene|deberías)\b/i)
    })
  }

  it('sin cargas: dice que arranca con la primera carga y lleva a Cargar', () => {
    const html = pagina('vacio')
    expect(html).toMatch(/<a href="\/carga"/)
    expect(texto(html)).toContain('Todavía no hay cargas')
  })

  it('un solo día: el punto de partida, lo que ya traías, la sensibilidad y el puente "sin dato · necesita una segunda carga"', () => {
    const html = pagina('un-dia')
    expect(sinDatos(html).length).toBeGreaterThan(5)
    const t = texto(html)
    expect(t).toContain('Tu historia empieza el jue 01/10')
    expect(t).toContain('Lo que ya traías al día cero')
    expect(t).toContain('Si mañana el CCL sube 1%')
    expect(t).toContain('Necesita una segunda carga')
    expect(t).toContain('Falta el CCL de compra de YPFD')
    // El flujo del mes en curso ya se ve: ingresos declarados (chip) y el costo del leasing.
    expect(t).toContain('Costo del leasing devengado')
    expect(t).toContain('declarado')
    expect(t).toContain('Armá tu primer escenario en Flujo y escenarios')
  })

  it('un mes: el puente con las cuotas pagadas desde tus cuentas, realizado y no realizado, PnL por mes y el futuro con su chip', () => {
    const html = pagina('mes')
    const t = texto(html)
    expect(t).toContain('Cuotas del leasing pagadas desde tus cuentas')
    expect(t).toContain('Cuadre ✓')
    expect(t).toContain('Realizado')
    expect(t).toContain('No realizado')
    expect(t).toContain('PnL por mes')
    expect(t).toContain('Ajustar supuestos')
    expect(t).toContain('supuesto')
    // La cuota 14 venció el 17/09, antes del día cero: no tiene nada que ver con este período y no se avisa (revisión 15/10).
    expect(t).not.toMatch(/cuota 14/)
    expect(html).toContain('data-tarjeta="SPY"')
    // La tabla es la Grilla (AG Grid): en el servidor se arma su lugar; las filas las dibuja el navegador.
    expect(html).toContain('data-grilla="Resultado del período por partida')
  })

  it('vista Total: amortización de la deuda, revaluación de bienes y el dólar sobre la deuda', () => {
    const t = texto(pagina('mes', { vista: 'total' }))
    expect(t).toContain('Amortización de la deuda')
    expect(t).toContain('de lo cual: revaluación de bienes')
    expect(t).toContain('de lo cual: el dólar sobre tus bienes')
    expect(t).toContain('de lo cual: el dólar sobre la deuda en pesos')
  })

  it('moneda en dólares: las cifras van en dólares', () => {
    const html = pagina('mes', { moneda: 'usd' })
    const resultados = html.slice(html.indexOf('id="resultados"'))
    expect(resultados).toContain('US$')
  })

  // ───────────── Revisión adversaria (15/10) ─────────────

  /** El HTML de la sección (tarjeta) con ese aria-labelledby o aria-label, hasta su cierre. */
  const seccion = (html: string, attr: string) => {
    const i = html.indexOf(attr)
    expect(i, attr).toBeGreaterThan(-1)
    const ini = html.lastIndexOf('<section', i)
    let d = 0
    const re = /<(\/?)section\b[^>]*>/g
    re.lastIndex = ini
    for (let m = re.exec(html); m; m = re.exec(html)) {
      d += m[1] ? -1 : 1
      if (d === 0) return html.slice(ini, m.index + m[0].length)
    }
    return html.slice(ini)
  }
  /** El <li> que contiene ese texto. */
  const renglon = (html: string, que: string) => {
    const i = html.indexOf(que)
    expect(i, que).toBeGreaterThan(-1)
    return html.slice(html.lastIndexOf('<li', i), html.indexOf('</li>', i) + 5)
  }

  it('vista Total con la deuda del leasing estimada (como producción): la cifra grande del día cero lleva el chip "estimado"', () => {
    const html = pagina('un-dia', { vista: 'total' })
    expect(texto(seccion(html, 'aria-label="Tu punto de partida"'))).toContain('estimado')
    // Y el gráfico del patrimonio dice que la curva lleva ese estimado.
    expect(texto(seccion(html, 'aria-labelledby="tiempo"'))).toContain('estimado')
    // En Financiero no hay deuda: ningún chip "estimado" en el encabezado.
    expect(texto(seccion(pagina('un-dia'), 'aria-label="Tu punto de partida"'))).not.toContain('estimado')
  })

  it('la fila del leasing en Resultados (vista Total, deuda estimada) lleva el chip "estimado"; las de títulos, no', () => {
    // Los hechos de ejemplo de la app (01/10 al 14/10) con la deuda del leasing estimada, como producción.
    const h = hechosEjemplo()
    h.pasivo_saldos = h.pasivo_saldos.map((x) => ({ ...x, naturaleza: 'estimado' as const, fuente: 'inventada' }))
    const v = armarEvolucion(h, HOY_EJEMPLO, leerParametros({ vista: 'total' }))
    const deuda = v.filas.find((f) => f.clase === 'pasivo')!
    expect(deuda).toBeDefined()
    const html = renderToStaticMarkup(PantallaEvolucion({ v, demo: null }) as ReactElement)
    const tarjeta = (ticker: string) => {
      const i = html.indexOf(`data-tarjeta="${ticker}"`)
      expect(i, ticker).toBeGreaterThan(-1)
      return texto(html.slice(i, html.indexOf('</li>', i)))
    }
    expect(tarjeta(deuda.ticker)).toContain('estimado')
    expect(tarjeta('SPY')).not.toContain('estimado')
  })

  it('el IVA y la percepción del leasing muestran su rótulo y también su etiqueta "a confirmar" (no una en lugar de la otra)', () => {
    const html = pagina('un-dia', { vista: 'total' })
    for (const que of ['IVA de la cuota', 'Percepción de IVA']) {
      const t = texto(renglon(html, que))
      expect(t, que).toContain('crédito fiscal de la sociedad')
      expect(t, que).toContain('a confirmar')
    }
    // El interés implícito: "estimado" una sola vez (rótulo y etiqueta dicen lo mismo).
    expect(texto(renglon(html, 'Interés implícito')).match(/estimado/g)).toHaveLength(1)
  })

  it('las partes del costo del leasing no llevan "+": son partes de algo que se resta', () => {
    const html = pagina('un-dia', { vista: 'total' })
    for (const que of ['Interés implícito', 'IVA de la cuota', 'Seguro']) expect(texto(renglon(html, que)), que).not.toMatch(/\+\s?(US)?\$/)
  })

  it('la sensibilidad no dice "baja −US$" (doble negación) y lo que arriesga dólares va en dólares', () => {
    const t = texto(seccion(pagina('un-dia'), 'aria-labelledby="sensibilidad"'))
    expect(t).not.toMatch(/baja\s*[−-]/)
    expect(t).not.toMatch(/sube\s*\+/)
    expect(t).toMatch(/por tus US\$ [\d.]+,\d\d en activos en dólares/)
    expect(t).toMatch(/por tus \$ [\d.]+ en pesos/)
  })

  it('el futuro: cada mes proyectado lleva su chip "supuesto", no solo el título', () => {
    const html = seccion(pagina('mes'), 'aria-labelledby="futuro"')
    const meses = (html.match(/data-mes-futuro=/g) ?? []).length
    expect(meses).toBe(12)
    const chips = (texto(html).match(/\bsupuesto\b/g) ?? []).length
    // Uno por mes (en las tarjetas; la Grilla las dibuja en el navegador con su chip en la celda del mes), y el del título.
    expect(chips).toBeGreaterThanOrEqual(12 + 1)
  })

  // ───────────── Rediseño (15/10, D-159) ─────────────

  it('la anatomía del diseño: la pregunta, la lectura (h1), qué mirás, el período, las cuatro cifras y los dos gráficos', () => {
    const html = pagina('mes')
    const t = texto(html)
    expect(t).toContain('Resultados · ¿Gané o perdí, y por qué?')
    for (const x of ['1M', '3M', 'YTD', '12M', 'Inicio', 'Otro período', 'Resultado en pesos', 'Resultado en dólares', 'De tus activos', 'Del tipo de cambio', 'Composición en dólares · área apilada', 'Resultado en pesos · activo vs. TC', 'El detalle: tu PnL'])
      expect(t, x).toContain(x)
    // El período elegido está marcado en la pastilla (el demo "mes" es 1M).
    expect(html).toMatch(/bg-surface-3 text-text">1M</)
  })

  it('la semana y "Elegir fechas" siguen al alcance, en "Otro período"', () => {
    const t = texto(pagina('mes'))
    expect(t).toContain('La última semana')
    expect(t).toContain('Elegir fechas')
  })
})

