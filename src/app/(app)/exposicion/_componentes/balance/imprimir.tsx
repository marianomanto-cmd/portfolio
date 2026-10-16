'use client'

import { Printer } from 'lucide-react'
import { clasesBoton } from '@/components/ui'

/** Imprimir el balance (A4, con la fecha, el CCL y su fuente, las dos monedas y los chips como texto). */
export function BotonImprimir({ className = '' }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={`${clasesBoton('contorno', 'sm')} max-md:min-h-11 ${className}`}>
      <Printer aria-hidden className="size-4" />
      Imprimir
    </button>
  )
}
