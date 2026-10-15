'use client'

// Resultados por activo y cuenta (plan §4 B.1, bloque 4): por partida, o
// agrupados por cuenta o por activo, y ordenables por cualquier columna. Todo
// llega calculado (cada subtotal con su traza): acá solo se elige qué mostrar
// y en qué orden. Con lugar, tabla densa; en el teléfono y en columnas
// angostas, tarjetas (la tarjeta, no la pantalla, decide).

import { useState } from 'react'
import type { Par } from '@/lib/vistas/contratos'
import type { FilaResultado, GrupoVista, MonedaElegida, TotalesResultado } from '@/lib/vistas/contratos-evolucion'
import { gruposOrdenados, ordenar, ORDEN_INICIAL, siguienteOrden, type ColumnaOrden, type Orden } from '../_lib/orden'
import { ChipFirmeza, CifraPar, CifraPct } from './cifras'

type Modo = 'partida' | 'cuenta' | 'activo'
type Col = 'resultado' | 'activo' | 'tc' | 'sin_atribuir' | 'realizado' | 'no_realizado'

const MODOS: { modo: Modo; nombre: string }[] = [
  { modo: 'partida', nombre: 'Por partida' },
  { modo: 'cuenta', nombre: 'Por cuenta' },
  { modo: 'activo', nombre: 'Por activo' },
]

const COLUMNAS: { clave: Col; nombre: string; color?: boolean }[] = [
  { clave: 'resultado', nombre: 'Resultado', color: true },
  { clave: 'activo', nombre: 'Por el precio' },
  { clave: 'tc', nombre: 'Por el dólar' },
  { clave: 'sin_atribuir', nombre: 'Sin atribuir' },
  { clave: 'realizado', nombre: 'Realizado' },
  { clave: 'no_realizado', nombre: 'No realizado' },
]

const ORDENES: { col: ColumnaOrden; nombre: string }[] = [
  { col: 'resultado', nombre: 'Resultado' },
  { col: 'activo', nombre: 'Por el precio' },
  { col: 'tc', nombre: 'Por el dólar' },
  { col: 'realizado', nombre: 'Realizado' },
  { col: 'no_realizado', nombre: 'No realizado' },
  { col: 'nombre', nombre: 'Nombre' },
]

const SELECT = 'tocable h-9 min-w-0 rounded-lg border border-border bg-surface px-2.5 pr-7 text-sm text-text hover:border-border-strong max-md:h-11'

function NoAplica() {
  return <span className="text-[13px] italic text-muted">no aplica</span>
}

function CeldaPar({ par, moneda, titulo, signo = true, color = false, vertical = true }: { par: Par | null; moneda: MonedaElegida; titulo: string; signo?: boolean; color?: boolean; vertical?: boolean }) {
  if (!par) return <NoAplica />
  return <CifraPar par={par} moneda={moneda} titulo={titulo} signo={signo} color={color} vertical={vertical} />
}

const nombreFila = (f: FilaResultado) => (f.cuenta ? `${f.ticker} · ${f.cuenta}` : f.ticker)

/** El sentido del orden para un lector de pantalla. */
const ariaSort = (o: Orden, col: ColumnaOrden) => (o.col === col ? (o.desc ? 'descending' : 'ascending') : 'none')

function Encabezado({ col, nombre, orden, alOrdenar, alinear }: { col: ColumnaOrden; nombre: string; orden: Orden; alOrdenar: (c: ColumnaOrden) => void; alinear: 'left' | 'right' }) {
  const activo = orden.col === col
  return (
    <th scope="col" aria-sort={ariaSort(orden, col)} className={`px-1 py-1 font-medium ${alinear === 'left' ? 'text-left' : 'text-right'}`}>
      <button
        type="button"
        onClick={() => alOrdenar(col)}
        className={`tocable inline-flex min-h-9 items-center gap-1 rounded px-1 ${alinear === 'right' ? 'flex-row-reverse text-right' : ''} ${activo ? 'text-text' : 'text-muted hover:text-text'}`}
      >
        <span>{nombre}</span>
        <span aria-hidden className={activo ? '' : 'opacity-0'}>
          {orden.desc ? '↓' : '↑'}
        </span>
      </button>
    </th>
  )
}

function FilaTabla({ f, moneda, k, sangria }: { f: FilaResultado; moneda: MonedaElegida; k: 'ars' | 'usd'; sangria: boolean }) {
  return (
    <tr data-fila={f.ticker} className="align-top">
      <th scope="row" className={`py-2 pr-2 text-left font-normal ${sangria ? 'pl-4' : ''}`}>
        <span className="flex min-w-0 items-center gap-2">
          <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: f.color }} />
          <span className="min-w-0 break-words">{nombreFila(f)}</span>
          <ChipFirmeza par={f.resultado} />
        </span>
      </th>
      {COLUMNAS.map((c) => (
        <td key={c.clave} className="px-1 py-2 text-right">
          <CeldaPar par={f[c.clave]} moneda={moneda} titulo={`${nombreFila(f)} · ${c.nombre.toLowerCase()}`} color={c.color} />
        </td>
      ))}
      <td className="py-2 pl-1 text-right">
        <CifraPct calc={f.peso[k]} titulo={`${nombreFila(f)} · % del resultado`} />
      </td>
    </tr>
  )
}

