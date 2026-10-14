import { Suspense, type ReactNode } from 'react'
import { ChipCargando, EstadoDatos, PuntoCarga } from '@/components/shell/estado-datos'
import { Marco } from '@/components/shell/marco'

// El shell de la app (visión §3), con el estado de los datos y el punto de
// Cargar, que leen la base. El marco en sí está en components/shell/marco.tsx.

export const dynamic = 'force-dynamic'

export default function LayoutApp({ children }: { children: ReactNode }) {
  const punto = (
    <Suspense fallback={null}>
      <PuntoCarga />
    </Suspense>
  )
  return (
    <Marco
      puntoCarga={punto}
      estado={
        <Suspense fallback={<ChipCargando />}>
          <EstadoDatos />
        </Suspense>
      }
    >
      {children}
    </Marco>
  )
}
