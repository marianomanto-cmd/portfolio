import type { VistaEvolucion } from '@/lib/vistas/contratos-evolucion'
import { Encabezado } from '@/components/pantalla/encabezado'
import { Segmentado } from '@/components/pantalla/segmentado'
import { lecturaEvolucion } from '../_lib/lectura'
import { hrefEvolucion, VISTAS } from '../_lib/parametros'
import { SelectorPeriodo } from './periodo'

// La pregunta, la lectura y, a la derecha, qué mirás (Financiero · Total) y
// el período (handoff, captura 07). Sin cargas no hay período que elegir.

export function Cabecera({ v, demo }: { v: VistaEvolucion; demo: string | null }) {
  const p = v.parametros
  const acciones =
    v.estado === 'sin_cargas' ? null : (
      // Una arriba de la otra y a la derecha de la lectura, como el período del diseño: en fila no entraban al lado de la lectura a 1280 px.
      <div className="flex flex-col items-start gap-2 md:items-end">
        <Segmentado
          etiqueta="Qué mirás"
          opciones={VISTAS.map((x) => ({
            href: hrefEvolucion(p, { vista: x.vista }, demo, { explicito: true }),
            nombre: x.nombre,
            actual: x.vista === p.vista,
            titulo: x.detalle,
            oculto: x.detalle,
          }))}
        />
        <SelectorPeriodo p={p} demo={demo} fechas={v.fechas} desde={v.desde} hasta={v.hasta} />
      </div>
    )
  return <Encabezado pregunta="Resultados · ¿Gané o perdí, y por qué?" lectura={lecturaEvolucion(v)} acciones={acciones} />
}
