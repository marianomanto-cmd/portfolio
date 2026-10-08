import { ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import type { CalcVista } from '@/lib/domain/calc'
import { numero } from '@/lib/domain/dinero'
import { fechaCorta } from '@/lib/domain/fechas'
import { vistaExposicion } from '@/lib/vistas'
import type { Segmento, VistaExposicion } from '@/lib/vistas/contratos'
import { porSubaDeCcl } from '@/components/calculos'
import { ErrorVista } from '@/components/error-vista'
import { Monto, MontoTrazado, Porcentaje, TextoConMontos } from '@/components/monto'
import { Traza } from '@/components/traza'
import { Aviso, ParMonto, Rotulo, Tarjeta } from '@/components/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Exposición' }

type Modo = 'financiero' | 'total'

const OPCIONES: { modo: Modo; nombre: string; netea: string }[] = [
  { modo: 'financiero', nombre: 'Financiero', netea: 'pesos financieros − deuda del leasing' },
  { modo: 'total', nombre: 'Total', netea: 'lo anterior + cada bien en su moneda de riesgo' },
]

export default async function PaginaExposicion({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const modo: Modo = sp.vista === 'total' ? 'total' : 'financiero'
  let v: VistaExposicion
  try {
    v = await vistaExposicion(modo)
  } catch (e) {
    return (
      <>
        <h1 className="sr-only">Exposición</h1>
        <ErrorVista error={e} que="tu exposición" />
      </>
    )
  }
  const r = v.resumen
  const pesosUsd = r.pesos_financieros.usd
  const deudaUsd = r.deuda_pesos.usd
  const sensPesos = porSubaDeCcl(v.activos_en_dolares.ars, '1', 'ARS', 'Cuánto suman en pesos tus activos en dólares si el CCL sube 1%. Es una sensibilidad, no un pronóstico.')

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <h1 className="sr-only">Exposición · {modo === 'total' ? 'Total' : 'Financiero'}</h1>

      <nav aria-label="Qué netea la vista" className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface-2 p-1 md:inline-grid md:w-auto md:self-start">
        {OPCIONES.map((o) => {
          const actual = o.modo === modo
          return (
            <Link
              key={o.modo}
              href={o.modo === 'financiero' ? '/exposicion' : '/exposicion?vista=total'}
              aria-current={actual ? 'page' : undefined}
              className={`flex min-h-11 flex-col justify-center rounded-lg px-3 py-1.5 text-left md:min-w-64 ${
                actual ? 'bg-surface shadow-[var(--shadow)]' : 'text-muted hover:text-text'
              }`}
            >
              <span className="text-sm font-semibold">{o.nombre}</span>
              <span className="text-[12px] leading-4 text-muted">{o.netea}</span>
            </Link>
          )
        })}
      </nav>

      <Tarjeta className="p-4 md:p-5" aria-label="Tu exposición al peso">
        <FraseExposicion v={v} pesosUsd={pesosUsd} sensPesos={sensPesos} />
        {v.fecha_datos ? (
          <p className="mt-2 text-[13px] text-muted">
            Al cierre del {fechaCorta(v.fecha_datos)} · CCL{' '}
            <Traza calc={v.ccl} titulo="CCL de la foto">
              <span className="num">{v.ccl.valor === null ? 'sin dato' : numero(v.ccl.valor, 2)}</span>
            </Traza>
            {v.fecha_ccl && v.fecha_ccl !== v.fecha_datos ? ` del ${fechaCorta(v.fecha_ccl)} (ese día no cargaste CCL)` : ''} · tomador del leasing: sin confirmar
          </p>
        ) : null}
      </Tarjeta>

      <div className="grid gap-3 md:gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] min-[112.5rem]:grid-cols-3">
        <Tarjeta className="p-4 md:p-5" aria-labelledby="largo-corto">
          <Rotulo as="h2" className="mb-3">
            <span id="largo-corto">Largo, corto y neto en pesos</span>
          </Rotulo>
          <LargoCorto v={v} pesosUsd={pesosUsd} deudaUsd={deudaUsd} />
        </Tarjeta>

        <Tarjeta className="p-4 md:p-5" aria-labelledby="composicion">
          <Rotulo as="h2" className="mb-3">
            <span id="composicion">Composición {modo === 'total' ? 'del total (sin restar deudas)' : 'del financiero'}</span>
          </Rotulo>
          {v.fecha_datos ? (
            <div className="flex flex-col gap-5">
              <Barra titulo="Por clase" segmentos={v.por_clase} />
              <Barra titulo="Por moneda de riesgo" segmentos={v.por_moneda} />
              <Barra titulo="Por geografía" segmentos={v.por_geografia} nota="La liquidez cuenta en la geografía de su custodio." />
            </div>
          ) : (
            // Sin ninguna carga no hay composición: se dice, en vez de tres barras vacías.
            <p className="text-sm text-muted">
              <span className="italic">sin dato</span> · aparece con tu primera carga.
            </p>
          )}
        </Tarjeta>

        <Tarjeta className="p-4 md:p-5" aria-labelledby="concentracion">
          <Rotulo as="h2" className="mb-3">
            <span id="concentracion">Concentración</span>
          </Rotulo>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">Top 1{v.concentracion.top1_nombre ? ` · ${v.concentracion.top1_nombre}` : ''}</dt>
            <dd className="text-right">
              <Porcentaje calc={v.concentracion.top1} titulo="Concentración: tu posición más grande" signo={false} />
            </dd>
            <dt className="text-muted">Top 3</dt>
            <dd className="text-right">
              <Porcentaje calc={v.concentracion.top3} titulo="Concentración: tus tres posiciones más grandes" signo={false} />
            </dd>
            <dt className="text-muted">Neto en pesos sobre tus activos</dt>
            <dd className="text-right">
              <Porcentaje calc={v.neto_pct} titulo="Exposición neta al peso como parte de tus activos" />
            </dd>
          </dl>
          <p className="mt-3 text-[13px] text-muted">Sin umbral: la app no juzga la concentración hasta que cargues el tuyo.</p>
        </Tarjeta>
      </div>
    </div>
  )
}

