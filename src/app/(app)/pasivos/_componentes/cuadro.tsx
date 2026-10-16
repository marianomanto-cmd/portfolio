'use client'

import { useMemo, useState } from 'react'
import type { CalcVista } from '@/lib/domain/calc'
import { fechaCorta, fechaLarga } from '@/lib/domain/fechas'
import type { FilaCuota, VistaLeasing } from '@/lib/vistas/contratos-pasivos'
import { Grilla, type ColumnaGrilla } from '@/components/grilla'
import { MontoTrazado } from '@/components/monto'
import { useMedia } from '@/components/preferencias'
import { Chip, ChipEtiqueta } from '@/components/ui'
import { COLOR_PARTE } from '../_lib/graficos'
import { filtrarCuadro, type FiltroCuadro } from '../_lib/pantalla'

// El cuadro de marcha entero (detalle de Pasivos; plan §5 C.1, 2): todas las
// cuotas en la Grilla (D-157), con un filtro (por pagar · pagadas · todas) y
// dos lecturas de la misma cuota: la factura (canon, seguro, IVA, percepción)
// y abierta (amortización contra gasto, D-152). Debajo de 768 px, una tarjeta
// por cuota (D-30). La opción de compra, aparte, al final.

type Lectura = 'factura' | 'abierta'

const mes = (p: string | null) => (p ? `${p.slice(5, 7)}/${p.slice(0, 4)}` : null)
/** "10/26": el mes del canon, corto, para la celda. */
const mesCorto = (p: string | null) => (p ? `${p.slice(5, 7)}/${p.slice(2, 4)}` : null)

/** El segmentado del sistema (pastilla, como el período de Evolución): un toque elige. */
export function Segmentado<T extends string>({ etiqueta, valor, opciones, onElegir }: { etiqueta: string; valor: T; opciones: readonly (readonly [T, string])[]; onElegir: (v: T) => void }) {
  return (
    <div role="group" aria-label={etiqueta} className="inline-flex max-w-full flex-wrap gap-1 rounded-[22px] border border-border p-1">
      {opciones.map(([k, nombre]) => (
        <button
          key={k}
          type="button"
          aria-pressed={valor === k}
          onClick={() => onElegir(k)}
          className={`tocable inline-flex min-h-8 items-center rounded-full px-3 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors ${valor === k ? 'bg-surface-3 text-text' : 'text-muted hover:text-text'}`}
        >
          {nombre}
        </button>
      ))}
    </div>
  )
}

function Estado({ c }: { c: FilaCuota }) {
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-1">
      <span className={`text-[13px] ${c.pagada ? 'text-text' : 'text-muted'}`}>{c.estado_texto}</span>
      {c.estado === 'proyectada' ? <Chip>proyectada</Chip> : null}
    </span>
  )
}

function Punto({ color }: { color: string }) {
  return <span aria-hidden className="inline-block size-2 shrink-0 rounded-full" style={{ background: color }} />
}

/** Un monto de la cuota con el chip de su fuente (supuesto, a confirmar), sin repetir "proyectado". */
function Cifra({ calc, titulo, moneda = 'ARS', fuerte = false, chip = true }: { calc: CalcVista; titulo: string; moneda?: 'ARS' | 'USD'; fuerte?: boolean; chip?: boolean }) {
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <MontoTrazado calc={calc} moneda={moneda} titulo={titulo} className={fuerte ? 'font-semibold' : ''} />
      {chip && calc.valor !== null ? <ChipEtiqueta calc={calc} omitir={['proyectado']} /> : null}
    </span>
  )
}

const PARTES_FACTURA = [
  { k: 'canon', nombre: 'Canon' },
  { k: 'seguro', nombre: 'Seguro' },
  { k: 'iva', nombre: 'IVA' },
  { k: 'percepcion', nombre: 'Percepción' },
] as const

const PARTES_ABIERTA = [
  { k: 'amortizacion', nombre: 'Amortización', color: COLOR_PARTE.amortizacion },
  { k: 'interes', nombre: 'Interés', color: COLOR_PARTE.interes },
  { k: 'iva', nombre: 'IVA', color: COLOR_PARTE.iva },
  { k: 'seguro', nombre: 'Seguro', color: COLOR_PARTE.seguro },
  { k: 'percepcion', nombre: 'Percepción', color: COLOR_PARTE.percepcion },
  { k: 'cargos', nombre: 'Cargos', color: COLOR_PARTE.cargos },
] as const

