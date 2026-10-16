'use client'

import { useMemo } from 'react'
import type { SeriePatrimonio } from '@/lib/vistas/contratos-hoy'
import { Grafico } from '@/components/graficos/grafico'
import { Porcentaje } from '@/components/monto'
import { Traza } from '@/components/traza'
import { usePreferencias } from '@/components/preferencias'
import { LinkTarjeta, Rotulo, Tarjeta } from '@/components/ui'
import { partesSerie, tonoDe } from './barras'
import { ALTO_EJE, ALTO_MINI, ALTO_TOTAL, opcionPatrimonio, rotuloSerie, SEPARACION, tablaPatrimonio } from './graficos'

// "Patrimonio neto · 12 meses" (handoff, fila 3; captura 01): dos gráficos
// chicos, en dólares y en pesos, con el mismo eje de fechas; a la izquierda,
// cuánto cambió cada uno en el período (con su traza). Un punto por fecha de
// carga. El modo privado tapa los montos del tooltip y de la tabla; los
// porcentajes quedan.

function Rotulos({ s }: { s: SeriePatrimonio }) {
  const fila = (nombre: string, calc: SeriePatrimonio['variacion']['ars'], titulo: string) => (
    <div className="flex flex-col justify-center gap-0.5" style={{ height: ALTO_MINI }}>
      <span className="text-[12px] text-muted">{nombre}</span>
      <span className={`text-[13px] ${tonoDe(calc.valor, 4)}`}>
        <Porcentaje calc={calc} titulo={titulo} />
      </span>
    </div>
  )
  return (
    <div className="flex flex-col" style={{ gap: SEPARACION, paddingBottom: ALTO_EJE }}>
      {fila('En dólares', s.variacion.usd, 'Patrimonio neto · variación en dólares en el período')}
      {fila('En pesos', s.variacion.ars, 'Patrimonio neto · variación en pesos en el período')}
    </div>
  )
}

export function TarjetaSerie({ s }: { s: SeriePatrimonio }) {
  const { privado } = usePreferencias()
  const opcion = useMemo(() => opcionPatrimonio(s, { privado }), [s, privado])
  const tabla = useMemo(() => tablaPatrimonio(s, { privado }), [s, privado])
  const frase = partesSerie(s)
  const rotulo = rotuloSerie(s)
  return (
    <Tarjeta aria-label="Patrimonio neto en el tiempo" className="flex min-w-0 flex-col gap-4 p-5">
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Rotulo>{rotulo}</Rotulo>
        <LinkTarjeta href="/evolucion">Ver resultados</LinkTarjeta>
      </div>
      {s.puntos.length === 0 ? (
        <p className="text-[13px] text-muted">
          <span className="italic">sin dato</span> · {s.motivo ?? 'Aparece con tu primera carga.'}
        </p>
      ) : (
        <>
          <div className="grid min-w-0 grid-cols-[90px_minmax(0,1fr)] gap-x-3.5">
            <Rotulos s={s} />
            {/* relative + overflow-hidden: la tabla accesible del gráfico (sr-only) no agranda la página. */}
            <div className="relative min-w-0 overflow-hidden">
              <Grafico opcion={opcion} tabla={tabla} titulo={`${rotulo}: en dólares y en pesos, por fecha de carga`} alto={{ movil: ALTO_TOTAL, escritorio: ALTO_TOTAL }} />
            </div>
          </div>
          {s.puntos.length === 1 ? <p className="text-[13px] text-muted">Con tu próxima carga empieza la curva: por ahora es un punto.</p> : null}
          {frase ? (
            <p className="text-[13px] leading-relaxed text-muted">
              {/* Cada cifra del pie abre su traza (los porcentajes y el CCL no se tapan en el modo privado: no son montos). */}
              {frase.map((x, i) =>
                x.calc ? (
                  <Traza key={i} calc={x.calc} titulo={x.titulo ?? x.texto}>
                    <span className="num">{x.texto}</span>
                  </Traza>
                ) : (
                  <span key={i}>{x.texto}</span>
                ),
              )}
            </p>
          ) : null}
        </>
      )}
    </Tarjeta>
  )
}
