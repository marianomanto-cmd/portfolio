// Tema y reglas comunes de los gráficos (plan de la entrega 4, §8; sistema
// visual D-157). Sin React y sin ECharts: funciones puras sobre la opción, con
// test. El envoltorio (grafico.tsx) las aplica antes de dibujar.
//
// Reglas: sin tortas; los colores salen de los tokens CSS (claro, oscuro y la
// paleta daltónica); ejes en mono 10 px y líneas de grilla hairline; el
// tooltip es una placa de vidrio y queda dentro del gráfico; nunca zoom ni
// scroll horizontal; en el teléfono, la leyenda abajo y como mucho 4 etiquetas
// en el eje x; sin animación con "reducir movimiento".
//
// Cómo se usa desde una pantalla (su _lib/graficos.ts arma la opción):
//   - colores del sistema con colorTema('viz'), colorTema('texto', 0.07)…: se
//     resuelven al dibujar con el tema vigente, así el mismo gráfico anda en
//     claro y en oscuro sin que la función pura sepa cuál es;
//   - el color de un activo viene en la vista (`color`), el mismo en todos lados;
//   - el modo privado lo resuelve la función de la opción (recibe `privado` y
//     no pone montos en ejes, etiquetas ni tooltip): ver OCULTO.

type Opcion = Record<string, unknown>

export interface TemaGrafico {
  /** Tinta: los pesos, el texto principal. */
  texto: string
  /** Texto secundario (leyenda). */
  tenue: string
  /** Metadatos: las etiquetas de los ejes. Llega a AA sobre surface. */
  faint: string
  /** Hairline: líneas de grilla y ejes. */
  borde: string
  bordeFuerte: string
  superficie: string
  superficie2: string
  superficie3: string
  /** Sangría: deuda, pérdida, la acción principal. */
  acento: string
  acentoBrillo: string
  /** Oro: los dólares y el tramo del tipo de cambio. */
  viz: string
  vizSuave: string
  vizFuerte: string
  positivo: string
  negativo: string
  /** Geist, la interfaz. */
  fuente: string
  /** JetBrains Mono: cifras, ejes y tooltip. */
  fuenteMono: string
}

/** El tema oscuro (el de por defecto, globals.css): sirve en el servidor y en los tests. */
export const TEMA_OSCURO: TemaGrafico = {
  texto: '#f4f1ea',
  tenue: '#8c8696',
  faint: '#837d8d',
  borde: 'rgba(244, 241, 234, 0.1)',
  bordeFuerte: 'rgba(244, 241, 234, 0.18)',
  superficie: '#15131c',
  superficie2: '#1c1924',
  superficie3: '#241f2e',
  acento: '#f23a5e',
  acentoBrillo: '#ff7d9b',
  viz: '#e0a458',
  vizSuave: '#2a2014',
  vizFuerte: '#f0b86a',
  positivo: '#4fd08a',
  negativo: '#ff5c7c',
  fuente: 'ui-sans-serif, system-ui, sans-serif',
  fuenteMono: 'ui-monospace, monospace',
}

/** El tema claro (data-theme="light"). */
export const TEMA_CLARO: TemaGrafico = {
  texto: '#181410',
  tenue: '#635a4b',
  faint: '#6e6656',
  borde: 'rgba(24, 20, 16, 0.12)',
  bordeFuerte: 'rgba(24, 20, 16, 0.22)',
  superficie: '#ffffff',
  superficie2: '#f4f1eb',
  superficie3: '#ece7dd',
  acento: '#c8193f',
  acentoBrillo: '#b3173b',
  viz: '#b57a2c',
  vizSuave: '#f8eedc',
  vizFuerte: '#7a4e0e',
  positivo: '#0e7340',
  negativo: '#b8183d',
  fuente: 'ui-sans-serif, system-ui, sans-serif',
  fuenteMono: 'ui-monospace, monospace',
}

/** Lee los tokens CSS vigentes (cambian con el tema y la paleta daltónica). Solo en el navegador. */
export function leerTema(raiz: HTMLElement = document.documentElement): TemaGrafico {
  const cs = getComputedStyle(raiz)
  const d = TEMA_OSCURO
  const v = (nombre: string, defecto: string) => cs.getPropertyValue(nombre).trim() || defecto
  return {
    texto: v('--text', d.texto),
    tenue: v('--text-muted', d.tenue),
    faint: v('--text-faint', d.faint),
    borde: v('--border', d.borde),
    bordeFuerte: v('--border-strong', d.bordeFuerte),
    superficie: v('--surface', d.superficie),
    superficie2: v('--surface-2', d.superficie2),
    superficie3: v('--surface-3', d.superficie3),
    acento: v('--accent', d.acento),
    acentoBrillo: v('--accent-glow', d.acentoBrillo),
    viz: v('--viz', d.viz),
    vizSuave: v('--viz-soft', d.vizSuave),
    vizFuerte: v('--viz-strong', d.vizFuerte),
    positivo: v('--positive', d.positivo),
    negativo: v('--negative', d.negativo),
    fuente: v('--fuente-sans', '') || getComputedStyle(document.body).fontFamily || d.fuente,
    fuenteMono: v('--fuente-mono', d.fuenteMono),
  }
}

