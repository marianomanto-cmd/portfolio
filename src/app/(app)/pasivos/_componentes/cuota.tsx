'use client'

import { useMemo } from 'react'
import { Grafico } from '@/components/graficos/grafico'
import { usePreferencias } from '@/components/preferencias'
import { Rotulo, Tarjeta } from '@/components/ui'
import type { VistaLeasing } from '@/lib/vistas/contratos-pasivos'
import { graficoCuota } from '../_lib/graficos'
import { notaCuota } from '../_lib/pantalla'

// El gráfico principal de Pasivos (handoff, captura 08): la cuota en pesos y
// en dólares, cada una con su eje. La opción la arma graficoCuota y la nota
// notaCuota (puras, con test); acá solo la tarjeta, la leyenda del diseño
// (dos trazos de 12 × 2 px) y la nota de qué es punteado.

function Muestra({ color }: { color: string }) {
  return <span aria-hidden className="inline-block h-0.5 w-3 shrink-0" style={{ background: color }} />
}

export function GraficoCuota({ l }: { l: Pick<VistaLeasing, 'cuotas' | 'hoy' | 'contrato'> }) {
  const { privado } = usePreferencias()
  const g = useMemo(() => graficoCuota(l, privado), [l, privado])
  const nota = useMemo(() => notaCuota(l.cuotas), [l.cuotas])
  const id = `cuota-${l.contrato.id}`
  return (
    <Tarjeta className="flex h-full min-w-0 flex-col gap-3 p-5" aria-labelledby={id}>
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Rotulo id={id}>La cuota en pesos y en dólares</Rotulo>
        <div aria-hidden className="flex flex-wrap items-center gap-3 text-[12px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Muestra color="var(--text)" />
            Pesos
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Muestra color="var(--viz)" />
            Dólares
          </span>
        </div>
      </div>
      <div className="relative min-w-0 overflow-x-clip">
        <Grafico opcion={g.opcion} tabla={g.tabla} alto={{ movil: 200, escritorio: 236 }} titulo="La cuota en pesos y en dólares, cuota por cuota" />
      </div>
      <p className="text-[12px] text-muted">{nota}</p>
    </Tarjeta>
  )
}
