import type { Metadata } from 'next'
import Link from 'next/link'
import { numero } from '@/lib/domain/dinero'
import { vistaFlujo } from '@/lib/vistas/flujo'
import type { VistaFlujo } from '@/lib/vistas/contratos-flujo'
import { ErrorVista } from '@/components/error-vista'
import { Encabezado } from '@/components/pantalla/encabezado'
import { enfasis, texto } from '@/components/pantalla/lectura'
import { Segmentado } from '@/components/pantalla/segmentado'
import { Rotulo, Tarjeta } from '@/components/ui'
import { CargarFlujo } from '../_componentes/cargar-flujo'
import { Cargados } from '../_componentes/cargados'

// Cargar ingreso / Cargar gasto (pedido del dueño del 14/10; plan §6 D.9): su
// propia página, para que Hoy, el menú de Cargar y el mes en curso de Flujo la
// enlacen (?sentido=ingreso|gasto). Con la anatomía de toda pantalla (D-157,
// D-166): la pregunta, la lectura (el h1, "Cargar ingreso") y, a la derecha,
// Ingreso · Gasto en la pastilla. Debajo, lo último que cargaste, con
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
    <div className="flex w-full min-w-0 flex-col gap-5">
      <Encabezado
        pregunta={sentido === 'ingreso' ? 'Futuro · ¿Qué te entró?' : 'Futuro · ¿Qué pagaste?'}
        lectura={[texto('Cargar '), enfasis(sentido)]}
        ayuda={sentido === 'ingreso' ? 'Cuando te entra plata, cargala acá: el mes se vuelve real y tu proyección arranca de ahí.' : 'Un gasto que no estaba declarado, o el gasto fijo del mes con su monto real.'}
        acciones={
          <Segmentado
            etiqueta="Ingreso o gasto"
            opciones={(['ingreso', 'gasto'] as const).map((x) => ({ href: conDemo(x), nombre: x === 'ingreso' ? 'Ingreso' : 'Gasto', actual: sentido === x }))}
          />
        }
      />

      <div className="grid min-w-0 gap-5 lg:grid-cols-12 lg:items-start">
        <Tarjeta className="min-w-0 p-5 lg:col-span-7">
          <CargarFlujo key={sentido} sentido={sentido} hoy={v.hoy} cuentas={v.cuentas} criptoHoy={cripto} movimientos={v.movimientos_datos} />
        </Tarjeta>

        <Tarjeta className="flex min-w-0 flex-col gap-3 p-5 lg:col-span-5" aria-labelledby="titulo-ultimos">
          <Rotulo id="titulo-ultimos">Lo que cargaste</Rotulo>
          <p className="text-[13px] text-muted">Lo último primero. Deshacer y Anular, con las reglas de Registro.</p>
          <Cargados filas={v.cargados} limite={8} />
          <p>
            <Link
              href={demo ? `/flujo?demo=${encodeURIComponent(demo)}#real-contra-proyectado` : '/flujo#real-contra-proyectado'}
              className="tocable inline-flex min-h-10 items-center gap-1 text-[13px] text-muted transition-colors hover:text-text"
            >
              Ver tu flujo: proyectado contra real <span aria-hidden>→</span>
            </Link>
          </p>
        </Tarjeta>
      </div>
    </div>
  )
}
