'use client'

import { ChevronRight } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'

// Un grupo que se abre y se cierra (el activo por cuenta, en el teléfono). El
// botón que lo abre y las cifras del resumen son hermanos, nunca uno adentro
// del otro: tocar una cifra abre su traza, no pliega el grupo.

export function Plegable({ titulo, detalle, resumen, children, abierto = false }: { titulo: string; detalle?: string; resumen: ReactNode; children: ReactNode; abierto?: boolean }) {
  const [abre, setAbre] = useState(abierto)
  const id = useId()
  return (
    <div className="py-1.5">
      <button
        type="button"
        aria-expanded={abre}
        aria-controls={id}
        onClick={() => setAbre((a) => !a)}
        className="tocable flex min-h-11 w-full items-center gap-2 rounded-lg text-left"
      >
        <ChevronRight aria-hidden className={`size-4 shrink-0 text-muted transition-transform ${abre ? 'rotate-90' : ''}`} />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{titulo}</span>
          {detalle ? <span className="block text-[12px] text-muted">{detalle}</span> : null}
        </span>
      </button>
      <div>{resumen}</div>
      <div id={id} hidden={!abre} className="mt-1 border-l border-border pl-3">
        {children}
      </div>
    </div>
  )
}
