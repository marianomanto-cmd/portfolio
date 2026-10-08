import type { ReactNode } from 'react'
import { Atajos, BotonPrivado, BotonTema, TituloSeccion } from './barra-superior'
import { BarraInferior, BarraLateral } from './nav'

// El marco de la app (visión §3): barra lateral en desktop (240 px, colapsable
// a 64), barra inferior en el teléfono con Cargar al centro, y arriba el
// indicador de datos, el ojo del modo privado y el tema. Sin max-width.
//
// No lee la base: el estado de los datos y el punto de Cargar llegan armados
// desde el layout de (app). Así la página de "no encontrada" usa el mismo marco
// sin leer nada, también en las rutas que el proxy deja pasar sin sesión.

export function Marco({ children, estado, puntoCarga }: { children: ReactNode; estado?: ReactNode; puntoCarga?: ReactNode }) {
  return (
    <>
      <a
        href="#contenido"
        className="sr-only z-[60] rounded-lg bg-surface px-3 py-2 text-sm font-medium shadow-lg focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Saltar al contenido
      </a>
      <Atajos />
      <BarraLateral puntoCarga={puntoCarga} />
      <div className="flex min-h-dvh flex-col pl-[var(--nav-w)]">
        <header className="sticky top-0 z-40 flex h-[var(--barra-sup)] shrink-0 items-center gap-2 border-b border-border bg-bg/85 px-4 backdrop-blur-md md:px-6">
          <TituloSeccion />
          <div className="ml-auto flex items-center gap-1">
            {estado}
            <BotonPrivado />
            <BotonTema />
          </div>
        </header>
        <main
          id="contenido"
          tabIndex={-1}
          className="flex-1 px-4 pb-[calc(var(--barra-inf)+env(safe-area-inset-bottom)+1.5rem)] pt-3 outline-none md:px-6 md:pt-6"
        >
          {children}
        </main>
      </div>
      <BarraInferior puntoCarga={puntoCarga} />
    </>
  )
}