function FilaGrupo({ g, moneda, k }: { g: GrupoVista; moneda: MonedaElegida; k: 'ars' | 'usd' }) {
  return (
    <tr className="bg-surface-2 align-top font-semibold">
      <th scope="rowgroup" className="py-2 pl-2 pr-2 text-left">
        {g.nombre} <span className="font-normal text-muted">· {g.claves.length === 1 ? '1 partida' : `${g.claves.length} partidas`}</span> <ChipFirmeza par={g.resultado} />
      </th>
      {COLUMNAS.map((c) => (
        <td key={c.clave} className="px-1 py-2 text-right">
          <CeldaPar par={g[c.clave]} moneda={moneda} titulo={`${g.nombre} · ${c.nombre.toLowerCase()} (subtotal)`} color={c.color} />
        </td>
      ))}
      <td className="py-2 pl-1 pr-2 text-right">
        <CifraPct calc={g.peso[k]} titulo={`${g.nombre} · % del resultado`} />
      </td>
    </tr>
  )
}

function TarjetaFila({ titulo, resultado, pares, peso, moneda, k, grupo = false, color, dataTarjeta }: {
  titulo: React.ReactNode
  resultado: Par
  pares: Record<Col, Par | null>
  peso: Par | null
  moneda: MonedaElegida
  k: 'ars' | 'usd'
  grupo?: boolean
  color?: string
  dataTarjeta?: string
}) {
  const nombre = typeof titulo === 'string' ? titulo : 'Total'
  return (
    <li data-tarjeta={dataTarjeta} className={`rounded-lg border border-border p-3 ${grupo ? 'col-span-full bg-surface-2' : ''}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className={`flex min-w-0 items-center gap-2 ${grupo ? 'font-semibold' : 'font-medium'}`}>
          {color ? <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: color }} /> : null}
          <span className="min-w-0 break-words">{titulo}</span>
          <ChipFirmeza par={resultado} />
        </span>
        <CifraPar par={resultado} moneda={moneda} titulo={`${nombre} · resultado`} signo color />
      </div>
      <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-[13px]">
        {COLUMNAS.slice(1).map((c) => (
          <div key={c.clave} className="contents">
            <dt className="text-muted">{c.nombre}</dt>
            <dd className="text-right">
              {/* En la tarjeta, pesos y dólares lado a lado (se apilan solo si no entran): la mitad de alto en el teléfono. */}
              <CeldaPar par={pares[c.clave]} moneda={moneda} titulo={`${nombre} · ${c.nombre.toLowerCase()}`} vertical={false} />
            </dd>
          </div>
        ))}
        {peso ? (
          <div className="contents">
            <dt className="text-muted">% del resultado</dt>
            <dd className="text-right">
              <CifraPct calc={peso[k]} titulo={`${nombre} · % del resultado`} />
            </dd>
          </div>
        ) : null}
      </dl>
    </li>
  )
}

export function TablaResultados({
  filas,
  grupos,
  totales,
  moneda,
}: {
  filas: FilaResultado[]
  grupos: { cuenta: GrupoVista[]; activo: GrupoVista[] }
  totales: TotalesResultado
  moneda: MonedaElegida
}) {
  const [modo, setModo] = useState<Modo>('partida')
  const [orden, setOrden] = useState<Orden>(ORDEN_INICIAL)
  // Se ordena en la moneda que mirás (con las dos, en pesos).
  const k: 'ars' | 'usd' = moneda === 'usd' ? 'usd' : 'ars'
  const alOrdenar = (c: ColumnaOrden) => setOrden((o) => siguienteOrden(o, c))
  const bloques = modo === 'partida' ? [{ grupo: null, filas: ordenar(filas, orden, k) }] : gruposOrdenados(grupos[modo], filas, orden, k)
  const totalPares: Record<Col, Par | null> = totales

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div role="group" aria-label="Cómo agrupar" className="inline-grid grid-cols-3 gap-1 rounded-xl border border-border bg-surface-2 p-1">
          {MODOS.map((x) => (
            <button
              key={x.modo}
              type="button"
              aria-pressed={modo === x.modo}
              onClick={() => setModo(x.modo)}
              className={`tocable min-h-9 rounded-lg px-3 text-sm ${modo === x.modo ? 'bg-surface font-semibold shadow-[var(--shadow)]' : 'text-muted hover:text-text'}`}
            >
              {x.nombre}
            </button>
          ))}
        </div>
        {/* En el teléfono, el selector toma lo que queda de la fila (y recorta el texto) en vez de salirse de la tarjeta. */}
        <label className="flex w-full min-w-0 items-center gap-2 text-sm text-muted sm:w-auto">
          <span className="shrink-0">Ordenar por</span>
          <select
            className={`${SELECT} flex-1 sm:flex-none`}
            value={`${orden.col}:${orden.desc ? 'desc' : 'asc'}`}
            onChange={(e) => {
              const [col, sentido] = e.target.value.split(':') as [ColumnaOrden, string]
              setOrden({ col, desc: sentido === 'desc' })
            }}
          >
            {ORDENES.flatMap((o) =>
              o.col === 'nombre'
                ? [<option key="nombre:asc" value="nombre:asc">Nombre (A a Z)</option>]
                : [
                    <option key={`${o.col}:desc`} value={`${o.col}:desc`}>
                      {o.nombre}, de mayor a menor
                    </option>,
                    <option key={`${o.col}:asc`} value={`${o.col}:asc`}>
                      {o.nombre}, de menor a mayor
                    </option>,
                  ],
            )}
            {orden.col === 'nombre' && orden.desc ? <option value="nombre:desc">Nombre (Z a A)</option> : null}
            {orden.col === 'sin_atribuir' || orden.col === 'peso' ? (
              <option value={`${orden.col}:${orden.desc ? 'desc' : 'asc'}`}>{orden.col === 'peso' ? '% del resultado' : 'Sin atribuir'}</option>
            ) : null}
          </select>
        </label>
      </div>

      {/* Tabla densa desde 768 px de pantalla y con lugar en la tarjeta (ocho columnas no entran en menos de 1000 px sin pisarse). */}
      <table className="hidden w-full table-fixed text-[13px] md:@min-[1000px]:table">
        <caption className="sr-only">Resultado del período {modo === 'partida' ? 'por partida' : modo === 'cuenta' ? 'por cuenta' : 'por activo'}, partido en precio, dólar, realizado y no realizado</caption>
        <colgroup>
          <col className="w-[20%]" />
          {COLUMNAS.map((c) => (
            <col key={c.clave} />
          ))}
          <col className="w-[8%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-border text-[12px] text-muted">
            <Encabezado col="nombre" nombre="Partida" orden={orden} alOrdenar={alOrdenar} alinear="left" />
            {COLUMNAS.map((c) => (
              <Encabezado key={c.clave} col={c.clave} nombre={c.nombre} orden={orden} alOrdenar={alOrdenar} alinear="right" />
            ))}
            <Encabezado col="peso" nombre="% del resultado" orden={orden} alOrdenar={alOrdenar} alinear="right" />
          </tr>
        </thead>
        {bloques.map((b) => (
          <tbody key={b.grupo?.clave ?? 'todas'} className="divide-y divide-border border-b border-border">
            {b.grupo ? <FilaGrupo g={b.grupo} moneda={moneda} k={k} /> : null}
            {b.filas.map((f) => (
              <FilaTabla key={f.clave} f={f} moneda={moneda} k={k} sangria={Boolean(b.grupo)} />
            ))}
          </tbody>
        ))}
        <tfoot>
          <tr className="border-t-2 border-border font-semibold">
            <th scope="row" className="py-2 pr-2 text-left">
              Total <ChipFirmeza par={totales.resultado} />
            </th>
            {COLUMNAS.map((c) => (
              <td key={c.clave} className="px-1 py-2 text-right">
                <CeldaPar par={totales[c.clave]} moneda={moneda} titulo={`Total · ${c.nombre.toLowerCase()}`} color={c.color} />
              </td>
            ))}
            <td />
          </tr>
        </tfoot>
      </table>

      {/* Teléfono, tablet y columnas angostas: tarjetas. */}
      <ul className="grid gap-2 @min-[560px]:grid-cols-2 @min-[900px]:grid-cols-3 md:@min-[1000px]:hidden">
        {bloques.flatMap((b) => [
          ...(b.grupo
            ? [
                <TarjetaFila
                  key={`g:${b.grupo.clave}`}
                  grupo
                  titulo={`${b.grupo.nombre} · ${b.grupo.claves.length === 1 ? '1 partida' : `${b.grupo.claves.length} partidas`}`}
                  resultado={b.grupo.resultado}
                  pares={b.grupo}
                  peso={b.grupo.peso}
                  moneda={moneda}
                  k={k}
                />,
              ]
            : []),
          ...b.filas.map((f) => (
            <TarjetaFila key={f.clave} dataTarjeta={f.ticker} titulo={nombreFila(f)} color={f.color} resultado={f.resultado} pares={f} peso={f.peso} moneda={moneda} k={k} />
          )),
        ])}
        <TarjetaFila grupo titulo="Total" resultado={totales.resultado} pares={totalPares} peso={null} moneda={moneda} k={k} />
      </ul>
    </>
  )
}
