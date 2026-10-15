import './impresion.css'

import { ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { numero } from '@/lib/domain/dinero'
import { fechaCorta, fechaLarga } from '@/lib/domain/fechas'
import { modoDemo } from '@/lib/server/sesion'
import { vistaBalance } from '@/lib/vistas/balance'
import type { VistaBalance } from '@/lib/vistas/contratos-balance'
import { ErrorVista } from '@/components/error-vista'
import { Frase } from '@/components/hoy/frase'
import { SinDato, TextoConMontos } from '@/components/monto'
import { Traza } from '@/components/traza'
import { Aviso, Tarjeta } from '@/components/ui'
import { Comparativo } from './_componentes/comparativo'
import { Composicion } from './_componentes/composicion'
import { Controles } from './_componentes/controles'
import { EstadoSituacion } from './_componentes/estado'
import { Evolucion } from './_componentes/evolucion'
import { Indicadores } from './_componentes/indicadores'
import { TarjetaActivo, TarjetaPasivo, Titular } from './_componentes/tarjetas'
import { detalleFrase, partesMostradas } from './_lib/frase'
import { rutaBalance, unParametro } from './_lib/rutas'

// Balance (plan de la entrega 4, §3): el estado de situación patrimonial a
// cualquier fecha de carga, en pesos y en dólares, con cada cifra trazada.
// Server Component: lee la vista ya armada (src/lib/vistas/balance.ts) y la
// muestra; los controles, la composición y el gráfico son de cliente.

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Balance' }

const fechaConAnio = (f: string) => `${fechaCorta(f)}/${f.slice(0, 4)}`

export default async function PaginaBalance({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const demo = modoDemo() ? unParametro(sp.demo) : null
  let v: VistaBalance
  try {
    v = await vistaBalance({ fecha: unParametro(sp.fecha), agrupar: unParametro(sp.agrupar), comparar: unParametro(sp.comparar), demo })
  } catch (e) {
    return (
      <>
        <h1 className="sr-only">Balance</h1>
        <ErrorVista error={e} que="tu balance" />
      </>
    )
  }

  if (v.estado === 'sin_cargas' || !v.fecha) return <SinCargas />

  const firme = v.neto.lineas.find((l) => l.clave === 'sin_financiados')?.nombre ?? null

  return (
    <div data-imprimible="balance" className="flex flex-col gap-3 md:gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Balance al {fechaConAnio(v.fecha)}</h1>
          <p className="mt-0.5 text-[13px] leading-5 text-muted">
            Estado de situación patrimonial · CCL{' '}
            <Traza calc={v.ccl} titulo="CCL del balance">
              {v.ccl.valor === null ? <SinDato motivo={v.ccl.motivo} /> : <span className="num">{numero(v.ccl.valor, 2)}</span>}
            </Traza>{' '}
            {v.ccl_fuente}
            <span className="print:hidden"> · tocá una cifra para ver de dónde sale</span>
          </p>
        </div>
        <Controles
          fechas={v.fechas}
          fecha={v.fecha}
          agrupar={v.agrupar}
          comparar={v.comparativo && v.comparativo.fecha !== v.comparativo.por_defecto ? v.comparativo.fecha : null}
          demo={demo}
        />
      </div>

      {!v.ultima ? (
        <Aviso className="print:hidden">
          Es el balance al {fechaCorta(v.fecha)}, con los datos que tenías ese día.{' '}
          <Link href={rutaBalance({ agrupar: v.agrupar, demo })} className="tocable inline-flex items-center font-medium text-accent hover:underline">
            Ver el último
          </Link>
        </Aviso>
      ) : null}

      <Tarjeta className="p-4 md:p-5" aria-label="El balance en una frase">
        <Frase partes={partesMostradas(v.frase)} detalle={detalleFrase(v.frase)} />
      </Tarjeta>

      {/* Al imprimir, las tarjetas no van: lo mismo está en el estado de situación, que es lo que lee el contador. */}
      <div className="grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3 print:hidden">
        <div className="md:col-span-2 xl:col-span-1">
          <Titular v={v} />
        </div>
        <TarjetaActivo v={v} />
        <TarjetaPasivo v={v} />
      </div>

      <EstadoSituacion v={v} />

      <Indicadores xs={v.indicadores} />

      <Comparativo c={v.comparativo} fecha={v.fecha} demo={demo} ruta={{ fecha: v.ultima ? null : v.fecha, agrupar: v.agrupar }} />

      <Composicion comp={v.composicion} hayBienes={v.activo.bienes.length > 0} />
      <Evolucion serie={v.serie} rotuloFirme={firme} />

      <PieImpresion v={v} />
    </div>
  )
}

function SinCargas() {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Balance</h1>
      <Tarjeta className="p-4 md:p-5">
        <p className="text-[15px] leading-6">Todavía no hay cargas: el balance se arma con tu primera carga y tus bienes.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/carga" className="tocable inline-flex min-h-10 items-center gap-1 rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-strong">
            Hacer la primera carga <ArrowRight aria-hidden className="size-4" />
          </Link>
          <Link href="/datos/bienes" className="tocable inline-flex min-h-10 items-center gap-1 rounded-lg border border-border px-4 text-sm font-medium hover:border-border-strong">
            Cargar tus bienes en Datos
          </Link>
        </div>
      </Tarjeta>
    </div>
  )
}

/** Solo al imprimir: de dónde sale cada cosa, para el contador. */
function PieImpresion({ v }: { v: VistaBalance }) {
  const deuda = v.pasivo.filas.find((f) => f.bien)
  return (
    <div className="hidden text-[10px] leading-4 text-muted print:block">
      <p>
        Estado de situación patrimonial al {v.fecha ? fechaLarga(v.fecha) : '—'}. Montos en pesos y en dólares, pasados al CCL{' '}
        {v.ccl.valor === null ? 'sin dato' : numero(v.ccl.valor, 2)} ({v.ccl_fuente}). Hecho con tu app el {fechaLarga(v.hoy)}.
      </p>
      {deuda ? (
        <p>
          {deuda.nombre}: <TextoConMontos texto={`${deuda.detalle}${deuda.fuente ? ` (${deuda.fuente})` : ''}`} />. Lo que falta pagar según contrato no es la deuda: incluye intereses, IVA y seguro, y no se resta.
        </p>
      ) : null}
      <p>
        Etiquetas: «estimado», un cálculo y no un dato del acreedor; «parcial», falta una parte; «viejo», un dato de más de 2 días hábiles; «provisoria», la deuda estimada que aprobaste. Un bien
        financiado y su deuda entran juntos; nunca se suma el bien sin su deuda.
      </p>
    </div>
  )
}
