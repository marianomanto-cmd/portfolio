import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { CalcVista } from '@/lib/domain/calc'
import { numero } from '@/lib/domain/dinero'
import { fechaCorta } from '@/lib/domain/fechas'
import type { Segmento } from '@/lib/vistas/contratos'
import type { VistaExposicionPantalla } from '@/lib/vistas/contratos-exposicion'
import { porSubaDeCcl } from '@/components/calculos'
import { Monto, MontoTrazado, Porcentaje, TextoConMontos } from '@/components/monto'
import { Traza } from '@/components/traza'
import { Aviso, ParMonto, Rotulo, Tarjeta } from '@/components/ui'

// "El detalle: tu exposición": lo que Exposición mostraba antes del rediseño y
// el diseño no tiene arriba (D-158). La frase con la sensibilidad al CCL, la
// composición por clase, por moneda de riesgo y por geografía con lo que vale
// cada parte, y la concentración con el neto sobre tus activos. Toda cifra
// abre su traza.

/** La frase del neto con la sensibilidad: cada cifra es un botón y la puntuación va pegada a ella. */
function FraseExposicion({ v, pesosUsd, sensPesos }: { v: VistaExposicionPantalla; pesosUsd: CalcVista; sensPesos: CalcVista }) {
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
        <p className="text-[15px] leading-7">
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
    <p className="text-[15px] leading-8">
      Estás <span className="font-semibold">{largo ? 'largo' : 'corto'} en pesos</span> por{' '}
      <MontoTrazado calc={r.neto_ars} moneda="ARS" titulo="Pesos financieros − deuda del leasing" className="font-semibold" />{' '}
      {/* La puntuación va pegada a su cifra (whitespace-nowrap): cada cifra es un
          botón y un "(" o un ";" quedaban solos en un renglón del teléfono. */}
      <span className="whitespace-nowrap">
        <MontoTrazado calc={r.neto_usd} moneda="USD" titulo="El neto en dólares" decimales={0} />:
      </span>{' '}
      tus pesos financieros{' '}
      <span className="whitespace-nowrap">
        (<MontoTrazado calc={r.pesos_financieros.ars} moneda="ARS" titulo="Pesos financieros" compacta />,
      </span>{' '}
      <span className="whitespace-nowrap">
        <MontoTrazado calc={pesosUsd} moneda="USD" titulo="Pesos financieros en dólares" decimales={0} />)
      </span>{' '}
      {largo ? 'superan' : 'no llegan a'} lo que debés del leasing{' '}
      <span className="whitespace-nowrap">
        (<MontoTrazado calc={r.deuda_pesos.ars} moneda="ARS" titulo="Deuda del leasing" compacta />).
      </span>{' '}
      <span className="font-semibold">Por cada +1% de CCL:</span> en dólares, ese neto {sens !== null && sens.startsWith('-') ? 'pierde' : 'gana'}{' '}
      <span className="whitespace-nowrap">
        <Traza calc={r.sensibilidad_usd_1pct} titulo="Si el CCL sube 1%: el neto en dólares" moneda="USD">
          <Monto valor={sens === null ? null : sens.replace(/^-/, '')} moneda="USD" decimales={0} />
        </Traza>
        ;
      </span>{' '}
      en pesos, tus activos en dólares suman{' '}
      <span className="whitespace-nowrap">
        <MontoTrazado calc={sensPesos} moneda="ARS" titulo="Si el CCL sube 1%: tus activos en dólares, en pesos" />.
      </span>
    </p>
  )
}

