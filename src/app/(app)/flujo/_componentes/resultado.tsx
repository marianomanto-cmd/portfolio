'use client'

// Lo que sale de un escenario (plan §6 D.1 "Salidas", D.5): las cajas al
// horizonte, el flujo mensual, el patrimonio proyectado y la tabla mes a mes
// (tarjetas en el teléfono). Cada cifra abre su traza a pedido (trazaMes).
// Todo lo proyectado lleva su chip. No hay cuentas acá: salen de proyeccion.ts,
// panel.ts y _lib/graficos.ts.

import { memo, useMemo, useState } from 'react'
import { NOMBRE_ETIQUETA, etiquetaPrincipal, type Etiqueta } from '@/lib/domain/calc'
import { nombreMes, trazaMes } from '@/lib/domain/flujo/proyeccion'
import { resumenHorizonte } from '@/lib/domain/flujo/panel'
import type { BaseProyeccion, CampoMes, MesProyectado, ParNum, Proyeccion, Supuestos } from '@/lib/domain/flujo/tipos'
import { GraficoFlujo as Grafico } from './grafico-flujo'
import { MontoTrazado, Monto, SinDato, TextoConMontos } from '@/components/monto'
import { useMedia, usePreferencias } from '@/components/preferencias'
import { Chip } from '@/components/ui'
import { TrazaDiferida } from '@/components/escenarios/traza-diferida'
import { opcionFlujoMensual, opcionPatrimonio, tablaFlujoMensual, tablaPatrimonio } from '../_lib/graficos'

type Moneda = 'ARS' | 'USD'

type Vista = 'flujo' | 'patrimonio'

const LINEAS: { campo: CampoMes; nombre: string; corto: string; leer: (m: MesProyectado) => ParNum; fuerte?: boolean; vista: Vista; signo?: boolean }[] = [
  { campo: 'ingresos', nombre: 'Ingresos', corto: 'Ingresos', leer: (m) => m.ingresos, vista: 'flujo' },
  { campo: 'gastos', nombre: 'Gastos fijos', corto: 'Gastos', leer: (m) => m.gastos, vista: 'flujo' },
  { campo: 'cuota', nombre: 'Cuota del leasing', corto: 'Cuota', leer: (m) => m.cuota, vista: 'flujo' },
  { campo: 'vencimientos', nombre: 'Vencimientos', corto: 'Vence', leer: (m) => m.vencimientos, vista: 'flujo' },
  { campo: 'excedente', nombre: 'Excedente', corto: 'Excedente', leer: (m) => m.excedente, fuerte: true, vista: 'flujo', signo: true },
  { campo: 'invertido', nombre: 'Invertido', corto: 'Invertido', leer: (m) => m.invertido, vista: 'patrimonio', signo: true },
  { campo: 'pnl.activo', nombre: 'Resultado por precio', corto: 'Por precio', leer: (m) => m.pnl.activo, vista: 'patrimonio', signo: true },
  { campo: 'pnl.tc', nombre: 'Resultado por el dólar', corto: 'Por el dólar', leer: (m) => m.pnl.tc, vista: 'patrimonio', signo: true },
  { campo: 'financiero', nombre: 'Patrimonio financiero', corto: 'Financiero', leer: (m) => m.financiero, fuerte: true, vista: 'patrimonio' },
  { campo: 'neto_sin_financiados', nombre: 'Neto sin la camioneta', corto: 'Neto sin camioneta', leer: (m) => m.neto_sin_financiados, vista: 'patrimonio' },
]

const valorDe = (p: ParNum, moneda: Moneda) => (moneda === 'ARS' ? p.ars : p.usd)

function ChipMes({ m }: { m: MesProyectado }) {
  const e = etiquetaPrincipal(m.etiquetas as Etiqueta[])
  return (
    <span className="inline-flex flex-wrap gap-1">
      <Chip>{m.real ? 'real' : m.estado === 'en_curso' ? 'en curso' : 'proyectado'}</Chip>
      {e && e !== 'proyectado' ? <Chip>{NOMBRE_ETIQUETA[e]}</Chip> : null}
      {m.no_se_cubre ? <Chip className="!bg-warn-soft !text-warn">no se cubre</Chip> : null}
    </span>
  )
}

