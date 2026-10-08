import type { ReactNode } from 'react'
import { etiquetaPrincipal, type CalcVista, type Etiqueta } from '@/lib/domain/calc'
import type { Par } from '@/lib/vistas/contratos'
import { MontoTrazado } from './monto'

// Piezas visuales compartidas (visión §4.0). Sin estado: sirven en Server y
// Client Components.

export function Tarjeta({
  children,
  className = '',
  as: Tag = 'section',
  ...resto
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'div' | 'article' | 'aside' | 'li'
} & Record<`aria-${string}` | `data-${string}`, string | undefined>) {
  return (
    <Tag className={`rounded-xl border border-border bg-surface shadow-[var(--shadow)] ${className}`} {...resto}>
      {children}
    </Tag>
  )
}

/** Rótulo chico de una tarjeta: "PATRIMONIO FINANCIERO". */
export function Rotulo({ children, className = '', as: Tag = 'h2' }: { children: ReactNode; className?: string; as?: 'h2' | 'h3' | 'p' | 'span' }) {
  return <Tag className={`text-[11px] font-semibold uppercase tracking-[0.08em] text-muted ${className}`}>{children}</Tag>
}

const NOMBRE_ETIQUETA: Record<Etiqueta, string> = {
  viejo: 'viejo',
  declarado: 'declarado',
  inferido: 'inferido',
  pendiente: 'pendiente',
  parcial: 'suma parcial',
}

/** Un solo chip gris por número, con la etiqueta más grave (D-67). Lo verificado no lleva nada. */
export function Chip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-md bg-surface-3 px-1.5 py-px text-[11px] font-medium leading-4 text-muted ${className}`}>
      {children}
    </span>
  )
}

export function ChipEtiqueta({ calc, omitir = [] }: { calc: CalcVista; omitir?: Etiqueta[] }) {
  const e = etiquetaPrincipal(calc.etiquetas.filter((x) => !omitir.includes(x)))
  return e ? <Chip>{NOMBRE_ETIQUETA[e]}</Chip> : null
}

/** Par ARS/USD: ARS en tinta normal a la izquierda (o arriba), USD en su pastilla (D-68). */
export function ParMonto({
  par,
  titulo,
  signo = false,
  color = false,
  decimalesUsd,
  vertical = false,
  className = '',
}: {
  par: Par
  titulo: string
  signo?: boolean
  color?: boolean
  decimalesUsd?: number
  vertical?: boolean
  className?: string
}) {
  return (
    <span className={`inline-flex ${vertical ? 'flex-col items-end gap-0.5' : 'flex-wrap items-baseline gap-x-2 gap-y-0.5'} ${className}`}>
      <MontoTrazado calc={par.ars} moneda="ARS" titulo={`${titulo} · en pesos`} signo={signo} color={color} />
      <MontoTrazado calc={par.usd} moneda="USD" titulo={`${titulo} · en dólares`} signo={signo} color={color} decimales={decimalesUsd} />
    </span>
  )
}

/** Aviso en una línea, en tinta neutra (nunca rojo para datos). */
export function Aviso({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-muted ${className}`}>{children}</p>
}
