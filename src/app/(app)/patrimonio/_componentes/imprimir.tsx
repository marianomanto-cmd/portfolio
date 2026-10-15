'use client'

import { Printer } from 'lucide-react'

/** Imprimir el balance (A4, con la fecha, el CCL y su fuente, las dos monedas y los chips como texto). */
export function BotonImprimir({ className = '' }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`tocable inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:border-border-strong max-md:h-11 ${className}`}
    >
      <Printer aria-hidden className="size-4" />
      Imprimir
    </button>
  )
}
