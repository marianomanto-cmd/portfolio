'use client'

import { useMemo } from 'react'
import type { PuntoNetoExposicion } from '@/lib/vistas/contratos-exposicion'
import { Grafico } from '@/components/graficos/grafico'
import { Lectura } from '@/components/pantalla/encabezado'
import type { ParteLectura } from '@/components/pantalla/lectura'
import { usePreferencias } from '@/components/preferencias'
import { Rotulo, Tarjeta } from '@/components/ui'
import { opcionNeta } from '../_lib/neta'

// "Exposición neta al peso · 12 meses" (handoff, captura 05): el área del neto
// en pesos bajo la línea punteada del cero. La opción la arma una función pura
// (con el modo privado); el envoltorio compartido le pone el tema.

export function NetaEnElTiempo({ puntos, rotulo, nota }: { puntos: PuntoNetoExposicion[]; rotulo: string; nota: ParteLectura[] }) {
  const { privado } = usePreferencias()
  const { opcion, tabla } = useMemo(() => opcionNeta(puntos, { privado }), [puntos, privado])
  return (
    <Tarjeta className="flex min-w-0 flex-col gap-3.5 p-4 md:p-5" aria-labelledby="neta-tiempo">
      <Rotulo id="neta-tiempo">{rotulo}</Rotulo>
      {puntos.length ? (
        // relative + overflow-hidden: la tabla accesible del gráfico (sr-only) no agranda la página.
        <div className="relative min-w-0 overflow-hidden">
          <Grafico opcion={opcion} tabla={tabla} titulo="Tu exposición neta al peso en cada fecha de carga, en pesos" alto={{ movil: 180, escritorio: 200 }} />
        </div>
      ) : null}
      <p className="text-[13px] leading-relaxed text-muted">
        <Lectura partes={nota} />
      </p>
    </Tarjeta>
  )
}
