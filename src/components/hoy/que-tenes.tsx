import type { ReactNode } from 'react'
import type { CalcVista } from '@/lib/domain/calc'
import { porcentaje } from '@/lib/domain/dinero'
import { TINTA_SOBRE_SEGMENTO } from '@/lib/domain/colores'
import type { Par, TarjetaPatrimonio } from '@/lib/vistas/contratos'
import { pesoEn } from '@/lib/vistas/armar-hoy'
import type { BalanceHoy, TramoHoy } from '@/lib/vistas/contratos-hoy'
import { MontoTrazado } from '@/components/monto'
import { LinkTarjeta, Rotulo, Tarjeta } from '@/components/ui'
import { anchoTramo } from './barras'

// "Qué tenés y qué debés" (handoff, fila 4; capturas 01 y 02): tres barras en
// la misma escala (el activo total = 100%). Activos, un tramo por partida en
// el color de cada activo (el mismo en todos los gráficos, D-157), con su
// ticker adentro; pasivos, en sangría suave con borde sangría; y el neto, un
// rectángulo punteado. A la derecha, cada total en pesos y en dólares, con
// su traza.

const pctTexto = (peso: string | null) => (peso === null ? null : porcentaje(peso, { decimales: 1 }))

/**
 * El rótulo va adentro solo si entra entero en su tramo: cada tramo es su
 * propio contenedor y el rótulo aparece desde el ancho que necesita (mono 10
 * px: unos 6 px por letra, más el margen). Si no entra, queda en el título del
 * tramo y en la descripción de la barra. Las clases van escritas enteras para
 * que Tailwind las genere.
 */
const DESDE: Record<number, string> = {
  1: '@min-[20px]:inline',
  2: '@min-[26px]:inline',
  3: '@min-[32px]:inline',
  4: '@min-[38px]:inline',
  5: '@min-[44px]:inline',
  6: '@min-[50px]:inline',
  7: '@min-[56px]:inline',
  8: '@min-[62px]:inline',
  9: '@min-[68px]:inline',
  10: '@min-[74px]:inline',
  11: '@min-[80px]:inline',
  12: '@min-[86px]:inline',
}

function RotuloTramo({ texto }: { texto: string }) {
  const corto = texto.length > 12 ? `${texto.slice(0, 11)}…` : texto
  return <span className={`hidden ${DESDE[Math.max(1, corto.length)]}`}>{corto}</span>
}

function Montos({ par, titulo, deuda = false }: { par: Par; titulo: string; deuda?: boolean }) {
  return (
    <span className="flex min-w-0 flex-wrap items-baseline justify-end gap-x-2 gap-y-0.5 text-right">
      <MontoTrazado calc={par.ars} moneda="ARS" titulo={`${titulo} · en pesos`} decimales={0} className={deuda ? 'text-accent-glow' : ''} />
      <MontoTrazado calc={par.usd} moneda="USD" titulo={`${titulo} · en dólares`} decimales={0} className="text-[12px]" />
    </span>
  )
}

function Tramos({ tramos, rotulo, deuda = false }: { tramos: TramoHoy[]; rotulo: string; deuda?: boolean }) {
  const dibujables = tramos.map((t) => ({ t, ancho: anchoTramo(t.peso) })).filter((x) => x.ancho !== null)
  const etiqueta = `${rotulo}: ${dibujables.map(({ t }) => `${t.nombre} ${pctTexto(t.peso)}`).join(', ') || 'sin dato'}`
  return (
    <span role="img" aria-label={etiqueta} className="flex h-7 min-w-0 gap-0.5 overflow-hidden rounded-[6px]">
      {dibujables.map(({ t, ancho }) =>
        deuda ? (
          <span
            key={t.clave}
            title={`${t.nombre} · ${pctTexto(t.peso)} del activo`}
            className="@container flex h-full min-w-0 items-center overflow-hidden whitespace-nowrap rounded-[6px] border border-border-accent bg-accent-soft pl-2 font-mono text-[10px] text-accent-glow"
            style={{ width: ancho ?? undefined }}
          >
            <RotuloTramo texto={t.rotulo} />
          </span>
        ) : (
          <span
            key={t.clave}
            title={`${t.nombre} · ${pctTexto(t.peso)}`}
            className="@container flex h-full min-w-0 items-center overflow-hidden whitespace-nowrap pl-2 font-mono text-[10px]"
            style={{ width: ancho ?? undefined, background: t.color, color: TINTA_SOBRE_SEGMENTO }}
          >
            <RotuloTramo texto={t.rotulo} />
          </span>
        ),
      )}
    </span>
  )
}

function Fila({ rotulo, barra, montos, fuerte = false }: { rotulo: string; barra: ReactNode; montos: ReactNode; fuerte?: boolean }) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-2 md:grid-cols-[90px_minmax(0,1fr)_minmax(150px,auto)]">
      <span className={`text-[13px] ${fuerte ? 'text-text' : 'text-muted'}`}>{rotulo}</span>
      <span className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:row-start-auto">{barra}</span>
      <span className="col-start-2 row-start-1 min-w-0 md:col-start-auto md:row-start-auto">{montos}</span>
    </div>
  )
}

export function QueTenes({ balance, total }: { balance: BalanceHoy; total: TarjetaPatrimonio }) {
  const fNeto = pesoEn(total.valor.ars.valor, balance.activos.ars.valor)
  const anchoNeto = anchoTramo(fNeto)
  const neto: CalcVista = total.valor.ars
  return (
    <Tarjeta aria-label="Qué tenés y qué debés" className="flex min-w-0 flex-col gap-4 p-5">
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Rotulo>Qué tenés y qué debés</Rotulo>
        <LinkTarjeta href="/cartera">Ver posiciones</LinkTarjeta>
      </div>
      <div className="flex min-w-0 flex-col gap-2.5">
        <Fila rotulo="Activos" barra={<Tramos tramos={balance.tramos_activos} rotulo="Activos" />} montos={<Montos par={balance.activos} titulo="Activos" />} />
        <Fila rotulo="Pasivos" barra={<Tramos tramos={balance.tramos_pasivos} rotulo="Pasivos" deuda />} montos={<Montos par={balance.pasivos} titulo="Pasivos" deuda />} />
        <Fila
          rotulo="Neto"
          fuerte
          barra={
            <span role="img" aria-label={`Neto: ${pctTexto(fNeto) ?? 'sin dato'} del activo`} className="flex h-7 min-w-0">
              {anchoNeto ? <span className="h-full rounded-[6px] border border-dashed border-border-strong" style={{ width: anchoNeto }} /> : null}
            </span>
          }
          montos={<Montos par={total.valor} titulo="Patrimonio neto" />}
        />
      </div>
      {total.notas.length || neto.valor === null ? (
        <ul className="flex flex-col gap-1 text-[12px] leading-relaxed text-muted">
          {total.notas.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
    </Tarjeta>
  )
}
