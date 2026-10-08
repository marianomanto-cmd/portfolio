import { FileSpreadsheet, Image as ImagenIcono, Keyboard } from 'lucide-react'
import type { Metadata } from 'next'
import { fechaCorta, ZONA } from '@/lib/domain/fechas'
import { vistaRegistro } from '@/lib/vistas'
import type { FilaRegistro, VistaRegistro } from '@/lib/vistas/contratos'
import { ErrorVista } from '@/components/error-vista'
import { RevertirLote } from '@/components/registro/revertir'
import { Chip, Rotulo, Tarjeta } from '@/components/ui'
import { revertirLoteAccion } from './acciones'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Registro' }

// Registro (visión §4.3): el log de cargas por lote (un Enter puede crear varias
// cargas), con el archivo, lo que entró, cuánto tardó y la opción de revertir.

const hora = new Intl.DateTimeFormat('es-AR', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

function duracion(ms: number): string {
  // Espacio fino entre número y unidad: en la fuente mono, el espacio común queda ancho.
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}\u202Fs`
  const m = Math.floor(s / 60)
  return `${m}\u202Fmin${s % 60 ? ` ${s % 60}\u202Fs` : ''}`
}

const ORIGEN: Record<FilaRegistro['origen'], { nombre: string; Icono: typeof Keyboard }> = {
  excel: { nombre: 'Excel', Icono: FileSpreadsheet },
  captura: { nombre: 'captura', Icono: ImagenIcono },
  manual: { nombre: 'tipeado', Icono: Keyboard },
}

interface Lote {
  clave: string
  lote: string | null
  fecha: string
  creado: string
  filas: FilaRegistro[]
}

function agrupar(filas: FilaRegistro[]): Lote[] {
  const m = new Map<string, Lote>()
  for (const f of filas) {
    const k = f.lote ?? `carga-${f.carga_id}`
    const l = m.get(k)
    if (l) {
      l.filas.push(f)
      if (f.creado_en > l.creado) l.creado = f.creado_en
    } else m.set(k, { clave: k, lote: f.lote, fecha: f.fecha, creado: f.creado_en, filas: [f] })
  }
  return [...m.values()].sort((a, b) => (a.creado < b.creado ? 1 : -1))
}

function conteo(f: FilaRegistro): string {
  const p = [
    f.cotizaciones ? `${f.cotizaciones} precio${f.cotizaciones > 1 ? 's' : ''}` : null,
    f.saldos ? `${f.saldos} saldo${f.saldos > 1 ? 's' : ''}` : null,
    f.operaciones ? `${f.operaciones} operaci${f.operaciones > 1 ? 'ones' : 'ón'}` : null,
  ].filter(Boolean)
  if (f.cuenta === 'Tipo de cambio' && !p.length) return 'CCL y cripto'
  return p.length ? p.join(' · ') : 'sin filas'
}

export default async function PaginaRegistro() {
  let v: VistaRegistro
  try {
    v = await vistaRegistro()
  } catch (e) {
    return (
      <>
        <h1 className="sr-only">Registro</h1>
        <ErrorVista error={e} que="el registro de cargas" />
      </>
    )
  }
  const lotes = agrupar(v.filas)
  const vigentes = v.filas.filter((f) => f.estado === 'vigente').length
  return (
    <div className="flex flex-col gap-3">
      <h1 className="sr-only">Registro de cargas</h1>
      <p className="text-sm text-muted">
        {lotes.length} lote{lotes.length === 1 ? '' : 's'} · {v.filas.length} carga{v.filas.length === 1 ? '' : 's'} ({vigentes} vigente{vigentes === 1 ? '' : 's'}). Un lote es todo lo que guardó un Enter. Revertir no borra el registro: la carga queda marcada como revertida.
      </p>
      {lotes.length === 0 ? (
        <Tarjeta className="p-5 text-sm text-muted">Todavía no hay cargas. La primera aparece acá apenas guardes.</Tarjeta>
      ) : (
        <ol className="grid gap-3 2xl:grid-cols-2">
          {lotes.map((l) => (
            <LoteTarjeta key={l.clave} l={l} />
          ))}
        </ol>
      )}
    </div>
  )
}

function ListaCargas({ filas }: { filas: FilaRegistro[] }) {
  return (
    <ul className="divide-y divide-border border-y border-border">
      {filas.map((f) => {
        const o = ORIGEN[f.origen]
        return (
          <li
            key={f.carga_id}
            className={`grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 py-2 md:grid-cols-[auto_minmax(0,12rem)_minmax(0,1fr)_auto] md:items-center ${f.estado !== 'vigente' ? 'text-muted' : ''}`}
          >
            <o.Icono aria-hidden className="mt-0.5 size-4 shrink-0 text-muted md:mt-0" />
            <span className="text-sm">
              <span className={`font-medium ${f.estado === 'revertida' ? 'line-through decoration-1' : ''}`}>{f.cuenta}</span>
              <span className="text-muted"> · {o.nombre}</span>
            </span>
            <span className="col-start-2 text-[13px] text-muted md:col-start-auto">
              {conteo(f)}
              {f.archivo_path ? <span className="block truncate md:inline md:before:content-['_·_']">{f.archivo_path.split('/').at(-1)}</span> : null}
            </span>
            <span className="col-start-2 flex items-center gap-2 text-[12px] text-muted md:col-start-auto md:justify-end">
              <span className="num">#{f.carga_id}</span>
              {f.estado !== 'vigente' ? <Chip>{f.estado}</Chip> : null}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function LoteTarjeta({ l }: { l: Lote }) {
  const tiempos = l.filas.map((f) => f.tiempo_activo_ms).filter((x): x is number => x !== null)
  const activo = tiempos.length ? Math.max(...tiempos) : null
  const hayVigentes = l.filas.some((f) => f.estado === 'vigente')
  const todasRevertidas = l.filas.every((f) => f.estado === 'revertida')
  const filas = [...l.filas].sort((a, b) => a.carga_id - b.carga_id)
  const fuentes = [...new Set(filas.filter((f) => f.estado === 'vigente').map((f) => (f.cuenta === 'Tipo de cambio' ? 'CCL y cripto' : f.cuenta)))]
  return (
    <Tarjeta as="li" className="p-4 md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[15px] font-semibold">
          {fechaCorta(l.fecha)} <span className="font-normal text-muted">· guardado a las {hora.format(new Date(l.creado))}</span>
        </h2>
        <span className="text-sm text-muted">
          {activo !== null ? (
            <>
              <span className="num font-medium text-text">{duracion(activo)}</span> activos
            </>
          ) : (
            'tiempo activo sin dato'
          )}
          {todasRevertidas ? <Chip className="ml-2">revertido</Chip> : null}
        </span>
      </div>
      {fuentes.length ? <p className="mt-0.5 text-[13px] text-muted">{fuentes.join(' · ')}</p> : null}
      {/* Desktop: las cargas a la vista. Teléfono: se abren al tocar (visión §4.3). */}
      <div className="mt-3 hidden md:block">
        <ListaCargas filas={filas} />
      </div>
      <details className="group mt-2 md:hidden">
        <summary className="tocable flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-accent">
          {filas.length === 1 ? 'Ver la carga' : `Ver las ${filas.length} cargas`} <span aria-hidden className="transition-transform group-open:rotate-90">▸</span>
        </summary>
        <ListaCargas filas={filas} />
      </details>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-2">
        <Rotulo as="p" className="self-center">
          {l.lote ? `Lote ${l.lote.slice(0, 8)}` : 'Carga suelta'}
        </Rotulo>
        {hayVigentes && l.lote ? (
          <RevertirLote
            lote={l.lote}
            resumen={`${fechaCorta(l.fecha)} · ${filas.filter((f) => f.estado === 'vigente').length} carga(s) vigente(s): ${fuentes.join(', ')}.`}
            accion={revertirLoteAccion}
          />
        ) : null}
      </div>
    </Tarjeta>
  )
}
