import { ArrowRight, Database, Upload } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'
import { fechaCorta, fechaLarga } from '@/lib/domain/fechas'
import { modoDemo } from '@/lib/server/sesion'
import { porGravedad } from '@/lib/vistas/armar'
import type { Pendiente, VistaHoy } from '@/lib/vistas/contratos'
import { contextoHoy } from '@/lib/vistas/contexto-hoy'
import { ejemploHoyVariante, varianteDemo } from '@/lib/vistas/ejemplo'
import { cargaPendiente } from '@/components/calculos'
import { ErrorVista } from '@/components/error-vista'
import { DetalleHoy } from '@/components/hoy/detalle'
import { TarjetaExcedente } from '@/components/hoy/excedente'
import { RenglonExposicion, TarjetaExposicion } from '@/components/hoy/exposicion'
import { lecturaHoy } from '@/components/hoy/lectura-hoy'
import { fechaEnPalabras } from '@/components/hoy/palabras'
import { PatrimonioCompacto, PatrimonioNeto } from '@/components/hoy/patrimonio'
import { Atencion, TarjetaProximos } from '@/components/hoy/proximos'
import { QueTenes } from '@/components/hoy/que-tenes'
import { Mostrar } from '@/components/hoy/redondeo-frase'
import { TarjetaSerie } from '@/components/hoy/serie'
import { TarjetaVariacion } from '@/components/hoy/variacion'
import { Encabezado } from '@/components/pantalla/encabezado'
import { hoyDelPedido } from '@/components/shell/datos'
import { Traza } from '@/components/traza'
import { Aviso, Rotulo, Tarjeta } from '@/components/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Hoy' }

// Hoy (D-157; handoff "Portfolio UI", capturas 01 y 02): la pregunta con la
// fecha, la lectura del día y el patrimonio neto; la variación del día y de
// dónde vino, la exposición neta al peso y el excedente del mes; el
// patrimonio neto de los últimos 12 meses y lo que pasa en los próximos 30
// días; qué tenés y qué debés. Debajo, el detalle: la frase del día completa,
// quién movió lo invertible y el cuadre. En el teléfono (el handoff no lo
// diseña) va primero lo que tiene que entrar arriba del pliegue (visión §4.1):
// la lectura, el patrimonio, la exposición, Atención y la carga que falta.

