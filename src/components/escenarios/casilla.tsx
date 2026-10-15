'use client'

import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

// Una casilla de verificación con el rótulo entero como objetivo (44 px con el
// dedo, D-30): la casilla nativa queda para el teclado y el lector de pantalla,
// y se dibuja una propia del mismo estado.
export function Casilla({
  marcada,
  onCambio,
  deshabilitada = false,
  children,
  className = '',
}: {
  marcada: boolean
  onCambio: (v: boolean) => void
  deshabilitada?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <label
      className={`tocable flex min-h-9 items-center gap-2 rounded-md text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${deshabilitada ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${className}`}
    >
      <input type="checkbox" className="sr-only" checked={marcada} disabled={deshabilitada} onChange={(e) => onCambio(e.target.checked)} />
      <span
        aria-hidden
        className={`inline-flex size-4 shrink-0 items-center justify-center rounded border ${marcada ? 'border-accent bg-accent text-on-accent' : 'border-border-strong bg-surface'}`}
      >
        {marcada ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
      {children}
    </label>
  )
}
