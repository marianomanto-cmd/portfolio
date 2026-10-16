import { Fragment } from 'react'
import type { VistaEvolucion } from '@/lib/vistas/contratos-evolucion'
import { MOTIVO_SEGUNDA_CARGA } from '@/lib/domain/resultados'
import { MontoTrazado } from '@/components/monto'
import { Rotulo, Tarjeta } from '@/components/ui'
import { barrasActivoTc, type TramoActivoTc } from '../_lib/activo-tc'

// "Resultado en pesos · activo vs. TC" (handoff, captura 07): por partida, lo
// que hizo el activo (tinta, o sangría si perdió), lo que hizo el CCL (oro) y
// lo que todavía no se puede separar (gris), con el cero común. El monto de la
// derecha abre su traza; el desglose de cada uno, con su traza, está en
// "Resultados por activo y cuenta".

const COLOR: Record<TramoActivoTc['parte'], (t: TramoActivoTc) => string> = {
  activo: (t) => (t.negativo ? 'bg-accent' : 'bg-text'),
  tc: () => 'bg-viz',
  sin_atribuir: () => 'bg-faint',
}

function Muestra({ clase, children }: { clase: string; children: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={`size-2 rounded-[2px] ${clase}`} />
      {children}
    </span>
  )
}

export function ActivoVsTc({ v }: { v: VistaEvolucion }) {
  const { cero, filas, resto, conSinAtribuir, conPerdida } = barrasActivoTc(v.filas)
  return (
    <Tarjeta className="flex min-w-0 flex-col gap-3.5 p-4 md:p-5" aria-labelledby="activo-tc">
      <Rotulo id="activo-tc">Resultado en pesos · activo vs. TC</Rotulo>
      {filas.length === 0 ? (
        <p className="text-sm text-muted">
          <span className="italic">sin dato</span> · {v.estado === 'sin_cargas' ? 'aparece con tu primera carga.' : v.estado === 'un_dia' ? MOTIVO_SEGUNDA_CARGA : 'ninguna partida tuvo resultado en el período.'}
        </p>
      ) : (
        // Una sola grilla para todas las filas: la columna de las barras (y su cero) es la misma en todas.
        <div className="grid grid-cols-[minmax(3rem,max-content)_minmax(0,1fr)_minmax(6rem,max-content)] items-center gap-x-2.5 gap-y-3 text-[12px]">
          {filas.map((f) => {
            // El tramo de afuera de cada lado lleva la punta redondeada.
            const ultimo = (neg: boolean) => f.tramos.reduce((u, t, i) => (t.negativo === neg ? i : u), -1)
            const ultimoPos = ultimo(false)
            const ultimoNeg = ultimo(true)
            return (
              <Fragment key={f.clave}>
                <span className="truncate font-mono" title={f.nombre} data-partida={f.clave}>
                  {f.rotulo}
                </span>
                <div aria-hidden className="relative h-4">
                  <div className="absolute -bottom-1 -top-1 w-px bg-border-strong" style={{ left: `${cero}%` }} />
                  {f.tramos.map((t, i) => (
                    <div
                      key={i}
                      className={`absolute inset-y-0 ${COLOR[t.parte](t)} ${i === ultimoPos ? 'rounded-r-[3px]' : ''} ${i === ultimoNeg ? 'rounded-l-[3px]' : ''}`}
                      style={{ left: `${t.desde}%`, width: `${t.ancho}%` }}
                    />
                  ))}
                </div>
                <span className="text-right">
                  <MontoTrazado calc={f.resultado} moneda="ARS" titulo={`${f.nombre} · resultado del período en pesos`} signo color />
                </span>
              </Fragment>
            )
          })}
        </div>
      )}
      {filas.length ? (
        <div className="flex flex-col gap-1.5 text-[12px] text-muted">
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <Muestra clase="bg-text">Lo que hizo el activo</Muestra>
            <Muestra clase="bg-viz">Lo que hizo el CCL</Muestra>
            {conPerdida ? <Muestra clase="bg-accent">Pérdida del activo</Muestra> : null}
            {conSinAtribuir ? <Muestra clase="bg-faint">Sin atribuir todavía</Muestra> : null}
          </p>
          {resto > 0 ? (
            <a href="#resultados" className="tocable self-start text-[12px] text-muted underline-offset-2 hover:text-text hover:underline">
              {resto === 1 ? 'Una partida más' : `${resto} partidas más`} en Resultados por activo y cuenta ▸
            </a>
          ) : null}
        </div>
      ) : null}
    </Tarjeta>
  )
}
