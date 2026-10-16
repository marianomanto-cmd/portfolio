'use client'

// Resultados por activo y cuenta (plan §4 B.1, bloque 4): por partida, o
// agrupados por cuenta o por activo, y ordenables por cualquier columna. Es la
// Grilla común (AG Grid, D-157): por partida, el orden lo hace la grilla (al
// tocar un encabezado o con "Ordenar por"); agrupados, cada cuenta o activo va
// con su subtotal arriba y sus partidas debajo, en el orden de "Ordenar por".
// Todo llega calculado (cada subtotal con su traza): acá solo se elige qué
// mostrar y en qué orden. Debajo de 768 px, tarjetas.

import { useMemo, useState } from 'react'
import type { Par } from '@/lib/vistas/contratos'
import type { FilaResultado, GrupoVista, MonedaElegida, TotalesResultado } from '@/lib/vistas/contratos-evolucion'
import { Grilla, type ColumnaGrilla } from '@/components/grilla'
import { SegmentadoBotones } from '@/components/pantalla/segmentado'
import { anchoMontos } from '../_lib/anchos'
import { gruposOrdenados, ORDEN_INICIAL, type ColumnaOrden, type Orden } from '../_lib/orden'
import { ChipFirmeza, CifraPar, CifraPct } from './cifras'

type Modo = 'partida' | 'cuenta' | 'activo'
type Col = 'resultado' | 'activo' | 'tc' | 'sin_atribuir' | 'realizado' | 'no_realizado'

const MODOS: { valor: Modo; nombre: string }[] = [
  { valor: 'partida', nombre: 'Por partida' },
  { valor: 'cuenta', nombre: 'Por cuenta' },
  { valor: 'activo', nombre: 'Por activo' },
]

const COLUMNAS: { clave: Col; nombre: string; color?: boolean; prioridad: number }[] = [
  { clave: 'resultado', nombre: 'Resultado', color: true, prioridad: 0 },
  { clave: 'activo', nombre: 'Por el precio', prioridad: 1 },
  { clave: 'tc', nombre: 'Por el dólar', prioridad: 1 },
  { clave: 'sin_atribuir', nombre: 'Sin atribuir', prioridad: 3 },
  { clave: 'realizado', nombre: 'Realizado', prioridad: 2 },
  { clave: 'no_realizado', nombre: 'No realizado', prioridad: 2 },
]

const ORDENES: { col: ColumnaOrden; nombre: string }[] = [
  { col: 'resultado', nombre: 'Resultado' },
  { col: 'activo', nombre: 'Por el precio' },
  { col: 'tc', nombre: 'Por el dólar' },
  { col: 'realizado', nombre: 'Realizado' },
  { col: 'no_realizado', nombre: 'No realizado' },
  { col: 'nombre', nombre: 'Nombre' },
]

const SELECT = 'tocable h-9 min-w-0 rounded-item border border-border bg-surface px-2.5 pr-7 text-sm text-text hover:border-border-strong max-md:h-11'

/** Una fila de la grilla: una partida, o el subtotal de una cuenta o un activo (agrupado). */
type FilaTabla = { tipo: 'fila'; f: FilaResultado; sangria: boolean } | { tipo: 'grupo'; g: GrupoVista }

function NoAplica() {
  return <span className="text-[13px] italic text-muted">no aplica</span>
}

function CeldaPar({ par, moneda, titulo, signo = true, color = false, vertical = true }: { par: Par | null; moneda: MonedaElegida; titulo: string; signo?: boolean; color?: boolean; vertical?: boolean }) {
  if (!par) return <NoAplica />
  return <CifraPar par={par} moneda={moneda} titulo={titulo} signo={signo} color={color} vertical={vertical} />
}

const nombreFila = (f: FilaResultado) => (f.cuenta ? `${f.ticker} · ${f.cuenta}` : f.ticker)
const nombreGrupo = (g: GrupoVista) => `${g.nombre} · ${g.claves.length === 1 ? '1 partida' : `${g.claves.length} partidas`}`
const nombre = (x: FilaTabla) => (x.tipo === 'fila' ? nombreFila(x.f) : nombreGrupo(x.g))
const parDe = (x: FilaTabla, c: Col): Par | null => (x.tipo === 'fila' ? x.f[c] : x.g[c])

