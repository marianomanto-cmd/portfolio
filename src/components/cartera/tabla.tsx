'use client'

import { ArrowDown, ArrowUp, ChevronRight } from 'lucide-react'
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { CalcVista } from '@/lib/domain/calc'
import { numero } from '@/lib/domain/dinero'
import { fechaCorta } from '@/lib/domain/fechas'
import type { FilaCartera, VistaCartera } from '@/lib/vistas/contratos'
import { compararCifras, decimalesPrecio, diasEnPosicion, fraccionDe, restoMayor, sumaColumna } from '@/components/calculos'
import { Monto, MontoTrazado, Porcentaje, SinDato } from '@/components/monto'
import { Traza } from '@/components/traza'
import { Chip, ChipEtiqueta, Rotulo } from '@/components/ui'

// Cartera (visión §4.5): la tabla densa del spec en doble moneda, con el
// desglose activo / TC. Desde 768 px es tabla, con prioridad de columnas según
// el ancho disponible (container queries: entran las que caben, en orden); las
// que no entran van al detalle de la fila. Debajo de 768 px, una tarjeta por
// posición.

const NOMBRE_TIPO: Record<string, string> = {
  cedear: 'CEDEAR',
  accion_local: 'Acción local',
  bono: 'Bono',
  lecap: 'LECAP',
  fci: 'FCI',
  liquidez: 'Liquidez',
}

const CERO_TC: CalcVista = {
  valor: '0',
  formula: 'TC = 0',
  explicacion: 'En la moneda en que arriesga, todo el resultado es del activo: el tipo de cambio no aporta (D-35).',
  insumos: [],
  etiquetas: [],
}

/** Desglose activo / TC en una moneda (D-68): en la moneda de riesgo, todo es activo. */
function desgloseEn(f: FilaCartera, moneda: 'ARS' | 'USD'): { activo: CalcVista; tc: CalcVista } | null {
  if (f.moneda_riesgo === moneda) return { activo: moneda === 'ARS' ? f.resultado.ars : f.resultado.usd, tc: CERO_TC }
  if (f.desglose && f.desglose.moneda === moneda) return { activo: f.desglose.activo, tc: f.desglose.tc }
  return null
}

const SIN_DESGLOSE: CalcVista = {
  valor: null,
  motivo: 'Sin el resultado en dólares no se puede separar activo de tipo de cambio. Si es una apertura sin CCL de compra, ese CCL se declara desde la 1b (Pendientes).',
  formula: 'sin dato',
  insumos: [],
  etiquetas: [],
}

// ───────────── Columnas ─────────────

type Clave = 'activo' | 'res_usd' | 'res_ars' | 'peso' | 'precio' | 'tc_usd' | 'tc_ars' | 'ppc_usd' | 'ppc_ars' | 'cantidad' | 'dias' | 'valor_ars' | 'valor_usd'

interface Columna {
  clave: Clave
  titulo: string
  corto?: string
  /** Desde qué ancho del contenedor entra (prioridad de la visión §4.5). */
  desde: string
  valor: (f: FilaCartera) => string | null
}

// Las clases tienen que estar escritas enteras para que Tailwind las genere.
const VISIBLE: Record<string, string> = {
  siempre: 'table-cell',
  c1: 'hidden @min-[560px]:table-cell',
  c2: 'hidden @min-[670px]:table-cell',
  c3: 'hidden @min-[820px]:table-cell',
  c4: 'hidden @min-[950px]:table-cell',
  c5: 'hidden @min-[1075px]:table-cell',
  c6: 'hidden @min-[1190px]:table-cell',
  c7: 'hidden @min-[1300px]:table-cell',
  c8: 'hidden @min-[1345px]:table-cell',
  c9: 'hidden @min-[1620px]:table-cell',
}
// Lo que se ve dentro del detalle de la fila: lo contrario de lo de arriba.
const EN_DETALLE: Record<string, string> = {
  siempre: 'hidden',
  c1: '@min-[560px]:hidden',
  c2: '@min-[670px]:hidden',
  c3: '@min-[820px]:hidden',
  c4: '@min-[950px]:hidden',
  c5: '@min-[1075px]:hidden',
  c6: '@min-[1190px]:hidden',
  c7: '@min-[1300px]:hidden',
  c8: '@min-[1345px]:hidden',
  c9: '@min-[1620px]:hidden',
}

