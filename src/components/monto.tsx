import { compacto, monto as formatoMonto, porcentaje } from '@/lib/domain/dinero'
import type { CalcVista } from '@/lib/domain/calc'
import { Traza } from './traza'

// Cifras. ARS en tinta normal con "$"; USD siempre dentro de la pastilla
// tintada con "US$" (D-68 de la visión): la forma distingue la moneda sin leer
// el símbolo. "Sin dato" nunca es cero: es una palabra gris y tocable.

type Moneda = 'ARS' | 'USD'

export function SinDato({ motivo }: { motivo?: string }) {
  return (
    <span className="text-faint italic" title={motivo}>
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
  const texto = compacta
    ? compacto(valor, moneda)
    : formatoMonto(valor, moneda, { signo, decimales })
  const tono =
    color && !/^[−-]?(US)?\$ 0(,0+)?$/.test(texto)
      ? valor.startsWith('-')
        ? 'text-negative'
        : 'text-positive'
      : ''
  const flecha = color && tono ? (valor.startsWith('-') ? ' ▼' : ' ▲') : ''
  if (moneda === 'USD') {
    return (
      <span className={`num usd ${tono} ${className}`}>
        {texto}
        {flecha}
      </span>
    )
  }
  return (
    <span className={`num ${tono} ${className}`}>
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