// ───────────── Colores del sistema dentro de una opción ─────────────

/** Los colores del tema que una opción puede pedir por nombre. */
export type ColorTema = Exclude<keyof TemaGrafico, 'fuente' | 'fuenteMono'>

const PREFIJO = 'tema:'
const COLOR_TEMA = /^tema:([a-zA-Z0-9]+)(?:@(0|1|0?\.\d+))?$/

/**
 * Un color del sistema para una opción de ECharts: se resuelve al dibujar con
 * el tema vigente. `alfa` (0 a 1) lo hace transparente: colorTema('viz', 0.14)
 * es el área dorada del diseño.
 */
export function colorTema(nombre: ColorTema, alfa?: number): string {
  return alfa === undefined ? `${PREFIJO}${nombre}` : `${PREFIJO}${nombre}@${alfa}`
}

/** "#rgb", "#rrggbb", "rgb(…)" o "rgba(…)" con otra transparencia (multiplica la que ya tiene). */
export function conAlfa(color: string, alfa: number): string {
  const c = color.trim()
  let r: number, g: number, b: number
  let a = 1
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c)
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(c)
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, (x) => x + x) : hex[1]
    ;[r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
  } else if (rgb) {
    ;[r, g, b] = [rgb[1], rgb[2], rgb[3]].map(Number)
    a = rgb[4] === undefined ? 1 : Number(rgb[4])
  } else {
    return c
  }
  const final = Math.round(a * alfa * 1000) / 1000
  return `rgba(${r}, ${g}, ${b}, ${final})`
}

/** Reemplaza cada colorTema(…) de la opción por el color del tema vigente. No toca funciones ni números. */
export function resolverColores<T>(x: T, t: TemaGrafico): T {
  if (typeof x === 'string') {
    if (!x.startsWith(PREFIJO)) return x
    const m = COLOR_TEMA.exec(x)
    if (!m || !(m[1] in t) || m[1] === 'fuente' || m[1] === 'fuenteMono') return x
    const base = t[m[1] as ColorTema]
    return (m[2] === undefined ? base : conAlfa(base, Number(m[2]))) as T
  }
  if (Array.isArray(x)) {
    let cambio = false
    const out = x.map((e) => {
      const r = resolverColores(e, t)
      if (r !== e) cambio = true
      return r
    })
    return (cambio ? out : x) as T
  }
  if (typeof x === 'object' && x !== null && Object.getPrototypeOf(x) === Object.prototype) {
    let cambio = false
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(x)) {
      const r = resolverColores(v, t)
      if (r !== v) cambio = true
      out[k] = r
    }
    return (cambio ? out : x) as T
  }
  return x
}

/**
 * La paleta de las series que no dicen su color: oro (dólares), tinta
 * (pesos), piedra, lavanda y sangría, en ese orden.
 */
export function paletaSeries(t: TemaGrafico): string[] {
  return [t.viz, t.texto, '#c7bdab', '#8c8696', t.acento, t.vizFuerte, '#a89e8b']
}

/** Lo que muestra un monto en el modo privado (ejes, etiquetas y tooltip de un gráfico). */
export const OCULTO = '•••'

/** La placa de vidrio del tooltip (el mismo vidrio que la traza). */
export function estiloVidrio(t: TemaGrafico): { fondo: string; css: string } {
  const claro = t.superficie.toLowerCase() === '#ffffff' || t.superficie.toLowerCase() === '#fff'
  return {
    fondo: conAlfa(t.superficie, claro ? 0.86 : 0.78),
    css: `backdrop-filter: blur(14px) saturate(1.08); -webkit-backdrop-filter: blur(14px) saturate(1.08); border-radius: 10px; box-shadow: ${
      claro ? '0 10px 30px rgba(24,20,16,.14)' : '0 10px 30px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.05)'
    };`,
  }
}

const esObjeto = (x: unknown): x is Opcion => typeof x === 'object' && x !== null && !Array.isArray(x)
const lista = (x: unknown): Opcion[] => (Array.isArray(x) ? x.filter(esObjeto) : esObjeto(x) ? [x] : [])

