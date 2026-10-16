import './impresion.css'

import type { Metadata } from 'next'
import { modoDemo } from '@/lib/server/sesion'
import { vistaExposicion } from '@/lib/vistas'
import { vistaBalance } from '@/lib/vistas/balance'
import type { VistaBalance } from '@/lib/vistas/contratos-balance'
import type { VistaExposicionPantalla } from '@/lib/vistas/contratos-exposicion'
import { ErrorVista } from '@/components/error-vista'
import { Encabezado } from '@/components/pantalla/encabezado'
import { Apertura, Concentracion } from './_componentes/apertura'
import { SeccionBalance } from './_componentes/balance/seccion'
import { DetalleExposicion } from './_componentes/detalle'
import { LargoCorto } from './_componentes/largo-corto'
import { NetaEnElTiempo } from './_componentes/neta'
import { SelectorVista } from './_componentes/selector-vista'
import { lecturaExposicion } from './_lib/lectura'
import { notaNeta, rotuloNeta, ultimos12Meses } from './_lib/neta'
import { delBalance, unParametro } from './_lib/rutas'

// Exposición (rediseño 15/10, D-156 y D-158; handoff, capturas 05 y 06): la
// pregunta y la lectura, el gráfico de largo y corto en pesos de hoy, el neto
// en el tiempo, la apertura y la concentración; abajo, el detalle: lo que la
// pantalla mostraba antes y el balance entero (que antes era /patrimonio). Server
// Component: lee las vistas ya armadas; los gráficos y las grillas son de cliente.

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Exposición' }

type Modo = 'financiero' | 'total'

export default async function PaginaExposicion({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const modo: Modo = unParametro(sp.vista) === 'total' ? 'total' : 'financiero'
  const demo = modoDemo() ? unParametro(sp.demo) : null
  let v: VistaExposicionPantalla
  let b: VistaBalance
  try {
    ;[v, b] = await Promise.all([
      vistaExposicion(modo, demo),
      vistaBalance({ fecha: unParametro(sp.fecha), agrupar: unParametro(sp.agrupar), comparar: unParametro(sp.comparar), demo }),
    ])
  } catch (e) {
    return (
      <>
        <h1 className="sr-only">Exposición</h1>
        <ErrorVista error={e} que="tu exposición y tu balance" />
      </>
    )
  }
  const { puntos, completa } = ultimos12Meses(v.serie_neto)
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="print:hidden">
        <Encabezado
          pregunta="Patrimonio · ¿Cuánto estoy jugado al peso?"
          lectura={lecturaExposicion(v)}
          acciones={<SelectorVista modo={modo} balance={delBalance(sp)} />}
        />
      </div>

      <div className="print:hidden">
        <LargoCorto v={v} />
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] print:hidden">
        <NetaEnElTiempo puntos={puntos} rotulo={rotuloNeta(puntos, completa)} nota={notaNeta(puntos)} />
        <div className="flex min-w-0 flex-col gap-5">
          <Apertura v={v} />
          <Concentracion v={v} />
        </div>
      </div>

      <DetalleExposicion v={v} />

      <SeccionBalance v={b} demo={demo} vista={modo === 'total' ? 'total' : null} />
    </div>
  )
}
