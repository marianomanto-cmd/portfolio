'use client'

import { ChevronDown, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef } from 'react'
import { fechaCorta, fechaLarga } from '@/lib/domain/fechas'
import type { Agrupar } from '@/lib/vistas/contratos-balance'
import { Segmentado } from '@/components/pantalla/segmentado'
import { rutaExposicion } from '../../_lib/rutas'
import { BotonImprimir } from './imprimir'

// Fecha del balance (cualquier fecha de carga) y "Ver por" (cuenta,
// instrumento o clase). Desde 768 px, a la vista; en el teléfono, en una hoja
// inferior desde un botón (la fecha tiene más de tres opciones). Todo vive en
// la dirección de Exposición y conserva qué netea arriba (?vista=).

const OPCIONES: { valor: Agrupar; nombre: string }[] = [
  { valor: 'cuenta', nombre: 'Cuenta' },
  { valor: 'instrumento', nombre: 'Instrumento' },
  { valor: 'clase', nombre: 'Clase' },
]

const CAMPO = 'tocable h-9 min-w-0 rounded-item border border-border bg-surface px-2.5 text-sm text-text hover:border-border-strong max-md:h-11'

export function Controles({
  fechas,
  fecha,
  agrupar,
  comparar = null,
  demo,
  vista = null,
}: {
  fechas: string[]
  fecha: string
  agrupar: Agrupar
  /** La fecha del comparativo, si no es la de por defecto: se conserva mientras siga siendo anterior. */
  comparar?: string | null
  demo: string | null
  /** Qué netea Exposición arriba ('total' o null): se conserva. */
  vista?: string | null
}) {
  const router = useRouter()
  const hoja = useRef<HTMLDialogElement>(null)
  const ultima = fechas.at(-1) ?? null
  const ruta = (cambio: { fecha?: string; agrupar?: Agrupar }) => {
    const f = cambio.fecha ?? fecha
    return rutaExposicion({ vista, fecha: f, ultima, agrupar: cambio.agrupar ?? agrupar, comparar: comparar && comparar < f ? comparar : null, demo })
  }
  const nombre = OPCIONES.find((o) => o.valor === agrupar)?.nombre ?? 'Cuenta'

  const selector = (id: string) => (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1 text-[13px] text-muted">
      Fecha del balance
      <select
        id={id}
        value={fecha}
        onChange={(e) => {
          hoja.current?.close()
          router.push(ruta({ fecha: e.target.value }), { scroll: false })
        }}
        className={CAMPO}
      >
        {[...fechas].reverse().map((f) => (
          <option key={f} value={f}>
            {fechaCorta(f)}/{f.slice(0, 4)}
            {f === ultima ? ' · la última' : ''}
          </option>
        ))}
      </select>
    </label>
  )

  const segmentado = (movil: boolean) => (
    <div className="flex min-w-0 flex-col gap-1 text-[13px] text-muted">
      <span id={movil ? 'ver-por-movil' : 'ver-por'}>Ver lo financiero por</span>
      <div onClick={() => (movil ? hoja.current?.close() : undefined)}>
        <Segmentado etiqueta="Ver lo financiero por" opciones={OPCIONES.map((o) => ({ href: ruta({ agrupar: o.valor }), nombre: o.nombre, actual: o.valor === agrupar }))} />
      </div>
    </div>
  )

  return (
    <>
      <div className="hidden flex-wrap items-end gap-3 md:flex print:hidden">
        {fechas.length > 1 ? selector('fecha-balance') : null}
        {segmentado(false)}
        <BotonImprimir />
      </div>
      <div className="md:hidden print:hidden">
        <button
          type="button"
          onClick={() => hoja.current?.showModal()}
          aria-haspopup="dialog"
          className="tocable inline-flex h-11 max-w-full items-center gap-1 rounded-full border border-border bg-surface px-4 text-sm"
        >
          <span className="truncate">
            Ver por: {nombre} · {fechaCorta(fecha)}
          </span>
          <ChevronDown aria-hidden className="size-4 shrink-0" />
        </button>
        <dialog
          ref={hoja}
          aria-label="Fecha y cómo ver el balance"
          className="hoja fixed inset-x-0 bottom-0 top-auto m-0 w-full rounded-t-[20px] border-t border-border bg-surface p-0 text-text"
          onClick={(e) => {
            if (e.target === e.currentTarget) hoja.current?.close()
          }}
        >
          {/* Abajo, el alto de la barra inferior: la hoja la tapa, y ningún botón queda encima de "Hoy" o "Patrimonio". */}
          <div className="flex flex-col gap-4 px-4 pb-[calc(var(--barra-inf)+max(1rem,env(safe-area-inset-bottom)))] pt-3">
            <div aria-hidden className="mx-auto h-1 w-10 rounded bg-border-strong" />
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Balance al {fechaLarga(fecha)}</p>
              <button type="button" onClick={() => hoja.current?.close()} aria-label="Cerrar" className="tocable grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2">
                <X aria-hidden className="size-5" />
              </button>
            </div>
            {fechas.length > 1 ? selector('fecha-balance-movil') : <p className="text-[13px] text-muted">Por ahora hay una sola fecha de carga.</p>}
            {segmentado(true)}
            <BotonImprimir className="self-start" />
          </div>
        </dialog>
      </div>
    </>
  )
}