/** ¿Alguna serie es una torta (o una rosa, que es una torta)? Están prohibidas (CLAUDE.md, spec §UI). */
export function tieneTorta(opcion: Opcion): boolean {
  return lista(opcion.series).some((s) => s.type === 'pie' || 'roseType' in s)
}

/** Une dos objetos: lo del gráfico (b) manda sobre lo del tema (a), también un nivel adentro. */
function unir(a: Opcion, b: Opcion | undefined): Opcion {
  if (!b) return a
  const out: Opcion = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = esObjeto(v) && esObjeto(a[k]) ? unir(a[k] as Opcion, v) : v
  return out
}

function eje(t: TemaGrafico, e: Opcion, movil: boolean, esX: boolean): Opcion {
  const base: Opcion = {
    axisLine: { lineStyle: { color: t.borde, width: 1 } },
    axisTick: { show: false, lineStyle: { color: t.borde } },
    // Ejes en mono 10 px, en la tinta de los metadatos.
    axisLabel: { color: t.faint, fontFamily: t.fuenteMono, fontSize: 10, hideOverlap: true },
    // Líneas de grilla hairline.
    splitLine: { lineStyle: { color: t.borde, width: 1 } },
    nameTextStyle: { color: t.faint, fontFamily: t.fuenteMono, fontSize: 10 },
  }
  const r = unir(base, e)
  // En el teléfono, como mucho 4 etiquetas en el eje x de categorías.
  if (movil && esX && r.type === 'category' && Array.isArray(r.data)) {
    const n = r.data.length
    const label = (r.axisLabel ?? {}) as Opcion
    if (label.interval === undefined && n > 4) r.axisLabel = { ...label, interval: Math.ceil(n / 4) - 1 }
  }
  return r
}

/**
 * La opción final que dibuja ECharts: la del gráfico con el tema y las reglas
 * de arriba. No cambia los datos: solo colores, tooltip, leyenda, ejes,
 * animación y accesibilidad.
 */
export function conTema(opcion: Opcion, t: TemaGrafico, entorno: { movil: boolean; animar: boolean }): Opcion {
  if (tieneTorta(opcion)) throw new Error('Gráfico de torta: están prohibidos. Usá barras (spec §UI).')
  const out: Opcion = { ...opcion }
  delete out.dataZoom // nunca zoom ni scroll horizontal (D-30)
  out.backgroundColor = 'transparent'
  out.animation = entorno.animar && opcion.animation !== false
  if (out.color === undefined) out.color = paletaSeries(t)
  out.textStyle = unir({ color: t.texto, fontFamily: t.fuenteMono, fontSize: 11 }, opcion.textStyle as Opcion | undefined)
  out.aria = unir({ enabled: true }, opcion.aria as Opcion | undefined)
  const vidrio = estiloVidrio(t)
  out.tooltip = {
    ...unir(
      {
        backgroundColor: vidrio.fondo,
        borderColor: t.borde,
        borderWidth: 1,
        padding: [8, 10],
        extraCssText: vidrio.css,
        textStyle: { color: t.texto, fontFamily: t.fuenteMono, fontSize: 12 },
        axisPointer: { lineStyle: { color: t.bordeFuerte }, shadowStyle: { color: conAlfa(t.texto, 0.04) } },
      },
      opcion.tooltip as Opcion | undefined,
    ),
    confine: true, // el tooltip nunca se sale del gráfico ni de la pantalla
  }
  const conLeyenda = opcion.legend !== undefined
  if (conLeyenda) {
    const leyendas = lista(opcion.legend).map((l) => {
      const r = unir({ textStyle: { color: t.tenue, fontFamily: t.fuente, fontSize: 11 }, itemWidth: 12, itemHeight: 8, itemGap: 14 }, l)
      // En el teléfono, la leyenda va abajo, centrada.
      return entorno.movil ? { ...r, top: undefined, bottom: 0, left: 'center' } : r
    })
    out.legend = Array.isArray(opcion.legend) ? leyendas : leyendas[0]
  }
  if (!Array.isArray(opcion.grid)) {
    // ECharts 6 ya deja lugar para las etiquetas de los ejes (outerBounds): solo los márgenes.
    out.grid = unir({ left: 8, right: 8, top: 16, bottom: entorno.movil && conLeyenda ? 48 : 8 }, opcion.grid as Opcion | undefined)
  }
  for (const [clave, esX] of [
    ['xAxis', true],
    ['yAxis', false],
  ] as const) {
    if (opcion[clave] === undefined) continue
    const ejes = lista(opcion[clave]).map((e) => eje(t, e, entorno.movil, esX))
    out[clave] = Array.isArray(opcion[clave]) ? ejes : ejes[0]
  }
  // Por último, los colores pedidos por nombre (colorTema) con el tema vigente.
  return resolverColores(out, t)
}
