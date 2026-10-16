import type { CalcVista } from '@/lib/domain/calc'
import type { Par, TarjetaPatrimonio } from '@/lib/vistas/contratos'
import type { BalanceHoy } from '@/lib/vistas/contratos-hoy'
import { parcialDeTotal } from '@/components/calculos'
import { MontoTrazado, Porcentaje } from '@/components/monto'
import { ChipEtiqueta, Rotulo, Tarjeta } from '@/components/ui'
import { tonoDe } from './barras'

// La tarjeta del patrimonio neto (handoff, fila 1 a la derecha; captura 01):
// el neto en pesos (38 px) y en dólares (30 px, en su pastilla), cada uno con
// la variación desde la carga anterior; debajo, de qué está hecho. El handoff
// dice "Activos · Pasivos"; la app parte los activos en lo financiero (lo
// invertible) y los bienes, porque la casa domina la suma y nunca va sola
// (D-03; decisión D-158): financiero + bienes + pasivos = patrimonio neto.

/** La variación de una cifra: el monto con su signo y el porcentaje, en verde o sangría (sin flechas, como en el handoff). */
function Variacion({ monto, pct, moneda, titulo }: { monto: CalcVista | null | undefined; pct: CalcVista | null | undefined; moneda: 'ARS' | 'USD'; titulo: string }) {
  if (!monto) return null
  const tono = tonoDe(monto.valor)
  return (
    <span className={`num inline-flex flex-wrap items-baseline justify-end gap-x-1.5 text-[14px] ${tono}`}>
      <MontoTrazado calc={monto} moneda={moneda} titulo={`${titulo} · variación ${moneda === 'ARS' ? 'en pesos' : 'en dólares'}`} signo decimales={0} className={tono} />
      {pct ? (
        <>
          <span aria-hidden className="text-muted">
            ·
          </span>
          <Porcentaje calc={pct} titulo={`${titulo} · variación % ${moneda === 'ARS' ? 'en pesos' : 'en dólares'}`} />
        </>
      ) : null}
    </span>
  )
}

/**
 * Un total al que le falta una parte es "sin dato", y debajo, en gris, va la
 * suma de lo que sí se conoce, rotulada como parcial (D-65).
 */
export function SumaParcial({ t, className = '' }: { t: TarjetaPatrimonio; className?: string }) {
  const ars = parcialDeTotal(t.valor.ars, 'ARS')
  const usd = parcialDeTotal(t.valor.usd, 'USD')
  if (!ars?.parcial && !usd?.parcial) return null
  const rotulo = (x: { contadas: number; de: number }) => `suma parcial (${x.contadas} de ${x.de}): `
  const misma = ars && usd && ars.contadas === usd.contadas && ars.de === usd.de
  return (
    <p className={`flex flex-wrap items-baseline gap-x-1.5 text-[13px] leading-6 text-muted ${className}`}>
      {ars?.parcial ? (
        <span className="inline-flex items-baseline gap-1.5">
          {rotulo(ars)}
          <MontoTrazado calc={ars.parcial} moneda="ARS" titulo={`${t.titulo} · suma parcial en pesos`} decimales={0} />
        </span>
      ) : null}
      {usd?.parcial ? (
        <span className="inline-flex items-baseline gap-1.5">
          {ars?.parcial ? '·' : null} {misma ? null : rotulo(usd)}
          <MontoTrazado calc={usd.parcial} moneda="USD" titulo={`${t.titulo} · suma parcial en dólares`} decimales={0} />
        </span>
      ) : null}
    </p>
  )
}

/** Una de las partes de abajo: rótulo de 13 px y el par en mono, los dólares en su pastilla. */
function Parte({ rotulo, par, titulo, deuda = false }: { rotulo: string; par: Par; titulo: string; deuda?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <span className="flex flex-wrap items-center gap-1.5 text-muted">
        {rotulo}
        <ChipEtiqueta calc={par.ars} omitir={['parcial']} />
      </span>
      <MontoTrazado calc={par.ars} moneda="ARS" titulo={`${titulo} · en pesos`} decimales={0} className={deuda ? 'text-accent-glow' : ''} />
      <MontoTrazado calc={par.usd} moneda="USD" titulo={`${titulo} · en dólares`} decimales={0} className="text-[12px]" />
    </div>
  )
}

