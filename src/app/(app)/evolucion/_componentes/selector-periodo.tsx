'use client'

// El período en el teléfono: son cinco opciones, así que van en una hoja
// inferior (visión §3.2) que se abre desde un botón "Período: … ▾". En
// desktop, la página muestra las cinco como control segmentado.

import { ChevronDown, X } from 'lucide-react'
import Link from 'next/link'
import { useRef } from 'react'
import type { Fecha } from '@/lib/domain/tipos'
import type { ParametrosEvolucion } from '@/lib/vistas/contratos-evolucion'
import { hrefEvolucion, PERIODOS } from '../_lib/parametros'
import { FormularioFechas } from './formulario-fechas'

export function SelectorPeriodo({ p, demo, fechas, actual }: { p: ParametrosEvolucion; demo: string | null; fechas: Fecha[]; actual: string }) {
  const hoja = useRef<HTMLDialogElement>(null)
  return (
    <>
      <button
        type="button"
        onClick={() => hoja.current?.showModal()}
        aria-haspopup="dialog"
        className="tocable flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 text-left text-sm shadow-[var(--shadow)]"
      >
        <span className="min-w-0">
          <span className="text-muted">Período: </span>
          <span className="font-medium">{actual}</span>
        </span>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-muted" />
      </button>
      <dialog
        ref={hoja}
        aria-label="Elegí el período"
        className="hoja fixed inset-x-0 bottom-0 top-auto m-0 w-full rounded-t-2xl border-t border-border bg-surface p-0 text-text shadow-lg"
        onClick={(e) => {
          if (e.target === e.currentTarget) hoja.current?.close()
        }}
      >
        <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded bg-border-strong" />
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm font-semibold">Elegí el período</p>
            <button type="button" onClick={() => hoja.current?.close()} aria-label="Cerrar" className="tocable grid size-11 place-items-center rounded-lg text-muted hover:bg-surface-2">
              <X aria-hidden className="size-5" />
            </button>
          </div>
          <ul className="flex flex-col">
            {PERIODOS.filter((x) => x.periodo !== 'elegir').map((x) => {
              const sel = x.periodo === p.periodo
              return (
                <li key={x.periodo}>
                  <Link
                    href={hrefEvolucion(p, { periodo: x.periodo }, demo, { explicito: true })}
                    onClick={() => hoja.current?.close()}
                    aria-current={sel ? 'page' : undefined}
                    className={`flex min-h-12 items-center rounded-xl px-3 text-[15px] ${sel ? 'bg-accent-soft font-semibold text-accent' : 'hover:bg-surface-2'}`}
                  >
                    {x.nombre}
                  </Link>
                </li>
              )
            })}
          </ul>
          <div className="mt-2 border-t border-border pt-3">
            <p className="mb-2 text-sm font-medium">Elegir fechas</p>
            <FormularioFechas p={p} demo={demo} fechas={fechas} />
          </div>
        </div>
      </dialog>
    </>
  )
}
