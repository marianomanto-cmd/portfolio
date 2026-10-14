import type { ReactNode } from 'react'
import { SelectorDatos } from './_componentes/selector-datos'

// Datos (4.9 de la visión): el título es el selector de subpantalla. El
// encabezado de la página, para el lector de pantalla, es "Datos": el selector
// que sigue dice en qué subpantalla estás.
export default function LayoutDatos({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-4">
      <h1 className="sr-only">Datos</h1>
      <SelectorDatos />
      {children}
    </div>
  )
}
