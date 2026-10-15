// Los controles de Evolución: Financiero · Total, la moneda y el período. Todo
// vive en la URL; en el teléfono el período va en una hoja (son cinco opciones).

import Link from 'next/link'
import type { VistaEvolucion } from '@/lib/vistas/contratos-evolucion'
import { hrefEvolucion, MONEDAS, PERIODOS, VISTAS } from '../_lib/parametros'
import { FormularioFechas } from './formulario-fechas'
import { SelectorPeriodo } from './selector-periodo'

function Segmentado({ etiqueta, opciones, columnas }: { etiqueta: string; opciones: { href: string; nombre: string; detalle?: string; actual: boolean }[]; columnas: string }) {
  return (
    <nav aria-label={etiqueta} className={`grid ${columnas} gap-1 rounded-xl border border-border bg-surface-2 p-1 md:inline-grid md:w-auto`}>
      {opciones.map((o) => (
        <Link
          key={o.href}
          href={o.href}
          aria-current={o.actual ? 'page' : undefined}
          className={`flex min-h-11 flex-col justify-center rounded-lg px-3 py-1 text-center text-sm md:text-left ${o.actual ? 'bg-surface font-semibold shadow-[var(--shadow)]' : 'text-muted hover:text-text'}`}
        >
          <span>{o.nombre}</span>
          {o.detalle ? <span className="text-[12px] font-normal leading-4 text-muted">{o.detalle}</span> : null}
        </Link>
      ))}
    </nav>
  )
}

export function Controles({ v, demo }: { v: VistaEvolucion; demo: string | null }) {
  const p = v.parametros
  const periodoActual = PERIODOS.find((x) => x.periodo === p.periodo)?.nombre ?? 'Desde el día cero'
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:flex md:flex-wrap md:items-start md:gap-3">
        <Segmentado
          etiqueta="Qué mirás"
          columnas="grid-cols-2"
          opciones={VISTAS.map((x) => ({ href: hrefEvolucion(p, { vista: x.vista }, demo, { explicito: true }), nombre: x.nombre, detalle: x.detalle, actual: x.vista === p.vista }))}
        />
        <Segmentado
          etiqueta="En qué moneda"
          columnas="grid-cols-3"
          opciones={MONEDAS.map((x) => ({ href: hrefEvolucion(p, { moneda: x.moneda }, demo, { explicito: true }), nombre: x.nombre, actual: x.moneda === p.moneda }))}
        />
        <div className="sm:col-span-2 md:hidden">
          <SelectorPeriodo p={p} demo={demo} fechas={v.fechas} actual={periodoActual} />
        </div>
        <div className="hidden md:block">
          <Segmentado
            etiqueta="Período"
            columnas="grid-cols-5"
            opciones={PERIODOS.map((x) => ({
              href: hrefEvolucion(p, { periodo: x.periodo, ...(x.periodo === 'elegir' ? { desde: v.desde, hasta: v.hasta } : {}) }, demo, { explicito: true }),
              nombre: x.nombre,
              actual: x.periodo === p.periodo,
            }))}
          />
        </div>
      </div>
      {p.periodo === 'elegir' ? (
        <div className="hidden rounded-xl border border-border bg-surface p-3 md:block">
          <FormularioFechas p={p} demo={demo} fechas={v.fechas} />
        </div>
      ) : null}
    </div>
  )
}
