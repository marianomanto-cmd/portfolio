import type { Metadata } from 'next'
import Link from 'next/link'
import { numero } from '@/lib/domain/dinero'
import { vistaFlujo } from '@/lib/vistas/flujo'
import type { VistaFlujo } from '@/lib/vistas/contratos-flujo'
import { ErrorVista } from '@/components/error-vista'
import { Tarjeta } from '@/components/ui'
import { CargarFlujo } from '../_componentes/cargar-flujo'
import { Cargados } from '../_componentes/cargados'

// Cargar ingreso / Cargar gasto (pedido del dueño del 14/10; plan §6 D.9): su
// propia página, para que Hoy, el menú de Cargar y la barra de abajo la
// enlacen (?sentido=ingreso|gasto). Debajo, lo último que cargaste, con
// Deshacer y Anular.

export const dynamic = 'force-dynamic'

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  return { title: uno((await searchParams).sentido) === 'gasto' ? 'Cargar gasto' : 'Cargar ingreso' }
}

export default async function PaginaCargarFlujo({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const sentido = uno(sp.sentido) === 'gasto' ? 'gasto' : 'ingreso'
  const titulo = sentido === 'ingreso' ? 'Cargar ingreso' : 'Cargar gasto'
  let v: VistaFlujo
  try {
    v = await vistaFlujo(uno(sp.demo))
  } catch (e) {
    return (
      <>
        <h1 className="sr-only">{titulo}</h1>
        <ErrorVista error={e} que="lo que cargaste" />
      </>
    )
  }
  const demo = uno(sp.demo)
  const conDemo = (s: string) => `/flujo/cargar?sentido=${s}${demo ? `&demo=${encodeURIComponent(demo)}` : ''}`
  const cripto = v.cripto.valor === null ? null : numero(v.cripto.valor, 2)

  return (
    // Ancho completo, sin max-width en el contenedor (spec): desde 1024 px, el formulario y lo cargado lado a lado.
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-text md:text-2xl">{titulo}</h1>
          <p className="mt-0.5 text-sm text-muted">
            {sentido === 'ingreso' ? 'Cuando te entra plata, cargala acá: el mes se vuelve real y tu proyección arranca de ahí.' : 'Un gasto que no estaba declarado, o el gasto fijo del mes con su monto real.'}
          </p>
        </div>
        <nav aria-label="Ingreso o gasto" className="inline-grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface-2 p-1">
          {(['ingreso', 'gasto'] as const).map((x) => (
            <Link
              key={x}
              href={conDemo(x)}
              aria-current={sentido === x ? 'page' : undefined}
              className={`tocable inline-flex min-h-9 items-center justify-center rounded-md px-3 text-sm font-medium ${sentido === x ? 'bg-surface text-text shadow-[var(--shadow)]' : 'text-muted hover:text-text'}`}
            >
              {x === 'ingreso' ? 'Ingreso' : 'Gasto'}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-12 lg:items-start">
        <Tarjeta className="min-w-0 p-4 lg:col-span-7">
          <CargarFlujo key={sentido} sentido={sentido} hoy={v.hoy} cuentas={v.cuentas} criptoHoy={cripto} movimientos={v.movimientos_datos} />
        </Tarjeta>

        <Tarjeta className="min-w-0 p-4 lg:col-span-5" aria-labelledby="titulo-ultimos">
          <h2 id="titulo-ultimos" className="text-base font-semibold text-text">
            Lo que cargaste
          </h2>
          <p className="mb-3 mt-0.5 text-xs text-muted">Lo último primero. Deshacer y Anular, con las reglas de Registro.</p>
          <Cargados filas={v.cargados} limite={8} />
          <p className="mt-3">
            <Link href={demo ? `/flujo?demo=${encodeURIComponent(demo)}#real-contra-proyectado` : '/flujo#real-contra-proyectado'} className="tocable inline-flex min-h-10 items-center text-sm font-medium text-accent hover:underline">
              Ver tu flujo: proyectado contra real
            </Link>
          </p>
        </Tarjeta>
      </div>
    </div>
  )
}
