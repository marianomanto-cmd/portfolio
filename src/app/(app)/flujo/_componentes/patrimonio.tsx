'use client'

import { memo, useEffect, useMemo, useState } from 'react'
import { monto } from '@/lib/domain/dinero'
import { diferenciaConLoPuesto } from '@/lib/domain/flujo/panel'
import { nombreMes, trazaMes } from '@/lib/domain/flujo/proyeccion'
import type { BaseProyeccion, Proyeccion, Supuestos } from '@/lib/domain/flujo/tipos'
import { Grafico } from '@/components/graficos/grafico'
import { usePreferencias } from '@/components/preferencias'
import { TrazaDiferida } from '@/components/escenarios/traza-diferida'
import { Traza } from '@/components/traza'
import { SinDato } from '@/components/monto'
import { Rotulo, Tarjeta } from '@/components/ui'
import { opcionPatrimonioUsd, TODO_IGUAL, TRAZO_USD } from '../_lib/graficos'

// "Patrimonio en dólares" (handoff, captura 10), con el escenario elegido en
// la pastilla de arriba (Igual y tus escenarios guardados): el financiero en
// dólares mes a mes, "Todo igual" de referencia y lo que pusiste. Un solo
// camino por escenario (D-144, D-165): el abanico de Monte Carlo del diseño no
// se inventa. Las tres cifras de abajo son las del diseño, con lo que existe:
// el financiero al horizonte (en lugar de la mediana), el rango p5 – p95 "sin
// dato" porque llega con Monte Carlo, y "¿terminás debajo de lo que pusiste?"
// (en lugar de la probabilidad).

export interface OpcionEscenario {
  id: number | 'igual'
  nombre: string
}

