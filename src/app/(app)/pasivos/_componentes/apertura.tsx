'use client'

import { useMemo } from 'react'
import type { Par, TotalesApertura, VistaLeasing } from '@/lib/vistas/contratos-pasivos'
import { Grilla, type ColumnaGrilla } from '@/components/grilla'
import { useMedia } from '@/components/preferencias'
import { ChipEtiqueta, ParMonto } from '@/components/ui'
import { COLOR_PARTE } from '../_lib/graficos'

// Lo pagado y lo que falta, abiertos en sus partes (D-152), en la Grilla: una
// fila por parte (amortización, interés, IVA, seguro, percepción, cargos) y
// el gasto y el total abajo. Cada cifra en pesos y en dólares, con su traza.

interface FilaParte {
  clave: keyof TotalesApertura
  nombre: string
  color: string | null
  pagado: Par
  falta: Par
  /** El gasto y el total van fuertes: son sumas de las de arriba. */
  suma: boolean
}

function filasDe(l: Pick<VistaLeasing, 'totales'>): FilaParte[] {
  const p = l.totales.apertura_pagadas
  const f = l.totales.apertura_pendientes
  const partes: { clave: keyof TotalesApertura; nombre: string; color: string | null; suma?: boolean }[] = [
    { clave: 'amortizacion', nombre: 'Amortización (baja la deuda)', color: COLOR_PARTE.amortizacion },
    { clave: 'interes', nombre: 'Interés implícito', color: COLOR_PARTE.interes },
    { clave: 'iva', nombre: 'IVA', color: COLOR_PARTE.iva },
    { clave: 'seguro', nombre: 'Seguro', color: COLOR_PARTE.seguro },
    { clave: 'percepcion', nombre: 'Percepción RG 3337', color: COLOR_PARTE.percepcion },
    // Sin cargos extra, su fila no va: es un cero real, no un dato que falta.
    ...(l.totales.hay_cargos ? [{ clave: 'cargos' as const, nombre: 'Cargos', color: COLOR_PARTE.cargos }] : []),
    { clave: 'gasto', nombre: 'Gasto (todo menos la amortización)', color: null, suma: true },
    { clave: 'total', nombre: 'Total', color: null, suma: true },
  ]
  return partes.map((x) => ({ clave: x.clave, nombre: x.nombre, color: x.color, pagado: p[x.clave], falta: f[x.clave], suma: x.suma ?? false }))
}

function Nombre({ f }: { f: FilaParte }) {
  return (
    <span className={`flex min-w-0 items-center gap-2 ${f.suma ? 'font-medium text-text' : 'text-muted'}`}>
      {f.color ? <span aria-hidden className="inline-block size-2 shrink-0 rounded-full" style={{ background: f.color }} /> : null}
      <span className="min-w-0">{f.nombre}</span>
      {f.pagado.ars.valor !== null ? <ChipEtiqueta calc={f.pagado.ars} omitir={['proyectado']} /> : null}
    </span>
  )
}

export function TablaApertura({ l }: { l: Pick<VistaLeasing, 'totales' | 'tarjetas'> }) {
  const filas = useMemo(() => filasDe(l), [l])
  const columnas = useMemo<ColumnaGrilla<FilaParte>[]>(
    () => [
      { id: 'parte', titulo: 'Parte de la cuota', ancho: 230, flex: 1.4, prioridad: 0, celda: (f) => <Nombre f={f} /> },
      {
        id: 'pagado',
        titulo: `Lo que pagaste (${l.tarjetas.pagadas})`,
        tipo: 'numero',
        ancho: 180,
        prioridad: 0,
        celda: (f) => <ParMonto par={f.pagado} titulo={`${f.nombre} · lo pagado`} vertical className={f.suma ? 'font-medium' : ''} />,
      },
      {
        id: 'falta',
        titulo: `Lo que falta (${l.tarjetas.falta.cuotas})`,
        tipo: 'numero',
        ancho: 180,
        prioridad: 0,
        celda: (f) => <ParMonto par={f.falta} titulo={`${f.nombre} · lo que falta`} vertical className={f.suma ? 'font-medium' : ''} />,
      },
    ],
    [l.tarjetas.pagadas, l.tarjetas.falta.cuotas],
  )
  const sinUsdPagado = l.totales.apertura_pagadas.total.usd.valor === null
  // Cada celda lleva dos cifras, una arriba de la otra: con el dedo (una tablet), cada una es un
  // tocable de 44 px y la fila mide 100 (como Posiciones, D-100), para que no se pisen.
  const grueso = useMedia('(pointer: coarse)', false)
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Grilla
        titulo="Lo pagado y lo que falta, abiertos en sus partes"
        filas={filas}
        columnas={columnas}
        idFila={(f) => f.clave}
        nombreFila={(f) => f.nombre}
        altoFila={grueso ? 100 : 56}
      />
      {sinUsdPagado ? (
        <p className="text-[12px] text-muted">
          En dólares, lo pagado va al CCL del día de cada pago: sin dato hasta que cargues esos CCL en Datos › Leasing (la planilla no trae la fecha del débito). Lo que falta, al CCL de hoy.
        </p>
      ) : (
        <p className="text-[12px] text-muted">En dólares, lo pagado al CCL de cada pago; lo que falta, al CCL de hoy.</p>
      )}
    </div>
  )
}
