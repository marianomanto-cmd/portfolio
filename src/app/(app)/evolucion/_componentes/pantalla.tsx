// Evolución y PnL (rediseño 15/10, D-159; handoff, captura 07): la pregunta y
// la lectura con qué mirás y el período, las cuatro cifras clave, la
// composición en dólares y el resultado de cada partida partido en activo y
// tipo de cambio. Abajo, el detalle: todo lo que la pantalla tenía (la frase
// del período, el puente, quién sumó y quién restó, los resultados por activo,
// el patrimonio en el tiempo, el PnL por mes, el estado de resultados, el
// futuro con un escenario, la sensibilidad y el día cero), con el estilo nuevo.
// Con una sola carga no queda en blanco (D-136).

import type { VistaEvolucion } from '@/lib/vistas/contratos-evolucion'
import { Segmentado } from '@/components/pantalla/segmentado'
import { Aviso } from '@/components/ui'
import { hrefEvolucion, MONEDAS } from '../_lib/parametros'
import { ActivoVsTc } from './activo-tc'
import {
  BloqueContribuyentes,
  BloqueDiaCero,
  BloqueEstadoResultados,
  BloqueFuturo,
  BloqueMeses,
  BloquePatrimonio,
  BloquePuente,
  BloqueResultados,
  BloqueSensibilidad,
  ResumenPeriodo,
  SinCargas,
} from './bloques'
import { Cabecera } from './cabecera'
import { CifrasEvolucion } from './cifras-clave'
import { ComposicionUsd } from './composicion'
import { RecordarPeriodo } from './recordar'

export function PantallaEvolucion({ v, demo, enLaUrl = false }: { v: VistaEvolucion; demo: string | null; enLaUrl?: boolean }) {
  const p = v.parametros
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <RecordarPeriodo p={p} enLaUrl={enLaUrl} demo={demo} />
      <Cabecera v={v} demo={demo} />
      {v.aviso_periodo ? <Aviso>{v.aviso_periodo}</Aviso> : null}
      <CifrasEvolucion v={v} />
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* Al gráfico (de cliente) va solo lo que dibuja. */}
        <ComposicionUsd v={{ composicion: v.composicion, serie: v.serie, estado: v.estado, parametros: p }} />
        <ActivoVsTc v={v} />
      </div>
      {v.estado === 'sin_cargas' ? (
        <SinCargas />
      ) : (
        <section aria-labelledby="detalle-evolucion" className="flex min-w-0 flex-col gap-3 md:gap-4">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-t border-border pt-5">
            <h2 id="detalle-evolucion" className="text-[15px] font-medium">
              El detalle: tu PnL
            </h2>
            <Segmentado
              etiqueta="En qué moneda"
              opciones={MONEDAS.map((x) => ({ href: hrefEvolucion(p, { moneda: x.moneda }, demo, { explicito: true }), nombre: x.nombre, actual: x.moneda === p.moneda }))}
            />
          </div>
          <ResumenPeriodo v={v} />
          {v.estado === 'un_dia' ? <UnDia v={v} demo={demo} /> : <Periodo v={v} demo={demo} />}
        </section>
      )}
    </div>
  )
}

function UnDia({ v, demo }: { v: VistaEvolucion; demo: string | null }) {
  return (
    <>
      <div className="grid gap-3 md:gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] xl:items-start">
        {v.al_dia_cero ? <BloqueDiaCero v={v} d={v.al_dia_cero} abierto /> : null}
        <div className="flex flex-col gap-3 md:gap-4">
          {v.sensibilidad ? <BloqueSensibilidad s={v.sensibilidad} /> : null}
          {v.puente ? <BloquePuente v={v} puente={v.puente} /> : null}
        </div>
      </div>
      <div className="grid gap-3 md:gap-4 xl:grid-cols-2 xl:items-start">
        {v.resultados ? <BloqueEstadoResultados v={v} r={v.resultados} /> : null}
        <div className="flex flex-col gap-3 md:gap-4">
          <BloquePatrimonio v={v} />
          <BloqueFuturo v={v} demo={demo} />
        </div>
      </div>
    </>
  )
}

function Periodo({ v, demo }: { v: VistaEvolucion; demo: string | null }) {
  return (
    <>
      <div className="grid gap-3 md:gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] xl:items-start">
        {v.puente ? <BloquePuente v={v} puente={v.puente} /> : null}
        <BloqueContribuyentes v={v} />
      </div>
      {v.totales ? <BloqueResultados v={v} totales={v.totales} /> : null}
      <BloquePatrimonio v={v} />
      <BloqueMeses v={v} />
      <div className="grid gap-3 md:gap-4 xl:grid-cols-2 xl:items-start">
        {v.resultados ? <BloqueEstadoResultados v={v} r={v.resultados} /> : null}
        <div className="flex flex-col gap-3 md:gap-4">
          <BloqueFuturo v={v} demo={demo} />
          {v.sensibilidad ? <BloqueSensibilidad s={v.sensibilidad} /> : null}
        </div>
      </div>
      {v.al_dia_cero ? <BloqueDiaCero v={v} d={v.al_dia_cero} abierto={false} /> : null}
    </>
  )
}