/** Una composición como lista: cada parte con su color, lo que vale en pesos y en dólares y su peso (sin tortas). */
function Lista({ titulo, segmentos, nota, conBarra = false }: { titulo: string; segmentos: Segmento[]; nota?: string; conBarra?: boolean }) {
  const positivos = segmentos.filter((s) => s.peso.valor !== null && !s.peso.valor.startsWith('-') && Number(s.peso.valor) > 0)
  return (
    <figure className="m-0 min-w-0">
      <figcaption className="mb-2 text-sm font-medium">{titulo}</figcaption>
      {conBarra && positivos.length ? (
        <div className="mb-2 flex h-3 w-full gap-[2px] overflow-hidden rounded" role="img" aria-label={`${titulo}: ${segmentos.map((s) => s.nombre).join(', ')}`}>
          {positivos.map((s) => (
            <div key={s.clave} title={s.nombre} className="h-full min-w-[3px] first:rounded-l last:rounded-r" style={{ flexGrow: Number(s.peso.valor), flexBasis: 0, background: s.color }} />
          ))}
        </div>
      ) : null}
      <ul className="divide-y divide-border">
        {segmentos.map((s) => (
          <li key={s.clave} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-1 text-sm sm:grid-cols-[minmax(0,1fr)_auto_4.5rem]">
            <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-2">
              <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
              {/* El nombre entero, en dos renglones si hace falta: "Acciones lo…" no se lee. */}
              <span className="min-w-0 break-words">{s.nombre}</span>
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

export function DetalleExposicion({ v }: { v: VistaExposicionPantalla }) {
  const r = v.resumen
  const sensPesos = porSubaDeCcl(v.activos_en_dolares.ars, '1', 'ARS', 'Cuánto suman en pesos tus activos en dólares si el CCL sube 1%. Es una sensibilidad, no un pronóstico.')
  return (
    <section aria-labelledby="detalle-exposicion" className="flex min-w-0 flex-col gap-3 print:hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border pt-5">
        <h2 id="detalle-exposicion" className="text-[15px] font-medium">
          El detalle: tu exposición
        </h2>
        {v.fecha_datos ? (
          <p className="text-[13px] text-muted">
            Al cierre del {fechaCorta(v.fecha_datos)} · CCL{' '}
            <Traza calc={v.ccl} titulo="CCL de la foto">
              <span className="num">{v.ccl.valor === null ? 'sin dato' : numero(v.ccl.valor, 2)}</span>
            </Traza>
            {v.fecha_ccl && v.fecha_ccl !== v.fecha_datos ? ` del ${fechaCorta(v.fecha_ccl)} (ese día no cargaste CCL)` : ''} · tomador del leasing: sin confirmar
          </p>
        ) : null}
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-5">
        <div className="flex min-w-0 flex-col gap-3 lg:gap-5">
          <Tarjeta className="p-4 md:p-5" aria-label="Tu exposición al peso">
            <Rotulo as="h3" className="mb-2">
              En una frase
            </Rotulo>
            <FraseExposicion v={v} pesosUsd={r.pesos_financieros.usd} sensPesos={sensPesos} />
          </Tarjeta>
          <Tarjeta className="p-4 md:p-5" aria-labelledby="concentracion">
            <Rotulo as="h3" className="mb-3">
              <span id="concentracion">Concentración</span>
            </Rotulo>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Top 1{v.concentracion.top1_nombre ? ` · ${v.concentracion.top1_nombre}` : ''}</dt>
              <dd className="text-right">
                <Porcentaje calc={v.concentracion.top1} titulo="Concentración: tu posición más grande" signo={false} />
              </dd>
              <dt className="text-muted">Top 3{v.mayores.length > 1 && v.concentracion.top3.valor !== null ? ` · ${v.mayores.join(', ')}` : ''}</dt>
              <dd className="text-right">
                <Porcentaje calc={v.concentracion.top3} titulo="Concentración: tus tres posiciones más grandes" signo={false} />
              </dd>
              <dt className="text-muted">Neto en pesos sobre tus activos</dt>
              <dd className="text-right">
                <Porcentaje calc={v.neto_pct} titulo="Exposición neta al peso como parte de tus activos" />
              </dd>
            </dl>
            <p className="mt-3 text-[13px] text-muted">Sobre tu patrimonio financiero (D-03). Sin umbral: la app no juzga la concentración hasta que cargues el tuyo.</p>
          </Tarjeta>
        </div>
        <Tarjeta className="p-4 md:p-5" aria-labelledby="composicion">
          <Rotulo as="h3" className="mb-3">
            <span id="composicion">Composición {v.vista === 'total' ? 'del total (sin restar deudas)' : 'del financiero'}</span>
          </Rotulo>
          {v.fecha_datos ? (
            <div className="flex flex-col gap-5">
              <Lista titulo="Por clase" segmentos={v.por_clase} />
              <Lista titulo="Por moneda de riesgo" segmentos={v.por_moneda} conBarra />
              <Lista titulo="Por geografía" segmentos={v.por_geografia} nota="La liquidez cuenta en la geografía de su custodio." />
            </div>
          ) : (
            // Sin ninguna carga no hay composición: se dice, en vez de listas vacías.
            <p className="text-sm text-muted">
              <span className="italic">sin dato</span> · aparece con tu primera carga.
            </p>
          )}
        </Tarjeta>
      </div>
      {v.vista === 'total' && v.sin_moneda_de_riesgo.length > 0 ? (
        <Aviso>
          {v.sin_moneda_de_riesgo.length === 1
            ? `${v.sin_moneda_de_riesgo[0]} no entra en silencio: le falta la moneda de riesgo, que vas a poder elegir desde la 1b.`
            : `${v.sin_moneda_de_riesgo.slice(0, -1).join(', ')} y ${v.sin_moneda_de_riesgo.at(-1)} no entran en silencio: les falta la moneda de riesgo, que vas a poder elegir desde la 1b.`}
        </Aviso>
      ) : null}
    </section>
  )
}
