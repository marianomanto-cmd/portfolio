'use client'

import { pasoDeslizante, textoDeslizante, valorDeslizante } from '@/lib/domain/flujo/panel'
import { Barra } from './barra'

// El deslizante de una sola dirección (lo que invertís del excedente, el
// ajuste mensual del ingreso en pesos; plan §6 D.1): la misma barra que las
// variables (D-164), de 0 al máximo, de a 0,1, con − y + del mismo paso y el
// número a la vista. Las cuentas (paso, tope, redondeo, el texto) están en
// panel.ts, con test.

export function Deslizante({
  nombre,
  valor,
  max,
  unidad,
  signo,
  enCero,
  onCambio,
}: {
  nombre: string
  valor: string | null
  max: number
  unidad: string
  signo: '−' | '+'
  /** Cómo se dice el 0 ("nominal"). */
  enCero?: string
  onCambio: (v: string) => void
}) {
  const texto = textoDeslizante(valor, unidad, { signo: signo === '+' && unidad !== '%', enCero })
  return (
    <div className="mt-2 flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] text-muted">{nombre}</span>
        <output className={`num shrink-0 text-[12px] ${valor === null ? 'italic text-muted' : 'text-text'}`} aria-live="polite">
          {texto}
        </output>
      </div>
      <Barra
        nombre={`${nombre}: cuánto`}
        min={0}
        max={max}
        paso={0.1}
        posicion={valor}
        texto={texto}
        etiquetas={{ menos: `${nombre}: 0,1 menos`, mas: `${nombre}: 0,1 más` }}
        onPosicion={(t) => {
          const v = valorDeslizante(t, max)
          if (v !== null) onCambio(v)
        }}
        onMenos={() => onCambio(pasoDeslizante(valor, -0.1, max))}
        onMas={() => onCambio(pasoDeslizante(valor, 0.1, max))}
      />
    </div>
  )
}
