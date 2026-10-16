// Hoy, renderizada como la manda el servidor (sin navegador): lo que el dueño
// ve antes de tocar nada. Con hechos inventados (los del ejemplo, D-24), sin
// base: lo que se lee de la base (Flujo, Pasivos, la historia) sale del
// ejemplo, y el reloj se fija en el día del ejemplo.
import { createElement as h, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Hechos } from '@/lib/domain/tipos'
import { armarHoy } from '@/lib/vistas/armar'
import type { VistaHoy } from '@/lib/vistas/contratos'
import { hechosEjemplo, hechosVacios, HOY_EJEMPLO } from '@/lib/vistas/ejemplo'

let hechos: Hechos = hechosEjemplo()
let demo = false
let ajustar: (v: VistaHoy) => VistaHoy = (v) => v
vi.mock('next/link', () => ({
  default: (p: { href: string; children: unknown; className?: string }) => h('a', { href: p.href, className: p.className }, p.children as never),
}))
vi.mock('@/lib/server/sesion', () => ({ modoDemo: () => demo }))
vi.mock('@/components/shell/datos', () => ({ hoyDelPedido: async () => ajustar(armarHoy(hechos, HOY_EJEMPLO)) }))
// Lo que Hoy lee aparte de su vista (contexto-hoy.ts): Flujo del ejemplo, sin Pasivos legibles, y la historia de los mismos hechos.
vi.mock('@/lib/vistas/flujo', async () => {
  const { ejemploFlujo } = await import('@/lib/vistas/ejemplo-flujo')
  return { vistaFlujo: async () => ejemploFlujo('completo') }
})
vi.mock('@/lib/server/hechos', () => ({ leerHechos: async () => Promise.reject(new Error('sin base en el test')) }))
vi.mock('@/lib/server/hechos-pasivos', () => ({ leerPasivos: async () => Promise.reject(new Error('sin base en el test')) }))
vi.mock('@/lib/vistas/hechos-vista', () => ({ leerHechosVista: async () => hechos }))

/** El reloj, en el día del ejemplo (después del cierre de BYMA, salvo que el test diga otra cosa). */
const hora = (hhmm: string) => vi.setSystemTime(new Date(`${HOY_EJEMPLO}T${hhmm}:00-03:00`))
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  hora('19:00')
})
afterEach(() => {
  vi.useRealTimers()
  hechos = hechosEjemplo()
  ajustar = (v) => v
  demo = false
})

const texto = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

/** El HTML de la tarjeta con ese aria-label (hasta la próxima sección). */
function tarjeta(html: string, etiqueta: string): string {
  const i = html.indexOf(`aria-label="${etiqueta}"`)
  if (i < 0) return ''
  const fin = html.indexOf('<section', i + 1)
  return html.slice(i, fin < 0 ? undefined : fin)
}

async function pagina(sp: Record<string, string> = {}): Promise<string> {
  const { default: PaginaHoy } = await import('@/app/(app)/page')
  const el = (await PaginaHoy({ searchParams: Promise.resolve(sp) })) as ReactElement
  return renderToStaticMarkup(el)
}