function FraseExposicion({ v, pesosUsd, sensPesos }: { v: VistaExposicion; pesosUsd: CalcVista; sensPesos: CalcVista }) {
  const r = v.resumen
  if (r.neto_ars.valor === null) {
    // El "sin dato" lleva a lo que lo resuelve (visión §4.0), según la parte que falta.
    const accion = !v.fecha_datos
      ? { href: '/carga', etiqueta: 'Hacer la primera carga' }
      : r.deuda_pesos.ars.valor === null
        ? { href: '/datos/leasing', etiqueta: 'Cargar el capital pendiente en Datos › Leasing' }
        : null
    return (
      <div className="space-y-1">
        <p className="text-[15px] leading-7 md:text-base">
          <span className="font-semibold">{v.vista === 'total' ? 'Total' : 'Neto'}: </span>
          <MontoTrazado calc={r.neto_ars} moneda="ARS" titulo="Exposición neta al peso" />
          {r.neto_ars.motivo ? (
            <span className="text-muted">
              {' · '}
              <TextoConMontos texto={r.neto_ars.motivo} />
            </span>
          ) : null}
        </p>
        {accion ? (
          <Link href={accion.href} className="tocable inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
            {accion.etiqueta} <ArrowRight aria-hidden className="size-4" />
          </Link>
        ) : null}
      </div>
    )
  }
  const largo = !r.neto_ars.valor.startsWith('-')
  const sens = r.sensibilidad_usd_1pct.valor
  return (
    <p className="text-[15px] leading-8 md:text-base">
      Estás <span className="font-semibold">{largo ? 'largo' : 'corto'} en pesos</span> por{' '}
      <MontoTrazado calc={r.neto_ars} moneda="ARS" titulo="Pesos financieros − deuda del leasing" className="font-semibold" />{' '}
      <MontoTrazado calc={r.neto_usd} moneda="USD" titulo="El neto en dólares" decimales={0} />: tus pesos financieros (
      <MontoTrazado calc={r.pesos_financieros.ars} moneda="ARS" titulo="Pesos financieros" compacta />, <MontoTrazado calc={pesosUsd} moneda="USD" titulo="Pesos financieros en dólares" decimales={0} />){' '}
      {largo ? 'superan' : 'no llegan a'} lo que debés del leasing (<MontoTrazado calc={r.deuda_pesos.ars} moneda="ARS" titulo="Deuda del leasing" compacta />).{' '}
      <span className="font-semibold">Por cada +1% de CCL:</span> en dólares, ese neto {sens !== null && sens.startsWith('-') ? 'pierde' : 'gana'}{' '}
      <Traza calc={r.sensibilidad_usd_1pct} titulo="Si el CCL sube 1%: el neto en dólares" moneda="USD">
        <Monto valor={sens === null ? null : sens.replace(/^-/, '')} moneda="USD" decimales={0} />
      </Traza>
      ; en pesos, tus activos en dólares suman{' '}
      <MontoTrazado calc={sensPesos} moneda="ARS" titulo="Si el CCL sube 1%: tus activos en dólares, en pesos" />.
    </p>
  )
}

