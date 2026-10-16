import type { ReactNode } from 'react'
import type { CalcVista } from '@/lib/domain/calc'
import { porcentaje } from '@/lib/domain/dinero'
import type { FraseDelDia } from '@/lib/vistas/contratos'
import type { CclPeriodo } from '@/lib/vistas/contratos-hoy'
import { Monto } from '@/components/monto'
import { Traza } from '@/components/traza'
import { Rotulo, Tarjeta } from '@/components/ui'
import { barraVariacion, tonoDe } from './barras'
import type { Mostrar } from './redondeo-frase'

// "Variación del día · de dónde vino" (handoff, fila 2; captura 01): lo que
// cambió lo invertible desde la carga anterior, partido en lo que pusieron tus
// activos y lo que puso el CCL (D-35), con lo sin atribuir si hay. La barra va
// en pesos (tinta para los activos, oro para el CCL); cada parte, en pesos y
// en dólares, abre su traza. Las partes se redondean juntas (Mostrar): lo que
// se ve suma exacto lo que se ve.

const COLOR = { activos: 'var(--text)', tc: 'var(--viz)', sin_atribuir: 'var(--text-faint)' }

function Fila({
  color,
  rotulo,
  ars,
  usd,
  m,
  titulo,
}: {
  color: string
  rotulo: ReactNode
  ars: CalcVista
  usd: CalcVista
  m: Mostrar
  titulo: string
}) {
  const parte = (c: CalcVista, moneda: 'ARS' | 'USD') => {
    const v = m.valor(c)
    const tono = tonoDe(v)
    return (
      <Traza calc={c} titulo={`${titulo} · ${moneda === 'ARS' ? 'en pesos' : 'en dólares'}`} moneda={moneda}>
        <Monto valor={v} moneda={moneda} decimales={0} signo className={tono} />
      </Traza>
    )
  }
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
      <span className="flex min-w-0 items-center gap-2">
        <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ background: color }} />
        {rotulo}
      </span>
      <span className="flex items-baseline gap-2">
        {parte(ars, 'ARS')}
        {parte(usd, 'USD')}
      </span>
    </div>
  )
}

export function TarjetaVariacion({ frase, ccl, m }: { frase: FraseDelDia | null; ccl: CclPeriodo | null | undefined; m: Mostrar }) {
  const tramos = frase ? barraVariacion(m.valor(frase.activos.ars), m.valor(frase.tc.ars), frase.sin_atribuir ? m.valor(frase.sin_atribuir.ars) : '0') : []
  const cclPct = ccl?.variacion.valor ?? null
  return (
    <Tarjeta aria-label="Variación del día" className="flex min-w-0 flex-col gap-3.5 p-5">
      <Rotulo>Variación del día · de dónde vino</Rotulo>
      {!frase ? (
        <p className="text-[13px] text-muted">Con tu segunda carga vas a ver qué cambió y por qué.</p>
      ) : (
        <>
          <Traza calc={frase.variacion.ars} titulo="Variación de lo invertible · en pesos" moneda="ARS" className="w-full [&>button]:w-full">
            <span role="img" aria-label="La variación de lo invertible, partida en tus activos y el CCL" className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
              {tramos.map((t) => (
                <span key={t.clave} className="h-full" style={{ width: t.ancho, background: t.negativo && t.clave === 'activos' ? 'var(--accent)' : COLOR[t.clave] }} />
              ))}
            </span>
          </Traza>
          <div className="flex flex-col gap-2 text-[13px]">
            <Fila color={COLOR.activos} rotulo="De tus activos" ars={frase.activos.ars} usd={frase.activos.usd} m={m} titulo="Lo que pusieron tus activos" />
            <Fila
              color={COLOR.tc}
              rotulo={
                <span>
                  Del CCL
                  {cclPct !== null ? (
                    <>
                      {' '}
                      (
                      <Traza calc={ccl!.variacion} titulo="Cuánto cambió el CCL">
                        <span className="num">{porcentaje(cclPct, { signo: true })}</span>
                      </Traza>
                      )
                    </>
                  ) : null}
                </span>
              }
              ars={frase.tc.ars}
              usd={frase.tc.usd}
              m={m}
              titulo="Lo que puso el CCL"
            />
            {frase.sin_atribuir ? (
              <Fila color={COLOR.sin_atribuir} rotulo="Sin atribuir" ars={frase.sin_atribuir.ars} usd={frase.sin_atribuir.usd} m={m} titulo="Sin atribuir (sin precio o saldo nuevo)" />
            ) : null}
          </div>
        </>
      )}
    </Tarjeta>
  )
}
