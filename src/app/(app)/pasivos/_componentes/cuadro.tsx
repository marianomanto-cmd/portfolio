'use client'

import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { CalcVista } from '@/lib/domain/calc'
import { fechaCorta, fechaLarga } from '@/lib/domain/fechas'
import type { FilaCuota, VistaLeasing } from '@/lib/vistas/contratos-pasivos'
import { MontoTrazado } from '@/components/monto'
import { Chip, ChipEtiqueta } from '@/components/ui'
import { COLOR_PARTE } from '../_lib/graficos'

// El cuadro de marcha (plan §5 C.1, 2): desde 1280 px una tabla; debajo,
// tarjetas (nunca scroll horizontal, D-30). Las pagadas plegadas, las próximas
// 6 a la vista y el resto plegado. Dos lecturas de la misma cuota: la factura
// (canon, seguro, IVA, percepción) y abierta (amortización contra gasto, D-152).

type Lectura = 'factura' | 'abierta'

const mes = (p: string | null) => (p ? `${p.slice(5, 7)}/${p.slice(0, 4)}` : null)

function Cifra({ calc, moneda = 'ARS', titulo, fuerte = false }: { calc: CalcVista; moneda?: 'ARS' | 'USD'; titulo: string; fuerte?: boolean }) {
  return <MontoTrazado calc={calc} moneda={moneda} titulo={titulo} className={fuerte ? 'font-semibold' : ''} />
}

