import { CircleAlert, Info } from 'lucide-react'
import Link from 'next/link'
import type { Pendiente } from '@/lib/vistas/contratos'
import type { EventoProximo } from '@/lib/vistas/contratos-hoy'
import { MontoTrazado } from '@/components/monto'
import { Rotulo, Tarjeta } from '@/components/ui'

// "Próximos 30 días" (handoff, fila 3 a la derecha; captura 01): lo que pasa
// con fecha (la carga de hoy que falta, las cuotas del leasing, lo que cobrás
// de tus bonos y letras y el cierre del mes), cada renglón con su bloque de
// fecha. Debajo, Atención: lo que le falta a tus datos (sin fecha), de lo más
// grave a lo más leve, plegado después de los primeros. Una cuota vencida o
// un vencimiento a menos de 15 días van en sangría clara.

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

function BloqueFecha({ fecha }: { fecha: string }) {
  return (
    <span className="flex h-11 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-surface-2" aria-hidden>
      <span className="font-mono text-[15px] leading-none">{Number(fecha.slice(8, 10))}</span>
      <span className="mt-1 font-mono text-[9px] leading-none tracking-[0.12em] text-muted">{MESES[Number(fecha.slice(5, 7)) - 1]}</span>
    </span>
  )
}

function Evento({ e }: { e: EventoProximo }) {
  const fechaLegible = `${Number(e.fecha.slice(8, 10))}/${e.fecha.slice(5, 7)}`
  return (
    // En el teléfono, la carga que falta ya está arriba, en su propio botón: acá no se repite.
    <li className={`grid grid-cols-[48px_minmax(0,1fr)] gap-3 border-t border-border py-2.5 ${e.tipo === 'carga' ? 'max-md:hidden' : ''}`}>
      <BloqueFecha fecha={e.fecha} />
      <div className="flex min-w-0 flex-col justify-center gap-1">
        <span className="text-[14px] leading-snug">
          <span className="sr-only">{fechaLegible}: </span>
          {e.href && e.tipo !== 'cierre' ? (
            <Link href={e.href} className="tocable inline-flex items-center underline-offset-2 hover:underline">
              {e.titulo}
            </Link>
          ) : (
            e.titulo
          )}
        </span>
        <span className={`flex flex-wrap items-baseline gap-x-1.5 text-[12px] leading-snug ${e.alerta ? 'text-accent-glow' : 'text-muted'}`}>
          {e.tipo === 'cierre' ? (
            <>
              {e.detalle}:{' '}
              <Link href="/flujo/cargar?sentido=ingreso" className="tocable font-medium text-text underline-offset-2 hover:underline">
                ingreso
              </Link>
              ·
              <Link href="/flujo/cargar?sentido=gasto" className="tocable font-medium text-text underline-offset-2 hover:underline">
                gasto
              </Link>
            </>
          ) : (
            <span>{e.detalle}</span>
          )}
          {e.valor ? (
            <>
              <MontoTrazado calc={e.valor.ars} moneda="ARS" titulo={`${e.titulo} · en pesos`} decimales={0} className="text-text" />
              <MontoTrazado calc={e.valor.usd} moneda="USD" titulo={`${e.titulo} · en dólares`} decimales={0} />
            </>
          ) : null}
        </span>
      </div>
    </li>
  )
}

export function ItemPendiente({ p }: { p: Pendiente }) {
  const Icono = p.gravedad === 'alta' ? CircleAlert : Info
  return (
    <li className="flex items-start gap-3 py-3">
      <Icono aria-hidden className={`mt-0.5 size-4 shrink-0 ${p.gravedad === 'alta' ? 'text-accent' : 'text-muted'}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{p.titulo}</p>
        <p className="text-[13px] leading-5 text-muted">{p.detalle}</p>
      </div>
      {p.accion ? (
        <Link
          href={p.accion.href}
          className="tocable inline-flex h-8 shrink-0 items-center rounded-full border border-border px-3 text-[12px] font-medium text-text transition-colors hover:border-border-strong"
        >
          {p.accion.etiqueta}
        </Link>
      ) : null}
    </li>
  )
}

/** Atención, plegada: "3 pendientes de datos ▸". Abierta, de lo más grave a lo más leve. */
export function Atencion({ pendientes, className = '' }: { pendientes: Pendiente[]; className?: string }) {
  if (!pendientes.length) return null
  const altas = pendientes.filter((p) => p.gravedad === 'alta').length
  return (
    <details className={`group border-t border-border ${className}`} open={altas > 0 ? true : undefined}>
      <summary className="tocable flex cursor-pointer list-none items-center justify-between gap-2 py-2.5 text-[14px]">
        <span>
          <span className="font-medium">Atención</span>
          <span className="text-muted">
            {' '}
            · {pendientes.length} pendiente{pendientes.length > 1 ? 's' : ''} de datos
          </span>
        </span>
        <span aria-hidden className="text-muted transition-transform group-open:rotate-90">
          ▸
        </span>
      </summary>
      <ul className="divide-y divide-border">
        {pendientes.map((p) => (
          <ItemPendiente key={p.id} p={p} />
        ))}
      </ul>
    </details>
  )
}

export function TarjetaProximos({ eventos, pendientes }: { eventos: EventoProximo[]; pendientes: Pendiente[] }) {
  return (
    <Tarjeta aria-label="Próximos 30 días" className="flex min-w-0 flex-col gap-3 p-5">
      <Rotulo>Próximos 30 días</Rotulo>
      {eventos.length ? (
        <ul className="flex flex-col">
          {eventos.map((e) => (
            <Evento key={e.id} e={e} />
          ))}
        </ul>
      ) : (
        <p className="border-t border-border pt-2.5 text-[13px] text-muted">Nada con fecha en los próximos 30 días.</p>
      )}
      {pendientes.length ? (
        <Atencion pendientes={pendientes} className="hidden md:block" />
      ) : (
        <p className="hidden border-t border-border pt-2.5 text-[13px] text-muted md:block">Tus datos están completos. Nada que revisar.</p>
      )}
    </Tarjeta>
  )
}
