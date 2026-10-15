'use client'

// Los gráficos de Evolución: reciben la vista serializada, arman la opción con
// las funciones puras de _lib/graficos.ts (con los colores del tema y el modo
// privado) y la dibuja el envoltorio compartido. Sin cálculos: solo elegir qué
// mostrar.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Grafico } from '@/components/graficos/grafico'
import { PanelTraza } from '@/components/traza'
import type { CalcVista } from '@/lib/domain/calc'
import { leerTema } from '@/components/graficos/tema'
import { useMedia, usePreferencias } from '@/components/preferencias'
import type { Moneda } from '@/lib/domain/tipos'
import type { ContribuyenteVista, FuturoVista, LineaPuenteVista, MesVista, PuntoSerieVista } from '@/lib/vistas/contratos-evolucion'
import { barrasContribuyentes, COLORES_CLAROS, deltasPuente, opcionContribuyentes, opcionIndice, opcionMeses, opcionPatrimonio, opcionPuente, quienesDe, type Colores } from '../_lib/graficos'
import { Cifra } from './cifras'

/** Los colores del tema vigente (cambian con claro/oscuro y la paleta daltónica). */
function useColores(): { colores: Colores; privado: boolean } {
  const p = usePreferencias()
  const oscuroSistema = useMedia('(prefers-color-scheme: dark)')
  const colores = useMemo<Colores>(() => {
    if (typeof document === 'undefined') return COLORES_CLAROS
    const t = leerTema()
    return { positivo: t.positivo, negativo: t.negativo, neutro: COLORES_CLAROS.neutro, tenue: t.tenue, acento: t.acento }
    // El tema y la paleta cambian los tokens: se vuelven a leer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.tema, p.paleta, oscuroSistema])
  return { colores, privado: p.privado }
}

const EN = (m: Moneda) => (m === 'ARS' ? 'en pesos' : 'en dólares')

/**
 * Recorta a lo ancho lo que el gráfico pone fuera de la vista: la tabla
 * accesible del envoltorio es sr-only, pero una <table> no respeta el ancho de
 * 1 px y, absoluta, estiraba el documento (scroll horizontal en el teléfono).
 * Con `relative` el recorte también alcanza a lo posicionado adentro.
 */
function Marco({ children }: { children: React.ReactNode }) {
  return <div className="relative min-w-0 overflow-x-clip">{children}</div>
}

/** Al tocar "por tus activos" o "por el dólar": quiénes más sumaron y más restaron en esa parte, cada uno con su traza. */
function QuienesDeLaParte({ sel, alCerrar }: { sel: { linea: LineaPuenteVista; parte: 'activo' | 'tc'; cs: ContribuyenteVista[]; moneda: Moneda } | null; alCerrar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (sel && d && !d.open) d.showModal()
  }, [sel])
  const q = sel ? quienesDe(sel.cs, sel.parte, sel.moneda) : null
  const que = sel?.parte === 'activo' ? 'por el precio' : 'por el dólar'
  const lista = (titulo: string, xs: ContribuyenteVista[]) =>
    xs.length ? (
      <div className="mt-3">
        <p className="text-[13px] font-medium text-muted">{titulo}</p>
        <ul className="mt-1 divide-y divide-border">
          {xs.map((x) => (
            <li key={x.clave} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: x.color }} />
                <span className="min-w-0 break-words">{x.nombre}</span>
              </span>
              <Cifra calc={sel!.moneda === 'ARS' ? x[sel!.parte].ars : x[sel!.parte].usd} moneda={sel!.moneda} titulo={`${x.nombre} · ${que}`} signo color />
            </li>
          ))}
        </ul>
      </div>
    ) : null
  return (
    <dialog
      ref={ref}
      aria-label={sel ? `${sel.linea.nombre}: quiénes sumaron y restaron` : 'Quiénes sumaron y restaron'}
      onClose={alCerrar}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close()
      }}
      className="w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-4 text-text shadow-lg backdrop:bg-black/30"
    >
      {sel && q ? (
        <>
          <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm font-medium">
            <span>{sel.linea.nombre}</span>
            <Cifra calc={sel.moneda === 'ARS' ? sel.linea.valor.ars : sel.linea.valor.usd} moneda={sel.moneda} titulo={sel.linea.nombre} signo color />
          </p>
          {lista('Los que más sumaron', q.suman)}
          {lista('Los que más restaron', q.restan)}
          {!q.suman.length && !q.restan.length ? <p className="mt-3 text-sm text-muted">Ninguna partida movió esta parte en el período.</p> : null}
        </>
      ) : null}
      <button type="button" className="tocable mt-3 w-full rounded-lg border border-border py-2 text-sm" onClick={() => ref.current?.close()}>
        Cerrar
      </button>
    </dialog>
  )
}

