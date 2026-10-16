'use client'

/**
 * Grilla: TODA tabla de datos de la app (posiciones, cuadro de marcha,
 * resultados por activo, PnL por mes, la proyección mes a mes, el balance, el
 * registro…) pasa por acá. Es AG Grid Community 36.2.0 (D-157), con el tema
 * del sistema y las reglas de la app resueltas una vez. Las listas cortas de
 * clave–valor (los insumos de una traza) no son tablas: no la usan.
 *
 * Uso (en un componente de cliente: las columnas llevan funciones, que no
 * cruzan del servidor al navegador; armalas con useMemo o fuera del render):
 *
 *   const COLUMNAS: ColumnaGrilla<FilaCartera>[] = [
 *     { id: 'activo', titulo: 'Activo', ancho: 170, flex: 1.6, prioridad: 0,
 *       celda: (f) => <Activo f={f} />, orden: (f) => f.ticker, total: () => 'Total' },
 *     { id: 'valor', titulo: 'Valor', tipo: 'numero', ancho: 130, prioridad: 0,
 *       celda: (f) => <ParMonto par={f.valor} titulo={`${f.ticker} · valor`} vertical />,
 *       orden: (f) => f.valor.ars.valor,                       // texto decimal; null = sin dato, al final
 *       total: () => <ParMonto par={tot.valor} titulo="Valor de la cartera" vertical /> },
 *     { id: 'ppc_usd', titulo: 'PPC USD', tipo: 'numero', ancho: 110, prioridad: 3,
 *       celda: (f) => <MontoTrazado calc={f.ppc.usd} moneda="USD" titulo={`${f.ticker} · PPC en dólares`} />,
 *       orden: (f) => f.ppc.usd.valor },
 *   ]
 *   <Grilla
 *     titulo="Posiciones, en pesos y en dólares"
 *     filas={v.filas} columnas={COLUMNAS} idFila={(f) => f.clave} nombreFila={(f) => f.ticker}
 *     ordenInicial={{ columna: 'valor', direccion: 'desc' }}
 *     tarjeta={(f) => <TarjetaPosicion f={f} />}   // debajo de 768 px; sin esto, una tarjeta armada con las columnas
 *   />
 *
 * Qué resuelve:
 * - Las celdas son componentes de la app (Monto, MontoTrazado, ParMonto con la
 *   pastilla del dólar, "sin dato"): el modo privado y la traza siguen andando.
 *   La traza se abre en un portal (no la recorta la celda).
 * - Orden numérico exacto sobre montos en texto decimal, con "sin dato" al
 *   final en las dos direcciones (orden.ts, con test). Los números ordenan de
 *   mayor a menor al primer toque; los textos, de la A a la Z.
 * - La fila de totales, fija abajo (pinnedBottomRowData): la columna que tenga
 *   `total` lo dibuja.
 * - Alto automático hasta `maxFilas` (25) filas; con más, scroll vertical
 *   adentro con los totales siempre a la vista.
 * - Nunca scroll horizontal: columnas flex con un ancho mínimo; cuando no
 *   entran, se ocultan las de `prioridad` más alta (columnas.ts, con test) y la
 *   fila suma un botón ⋯ que abre la ficha con lo que no se ve.
 * - Debajo de 768 px no hay grilla: tarjetas (D-30), una por fila, en el mismo
 *   orden, y una al final con los totales.
 * - Accesibilidad: la grilla de AG Grid (roles, aria-sort, flechas para
 *   moverse), con nombre (`titulo`). Enter en una celda pasa el foco a lo que
 *   tiene adentro (la cifra: Enter otra vez abre su traza); Tab recorre lo de
 *   la celda y Escape vuelve a la celda. El foco se ve (--focus). Con el
 *   dedo (una tablet), el encabezado y las filas miden 44 px como mínimo.
 * - Grupos de filas (`grupo`): la primera fila de cada grupo lleva un borde
 *   más marcado y las columnas `soloPrimeraDelGrupo` se dibujan una sola vez
 *   (Registro: un lote y sus cargas).
 */

