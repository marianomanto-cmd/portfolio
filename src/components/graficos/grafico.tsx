'use client'

// El único envoltorio de ECharts de la app (plan de la entrega 4, §8; sistema
// visual D-157). Cada pantalla arma la opción con una función pura en su
// _lib/graficos.ts (con test) y la pasa acá; este componente solo dibuja.
//
//   <Grafico opcion={opcion} tabla={tabla} titulo="Patrimonio neto · 12 meses" alto={{ movil: 200, escritorio: 220 }} />
//
// - ECharts se importa por partes y recién en el navegador (no pesa en el
//   servidor ni en las pantallas sin gráficos), con el renderer SVG.
// - Le pone el tema (tema.ts): ejes en mono 10 px, grilla hairline, tooltip de
//   vidrio, la paleta del sistema y los colorTema(…) de la opción resueltos
//   con el tema vigente. Se vuelve a dibujar al cambiar el tema, la paleta o
//   el ancho; sin animación con "reducir movimiento".
// - Una opción nueva se dibuja sobre el mismo gráfico (setOption), sin
//   desarmarlo: así sigue en vivo a una barra de Flujo (< 200 ms). Con
//   `fusionar`, la opción nueva (los mismos componentes, otros datos) se
//   fusiona con la anterior y solo se reemplazan las series: no se rehacen los
//   ejes, la leyenda ni el tooltip.
// - `pie` va a la izquierda de "Ver como tabla", en el mismo renglón (una
//   leyenda corta).
// - Alto fijo (uno para el teléfono y otro desde 768 px): nunca empuja la
//   pantalla ni deja scroll horizontal.
// - La misma información va en una tabla para el lector de pantalla, y "Ver
//   como tabla" la muestra a la vista. El nombre del gráfico es su título.
// - El modo privado lo resuelve la opción (sin montos en ejes, etiquetas ni
//   tooltip); el test de interacción lo controla en cada pantalla.

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { conTema, leerTema } from './tema'

export interface TablaGrafico {
  columnas: string[]
  filas: string[][]
}

export interface PropsGrafico {
  /** La opción de ECharts, armada por una función pura de la pantalla. */
  opcion: Record<string, unknown>
  /** Alto en px: en el teléfono y desde 768 px. Por defecto 240 y 320. */
  alto?: { movil: number; escritorio: number }
  /** Para qué sirve el gráfico: es su nombre accesible y el título de la tabla. */
  titulo: string
  /** Lo mismo que muestra el gráfico, como tabla. */
  tabla: TablaGrafico
  /** Tocar una barra o un punto (por ejemplo, para abrir su traza). */
  alTocar?: (indice: { serie: number; dato: number }) => void
  className?: string
  /**
   * Una opción nueva se fusiona con la anterior (solo se reemplazan las
   * series) en lugar de dibujarse de cero. Para un gráfico que sigue en vivo a
   * un control y conserva sus componentes (Flujo). Sin la prop, como siempre.
   */
  fusionar?: boolean
  /** A la izquierda de "Ver como tabla", en el mismo renglón: una leyenda corta. Sin la prop, como siempre. */
  pie?: ReactNode
}

type Instancia = {
  setOption: (o: Record<string, unknown>, opciones?: { notMerge?: boolean; replaceMerge?: string[] }) => void
  resize: () => void
  dispose: () => void
  on: (evento: string, fn: (p: { seriesIndex?: number; dataIndex?: number }) => void) => void
}

let cargar: Promise<{ init: (el: HTMLElement, tema: null, o: { renderer: 'svg' }) => Instancia }> | null = null

/** ECharts por partes, una sola vez por página. */
function echarts() {
  cargar ??= (async () => {
    const [core, charts, componentes, renderers] = await Promise.all([
      import('echarts/core'),
      import('echarts/charts'),
      import('echarts/components'),
      import('echarts/renderers'),
    ])
    core.use([
      charts.BarChart,
      charts.LineChart,
      componentes.GridComponent,
      componentes.TooltipComponent,
      componentes.LegendComponent,
      componentes.MarkAreaComponent,
      componentes.MarkLineComponent,
      componentes.AriaComponent,
      renderers.SVGRenderer,
    ])
    return core as unknown as { init: (el: HTMLElement, tema: null, o: { renderer: 'svg' }) => Instancia }
  })()
  return cargar
}

const MOVIL = '(max-width: 767.98px)'
const SIN_MOVIMIENTO = '(prefers-reduced-motion: reduce)'

