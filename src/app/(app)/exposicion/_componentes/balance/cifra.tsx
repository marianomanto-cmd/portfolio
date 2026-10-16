import type { CalcVista } from '@/lib/domain/calc'
import type { Par } from '@/lib/vistas/contratos'
import { MontoTrazado } from '@/components/monto'

// Una cifra del Balance: el monto con su traza (tocarlo abre la fórmula y los
// insumos) y dos marcas para los tests (data-cifra, data-sin-dato).

export function Cifra({
  calc,
  moneda,
  titulo,
  decimales,
  compacta,
  signo,
  className = '',
}: {
  calc: CalcVista
  moneda: 'ARS' | 'USD'
  titulo: string
  decimales?: number
  compacta?: boolean
  /** Con signo (+ o −): para una diferencia. Sin color: no es un resultado. */
  signo?: boolean
  className?: string
}) {
  return (
    <span data-cifra={titulo} data-sin-dato={calc.valor === null ? '' : undefined} className="inline-flex min-w-0 max-w-full">
      <MontoTrazado calc={calc} moneda={moneda} titulo={titulo} decimales={decimales} compacta={compacta} signo={signo} className={className} />
    </span>
  )
}

/** Pesos y dólares de una misma cifra: los pesos en tinta, los dólares en su pastilla (D-68). */
export function ParCifra({
  par,
  titulo,
  vertical = false,
  className = '',
  claseArs = '',
  claseUsd = '',
}: {
  par: Par
  titulo: string
  vertical?: boolean
  className?: string
  claseArs?: string
  claseUsd?: string
}) {
  return (
    <span className={`inline-flex min-w-0 max-w-full ${vertical ? 'flex-col items-end gap-0.5' : 'flex-wrap items-baseline gap-x-2 gap-y-0.5'} ${className}`}>
      <Cifra calc={par.ars} moneda="ARS" titulo={`${titulo} · en pesos`} className={claseArs} />
      <Cifra calc={par.usd} moneda="USD" titulo={`${titulo} · en dólares`} decimales={0} className={claseUsd} />
    </span>
  )
}