export function GraficoPuente({ lineas, contribuyentes, moneda }: { lineas: LineaPuenteVista[]; contribuyentes: ContribuyenteVista[]; moneda: Moneda }) {
  const { colores, privado } = useColores()
  const { opcion, tabla } = useMemo(() => opcionPuente(lineas, moneda, privado, colores), [lineas, moneda, privado, colores])
  const [traza, setTraza] = useState<{ calc: CalcVista; titulo: string; moneda: Moneda } | null>(null)
  const [quien, setQuien] = useState<{ linea: LineaPuenteVista; parte: 'activo' | 'tc'; cs: ContribuyenteVista[]; moneda: Moneda } | null>(null)
  // Tocar un escalón: por tus activos o por el dólar, quiénes más sumaron y restaron; cualquier otro, su traza.
  const tocar = ({ dato }: { serie: number; dato: number }) => {
    const l = deltasPuente(lineas)[dato]
    if (!l) return
    if (l.clave === 'activo' || l.clave === 'tc') setQuien({ linea: l, parte: l.clave, cs: contribuyentes, moneda })
    else setTraza({ calc: moneda === 'ARS' ? l.valor.ars : l.valor.usd, titulo: `${l.nombre} · ${EN(moneda)}`, moneda })
  }
  return (
    <Marco>
      <Grafico opcion={opcion} tabla={tabla} titulo={`El puente del período, ${EN(moneda)}`} alto={{ movil: 240, escritorio: 260 }} alTocar={tocar} />
      <TrazaDeBarra sel={traza} alCerrar={() => setTraza(null)} />
      <QuienesDeLaParte sel={quien} alCerrar={() => setQuien(null)} />
    </Marco>
  )
}

/** La traza de una barra tocada (D-35): la misma fórmula que abre la cifra en la tabla. */
function TrazaDeBarra({ sel, alCerrar }: { sel: { calc: CalcVista; titulo: string; moneda: Moneda } | null; alCerrar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (sel && d && !d.open) d.showModal()
  }, [sel])
  return (
    <dialog
      ref={ref}
      aria-label={sel?.titulo ?? 'Traza'}
      onClose={alCerrar}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close()
      }}
      className="w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-4 text-text shadow-lg backdrop:bg-black/30"
    >
      {sel ? <PanelTraza calc={sel.calc} titulo={sel.titulo} moneda={sel.moneda} /> : null}
      <button type="button" className="tocable mt-3 w-full rounded-lg border border-border py-2 text-sm" onClick={() => ref.current?.close()}>
        Cerrar
      </button>
    </dialog>
  )
}

export function GraficoContribuyentes({ cs, moneda }: { cs: ContribuyenteVista[]; moneda: Moneda }) {
  const { colores, privado } = useColores()
  const movil = useMedia('(max-width: 767.98px)')
  const limite = movil ? 5 : null
  const { opcion, tabla } = useMemo(() => opcionContribuyentes(cs, moneda, privado, limite, colores), [cs, moneda, privado, limite, colores])
  const [sel, setSel] = useState<{ calc: CalcVista; titulo: string; moneda: Moneda } | null>(null)
  const filas = limite ? Math.min(limite, cs.length) : cs.length
  const alto = Math.max(160, 48 + filas * 34)
  const tocar = ({ serie, dato }: { serie: number; dato: number }) => {
    const x = barrasContribuyentes(cs, limite)[dato]
    if (!x) return
    const parte = serie === 0 ? x.activo : x.tc
    setSel({ calc: moneda === 'ARS' ? parte.ars : parte.usd, titulo: `${x.nombre} · ${serie === 0 ? 'por el precio' : 'por el dólar'} · ${EN(moneda)}`, moneda })
  }
  return (
    <Marco>
      <Grafico
        opcion={opcion}
        tabla={tabla}
        titulo={`Quién sumó y quién restó, ${EN(moneda)}: por el precio y por el dólar`}
        alto={{ movil: Math.max(190, 80 + Math.min(5, cs.length) * 34), escritorio: alto }}
        alTocar={tocar}
      />
      <TrazaDeBarra sel={sel} alCerrar={() => setSel(null)} />
    </Marco>
  )
}

