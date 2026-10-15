'use client'

// Registro como tabla (el primer uso real de la Grilla, D-157): una fila por
// lote (todo lo que guardó un Enter), con sus cargas, el tiempo activo y
// Revertir. Debajo de 768 px, una tarjeta por lote, con las cargas al tocar.
// Las cuentas (qué grabó, cuándo, cuánto tardó) están en ../_lib/lotes.ts.

import { FileSpreadsheet, Image as ImagenIcono, Keyboard } from 'lucide-react'
import { useMemo } from 'react'
import { fechaCorta } from '@/lib/domain/fechas'
import type { FilaRegistro } from '@/lib/vistas/contratos'
import { Grilla, type ColumnaGrilla } from '@/components/grilla'
import { RevertirLote } from '@/components/registro/revertir'
import type { EstadoReversion } from '@/components/registro/motivos'
import { Chip, Rotulo } from '@/components/ui'
import { conteo, duracion, guardado, resumenLote, type Lote } from '../_lib/lotes'
import { nombreOrigen, type Origen } from '../_lib/origen'

type Accion = (previo: EstadoReversion | null, datos: FormData) => Promise<EstadoReversion>

const ICONO: Record<Origen, typeof Keyboard> = {
  Excel: FileSpreadsheet,
  'planilla CSV': FileSpreadsheet,
  captura: ImagenIcono,
  manual: Keyboard,
  tipeado: Keyboard,
}

/** Las cargas de un lote: cuenta y origen, qué grabó (y de qué archivo), su número y su estado. */
export function ListaCargas({ filas }: { filas: FilaRegistro[] }) {
  return (
    <ul className="flex min-w-0 flex-col divide-y divide-border">
      {filas.map((f) => {
        const origen = nombreOrigen(f)
        const Icono = ICONO[origen]
        return (
          <li key={f.carga_id} className={`grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 py-1.5 first:pt-0 last:pb-0 ${f.estado !== 'vigente' ? 'text-muted' : ''}`}>
            <Icono aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
            <span className="min-w-0 text-sm leading-snug">
              <span className={`font-medium ${f.estado === 'revertida' ? 'line-through decoration-1' : ''}`}>{f.cuenta}</span>
              <span className="text-muted"> · {origen}</span>
              <span className="block text-[13px] text-muted">
                {conteo(f)}
                {f.archivo_path ? <span className="block truncate">{f.archivo_path.split('/').at(-1)}</span> : null}
              </span>
            </span>
            <span className="flex flex-col items-end gap-1 text-[12px] text-muted">
              <span className="num">#{f.carga_id}</span>
              {f.estado !== 'vigente' ? <Chip>{f.estado}</Chip> : null}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function Revertir({ l, accion }: { l: Lote; accion: Accion }) {
  const r = resumenLote(l)
  return r.hayVigentes && l.lote ? <RevertirLote lote={l.lote} resumen={r.resumen} accion={accion} /> : null
}

/** La tarjeta de un lote en el teléfono: el día, cuándo se guardó, cuánto tardó, las fuentes y las cargas al tocar. */
function TarjetaLote({ l, accion }: { l: Lote; accion: Accion }) {
  const r = resumenLote(l)
  return (
    <div className="rounded-tarjeta border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[15px] font-medium">
          {fechaCorta(l.fecha)} <span className="font-normal text-muted">· {guardado(l.fecha, l.creado)}</span>
        </h2>
        <span className="text-sm text-muted">
          {r.activoMs !== null ? (
            <>
              <span className="num font-medium text-text">{duracion(r.activoMs)}</span> activos
            </>
          ) : (
            'tiempo activo sin dato'
          )}
          {r.todasRevertidas ? <Chip className="ml-2">revertido</Chip> : null}
        </span>
      </div>
      {r.fuentes.length ? <p className="mt-0.5 text-[13px] text-muted">{r.fuentes.join(' · ')}</p> : null}
      <details className="group mt-2">
        <summary className="tocable flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-text">
          {l.filas.length === 1 ? 'Ver la carga' : `Ver las ${l.filas.length} cargas`} <span aria-hidden className="transition-transform group-open:rotate-90">▸</span>
        </summary>
        <div className="mt-2 border-t border-border pt-2">
          <ListaCargas filas={l.filas} />
        </div>
      </details>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-2">
        <Rotulo as="p" className="self-center">
          {l.lote ? `Lote ${l.lote.slice(0, 8)}` : 'Carga suelta'}
        </Rotulo>
        <Revertir l={l} accion={accion} />
      </div>
    </div>
  )
}

export function TablaRegistro({ lotes, accion }: { lotes: Lote[]; accion: Accion }) {
  const columnas = useMemo<ColumnaGrilla<Lote>[]>(
    () => [
      {
        id: 'fecha',
        titulo: 'Datos del',
        ancho: 170,
        prioridad: 0,
        altoAuto: true,
        orden: (l) => l.creado,
        celda: (l) => {
          const r = resumenLote(l)
          return (
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium">{fechaCorta(l.fecha)}</span>
              <span className="text-[12px] leading-snug text-muted">{guardado(l.fecha, l.creado)}</span>
              {r.todasRevertidas ? <Chip className="mt-1 self-start">revertido</Chip> : null}
            </span>
          )
        },
      },
      {
        id: 'cargas',
        titulo: 'Cargas',
        ancho: 280,
        flex: 3,
        prioridad: 0,
        altoAuto: true,
        celda: (l) => <ListaCargas filas={l.filas} />,
      },
      {
        id: 'tiempo',
        titulo: 'Tiempo activo',
        tipo: 'numero',
        ancho: 130,
        prioridad: 2,
        altoAuto: true,
        orden: (l) => resumenLote(l).activoMs,
        celda: (l) => {
          const ms = resumenLote(l).activoMs
          return ms !== null ? <span className="num">{duracion(ms)}</span> : <span className="text-muted italic">sin dato</span>
        },
      },
      {
        id: 'lote',
        titulo: 'Lote',
        ancho: 220,
        flex: 1.2,
        prioridad: 0,
        altoAuto: true,
        celda: (l) => (
          <span className="flex min-w-0 flex-col items-start gap-2">
            <span className="num text-[12px] text-muted">{l.lote ? l.lote.slice(0, 8) : 'carga suelta'}</span>
            <Revertir l={l} accion={accion} />
          </span>
        ),
      },
    ],
    [accion],
  )
  return (
    <Grilla
      titulo="Registro de cargas: un lote por fila"
      filas={lotes}
      columnas={columnas}
      idFila={(l) => l.clave}
      nombreFila={(l) => `${fechaCorta(l.fecha)}, ${guardado(l.fecha, l.creado)}`}
      ordenInicial={{ columna: 'fecha', direccion: 'desc' }}
      tarjeta={(l) => <TarjetaLote l={l} accion={accion} />}
      maxFilas={25}
    />
  )
}
