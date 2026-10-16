import Link from 'next/link'
import type { ExposicionResumen } from '@/lib/vistas/contratos'
import { Monto, MontoTrazado } from '@/components/monto'
import { Traza } from '@/components/traza'
import { Rotulo, Tarjeta } from '@/components/ui'
import { barraExposicion } from './barras'

// "Exposición neta al peso" (handoff, fila 2; captura 01): tus pesos
// financieros menos la deuda del leasing (D-101: el rótulo dice qué netea), en
// pesos y en dólares, con la barra divergente (eje al medio: corto a la
// izquierda en sangría, largo a la derecha en tinta) y la sensibilidad a una
// suba del 1% del CCL, que es una sensibilidad, no un pronóstico.

function lado(neto: string | null): 'corto' | 'largo' | null {
  if (neto === null || /^-?0(\.0+)?$/.test(neto)) return null
  return neto.startsWith('-') ? 'corto' : 'largo'
}

function Sensibilidad({ e }: { e: ExposicionResumen }) {
  const s = e.sensibilidad_usd_1pct.valor
  if (s === null) return null
  return (
    <>
      Si el CCL sube 1%, {s.startsWith('-') ? 'perdés' : 'ganás'}{' '}
      <Traza calc={e.sensibilidad_usd_1pct} titulo="Sensibilidad: si el CCL sube 1%" moneda="USD">
        <Monto valor={s.replace(/^-/, '')} moneda="USD" decimales={0} />
      </Traza>
      .
    </>
  )
}

export function TarjetaExposicion({ e }: { e: ExposicionResumen }) {
  const n = e.neto_ars.valor
  const l = lado(n)
  const barra = barraExposicion(n, e.pesos_financieros.ars.valor, e.deuda_pesos.ars.valor)
  return (
    <Tarjeta aria-label="Exposición neta al peso" className="flex min-w-0 flex-col gap-3.5 p-5 transition-colors duration-200 has-[a:hover]:border-border-strong">
      <Rotulo>Exposición neta al peso</Rotulo>
      <div className="flex flex-col gap-1">
        <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <MontoTrazado calc={e.neto_ars} moneda="ARS" titulo="Pesos financieros − deuda del leasing" decimales={0} className="cifra text-[26px] leading-tight" />
          <MontoTrazado calc={e.neto_usd} moneda="USD" titulo="El neto en dólares" decimales={0} className="text-[14px]" />
        </span>
        {/* Lo que netea, dicho (D-101): no es el financiero ni el total. Con sus dos partes, como antes del rediseño. */}
        <span className="text-[12px] text-muted">
          pesos financieros − deuda del leasing{' '}
          <span className="whitespace-nowrap">
            (<MontoTrazado calc={e.pesos_financieros.ars} moneda="ARS" titulo="Pesos financieros" compacta /> −{' '}
            <MontoTrazado calc={e.deuda_pesos.ars} moneda="ARS" titulo="Deuda del leasing" compacta />)
          </span>
        </span>
      </div>
      <span aria-hidden className="relative block h-3 rounded-full bg-surface-3">
        <span className="absolute -bottom-1 -top-1 left-1/2 w-px bg-border-strong" />
        {barra.lado === 'corto' ? <span className="absolute inset-y-0 right-1/2 rounded-l-full bg-accent" style={{ width: barra.ancho }} /> : null}
        {barra.lado === 'largo' ? <span className="absolute inset-y-0 left-1/2 rounded-r-full bg-text" style={{ width: barra.ancho }} /> : null}
      </span>
      <p className="text-[13px] leading-relaxed text-muted">
        {l === 'corto'
          ? 'Debés más pesos de los que tenés: estás corto en pesos. '
          : l === 'largo'
            ? 'Tenés más pesos de los que debés: estás largo en pesos. '
            : n === null
              ? `${e.neto_ars.motivo ?? 'Falta un dato.'} `
              : 'Tus pesos y tu deuda en pesos se compensan. '}
        <Sensibilidad e={e} />{' '}
        <Link href="/exposicion" className="tocable inline-flex items-center font-medium text-text underline-offset-2 hover:underline">
          Ver exposición →
        </Link>
      </p>
    </Tarjeta>
  )
}

/**
 * En el teléfono, un renglón de 48 px (visión §4.1): el neto, si es largo o
 * corto, y en dólares. La tarjeta entera queda para la compu.
 */
export function RenglonExposicion({ e }: { e: ExposicionResumen }) {
  const l = lado(e.neto_ars.valor)
  return (
    <Tarjeta as="div" className="px-3">
      <div className="flex min-h-12 items-center justify-between gap-2 text-[13px]">
        <Link href="/exposicion" className="tocable inline-flex min-w-0 items-center font-medium text-text">
          Pesos fin. − leasing
        </Link>
        <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
          {l ? <span className="text-muted">{l}</span> : null}
          <MontoTrazado calc={e.neto_ars} moneda="ARS" titulo="Pesos financieros − deuda del leasing" compacta />
          <MontoTrazado calc={e.neto_usd} moneda="USD" titulo="El neto en dólares" decimales={0} />
        </span>
      </div>
    </Tarjeta>
  )
}
