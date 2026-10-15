import type { Metadata } from 'next'
import { modoDemo } from '@/lib/server/sesion'
import type { VistaEvolucion } from '@/lib/vistas/contratos-evolucion'
import { demoEvolucion } from '@/lib/vistas/ejemplo-evolucion'
import { vistaEvolucion } from '@/lib/vistas/evolucion'
import { ErrorVista } from '@/components/error-vista'
import { PantallaEvolucion } from './_componentes/pantalla'
import { hayEleccionEnLaUrl, leerParametros } from './_lib/parametros'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Evolución y PnL' }

export default async function PaginaEvolucion({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const p = leerParametros(sp)
  const demo = modoDemo() ? demoEvolucion(Array.isArray(sp.demo) ? sp.demo[0] : sp.demo) : null
  let v: VistaEvolucion
  try {
    v = await vistaEvolucion(p, demo)
  } catch (e) {
    return (
      <>
        <h1 className="sr-only">Evolución y PnL</h1>
        <ErrorVista error={e} que="tu evolución" />
      </>
    )
  }
  return <PantallaEvolucion v={v} demo={demo} enLaUrl={hayEleccionEnLaUrl(sp)} />
}