export default async function PaginaHoy({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const variante = modoDemo() ? varianteDemo(sp.demo) : null
  let v: VistaHoy
  try {
    v = variante ? ejemploHoyVariante(variante) : await hoyDelPedido()
  } catch (e) {
    return (
      <>
        <h1 className="sr-only">Hoy</h1>
        <ErrorVista error={e} que="tus datos de hoy" />
      </>
    )
  }
  if (!v.hay_datos) return <DiaCero v={v} />

  // Después del cierre de BYMA (el ejemplo del modo demo no tiene hora: vale siempre).
  const pendienteCarga = modoDemo() ? v.es_habil_hoy && !v.cargo_hoy : cargaPendiente(v, new Date())
  const ctx = await contextoHoy({ variante, cargaPendiente: pendienteCarga })
  const atencion = porGravedad([...v.atencion, ...ctx.atencion])
  // Lo que ya tiene fecha en "Próximos 30 días" no se repite en Atención (en la compu van en la misma tarjeta).
  const conFecha = new Set(ctx.proximos.map((e) => e.id))
  const sinFecha = atencion.filter((p) => !conFecha.has(p.id))
  const m = new Mostrar(v.frase, [v.financiero, v.total])

  return (
    <div className="flex flex-col gap-3 md:gap-5">
      {/* Fila 1: la pregunta y la lectura; el patrimonio neto. */}
      <section aria-label="Cómo estás hoy" className="grid gap-3 md:gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)] lg:items-stretch">
        <div className="flex min-w-0 flex-col justify-center lg:py-2">
          <Encabezado
            pregunta={`${fechaEnPalabras(v.hoy)} · ¿Cómo estoy hoy?`}
            lectura={lecturaHoy(v, m)}
            ayuda="Tocá cualquier cifra para ver de dónde sale."
            tam="grande"
            className="max-md:[&_h1]:text-[26px] max-md:[&_p:last-child]:hidden"
          />
        </div>
        <div className="min-w-0 max-md:hidden">
          <PatrimonioNeto total={v.total} financiero={v.financiero} balance={v.balance} />
        </div>
        <div className="min-w-0 md:hidden">
          <PatrimonioCompacto total={v.total} financiero={v.financiero} />
        </div>
      </section>

      {/* En el teléfono, arriba del pliegue: la exposición, Atención y la carga que falta (visión §4.1). */}
      <div className="flex flex-col gap-2 md:hidden">
        <RenglonExposicion e={v.exposicion} />
        <AtencionRenglon pendientes={atencion} />
        {pendienteCarga ? <CargaPendiente /> : null}
      </div>

      <Avisos v={v} />

      {/* Fila 2: de dónde vino la variación, la exposición neta al peso y el excedente del mes. */}
      <section aria-label="El día y el mes" className="grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(260px,1fr))] md:gap-5">
        <TarjetaVariacion frase={v.frase} ccl={v.ccl_periodo} m={m} />
        <div className="min-w-0 max-md:hidden">
          <TarjetaExposicion e={v.exposicion} />
        </div>
        <TarjetaExcedente x={ctx.excedente} />
      </section>

      {/* Fila 3: el patrimonio neto en el tiempo y lo que viene. */}
      <section aria-label="Lo que pasó y lo que viene" className="grid gap-3 md:gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <TarjetaSerie s={ctx.serie} />
        <TarjetaProximos eventos={ctx.proximos} pendientes={sinFecha} />
      </section>

      {/* Fila 4: qué tenés y qué debés. */}
      {v.balance ? <QueTenes balance={v.balance} total={v.total} /> : null}

      {/* El detalle: la frase completa, quién movió y el cuadre. */}
      <DetalleHoy v={v} m={m} />
    </div>
  )
}

/** Un día de datos sin CCL y el recordatorio de diciembre (D-109, D-76). */
function Avisos({ v }: { v: VistaHoy }) {
  const sinCcl = v.fecha_ccl && v.fecha_datos && v.fecha_ccl !== v.fecha_datos
  if (!sinCcl && !v.aviso_fin_de_anio) return null
  return (
    <div className="flex flex-col gap-2">
      {sinCcl ? (
        <Aviso>
          El {fechaCorta(v.fecha_datos!)} no tiene CCL: los dólares usan el{' '}
          <Traza calc={v.ccl} titulo="CCL que se usa">
            <span className="num">CCL del {fechaCorta(v.fecha_ccl!)}</span>
          </Traza>{' '}
          y el cambio del día queda sin atribuir.
        </Aviso>
      ) : null}
      {v.aviso_fin_de_anio ? <Aviso>{v.aviso_fin_de_anio}</Aviso> : null}
    </div>
  )
}

/** En el teléfono, Atención es un solo renglón que se despliega (visión §4.1). */
function AtencionRenglon({ pendientes }: { pendientes: Pendiente[] }) {
  if (!pendientes.length) return null
  return (
    <Tarjeta as="div" className="px-3">
      <Atencion pendientes={pendientes} className="border-t-0" />
    </Tarjeta>
  )
}

/** "Todavía no cargaste hoy": un día hábil sin carga, después del cierre de BYMA (D-127). */
function CargaPendiente() {
  return (
    <Link
      href="/carga"
      className="flex min-h-12 items-center justify-between gap-3 rounded-tarjeta border border-border-accent bg-accent-soft px-4 text-[15px] font-medium text-accent transition-colors hover:border-accent"
    >
      <span className="flex items-center gap-2">
        <Upload aria-hidden className="size-5" />
        Todavía no cargaste hoy
      </span>
      <span className="flex items-center gap-1">
        Cargar <ArrowRight aria-hidden className="size-4" />
      </span>
    </Link>
  )
}

// ───────────── Día cero ─────────────

function DiaCero({ v }: { v: VistaHoy }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="sr-only">Hoy · Día cero</h1>
      <Tarjeta className="p-5 md:p-8">
        <Rotulo as="p">Día cero · {fechaLarga(v.hoy)}</Rotulo>
        <p className="lectura mt-3 max-w-[30ch] text-[28px] md:text-[36px]">Todavía no hay datos: arrancá por acá.</p>
        {/* El orden del manual §5 (D-70): las cuentas ya vienen dadas de alta. */}
        <p className="mt-3 max-w-[70ch] text-[15px] leading-6 text-muted">
          Primero, en Datos: el Leasing, con el último capital pendiente, y los Bienes (la casa y la camioneta), con su valuación. El catálogo es opcional: si
          no das de alta tus activos, la bandeja te los pide. Después, tu primera carga: CCL, cripto, el Excel de IEB y las capturas de Galicia y Mercado Pago.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/datos/leasing"
            className="boton-primario inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 font-mono text-[12px] font-semibold uppercase tracking-[0.08em] text-on-accent shadow-[var(--glow-accent)]"
          >
            <Database aria-hidden className="size-4" /> Empezar por Datos › Leasing
          </Link>
          <Link
            href="/carga"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border-strong px-5 font-mono text-[12px] font-semibold uppercase tracking-[0.08em] text-text transition-colors hover:border-text"
          >
            <Upload aria-hidden className="size-4" /> Hacer la primera carga
          </Link>
        </div>
      </Tarjeta>
      <p className="px-1 text-sm text-muted">Ningún número aparece en cero mientras falte: dice “sin dato” y qué hace falta.</p>
    </div>
  )
}