describe('Hoy · la anatomía del rediseño (D-157): pregunta, lectura, cifras clave, gráfico y detalle', () => {
  it('las cuatro filas del handoff y el detalle, en orden', async () => {
    const html = await pagina()
    const regiones = [...html.matchAll(/<section[^>]*aria-label="([^"]+)"/g)].map((m) => m[1])
    expect(regiones).toEqual([
      'Cómo estás hoy',
      'Patrimonio neto',
      'Patrimonio neto y financiero',
      'El día y el mes',
      'Variación del día',
      'Exposición neta al peso',
      'Excedente invertible',
      'Lo que pasó y lo que viene',
      'Patrimonio neto en el tiempo',
      'Próximos 30 días',
      'Qué tenés y qué debés',
      'Qué pasó desde la última carga',
    ])
  })

  it('la pregunta lleva la fecha; la lectura es el único h1 y cada cifra abre su traza', async () => {
    const html = await pagina()
    expect(texto(html)).toContain('Jueves 15 de octubre · ¿Cómo estoy hoy?')
    const h1 = [...html.matchAll(/<h1[^>]*>(.*?)<\/h1>/g)]
    expect(h1).toHaveLength(1)
    expect(texto(h1[0][1])).toBe('Ayer sumaste $ 590.125 , pero perdiste US$ 340 : subió el dólar .')
    expect([...h1[0][1].matchAll(/<button[^>]*aria-controls/g)]).toHaveLength(2)
    expect(h1[0][1]).toContain('<em>dólar</em>')
  })

  it('el patrimonio neto, en pesos y en dólares, con su variación y de qué está hecho (D-158)', async () => {
    const t = texto(tarjeta(await pagina(), 'Patrimonio neto'))
    expect(t).toContain('$ 430.511.540')
    expect(t).toContain('US$ 278.072')
    expect(t).toMatch(/Financiero \$ 104\.271\.540 US\$ 67\.350 Bienes \$ 347\.640\.000 US\$ 224\.545 Pasivos −\$ 21\.400\.000 −US\$ 13\.823/)
  })

  it('la variación del día: lo que pusieron tus activos y el CCL, con cuánto se movió', async () => {
    const t = texto(tarjeta(await pagina(), 'Variación del día'))
    expect(t).toContain('De tus activos +$ 57.313 +US$ 37')
    expect(t).toContain('Del CCL ( +1,08% ) +$ 532.812 −US$ 377')
  })

  it('la exposición neta al peso: el neto, lo que netea (D-101) y sus dos partes', async () => {
    const t = texto(tarjeta(await pagina(), 'Exposición neta al peso'))
    expect(t).toContain('$ 32.783.100 US$ 21.175')
    expect(t).toMatch(/pesos financieros − deuda del leasing \( \$ [\d,]+ M − \$ 21,4 M \)/)
    expect(t).toContain('estás largo en pesos')
  })

  it('el excedente del mes, con sus partes y lo que es proyectado', async () => {
    const html = tarjeta(await pagina(), 'Excedente invertible')
    expect(texto(html)).toMatch(/> Excedente invertible · octubre \$ [\d.]+ US\$ [\d.]+ /)
    expect(texto(html)).toContain('Gastos fijos · cuota · lo que sobra.')
    expect(html).toContain('href="/flujo"')
  })

  it('el patrimonio neto en el tiempo: desde cuándo hay historia y cuánto cambió en cada moneda', async () => {
    const html = tarjeta(await pagina(), 'Patrimonio neto en el tiempo')
    const t = texto(html)
    expect(t).toContain('Patrimonio neto · desde el jue 01/10')
    expect(t).toContain('En dólares −0,41% En pesos +2,98%')
    // El pie, de corrido; cada cifra (las dos variaciones y el CCL de las dos puntas) abre su traza.
    const i = html.indexOf('En pesos tu patrimonio neto')
    const pie = html.slice(i, html.indexOf('</p>', i))
    expect(pie.replace(/<[^>]+>/g, '')).toBe('En pesos tu patrimonio neto subió 3,0%; en dólares, bajó 0,4%. La diferencia es el CCL, que pasó de 1.497,30 a 1.548,20.')
    expect([...pie.matchAll(/<button[^>]*aria-controls/g)]).toHaveLength(4)
  })

  it('Próximos 30 días: la carga que falta, la cuota, el cierre del mes y lo que cobrás; abajo, Atención', async () => {
    const html = tarjeta(await pagina(), 'Próximos 30 días')
    const t = texto(html)
    const orden = ['Todavía no cargaste hoy', 'Cuota 14 del leasing', 'Cierre del mes', 'Vence S13N6', 'Atención'].map((x) => t.indexOf(x))
    expect(orden.every((i) => i >= 0)).toBe(true)
    expect([...orden].sort((a, b) => a - b)).toEqual(orden)
    expect(t).toContain('La pagás vos $ 1.339.200 US$ 865')
    expect(t).toContain('En 29 días · cobrás $ 12.702.900 US$ 8.205')
    expect(html).toContain('href="/flujo/cargar?sentido=ingreso"')
    expect(html).toContain('href="/flujo/cargar?sentido=gasto"')
    const v = armarHoy(hechos, HOY_EJEMPLO)
    expect(t).toContain(`Atención · ${v.atencion.length} pendientes de datos`)
  })

  it('qué tenés y qué debés: activos, pasivos y el neto, a la misma escala', async () => {
    const html = tarjeta(await pagina(), 'Qué tenés y qué debés')
    const t = texto(html)
    // Los tickers van adentro de cada tramo (se ven si entran enteros); los montos, a la derecha.
    expect(t).toMatch(/Activos SPY YPFD S13N6 T30J7 FIMA TXMJ0 LIQ CASA CAMIONETA \$ 451\.911\.540 US\$ 291\.895/)
    expect(html).toMatch(/<span class="hidden @min-\[68px\]:inline">CAMIONETA<\/span>/)
    expect(t).toContain('Pasivos LEASING −$ 21.400.000 −US$ 13.823')
    expect(t).toContain('Neto $ 430.511.540 US$ 278.072')
    expect(html).toMatch(/role="img" aria-label="Activos: SPDR S&amp;P 500 \(CEDEAR\) 9,6%, YPF 3,5%/)
    expect(html).toContain('aria-label="Pasivos: Leasing de la camioneta 4,7%"')
    expect(html).toContain('aria-label="Neto: 95,3% del activo"')
  })
})

describe('Hoy: un total al que le falta una parte (D-65)', () => {
  it('dice "sin dato", con el motivo, y debajo la suma parcial en pesos y en dólares', async () => {
    hechos = hechosEjemplo()
    hechos.valuaciones = hechos.valuaciones.filter((v) => v.bien_id !== 2) // la camioneta, dada de alta sin valuación
    const v = armarHoy(hechos, HOY_EJEMPLO)
    expect(v.total.valor.ars.valor).toBeNull()
    const html = tarjeta(await pagina(), 'Patrimonio neto')
    const t = texto(html)
    expect(t).toContain('sin dato')
    expect(t).toContain('suma parcial (11 de 12): $ 392.511.540')
    expect(t).toContain('US$ 253.528')
    // El "sin dato" del total lleva su motivo.
    expect(html).toContain(`title="${v.total.valor.ars.motivo}"`)
  })

  it('con todo cargado no aparece ninguna suma parcial', async () => {
    const t = texto(tarjeta(await pagina(), 'Patrimonio neto'))
    expect(t).not.toContain('suma parcial')
  })
})

describe('Hoy en el teléfono: la hoja de la frase tiene cada cifra en su renglón tocable (D-113)', () => {
  it('carga express: las cifras de la segunda oración también, con su nombre', async () => {
    demo = true
    const html = await pagina({ demo: 'express' })
    const i = html.indexOf('aria-label="La frase del día, cifra por cifra"')
    expect(i).toBeGreaterThan(-1)
    const hoja = html.slice(i, html.indexOf('</dialog>', i))
    const filas = [...hoja.matchAll(/<li[^>]*>(.*?)<\/li>/g)].map((m) => m[1])
    const fila = (etiqueta: string) => filas.find((f) => texto(f).startsWith(etiqueta)) ?? ''
    for (const [etiqueta, cifra] of [
      ['De SPY', '−US$ 213'],
      ['De tus posiciones en pesos', '−US$ 242'],
      ['De tus pesos en efectivo', '−US$ 23'],
    ]) {
      const f = fila(etiqueta)
      expect(texto(f), etiqueta).toContain(cifra)
      // La cifra es un botón que abre su traza.
      expect(f, etiqueta).toMatch(new RegExp(`<button[^>]*aria-controls[^>]*>(?:(?!</button>).)*${cifra.replace('$', '\\$')}`))
    }
  })
})

describe('Hoy · el cuadre dice por cuánto cierra o no cierra (D-66)', () => {
  const cuadre = (html: string) => {
    const i = html.indexOf('Cuadre ')
    return html.slice(html.lastIndexOf('<p', i), html.indexOf('</p>', i))
  }
  const calc = (valor: string) => ({ valor, formula: valor, insumos: [], etiquetas: [] })
  // Todo en línea: sin tags, sin espacios agregados.
  const plano = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

  it('si cierra: "cierra (diferencia $ 0,00 · US$ 0,00)", cada cifra con su traza', async () => {
    ajustar = (v) => ({ ...v, cuadre: { ars_ok: true, usd_ok: true, detalle: 'Cierra en las dos monedas.', diferencia: { ars: calc('0'), usd: calc('0') } } })
    const p = cuadre(await pagina())
    expect(plano(p)).toBe('Cuadre ✓ cierra (diferencia $ 0,00 · US$ 0,00). Cierra en las dos monedas.')
    expect([...p.matchAll(/<button[^>]*aria-controls/g)]).toHaveLength(2)
  })

  it('si no cierra: "no cierra por" el monto, con signo, en pesos y en dólares', async () => {
    ajustar = (v) => ({ ...v, cuadre: { ars_ok: false, usd_ok: true, detalle: 'Revisar.', diferencia: { ars: calc('1050000'), usd: calc('0') } } })
    expect(plano(cuadre(await pagina()))).toBe('Cuadre ≠ no cierra por +$ 1.050.000,00 · US$ 0,00. Revisar.')
  })

  it('sin diferencia (no verificable) no inventa un cero: solo el detalle', async () => {
    ajustar = (v) => ({ ...v, cuadre: { ars_ok: null, usd_ok: null, detalle: 'No verificable: falta un valor.', diferencia: null } })
    expect(plano(cuadre(await pagina()))).toBe('Cuadre ○ No verificable: falta un valor.')
  })
})

describe('Hoy · "Todavía no cargaste hoy" recién después del cierre de BYMA (visión §3.2)', () => {
  it('a las 8:05 de un día hábil sin carga no lo dice; a las 18:10, sí (en el teléfono y en Próximos 30 días)', async () => {
    const v = armarHoy(hechos, HOY_EJEMPLO)
    expect(v.es_habil_hoy && !v.cargo_hoy).toBe(true)
    hora('08:05')
    expect(texto(await pagina())).not.toContain('Todavía no cargaste hoy')
    hora('18:10')
    const html = await pagina()
    expect(texto(html).match(/Todavía no cargaste hoy/g)).toHaveLength(2)
    expect(texto(tarjeta(html, 'Próximos 30 días'))).toContain('Todavía no cargaste hoy Ya cerró BYMA')
  })
})

describe('Hoy · Día cero: el orden del manual (D-70, manual §5)', () => {
  it('Leasing, Bienes, el catálogo opcional y después la primera carga; sin pedir las cuentas', async () => {
    hechos = hechosVacios()
    const html = await pagina()
    const t = texto(html)
    expect(t).toContain('Todavía no hay datos')
    expect(t).not.toMatch(/tus cuentas/)
    const orden = ['Leasing', 'Bienes', 'catálogo', 'primera carga'].map((x) => t.indexOf(x))
    expect(orden.every((i) => i >= 0)).toBe(true)
    expect([...orden].sort((a, b) => a - b)).toEqual(orden)
    // La acción principal es el paso 1, y va directo a Datos › Leasing.
    const links = [...html.matchAll(/<a href="([^"]*)" class="([^"]*)"/g)].map((m) => ({ href: m[1], principal: m[2].includes('bg-accent') }))
    expect(links.find((l) => l.principal)?.href).toBe('/datos/leasing')
    expect(links.map((l) => l.href)).toContain('/carga')
  })
})
