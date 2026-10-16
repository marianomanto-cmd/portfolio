'use client'

import { useMemo } from 'react'
import type { CalcVista } from '@/lib/domain/calc'
import { numero } from '@/lib/domain/dinero'
import type { FilaCuota, VistaLeasing } from '@/lib/vistas/contratos-pasivos'
import { Grilla, type ColumnaGrilla } from '@/components/grilla'
import { MontoTrazado } from '@/components/monto'
import { useMedia } from '@/components/preferencias'
import { Traza } from '@/components/traza'
import { Rotulo, Tarjeta } from '@/components/ui'
import { hayInciertas, proximasCuotas } from '../_lib/pantalla'

// "Cuadro de marcha · próximas" (handoff, captura 08): las próximas cuotas por
// pagar en la Grilla (N° · Fecha · ARS · USD). En dólares, al CCL de hoy: se
// fija al CCL del día de pago. Debajo de 768 px, una tarjeta por cuota.
//
// Como en el diseño, la tabla va dentro de la tarjeta sin marco propio: sin el
// borde ni el radio de la grilla, en mono de 12 px, con filas de 36 px (48 con
// el dedo: cada cifra es un tocable de 44, D-100) y la primera y la última
// columna al ras del rótulo. Son variables del tema de AG Grid puestas en los elementos de
// adentro: la Grilla común no cambia.
const PLANA = [
  '[&_.ag-root-wrapper]:[--ag-wrapper-border:none]',
  '[&_.ag-root-wrapper]:[--ag-wrapper-border-radius:0px]',
  '[&_.ag-root-wrapper]:[--ag-cell-font-size:12px]',
  '[&_[col-id=nro]]:[--ag-cell-horizontal-padding:0px]',
  '[&_[col-id=usd]]:[--ag-cell-horizontal-padding:0px]',
].join(' ')

/** "01/11/26", como en el diseño. */
const fechaChica = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(2, 4)}`

function TarjetaProxima({ c }: { c: FilaCuota }) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-item border border-border bg-surface p-3">
      <p className="text-[14px] font-medium">
        Cuota {c.nro} <span className="num text-[12px] font-normal text-muted">· {fechaChica(c.fecha_vencimiento)}</span>
      </p>
      <span className="flex flex-wrap items-baseline justify-end gap-x-2 gap-y-1">
        <MontoTrazado calc={c.total} moneda="ARS" titulo={`Cuota ${c.nro} · en pesos`} />
        <MontoTrazado calc={c.total_usd} moneda="USD" titulo={`Cuota ${c.nro} · en dólares, al CCL de hoy`} decimales={0} />
      </span>
    </div>
  )
}

export function Proximas({ l, ccl, cclFecha }: { l: Pick<VistaLeasing, 'cuotas' | 'contrato'>; ccl: CalcVista; cclFecha: string | null }) {
  const filas = useMemo(() => proximasCuotas(l.cuotas), [l.cuotas])
  const columnas = useMemo<ColumnaGrilla<FilaCuota>[]>(
    () => [
      { id: 'nro', titulo: 'N°', ancho: 44, flex: 0.35, prioridad: 0, celda: (c) => <span className="num text-muted">{c.nro}</span> },
      { id: 'fecha', titulo: 'Fecha', ancho: 92, flex: 0.9, prioridad: 0, celda: (c) => <span className="num">{fechaChica(c.fecha_vencimiento)}</span> },
      {
        id: 'ars',
        titulo: 'ARS',
        tipo: 'numero',
        ancho: 112,
        prioridad: 0,
        celda: (c) => <MontoTrazado calc={c.total} moneda="ARS" titulo={`Cuota ${c.nro} · en pesos`} />,
      },
      { id: 'usd', titulo: 'USD', tipo: 'numero', ancho: 96, prioridad: 0, celda: (c) => <MontoTrazado calc={c.total_usd} moneda="USD" titulo={`Cuota ${c.nro} · en dólares, al CCL de hoy`} decimales={0} /> },
    ],
    [],
  )
  const id = `proximas-${l.contrato.id}`
  // Una cuota sin factura trae montos supuestos o a confirmar (D-139): se dice una vez abajo; cada cifra lo dice en su traza.
  const inciertas = useMemo(() => hayInciertas(filas), [filas])
  const grueso = useMedia('(pointer: coarse)', false)
  return (
    <Tarjeta className="flex h-full min-w-0 flex-col gap-1 p-5" aria-labelledby={id}>
      <Rotulo id={id} className="pb-2">
        Cuadro de marcha · próximas
      </Rotulo>
      <Grilla
        titulo="Las próximas cuotas, en pesos y en dólares"
        filas={filas}
        columnas={columnas}
        idFila={(c) => String(c.nro)}
        nombreFila={(c) => `Cuota ${c.nro}`}
        altoFila={grueso ? 48 : 36}
        className={PLANA}
        tarjeta={(c) => <TarjetaProxima c={c} />}
        vacio={<p className="text-[13px] text-muted">No queda ninguna cuota por pagar.</p>}
      />
      <p className="pt-2 text-[11px] leading-relaxed text-muted">
        USD al CCL de hoy
        {ccl.valor !== null ? (
          <>
            {' ('}
            <Traza calc={ccl} titulo={cclFecha ? `CCL del ${cclFecha}` : 'Último CCL cargado'}>
              <span className="num">{numero(ccl.valor, 2)}</span>
            </Traza>
            {cclFecha ? `, del ${cclFecha})` : ')'}
          </>
        ) : (
          ' (sin dato: todavía no cargaste un CCL)'
        )}
        : se fija al CCL del día de pago.
        {inciertas ? ' Las que todavía no tienen factura llevan el seguro o la percepción supuestos o a confirmar, según tu planilla.' : null}
      </p>
    </Tarjeta>
  )
}