function Estado({ c, apilado = false }: { c: FilaCuota; apilado?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 ${apilado ? 'flex-col items-start' : 'flex-wrap'}`}>
      <span className={`text-sm ${c.pagada ? 'text-text' : 'text-muted'}`}>{c.estado_texto}</span>
      {c.estado === 'proyectada' ? <Chip>proyectada</Chip> : null}
    </span>
  )
}

function Punto({ color }: { color: string }) {
  return <span aria-hidden className="inline-block size-2 shrink-0 rounded-full" style={{ background: color }} />
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

function Tarjeta({ c, lectura }: { c: FilaCuota; lectura: Lectura }) {
  const t = `Cuota ${c.nro}`
  return (
    <li className={`min-w-0 rounded-xl border p-3 ${c.pagada ? 'border-border bg-surface' : 'border-dashed border-border-strong bg-surface'}`}>
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-semibold text-text">
          Cuota {c.nro} <span className="font-normal text-muted">· vence {fechaCorta(c.fecha_vencimiento)}</span>
        </p>
        <Estado c={c} />
      </div>
      <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 text-lg">
        <Cifra calc={lectura === 'factura' ? c.total : c.apertura.total.ars} titulo={`${t} · total en pesos`} fuerte />
        <span className="inline-flex flex-wrap items-baseline gap-x-1 text-sm">
          <Cifra calc={lectura === 'factura' ? c.total_usd : c.apertura.total.usd} moneda="USD" titulo={`${t} · total en dólares ${c.usd_rotulo}`} />
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
                <Cifra calc={c[p.k]} titulo={`${t} · ${p.nombre.toLowerCase()}`} />
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
                <Cifra calc={c.apertura[p.k].ars} titulo={`${t} · ${p.nombre.toLowerCase()}`} />
              </dd>
            </div>
          ))}
          <div className="col-span-2 flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 border-t border-border pt-1">
            <dt className="text-xs text-muted">Gasto (todo menos la amortización)</dt>
            <dd>
              <Cifra calc={c.apertura.gasto.ars} titulo={`${t} · gasto`} />
            </dd>
          </div>
        </dl>
      )}
      <p className="mt-2 text-xs text-muted">
        {mes(c.periodo) ? `Canon de ${mes(c.periodo)} · ` : ''}fuente: {c.fuente_texto}
      </p>
    </li>
  )
}

/** Las columnas de la factura en la tabla: subtotal, CCL del pago y fuente, solo desde 1600 px (si no, no entran). */
const COLS_FACTURA = [
  { k: 'canon', nombre: 'Canon', ancho: false },
  { k: 'seguro', nombre: 'Seguro', ancho: false },
  { k: 'subtotal', nombre: 'Subtotal', ancho: true },
  { k: 'iva', nombre: 'IVA', ancho: false },
  { k: 'percepcion', nombre: 'Percepción', ancho: false },
] as const

const SOLO_ANCHO = 'hidden 2xl:table-cell'

function Fila({ c, lectura }: { c: FilaCuota; lectura: Lectura }) {
  const t = `Cuota ${c.nro}`
  const td = 'px-2 py-1.5 text-right align-top'
  return (
    <tr className={`border-t border-border ${c.pagada ? '' : 'bg-surface-2/40'}`}>
      <th scope="row" className="px-2 py-1.5 text-left align-top font-medium">
        {c.nro}
        {mes(c.periodo) ? <span className="block text-xs font-normal text-muted">canon {mes(c.periodo)}</span> : null}
      </th>
      <td className="whitespace-nowrap px-2 py-1.5 text-left align-top text-sm">{fechaCorta(c.fecha_vencimiento)}</td>
      {lectura === 'factura' ? (
        <>
          {COLS_FACTURA.map((p) => (
            <td key={p.k} className={`${td} ${p.ancho ? SOLO_ANCHO : ''}`}>
              <span className="inline-flex flex-col items-end gap-0.5">
                <Cifra calc={c[p.k]} titulo={`${t} · ${p.nombre.toLowerCase()}`} />
                <ChipEtiqueta calc={c[p.k]} omitir={['proyectado']} />
              </span>
            </td>
          ))}
          <td className={td}>
            <Cifra calc={c.total} titulo={`${t} · total`} fuerte />
          </td>
          <td className="px-2 py-1.5 text-left align-top">
            <Estado c={c} apilado />
          </td>
          <td className={`${td} ${SOLO_ANCHO}`}>
            {c.pagada ? <Cifra calc={c.ccl_pago} titulo={`${t} · CCL del día del pago`} /> : <span className="text-xs text-muted">—</span>}
          </td>
          <td className={td}>
            <span className="inline-flex flex-col items-end">
              <Cifra calc={c.total_usd} moneda="USD" titulo={`${t} · en dólares ${c.usd_rotulo}`} />
              <span className="text-xs text-muted">{c.usd_rotulo}</span>
            </span>
          </td>
          <td className={`px-2 py-1.5 text-left align-top text-xs text-muted ${SOLO_ANCHO}`}>{c.fuente_texto}</td>
        </>
      ) : (
        <>
          {PARTES_ABIERTA.map((p) => (
            <td key={p.k} className={td}>
              {p.k === 'cargos' && !c.hay_cargos ? (
                <span className="text-xs text-muted" aria-label="sin cargos">
                  —
                </span>
              ) : (
                <Cifra calc={c.apertura[p.k].ars} titulo={`${t} · ${p.nombre.toLowerCase()}`} />
              )}
            </td>
          ))}
          <td className={td}>
            <Cifra calc={c.apertura.gasto.ars} titulo={`${t} · gasto`} />
          </td>
          <td className={td}>
            <Cifra calc={c.apertura.total.ars} titulo={`${t} · total`} fuerte />
          </td>
        </>
      )}
    </tr>
  )
}

function Plegado({ abierto, onClick, children }: { abierto: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={abierto}
      className="tocable inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-accent hover:bg-surface-2 lg:min-h-9"
    >
      {abierto ? <ChevronDown aria-hidden className="size-4" /> : <ChevronRight aria-hidden className="size-4" />}
      {children}
    </button>
  )
}

export function CuadroMarcha({ leasing }: { leasing: Pick<VistaLeasing, 'cuotas' | 'opcion' | 'tea'> }) {
  const [lectura, setLectura] = useState<Lectura>('factura')
  const [verPagadas, setVerPagadas] = useState(false)
  const [verResto, setVerResto] = useState(false)
  const pagadas = leasing.cuotas.filter((c) => c.pagada)
  const pendientes = leasing.cuotas.filter((c) => !c.pagada)
  const proximas = pendientes.slice(0, 6)
  const resto = pendientes.slice(6)
  const grupos: { clave: string; filas: FilaCuota[] }[] = [
    ...(verPagadas ? [{ clave: 'pagadas', filas: pagadas }] : []),
    { clave: 'proximas', filas: proximas },
    ...(verResto ? [{ clave: 'resto', filas: resto }] : []),
  ]
  const columnas: { nombre: string; izq?: boolean; ancho?: boolean; estimado?: boolean }[] =
    lectura === 'factura'
      ? [
          { nombre: 'Cuota', izq: true },
          { nombre: 'Vence', izq: true },
          ...COLS_FACTURA.map((p) => ({ nombre: p.nombre, ancho: p.ancho })),
          { nombre: 'Total' },
          { nombre: 'Estado', izq: true },
          { nombre: 'CCL del pago', ancho: true },
          { nombre: 'En dólares' },
          { nombre: 'Fuente', izq: true, ancho: true },
        ]
      : [
          { nombre: 'Cuota', izq: true },
          { nombre: 'Vence', izq: true },
          // La amortización y el interés salen de la tasa del contrato: la columna lleva el chip "estimado".
          ...['Amortización', 'Interés', 'IVA', 'Seguro', 'Percepción', 'Cargos', 'Gasto', 'Total'].map((nombre) => ({
            nombre,
            estimado: leasing.tea.valor !== null && (nombre === 'Amortización' || nombre === 'Interés'),
          })),
        ]
  const o = leasing.opcion
  return (
    <div className="min-w-0 space-y-3">
      <div role="group" aria-label="Cómo ver cada cuota" className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface-2 p-1 sm:inline-grid sm:w-auto">
        {(
          [
            ['factura', 'La factura'],
            ['abierta', 'Amortización y gasto'],
          ] as const
        ).map(([k, nombre]) => (
          <button
            key={k}
            type="button"
            aria-pressed={lectura === k}
            onClick={() => setLectura(k)}
            className={`tocable min-h-11 rounded-lg px-3 text-sm font-medium lg:min-h-9 ${lectura === k ? 'bg-surface text-text shadow-[var(--shadow)]' : 'text-muted hover:text-text'}`}
          >
            {nombre}
          </button>
        ))}
      </div>
      {lectura === 'abierta' && leasing.tea.valor === null ? (
        <p className="text-sm text-muted">
          Sin la tasa del contrato no se puede separar la amortización del interés: {leasing.tea.motivo} El IVA, el seguro y la percepción se ven igual.
        </p>
      ) : null}

      {pagadas.length ? (
        <Plegado abierto={verPagadas} onClick={() => setVerPagadas((v) => !v)}>
          {verPagadas ? 'Ocultar las pagadas' : `${pagadas.length} pagadas`}
        </Plegado>
      ) : null}

      {/* Desde 1280 px: tabla. */}
      <table className="hidden w-full text-sm xl:table">
        <caption className="sr-only">Cuadro de marcha del leasing</caption>
        <thead>
          <tr className="text-xs text-muted">
            {columnas.map((c) => (
              <th key={c.nombre} scope="col" className={`px-2 py-1 font-medium ${c.izq ? 'text-left' : 'text-right'} ${c.ancho ? SOLO_ANCHO : ''}`}>
                {c.nombre}
                {c.estimado ? (
                  <span className="ml-1 inline-block align-middle">
                    <Chip>estimado</Chip>
                  </span>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        {grupos.map((g) => (
          <tbody key={g.clave}>
            {g.filas.map((c) => (
              <Fila key={c.nro} c={c} lectura={lectura} />
            ))}
          </tbody>
        ))}
      </table>

      {/* Debajo de 1280 px: tarjetas. */}
      {grupos.map((g) => (
        <ul key={g.clave} className="grid gap-2 md:grid-cols-2 xl:hidden">
          {g.filas.map((c) => (
            <Tarjeta key={c.nro} c={c} lectura={lectura} />
          ))}
        </ul>
      ))}

      {resto.length ? (
        <Plegado abierto={verResto} onClick={() => setVerResto((v) => !v)}>
          {verResto ? 'Ocultar las últimas' : `${resto.length} más`}
        </Plegado>
      ) : null}

      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border border-dashed border-border-strong p-3 text-sm">
        <span className="font-medium text-text">Opción de compra{o.fecha ? ` · ${fechaLarga(o.fecha)}` : ''}</span>
        <span className="inline-flex flex-wrap items-baseline gap-x-1">
          neto <Cifra calc={o.neto.ars} titulo="Opción de compra neta" /> + IVA <Cifra calc={o.iva.ars} titulo="IVA de la opción, a la alícuota observada" /> ={' '}
          <Cifra calc={o.total.ars} titulo="Opción de compra con IVA" fuerte />
        </span>
        <span className="inline-flex flex-wrap items-baseline gap-x-1">
          <Cifra calc={o.total.usd} moneda="USD" titulo="Opción de compra con IVA, en dólares al CCL de hoy" />
          <span className="text-xs text-muted">al CCL de hoy</span>
        </span>
        <ChipEtiqueta calc={o.neto.ars} />
      </div>
    </div>
  )
}
