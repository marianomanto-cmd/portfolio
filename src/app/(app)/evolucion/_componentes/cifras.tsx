// Cifras de Evolución: cada una con su traza (tocar abre la fórmula y los
// insumos), en la moneda que elegiste (o las dos), con "sin dato" en vez de un
// cero y su chip cuando lleva una etiqueta. Sin cálculos: todo viene armado.

import type { ReactNode } from 'react'
import { etiquetaPrincipal, NOMBRE_ETIQUETA, type CalcVista, type Etiqueta } from '@/lib/domain/calc'
import type { Moneda } from '@/lib/domain/tipos'
import type { FraseDelDia, Par } from '@/lib/vistas/contratos'
import type { MonedaElegida } from '@/lib/vistas/contratos-evolucion'
import { MontoTrazado, Porcentaje, TextoConMontos } from '@/components/monto'
import { Traza } from '@/components/traza'
import { Chip, ChipEtiqueta } from '@/components/ui'

export function monedasDe(m: MonedaElegida): Moneda[] {
  return m === 'ars' ? ['ARS'] : m === 'usd' ? ['USD'] : ['ARS', 'USD']
}

/** Una cifra con su traza. Marca data-cifra (y data-sin-dato) para los tests de punta a punta. */
export function Cifra({
  calc,
  moneda,
  titulo,
  signo = false,
  color = false,
  decimales,
  className = '',
}: {
  calc: CalcVista
  moneda: Moneda
  titulo: string
  signo?: boolean
  color?: boolean
  decimales?: number
  className?: string
}) {
  return (
    <span data-cifra="" data-sin-dato={calc.valor === null ? '' : undefined} className={`inline-flex max-w-full ${className}`}>
      <MontoTrazado calc={calc} moneda={moneda} titulo={titulo} signo={signo} color={color} decimales={decimales ?? (moneda === 'ARS' ? 0 : 2)} />
    </span>
  )
}

/** El par en la moneda elegida: pesos y dólares (en su pastilla), o uno solo. */
export function CifraPar({
  par,
  moneda,
  titulo,
  signo = false,
  color = false,
  vertical = false,
  className = '',
}: {
  par: Par
  moneda: MonedaElegida
  titulo: string
  signo?: boolean
  color?: boolean
  vertical?: boolean
  className?: string
}) {
  const ms = monedasDe(moneda)
  // Sin dato en las dos monedas por el mismo motivo: un solo "sin dato" (la traza dice el porqué).
  if (ms.length === 2 && par.ars.valor === null && par.usd.valor === null && par.ars.motivo === par.usd.motivo)
    return (
      <span className={`inline-flex justify-end ${className}`}>
        <Cifra calc={par.ars} moneda="ARS" titulo={`${titulo} · en pesos y en dólares`} />
      </span>
    )
  return (
    <span className={`inline-flex ${vertical ? 'flex-col items-end gap-0.5' : 'flex-wrap items-baseline justify-end gap-x-2 gap-y-0.5'} ${className}`}>
      {ms.map((m) => (
        <Cifra key={m} calc={m === 'ARS' ? par.ars : par.usd} moneda={m} titulo={`${titulo} · ${m === 'ARS' ? 'en pesos' : 'en dólares'}`} signo={signo} color={color} />
      ))}
    </span>
  )
}

/** Un porcentaje con su traza. */
export function CifraPct({ calc, titulo }: { calc: CalcVista; titulo: string }) {
  return (
    <span data-cifra="" data-sin-dato={calc.valor === null ? '' : undefined} className="inline-flex">
      <Porcentaje calc={calc} titulo={titulo} />
    </span>
  )
}

/**
 * El chip de la etiqueta más grave del par (sin "suma parcial", que ya se lee
 * en el "sin dato") y, si lo hay, el rótulo de la línea. El rótulo dice qué es
 * ("crédito fiscal de la sociedad"); la etiqueta, qué tan firme es ("a
 * confirmar", "estimado"): van los dos, sin repetir la misma palabra.
 */
export function ChipPar({ par, rotulo }: { par: Par; rotulo?: string | null }) {
  const repetida = (Object.keys(NOMBRE_ETIQUETA) as Etiqueta[]).filter((e) => NOMBRE_ETIQUETA[e] === rotulo)
  return (
    <>
      {rotulo ? <Chip>{rotulo}</Chip> : null}
      <ChipEtiqueta calc={par.ars.etiquetas.length >= par.usd.etiquetas.length ? par.ars : par.usd} omitir={['parcial', ...repetida]} />
    </>
  )
}

/** Lo que no es un dato firme: estimado, supuesto, a confirmar, proyectado. */
const FIRMEZA: readonly Etiqueta[] = ['estimado', 'supuesto', 'a_confirmar', 'proyectado']

/**
 * El chip de firmeza de una fila de resultados (la deuda del leasing estimada,
 * D-154): lo que no es dato firme se ve en la fila. "Viejo" o "inferido" ya los
 * dice el puente y la traza de cada cifra.
 */
export function ChipFirmeza({ par }: { par: Par }) {
  return <ChipEtiquetas etiquetas={[...par.ars.etiquetas, ...par.usd.etiquetas].filter((e) => FIRMEZA.includes(e))} />
}

/** El chip de la etiqueta más grave de una lista (un mes proyectado: "supuesto"). */
export function ChipEtiquetas({ etiquetas }: { etiquetas: readonly Etiqueta[] }) {
  const e = etiquetaPrincipal(etiquetas)
  return e ? <Chip>{NOMBRE_ETIQUETA[e]}</Chip> : null
}

/** El motivo de un "sin dato", en gris, una sola vez para el par. */
export function MotivoPar({ par, className = '' }: { par: Par; className?: string }) {
  const motivo = par.ars.valor === null ? par.ars.motivo : par.usd.valor === null ? par.usd.motivo : null
  if (!motivo) return null
  return (
    <span className={`text-[13px] leading-5 text-muted ${className}`}>
      <TextoConMontos texto={motivo} />
    </span>
  )
}

/** La frase del período (reusa la de Hoy): el texto se lee de corrido y cada cifra abre su traza. */
export function FraseVista({ f }: { f: FraseDelDia }) {
  const partes: ReactNode[] = f.partes.map((p, i) => {
    if (!p.calc) return <span key={i}>{p.texto}</span>
    const c = p.calc
    const conSigno = /^[+−-]/.test(p.texto.trim())
    const tono = conSigno && c.valor !== null && !/^-?0(\.0+)?$/.test(c.valor) ? (c.valor.startsWith('-') ? 'text-negative' : 'text-positive') : ''
    return (
      <span key={i} data-cifra="" data-sin-dato={c.valor === null ? '' : undefined} className="inline-flex">
        <Traza calc={c} titulo={p.texto.includes('US$') ? 'Cifra de la frase, en dólares' : p.texto.trim().endsWith('%') ? 'Variación porcentual' : 'Cifra de la frase, en pesos'}>
          <span className={`font-semibold ${tono}`}>{c.valor === null ? <span className="font-normal italic text-muted">sin dato</span> : <TextoConMontos texto={p.texto} />}</span>
        </Traza>
      </span>
    )
  })
  return <p className="text-[15px] leading-7 md:text-base md:leading-8">{partes}</p>
}
