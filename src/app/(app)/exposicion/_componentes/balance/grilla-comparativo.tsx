'use client'

import { useMemo } from 'react'
import { fechaCorta } from '@/lib/domain/fechas'
import type { ComparativoVista, LineaComparativa } from '@/lib/vistas/contratos-balance'
import { Grilla, type ColumnaGrilla } from '@/components/grilla'
import { Chip } from '@/components/ui'
import { Cifra } from './cifra'
import { Diferencia, ParComparado } from './comparativo-cifras'

// El comparativo en pantalla: la Grilla común (AG Grid, D-157), sin orden (es
// un estado contable: los renglones van en su orden). Debajo de 768 px, una
// tarjeta por renglón con las dos fechas y la diferencia.

function Renglon({ l }: { l: LineaComparativa }) {
  return (
    <span className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 ${l.principal ? 'font-semibold' : ''}`}>
      {l.nombre}
      {l.chip ? <Chip>{l.chip}</Chip> : null}
    </span>
  )
}

function TarjetaRenglon({ l, fecha, anterior }: { l: LineaComparativa; fecha: string; anterior: string }) {
  return (
    <div className="rounded-tarjeta border border-border bg-surface p-4" data-renglon={l.clave}>
      <p className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm ${l.principal ? 'font-semibold' : 'font-medium'}`}>
        {l.nombre}
        {l.chip ? <Chip>{l.chip}</Chip> : null}
      </p>
      <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1 text-sm">
        <dt className="text-[12px] text-muted">Al {fechaCorta(fecha)}</dt>
        <dd className="flex min-w-0 flex-wrap justify-end gap-x-2">
          <Cifra calc={l.actual.ars} moneda="ARS" titulo={`${l.nombre} al ${fechaCorta(fecha)} · en pesos`} />
          <Cifra calc={l.actual.usd} moneda="USD" titulo={`${l.nombre} al ${fechaCorta(fecha)} · en dólares`} decimales={0} />
        </dd>
        <dt className="text-[12px] text-muted">Al {fechaCorta(anterior)}</dt>
        <dd className="flex min-w-0 flex-wrap justify-end gap-x-2">
          <Cifra calc={l.anterior.ars} moneda="ARS" titulo={`${l.nombre} al ${fechaCorta(anterior)} · en pesos`} />
          <Cifra calc={l.anterior.usd} moneda="USD" titulo={`${l.nombre} al ${fechaCorta(anterior)} · en dólares`} decimales={0} />
        </dd>
        <dt className="text-[12px] text-muted">Diferencia</dt>
        <dd className="flex min-w-0 flex-wrap justify-end gap-x-2">
          <Diferencia calc={l.diferencia.ars} moneda="ARS" titulo={`${l.nombre}: diferencia · en pesos`} sinCambios={l.sin_cambios.ars} />
          <Diferencia calc={l.diferencia.usd} moneda="USD" titulo={`${l.nombre}: diferencia · en dólares`} sinCambios={l.sin_cambios.usd} />
        </dd>
      </dl>
    </div>
  )
}

export function GrillaComparativo({ c, fecha }: { c: ComparativoVista; fecha: string }) {
  const columnas = useMemo<ColumnaGrilla<LineaComparativa>[]>(
    () => [
      { id: 'renglon', titulo: 'Renglón', ancho: 200, flex: 1.6, prioridad: 0, altoAuto: true, celda: (l) => <Renglon l={l} /> },
      { id: 'actual', titulo: `Al ${fechaCorta(fecha)}`, tipo: 'numero', ancho: 150, prioridad: 0, celda: (l) => <ParComparado l={l} cual="actual" fecha={fecha} /> },
      { id: 'anterior', titulo: `Al ${fechaCorta(c.fecha)}`, tipo: 'numero', ancho: 150, prioridad: 0, celda: (l) => <ParComparado l={l} cual="anterior" fecha={c.fecha} /> },
      { id: 'diferencia', titulo: 'Diferencia', tipo: 'numero', ancho: 150, prioridad: 0, celda: (l) => <ParComparado l={l} cual="diferencia" fecha={fecha} /> },
    ],
    [c.fecha, fecha],
  )
  return (
    <Grilla
      titulo={`Comparativo del balance al ${fechaCorta(fecha)} y al ${fechaCorta(c.fecha)}, en pesos y en dólares`}
      filas={c.lineas}
      columnas={columnas}
      idFila={(l) => l.clave}
      nombreFila={(l) => l.nombre}
      altoFila={56}
      maxFilas={40}
      tarjeta={(l) => <TarjetaRenglon l={l} fecha={fecha} anterior={c.fecha} />}
    />
  )
}
