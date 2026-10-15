import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { CalcVista } from '@/lib/domain/calc'
import { numero, porcentaje } from '@/lib/domain/dinero'
import type { FilaPasivo, SegmentoBalance, VistaBalance } from '@/lib/vistas/contratos-balance'
import { SinDato, TextoConMontos } from '@/components/monto'
import { Traza } from '@/components/traza'
import { Chip, ChipEtiqueta, Rotulo, Tarjeta } from '@/components/ui'
import { Cifra, ParCifra } from './cifra'

// Las tres tarjetas de arriba: la cifra grande (el patrimonio neto, con su
// perímetro y su versión firme), el activo con sus tramos y el pasivo con el
// origen de cada deuda. Sin cuentas en el JSX: todo llega armado y trazado.

export function Accion({ accion }: { accion: { etiqueta: string; href: string } | null }) {
  if (!accion) return null
  return (
    <Link href={accion.href} className="tocable inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline print:hidden">
      {accion.etiqueta} <ArrowRight aria-hidden className="size-4" />
    </Link>
  )
}

/** Un porcentaje ya redondeado (resto mayor) con la traza del exacto. */
export function Pct({ pct, calc, titulo }: { pct: string | null; calc: CalcVista; titulo: string }) {
  return (
    <Traza calc={calc} titulo={titulo}>
      {calc.valor === null ? <SinDato motivo={calc.motivo} /> : <span className="num">{pct === null ? porcentaje(calc.valor, { decimales: 1 }) : `${numero(pct, 1)}%`}</span>}
    </Traza>
  )
}

export function Titular({ v }: { v: VistaBalance }) {
  const t = v.titular
  return (
    <Tarjeta className="p-4 md:p-5" aria-labelledby="titular-balance" data-tarjeta="titular">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Rotulo as="h2" className="min-w-0">
          <span id="titular-balance">{t.rotulo}</span>
        </Rotulo>
        {t.chips.map((c) => (
          <Chip key={c}>{c}</Chip>
        ))}
      </div>
      <div className="mt-2 flex flex-col items-start gap-1">
        <Cifra calc={t.valor.ars} moneda="ARS" titulo={t.rotulo} className="cifra text-[28px] font-semibold leading-tight md:text-[32px]" />
        <Cifra calc={t.valor.usd} moneda="USD" titulo={`${t.rotulo} · en dólares`} decimales={0} className="text-base" />
      </div>
      {t.firme ? (
        <div className="mt-3 border-t border-border pt-3" data-firme>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
            {t.firme.rotulo}
            {t.firme.chips.map((c) => (
              <Chip key={c}>{c}</Chip>
            ))}
          </p>
          <p className="mt-0.5 text-[12px] text-muted">Firme: no usa ningún estimado.</p>
          <ParCifra par={t.firme.valor} titulo={t.firme.rotulo} className="mt-1" claseArs="text-lg font-semibold" />
        </div>
      ) : null}
      {!t.firme && !t.parcial && v.pasivo.filas.length > 0 ? (
        // Con la deuda informada no hay "lo firme" que mostrar: va la cuenta del balance, activo − pasivo.
        <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1 border-t border-border pt-3 text-sm" data-ecuacion>
          <dt className="text-muted">Activo</dt>
          <dd className="flex min-w-0 justify-end">
            <ParCifra par={v.activo.total} titulo="Activo total" className="justify-end" />
          </dd>
          <dt className="text-muted">− Pasivo</dt>
          <dd className="flex min-w-0 justify-end">
            <ParCifra par={v.pasivo.total} titulo="Pasivo total" className="justify-end" />
          </dd>
        </dl>
      ) : null}
      {t.nota ? (
        <p className="mt-3 text-[13px] leading-5 text-muted">
          <TextoConMontos texto={t.nota} />
        </p>
      ) : null}
      <div className="mt-2">
        <Accion accion={t.accion} />
      </div>
    </Tarjeta>
  )
}

/** Barra horizontal 100% apilada (sin tortas): cada tramo con su ancho exacto. */
export function BarraTramos({ titulo, tramos }: { titulo: string; tramos: SegmentoBalance[] }) {
  const dibujables = tramos.filter((s) => s.ancho !== null)
  if (dibujables.length === 0) return null
  return (
    <div aria-hidden className="flex h-3 w-full gap-[2px] overflow-hidden rounded" title={titulo}>
      {dibujables.map((s) => (
        <div key={s.clave} className="h-full min-w-[3px] first:rounded-l last:rounded-r print:border print:border-black" style={{ width: s.ancho ?? undefined, background: s.color }} />
      ))}
    </div>
  )
}