export function GraficoPatrimonio({ serie, aportado, futuro, moneda }: { serie: PuntoSerieVista[]; aportado: PuntoSerieVista[]; futuro: FuturoVista | null; moneda: Moneda }) {
  const { colores, privado } = useColores()
  const { opcion, tabla } = useMemo(() => opcionPatrimonio(serie, aportado, futuro, moneda, privado, colores), [serie, aportado, futuro, moneda, privado, colores])
  return (
    <Marco>
      <Grafico opcion={opcion} tabla={tabla} titulo={`Tu patrimonio y el capital aportado, ${EN(moneda)}${futuro ? ', con el escenario' : ''}`} alto={{ movil: 240, escritorio: 300 }} />
    </Marco>
  )
}

/**
 * Tu patrimonio en el tiempo: con las dos monedas, por separado (un gráfico por
 * moneda, con el capital aportado y el escenario) o juntas en índice 100 (las
 * dos monedas solo comparten eje indexadas, §8).
 */
export function GraficosPatrimonio({ serie, aportado, futuro, monedas }: { serie: PuntoSerieVista[]; aportado: PuntoSerieVista[]; futuro: FuturoVista | null; monedas: Moneda[] }) {
  const { colores } = useColores()
  const [juntas, setJuntas] = useState(false)
  const puedeJuntar = monedas.length === 2 && serie.length > 1
  const indice = useMemo(() => opcionIndice(serie, colores), [serie, colores])
  return (
    <>
      {puedeJuntar ? (
        <div role="group" aria-label="Cómo ver las dos monedas" className="mb-3 inline-grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface-2 p-1">
          {[
            { v: false, n: 'Por separado' },
            { v: true, n: 'Juntas (índice 100)' },
          ].map((x) => (
            <button
              key={x.n}
              type="button"
              aria-pressed={juntas === x.v}
              onClick={() => setJuntas(x.v)}
              className={`tocable min-h-9 rounded-lg px-3 text-sm ${juntas === x.v ? 'bg-surface font-semibold shadow-[var(--shadow)]' : 'text-muted hover:text-text'}`}
            >
              {x.n}
            </button>
          ))}
        </div>
      ) : null}
      {puedeJuntar && juntas ? (
        <Marco>
          <Grafico opcion={indice.opcion} tabla={indice.tabla} titulo="Tu patrimonio en pesos y en dólares, índice 100 el día cero" alto={{ movil: 240, escritorio: 300 }} />
        </Marco>
      ) : (
        <div className={`grid gap-4 ${monedas.length > 1 ? 'xl:grid-cols-2' : ''}`}>
          {monedas.map((m) => (
            <GraficoPatrimonio key={m} serie={serie} aportado={aportado} futuro={futuro} moneda={m} />
          ))}
        </div>
      )}
    </>
  )
}

export function GraficoMeses({ meses, moneda }: { meses: MesVista[]; moneda: Moneda }) {
  const { colores, privado } = useColores()
  const { opcion, tabla } = useMemo(() => opcionMeses(meses, moneda, privado, colores), [meses, moneda, privado, colores])
  return (
    <Marco>
      <Grafico opcion={opcion} tabla={tabla} titulo={`PnL por mes, ${EN(moneda)}`} alto={{ movil: 240, escritorio: 280 }} />
    </Marco>
  )
}