function TarjetaFila({ x, moneda, k }: { x: FilaTabla; moneda: MonedaElegida; k: 'ars' | 'usd' }) {
  const grupo = x.tipo === 'grupo'
  const titulo = nombre(x)
  const resultado = x.tipo === 'fila' ? x.f.resultado : x.g.resultado
  const peso = x.tipo === 'fila' ? x.f.peso : x.g.peso
  return (
    <div data-tarjeta={x.tipo === 'fila' ? x.f.ticker : undefined} className={`rounded-tarjeta border p-4 ${grupo ? 'border-border-strong bg-surface-2' : 'border-border bg-surface'}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className={`flex min-w-0 items-center gap-2 ${grupo ? 'font-semibold' : 'font-medium'}`}>
          {x.tipo === 'fila' ? <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: x.f.color }} /> : null}
          <span className="min-w-0 break-words">{titulo}</span>
          <ChipFirmeza par={resultado} />
        </span>
        <CifraPar par={resultado} moneda={moneda} titulo={`${titulo} · resultado`} signo color />
      </div>
      <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-[13px]">
        {COLUMNAS.slice(1).map((c) => (
          <div key={c.clave} className="contents">
            <dt className="text-muted">{c.nombre}</dt>
            <dd className="text-right">
              {/* En la tarjeta, pesos y dólares lado a lado (se apilan solo si no entran). */}
              <CeldaPar par={parDe(x, c.clave)} moneda={moneda} titulo={`${titulo} · ${c.nombre.toLowerCase()}`} vertical={false} />
            </dd>
          </div>
        ))}
        <div className="contents">
          <dt className="text-muted">% del resultado</dt>
          <dd className="text-right">
            <CifraPct calc={peso[k]} titulo={`${titulo} · % del resultado`} />
          </dd>
        </div>
      </dl>
    </div>
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
  const agrupado = modo !== 'partida'

  const filasTabla = useMemo<FilaTabla[]>(
    () =>
      modo === 'partida'
        ? filas.map((f) => ({ tipo: 'fila', f, sangria: false }))
        : gruposOrdenados(grupos[modo], filas, orden, k).flatMap((b): FilaTabla[] => [{ tipo: 'grupo', g: b.grupo }, ...b.filas.map((f): FilaTabla => ({ tipo: 'fila', f, sangria: true }))]),
    [modo, filas, grupos, orden, k],
  )

  const columnas = useMemo<ColumnaGrilla<FilaTabla>[]>(() => {
    // Por partida ordena la grilla; agrupados, el orden es el de "Ordenar por" (un subtotal no se mezcla con partidas de otra cuenta).
    const ordenable = <T,>(fn: (x: FilaTabla) => T) => (agrupado ? undefined : fn)
    return [
      {
        id: 'nombre',
        titulo: 'Partida',
        ancho: 190,
        flex: 1.8,
        prioridad: 0,
        altoAuto: true,
        orden: ordenable((x) => nombre(x)),
        celda: (x) =>
          x.tipo === 'grupo' ? (
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 font-semibold">
              {x.g.nombre} <span className="font-normal text-muted">· {x.g.claves.length === 1 ? '1 partida' : `${x.g.claves.length} partidas`}</span> <ChipFirmeza par={x.g.resultado} />
            </span>
          ) : (
            <span data-fila={x.f.ticker} className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 ${x.sangria ? 'pl-4' : ''}`}>
              <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: x.f.color }} />
              <span className="min-w-0 break-words">{nombreFila(x.f)}</span>
              <ChipFirmeza par={x.f.resultado} />
            </span>
          ),
        total: () => (
          <span className="flex items-center gap-2 font-semibold">
            Total <ChipFirmeza par={totales.resultado} />
          </span>
        ),
      },
      ...COLUMNAS.map(
        (c): ColumnaGrilla<FilaTabla> => ({
          id: c.clave,
          titulo: c.nombre,
          tipo: 'numero',
          // Lo que pide el monto más largo de la columna (subtotales y total incluidos): ninguna cifra se sale de su celda.
          ancho: anchoMontos([...filasTabla.map((x) => parDe(x, c.clave)), totales[c.clave]], moneda, { signo: true, color: c.color, minimo: moneda === 'ambas' ? 128 : 116 }),
          prioridad: c.prioridad,
          orden: ordenable((x) => parDe(x, c.clave)?.[k].valor ?? null),
          celda: (x) => (
            <span className={x.tipo === 'grupo' ? 'font-semibold' : ''}>
              <CeldaPar par={parDe(x, c.clave)} moneda={moneda} titulo={`${nombre(x)} · ${c.nombre.toLowerCase()}${x.tipo === 'grupo' ? ' (subtotal)' : ''}`} color={c.color} />
            </span>
          ),
          total: () => <CeldaPar par={totales[c.clave]} moneda={moneda} titulo={`Total · ${c.nombre.toLowerCase()}`} color={c.color} />,
        }),
      ),
      {
        id: 'peso',
        titulo: '% del resultado',
        tipo: 'numero',
        ancho: 140,
        prioridad: 3,
        orden: ordenable((x) => (x.tipo === 'fila' ? x.f.peso[k].valor : x.g.peso[k].valor)),
        celda: (x) => <CifraPct calc={x.tipo === 'fila' ? x.f.peso[k] : x.g.peso[k]} titulo={`${nombre(x)} · % del resultado`} />,
      },
    ]
  }, [agrupado, moneda, k, totales, filasTabla])

  const ordenInicial = agrupado ? undefined : { columna: orden.col, direccion: orden.desc ? ('desc' as const) : ('asc' as const) }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <SegmentadoBotones etiqueta="Cómo agrupar" opciones={MODOS} actual={modo} alElegir={setModo} />
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
                ? [
                    <option key="nombre:asc" value="nombre:asc">
                      Nombre (A a Z)
                    </option>,
                  ]
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
      <Grilla
        // Cada orden, agrupamiento o moneda arma la grilla de nuevo con ese orden de partida.
        key={`${modo}:${orden.col}:${orden.desc}:${moneda}`}
        titulo={`Resultado del período ${modo === 'partida' ? 'por partida' : modo === 'cuenta' ? 'por cuenta' : 'por activo'}, partido en precio, dólar, realizado y no realizado`}
        filas={filasTabla}
        columnas={columnas}
        idFila={(x) => (x.tipo === 'fila' ? `f:${x.f.clave}` : `g:${x.g.clave}`)}
        nombreFila={nombre}
        ordenInicial={ordenInicial}
        grupo={agrupado ? (x) => (x.tipo === 'grupo' ? x.g.clave : (grupos[modo as 'cuenta' | 'activo'].find((g) => g.claves.includes(x.f.clave))?.clave ?? x.f.clave)) : undefined}
        altoFila={moneda === 'ambas' ? 56 : 44}
        maxFilas={60}
        tarjeta={(x) => <TarjetaFila x={x} moneda={moneda} k={k} />}
      />
    </>
  )
}
