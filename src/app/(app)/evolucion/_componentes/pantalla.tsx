// La pantalla Evolución y PnL: los bloques en el orden del plan (§4 B.1).
// Con una sola carga no queda en blanco (D-136): el punto de partida, lo que ya
// traías al día cero, la sensibilidad al CCL, el puente "sin dato · necesita
// una segunda carga" y el flujo del mes en curso.

import type { VistaEvolucion } from '@/lib/vistas/contratos-evolucion'
import { Aviso } from '@/components/ui'
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
  Encabezado,
  SinCargas,
} from './bloques'
import { Controles } from './controles'
import { RecordarPeriodo } from './recordar'

export function PantallaEvolucion({ v, demo, enLaUrl = false }: { v: VistaEvolucion; demo: string | null; enLaUrl?: boolean }) {
  const titulo = `Evolución y PnL · ${v.parametros.vista === 'total' ? 'Total' : 'Financiero'}`
  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <h1 className="sr-only">{titulo}</h1>
      <RecordarPeriodo p={v.parametros} enLaUrl={enLaUrl} demo={demo} />
      {v.estado === 'sin_cargas' ? (
        <SinCargas />
      ) : (
        <>
          <Controles v={v} demo={demo} />
          {v.aviso_periodo ? <Aviso>{v.aviso_periodo}</Aviso> : null}
          <Encabezado v={v} />
          {v.estado === 'un_dia' ? <UnDia v={v} demo={demo} /> : <Periodo v={v} demo={demo} />}
        </>
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
