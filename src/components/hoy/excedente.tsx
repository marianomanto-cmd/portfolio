import Link from 'next/link'
import type { ExcedenteHoy } from '@/lib/vistas/contexto-hoy'
import { MontoTrazado, SinDato } from '@/components/monto'
import { Traza } from '@/components/traza'
import { ChipEtiqueta, Rotulo, Tarjeta } from '@/components/ui'
import { barraExcedente, notaExcedente } from './barras'

// "Excedente invertible · <mes>" (handoff, fila 2; captura 01): lo que te
// queda este mes con lo que declaraste en Flujo (ingresos − gastos fijos −
// cuota del leasing que pagás vos), en pesos y en dólares, con la barra de
// sus partes: gastos fijos (superficie), cuota (sangría) y lo que sobra
// (verde). Es la misma cifra que arriba de Flujo y escenarios.

export function TarjetaExcedente({ x }: { x: ExcedenteHoy | null }) {
  const mes = x?.mes ?? 'del mes'
  const titulo = x ? `Excedente de ${x.mes}` : 'Excedente del mes'
  const barra = x ? barraExcedente(x.ingresos?.ars.valor ?? null, x.gastos?.ars.valor ?? null, x.cuota?.ars.valor ?? null) : null
  return (
    <Tarjeta aria-label="Excedente invertible" className="flex min-w-0 flex-col gap-3.5 p-5">
      <Rotulo>Excedente invertible · {mes}</Rotulo>
      {x ? (
        <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <MontoTrazado calc={x.valor.ars} moneda="ARS" titulo={`${titulo} · en pesos`} decimales={0} className="cifra text-[26px] leading-tight" />
          <MontoTrazado calc={x.valor.usd} moneda="USD" titulo={`${titulo} · en dólares`} decimales={0} className="text-[14px]" />
        </span>
      ) : (
        <span className="text-[26px] leading-tight">
          <SinDato motivo="Todavía no hay cargas." />
        </span>
      )}
      {barra && x ? (
        <Traza calc={x.valor.ars} titulo={`${titulo} · en pesos`} moneda="ARS" className="w-full [&>button]:w-full">
          <span role="img" aria-label={barra.falta ? 'Gastos fijos y cuota: pasan a los ingresos' : 'Gastos fijos, cuota y lo que sobra'} className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
            <span className="h-full bg-surface-3" style={{ width: barra.gastos }} />
            <span className="h-full bg-accent" style={{ width: barra.cuota }} />
            {barra.falta ? null : <span className="h-full bg-positive" style={{ width: barra.sobrante }} />}
          </span>
        </Traza>
      ) : (
        <span aria-hidden className="block h-3 rounded-full bg-surface-3" />
      )}
      <p className="text-[13px] leading-relaxed text-muted">
        {barra?.falta ? 'Gastos fijos · cuota: este mes pasan a los ingresos. ' : 'Gastos fijos · cuota · lo que sobra. '}
        {x && x.valor.ars.valor !== null ? notaExcedente(x.reales) : x ? `${x.valor.ars.motivo ?? 'Falta un dato.'}` : 'Aparece con tu primera carga.'}{' '}
        {x ? (
          <>
            <ChipEtiqueta calc={x.valor.ars} omitir={['parcial']} />{' '}
          </>
        ) : null}
        <Link href={x?.href ?? '/flujo'} className="tocable inline-flex items-center font-medium text-text underline-offset-2 hover:underline">
          Ver flujo →
        </Link>
      </p>
    </Tarjeta>
  )
}
