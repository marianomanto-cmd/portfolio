import type { ReactNode } from 'react'
import { SelectorDatos } from './_componentes/selector-datos'

// Datos (4.9 de la visión): el título es el selector de subpantalla.
export default function LayoutDatos({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-4">
      <SelectorDatos />
      {children}
    </div>
  )
}
