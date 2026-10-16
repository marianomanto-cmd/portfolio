import { fechaCorta } from '@/lib/domain/fechas'
import type { CalcVista } from '@/lib/domain/calc'
import type { LineaComparativa } from '@/lib/vistas/contratos-balance'
import { Traza } from '@/components/traza'
import { Cifra } from './cifra'

// Las cifras del comparativo del balance: un renglón a una fecha (pesos arriba,
// dólares abajo) y su diferencia, que dice "sin cambios" cuando es cero de
// verdad. Las usan la tabla impresa y la Grilla de la pantalla.

/** Una diferencia: "sin cambios" si es cero de verdad (con su traza), si no, el monto con signo. */
export function Diferencia({ calc, moneda, titulo, sinCambios }: { calc: CalcVista; moneda: 'ARS' | 'USD'; titulo: string; sinCambios: boolean }) {
  if (!sinCambios) return <Cifra calc={calc} moneda={moneda} titulo={titulo} decimales={moneda === 'USD' ? 0 : undefined} signo />
  return (
    <span data-cifra={titulo} className="inline-flex text-muted">
      <Traza calc={calc} titulo={titulo} moneda={moneda}>
        sin cambios
      </Traza>
    </span>
  )
}

/** Pesos arriba y dólares abajo de un renglón, a una fecha o su diferencia. */
export function ParComparado({ l, cual, fecha }: { l: LineaComparativa; cual: 'actual' | 'anterior' | 'diferencia'; fecha: string }) {
  const titulo = cual === 'diferencia' ? `${l.nombre}: diferencia` : `${l.nombre} al ${fechaCorta(fecha)}`
  if (cual === 'diferencia') {
    return (
      <span className="inline-flex flex-col items-end gap-0.5">
        <Diferencia calc={l.diferencia.ars} moneda="ARS" titulo={`${titulo} · en pesos`} sinCambios={l.sin_cambios.ars} />
        <Diferencia calc={l.diferencia.usd} moneda="USD" titulo={`${titulo} · en dólares`} sinCambios={l.sin_cambios.usd} />
      </span>
    )
  }
  const p = l[cual]
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <Cifra calc={p.ars} moneda="ARS" titulo={`${titulo} · en pesos`} />
      <Cifra calc={p.usd} moneda="USD" titulo={`${titulo} · en dólares`} decimales={0} />
    </span>
  )
}
