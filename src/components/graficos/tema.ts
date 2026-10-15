// Tema y reglas comunes de los gráficos (plan de la entrega 4, §8). Sin React y
// sin ECharts: funciones puras sobre la opción, con test. El envoltorio
// (grafico.tsx) las aplica antes de dibujar.
//
// Reglas: sin tortas; los colores salen de los tokens CSS (claro, oscuro y la
// paleta daltónica); el tooltip queda dentro del gráfico; nunca zoom ni scroll
// horizontal; en el teléfono, la leyenda abajo y como mucho 4 etiquetas en el
// eje x; sin animación con "reducir movimiento".

type Opcion = Record<string, unknown>

export interface TemaGrafico {
  texto: string
  tenue: string
  borde: string
  superficie: string
  acento: string
  positivo: string
  negativo: string
  fuente: string
}

/** El tema claro por defecto (el de globals.css): sirve en el servidor y en los tests. */
export const TEMA_CLARO: TemaGrafico = {
  texto: '#121722',
  tenue: '#5b6474',
  borde: '#dde1e7',
  superficie: '#ffffff',
  acento: '#2f5bd3',
  positivo: '#0f7a43',
  negativo: '#c2321f',
  fuente: 'ui-sans-serif, system-ui, sans-serif',
}

/** Lee los tokens CSS vigentes (cambian con el tema y la paleta daltónica). Solo en el navegador. */
export function leerTema(raiz: HTMLElement = document.documentElement): TemaGrafico {
  const cs = getComputedStyle(raiz)
  const v = (nombre: string, defecto: string) => cs.getPropertyValue(nombre).trim() || defecto
  return {
    texto: v('--text', TEMA_CLARO.texto),
    tenue: v('--text-muted', TEMA_CLARO.tenue),
    borde: v('--border', TEMA_CLARO.borde),
    superficie: v('--surface', TEMA_CLARO.superficie),
    acento: v('--accent', TEMA_CLARO.acento),
    positivo: v('--positive', TEMA_CLARO.positivo),
    negativo: v('--negative', TEMA_CLARO.negativo),
    fuente: getComputedStyle(document.body).fontFamily || TEMA_CLARO.fuente,
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
    axisLine: { lineStyle: { color: t.borde } },
    axisTick: { lineStyle: { color: t.borde } },
    axisLabel: { color: t.tenue, fontFamily: t.fuente, hideOverlap: true },
    splitLine: { lineStyle: { color: t.borde } },
    nameTextStyle: { color: t.tenue },
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
  out.textStyle = unir({ color: t.texto, fontFamily: t.fuente }, opcion.textStyle as Opcion | undefined)
  out.aria = unir({ enabled: true }, opcion.aria as Opcion | undefined)
  out.tooltip = {
    ...unir(
      { backgroundColor: t.superficie, borderColor: t.borde, textStyle: { color: t.texto, fontFamily: t.fuente } },
      opcion.tooltip as Opcion | undefined,
    ),
    confine: true, // el tooltip nunca se sale del gráfico ni de la pantalla
  }
  const conLeyenda = opcion.legend !== undefined
  if (conLeyenda) {
    const leyendas = lista(opcion.legend).map((l) => {
      const r = unir({ textStyle: { color: t.tenue, fontFamily: t.fuente } }, l)
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
  return out
}