import { Ellipsis, X } from 'lucide-react'
import { AgGridReact, type CustomCellRendererProps } from 'ag-grid-react'
import type { CellKeyDownEvent, ColDef, GetRowIdParams, GridApi, GridReadyEvent, IRowNode, PostSortRowsParams, RowClassParams, SuppressKeyboardEventParams, SuppressMouseEventHandlingParams } from 'ag-grid-community'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMedia } from '@/components/preferencias'
import { Aviso } from '@/components/ui'
import { altoGrilla, columnasVisibles, iniciosDeGrupo, medidas } from './columnas'
import { registrarModulos } from './modulos'
import { compararOrden, ordenarFilas, type ValorOrden } from './orden'
import { ALTO_ENCABEZADO, ALTO_FILA, ALTO_TOCABLE, temaGrilla } from './tema'

registrarModulos()

export interface ColumnaGrilla<T> {
  /** Único en la grilla. */
  id: string
  /** El encabezado (va en mayúsculas, mono 10 px). */
  titulo: string
  /** Lo que se dibuja en la celda: componentes de la app. */
  celda: (fila: T) => ReactNode
  /** El valor para ordenar: texto decimal ("1234.56"), número o texto; null es "sin dato" y va al final. Sin `orden`, la columna no se ordena. */
  orden?: (fila: T) => ValorOrden
  /** 'numero': mono, tabular y a la derecha (el encabezado también). */
  tipo?: 'texto' | 'numero'
  /** Ancho mínimo en px, relleno incluido. Por defecto 110. */
  ancho?: number
  /** Cuánto del ancho que sobra se lleva (flex). Por defecto 1. */
  flex?: number
  /** 0: siempre se ve. Cuando no entran, se ocultan primero las de número más alto (por defecto 1). */
  prioridad?: number
  /** La celda de la fila de totales (fija abajo). */
  total?: () => ReactNode
  /** La fila crece con el contenido de esta celda (varios renglones). */
  altoAuto?: boolean
  /** Con `grupo` en la grilla: se dibuja solo en la primera fila de cada grupo. */
  soloPrimeraDelGrupo?: boolean
}

export interface PropsGrilla<T> {
  filas: readonly T[]
  columnas: readonly ColumnaGrilla<T>[]
  idFila: (fila: T) => string
  /** El nombre accesible de la tabla (y de la lista de tarjetas). */
  titulo: string
  /** Cómo se nombra una fila (el botón de la ficha y su título). Por defecto, su id. */
  nombreFila?: (fila: T) => string
  /** El orden con que arranca. Sin esto, el de `filas`. */
  ordenInicial?: { columna: string; direccion: 'asc' | 'desc' }
  /** La tarjeta de cada fila debajo de 768 px. Sin esto, una armada con las columnas. */
  tarjeta?: (fila: T) => ReactNode
  /** Filas con alto automático; con más, scroll vertical adentro. Por defecto 25. */
  maxFilas?: number
  /** Alto de cada fila en px. Por defecto 44 (un renglón); 52 con dos. */
  altoFila?: number
  /** Lo que se ve si no hay filas. */
  vacio?: ReactNode
  /** Agrupa filas seguidas (ver soloPrimeraDelGrupo). */
  grupo?: (fila: T) => string
  className?: string
}

const FOCO = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
const ID_TOTAL = '__total'
const ID_FICHA = '__ficha'

type FilaTotal = { __total: true }
const esTotal = (x: unknown): x is FilaTotal => typeof x === 'object' && x !== null && (x as FilaTotal).__total === true

