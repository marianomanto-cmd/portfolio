'use client'

import { Grafico, type PropsGrafico } from '@/components/graficos/grafico'

// El gráfico compartido, dentro de una caja que recorta a lo ancho: la tabla
// accesible de Grafico es `sr-only`, pero una <table> no respeta el ancho de
// 1 px y, en el teléfono, ensanchaba el documento (scroll horizontal, D-30).
// Pedido al lead: arreglarlo en grafico.tsx y sacar este envoltorio.
export function GraficoFlujo(props: PropsGrafico) {
  return (
    <div className="relative min-w-0 overflow-x-clip">
      <Grafico {...props} />
    </div>
  )
}