/** Una cifra de un mes: el monto (compacto si se pide) y su traza al tocar. */
export function Cifra({ base, s, m, campo, moneda, nombre, compacta = false, fuerte = false, signo = false }: { base: BaseProyeccion; s: Supuestos; m: MesProyectado; campo: CampoMes; moneda: Moneda; nombre: string; compacta?: boolean; fuerte?: boolean; signo?: boolean }) {
  const linea = LINEAS.find((l) => l.campo === campo)
  const p = linea ? linea.leer(m) : null
  const v = p ? valorDe(p, moneda) : null
  return (
    <TrazaDiferida obtener={() => trazaMes(base, s, m.mes, campo, moneda)} titulo={`${nombre} de ${nombreMes(m.mes)} · en ${moneda === 'ARS' ? 'pesos' : 'dólares'}`} moneda={moneda}>
      {v === null ? <SinDato motivo={m.motivos?.[campo]} /> : <Monto valor={v} moneda={moneda} compacta={compacta} signo={signo} className={fuerte ? 'font-semibold' : ''} />}
    </TrazaDiferida>
  )
}

function CajaHorizonte({ titulo, base, s, m, campo, detalle }: { titulo: string; base: BaseProyeccion; s: Supuestos; m: MesProyectado; campo: CampoMes; detalle?: string }) {
  const linea = LINEAS.find((l) => l.campo === campo)
  const p = linea?.leer(m) ?? { ars: null, usd: null }
  return (
    <div className="min-w-0 rounded-lg border border-border bg-surface p-3">
      <p className="text-xs text-muted">{titulo}</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-lg">
        <Cifra base={base} s={s} m={m} campo={campo} moneda="ARS" nombre={titulo} />
        <Cifra base={base} s={s} m={m} campo={campo} moneda="USD" nombre={titulo} />
      </div>
      {p.ars === null && m.motivos?.[campo] ? <p className="mt-1 text-xs text-muted">{m.motivos[campo]}</p> : null}
      {detalle ? <p className="mt-1 text-xs text-muted">{detalle}</p> : null}
    </div>
  )
}

/**
 * Memorizado: mientras movés el deslizante, el render urgente (el panel) no lo
 * vuelve a armar; se arma una vez por proyección nueva (useDeferredValue).
 */
