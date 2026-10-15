import type { Metadata } from 'next'
import { modoDemo } from '@/lib/server/sesion'
import { vistaCartera } from '@/lib/vistas'
import { ejemploCarteraVariante, varianteDemo } from '@/lib/vistas/ejemplo'
import type { VistaCartera } from '@/lib/vistas/contratos'
import { TablaCartera } from '@/components/cartera/tabla'
import { ErrorVista } from '@/components/error-vista'

export const dynamic = 'force-dynamic'
// En la pantalla se llama Posiciones (D-156); la ruta sigue siendo /cartera.
export const metadata: Metadata = { title: 'Posiciones' }

export default async function PaginaCartera({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  let v: VistaCartera
  try {
    const variante = modoDemo() ? varianteDemo(sp.demo) : null
    v = variante ? ejemploCarteraVariante(variante) : await vistaCartera()
  } catch (e) {
    return (
      <>
        <h1 className="sr-only">Posiciones</h1>
        <ErrorVista error={e} que="tus posiciones" />
      </>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <h1 className="sr-only">Posiciones</h1>
      {v.filas.length === 0 ? (
        <p className="rounded-tarjeta border border-border bg-surface p-5 text-sm text-muted">
          Todavía no hay posiciones: aparecen con tu primera carga.
        </p>
      ) : (
        <TablaCartera v={v} />
      )}
    </div>
  )
}