export function TarjetaActivo({ v }: { v: VistaBalance }) {
  const a = v.activo
  return (
    <Tarjeta className="p-4 md:p-5" aria-labelledby="activo-balance" data-tarjeta="activo">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Rotulo as="h2">
          <span id="activo-balance">Activo</span>
        </Rotulo>
        {a.total_chips.map((c) => (
          <Chip key={c}>{c}</Chip>
        ))}
      </div>
      <ParCifra par={a.total} titulo="Activo total" className="mt-2" claseArs="cifra text-2xl font-semibold" />
      <p className="mt-1 text-[12px] text-muted">Todo lo que tenés, sin restar deudas.</p>
      <div className="mt-3">
        <BarraTramos titulo="Financiero y bienes" tramos={a.tramos} />
      </div>
      <ul className="mt-2 divide-y divide-border">
        {a.tramos.map((s) => (
          <li key={s.clave} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-1.5 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
              <span className="truncate">{s.nombre}</span>
              {/* Sin el activo total no hay porcentaje: el total ya dice "sin dato" y por qué. */}
              {s.peso.valor === null ? null : (
                <span className="text-muted">
                  <Pct pct={s.pct} calc={s.peso} titulo={`${s.nombre}: parte del activo`} />
                </span>
              )}
            </span>
            <ParCifra par={s.valor} titulo={s.nombre} className="justify-end" />
          </li>
        ))}
      </ul>
    </Tarjeta>
  )
}

function Referencia({ f }: { f: FilaPasivo }) {
  return (
    <div className="mt-3 rounded-lg bg-surface-2 px-3 py-2" data-referencia>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-medium">
        Lo que falta pagar según contrato
        {f.referencia ? <ChipEtiqueta calc={f.referencia.valor.ars} /> : null}
      </p>
      {f.referencia ? (
        <>
          <ParCifra par={f.referencia.valor} titulo="Lo que falta pagar según contrato" className="mt-0.5" />
          <p className="mt-0.5 text-[12px] text-muted">
            <TextoConMontos texto={f.referencia.nota} />
          </p>
        </>
      ) : (
        <p className="mt-0.5 text-[13px] text-muted">
          Aparece cuando importes el cuadro de marcha en Datos › Leasing.
        </p>
      )}
      <p className="mt-1 text-[12px] text-muted">No es la deuda: incluye intereses, IVA y seguro. Nunca se resta.</p>
    </div>
  )
}

export function TarjetaPasivo({ v }: { v: VistaBalance }) {
  const p = v.pasivo
  return (
    <Tarjeta className="p-4 md:p-5" aria-labelledby="pasivo-balance" data-tarjeta="pasivo">
      <Rotulo as="h2">
        <span id="pasivo-balance">Pasivo</span>
      </Rotulo>
      {p.filas.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No tenés deudas cargadas. Si tenés un leasing o un préstamo, cargalo en Datos › Leasing.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-4">
          {p.filas.map((f) => (
            <li key={f.clave}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-medium">{f.nombre}</span>
                <ChipEtiqueta calc={f.valor.ars} omitir={['parcial']} />
                {f.chips.map((c) => (
                  <Chip key={c}>{c}</Chip>
                ))}
              </div>
              <ParCifra par={f.valor} titulo={f.nombre} className="mt-1" claseArs="cifra text-xl font-semibold" />
              <p className="mt-0.5 text-[13px] text-muted">{f.detalle}</p>
              {/* La fuente llega de los datos y puede traer montos (la cuenta del estimado): el modo privado los tapa. */}
              {f.fuente ? (
                <p className="mt-0.5 text-[12px] text-muted">
                  Cómo: <TextoConMontos texto={f.fuente} />
                </p>
              ) : null}
              <div className="mt-1">
                <Accion accion={f.accion} />
              </div>
              {f.bien ? <Referencia f={f} /> : null}
            </li>
          ))}
        </ul>
      )}
      {p.filas.length > 1 ? (
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-2 text-sm font-medium">
          <span>Total del pasivo</span>
          <ParCifra par={p.total} titulo="Pasivo total" />
        </div>
      ) : null}
    </Tarjeta>
  )
}