const COLUMNAS: Columna[] = [
  { clave: 'activo', titulo: 'Activo', desde: 'siempre', valor: (f) => f.ticker },
  { clave: 'res_usd', titulo: 'Res. USD', desde: 'siempre', valor: (f) => f.resultado.usd.valor },
  { clave: 'res_ars', titulo: 'Res. ARS', desde: 'siempre', valor: (f) => f.resultado.ars.valor },
  { clave: 'peso', titulo: '% fin.', desde: 'c1', valor: (f) => f.peso.valor },
  { clave: 'precio', titulo: 'Precio', desde: 'c2', valor: (f) => f.precio.valor },
  { clave: 'tc_usd', titulo: 'Activo / TC en US$', desde: 'c3', valor: (f) => desgloseEn(f, 'USD')?.tc.valor ?? null },
  { clave: 'tc_ars', titulo: 'Activo / TC en $', desde: 'c4', valor: (f) => desgloseEn(f, 'ARS')?.tc.valor ?? null },
  { clave: 'ppc_usd', titulo: 'PPC USD', desde: 'c5', valor: (f) => f.ppc.usd.valor },
  { clave: 'ppc_ars', titulo: 'PPC ARS', desde: 'c6', valor: (f) => f.ppc.ars.valor },
  { clave: 'cantidad', titulo: 'Cant.', desde: 'c7', valor: (f) => f.cantidad.valor },
  { clave: 'dias', titulo: 'Días', desde: 'c8', valor: (f) => (f.dias_en_posicion === null ? null : String(f.dias_en_posicion)) },
  { clave: 'valor_ars', titulo: 'Valor $', desde: 'c9', valor: (f) => f.valor.ars.valor },
  { clave: 'valor_usd', titulo: 'Valor US$', desde: 'c9', valor: (f) => f.valor.usd.valor },
]

// ───────────── Celdas ─────────────

function Doble({ arriba, abajo }: { arriba: ReactNode; abajo?: ReactNode }) {
  return (
    <span className="inline-flex flex-col items-end leading-tight">
      <span>{arriba}</span>
      {abajo ? <span className="text-[12px] text-muted">{abajo}</span> : null}
    </span>
  )
}

function Celda({ f, k }: { f: FilaCartera; k: Clave }) {
  const t = f.ticker
  switch (k) {
    case 'res_usd':
      return <Doble arriba={<MontoTrazado calc={f.resultado.usd} moneda="USD" titulo={`${t} · resultado en dólares`} signo color />} abajo={f.resultado_pct.usd.valor !== null ? <Porcentaje calc={f.resultado_pct.usd} titulo={`${t} · resultado % en dólares`} /> : null} />
    case 'res_ars':
      return <Doble arriba={<MontoTrazado calc={f.resultado.ars} moneda="ARS" titulo={`${t} · resultado en pesos`} signo color />} abajo={f.resultado_pct.ars.valor !== null ? <Porcentaje calc={f.resultado_pct.ars} titulo={`${t} · resultado % en pesos`} /> : null} />
    case 'peso':
      return <Porcentaje calc={f.peso} titulo={`${t} · peso en el financiero`} signo={false} />
    case 'precio':
      return (
        <span className="inline-flex items-center gap-1.5">
          {f.precio_viejo ? <Chip>viejo{f.fecha_precio ? ` · ${fechaCorta(f.fecha_precio)}` : ''}</Chip> : null}
          <MontoTrazado calc={f.precio} moneda="ARS" titulo={`${t} · precio`} decimales={decimalesPrecio(f.precio.valor)} />
        </span>
      )
    case 'tc_usd':
    case 'tc_ars': {
      const moneda = k === 'tc_usd' ? 'USD' : 'ARS'
      const d = desgloseEn(f, moneda)
      if (!d) return <Traza calc={SIN_DESGLOSE} titulo={`${t} · activo / TC en ${moneda === 'USD' ? 'dólares' : 'pesos'}`}><SinDato motivo={SIN_DESGLOSE.motivo} /></Traza>
      // Lo que se ve suma exacto el resultado que se ve (resto mayor, visión §4.0).
      const total = moneda === 'USD' ? f.resultado.usd : f.resultado.ars
      const dec = moneda === 'USD' ? 2 : 0
      const r = total.valor !== null && d.activo.valor !== null && d.tc.valor !== null ? restoMayor(total.valor, [d.activo.valor, d.tc.valor], dec) : null
      return (
        <Doble
          arriba={
            <Traza calc={d.activo} titulo={`${t} · lo que puso el activo`} moneda={moneda}>
              <Monto valor={r ? r.partes[0].toFixed() : d.activo.valor} moneda={moneda} decimales={dec} signo />
            </Traza>
          }
          abajo={
            <span className="inline-flex items-center gap-1">
              <span>TC</span>
              <Traza calc={d.tc} titulo={`${t} · lo que puso el tipo de cambio`} moneda={moneda}>
                <Monto valor={r ? r.partes[1].toFixed() : d.tc.valor} moneda={moneda} decimales={dec} signo />
              </Traza>
            </span>
          }
        />
      )
    }
    case 'ppc_usd':
      return (
        <Doble
          arriba={<MontoTrazado calc={f.ppc.usd} moneda="USD" titulo={`${t} · PPC en dólares`} decimales={decimalesPrecio(f.ppc.usd.valor)} />}
          abajo={<ChipEtiqueta calc={f.ppc.usd} omitir={['parcial']} />}
        />
      )
    case 'ppc_ars':
      return (
        <Doble
          arriba={<MontoTrazado calc={f.ppc.ars} moneda="ARS" titulo={`${t} · PPC en pesos`} decimales={decimalesPrecio(f.ppc.ars.valor)} />}
          abajo={<ChipEtiqueta calc={f.ppc.ars} omitir={['parcial', 'declarado']} />}
        />
      )
    case 'cantidad':
      return (
        <Traza calc={f.cantidad} titulo={`${t} · cantidad`}>
          {f.cantidad.valor === null ? <SinDato /> : <span className="num">{numero(f.cantidad.valor, 4, { min: 0 })}</span>}
        </Traza>
      )
    case 'dias': {
      // De dónde se cuentan, a la vista: "desde apertura" no es cuánto hace que la tenés.
      const c = diasEnPosicion(f.dias_en_posicion, f.dias_desde)
      return (
        <Doble
          arriba={
            <Traza calc={c} titulo={`${t} · días en posición`}>
              {c.valor === null ? <SinDato motivo={c.motivo} /> : <span className="num">{c.valor}</span>}
            </Traza>
          }
          abajo={f.dias_desde === 'apertura' ? <Chip>desde apertura</Chip> : <ChipEtiqueta calc={c} />}
        />
      )
    }
    case 'valor_ars':
      return <MontoTrazado calc={f.valor.ars} moneda="ARS" titulo={`${t} · valor en pesos`} />
    case 'valor_usd':
      return <MontoTrazado calc={f.valor.usd} moneda="USD" titulo={`${t} · valor en dólares`} />
    default:
      return null
  }
}

