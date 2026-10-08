import { Suspense, type ReactNode } from 'react'
import { Atajos, BotonPrivado, BotonTema, TituloSeccion } from '@/components/shell/barra-superior'
import { ChipCargando, EstadoDatos, PuntoCarga } from '@/components/shell/estado-datos'
import { BarraInferior, BarraLateral } from '@/components/shell/nav'

// El shell de la app (visión §3): barra lateral en desktop (240 px, colapsable
// a 64), barra inferior en el teléfono con Cargar al centro, y arriba el
// indicador de datos, el ojo del modo privado y el tema. Sin max-width.

export const dynamic = 'force-dynamic'

export default function LayoutApp({ children }: { children: ReactNode }) {
  const punto = (
    <Suspense fallback={null}>
      <PuntoCarga />
    </Suspense>
  )
  return (
    <>
      <a
        href="#contenido"
        className="sr-only z-[60] rounded-lg bg-surface px-3 py-2 text-sm font-medium shadow-lg focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Saltar al contenido
      </a>
      <Atajos />
      <BarraLateral puntoCarga={punto} />
      <div className="flex min-h-dvh flex-col pl-[var(--nav-w)]">
        <header className="sticky top-0 z-40 flex h-[var(--barra-sup)] shrink-0 items-center gap-2 border-b border-border bg-bg/85 px-4 backdrop-blur-md md:px-6">
          <TituloSeccion />
          <div className="ml-auto flex items-center gap-1">
            <Suspense fallback={<ChipCargando />}>
              <EstadoDatos />
            </Suspense>
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
      <BarraInferior puntoCarga={punto} />
    </>
  )
}
