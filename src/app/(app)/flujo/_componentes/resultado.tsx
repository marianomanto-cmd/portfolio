'use client'

// El detalle de un escenario (plan §6 D.1 "Salidas", D.5; rediseño del 15/10,
// D-164 a D-166): las cajas al horizonte, el flujo mensual, el patrimonio
// proyectado en pesos o en dólares y la proyección mes a mes en la Grilla
// (tarjetas en el teléfono). Cada cifra abre su traza a pedido (trazaMes).
// Todo lo proyectado lleva su chip. No hay cuentas acá: salen de
// proyeccion.ts, panel.ts y _lib/graficos.ts.

import { memo, useMemo, useState } from 'react'
import { NOMBRE_ETIQUETA, etiquetaPrincipal, type Etiqueta } from '@/lib/domain/calc'
import { nombreMes, trazaMes } from '@/lib/domain/flujo/proyeccion'
import { resumenHorizonte } from '@/lib/domain/flujo/panel'
import type { BaseProyeccion, CampoMes, MesProyectado, ParNum, Proyeccion, Supuestos } from '@/lib/domain/flujo/tipos'
import { Grafico } from '@/components/graficos/grafico'
import { MontoTrazado, Monto, SinDato, TextoConMontos } from '@/components/monto'
import { useMedia, usePreferencias } from '@/components/preferencias'
import { colorTema } from '@/components/graficos/tema'
import { Grilla, type ColumnaGrilla } from '@/components/grilla'
import { SegmentadoBotones } from '@/components/pantalla/segmentado'
import { Chip, Rotulo, Tarjeta } from '@/components/ui'
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
      {m.no_se_cubre ? <Chip>no se cubre</Chip> : null}
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
    <div className="flex min-w-0 flex-col gap-2 rounded-item border border-border bg-surface-2 px-[18px] py-4">
      <p className="rotulo text-[10px]">{titulo}</p>
      <span className="cifra text-[20px] leading-tight">
        <Cifra base={base} s={s} m={m} campo={campo} moneda="ARS" nombre={titulo} />
      </span>
      <span className="num self-start text-[13px]">
        <Cifra base={base} s={s} m={m} campo={campo} moneda="USD" nombre={titulo} />
      </span>
      {p.ars === null && m.motivos?.[campo] ? <p className="text-[11px] leading-snug text-muted">{m.motivos[campo]}</p> : null}
      {detalle ? <p className="text-[11px] leading-snug text-muted">{detalle}</p> : null}
    </div>
  )
}

/** La tarjeta de un mes en el teléfono: las dos monedas, línea por línea. */
function TarjetaMes({ base, s, m, lineas }: { base: BaseProyeccion; s: Supuestos; m: MesProyectado; lineas: typeof LINEAS }) {
  return (
    <div className="rounded-tarjeta border border-border bg-surface p-4" data-mes={m.mes}>
      <div className="flex flex-wrap items-center justify-between gap-1">
        <p className="text-sm font-medium text-text">{nombreMes(m.mes)}</p>
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
    </div>
  )
}

/**
 * Memorizado: mientras movés una barra, el render urgente (el panel) no lo
 * vuelve a armar; se arma una vez por proyección nueva (useDeferredValue).
 */