function Activo({ f }: { f: FilaCartera }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: f.color }} />
      <span className="min-w-0">
        <span className={`block font-semibold ${f.precio_viejo ? 'italic text-muted' : ''}`}>{f.ticker}</span>
        <span className="block truncate text-[12px] text-muted">
          {NOMBRE_TIPO[f.tipo] ?? f.tipo} · {f.cuenta}
        </span>
      </span>
    </span>
  )
}

// ───────────── Filtros ─────────────

interface Filtros {
  cuenta: string
  clase: string
  moneda: string
  sinDato: boolean
  viejos: boolean
}
const SIN_FILTRO: Filtros = { cuenta: '', clase: '', moneda: '', sinDato: false, viejos: false }

function tieneSinDato(f: FilaCartera): boolean {
  return [f.resultado.ars, f.resultado.usd, f.ppc.ars, f.ppc.usd, f.precio, f.valor.ars, f.valor.usd].some((c) => c.valor === null)
}

function pasa(f: FilaCartera, x: Filtros): boolean {
  if (x.cuenta && f.cuenta !== x.cuenta) return false
  if (x.clase && f.tipo !== x.clase) return false
  if (x.moneda && f.moneda_riesgo !== x.moneda) return false
  if (x.sinDato && !tieneSinDato(f)) return false
  if (x.viejos && !f.precio_viejo) return false
  return true
}

const SELECT =
  'tocable h-9 min-w-0 rounded-lg border border-border bg-surface px-2.5 pr-7 text-sm text-text hover:border-border-strong max-md:h-11'

