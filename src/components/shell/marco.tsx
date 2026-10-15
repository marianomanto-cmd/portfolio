import type { ReactNode } from 'react'
import { Atajos, BotonCargar, BotonPrivado, TituloSeccion } from './barra-superior'
import { BarraInferior, BarraLateral, PestanasPatrimonio } from './nav'

// El marco de la app (D-156, sobre la visión §3): barra lateral en desktop
// (232 px, colapsable a 68), barra inferior en el teléfono con Cargar al
// centro, y arriba, sticky, el nombre de la pantalla, el chip de los datos, el
// ojo del modo privado y Cargar. Sin max-width (spec §UI).
//
// El contenido (main) lleva el relleno de la anatomía: 32 px arriba, 28 a los
// costados y 64 abajo (16 px a los costados en el teléfono). Cada pantalla
// apila sus bloques con 20 px de separación (gap-5).
//
// No lee la base: el estado de los datos y el punto de Cargar llegan armados
// desde el layout de (app). Así la página de "no encontrada" usa el mismo marco
// sin leer nada, también en las rutas que el proxy deja pasar sin sesión.

export function Marco({ children, estado, puntoCarga }: { children: ReactNode; estado?: ReactNode; puntoCarga?: ReactNode }) {
  return (
    <>
      <a
        href="#contenido"
        className="sr-only z-[60] rounded-full bg-surface px-4 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Saltar al contenido
      </a>
      <Atajos />
      <BarraLateral />
      <div className="flex min-h-dvh flex-col pl-[var(--nav-w)]">
        <header className="sticky top-0 z-40 flex h-[var(--barra-sup)] shrink-0 items-center gap-2 border-b border-border bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] px-4 backdrop-blur-[14px] md:gap-4 md:px-7">
          <TituloSeccion />
          <div className="flex min-w-0 items-center gap-2">
            {estado}
            <BotonPrivado />
            <BotonCargar puntoCarga={puntoCarga} />
          </div>
        </header>
        <main
          id="contenido"
          tabIndex={-1}
          className="flex-1 px-4 pb-[calc(var(--barra-inf)+env(safe-area-inset-bottom)+2rem)] pt-5 outline-none md:px-7 md:pb-16 md:pt-8"
        >
          <PestanasPatrimonio />
          {children}
        </main>
      </div>
      <BarraInferior puntoCarga={puntoCarga} />
    </>
  )
}