export const Resultado = memo(function Resultado({ base, s, proy, nombre }: { base: BaseProyeccion; s: Supuestos; proy: Proyeccion; nombre: string | null }) {
  const [moneda, setMoneda] = useState<Moneda>('ARS')
  const [todos, setTodos] = useState(false)
  // En el teléfono, el gráfico del flujo muestra el mes de la carga y los 6 siguientes; "Ver los N meses" cambia el rango (nunca zoom ni scroll horizontal).
  const [graficoEntero, setGraficoEntero] = useState(false)
  const [vista, setVista] = useState<Vista>('flujo')
  const lineas = LINEAS.filter((l) => l.vista === vista)
  const preferencias = usePreferencias()
  const { privado } = preferencias
  const movil = useMedia('(max-width: 767.98px)')
  const sistemaOscuro = useMedia('(prefers-color-scheme: dark)')
  // La línea del excedente va en el color del texto (--text), que cambia con el tema.
  const oscuro = preferencias.tema === 'oscuro' || (preferencias.tema === 'sistema' && sistemaOscuro)
  const colorTexto = oscuro ? '#e6eaf0' : '#121722'
  const meses = proy.meses
  const resumen = useMemo(() => resumenHorizonte(proy), [proy])
  const mesesGrafico = useMemo(() => (movil && !graficoEntero ? meses.slice(0, 7) : meses), [meses, movil, graficoEntero])
  const opcionFlujo = useMemo(() => opcionFlujoMensual(mesesGrafico, moneda, { privado, movil, colorTexto }), [mesesGrafico, moneda, privado, movil, colorTexto])
  const tablaFlujo = useMemo(() => tablaFlujoMensual(mesesGrafico, moneda, privado), [mesesGrafico, moneda, privado])
  const series = useMemo(() => [{ nombre: nombre ?? 'Este escenario', meses, trazo: 'solid' as const }], [meses, nombre])
  const opcionPat = useMemo(() => opcionPatrimonio(series, moneda, { privado, movil }), [series, moneda, privado, movil])
  const tablaPat = useMemo(() => tablaPatrimonio(series, moneda, privado), [series, moneda, privado])

  if (proy.estado === 'faltan') {
    return (
      <section aria-labelledby="titulo-proyeccion" className="rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow)]">
        <h2 id="titulo-proyeccion" className="text-base font-semibold text-text">
          Proyección{nombre ? ` · ${nombre}` : ''}
        </h2>
        <p className="mt-1 text-sm text-muted">
          Todavía no hay proyección: {proy.faltan.length === 1 ? 'falta un dato' : `faltan ${proy.faltan.length} datos`} de tus supuestos. No se inventa ningún mes: elegí lo que falta (o tocá «Completar lo que falta con Igual») y el horizonte.
        </p>
        <a href="#supuestos" className="tocable mt-2 inline-flex min-h-10 items-center rounded-lg border border-border px-3 text-sm font-medium text-accent hover:bg-surface-2 lg:hidden">
          Ir a tus supuestos
        </a>
      </section>
    )
  }

  const ultimo = meses[meses.length - 1]
  const visibles = todos ? meses : meses.slice(0, 6)
  const visiblesTabla = todos ? meses : meses.slice(0, 13)

  return (
    <section aria-labelledby="titulo-proyeccion" className="space-y-4 rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow)] md:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id="titulo-proyeccion" className="text-base font-semibold text-text">
            Proyección{nombre ? ` · ${nombre}` : ''} <Chip>supuesto</Chip>
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Un solo camino con tus supuestos, desde tu última carga hasta {nombreMes(ultimo.mes)}. No es un pronóstico ni una recomendación. El abanico de
            caminos posibles (Monte Carlo) llega en otra etapa.
          </p>
        </div>
        <div role="group" aria-label="Moneda de los gráficos y la tabla" className="inline-grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface-2 p-1">
          {(['ARS', 'USD'] as const).map((x) => (
            <button
              key={x}
              type="button"
              aria-pressed={moneda === x}
              onClick={() => setMoneda(x)}
              className={`tocable inline-flex min-h-8 items-center justify-center rounded-md px-3 text-sm font-medium ${moneda === x ? 'bg-surface text-text shadow-[var(--shadow)]' : 'text-muted hover:text-text'}`}
            >
              {x === 'ARS' ? 'En pesos' : 'En dólares'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {resumen ? (
          <div className="min-w-0 rounded-lg border border-border bg-surface p-3">
            <p className="text-xs text-muted">Excedente acumulado a {nombreMes(ultimo.mes)}</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-lg">
              <MontoTrazado calc={resumen.excedente.ars} moneda="ARS" titulo="Excedente acumulado · en pesos" />
              <MontoTrazado calc={resumen.excedente.usd} moneda="USD" titulo="Excedente acumulado · en dólares" />
            </div>
          </div>
        ) : null}
        <CajaHorizonte titulo={`Patrimonio financiero a ${nombreMes(ultimo.mes)}`} base={base} s={s} m={ultimo} campo="financiero" />
        <CajaHorizonte titulo={`Neto sin la camioneta a ${nombreMes(ultimo.mes)}`} base={base} s={s} m={ultimo} campo="neto_sin_financiados" detalle="Financiero + la casa. La camioneta y su deuda van aparte." />
      </div>

      <ul className="space-y-1 text-sm text-muted">
        {proy.debajo ? (
          <li>
            <span className="font-medium text-text">¿Terminás debajo de lo que pusiste? </span>
            <TextoConMontos texto={proy.debajo.texto} />
          </li>
        ) : null}
        {proy.cobertura ? (
          <li>
            <span className="font-medium text-text">Cobertura de la cuota: </span>
            <TextoConMontos texto={proy.cobertura.texto} />
          </li>
        ) : null}
        {ultimo.neto_completo.ars === null ? (
          <li>
            <span className="font-medium text-text">Patrimonio neto con la camioneta: </span>sin dato · {ultimo.motivos?.neto_completo ?? 'falta la apertura de la cuota.'} La caja del mes no cambia: usa la cuota entera.
          </li>
        ) : null}
      </ul>

      <div>
        <h3 className="text-sm font-medium text-text">Flujo mes a mes</h3>
        <p className="text-xs text-muted">Entradas arriba del cero, salidas abajo, y la línea del excedente. Lo proyectado va rayado.</p>
        <Grafico opcion={opcionFlujo} titulo={`Flujo mes a mes, en ${moneda === 'ARS' ? 'pesos' : 'dólares'}`} tabla={tablaFlujo} />
        {movil && meses.length > 7 ? (
          <button
            type="button"
            className="tocable inline-flex min-h-10 items-center text-sm font-medium text-accent hover:underline"
            aria-expanded={graficoEntero}
            onClick={() => setGraficoEntero((x) => !x)}
          >
            {graficoEntero ? 'Ver los próximos 6 meses' : `Ver los ${meses.length} meses en el gráfico`}
          </button>
        ) : null}
      </div>
      <div>
        <h3 className="text-sm font-medium text-text">Patrimonio proyectado</h3>
        <p className="text-xs text-muted">Desde hoy, en gris: lo que sale de tus supuestos.</p>
        <Grafico opcion={opcionPat} titulo={`Patrimonio proyectado, en ${moneda === 'ARS' ? 'pesos' : 'dólares'}`} tabla={tablaPat} />
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-text">Mes a mes</h3>
          <div role="group" aria-label="Qué ver mes a mes" className="inline-grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface-2 p-1">
            {(
              [
                ['flujo', 'La plata del mes'],
                ['patrimonio', 'Patrimonio y resultado'],
              ] as const
            ).map(([x, t]) => (
              <button
                key={x}
                type="button"
                aria-pressed={vista === x}
                onClick={() => setVista(x)}
                className={`tocable inline-flex min-h-8 items-center justify-center rounded-md px-2 text-sm font-medium ${vista === x ? 'bg-surface text-text shadow-[var(--shadow)]' : 'text-muted hover:text-text'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        {vista === 'patrimonio' ? (
          <p className="mt-1 text-xs text-muted">El resultado del mes se parte como el real (D-35): lo invertido, lo que cambió el precio y lo que cambió el dólar.</p>
        ) : null}
        {/* Teléfono: una tarjeta por mes, las dos monedas. Se arma una sola de las dos vistas (la otra no se renderiza: el deslizante va más rápido). */}
        {movil ? (
          <ul className="mt-2 space-y-2">
            {visibles.map((m) => (
              <li key={m.mes} className="rounded-lg border border-border p-3" data-mes={m.mes}>
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <p className="text-sm font-semibold text-text">{nombreMes(m.mes)}</p>
                  <ChipMes m={m} />
                </div>
                <dl className="mt-2 space-y-1 text-sm">
                  {lineas.map((l) => (
                    <div key={l.campo} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3">
                      <dt className={l.fuerte ? 'font-medium text-text' : 'text-muted'}>{l.corto}</dt>
                      <dd className="flex flex-wrap items-baseline justify-end gap-x-2">
                        <Cifra base={base} s={s} m={m} campo={l.campo} moneda="ARS" nombre={l.nombre} compacta fuerte={l.fuerte} signo={l.signo} />
                        <Cifra base={base} s={s} m={m} campo={l.campo} moneda="USD" nombre={l.nombre} compacta fuerte={l.fuerte} signo={l.signo} />
                      </dd>
                    </div>
                  ))}
                </dl>
                {m.no_se_cubre ? <p className="mt-2 text-xs font-medium text-warn">No se cubre: el excedente negativo es más que tus pesos.</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          /* Desde 768 px, la tabla en la moneda elegida (la otra, con el botón de arriba). */
          <div className="mt-2">
            <table className="w-full text-[13px]">
              <caption className="sr-only">Proyección mes a mes, en {moneda === 'ARS' ? 'pesos' : 'dólares'}</caption>
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th scope="col" className="py-1 pr-1 font-medium">
                    Mes
                  </th>
                  {lineas.map((l) => (
                    <th key={l.campo} scope="col" className="px-1 py-1 text-right align-bottom font-medium">
                      {l.corto}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visiblesTabla.map((m) => (
                  <tr key={m.mes} className={`border-t border-border ${m.real ? '' : 'bg-surface-2/40'}`} data-mes={m.mes}>
                    <th scope="row" className="py-1 pr-1 text-left font-normal">
                      <span className="block text-text">{nombreMes(m.mes)}</span>
                      <span className="block text-[11px] text-muted">{m.real ? 'real' : m.estado === 'en_curso' ? 'en curso' : 'proyectado'}</span>
                    </th>
                    {lineas.map((l) => (
                      <td key={l.campo} className="whitespace-nowrap px-1 py-1 text-right">
                        <Cifra base={base} s={s} m={m} campo={l.campo} moneda={moneda} nombre={l.nombre} compacta fuerte={l.fuerte} signo={l.signo} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {meses.length > 6 ? (
          <button
            type="button"
            className={`tocable mt-2 min-h-10 items-center text-sm font-medium text-accent hover:underline ${movil || meses.length > 13 ? 'inline-flex' : 'hidden'}`}
            aria-expanded={todos}
            onClick={() => setTodos((t) => !t)}
          >
            {todos ? 'Ver menos meses' : `Ver los ${meses.length} meses`}
          </button>
        ) : null}
      </div>
    </section>
  )
})

/**
 * La franja del teléfono (plan §6 D.1): al bajar a los supuestos queda fija
 * arriba, opaca y de un renglón, con el excedente del primer mes proyectado y
 * el financiero al horizonte, para ver el efecto de cada toque sin subir.
 */
export const Franja = memo(function Franja({ base, s, proy }: { base: BaseProyeccion; s: Supuestos; proy: Proyeccion }) {
  const clase = 'sticky top-[var(--barra-sup)] z-30 -mx-3 -mt-3 mb-3 rounded-t-xl border-b border-border bg-surface-2 px-3 py-1 text-xs lg:hidden'
  if (proy.estado === 'faltan' || !proy.meses.length) {
    return (
      <p className={clase} role="status">
        Para proyectar {proy.faltan.length === 1 ? 'falta un dato' : `faltan ${proy.faltan.length} datos`}.
      </p>
    )
  }
  const primero = proy.meses[1] ?? proy.meses[0]
  const ultimo = proy.meses[proy.meses.length - 1]
  return (
    <div role="group" className={`${clase} grid grid-cols-2 gap-x-3`} aria-label="Resumen de la proyección">
      <div className="min-w-0">
        <p className="text-muted">Excedente {nombreMes(primero.mes)}</p>
        <Cifra base={base} s={s} m={primero} campo="excedente" moneda="ARS" nombre="Excedente" compacta />
      </div>
      <div className="min-w-0">
        <p className="text-muted">Financiero {nombreMes(ultimo.mes)}</p>
        <Cifra base={base} s={s} m={ultimo} campo="financiero" moneda="USD" nombre="Patrimonio financiero" compacta />
      </div>
    </div>
  )
})
