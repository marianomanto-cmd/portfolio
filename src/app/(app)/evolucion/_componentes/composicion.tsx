'use client'

import { useMemo } from 'react'
import type { VistaEvolucion } from '@/lib/vistas/contratos-evolucion'
import { Grafico } from '@/components/graficos/grafico'
import { usePreferencias } from '@/components/preferencias'
import { Rotulo, Tarjeta } from '@/components/ui'
import { opcionComposicion } from '../_lib/graficos'

// "Composición en dólares · área apilada" (handoff, captura 07): lo que vale
// cada clase en cada carga del período y tu patrimonio, rayado. La leyenda va
// en HTML, arriba a la derecha, como en el diseño.

export function ComposicionUsd({ v }: { v: Pick<VistaEvolucion, 'composicion' | 'serie' | 'estado' | 'parametros'> }) {
  const { privado } = usePreferencias()
  const { opcion, tabla } = useMemo(() => opcionComposicion(v.composicion, v.serie, privado), [v.composicion, v.serie, privado])
  const vacio = v.composicion.puntos.length === 0
  return (
    <Tarjeta className="flex min-w-0 flex-col gap-3.5 p-4 md:p-5" aria-labelledby="composicion-usd">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <Rotulo id="composicion-usd">Composición en dólares · área apilada</Rotulo>
        {!vacio ? (
          <ul aria-label="Referencias del gráfico" className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted">
            {[...v.composicion.clases].reverse().map((c) => (
              <li key={c.clave} className="flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-[2px]" style={{ background: c.color }} />
                {c.nombre}
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="w-3 border-t-2 border-dashed border-text" />
              {v.parametros.vista === 'total' ? 'Neto' : 'Tu financiero'}
            </li>
          </ul>
        ) : null}
      </div>
      {vacio ? (
        <p className="text-sm text-muted">
          <span className="italic">sin dato</span> · {v.estado === 'sin_cargas' ? 'aparece con tu primera carga.' : 'falta una carga en el período.'}
        </p>
      ) : (
        <>
          {/* relative + overflow-hidden: la tabla accesible del gráfico (sr-only) no agranda la página. */}
          <div className="relative min-w-0 overflow-hidden">
            <Grafico opcion={opcion} tabla={tabla} titulo="Composición en dólares de cada carga del período, por clase, con tu patrimonio" alto={{ movil: 200, escritorio: 220 }} />
          </div>
          {v.composicion.puntos.length === 1 ? <p className="text-[13px] text-muted">Un punto: con tu próxima carga empieza el área.</p> : null}
        </>
      )}
    </Tarjeta>
  )
}