export const Resultado = memo(function Resultado({
  base,
  s,
  proy,
  nombre,
  referencia,
}: {
  base: BaseProyeccion
  s: Supuestos
  proy: Proyeccion
  nombre: string | null
  /** "Todo igual" (null si el escenario ya lo es): la referencia del patrimonio proyectado. */
  referencia: Proyeccion | null
}) {
  const [moneda, setMoneda] = useState<Moneda>('ARS')
  // En el teléfono, el gráfico del flujo muestra el mes de la carga y los 6 siguientes; "Ver los N meses" cambia el rango (nunca zoom ni scroll horizontal).
  const [graficoEntero, setGraficoEntero] = useState(false)
  const [vista, setVista] = useState<Vista>('flujo')
  // El mes a mes arranca con el mes de la carga y los 12 que siguen (5 en el teléfono); "Ver los N meses" los muestra todos.
  const [todos, setTodos] = useState(false)
  const lineas = useMemo(() => LINEAS.filter((l) => l.vista === vista), [vista])
  const { privado } = usePreferencias()
  const movil = useMedia('(max-width: 767.98px)')
  // La línea del excedente va en el color del texto (--text): el envoltorio lo resuelve con el tema vigente.
  const colorTexto = colorTema('texto')
  const meses = proy.meses
  const ref = referencia && referencia.estado === 'lista' ? referencia.meses : null
  const resumen = useMemo(() => resumenHorizonte(proy), [proy])
  const mesesGrafico = useMemo(() => (movil && !graficoEntero ? meses.slice(0, 7) : meses), [meses, movil, graficoEntero])
  const opcionFlujo = useMemo(() => opcionFlujoMensual(mesesGrafico, moneda, { privado, movil, colorTexto }), [mesesGrafico, moneda, privado, movil, colorTexto])
  const tablaFlujo = useMemo(() => tablaFlujoMensual(mesesGrafico, moneda, privado), [mesesGrafico, moneda, privado])
  const series = useMemo(() => [{ nombre: nombre ?? 'Este escenario', meses, trazo: 'solid' as const }], [meses, nombre])
  const opcionPat = useMemo(() => opcionPatrimonio(series, moneda, { privado, movil, referencia: ref }), [series, moneda, privado, movil, ref])
  const tablaPat = useMemo(() => tablaPatrimonio(series, moneda, privado, ref), [series, moneda, privado, ref])
  const corte = movil ? 6 : 13
  const filas = useMemo(() => (todos ? meses : meses.slice(0, corte)), [meses, todos, corte])
  const columnas = useMemo<ColumnaGrilla<MesProyectado>[]>(
    () => [
      {
        id: 'mes',
        titulo: 'Mes',
        ancho: 120,
        flex: 0.9,
        prioridad: 0,
        celda: (m) => (
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="text-text">{nombreMes(m.mes)}</span>
            <span className="text-[11px] text-muted">{m.real ? 'real' : m.estado === 'en_curso' ? 'en curso' : 'proyectado'}</span>
          </span>
        ),
      },
      ...lineas.map(
        (l, i): ColumnaGrilla<MesProyectado> => ({
          id: l.campo,
          titulo: l.corto,
          tipo: 'numero',
          ancho: 116,
          prioridad: l.fuerte ? 0 : i + 1,
          celda: (m) => <Cifra base={base} s={s} m={m} campo={l.campo} moneda={moneda} nombre={l.nombre} compacta fuerte={l.fuerte} signo={l.signo} />,
        }),
      ),
    ],
    [lineas, base, s, moneda],
  )

  if (proy.estado === 'faltan' || !meses.length) {
    return (
      <Tarjeta className="p-5" aria-labelledby="titulo-proyeccion">
        <Rotulo id="titulo-proyeccion">La proyección, mes a mes{nombre ? ` · ${nombre}` : ''}</Rotulo>
        <p className="mt-2 text-[13px] text-muted">
          Todavía no hay proyección: {proy.faltan.length === 1 ? 'falta un dato' : `faltan ${proy.faltan.length} datos`} de tus supuestos. No se inventa ningún mes: mirá lo que falta en tus supuestos.
        </p>
      </Tarjeta>
    )
  }

  const ultimo = meses[meses.length - 1]

  return (
    <Tarjeta className="flex min-w-0 flex-col gap-5 p-5" aria-labelledby="titulo-proyeccion">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="titulo-proyeccion" className="rotulo flex flex-wrap items-center gap-2 text-[11px]">
            La proyección, mes a mes{nombre ? ` · ${nombre}` : ''} <Chip>supuesto</Chip>
          </h2>
          <p className="mt-1 max-w-prose text-[13px] text-muted">
            Un solo camino con tus supuestos, desde tu última carga hasta {nombreMes(ultimo.mes)}. No es un pronóstico ni una recomendación. El abanico de caminos
            posibles (Monte Carlo) llega en otra etapa.
          </p>
        </div>
        <SegmentadoBotones
          etiqueta="Moneda de los gráficos y la tabla"
          actual={moneda}
          alElegir={setMoneda}
          opciones={[
            { valor: 'ARS', nombre: 'En pesos' },
            { valor: 'USD', nombre: 'En dólares' },
          ]}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {resumen ? (
          <div className="flex min-w-0 flex-col gap-2 rounded-item border border-border bg-surface-2 px-[18px] py-4">
            <p className="rotulo text-[10px]">Excedente acumulado a {nombreMes(ultimo.mes)}</p>
            <span className="cifra text-[20px] leading-tight">
              <MontoTrazado calc={resumen.excedente.ars} moneda="ARS" titulo="Excedente acumulado · en pesos" />
            </span>
            <span className="num self-start text-[13px]">
              <MontoTrazado calc={resumen.excedente.usd} moneda="USD" titulo="Excedente acumulado · en dólares" />
            </span>
          </div>
        ) : null}
        <CajaHorizonte titulo={`Patrimonio financiero a ${nombreMes(ultimo.mes)}`} base={base} s={s} m={ultimo} campo="financiero" />
        <CajaHorizonte titulo={`Neto sin la camioneta a ${nombreMes(ultimo.mes)}`} base={base} s={s} m={ultimo} campo="neto_sin_financiados" detalle="Financiero + la casa. La camioneta y su deuda van aparte." />
      </div>

      <ul className="space-y-1 text-[13px] text-muted">
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

      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <div className="min-w-0">
          <h3 className="text-[14px] font-medium text-text">Flujo mes a mes</h3>
          <p className="text-xs text-muted">Entradas arriba del cero, salidas abajo, y la línea del excedente. Lo proyectado va rayado.</p>
          <div className="relative mt-2 min-w-0 overflow-x-clip">
            <Grafico opcion={opcionFlujo} titulo={`Flujo mes a mes, en ${moneda === 'ARS' ? 'pesos' : 'dólares'}`} tabla={tablaFlujo} fusionar />
          </div>
          {movil && meses.length > 7 ? (
            <button
              type="button"
              className="tocable inline-flex min-h-10 items-center text-[13px] text-text underline-offset-2 hover:underline"
              aria-expanded={graficoEntero}
              onClick={() => setGraficoEntero((x) => !x)}
            >
              {graficoEntero ? 'Ver los próximos 6 meses' : `Ver los ${meses.length} meses en el gráfico`}
            </button>
          ) : null}
        </div>
        <div className="min-w-0">
          <h3 className="text-[14px] font-medium text-text">Patrimonio proyectado</h3>
          <p className="text-xs text-muted">Desde hoy, en gris: lo que sale de tus supuestos.{ref ? ' Rayada: «Todo igual».' : ''}</p>
          <div className="relative mt-2 min-w-0 overflow-x-clip">
            <Grafico opcion={opcionPat} titulo={`Patrimonio proyectado, en ${moneda === 'ARS' ? 'pesos' : 'dólares'}`} tabla={tablaPat} fusionar />
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[14px] font-medium text-text">Mes a mes</h3>
          <SegmentadoBotones
            etiqueta="Qué ver mes a mes"
            actual={vista}
            alElegir={setVista}
            opciones={[
              { valor: 'flujo', nombre: 'La plata del mes' },
              { valor: 'patrimonio', nombre: 'Patrimonio y resultado' },
            ]}
          />
        </div>
        {vista === 'patrimonio' ? <p className="text-xs text-muted">El resultado del mes se parte como el real (D-35): lo invertido, lo que cambió el precio y lo que cambió el dólar.</p> : null}
        {/* Sin scroll adentro: la grilla crece con los meses que ves. */}
        <Grilla
          key={vista}
          titulo={`La proyección mes a mes, en ${moneda === 'ARS' ? 'pesos' : 'dólares'}: ${vista === 'flujo' ? 'la plata del mes' : 'patrimonio y resultado'}`}
          filas={filas}
          columnas={columnas}
          idFila={(m) => m.mes}
          nombreFila={(m) => nombreMes(m.mes)}
          altoFila={52}
          maxFilas={filas.length}
          tarjeta={(m) => <TarjetaMes base={base} s={s} m={m} lineas={lineas} />}
        />
        {meses.length > corte ? (
          <button
            type="button"
            className="tocable inline-flex min-h-10 items-center self-start text-[13px] text-text underline-offset-2 hover:underline"
            aria-expanded={todos}
            onClick={() => setTodos((t) => !t)}
          >
            {todos ? 'Ver menos meses' : `Ver los ${meses.length} meses`}
          </button>
        ) : null}
      </div>
    </Tarjeta>
  )
})

/**
 * La franja del teléfono (plan §6 D.1): al bajar a los supuestos queda fija
 * arriba, opaca y de un renglón, con el excedente del primer mes proyectado y
 * el financiero al horizonte, para ver el efecto de cada toque sin subir.
 */
export const Franja = memo(function Franja({ base, s, proy }: { base: BaseProyeccion; s: Supuestos; proy: Proyeccion }) {
  const clase = 'sticky top-[var(--barra-sup)] z-30 -mx-5 -mt-5 mb-4 rounded-t-tarjeta border-b border-border bg-surface-2 px-5 py-1.5 text-xs lg:hidden'
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
