'use client'

import { Minus, Plus } from 'lucide-react'
import { pasoDeslizante, valorDeslizante } from '@/lib/domain/flujo/panel'

// El deslizante de una variable (plan §6 D.1): de 0 al máximo de la
// dirección, de a 0,1, con − y + del mismo paso y el número a la vista. Las
// cuentas (paso, tope, redondeo) están en panel.ts, con test.

export function Deslizante({
  nombre,
  valor,
  max,
  unidad,
  signo,
  onCambio,
}: {
  nombre: string
  valor: string | null
  max: number
  unidad: string
  signo: '−' | '+'
  onCambio: (v: string) => void
}) {
  const texto = valor === null ? 'sin número' : `${signo}${valor.replace('.', ',')}${unidad === 'puntos' ? ' pts' : unidad}`
  return (
    <div className="mt-2 flex items-center gap-2">
      <button
        type="button"
        className="tocable inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-text hover:bg-surface-2"
        aria-label={`${nombre}: 0,1 menos`}
        onClick={() => onCambio(pasoDeslizante(valor, -0.1, max))}
      >
        <Minus aria-hidden className="size-4" />
      </button>
      <input
        type="range"
        min={0}
        max={max}
        step={0.1}
        value={valor ?? '0'}
        aria-label={`${nombre}: cuánto`}
        aria-valuetext={texto}
        className="tocable h-9 min-w-0 flex-1 cursor-pointer accent-[var(--accent)]"
        onChange={(e) => {
          const v = valorDeslizante(e.target.value, max)
          if (v !== null) onCambio(v)
        }}
      />
      <button
        type="button"
        className="tocable inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-text hover:bg-surface-2"
        aria-label={`${nombre}: 0,1 más`}
        onClick={() => onCambio(pasoDeslizante(valor, 0.1, max))}
      >
        <Plus aria-hidden className="size-4" />
      </button>
      <output className={`num w-[5.5rem] shrink-0 text-right text-sm ${valor === null ? 'text-muted italic' : 'font-medium text-text'}`} aria-live="polite">
        {texto}
      </output>
    </div>
  )
}
