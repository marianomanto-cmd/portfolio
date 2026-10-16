'use client'

// El período de Evolución (handoff, captura 07): la pastilla 1M · 3M · YTD ·
// 12M · INICIO a la vista, y "Otro período" para la semana y para elegir dos
// fechas con carga (D-159): una hoja desde abajo en el teléfono y una placa en
// la compu. Todo vive en la dirección: se puede guardar como favorito.

import { ChevronDown, X } from 'lucide-react'
import Link from 'next/link'
import { useRef } from 'react'
import { fechaCorta } from '@/lib/domain/fechas'
import type { Fecha } from '@/lib/domain/tipos'
import type { ParametrosEvolucion } from '@/lib/vistas/contratos-evolucion'
import { Segmentado } from '@/components/pantalla/segmentado'
import { hrefEvolucion, nombrePeriodo, PERIODOS_PASTILLA } from '../_lib/parametros'
import { FormularioFechas } from './formulario-fechas'

export function SelectorPeriodo({ p, demo, fechas, desde, hasta }: { p: ParametrosEvolucion; demo: string | null; fechas: Fecha[]; desde: Fecha | null; hasta: Fecha | null }) {
  const hoja = useRef<HTMLDialogElement>(null)
  const rango = desde && hasta ? (desde === hasta ? `el ${fechaCorta(desde)}` : `del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`) : null
  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5 md:items-end">
      <Segmentado
        etiqueta="Período"
        opciones={PERIODOS_PASTILLA.map((x) => ({
          href: hrefEvolucion(p, { periodo: x.periodo }, demo, { explicito: true }),
          nombre: x.nombre,
          actual: x.periodo === p.periodo,
          titulo: nombrePeriodo(x.periodo),
          oculto: nombrePeriodo(x.periodo),
        }))}
      />
      {/* En el teléfono, "Otro período" va en su renglón: las acciones del encabezado miden su contenido en una línea, y el período con sus fechas y el botón no entraban juntos en 360 px (D-30). */}
      <p className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted max-sm:flex-col max-sm:items-start">
        <span data-periodo>
          {nombrePeriodo(p.periodo)}
          {rango ? ` · ${rango}` : ''}
        </span>
        <span aria-hidden className="max-sm:hidden">·</span>
        <button type="button" onClick={() => hoja.current?.showModal()} aria-haspopup="dialog" className="tocable inline-flex items-center gap-0.5 rounded text-[12px] text-muted underline-offset-2 hover:text-text hover:underline">
          Otro período <ChevronDown aria-hidden className="size-3.5" />
        </button>
      </p>
      <dialog
        ref={hoja}
        aria-label="Otro período"
        className="hoja fixed inset-x-0 bottom-0 top-auto m-0 w-full rounded-t-[20px] border-t border-border bg-surface p-0 text-text md:inset-0 md:m-auto md:h-fit md:w-[min(28rem,calc(100vw-2rem))] md:rounded-tarjeta md:border"
        onClick={(e) => {
          if (e.target === e.currentTarget) hoja.current?.close()
        }}
      >
        <div className="flex flex-col gap-3 px-4 pb-[calc(var(--barra-inf)+max(1rem,env(safe-area-inset-bottom)))] pt-3 md:p-5">
          <div aria-hidden className="mx-auto h-1 w-10 rounded bg-border-strong md:hidden" />
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-medium">Otro período</p>
            <button type="button" onClick={() => hoja.current?.close()} aria-label="Cerrar" className="tocable grid size-9 place-items-center rounded-full border border-border text-muted hover:text-text">
              <X aria-hidden className="size-4" />
            </button>
          </div>
          <Link
            href={hrefEvolucion(p, { periodo: 'semana' }, demo, { explicito: true })}
            onClick={() => hoja.current?.close()}
            aria-current={p.periodo === 'semana' ? 'page' : undefined}
            className={`tocable flex min-h-11 items-center rounded-item px-3 text-[15px] ${p.periodo === 'semana' ? 'bg-surface-3 font-medium text-text' : 'hover:bg-surface-2'}`}
          >
            La última semana
          </Link>
          <div className="border-t border-border pt-3">
            <p className="mb-2 text-sm font-medium">Elegir fechas</p>
            <FormularioFechas p={p} demo={demo} fechas={fechas} />
          </div>
        </div>
      </dialog>
    </div>
  )
}
