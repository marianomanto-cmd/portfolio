'use client'

import { useMemo, type ReactNode } from 'react'
import { Grafico } from '@/components/graficos/grafico'
import { useMedia, usePreferencias } from '@/components/preferencias'
import type { VistaLeasing } from '@/lib/vistas/contratos-pasivos'
import { graficoApertura, graficoIndexado } from '../_lib/graficos'

/** Cada cuota abierta en sus partes, apiladas. En modo privado, sin montos en el eje ni en la tabla. */
export function GraficoApertura({ leasing }: { leasing: Pick<VistaLeasing, 'cuotas' | 'opcion' | 'tea' | 'hoy'> }) {
  const { privado } = usePreferencias()
  const movil = useMedia('(max-width: 767px)', false)
  const g = useMemo(() => graficoApertura(leasing, privado, movil), [leasing, privado, movil])
  return (
    <Contenedor>
      <Grafico opcion={g.opcion} tabla={g.tabla} alto={{ movil: 220, escritorio: 300 }} titulo="Cada cuota, abierta en sus partes, en pesos" />
    </Contenedor>
  )
}

/**
 * La tabla accesible del gráfico (sr-only) es una <table>: no respeta el ancho
 * de 1 px y, con 36 filas y 8 columnas, ensanchaba la página en el teléfono.
 * Este contenedor la recorta (es absoluta: su bloque contenedor es este) y
 * achica la tabla visible ("Ver como tabla") para que entre desde 768 px.
 */
function Contenedor({ children }: { children: ReactNode }) {
  return <div className="relative min-w-0 overflow-hidden [&_table]:text-xs [&_td]:px-1 [&_th]:px-1">{children}</div>
}

/** La cuota en pesos contra la cuota en dólares, indexadas a 100 (no muestra montos). */
export function GraficoIndexado({ filas }: { filas: VistaLeasing['indexado'] }) {
  const g = useMemo(() => graficoIndexado(filas), [filas])
  return (
    <Contenedor>
      <Grafico opcion={g.opcion} tabla={g.tabla} alto={{ movil: 220, escritorio: 260 }} titulo="La cuota en pesos contra la cuota en dólares, índice 100 en la primera cuota con CCL del pago" />
    </Contenedor>
  )
}
