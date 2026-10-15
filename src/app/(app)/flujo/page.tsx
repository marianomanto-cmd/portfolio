import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { fechaCorta } from '@/lib/domain/fechas'
import { vistaFlujo } from '@/lib/vistas/flujo'
import type { VistaFlujo } from '@/lib/vistas/contratos-flujo'
import { ErrorVista } from '@/components/error-vista'
import { MontoTrazado } from '@/components/monto'
import { Tarjeta } from '@/components/ui'
import { Cargados } from './_componentes/cargados'
import { Escenarios } from './_componentes/escenarios'
import { PagoVencimiento } from './_componentes/pago-vencimiento'
import { Recurrentes } from './_componentes/recurrentes'
import { FaltanDatos, SeccionCalendario, SeccionMes, SeccionRealContraProyectado } from './_componentes/secciones'

// Flujo y escenarios (plan §6 D): ¿cuánto me sobra por mes para invertir y
// adónde me lleva cada escenario? El mes en curso y el calendario salen de lo
// declarado, sin supuestos; la proyección corre en el navegador sobre la base
// serializada, con los supuestos en la URL (?s=). Nada proyectado se guarda.

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Flujo y escenarios' }

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

function Encabezado({ v }: { v: VistaFlujo }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-text md:text-2xl">Flujo y escenarios</h1>
        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-sm text-muted">
          {v.fecha_datos ? (
            <>
              <span>Desde tu carga del {fechaCorta(v.fecha_datos)} ·</span>
              <span className="inline-flex items-baseline gap-1">
                CCL <MontoTrazado calc={v.ccl} moneda="ARS" titulo="CCL de tu última carga" decimales={2} />
              </span>
              <span className="inline-flex items-baseline gap-1">
                · cripto <MontoTrazado calc={v.cripto} moneda="ARS" titulo="Dólar cripto de tu última carga" decimales={2} />
              </span>
            </>
          ) : (
            <span>Todavía no hay cargas.</span>
          )}
        </p>
      </div>
      <div className="flex w-full gap-2 sm:w-auto">
        <Link
          href="/flujo/cargar?sentido=ingreso"
          className="tocable inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-[15px] font-medium text-on-accent hover:bg-accent-strong sm:flex-none"
        >
          <ArrowDownCircle aria-hidden className="size-5" /> Cargar ingreso
        </Link>
        <Link
          href="/flujo/cargar?sentido=gasto"
          className="tocable inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 text-[15px] font-medium text-text hover:bg-surface-2 sm:flex-none"
        >
          <ArrowUpCircle aria-hidden className="size-5" /> Cargar gasto
        </Link>
      </div>
    </div>
  )
}

export default async function PaginaFlujo({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  let v: VistaFlujo
  try {
    v = await vistaFlujo(uno(sp.demo))
  } catch (e) {
    return (
      <>
        <h1 className="sr-only">Flujo y escenarios</h1>
        <ErrorVista error={e} que="tu flujo" />
      </>
    )
  }

  // "Ajustar supuestos" desde Evolución trae el escenario guardado que se mostraba (?e=): se abre como tal.
  const idAbierto = Number(uno(sp.e))
  const guardado = Number.isInteger(idAbierto) && idAbierto > 0 ? v.escenarios.find((x) => x.id === idAbierto && !x.archivado) : undefined
  const abiertoInicial = guardado ? { id: guardado.id, nombre: guardado.nombre } : null

  const arriba = (
    <>
      {v.mes_actual ? <SeccionMes m={v.mes_actual} pagador={v.pagador_declarado} /> : null}
      {v.calendario.length ? <SeccionCalendario meses={v.calendario} /> : null}
    </>
  )

  return (
    <div className="flex flex-col gap-4">
      <Encabezado v={v} />
      <FaltanDatos items={v.faltan_datos} />

      {v.base ? (
        <Escenarios
          base={v.base}
          inicial={v.supuestos_iniciales}
          sUrl={uno(sp.s) ?? null}
          escenarios={v.escenarios}
          recordados={v.recordados}
          reintegroDeclarado={v.reintegro_declarado}
          pagadorDeclarado={v.pagador_declarado}
          arriba={arriba}
          abiertoInicial={abiertoInicial}
        />
      ) : null}

      {v.cerrados.length ? <SeccionRealContraProyectado meses={v.cerrados} /> : null}

      <Tarjeta className="p-4" aria-labelledby="titulo-cargados">
        <h2 id="titulo-cargados" className="text-base font-semibold text-text">
          Lo que cargaste
        </h2>
        <p className="mb-3 mt-0.5 text-xs text-muted">Los ingresos y gastos que cargaste con «Cargar ingreso» y «Cargar gasto».</p>
        <Cargados filas={v.cargados} />
      </Tarjeta>

      <div id="ingresos-y-gastos" className="scroll-mt-4">
        <Tarjeta className="p-4" aria-labelledby="titulo-recurrentes">
          <h2 id="titulo-recurrentes" className="text-base font-semibold text-text">
            Tus ingresos y gastos declarados
          </h2>
          <p className="mb-3 mt-0.5 text-xs text-muted">Lo que entra y sale todos los meses (o cada tanto), con desde cuándo vale. De acá sale lo «declarado» del mes y de la proyección.</p>
          <Recurrentes filas={v.recurrentes} hoy={v.hoy} />
        </Tarjeta>
      </div>

      {v.sin_cronograma.length ? (
        <Tarjeta className="p-4" aria-labelledby="titulo-pagos">
          <h2 id="titulo-pagos" className="text-base font-semibold text-text">
            Pagos al vencimiento que faltan
          </h2>
          <p className="mb-3 mt-0.5 text-xs text-muted">Sin el pago por VN, lo que cobrás al vencimiento es sin dato y la proyección no puede seguir tus letras.</p>
          <div className="space-y-3">
            {v.sin_cronograma.map((b) => (
              <PagoVencimiento key={b.activo_id} bono={b} ccl={v.base?.ccl ?? null} />
            ))}
          </div>
        </Tarjeta>
      ) : null}
    </div>
  )
}
