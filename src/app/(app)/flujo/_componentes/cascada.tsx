'use client'

import { memo, useMemo, type CSSProperties } from 'react'
import type { MesActual } from '@/lib/vistas/contratos-flujo'
import { Grafico } from '@/components/graficos/grafico'
import { usePreferencias } from '@/components/preferencias'
import { Traza } from '@/components/traza'
import { Rotulo, Tarjeta } from '@/components/ui'
import { cascada } from '../_lib/cascada'
import { ALTO_NOMBRES, FRANJA_NOMBRES, opcionCascada } from '../_lib/graficos'

// La cascada del mes (handoff, captura 10: "Octubre · de ingreso a
// excedente"): del ingreso en dólares vendido al cripto, más los pesos fijos,
// menos los gastos fijos y la cuota, al excedente. Con lo declarado y tu
// última carga: no depende de los supuestos (con qué datos se armó lo dice
// "El mes en curso", en el detalle). El monto va arriba de cada barra (lo
// dibuja ECharts); el nombre, abajo, en la franja que el gráfico deja libre
// debajo del cero, y cada nombre abre la traza de su cifra.

const ALTO = { movil: 210, escritorio: 230 }

/** Memorizada: no depende de los supuestos, así que mover una barra no la vuelve a dibujar. */
export const CascadaMes = memo(function CascadaMes({ mes }: { mes: MesActual | null }) {
  const { privado } = usePreferencias()
  const c = useMemo(() => (mes ? cascada(mes) : null), [mes])
  const g = useMemo(() => (c?.barras ? opcionCascada(c.barras, privado) : null), [c, privado])
  const titulo = mes ? `${mes.nombre} · de ingreso a excedente` : 'Este mes · de ingreso a excedente'
  return (
    <Tarjeta className="flex min-w-0 flex-col gap-3 p-5" aria-labelledby="titulo-cascada">
      <Rotulo id="titulo-cascada">{titulo}</Rotulo>
      {!mes ? (
        <p className="text-[13px] text-muted">
          <span className="italic">sin dato</span> · todavía no hay cargas: con la primera, ves cuánto te sobra por mes.
        </p>
      ) : c && c.barras && g ? (
        <div className="relative min-w-0 overflow-x-clip" data-cascada>
          <Grafico opcion={g.opcion} tabla={g.tabla} alto={ALTO} titulo={`${mes.nombre}: de ingreso a excedente, en pesos`} />
          {/* Los nombres, debajo del cero y alineados con sus barras (11 px, como en el diseño): cada uno abre su traza.
              La franja termina 8 px antes que el gráfico: "Ver como tabla" va debajo y no se tocan. */}
          <ul
            data-pasos-cascada
            className="absolute inset-x-0 top-[var(--arriba-movil)] grid items-start gap-1 text-center text-[11px] leading-[13px] text-muted md:top-[var(--arriba-escritorio)]"
            style={
              {
                gridTemplateColumns: `repeat(${c.barras.length}, minmax(0, 1fr))`,
                height: FRANJA_NOMBRES.alto,
                '--arriba-movil': `${ALTO.movil - ALTO_NOMBRES + FRANJA_NOMBRES.arriba}px`,
                '--arriba-escritorio': `${ALTO.escritorio - ALTO_NOMBRES + FRANJA_NOMBRES.arriba}px`,
              } as CSSProperties
            }
          >
            {c.barras.map((b) => (
              <li key={b.clave} className="flex min-w-0 justify-center">
                <Traza calc={b.par.ars} titulo={`${b.nombre} de ${mes.nombre.toLowerCase()} · en pesos`} moneda="ARS">
                  <span className={`block break-words text-center ${b.clave === 'excedente' ? 'font-medium text-text' : ''}`}>{b.nombre}</span>
                </Traza>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[13px] text-muted">
          <span className="italic">sin dato</span> · {c?.motivo ?? 'falta un dato del mes.'}
        </p>
      )}
    </Tarjeta>
  )
})