/** El teclado adentro de una celda: lo que tiene foco adentro (una cifra) maneja Enter, Espacio y Tab entre los suyos. */
function suprimirTeclado(p: SuppressKeyboardEventParams): boolean {
  const e = p.event as KeyboardEvent
  const t = e.target as HTMLElement | null
  const celda = t?.closest<HTMLElement>('.ag-cell')
  if (!t || !celda || t === celda) return false
  if (e.key === 'Enter' || e.key === ' ') return true
  if (e.key === 'Tab') {
    const focos = Array.from(celda.querySelectorAll<HTMLElement>(FOCO))
    const i = focos.indexOf(t)
    return e.shiftKey ? i > 0 : i >= 0 && i < focos.length - 1
  }
  if (e.key === 'Escape') {
    celda.focus()
    return true
  }
  return false
}

/**
 * Un clic en un control de la celda (la cifra con su traza, un botón) lo
 * maneja el control, no la grilla. Si no, al apretar, la grilla le da el foco
 * a la celda sin preventScroll: una fila que asoma por abajo de la pantalla
 * sube entre el mousedown y el mouseup, y el clic no llega a la cifra (su
 * traza no se abría). El teclado sigue igual (Enter entra, Escape vuelve).
 */
function mouseEnUnControl(p: SuppressMouseEventHandlingParams): boolean {
  const t = p.event.target as HTMLElement | null
  const celda = t?.closest?.('.ag-cell')
  const control = t?.closest?.(FOCO)
  return Boolean(celda && control && control !== celda && celda.contains(control))
}

/** Enter sobre una celda: el foco pasa a lo que tiene adentro (la cifra con su traza). */
function alApretarTecla(ev: CellKeyDownEvent) {
  const e = ev.event as KeyboardEvent | null | undefined
  if (!e || e.key !== 'Enter') return
  const t = e.target as HTMLElement | null
  if (!t?.classList.contains('ag-cell')) return
  const primero = t.querySelector<HTMLElement>(FOCO)
  if (primero) {
    e.preventDefault()
    primero.focus()
  }
}