/** El patrimonio neto, desde 768 px: la tarjeta de la fila 1 del handoff. */
export function PatrimonioNeto({ total, financiero, balance }: { total: TarjetaPatrimonio; financiero: TarjetaPatrimonio; balance: BalanceHoy | null | undefined }) {
  const t = 'Patrimonio neto'
  return (
    <Tarjeta aria-label={t} className="flex min-w-0 flex-col gap-[18px] p-6">
      <div className="flex items-start justify-between gap-2">
        <Rotulo>Patrimonio neto</Rotulo>
        <ChipEtiqueta calc={total.valor.ars} omitir={['parcial']} />
      </div>
      {/* Con lugar (el ancho del handoff), la variación va a la derecha de cada cifra; si no entra, debajo. */}
      <div className="@container flex flex-col gap-2.5">
        <div className="flex flex-col items-start gap-1 @min-[500px]:flex-row @min-[500px]:flex-wrap @min-[500px]:items-baseline @min-[500px]:justify-between @min-[500px]:gap-x-3">
          <MontoTrazado calc={total.valor.ars} moneda="ARS" titulo={`${t} · en pesos`} decimales={0} className="cifra text-[clamp(28px,2.6vw,38px)] leading-[1.15]" />
          <Variacion monto={total.variacion?.ars} pct={total.variacion_pct?.ars} moneda="ARS" titulo={t} />
        </div>
        <div className="flex flex-col items-start gap-1 @min-[500px]:flex-row @min-[500px]:flex-wrap @min-[500px]:items-baseline @min-[500px]:justify-between @min-[500px]:gap-x-3">
          <MontoTrazado calc={total.valor.usd} moneda="USD" titulo={`${t} · en dólares`} decimales={0} className="cifra rounded-lg! px-2.5! text-[clamp(22px,2vw,30px)] leading-[1.25]" />
          <Variacion monto={total.variacion?.usd} pct={total.variacion_pct?.usd} moneda="USD" titulo={t} />
        </div>
        <SumaParcial t={total} />
      </div>
      <div aria-hidden className="h-px bg-border" />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(118px,1fr))] gap-3 text-[13px]">
        <Parte rotulo="Financiero" par={financiero.valor} titulo="Patrimonio financiero" />
        {balance ? <Parte rotulo="Bienes" par={balance.bienes} titulo="Bienes" /> : null}
        {balance ? <Parte rotulo="Pasivos" par={balance.pasivos} titulo="Pasivos" deuda /> : null}
      </div>
    </Tarjeta>
  )
}

/** Un renglón del patrimonio en el teléfono: el monto y su variación %, cada uno tocable (44 px). */
function Renglon({ rotulo, valor, pct, moneda, titulo }: { rotulo: string | null; valor: CalcVista; pct: CalcVista | null | undefined; moneda: 'ARS' | 'USD'; titulo: string }) {
  return (
    <>
      <span className="rotulo self-center text-[10px]">{rotulo}</span>
      <MontoTrazado
        calc={valor}
        moneda={moneda}
        titulo={`${titulo} · ${moneda === 'ARS' ? 'en pesos' : 'en dólares'}`}
        decimales={0}
        className={moneda === 'ARS' ? 'text-[16px] font-medium' : 'text-[14px]'}
      />
      <span className={`flex justify-end text-[13px] ${tonoDe(pct?.valor ?? null, 4)}`}>
        {pct ? <Porcentaje calc={pct} titulo={`${titulo} · variación % ${moneda === 'ARS' ? 'en pesos' : 'en dólares'}`} /> : null}
      </span>
    </>
  )
}

/**
 * En el teléfono (el handoff no lo diseña): el patrimonio neto y lo
 * financiero en una sola tarjeta de cuatro renglones de 44 px, para que Hoy
 * entre arriba del pliegue (visión §4.1).
 */
export function PatrimonioCompacto({ total, financiero }: { total: TarjetaPatrimonio; financiero: TarjetaPatrimonio }) {
  return (
    <Tarjeta aria-label="Patrimonio neto y financiero" className="px-3 py-1.5">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 [&>*:nth-child(3n+2)]:justify-self-end">
        <Renglon rotulo="Patrimonio neto" valor={total.valor.ars} pct={total.variacion_pct?.ars} moneda="ARS" titulo="Patrimonio neto" />
        <Renglon rotulo={null} valor={total.valor.usd} pct={total.variacion_pct?.usd} moneda="USD" titulo="Patrimonio neto" />
        <Renglon rotulo="Financiero" valor={financiero.valor.ars} pct={financiero.variacion_pct?.ars} moneda="ARS" titulo="Patrimonio financiero" />
        <Renglon rotulo={null} valor={financiero.valor.usd} pct={financiero.variacion_pct?.usd} moneda="USD" titulo="Patrimonio financiero" />
      </div>
      <SumaParcial t={total} className="justify-end pb-1" />
    </Tarjeta>
  )
}