/** La pastilla de escenarios (handoff: "Base · Dólar acelera · …"): Igual y los guardados, en 12 px. */
export function SelectorEscenario({
  opciones,
  activo,
  cambios,
  onElegir,
}: {
  opciones: OpcionEscenario[]
  activo: number | 'igual' | null
  /** Moviste barras: lo que se ve no es ninguno de la pastilla tal cual. */
  cambios: boolean
  onElegir: (id: number | 'igual') => void
}) {
  return (
    // A la derecha del rótulo, como en el diseño; si no entra en su renglón, baja y sigue a la derecha.
    <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
      {cambios ? (
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted" data-con-cambios>
          con tus cambios
        </span>
      ) : null}
      <div role="group" aria-label="Escenario" className="flex max-w-full flex-wrap gap-1 rounded-[20px] border border-border p-1">
        {opciones.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={activo === o.id}
            onClick={() => onElegir(o.id)}
            className={`tocable inline-flex min-h-[28px] min-w-0 items-center rounded-full px-3 py-1.5 text-[12px] leading-4 transition-colors ${activo === o.id ? 'bg-surface-3 text-text' : 'text-muted hover:text-text'}`}
            data-escenario={o.id}
          >
            <span className="min-w-0 break-words">{o.nombre}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** La muestra de un trazo de la leyenda, con los mismos guiones que el gráfico. */
function Muestra({ trazo, color }: { trazo: (typeof TRAZO_USD)[keyof typeof TRAZO_USD]; color: string }) {
  return (
    <svg aria-hidden width="18" height="4" className="shrink-0">
      <line x1="0" y1="2" x2="18" y2="2" stroke={color} strokeWidth={Math.min(trazo.ancho, 2.5)} strokeDasharray={trazo.guiones ? trazo.guiones.join(' ') : undefined} />
    </svg>
  )
}

/** La leyenda, en el renglón de "Ver como tabla" (el diseño no la dibuja; acá explica las tres líneas). */
function Leyenda({ nombre, conReferencia }: { nombre: string; conReferencia: boolean }) {
  return (
    <span aria-hidden className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
      <span className="inline-flex items-center gap-1.5">
        <Muestra trazo={TRAZO_USD.escenario} color="var(--viz-strong)" />
        {nombre}
      </span>
      {conReferencia ? (
        <span className="inline-flex items-center gap-1.5">
          <Muestra trazo={TRAZO_USD.igual} color="color-mix(in srgb, var(--text) 60%, transparent)" />
          {TODO_IGUAL}
        </span>
      ) : null}
      <span className="inline-flex items-center gap-1.5">
        <Muestra trazo={TRAZO_USD.puesto} color="var(--text-muted)" />
        Lo que pusiste
      </span>
    </span>
  )
}

/**
 * Memorizada: mientras movés una barra, el render urgente (la barra) no la
 * vuelve a dibujar; se dibuja con cada proyección nueva (el valor diferido).
 */
export const PatrimonioUsd = memo(function PatrimonioUsd({
  base,
  s,
  proy,
  referencia,
  nombre,
  opciones,
  activo,
  cambios,
  onElegir,
}: {
  base: BaseProyeccion
  s: Supuestos
  proy: Proyeccion
  /** La proyección de "Todo igual" (null si el escenario ya es todo Igual). */
  referencia: Proyeccion | null
  /** Cómo se llama el escenario en la leyenda ("Todo igual", «Dólar quieto», "Con tus supuestos"). */
  nombre: string
  opciones: OpcionEscenario[]
  activo: number | 'igual' | null
  cambios: boolean
  onElegir: (id: number | 'igual') => void
}) {
  const { privado } = usePreferencias()
  const lista = proy.estado === 'lista' && proy.meses.length > 0
  const ref = referencia && referencia.estado === 'lista' ? referencia.meses : null
  const g = useMemo(() => (lista ? opcionPatrimonioUsd(proy.meses, { privado, nombre, referencia: ref }) : null), [lista, proy.meses, privado, nombre, ref])
  // El gráfico se pone al día un instante después que las cifras: primero se ve el número nuevo (la lectura y
  // el financiero al horizonte) y enseguida la línea, sin que dibujar el gráfico demore las cifras.
  const [dibujado, setDibujado] = useState(g)
  useEffect(() => setDibujado(g), [g])
  const grafico = dibujado ?? g
  const ultimo = lista ? proy.meses[proy.meses.length - 1] : null
  const dif = useMemo(() => (ultimo ? diferenciaConLoPuesto(ultimo) : null), [ultimo])
  const meses = lista ? proy.meses.length - 1 : (s.horizonte_meses ?? 0)
  const cuando = `${meses} ${meses === 1 ? 'mes' : 'meses'}`
  return (
    <Tarjeta className="flex min-w-0 flex-col gap-3 p-5" aria-labelledby="titulo-patrimonio-usd">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <Rotulo id="titulo-patrimonio-usd">Patrimonio financiero en dólares · {cuando} · un camino</Rotulo>
        <SelectorEscenario opciones={opciones} activo={activo} cambios={cambios} onElegir={onElegir} />
      </div>
      {!lista || !g || !grafico || !ultimo ? (
        <p className="text-[13px] text-muted">
          <span className="italic">sin dato</span> · para proyectar {proy.faltan.length === 1 ? 'falta un dato' : `faltan ${proy.faltan.length} datos`}: {proy.faltan.map((f) => f.texto).join('; ')}.
        </p>
      ) : (
        <>
          <div className="relative min-w-0 overflow-x-clip" data-patrimonio-usd>
            <Grafico
              opcion={grafico.opcion}
              tabla={grafico.tabla}
              alto={{ movil: 200, escritorio: 244 }}
              titulo={`Patrimonio financiero en dólares, mes a mes · ${nombre}`}
              fusionar
              pie={<Leyenda nombre={nombre} conReferencia={ref !== null} />}
            />
          </div>
          <dl className="grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-1">
              <dt className="text-[11px] text-muted">Financiero a {cuando}</dt>
              <dd className="cifra text-[18px] text-viz-strong" data-financiero-horizonte>
                <TrazaDiferida obtener={() => trazaMes(base, s, ultimo.mes, 'financiero', 'USD')} titulo={`Patrimonio financiero de ${nombreMes(ultimo.mes)} · en dólares`} moneda="USD">
                  {ultimo.financiero.usd === null ? <SinDato motivo={ultimo.motivos?.financiero} /> : <span className="monto">{monto(ultimo.financiero.usd, 'USD', { decimales: 0 })}</span>}
                </TrazaDiferida>
              </dd>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <dt className="text-[11px] text-muted">Rango p5 – p95</dt>
              <dd className="text-[13px] leading-snug text-muted">
                <span className="italic">sin dato</span> · llega con Monte Carlo: hoy es un solo camino.
              </dd>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <dt className="text-[11px] text-muted">¿Terminás debajo de lo que pusiste?</dt>
              <dd className="cifra text-[18px]" data-debajo>
                {dif && dif.debajo !== null ? (
                  <span className="inline-flex flex-wrap items-baseline gap-x-2">
                    <span>{dif.debajo ? 'Sí' : 'No'}</span>
                    <Traza calc={dif.usd} titulo={`Patrimonio financiero menos lo que pusiste, a ${nombreMes(ultimo.mes)} · en dólares`} moneda="USD">
                      <span className="num text-[13px] text-muted">
                        {dif.usd.valor === null ? 'sin dato' : <span className="monto">{monto(dif.usd.valor.replace(/^-/, ''), 'USD', { decimales: 0 })}</span>} {dif.debajo ? 'debajo' : 'arriba'}
                      </span>
                    </Traza>
                  </span>
                ) : (
                  <SinDato motivo={dif?.ars.motivo} />
                )}
              </dd>
            </div>
          </dl>
        </>
      )}
    </Tarjeta>
  )
})
