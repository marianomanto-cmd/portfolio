import type { ReactNode } from 'react'
import { compacto, monto as formatoMonto, porcentaje } from '@/lib/domain/dinero'
import type { CalcVista } from '@/lib/domain/calc'
import { Traza } from './traza'

// Cifras. ARS en tinta normal con "$"; USD siempre dentro de la pastilla
// tintada con "US$" (D-68 de la visión): la forma distingue la moneda sin leer
// el símbolo. "Sin dato" nunca es cero: es una palabra gris y tocable.

type Moneda = 'ARS' | 'USD'

/** Un monto ya formateado que redondea a cero ("$ 0", "US$ 0,00"). */
const ES_CERO = /^[−+-]?(US)?\$ 0(,0+)?$/

/** Un monto dentro de un texto armado: "US$ 4.200", "−$ 21.400.000", "+$ 6,2 M", "US$ 1,8k". */
const MONTO_EN_TEXTO = /[−+-]?(?:US\$|\$)\s?[−+-]?\d(?:[\d.]*\d)?(?:,\d+)?(?:\s?M\b|k\b)?/g

/**
 * Un texto ya armado (un motivo, un pedazo de la frase) con montos adentro:
 * cada monto va en su .monto (el modo privado lo oculta) y, en dólares, en su
 * pastilla (D-68). No es una cifra con traza: la traza la da quien armó el texto.
 */
export function TextoConMontos({ texto }: { texto: string }) {
  const partes: ReactNode[] = []
  let desde = 0
  for (const m of texto.matchAll(MONTO_EN_TEXTO)) {
    const i = m.index ?? 0
    if (i > desde) partes.push(texto.slice(desde, i))
    partes.push(
      <span key={i} className={m[0].includes('US$') ? 'num monto usd' : 'num monto whitespace-nowrap'}>
        {m[0]}
      </span>,
    )
    desde = i + m[0].length
  }
  if (desde === 0) return texto
  if (desde < texto.length) partes.push(texto.slice(desde))
  return <>{partes}</>
}

export function SinDato({ motivo }: { motivo?: string }) {
  return (
    <span className="text-muted italic" title={motivo}>
      sin dato
    </span>
  )
}

export function Monto({
  valor,
  moneda,
  signo = false,
  decimales,
  compacta = false,
  color = false,
  className = '',
}: {
  valor: string | null
  moneda: Moneda
  signo?: boolean
  decimales?: number
  compacta?: boolean
  /** Pinta verde o rojo según el signo (solo para resultados). */
  color?: boolean
  className?: string
}) {
  if (valor === null) return <SinDato />
  const base = compacta ? compacto(valor, moneda) : formatoMonto(valor, moneda, { signo, decimales })
  const cero = ES_CERO.test(base)
  // El compacto no trae el "+": se agrega si se pidió signo, salvo en lo que redondea a cero.
  const texto = compacta && signo && !cero && !base.startsWith('−') ? `+${base}` : base
  const tono =
    color && !cero
      ? valor.startsWith('-')
        ? 'text-negative'
        : 'text-positive'
      : ''
  const flecha = color && tono ? (valor.startsWith('-') ? ' ▼' : ' ▲') : ''
  if (moneda === 'USD') {
    return (
      <span className={`num usd monto ${tono} ${className}`}>
        {texto}
        {flecha}
      </span>
    )
  }
  return (
    <span className={`num monto whitespace-nowrap ${tono} ${className}`}>
      {texto}
      {flecha}
    </span>
  )
}

/** Un monto con su traza: tocar o pasar el mouse abre la fórmula y los insumos. */
export function MontoTrazado({
  calc,
  moneda,
  titulo,
  ...resto
}: {
  calc: CalcVista
  moneda: Moneda
  titulo: string
  signo?: boolean
  decimales?: number
  compacta?: boolean
  color?: boolean
  className?: string
}) {
  return (
    <Traza calc={calc} titulo={titulo} moneda={moneda}>
      {calc.valor === null ? (
        <SinDato motivo={calc.motivo} />
      ) : (
        <Monto valor={calc.valor} moneda={moneda} {...resto} />
      )}
    </Traza>
  )
}

/** Porcentaje (la fracción viene como texto: "0.0123" → "1,23%"). */
export function Porcentaje({
  calc,
  titulo,
  color = false,
  signo = true,
}: {
  calc: CalcVista
  titulo: string
  color?: boolean
  signo?: boolean
}) {
  const v = calc.valor
  const tono =
    color && v !== null && Number(v) !== 0
      ? v.startsWith('-')
        ? 'text-negative'
        : 'text-positive'
      : ''
  return (
    <Traza calc={calc} titulo={titulo}>
      {v === null ? (
        <SinDato motivo={calc.motivo} />
      ) : (
        <span className={`num ${tono}`}>
          {porcentaje(v, { signo })}
          {color && tono ? (v.startsWith('-') ? ' ▼' : ' ▲') : ''}
        </span>
      )}
    </Traza>
  )
}