function BarraFiltros({ filas, x, setX }: { filas: FilaCartera[]; x: Filtros; setX: (f: Filtros) => void }) {
  const cuentas = [...new Set(filas.map((f) => f.cuenta))].filter(Boolean)
  const clases = [...new Set(filas.filter((f) => f.tipo !== 'liquidez').map((f) => f.tipo))]
  const activos = x.cuenta || x.clase || x.moneda || x.sinDato || x.viejos
  const toggle = (k: 'sinDato' | 'viejos', etiqueta: string) => (
    <button
      type="button"
      aria-pressed={x[k]}
      onClick={() => setX({ ...x, [k]: !x[k] })}
      className={`tocable inline-flex h-9 items-center rounded-lg border px-3 text-sm max-md:h-11 ${
        x[k] ? 'border-accent bg-accent-soft font-medium text-accent' : 'border-border bg-surface text-text hover:border-border-strong'
      }`}
    >
      {etiqueta}
    </button>
  )
  return (
    <div role="group" aria-label="Filtros" className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="f-cuenta">Cuenta</label>
      <select id="f-cuenta" className={SELECT} value={x.cuenta} onChange={(e) => setX({ ...x, cuenta: e.target.value })}>
        <option value="">Todas las cuentas</option>
        {cuentas.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <label className="sr-only" htmlFor="f-clase">Clase</label>
      <select id="f-clase" className={SELECT} value={x.clase} onChange={(e) => setX({ ...x, clase: e.target.value })}>
        <option value="">Todas las clases</option>
        {clases.map((c) => (
          <option key={c} value={c}>{NOMBRE_TIPO[c] ?? c}</option>
        ))}
      </select>
      <label className="sr-only" htmlFor="f-moneda">Moneda de riesgo</label>
      <select id="f-moneda" className={SELECT} value={x.moneda} onChange={(e) => setX({ ...x, moneda: e.target.value })}>
        <option value="">Pesos y dólares</option>
        <option value="USD">Arriesga dólares</option>
        <option value="ARS">Arriesga pesos</option>
      </select>
      {toggle('sinDato', 'Solo con sin dato')}
      {toggle('viejos', 'Solo precios viejos')}
      {activos ? (
        <button type="button" onClick={() => setX(SIN_FILTRO)} className="tocable inline-flex h-9 items-center rounded-lg px-2 text-sm text-accent hover:underline max-md:h-11">
          Limpiar filtros
        </button>
      ) : null}
    </div>
  )
}

// ───────────── Totales ─────────────

function useTotales(pos: FilaCartera[], liq: FilaCartera[], completo: boolean, v: VistaCartera) {
  return useMemo(() => {
    const col = (sel: (f: FilaCartera) => CalcVista, u: 'ARS' | 'USD' | 'fraccion', e: string, filas = pos) =>
      sumaColumna(filas.map((f) => ({ nombre: f.ticker, calc: sel(f) })), u, e)
    const d = (f: FilaCartera, m: 'ARS' | 'USD', k: 'activo' | 'tc') => desgloseEn(f, m)?.[k] ?? SIN_DESGLOSE
    return {
      resArs: col((f) => f.resultado.ars, 'ARS', 'Resultado en pesos de las posiciones a la vista, desde la compra.'),
      resUsd: col((f) => f.resultado.usd, 'USD', 'Resultado en dólares de las posiciones a la vista, cada compra a su CCL.'),
      actArs: col((f) => d(f, 'ARS', 'activo'), 'ARS', 'Lo que pusieron los activos, en pesos.'),
      tcArs: col((f) => d(f, 'ARS', 'tc'), 'ARS', 'Lo que puso el tipo de cambio, en pesos.'),
      actUsd: col((f) => d(f, 'USD', 'activo'), 'USD', 'Lo que pusieron los activos, en dólares.'),
      tcUsd: col((f) => d(f, 'USD', 'tc'), 'USD', 'Lo que puso el tipo de cambio, en dólares.'),
      peso: col((f) => f.peso, 'fraccion', 'Qué parte del financiero son las posiciones a la vista.'),
      valorArs: col((f) => f.valor.ars, 'ARS', 'Valor de las posiciones a la vista, en pesos.'),
      valorUsd: col((f) => f.valor.usd, 'USD', 'Valor de las posiciones a la vista, en dólares.'),
      liqArs: col((f) => f.valor.ars, 'ARS', 'Tu liquidez, en pesos.', liq),
      liqUsd: col((f) => f.valor.usd, 'USD', 'Tu liquidez, en dólares.', liq),
      liqPeso: col((f) => f.peso, 'fraccion', 'Qué parte del financiero es liquidez.', liq),
      pctArs: completo ? fraccionDe(v.totales.resultado.ars, v.totales.costo.ars, 'ARS', 'Resultado total en pesos sobre lo que te costaron tus títulos.') : null,
      pctUsd: completo ? fraccionDe(v.totales.resultado.usd, v.totales.costo.usd, 'USD', 'Resultado total en dólares sobre lo que te costaron tus títulos.') : null,
    }
  }, [pos, liq, completo, v])
}

function TotalCelda({
  t,
  moneda,
  titulo,
  signo = true,
  color = true,
  rotulo,
}: {
  t: ReturnType<typeof sumaColumna>
  moneda: 'ARS' | 'USD'
  titulo: string
  signo?: boolean
  color?: boolean
  /** Rótulo pegado al total, en su renglón ("TC sin dato"), y la suma parcial debajo. */
  rotulo?: string
}) {
  const total = <MontoTrazado calc={t.total} moneda={moneda} titulo={titulo} signo={signo} color={color} />
  return (
    <span className="inline-flex flex-col items-end leading-tight">
      {rotulo ? (
        <span className="inline-flex items-baseline gap-1">
          <span>{rotulo}</span>
          {total}
        </span>
      ) : (
        total
      )}
      {t.parcial ? (
        <span className="flex flex-col items-end text-[12px] font-normal text-muted">
          <span>suma parcial ({t.contadas} de {t.de})</span>
          <MontoTrazado calc={t.parcial} moneda={moneda} titulo={`${titulo} · suma parcial`} signo={signo} />
        </span>
      ) : null}
    </span>
  )
}

// ───────────── La tabla ─────────────

export function TablaCartera({ v }: { v: VistaCartera }) {
  const [x, setX] = useState<Filtros>(SIN_FILTRO)
  const [orden, setOrden] = useState<{ k: Clave; asc: boolean } | null>(null)
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set())
  // Red de seguridad de la prioridad de columnas: si con los datos reales la
  // tabla igual no entra, se ocultan columnas del final hasta que entre (y
  // pasan al detalle de la fila). Nunca scroll horizontal (D-30).
  const [recorte, setRecorte] = useState(0)
  const contenedor = useRef<HTMLDivElement>(null)
  const tabla = useRef<HTMLTableElement>(null)
  useLayoutEffect(() => {
    const c = contenedor.current
    const t = tabla.current
    if (!c || !t || c.clientWidth === 0) return
    if (t.scrollWidth > c.clientWidth + 1 && recorte < COLUMNAS.length - 3) setRecorte((r) => r + 1)
  })
  useEffect(() => {
    const c = contenedor.current
    if (!c || typeof ResizeObserver === 'undefined') return
    let ancho = c.clientWidth
    const ro = new ResizeObserver(() => {
      if (c.clientWidth !== ancho) {
        ancho = c.clientWidth
        setRecorte(0)
      }
    })
    ro.observe(c)
    return () => ro.disconnect()
  }, [])
  const clase = (i: number, desde: string) => (i >= COLUMNAS.length - recorte ? 'hidden' : VISIBLE[desde])
  const forzadas = new Set(COLUMNAS.slice(COLUMNAS.length - recorte).map((c) => c.clave))

  const posiciones = useMemo(() => v.filas.filter((f) => f.tipo !== 'liquidez'), [v.filas])
  const liquidez = useMemo(() => v.filas.filter((f) => f.tipo === 'liquidez'), [v.filas])
  const visibles = useMemo(() => {
    const fs = posiciones.filter((f) => pasa(f, x))
    if (!orden) return fs
    const col = COLUMNAS.find((c) => c.clave === orden.k)!
    return [...fs].sort((a, b) => {
      const r = orden.k === 'activo' ? a.ticker.localeCompare(b.ticker) : compararCifras(col.valor(a), col.valor(b))
      return orden.asc ? r : -r
    })
  }, [posiciones, x, orden])
  const liqVisible = useMemo(() => liquidez.filter((f) => (!x.cuenta || f.cuenta === x.cuenta) && (!x.moneda || f.moneda_riesgo === x.moneda) && !x.clase && !x.sinDato && !x.viejos), [liquidez, x])
  const completo = visibles.length === posiciones.length
  const tot = useTotales(visibles, liqVisible, completo, v)

  const ordenar = (k: Clave) =>
    setOrden((o) => (o && o.k === k ? (o.asc ? { k, asc: false } : null) : { k, asc: k === 'activo' }))
  const alternar = (k: string) =>
    setAbiertas((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })

  return (
    <div className="flex flex-col gap-3">
      <BarraFiltros filas={v.filas} x={x} setX={setX} />
      <p className="text-[13px] text-muted" aria-live="polite">
        {visibles.length} de {posiciones.length} posiciones
        {v.fecha_datos ? ` · al cierre del ${fechaCorta(v.fecha_datos)}` : ''} · CCL{' '}
        <Traza calc={v.ccl} titulo="CCL de la foto">
          {v.ccl.valor === null ? <SinDato /> : <span className="num">{numero(v.ccl.valor, 2)}</span>}
        </Traza>
        {v.fecha_ccl && v.fecha_datos && v.fecha_ccl !== v.fecha_datos ? ` del ${fechaCorta(v.fecha_ccl)} (ese día no cargaste CCL)` : ''}{' '}
        <ChipEtiqueta calc={v.ccl} />
      </p>

      {/* ≥ 768 px: tabla */}
      <div ref={contenedor} className="@container hidden md:block">
        <table ref={tabla} className="w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">Posiciones, con resultado en pesos y en dólares y su desglose entre activo y tipo de cambio</caption>
          <thead>
            <tr>
              {COLUMNAS.map((c, i) => {
                const activo = orden?.k === c.clave
                return (
                  <th
                    key={c.clave}
                    scope="col"
                    aria-sort={activo ? (orden!.asc ? 'ascending' : 'descending') : 'none'}
                    className={`${clase(i, c.desde)} sticky top-[var(--barra-sup)] z-10 border-b border-border bg-bg px-2 py-2 text-[12px] font-medium text-muted first:pl-3 ${c.clave === 'activo' ? 'text-left' : 'text-right'}`}
                  >
                    <button
                      type="button"
                      onClick={() => ordenar(c.clave)}
                      className={`tocable inline-flex items-center gap-1 whitespace-nowrap rounded hover:text-text ${activo ? 'text-text' : ''}`}
                    >
                      {c.titulo}
                      {activo ? orden!.asc ? <ArrowUp aria-hidden className="size-3" /> : <ArrowDown aria-hidden className="size-3" /> : null}
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visibles.map((f) => {
              const abierta = abiertas.has(f.clave)
              return (
                <Fragment key={f.clave}>
                  <tr className="group" data-fila={f.ticker}>
                    {COLUMNAS.map((c, i) => (
                      <td
                        key={c.clave}
                        className={`${clase(i, c.desde)} border-b border-border bg-surface px-2 py-1.5 align-middle group-hover:bg-surface-2 first:pl-3 ${c.clave === 'activo' ? 'text-left' : 'whitespace-nowrap text-right'} ${f.precio_viejo ? 'italic' : ''} max-lg:h-11`}
                      >
                        {c.clave === 'activo' ? (
                          <button
                            type="button"
                            onClick={() => alternar(f.clave)}
                            aria-expanded={abierta}
                            aria-label={`${f.ticker}: ${abierta ? 'ocultar' : 'ver'} el detalle`}
                            className="tocable flex w-full items-center gap-1 text-left"
                          >
                            <ChevronRight aria-hidden className={`size-4 shrink-0 text-muted transition-transform ${abierta ? 'rotate-90' : ''}`} />
                            <Activo f={f} />
                          </button>
                        ) : (
                          <Celda f={f} k={c.clave} />
                        )}
                      </td>
                    ))}
                  </tr>
                  {abierta ? (
                    <tr>
                      <td colSpan={COLUMNAS.length} className="border-b border-border bg-surface-2 px-3 py-3">
                        <Detalle f={f} forzadas={forzadas} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
            {visibles.length === 0 ? (
              <tr>
                <td colSpan={COLUMNAS.length} className="border-b border-border bg-surface px-3 py-6 text-center text-muted">
                  Ninguna posición con esos filtros.
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr className="font-medium">
              {COLUMNAS.map((c, i) => (
                <td
                  key={c.clave}
                  className={`${clase(i, c.desde)} sticky bottom-0 z-10 border-y border-border-strong bg-surface-2 px-2 py-2 align-top first:pl-3 ${c.clave === 'activo' ? 'text-left' : 'whitespace-nowrap text-right'}`}
                >
                  <PieCelda k={c.clave} tot={tot} n={visibles.length} />
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
        {liqVisible.length ? <BloqueLiquidez filas={liqVisible} tot={tot} v={v} /> : null}
      </div>

      {/* < 768 px: tarjetas */}
      <ul className="flex flex-col gap-2 md:hidden" aria-label="Posiciones">
        {visibles.map((f) => (
          <TarjetaPosicion key={f.clave} f={f} abierta={abiertas.has(f.clave)} alternar={() => alternar(f.clave)} />
        ))}
        {visibles.length === 0 ? <li className="rounded-xl border border-border bg-surface p-4 text-center text-sm text-muted">Ninguna posición con esos filtros.</li> : null}
        <li className="rounded-xl border border-border-strong bg-surface-2 p-3">
          <Rotulo as="p">Totales · {visibles.length} posiciones</Rotulo>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
            <div>
              <dt className="text-[12px] text-muted">Res. ARS</dt>
              <dd><TotalCelda t={tot.resArs} moneda="ARS" titulo="Resultado total en pesos" /></dd>
            </div>
            <div className="text-right">
              <dt className="text-[12px] text-muted">Res. USD</dt>
              <dd><TotalCelda t={tot.resUsd} moneda="USD" titulo="Resultado total en dólares" /></dd>
            </div>
            <div>
              <dt className="text-[12px] text-muted">Valor</dt>
              <dd><MontoTrazado calc={tot.valorArs.total} moneda="ARS" titulo="Valor de las posiciones en pesos" /></dd>
            </div>
            <div className="text-right">
              <dt className="text-[12px] text-muted">en dólares</dt>
              <dd><MontoTrazado calc={tot.valorUsd.total} moneda="USD" titulo="Valor de las posiciones en dólares" /></dd>
            </div>
          </dl>
        </li>
        {liqVisible.length ? (
          <li className="rounded-xl border border-border bg-surface p-3">
            <Rotulo as="p">Liquidez</Rotulo>
            <ul className="mt-1 divide-y divide-border">
              {liqVisible.map((f) => (
                <li key={f.clave} className="flex items-center justify-between gap-2 py-1">
                  <span className="min-w-0 text-sm">
                    {f.nombre}
                    <span className="block text-[12px] text-muted">
                      <Porcentaje calc={f.peso} titulo={`${f.nombre} · peso`} signo={false} /> del financiero
                    </span>
                  </span>
                  <span className="flex flex-col items-end">
                    <MontoTrazado calc={f.moneda_riesgo === 'USD' ? f.valor.usd : f.valor.ars} moneda={f.moneda_riesgo} titulo={`${f.nombre} · valor`} />
                    <MontoTrazado calc={f.moneda_riesgo === 'USD' ? f.valor.ars : f.valor.usd} moneda={f.moneda_riesgo === 'USD' ? 'ARS' : 'USD'} titulo={`${f.nombre} · valor`} className="text-[13px]" />
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-1 flex items-center justify-between gap-2 border-t border-border pt-1 text-sm font-medium">
              <span>Patrimonio financiero</span>
              <span className="flex flex-col items-end">
                <MontoTrazado calc={v.totales.valor.ars} moneda="ARS" titulo="Patrimonio financiero en pesos" />
                <MontoTrazado calc={v.totales.valor.usd} moneda="USD" titulo="Patrimonio financiero en dólares" />
              </span>
            </div>
          </li>
        ) : null}
      </ul>
    </div>
  )
}

function PieCelda({ k, tot, n }: { k: Clave; tot: ReturnType<typeof useTotales>; n: number }) {
  switch (k) {
    case 'activo':
      return <span className="pl-5">Totales · {n} posiciones</span>
    case 'res_ars':
      return (
        <span className="inline-flex flex-col items-end leading-tight">
          <TotalCelda t={tot.resArs} moneda="ARS" titulo="Resultado total en pesos" />
          {tot.pctArs ? <span className="text-[12px] text-muted"><Porcentaje calc={tot.pctArs} titulo="Resultado total % en pesos" /></span> : null}
        </span>
      )
    case 'res_usd':
      return <TotalCelda t={tot.resUsd} moneda="USD" titulo="Resultado total en dólares" />
    case 'peso':
      return <Porcentaje calc={tot.peso.total} titulo="Peso de las posiciones" signo={false} />
    case 'tc_ars':
      return (
        <span className="inline-flex flex-col items-end gap-0.5 leading-tight">
          <TotalCelda t={tot.actArs} moneda="ARS" titulo="Lo que pusieron los activos, en pesos" color={false} />
          <span className="text-[12px] text-muted">
            <TotalCelda t={tot.tcArs} moneda="ARS" titulo="Lo que puso el TC, en pesos" color={false} rotulo="TC" />
          </span>
        </span>
      )
    case 'tc_usd':
      return (
        <span className="inline-flex flex-col items-end gap-0.5 leading-tight">
          <TotalCelda t={tot.actUsd} moneda="USD" titulo="Lo que pusieron los activos, en dólares" color={false} />
          <span className="text-[12px] text-muted">
            <TotalCelda t={tot.tcUsd} moneda="USD" titulo="Lo que puso el TC, en dólares" color={false} rotulo="TC" />
          </span>
        </span>
      )
    case 'valor_ars':
      return <MontoTrazado calc={tot.valorArs.total} moneda="ARS" titulo="Valor de las posiciones en pesos" />
    case 'valor_usd':
      return <MontoTrazado calc={tot.valorUsd.total} moneda="USD" titulo="Valor de las posiciones en dólares" />
    default:
      return null
  }
}

function BloqueLiquidez({ filas, tot, v }: { filas: FilaCartera[]; tot: ReturnType<typeof useTotales>; v: VistaCartera }) {
  return (
    <div className="mt-4 rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <Rotulo>Liquidez</Rotulo>
        <span className="text-[12px] text-muted">en tu cuenta, sin costo de compra</span>
      </div>
      <table className="w-full text-sm">
        <caption className="sr-only">Liquidez por cuenta y moneda</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Cuenta</th>
            <th scope="col">Valor en pesos</th>
            <th scope="col">Valor en dólares</th>
            <th scope="col">Peso</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.clave} className="border-b border-border last:border-0">
              <td className="px-3 py-1.5">
                <span className="flex items-center gap-2">
                  <span aria-hidden className="size-2.5 rounded-full" style={{ background: f.color }} />
                  {f.nombre}
                  {f.precio_viejo ? <Chip>viejo</Chip> : null}
                </span>
              </td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right"><MontoTrazado calc={f.valor.ars} moneda="ARS" titulo={`${f.nombre} · en pesos`} /></td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right"><MontoTrazado calc={f.valor.usd} moneda="USD" titulo={`${f.nombre} · en dólares`} /></td>
              <td className="whitespace-nowrap px-3 py-1.5 text-right"><Porcentaje calc={f.peso} titulo={`${f.nombre} · peso`} signo={false} /></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-surface-2 font-medium">
            <td className="px-3 py-2">Liquidez</td>
            <td className="whitespace-nowrap px-2 py-2 text-right"><MontoTrazado calc={tot.liqArs.total} moneda="ARS" titulo="Liquidez en pesos" /></td>
            <td className="whitespace-nowrap px-2 py-2 text-right"><MontoTrazado calc={tot.liqUsd.total} moneda="USD" titulo="Liquidez en dólares" /></td>
            <td className="whitespace-nowrap px-3 py-2 text-right"><Porcentaje calc={tot.liqPeso.total} titulo="Peso de la liquidez" signo={false} /></td>
          </tr>
          <tr className="bg-surface-2 font-semibold">
            <td className="rounded-bl-xl px-3 py-2">Patrimonio financiero</td>
            <td className="whitespace-nowrap px-2 py-2 text-right"><MontoTrazado calc={v.totales.valor.ars} moneda="ARS" titulo="Patrimonio financiero en pesos" /></td>
            <td className="whitespace-nowrap px-2 py-2 text-right"><MontoTrazado calc={v.totales.valor.usd} moneda="USD" titulo="Patrimonio financiero en dólares" /></td>
            <td className="rounded-br-xl px-3 py-2 text-right"><span className="num">100%</span></td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

/** Lo que no entra en la fila: las columnas ocultas por ancho, el valor y lo pendiente. */
function Detalle({ f, forzadas }: { f: FilaCartera; forzadas: Set<Clave> }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] text-muted">
        {f.nombre} · {NOMBRE_TIPO[f.tipo] ?? f.tipo} · arriesga {f.moneda_riesgo === 'USD' ? 'dólares' : 'pesos'} · {f.cuenta}
      </p>
      <dl className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-x-6 gap-y-2">
        <div>
          <dt className="text-[12px] text-muted">Valor</dt>
          <dd className="flex flex-wrap gap-x-2">
            <MontoTrazado calc={f.valor.ars} moneda="ARS" titulo={`${f.ticker} · valor en pesos`} />
            <MontoTrazado calc={f.valor.usd} moneda="USD" titulo={`${f.ticker} · valor en dólares`} />
          </dd>
        </div>
        {COLUMNAS.filter((c) => c.clave !== 'activo' && c.clave !== 'valor_ars' && c.clave !== 'valor_usd').map((c) => (
          <div key={c.clave} className={forzadas.has(c.clave) ? '' : EN_DETALLE[c.desde]}>
            <dt className="text-[12px] text-muted">{c.titulo}</dt>
            <dd><Celda f={f} k={c.clave} /></dd>
          </div>
        ))}
      </dl>
      {f.desglose && f.desglose.sin_atribuir.valor !== null && !/^-?0(\.0+)?$/.test(f.desglose.sin_atribuir.valor) ? (
        <p className="text-[13px] text-muted">
          Sin atribuir hoy (sin precio o CCL nuevo):{' '}
          <MontoTrazado calc={f.desglose.sin_atribuir} moneda={f.desglose.moneda} titulo={`${f.ticker} · sin atribuir`} signo />
        </p>
      ) : null}
      {f.dias_desde === 'declarada' ? (
        <p className="text-[13px] text-muted">Los días se cuentan desde la fecha de compra que declaraste.</p>
      ) : f.dias_desde === 'apertura' ? (
        <p className="text-[13px] text-muted">Los días se cuentan desde la apertura en la app: no declaraste la fecha de compra.</p>
      ) : null}
      {f.pendiente ? <p className="text-[13px] text-muted">{f.pendiente}</p> : null}
    </div>
  )
}

// ───────────── Teléfono: una tarjeta por posición ─────────────

function TarjetaPosicion({ f, abierta, alternar }: { f: FilaCartera; abierta: boolean; alternar: () => void }) {
  const enUsd = f.moneda_riesgo === 'USD'
  const grande = enUsd ? f.valor.usd : f.valor.ars
  const chico = enUsd ? f.valor.ars : f.valor.usd
  const d = desgloseEn(f, enUsd ? 'ARS' : 'USD')
  const frase =
    d && d.tc.valor !== null && (enUsd ? f.resultado.ars : f.resultado.usd).valor !== null ? (
      <p className="text-[13px] leading-5 text-muted">
        De tus <MontoTrazado calc={enUsd ? f.resultado.ars : f.resultado.usd} moneda={enUsd ? 'ARS' : 'USD'} titulo={`${f.ticker} · resultado`} signo compacta /> en {enUsd ? 'pesos' : 'dólares'},{' '}
        <MontoTrazado calc={d.tc} moneda={enUsd ? 'ARS' : 'USD'} titulo={`${f.ticker} · lo que puso el CCL`} signo compacta /> fueron el CCL
      </p>
    ) : null
  return (
    <li className={`rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow)]`} data-tarjeta={f.ticker}>
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 flex-col items-start gap-1">
          <Activo f={f} />
          {f.precio_viejo ? <Chip>viejo{f.fecha_precio ? ` · ${fechaCorta(f.fecha_precio)}` : ''}</Chip> : null}
        </span>
        <span className="shrink-0 text-right text-[12px] text-muted">
          <Porcentaje calc={f.peso} titulo={`${f.ticker} · peso en el financiero`} signo={false} />
          <span className="block">del financiero</span>
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3">
        <MontoTrazado calc={grande} moneda={f.moneda_riesgo} titulo={`${f.ticker} · valor`} className="cifra text-xl font-semibold" />
        <MontoTrazado calc={chico} moneda={enUsd ? 'ARS' : 'USD'} titulo={`${f.ticker} · valor`} className="text-sm" />
      </div>
      <dl className="mt-1 grid grid-cols-2 gap-x-3">
        {(enUsd ? (['usd', 'ars'] as const) : (['ars', 'usd'] as const)).map((m) => (
          <div key={m} className={m === (enUsd ? 'ars' : 'usd') ? 'text-right' : ''}>
            <dt className="text-[12px] text-muted">Res. {m.toUpperCase()}</dt>
            <dd className={`flex flex-col ${m === (enUsd ? 'ars' : 'usd') ? 'items-end' : 'items-start'}`}>
              <MontoTrazado calc={f.resultado[m]} moneda={m === 'usd' ? 'USD' : 'ARS'} titulo={`${f.ticker} · resultado en ${m === 'usd' ? 'dólares' : 'pesos'}`} signo color compacta />
              {f.resultado_pct[m].valor !== null ? <Porcentaje calc={f.resultado_pct[m]} titulo={`${f.ticker} · resultado %`} color /> : null}
            </dd>
          </div>
        ))}
      </dl>
      {frase}
      {f.ganas_pesos_perdes_dolares ? <Chip className="mt-1">ganás en pesos, perdés en dólares</Chip> : null}
      <button type="button" onClick={alternar} aria-expanded={abierta} className="tocable mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-accent">
        {abierta ? 'Menos' : 'Más datos'} <ChevronRight aria-hidden className={`size-4 transition-transform ${abierta ? 'rotate-90' : ''}`} />
      </button>
      {abierta ? (
        <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border pt-2">
          {(['precio', 'cantidad', 'ppc_ars', 'ppc_usd', 'dias'] as const).map((k) => (
            <div key={k} className="min-w-0">
              <dt className="text-[12px] text-muted">{COLUMNAS.find((c) => c.clave === k)!.titulo}</dt>
              <dd className="min-w-0"><Celda f={f} k={k} /></dd>
            </div>
          ))}
        </dl>
      ) : null}
      {abierta && f.pendiente ? <p className="mt-1 text-[13px] text-muted">{f.pendiente}</p> : null}
    </li>
  )
}