export function Grilla<T>(p: PropsGrilla<T>) {
  const escritorio = useMedia('(min-width: 768px)', false)
  // Con el dedo (una tablet, o el teléfono acostado), el encabezado y las filas miden 44 px como mínimo (D-100).
  const grueso = useMedia('(pointer: coarse)', false)
  const contenedor = useRef<HTMLDivElement>(null)
  const api = useRef<GridApi | null>(null)
  const [ancho, setAncho] = useState(0)
  const [ficha, setFicha] = useState<T | null>(null)
  const maxFilas = p.maxFilas ?? 25
  const { altoFila, altoEncabezado } = medidas({ grueso, altoFila: p.altoFila ?? ALTO_FILA, altoEncabezado: ALTO_ENCABEZADO, minimo: ALTO_TOCABLE })
  const hayTotales = p.columnas.some((c) => c.total)
  const nombreFila = p.nombreFila ?? p.idFila

  // Lo último de las props, para los renderizadores (que tienen que ser estables: si cambian, AG Grid rehace las celdas).
  const props = useRef(p)
  props.current = p
  const abrirFicha = useRef(setFicha)

  // El ancho disponible, para saber qué columnas entran.
  useLayoutEffect(() => {
    const el = contenedor.current
    if (!escritorio || !el) return
    // El borde de la grilla (wrapperBorder del tema: 1 px de cada lado) no es lugar para
    // columnas: sin restarlo, columnas que suman justo el ancho del contenedor desbordan 2 px.
    const medir = () => setAncho(Math.max(0, Math.floor(el.clientWidth) - 2))
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [escritorio])

  const { visibles, ocultas } = useMemo(
    () => columnasVisibles(p.columnas.map((c) => ({ id: c.id, ancho: c.ancho ?? 110, prioridad: c.prioridad ?? 1 })), ancho),
    [p.columnas, ancho],
  )

  // Dónde empieza cada grupo, en el orden en que se ve: con filas nuevas, el de
  // `filas`; después de ordenar, el que deja AG Grid (postSortRows).
  const inicios = useRef(new Map<string, boolean>())
  const filasVistas = useRef<readonly T[] | null>(null)
  if (p.grupo && filasVistas.current !== p.filas) {
    filasVistas.current = p.filas
    const ini = iniciosDeGrupo(p.filas.map((f) => p.grupo!(f)))
    p.filas.forEach((f, i) => inicios.current.set(p.idFila(f), ini[i]))
  }

  // Un renderizador estable por columna: lee la columna vigente de props.
  const renderizadores = useRef(new Map<string, (r: CustomCellRendererProps) => ReactNode>())
  const renderizador = useCallback((id: string) => {
    let r = renderizadores.current.get(id)
    if (!r) {
      r = function CeldaGrilla(c: CustomCellRendererProps): ReactNode {
        const actual = props.current
        const col = actual.columnas.find((x) => x.id === id)
        if (!col) return null
        if (c.node.rowPinned) return col.total ? col.total() : null
        const fila = c.data as T | undefined
        if (!fila) return null
        if (col.soloPrimeraDelGrupo && actual.grupo && inicios.current.get(actual.idFila(fila)) === false) return null
        return col.celda(fila)
      }
      renderizadores.current.set(id, r)
    }
    return r
  }, [])

  const fichaRenderer = useMemo(
    () =>
      function BotonFicha(c: CustomCellRendererProps): ReactNode {
        if (c.node.rowPinned || !c.data) return null
        const fila = c.data as T
        const nombre = (props.current.nombreFila ?? props.current.idFila)(fila)
        return (
          <button
            type="button"
            onClick={() => abrirFicha.current(fila)}
            aria-label={`${nombre}: ver lo que no entra en la tabla`}
            title="Ver lo que no entra"
            className="tocable grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-surface-3 hover:text-text"
          >
            <Ellipsis aria-hidden className="size-4" />
          </button>
        )
      },
    [],
  )

  const columnDefs = useMemo<ColDef[]>(() => {
    const defs: ColDef[] = p.columnas.map((c) => {
      const numero = c.tipo === 'numero'
      const orden = c.orden
      return {
        colId: c.id,
        headerName: c.titulo,
        valueGetter: orden ? (v) => (v.data && !esTotal(v.data) ? orden(v.data as T) : null) : undefined,
        comparator: (a: ValorOrden, b: ValorOrden, _na: IRowNode, _nb: IRowNode, desc: boolean) => compararOrden(a, b, desc),
        sortable: Boolean(orden),
        sortingOrder: numero ? ['desc', 'asc', null] : ['asc', 'desc', null],
        initialSort: p.ordenInicial?.columna === c.id ? p.ordenInicial.direccion : undefined,
        cellRenderer: renderizador(c.id),
        cellClass: numero ? 'grilla-numero' : 'grilla-texto',
        headerClass: numero ? 'grilla-numero' : undefined,
        minWidth: c.ancho ?? 110,
        flex: c.flex ?? 1,
        hide: !visibles.has(c.id),
        autoHeight: c.altoAuto,
        wrapText: c.altoAuto,
        suppressMovable: true,
        resizable: false,
        suppressKeyboardEvent: suprimirTeclado,
        cellRendererParams: { suppressMouseEventHandling: mouseEnUnControl },
      }
    })
    if (ocultas.length) {
      defs.push({
        colId: ID_FICHA,
        headerName: '',
        sortable: false,
        cellRenderer: fichaRenderer,
        cellClass: 'grilla-ficha',
        width: 48,
        minWidth: 48,
        maxWidth: 48,
        suppressMovable: true,
        resizable: false,
        suppressKeyboardEvent: suprimirTeclado,
        cellRendererParams: { suppressMouseEventHandling: mouseEnUnControl },
      })
    }
    return defs
    // ordenInicial solo cuenta al crear la grilla (initialSort).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.columnas, visibles, ocultas, renderizador, fichaRenderer])

  // Si cambian las columnas (otra moneda, otra vista), se vuelven a dibujar las celdas.
  useEffect(() => {
    api.current?.refreshCells({ force: true })
  }, [p.columnas])

  const alto = altoGrilla({ filas: p.filas.length, maxFilas, altoFila, altoEncabezado, conTotales: hayTotales })
  const titulo = p.titulo
  const listo = useCallback(
    (e: GridReadyEvent) => {
      api.current = e.api
      // El nombre de la tabla para el lector de pantalla.
      contenedor.current?.querySelector('[role="treegrid"], [role="grid"]')?.setAttribute('aria-label', titulo)
    },
    [titulo],
  )

  const pinned = useMemo(() => (hayTotales ? [{ __total: true } as FilaTotal] : undefined), [hayTotales])
  const getRowId = useCallback((r: GetRowIdParams) => (esTotal(r.data) ? ID_TOTAL : props.current.idFila(r.data as T)), [])
  const getRowClass = useCallback((r: RowClassParams) => {
    const actual = props.current
    if (!actual.grupo || r.node.rowPinned || !r.data) return undefined
    return inicios.current.get(actual.idFila(r.data as T)) ? 'grilla-grupo-inicio' : undefined
  }, [])
  const postSortRows = useCallback((r: PostSortRowsParams) => {
    const actual = props.current
    if (!actual.grupo) return
    const filas = r.nodes.filter((n) => n.data && !esTotal(n.data)).map((n) => n.data as T)
    const ini = iniciosDeGrupo(filas.map((f) => actual.grupo!(f)))
    filas.forEach((f, i) => inicios.current.set(actual.idFila(f), ini[i]))
  }, [])

  // Las tarjetas del teléfono, en el orden con que arranca la grilla.
  const ordenadas = useMemo(() => {
    const col = p.ordenInicial ? p.columnas.find((c) => c.id === p.ordenInicial!.columna) : undefined
    return col?.orden ? ordenarFilas(p.filas, col.orden, p.ordenInicial!.direccion) : [...p.filas]
  }, [p.filas, p.columnas, p.ordenInicial])

  if (p.filas.length === 0) return <>{p.vacio ?? <Aviso>No hay nada para mostrar todavía.</Aviso>}</>

  const altoEsqueleto = alto ?? altoEncabezado + Math.min(p.filas.length, maxFilas) * altoFila + (hayTotales ? altoFila : 0) + 2
  return (
    <div className={`min-w-0 ${p.className ?? ''}`}>
      {/* ≥ 768 px: la grilla. */}
      <div ref={contenedor} className="grilla hidden min-w-0 md:block" data-grilla={p.titulo}>
        {escritorio && ancho > 0 ? (
          <AgGridReact
            theme={temaGrilla}
            loadThemeGoogleFonts={false}
            rowData={p.filas as T[]}
            columnDefs={columnDefs}
            getRowId={getRowId}
            pinnedBottomRowData={pinned}
            domLayout={alto === null ? 'autoHeight' : 'normal'}
            containerStyle={alto === null ? undefined : { height: alto }}
            rowHeight={altoFila}
            headerHeight={altoEncabezado}
            getRowClass={getRowClass}
            postSortRows={postSortRows}
            onSortChanged={(e) => {
              if (props.current.grupo) e.api.redrawRows()
            }}
            onGridReady={listo}
            onCellKeyDown={alApretarTecla}
            ensureDomOrder
            suppressColumnVirtualisation
            suppressRowVirtualisation={p.filas.length <= 200}
            suppressMovableColumns
            suppressCellFocus={false}
            animateRows={false}
            enableCellTextSelection
          />
        ) : (
          <div aria-hidden className="esqueleto rounded-tarjeta" style={{ height: altoEsqueleto }} />
        )}
      </div>

      {/* < 768 px: tarjetas (D-30). */}
      <ul aria-label={p.titulo} className="flex flex-col gap-3 md:hidden">
        {ordenadas.map((f) => (
          <li key={p.idFila(f)} className="min-w-0">
            {p.tarjeta ? p.tarjeta(f) : <TarjetaAuto fila={f} columnas={p.columnas} />}
          </li>
        ))}
        {hayTotales ? (
          <li className="min-w-0">
            <TarjetaTotales columnas={p.columnas} />
          </li>
        ) : null}
      </ul>

      {ficha !== null ? <Ficha fila={ficha} nombre={nombreFila(ficha)} columnas={p.columnas.filter((c) => ocultas.includes(c.id))} alCerrar={() => setFicha(null)} /> : null}
    </div>
  )
}

/** La tarjeta de una fila que arma la grilla con sus columnas: la primera arriba, las importantes en dos columnas y el resto al tocar. */
function TarjetaAuto<T>({ fila, columnas }: { fila: T; columnas: readonly ColumnaGrilla<T>[] }) {
  const [primera, ...resto] = columnas
  const clave = resto.filter((c) => (c.prioridad ?? 1) <= 1)
  const detalle = resto.filter((c) => (c.prioridad ?? 1) > 1)
  const par = (c: ColumnaGrilla<T>) => (
    <div key={c.id} className="flex min-w-0 flex-col gap-0.5">
      <dt className="rotulo text-[10px]">{c.titulo}</dt>
      <dd className={`min-w-0 break-words text-sm ${c.tipo === 'numero' ? 'num' : ''}`}>{c.celda(fila)}</dd>
    </div>
  )
  return (
    <div className="rounded-tarjeta border border-border bg-surface p-4">
      {primera ? <div className="min-w-0 text-[15px] font-medium">{primera.celda(fila)}</div> : null}
      {clave.length ? <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">{clave.map(par)}</dl> : null}
      {detalle.length ? (
        <details className="group mt-3 border-t border-border pt-2">
          <summary className="tocable flex cursor-pointer list-none items-center gap-1 text-[13px] text-muted">
            Ver más <span aria-hidden className="transition-transform group-open:rotate-90">▸</span>
          </summary>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3">{detalle.map(par)}</dl>
        </details>
      ) : null}
    </div>
  )
}

function TarjetaTotales<T>({ columnas }: { columnas: readonly ColumnaGrilla<T>[] }) {
  const [primera, ...resto] = columnas
  const conTotal = resto.filter((c) => c.total)
  return (
    <div className="rounded-tarjeta border border-border-strong bg-surface-2 p-4">
      <div className="text-[15px] font-medium">{primera?.total ? primera.total() : 'Total'}</div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
        {conTotal.map((c) => (
          <div key={c.id} className="flex min-w-0 flex-col gap-0.5">
            <dt className="rotulo text-[10px]">{c.titulo}</dt>
            <dd className={`min-w-0 break-words text-sm ${c.tipo === 'numero' ? 'num' : ''}`}>{c.total!()}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** La ficha de una fila: las columnas que no entran en el ancho, con sus cifras y sus trazas. */
function Ficha<T>({ fila, nombre, columnas, alCerrar }: { fila: T; nombre: string; columnas: readonly ColumnaGrilla<T>[]; alCerrar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-t`}
      onClose={alCerrar}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close()
      }}
      className="hoja m-auto w-[min(32rem,calc(100vw-2rem))] rounded-tarjeta border border-border bg-surface p-0 text-text shadow-[var(--glass-shadow)]"
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="rotulo text-[10px]">Lo que no entra en la tabla</p>
            <h2 id={`${id}-t`} className="mt-1 text-[15px] font-medium">
              {nombre}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Cerrar"
            className="tocable grid size-8 shrink-0 place-items-center rounded-full border border-border text-muted hover:text-text"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
        <dl className="flex flex-col">
          {columnas.map((c) => (
            <div key={c.id} className="flex min-w-0 items-baseline justify-between gap-4 border-t border-border py-2">
              <dt className="rotulo shrink-0 text-[10px]">{c.titulo}</dt>
              <dd className={`min-w-0 text-right text-sm ${c.tipo === 'numero' ? 'num' : ''}`}>{c.celda(fila)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </dialog>
  )
}
