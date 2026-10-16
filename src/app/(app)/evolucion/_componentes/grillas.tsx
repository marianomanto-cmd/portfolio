'use client'

// Las tablas del detalle de Evolución en la Grilla común (AG Grid, D-157): el
// PnL por mes, lo que ya traías al día cero y el futuro mes a mes. Sin orden
// (van por fecha, o como las arma el motor); debajo de 768 px, tarjetas. Cada
// cifra abre su traza.

import { useMemo } from 'react'
import type { DiaCeroVista, FilaDiaCeroVista, MesFuturoVista, MesVista, MonedaElegida } from '@/lib/vistas/contratos-evolucion'
import { Grilla, type ColumnaGrilla } from '@/components/grilla'
import { anchoMontos } from '../_lib/anchos'
import { ChipEtiquetas, CifraPar } from './cifras'

function NoAplica() {
  return <span className="text-[13px] italic text-muted">no aplica</span>
}

const RESULTADO = new Set(['activo', 'tc', 'sin_atribuir'])

// ───────────── PnL por mes ─────────────

export function GrillaMeses({ meses, claves, nombres, moneda }: { meses: MesVista[]; claves: string[]; nombres: Record<string, string>; moneda: MonedaElegida }) {
  const columnas = useMemo<ColumnaGrilla<MesVista>[]>(
    () => [
      {
        id: 'mes',
        titulo: 'Mes',
        ancho: 110,
        flex: 1,
        prioridad: 0,
        altoAuto: true,
        celda: (x) => (
          <span className="flex flex-col">
            <span>{x.nombre}</span>
            {x.parcial ? <span className="text-[12px] text-muted">{x.parcial}</span> : null}
          </span>
        ),
      },
      ...claves.map(
        (c): ColumnaGrilla<MesVista> => ({
          id: c,
          titulo: nombres[c] ?? c,
          tipo: 'numero',
          // Lo que pide la cifra más larga de la columna (ninguna se sale de su celda).
          ancho: anchoMontos(
            meses.map((x) => x.lineas.find((y) => y.clave === c)?.valor ?? null),
            moneda,
            { signo: true, color: RESULTADO.has(c), minimo: 150 },
          ),
          prioridad: RESULTADO.has(c) ? 0 : 2,
          celda: (x) => {
            const l = x.lineas.find((y) => y.clave === c)
            return l ? <CifraPar par={l.valor} moneda={moneda} titulo={`${x.nombre} · ${l.nombre}`} signo color={RESULTADO.has(c)} vertical /> : <NoAplica />
          },
        }),
      ),
    ],
    [claves, nombres, moneda, meses],
  )
  return (
    <Grilla
      titulo="PnL por mes, una columna por línea del puente"
      filas={meses}
      columnas={columnas}
      idFila={(x) => x.mes}
      nombreFila={(x) => x.nombre}
      altoFila={moneda === 'ambas' ? 56 : 44}
      tarjeta={(x) => (
        <div className="rounded-tarjeta border border-border bg-surface p-4" data-mes={x.mes}>
          <p className="font-medium">
            {x.nombre} {x.parcial ? <span className="text-[13px] font-normal text-muted">· {x.parcial}</span> : null}
          </p>
          <dl className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-[13px]">
            {claves.map((c) => {
              const l = x.lineas.find((y) => y.clave === c)
              return (
                <div key={c} className="contents">
                  <dt className="text-muted">{nombres[c] ?? c}</dt>
                  <dd className="text-right">{l ? <CifraPar par={l.valor} moneda={moneda} titulo={`${x.nombre} · ${l.nombre}`} signo /> : <NoAplica />}</dd>
                </div>
              )
            })}
          </dl>
        </div>
      )}
    />
  )
}

// ───────────── Lo que ya traías al día cero ─────────────

const nombreDiaCero = (f: FilaDiaCeroVista) => (f.cuenta ? `${f.ticker} · ${f.cuenta}` : f.ticker)