export function Grafico({ opcion, alto = { movil: 240, escritorio: 320 }, titulo, tabla, alTocar, className = '', fusionar = false, pie }: PropsGrafico) {
  const ref = useRef<HTMLDivElement>(null)
  const tocar = useRef(alTocar)
  const fusion = useRef(fusionar)
  // La opción vigente y cómo dibujarla: el gráfico se arma una vez y cada opción nueva se dibuja encima.
  const vigente = useRef(opcion)
  const nombre = useRef(titulo)
  const redibujar = useRef<(() => void) | null>(null)
  const [verTabla, setVerTabla] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const idTabla = useId()

  useEffect(() => {
    tocar.current = alTocar
  }, [alTocar])

  useLayoutEffect(() => {
    vigente.current = opcion
    nombre.current = titulo
    fusion.current = fusionar
    redibujar.current?.()
  }, [opcion, titulo, fusionar])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let vivo = true
    let chart: Instancia | null = null
    const limpiar: (() => void)[] = []

    // Con `fusionar`, una opción nueva se fusiona (solo cambian las series); el tema, el ancho y la primera vez, de cero.
    const pintar = (fusionarAhora: boolean) => {
      if (!chart) return
      const entorno = { movil: window.matchMedia(MOVIL).matches, animar: !window.matchMedia(SIN_MOVIMIENTO).matches }
      try {
        chart.setOption(conTema(vigente.current, leerTema(), { ...entorno, nombre: nombre.current }), fusionarAhora ? { notMerge: false, replaceMerge: ['series'] } : { notMerge: true })
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo dibujar el gráfico.')
      }
    }
    const dibujar = () => pintar(false)

    echarts()
      .then((ec) => {
        if (!vivo || !ref.current) return
        chart = ec.init(ref.current, null, { renderer: 'svg' })
        chart.on('click', (p) => {
          if (typeof p.seriesIndex === 'number' && typeof p.dataIndex === 'number') tocar.current?.({ serie: p.seriesIndex, dato: p.dataIndex })
        })
        redibujar.current = () => pintar(fusion.current)
        limpiar.push(() => {
          redibujar.current = null
        })
        dibujar()
        // Ancho: se redibuja con el contenedor (también cambia de teléfono a escritorio).
        let movil = window.matchMedia(MOVIL).matches
        const ro = new ResizeObserver(() => {
          chart?.resize()
          const ahora = window.matchMedia(MOVIL).matches
          if (ahora !== movil) {
            movil = ahora
            dibujar()
          }
        })
        ro.observe(el)
        limpiar.push(() => ro.disconnect())
        // Tema y paleta: atributos de <html> y la preferencia del sistema.
        const mo = new MutationObserver(dibujar)
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-paleta'] })
        limpiar.push(() => mo.disconnect())
        for (const consulta of ['(prefers-color-scheme: dark)', SIN_MOVIMIENTO]) {
          const mq = window.matchMedia(consulta)
          mq.addEventListener('change', dibujar)
          limpiar.push(() => mq.removeEventListener('change', dibujar))
        }
      })
      .catch(() => {
        if (vivo) setError('No se pudo cargar el gráfico: mirá la tabla.')
      })

    return () => {
      vivo = false
      for (const f of limpiar) f()
      chart?.dispose()
    }
  }, [])

  const estilo = { '--alto-movil': `${alto.movil}px`, '--alto-escritorio': `${alto.escritorio}px` } as CSSProperties

  return (
    <figure className={`relative min-w-0 ${className}`}>
      <div
        ref={ref}
        role="img"
        aria-label={titulo}
        aria-describedby={idTabla}
        style={estilo}
        className="h-[var(--alto-movil)] w-full min-w-0 overflow-hidden md:h-[var(--alto-escritorio)]"
      />
      {error ? <p className="mt-1 text-sm text-muted">{error}</p> : null}
      <figcaption className={pie ? 'mt-1 flex flex-wrap items-center justify-between gap-x-3' : 'mt-1 flex justify-end'}>
        {pie ? <div className="min-w-0">{pie}</div> : null}
        <button
          type="button"
          onClick={() => setVerTabla((v) => !v)}
          aria-expanded={verTabla}
          aria-controls={idTabla}
          className={`tocable inline-flex min-h-11 items-center rounded-lg px-2 text-[13px] text-muted transition-colors hover:text-text lg:min-h-9${pie ? ' ml-auto' : ''}`}
        >
          {verTabla ? 'Ocultar la tabla' : 'Ver como tabla'}
        </button>
      </figcaption>
      {/* La tabla siempre está para el lector de pantalla. A la vista, con "Ver como
          tabla": en el teléfono, como tarjetas (nunca scroll horizontal, D-30). */}
      <div id={idTabla}>
        {/* sr-only va en un div: una <table> no respeta el ancho de 1 px y ensanchaba la página en el teléfono. */}
        <div className={verTabla ? 'sr-only md:not-sr-only md:mt-1' : 'sr-only'}>
          <table className="w-full text-sm">
          <caption className="sr-only">{titulo}</caption>
          <thead>
            <tr>
              {tabla.columnas.map((c, i) => (
                <th key={i} scope="col" className="rotulo px-2 py-1 text-left text-[10px]">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tabla.filas.map((f, i) => (
              <tr key={i} className="border-t border-border">
                {f.map((celda, j) =>
                  j === 0 ? (
                    <th key={j} scope="row" className="px-2 py-1 text-left font-normal">
                      {celda}
                    </th>
                  ) : (
                    <td key={j} className="num px-2 py-1 text-right">
                      {celda}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
          </table>
        </div>
        {verTabla ? (
          <ul aria-hidden="true" className="mt-1 space-y-2 md:hidden">
            {tabla.filas.map((f, i) => (
              <li key={i} className="rounded-lg border border-border p-2 text-sm">
                <p className="font-medium text-text">{f[0]}</p>
                <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
                  {f.slice(1).map((celda, j) => (
                    <div key={j} className="contents">
                      <dt className="text-muted">{tabla.columnas[j + 1]}</dt>
                      <dd className="num text-right break-words">{celda}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </figure>
  )
}