function LargoCorto({ v, pesosUsd, deudaUsd }: { v: VistaExposicion; pesosUsd: CalcVista; deudaUsd: CalcVista }) {
  const r = v.resumen
  const pesos = r.pesos_financieros.ars.valor
  const deuda = r.deuda_pesos.ars.valor
  // Solo para el largo de las barras (no es una cifra que se muestre).
  const max = Math.max(Math.abs(Number(pesos ?? 0)), Math.abs(Number(deuda ?? 0)), 1)
  const ancho = (x: string | null) => `${Math.max(2, Math.round((Math.abs(Number(x ?? 0)) / max) * 100))}%`
  const fila = (nombre: string, detalle: string, ars: CalcVista, usd: CalcVista, barra: string | null, signo: '' | '−') => (
    <div className="py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-sm">
          {nombre} <span className="text-[13px] text-muted">· {detalle}</span>
        </span>
        <span className="flex flex-wrap items-baseline gap-x-2">
          {signo ? <span className="num text-muted">{signo}</span> : null}
          <MontoTrazado calc={ars} moneda="ARS" titulo={nombre} />
          <MontoTrazado calc={usd} moneda="USD" titulo={`${nombre} · en dólares`} decimales={0} />
        </span>
      </div>
      {barra !== null ? (
        <div aria-hidden className="mt-1.5 h-2 rounded-full bg-surface-2">
          <div className="h-2 rounded-full bg-muted/60" style={{ width: ancho(barra) }} />
        </div>
      ) : null}
    </div>
  )
  return (
    <div className="divide-y divide-border">
      {fila('Tus pesos financieros', 'largo', r.pesos_financieros.ars, pesosUsd, pesos, '')}
      {fila('Capital pendiente del leasing', 'corto', r.deuda_pesos.ars, deudaUsd, deuda, '−')}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2.5">
        <span className="text-sm font-semibold">Neto {v.vista === 'total' ? 'total' : '(pesos financieros − deuda del leasing)'}</span>
        <span className="flex flex-wrap items-baseline gap-x-2 font-semibold">
          <MontoTrazado calc={r.neto_ars} moneda="ARS" titulo="Neto en pesos" signo />
          <MontoTrazado calc={r.neto_usd} moneda="USD" titulo="Neto en dólares" signo decimales={0} />
        </span>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 pt-2.5">
        <span className="text-sm">
          Tus activos en dólares <span className="text-[13px] text-muted">· CEDEARs y dólares, aunque coticen en pesos</span>
        </span>
        <ParMonto par={v.activos_en_dolares} titulo="Activos que arriesgan dólares" decimalesUsd={0} />
      </div>
      {v.vista === 'total' && v.sin_moneda_de_riesgo.length > 0 ? (
        <Aviso className="mt-3">
          {v.sin_moneda_de_riesgo.length === 1
            ? `${v.sin_moneda_de_riesgo[0]} no entra en silencio: le falta la moneda de riesgo, que vas a poder elegir desde la 1b.`
            : `${v.sin_moneda_de_riesgo.slice(0, -1).join(', ')} y ${v.sin_moneda_de_riesgo.at(-1)} no entran en silencio: les falta la moneda de riesgo, que vas a poder elegir desde la 1b.`}
        </Aviso>
      ) : null}
    </div>
  )
}

/** Barra horizontal apilada, fina, con leyenda (sin tortas: spec §UI). */
function Barra({ titulo, segmentos, nota }: { titulo: string; segmentos: Segmento[]; nota?: string }) {
  const positivos = segmentos.filter((s) => s.peso.valor !== null && !s.peso.valor.startsWith('-') && Number(s.peso.valor) > 0)
  return (
    <figure className="m-0">
      <figcaption className="mb-2 text-sm font-medium">{titulo}</figcaption>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded" role="img" aria-label={`${titulo}: ${segmentos.map((s) => s.nombre).join(', ')}`}>
        {positivos.map((s) => (
          <div
            key={s.clave}
            title={`${s.nombre}`}
            className="h-full min-w-[3px] first:rounded-l last:rounded-r"
            style={{ flexGrow: Number(s.peso.valor), flexBasis: 0, background: s.color }}
          />
        ))}
      </div>
      <ul className="mt-2 divide-y divide-border">
        {segmentos.map((s) => (
          <li key={s.clave} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-1 text-sm sm:grid-cols-[minmax(0,1fr)_auto_4.5rem]">
            <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-2">
              <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
              <span className="truncate">{s.nombre}</span>
            </span>
            <span className="col-span-2 col-start-1 row-start-2 justify-self-start pl-[18px] sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:justify-self-end sm:pl-0">
              <ParMonto par={s.valor} titulo={s.nombre} decimalesUsd={0} />
            </span>
            <span className="col-start-2 row-start-1 text-right font-medium sm:col-start-3">
              <Porcentaje calc={s.peso} titulo={`${titulo} · ${s.nombre}`} signo={false} />
            </span>
          </li>
        ))}
      </ul>
      {nota ? <p className="mt-1 text-[12px] text-muted">{nota}</p> : null}
    </figure>
  )
}