export function GrillaDiaCero({ d, moneda }: { d: DiaCeroVista; moneda: MonedaElegida }) {
  const columnas = useMemo<ColumnaGrilla<FilaDiaCeroVista>[]>(
    () => [
      {
        id: 'posicion',
        titulo: 'Posición',
        ancho: 170,
        flex: 1.6,
        prioridad: 0,
        altoAuto: true,
        celda: (f) => (
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: f.color }} />
              <span className="min-w-0 break-words">{nombreDiaCero(f)}</span>
            </span>
            {f.pendiente ? <span className="text-[12px] leading-4 text-muted">{f.pendiente}</span> : null}
          </span>
        ),
        total: () => <span className="font-semibold">Total</span>,
      },
      { id: 'valor', titulo: 'Valor', tipo: 'numero', ancho: anchoMontos(d.filas.map((f) => f.valor), moneda, { minimo: 130 }), prioridad: 1, celda: (f) => <CifraPar par={f.valor} moneda={moneda} titulo={`${f.ticker} · valor el día cero`} vertical /> },
      { id: 'costo', titulo: 'Costo (PPP)', tipo: 'numero', ancho: anchoMontos(d.filas.map((f) => f.costo), moneda, { minimo: 130 }), prioridad: 2, celda: (f) => <CifraPar par={f.costo} moneda={moneda} titulo={`${f.ticker} · costo`} vertical /> },
      {
        id: 'resultado',
        titulo: 'Lo que ya traías',
        tipo: 'numero',
        ancho: anchoMontos([...d.filas.map((f) => f.resultado), d.total], moneda, { signo: true, color: true, minimo: 130 }),
        prioridad: 0,
        celda: (f) => <CifraPar par={f.resultado} moneda={moneda} titulo={`${f.ticker} · lo que ya traías`} signo color vertical />,
        total: () => <CifraPar par={d.total} moneda={moneda} titulo="Lo que ya traías al día cero · total" signo color vertical />,
      },
    ],
    [d.total, d.filas, moneda],
  )
  return (
    <Grilla
      titulo="Lo que ya traías al día cero, por posición"
      filas={d.filas}
      columnas={columnas}
      idFila={(f) => f.clave}
      nombreFila={nombreDiaCero}
      altoFila={moneda === 'ambas' ? 56 : 44}
      tarjeta={(f) => (
        <div className="rounded-tarjeta border border-border bg-surface p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="flex min-w-0 items-center gap-2 font-medium">
              <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: f.color }} />
              {nombreDiaCero(f)}
            </span>
            <CifraPar par={f.resultado} moneda={moneda} titulo={`${f.ticker} · lo que ya traías`} signo color />
          </div>
          <dl className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-[13px]">
            <dt className="text-muted">Valor el día cero</dt>
            <dd className="text-right">
              <CifraPar par={f.valor} moneda={moneda} titulo={`${f.ticker} · valor el día cero`} />
            </dd>
            <dt className="text-muted">Costo (PPP)</dt>
            <dd className="text-right">
              <CifraPar par={f.costo} moneda={moneda} titulo={`${f.ticker} · costo`} />
            </dd>
          </dl>
          {f.pendiente ? <p className="mt-1 text-[12px] leading-4 text-muted">{f.pendiente}</p> : null}
        </div>
      )}
    />
  )
}

// ───────────── El futuro, mes a mes ─────────────

export function GrillaFuturo({ meses, escenario, moneda }: { meses: MesFuturoVista[]; escenario: string; moneda: MonedaElegida }) {
  const columnas = useMemo<ColumnaGrilla<MesFuturoVista>[]>(
    () => [
      {
        id: 'mes',
        titulo: 'Mes',
        ancho: 130,
        flex: 1,
        prioridad: 0,
        celda: (x) => (
          <span className="flex flex-wrap items-center gap-1">
            {x.nombre} <ChipEtiquetas etiquetas={['supuesto', ...x.etiquetas]} />
          </span>
        ),
      },
      { id: 'financiero', titulo: 'Patrimonio', tipo: 'numero', ancho: anchoMontos(meses.map((x) => x.financiero), moneda, { minimo: 140 }), prioridad: 0, celda: (x) => <CifraPar par={x.financiero} moneda={moneda} titulo={`${x.nombre} · patrimonio financiero (supuesto)`} vertical /> },
      { id: 'aportes', titulo: 'Aportes', tipo: 'numero', ancho: anchoMontos(meses.map((x) => x.aportes), moneda, { signo: true, minimo: 130 }), prioridad: 1, celda: (x) => <CifraPar par={x.aportes} moneda={moneda} titulo={`${x.nombre} · aportes (supuesto)`} signo vertical /> },
      { id: 'activo', titulo: 'Por el precio', tipo: 'numero', ancho: anchoMontos(meses.map((x) => x.activo), moneda, { signo: true, minimo: 130 }), prioridad: 2, celda: (x) => <CifraPar par={x.activo} moneda={moneda} titulo={`${x.nombre} · por el precio (supuesto)`} signo vertical /> },
      { id: 'tc', titulo: 'Por el dólar', tipo: 'numero', ancho: anchoMontos(meses.map((x) => x.tc), moneda, { signo: true, minimo: 130 }), prioridad: 2, celda: (x) => <CifraPar par={x.tc} moneda={moneda} titulo={`${x.nombre} · por el dólar (supuesto)`} signo vertical /> },
    ],
    [moneda, meses],
  )
  return (
    <Grilla
      titulo={`PnL proyectado por mes en el escenario ${escenario}`}
      filas={meses}
      columnas={columnas}
      idFila={(x) => x.mes}
      nombreFila={(x) => x.nombre}
      altoFila={moneda === 'ambas' ? 56 : 44}
      maxFilas={36}
      tarjeta={(x) => (
        <div className="rounded-tarjeta border border-border bg-surface p-4" data-mes-futuro={x.mes}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="flex items-center gap-1.5 font-medium">
              {x.nombre} <ChipEtiquetas etiquetas={['supuesto', ...x.etiquetas]} />
            </span>
            <CifraPar par={x.financiero} moneda={moneda} titulo={`${x.nombre} · patrimonio financiero (supuesto)`} />
          </div>
          <dl className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-[13px]">
            <dt className="text-muted">Aportes</dt>
            <dd className="text-right">
              <CifraPar par={x.aportes} moneda={moneda} titulo={`${x.nombre} · aportes (supuesto)`} signo />
            </dd>
            <dt className="text-muted">Por el precio</dt>
            <dd className="text-right">
              <CifraPar par={x.activo} moneda={moneda} titulo={`${x.nombre} · por el precio (supuesto)`} signo />
            </dd>
            <dt className="text-muted">Por el dólar</dt>
            <dd className="text-right">
              <CifraPar par={x.tc} moneda={moneda} titulo={`${x.nombre} · por el dólar (supuesto)`} signo />
            </dd>
          </dl>
        </div>
      )}
    />
  )
}
