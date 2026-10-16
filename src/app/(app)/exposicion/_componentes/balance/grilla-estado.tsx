'use client'

import { useMemo } from 'react'
import { fechaLarga } from '@/lib/domain/fechas'
import { Grilla, type ColumnaGrilla } from '@/components/grilla'
import { TextoConMontos } from '@/components/monto'
import { Chip, ChipEtiqueta } from '@/components/ui'
import { nombreFilaEstado, type FilaEstado } from '../../_lib/balance/estado'
import { Cifra } from './cifra'
import { Accion, Pct } from './tarjetas'

// El estado de situación en pantalla, desde 768 px: la Grilla común (AG Grid,
// D-157), sin orden (los renglones van como los lee un contador). La primera
// fila de cada sección (Activo, Pasivo, Patrimonio neto) lleva el borde
// marcado. En el teléfono va EstadoMovil (tarjetas que se pliegan) y al
// imprimir, la tabla (estado.tsx).

const SANGRIA: Record<0 | 1 | 2, string> = { 0: '', 1: 'pl-3', 2: 'pl-6' }

function Partida({ f }: { f: FilaEstado }) {
  switch (f.tipo) {
    case 'seccion':
      return <span className="rotulo text-[11px] text-text">{f.nombre}</span>
    case 'total':
      return (
        <span className={`flex min-w-0 flex-col ${SANGRIA[f.nivel]}`}>
          <span className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 ${f.fuerte ? 'font-semibold' : 'font-medium'}`}>
            {f.nombre}
            <ChipEtiqueta calc={f.valor.ars} />
          </span>
          {f.detalle ? <span className="text-[12px] font-normal leading-4 text-muted">{f.detalle}</span> : null}
        </span>
      )
    case 'partida':
      return (
        <span className={`flex min-w-0 flex-col gap-0.5 ${SANGRIA[f.nivel]}`}>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span aria-hidden className="size-2 shrink-0 rounded-sm" style={{ background: f.fila.color }} />
            <span>{f.fila.nombre}</span>
            <ChipEtiqueta calc={f.fila.valor.ars} omitir={['viejo', 'parcial']} />
            {f.fila.chips.map((c) => (
              <Chip key={c}>{c}</Chip>
            ))}
          </span>
          <span className="text-[12px] leading-4 text-muted">
            <TextoConMontos texto={f.fila.detalle} />
            {f.conCuenta && f.fila.cuenta ? ` · ${f.fila.cuenta}` : null}
          </span>
          {f.fila.accion ? <Accion accion={f.fila.accion} /> : null}
        </span>
      )
    case 'deuda':
      return (
        <span className={`flex min-w-0 flex-col gap-0.5 ${SANGRIA[1]}`}>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>{f.fila.nombre}</span>
            <ChipEtiqueta calc={f.fila.valor.ars} omitir={['parcial']} />
            {f.fila.chips.map((c) => (
              <Chip key={c}>{c}</Chip>
            ))}
          </span>
          <span className="text-[12px] leading-4 text-muted">
            <TextoConMontos texto={f.fila.detalle} />
            {f.fila.bien ? ` · financia ${f.fila.bien.toLowerCase()}` : ''}
          </span>
          {f.fila.accion ? <Accion accion={f.fila.accion} /> : null}
        </span>
      )
    case 'referencia':
      return (
        <span className={`block text-[12px] leading-4 text-muted ${SANGRIA[2]}`}>
          Lo que falta pagar según contrato: {f.fila.referencia ? <TextoConMontos texto={f.fila.referencia.nota} /> : 'aparece cuando importes el cuadro de marcha'} · no es la deuda (incluye intereses, IVA y
          seguro) y no se resta{' '}
          {f.fila.referencia ? <ChipEtiqueta calc={f.fila.referencia.valor.ars} /> : null}
        </span>
      )
    case 'nota':
      return (
        <span className={`flex min-w-0 flex-col gap-0.5 text-muted ${SANGRIA[1]}`}>
          <span>{f.texto}</span>
          {f.accion ? <Accion accion={f.accion} /> : null}
        </span>
      )
  }
}

/** El par (o la referencia) de una fila en una moneda, con su traza; nada en las secciones y las notas. */
function Monto({ f, m }: { f: FilaEstado; m: 'ars' | 'usd' }) {
  const moneda = m === 'ars' ? 'ARS' : 'USD'
  const dec = m === 'usd' ? 0 : undefined
  const en = m === 'ars' ? 'en pesos' : 'en dólares'
  switch (f.tipo) {
    case 'total':
      return <Cifra calc={f.valor[m]} moneda={moneda} titulo={`${f.nombre} · ${en}`} decimales={dec} className={f.fuerte ? 'font-semibold' : ''} />
    case 'partida':
    case 'deuda':
      return <Cifra calc={f.fila.valor[m]} moneda={moneda} titulo={`${f.fila.nombre} · ${en}`} decimales={dec} />
    case 'referencia':
      return f.fila.referencia ? (
        <span className="text-[13px] text-muted">
          <Cifra calc={f.fila.referencia.valor[m]} moneda={moneda} titulo={`Lo que falta pagar según contrato · ${en}`} decimales={dec} />
        </span>
      ) : null
    default:
      return null
  }
}

function Porcentaje({ f }: { f: FilaEstado }) {
  if (f.tipo === 'total') return <Pct pct={f.pct} calc={f.peso} titulo={`${f.nombre}: parte del activo`} />
  if (f.tipo === 'partida' || f.tipo === 'deuda') return <Pct pct={f.fila.pct} calc={f.fila.peso} titulo={`${f.fila.nombre}: parte del activo`} />
  return null
}

/**
 * Recibe las filas ya armadas (filasEstado, en el servidor) y la fecha: no la
 * vista entera, que es grande y además la usan otras piezas de la pantalla.
 */
export function GrillaEstado({ filas, fecha }: { filas: FilaEstado[]; fecha: string | null }) {
  const columnas = useMemo<ColumnaGrilla<FilaEstado>[]>(
    () => [
      { id: 'partida', titulo: 'Partida', ancho: 240, flex: 2.4, prioridad: 0, altoAuto: true, celda: (f) => <Partida f={f} /> },
      { id: 'ars', titulo: 'En pesos', tipo: 'numero', ancho: 140, prioridad: 0, celda: (f) => <Monto f={f} m="ars" /> },
      { id: 'usd', titulo: 'En dólares', tipo: 'numero', ancho: 120, prioridad: 0, celda: (f) => <Monto f={f} m="usd" /> },
      { id: 'pct', titulo: '% del activo', tipo: 'numero', ancho: 100, prioridad: 1, celda: (f) => <span className="text-muted"><Porcentaje f={f} /></span> },
    ],
    [],
  )
  return (
    <Grilla
      titulo={`Estado de situación patrimonial al ${fecha ? fechaLarga(fecha) : '—'}, en pesos, en dólares y en % del activo`}
      filas={filas}
      columnas={columnas}
      idFila={(f) => f.clave}
      nombreFila={nombreFilaEstado}
      grupo={(f) => f.seccion}
      maxFilas={200}
      // En el teléfono no se ve la grilla: van las tarjetas que se pliegan (EstadoMovil).
      tarjeta={() => null}
    />
  )
}