/** La tarjeta de una cuota en el teléfono (D-30): las dos lecturas, con sus chips. */
function TarjetaCuota({ c, lectura }: { c: FilaCuota; lectura: Lectura }) {
  const t = `Cuota ${c.nro}`
  return (
    <div className={`min-w-0 rounded-tarjeta border p-4 ${c.pagada ? 'border-border bg-surface' : 'border-dashed border-border-strong bg-surface'}`} data-cuota={c.nro}>
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-medium text-text">
          Cuota {c.nro} <span className="font-normal text-muted">· vence {fechaCorta(c.fecha_vencimiento)}</span>
        </p>
        <Estado c={c} />
      </div>
      <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 text-lg">
        <MontoTrazado calc={lectura === 'factura' ? c.total : c.apertura.total.ars} moneda="ARS" titulo={`${t} · total en pesos`} className="font-semibold" />
        <span className="inline-flex flex-wrap items-baseline gap-x-1 text-sm">
          <MontoTrazado calc={lectura === 'factura' ? c.total_usd : c.apertura.total.usd} moneda="USD" titulo={`${t} · total en dólares ${c.usd_rotulo}`} />
          <span className="text-xs text-muted">{c.usd_rotulo}</span>
        </span>
        <ChipEtiqueta calc={c.total} />
      </div>
      {lectura === 'factura' ? (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          {PARTES_FACTURA.map((p) => (
            <div key={p.k} className="flex min-w-0 flex-col">
              <dt className="flex items-center gap-1 text-xs text-muted">
                {p.nombre}
                <ChipEtiqueta calc={c[p.k]} omitir={['proyectado']} />
              </dt>
              <dd className="min-w-0">
                <MontoTrazado calc={c[p.k]} moneda="ARS" titulo={`${t} · ${p.nombre.toLowerCase()}`} />
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          {PARTES_ABIERTA.filter((p) => p.k !== 'cargos' || c.hay_cargos).map((p) => (
            <div key={p.k} className="flex min-w-0 flex-col">
              <dt className="flex flex-wrap items-center gap-1 text-xs text-muted">
                <Punto color={p.color} /> {p.nombre}
                {/* La amortización y el interés salen de la tasa: "estimado"; el resto, como en la factura. */}
                {c.apertura[p.k].ars.valor !== null ? <ChipEtiqueta calc={c.apertura[p.k].ars} omitir={['proyectado']} /> : null}
              </dt>
              <dd className="min-w-0">
                <MontoTrazado calc={c.apertura[p.k].ars} moneda="ARS" titulo={`${t} · ${p.nombre.toLowerCase()}`} />
              </dd>
            </div>
          ))}
          <div className="col-span-2 flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 border-t border-border pt-1">
            <dt className="text-xs text-muted">Gasto (todo menos la amortización)</dt>
            <dd>
              <MontoTrazado calc={c.apertura.gasto.ars} moneda="ARS" titulo={`${t} · gasto`} />
            </dd>
          </div>
        </dl>
      )}
      <p className="mt-2 text-xs text-muted">
        {mes(c.periodo) ? `Canon de ${mes(c.periodo)} · ` : ''}fuente: {c.fuente_texto}
      </p>
    </div>
  )
}

function columnasFactura(): ColumnaGrilla<FilaCuota>[] {
  return [
    {
      id: 'cuota',
      titulo: 'Cuota',
      ancho: 92,
      flex: 0.7,
      prioridad: 0,
      orden: (c) => c.nro,
      celda: (c) => (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="num font-medium">{c.nro}</span>
          {mesCorto(c.periodo) ? <span className="whitespace-nowrap text-[11px] text-muted">canon {mesCorto(c.periodo)}</span> : null}
        </span>
      ),
    },
    { id: 'vence', titulo: 'Vence', ancho: 104, flex: 0.8, prioridad: 0, orden: (c) => c.fecha_vencimiento, celda: (c) => <span className="num">{fechaLarga(c.fecha_vencimiento)}</span> },
    ...PARTES_FACTURA.map(
      (p): ColumnaGrilla<FilaCuota> => ({
        id: p.k,
        titulo: p.nombre,
        tipo: 'numero',
        ancho: 128,
        prioridad: p.k === 'canon' ? 2 : 3,
        orden: (c) => c[p.k].valor,
        celda: (c) => <Cifra calc={c[p.k]} titulo={`Cuota ${c.nro} · ${p.nombre.toLowerCase()}`} />,
      }),
    ),
    { id: 'subtotal', titulo: 'Subtotal', tipo: 'numero', ancho: 124, prioridad: 5, orden: (c) => c.subtotal.valor, celda: (c) => <Cifra calc={c.subtotal} titulo={`Cuota ${c.nro} · subtotal`} /> },
    { id: 'total', titulo: 'Total', tipo: 'numero', ancho: 128, prioridad: 0, orden: (c) => c.total.valor, celda: (c) => <Cifra calc={c.total} titulo={`Cuota ${c.nro} · total`} fuerte /> },
    { id: 'estado', titulo: 'Estado', ancho: 150, flex: 1.1, prioridad: 1, celda: (c) => <Estado c={c} /> },
    {
      id: 'ccl',
      titulo: 'CCL del pago',
      tipo: 'numero',
      ancho: 116,
      prioridad: 4,
      celda: (c) => (c.pagada ? <MontoTrazado calc={c.ccl_pago} moneda="ARS" titulo={`Cuota ${c.nro} · CCL del día del pago`} decimales={2} /> : <span className="text-xs text-muted">—</span>),
    },
    {
      id: 'usd',
      titulo: 'En dólares',
      tipo: 'numero',
      ancho: 128,
      prioridad: 1,
      orden: (c) => c.total_usd.valor,
      celda: (c) => (
        <span className="inline-flex flex-col items-end gap-0.5">
          <MontoTrazado calc={c.total_usd} moneda="USD" titulo={`Cuota ${c.nro} · en dólares ${c.usd_rotulo}`} />
          <span className="font-sans text-[11px] text-muted">{c.usd_rotulo}</span>
        </span>
      ),
    },
    { id: 'fuente', titulo: 'Fuente', ancho: 110, prioridad: 6, celda: (c) => <span className="text-[12px] text-muted">{c.fuente_texto}</span> },
  ]
}

function columnasAbierta(): ColumnaGrilla<FilaCuota>[] {
  return [
    { id: 'cuota', titulo: 'Cuota', ancho: 80, flex: 0.6, prioridad: 0, orden: (c) => c.nro, celda: (c) => <span className="num font-medium">{c.nro}</span> },
    { id: 'vence', titulo: 'Vence', ancho: 104, flex: 0.8, prioridad: 1, orden: (c) => c.fecha_vencimiento, celda: (c) => <span className="num">{fechaLarga(c.fecha_vencimiento)}</span> },
    ...PARTES_ABIERTA.map(
      (p): ColumnaGrilla<FilaCuota> => ({
        id: p.k,
        titulo: p.nombre,
        tipo: 'numero',
        ancho: 124,
        prioridad: p.k === 'amortizacion' || p.k === 'interes' ? 0 : p.k === 'cargos' ? 4 : 3,
        orden: (c) => c.apertura[p.k].ars.valor,
        celda: (c) =>
          p.k === 'cargos' && !c.hay_cargos ? (
            <span className="text-xs text-muted" aria-label="sin cargos">
              —
            </span>
          ) : (
            <Cifra calc={c.apertura[p.k].ars} titulo={`Cuota ${c.nro} · ${p.nombre.toLowerCase()}`} />
          ),
      }),
    ),
    { id: 'gasto', titulo: 'Gasto', tipo: 'numero', ancho: 124, prioridad: 2, orden: (c) => c.apertura.gasto.ars.valor, celda: (c) => <Cifra calc={c.apertura.gasto.ars} titulo={`Cuota ${c.nro} · gasto`} chip={false} /> },
    { id: 'total', titulo: 'Total', tipo: 'numero', ancho: 128, prioridad: 0, orden: (c) => c.apertura.total.ars.valor, celda: (c) => <Cifra calc={c.apertura.total.ars} titulo={`Cuota ${c.nro} · total`} fuerte chip={false} /> },
  ]
}

export function CuadroMarcha({ leasing }: { leasing: Pick<VistaLeasing, 'cuotas' | 'opcion' | 'tea'> }) {
  const [lectura, setLectura] = useState<Lectura>('factura')
  const [filtro, setFiltro] = useState<FiltroCuadro>('por_pagar')
  const pagadas = leasing.cuotas.filter((c) => c.pagada).length
  const porPagar = leasing.cuotas.length - pagadas
  const filas = useMemo(() => filtrarCuadro(leasing.cuotas, filtro), [leasing.cuotas, filtro])
  const columnas = useMemo(() => (lectura === 'factura' ? columnasFactura() : columnasAbierta()), [lectura])
  // Con el dedo (una tablet), la cifra es un tocable de 44 px y lleva su chip debajo: la fila crece para que entren (D-100).
  const grueso = useMedia('(pointer: coarse)', false)
  const o = leasing.opcion
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Segmentado
          etiqueta="Qué cuotas ver"
          valor={filtro}
          onElegir={setFiltro}
          opciones={[
            ['por_pagar', `Por pagar (${porPagar})`],
            ['pagadas', `Pagadas (${pagadas})`],
            ['todas', `Todas (${leasing.cuotas.length})`],
          ]}
        />
        <Segmentado
          etiqueta="Cómo ver cada cuota"
          valor={lectura}
          onElegir={setLectura}
          opciones={[
            ['factura', 'La factura'],
            ['abierta', 'Amortización y gasto'],
          ]}
        />
      </div>
      {lectura === 'abierta' ? (
        <p className="text-[13px] text-muted">
          {leasing.tea.valor === null
            ? `Sin la tasa del contrato no se puede separar la amortización del interés: ${leasing.tea.motivo ?? ''} El IVA, el seguro y la percepción se ven igual.`
            : 'La amortización y el interés salen de la tasa del contrato: llevan el chip «estimado». Solo la amortización baja la deuda.'}
        </p>
      ) : null}
      <Grilla
        key={`${lectura}-${filtro}`}
        titulo={lectura === 'factura' ? 'Cuadro de marcha del leasing: la factura de cada cuota' : 'Cuadro de marcha del leasing: cada cuota abierta en amortización y gasto'}
        filas={filas}
        columnas={columnas}
        idFila={(c) => String(c.nro)}
        nombreFila={(c) => `Cuota ${c.nro}`}
        maxFilas={40}
        altoFila={grueso ? 72 : 52}
        tarjeta={(c) => <TarjetaCuota c={c} lectura={lectura} />}
        vacio={<p className="text-[13px] text-muted">{filtro === 'pagadas' ? 'Todavía no pagaste ninguna cuota.' : 'No queda ninguna cuota por pagar.'}</p>}
      />
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 rounded-item border border-dashed border-border-strong p-3 text-sm" data-opcion-compra>
        <span className="font-medium text-text">Opción de compra{o.fecha ? ` · ${fechaLarga(o.fecha)}` : ''}</span>
        <span className="inline-flex flex-wrap items-baseline gap-x-1">
          neto <MontoTrazado calc={o.neto.ars} moneda="ARS" titulo="Opción de compra neta" /> + IVA <MontoTrazado calc={o.iva.ars} moneda="ARS" titulo="IVA de la opción, a la alícuota observada" /> ={' '}
          <MontoTrazado calc={o.total.ars} moneda="ARS" titulo="Opción de compra con IVA" className="font-semibold" />
        </span>
        <span className="inline-flex flex-wrap items-baseline gap-x-1">
          <MontoTrazado calc={o.total.usd} moneda="USD" titulo="Opción de compra con IVA, en dólares al CCL de hoy" />
          <span className="text-xs text-muted">al CCL de hoy</span>
        </span>
        <ChipEtiqueta calc={o.neto.ars} />
      </div>
    </div>
  )
}
