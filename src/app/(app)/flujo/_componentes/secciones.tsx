// Las partes de Flujo que no dependen de un escenario (plan §6 D.1 bloques 1 y
// 2): el mes en curso con los datos de hoy (con Cargar ingreso y Cargar
// gasto, D-166), el calendario de la plata que ya se sabe y lo que falta
// cargar. Sin estado: sirven en el servidor. Cada cifra viene armada (con su
// traza) desde armar-flujo.ts. Proyectado contra real, con su Grilla, está en
// real.tsx.

import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { NOMBRE_ETIQUETA, type CalcVista, type Etiqueta } from '@/lib/domain/calc'
import { fechaCorta } from '@/lib/domain/fechas'
import type { FilaCalendario, MesActual, MesCalendario, VistaFlujo } from '@/lib/vistas/contratos-flujo'
import { MontoTrazado, TextoConMontos } from '@/components/monto'
import { Boton, Chip, ChipEtiqueta, ParMonto, Rotulo, Tarjeta } from '@/components/ui'

const nombreChip = (c: string) => NOMBRE_ETIQUETA[c as Etiqueta] ?? c

/**
 * La frase del mes se lee de corrido (los montos, tapados en el modo privado);
 * cada cifra abre su traza en el detalle de abajo (en el teléfono, una cifra
 * tocable de 44 px en medio del texto lo volvía ilegible).
 */
function Frase({ partes }: { partes: MesActual['partes'] }) {
  return (
    <p className="text-[15px] leading-relaxed text-text">
      {partes.map((p, i) =>
        p.calc ? (
          <span key={i} className="num font-medium">
            <TextoConMontos texto={p.texto} />
          </span>
        ) : (
          <span key={i}>{p.texto}</span>
        ),
      )}
    </p>
  )
}

/** Cargar ingreso y Cargar gasto: van en el mes en curso, que es donde se usan (D-166). */
export function AccionesCargar() {
  return (
    <div className="flex flex-wrap gap-2">
      <Boton href="/flujo/cargar?sentido=ingreso" variante="contorno" tam="sm">
        <ArrowDownCircle aria-hidden className="size-4" /> Cargar ingreso
      </Boton>
      <Boton href="/flujo/cargar?sentido=gasto" variante="contorno" tam="sm">
        <ArrowUpCircle aria-hidden className="size-4" /> Cargar gasto
      </Boton>
    </div>
  )
}

export function SeccionMes({
  m,
  pagador,
  datos,
}: {
  m: MesActual
  pagador: VistaFlujo['pagador_declarado']
  /** Con qué datos se armaron el mes y la cascada de arriba: la fecha de tu última carga, el CCL y el cripto. */
  datos?: { fecha: string | null; ccl: CalcVista; cripto: CalcVista }
}) {
  return (
    <Tarjeta className="flex min-w-0 flex-col gap-3 p-5" aria-labelledby="titulo-mes">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Rotulo as="h2">
            <span id="titulo-mes">{m.nombre}, con los datos de hoy</span>
          </Rotulo>
          {m.reales.ingresos ? <Chip>ingreso cargado</Chip> : <Chip>declarado</Chip>}
        </div>
        <AccionesCargar />
      </div>
      {datos?.fecha ? (
        <p className="flex flex-wrap items-baseline gap-x-1.5 text-[12px] text-muted" data-datos-mes>
          <span>Con lo declarado y tu carga del {fechaCorta(datos.fecha)}: CCL</span>
          <MontoTrazado calc={datos.ccl} moneda="ARS" titulo="CCL de tu última carga" decimales={2} />
          <span>· cripto</span>
          <MontoTrazado calc={datos.cripto} moneda="ARS" titulo="Dólar cripto de tu última carga" decimales={2} />
          <span>. Es la cascada de arriba: no depende de tus supuestos.</span>
        </p>
      ) : null}
      <Frase partes={m.partes} />
      <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        {(
          [
            ['Ingresos', m.ingresos, false],
            ['Gastos fijos', m.gastos, true],
            ['Cuota del leasing', m.cuota, true],
          ] as const
        ).map(([t, par, resta]) => (
          <div key={t} className="flex flex-wrap items-baseline justify-between gap-x-2 sm:block">
            <dt className="text-muted">
              {t}
              {resta ? ' (sale)' : ''} <ChipEtiqueta calc={par.ars} omitir={['declarado']} />
            </dt>
            <dd>
              <ParMonto par={par} titulo={`${t} de ${m.nombre}`} />
            </dd>
          </div>
        ))}
      </dl>
      <div className="border-t border-border pt-3">
        <div className="min-w-0">
          <p className="text-xs text-muted" data-excedente-mes>
            Excedente invertible de {m.nombre.toLowerCase()} <ChipEtiqueta calc={m.excedente.ars} omitir={['declarado']} />
          </p>
          <div className="cifra mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[22px]">
            <MontoTrazado calc={m.excedente.ars} moneda="ARS" titulo={`Excedente de ${m.nombre} · en pesos`} />
            <span className="num text-[14px]">
              <MontoTrazado calc={m.excedente.usd} moneda="USD" titulo={`Excedente de ${m.nombre} · en dólares`} />
            </span>
          </div>
          {m.excedente.ars.valor === null ? <p className="mt-1 text-sm text-muted">{m.excedente.ars.motivo}</p> : null}
        </div>
      </div>
      {m.cuotas.some((c) => c.quien === null) ? (
        <p className="text-sm text-muted">¿Quién paga la cuota del leasing? Elegilo en tus supuestos (Vos · La empresa): hasta entonces, el excedente es sin dato.</p>
      ) : pagador === 'empresa' ? (
        <p className="text-sm text-muted">La cuota la paga la empresa: no resta de tu excedente.</p>
      ) : null}
      {m.vencimientos.length ? (
        <ul className="space-y-1 text-sm text-muted">
          {m.vencimientos.map((v) => (
            <li key={`${v.ticker}-${v.fecha}`} className="flex flex-wrap items-baseline gap-x-2">
              <span>
                Vence {v.ticker} el {v.fecha.slice(8, 10)}/{v.fecha.slice(5, 7)}: cobrás
              </span>
              <ParMonto par={v.valor} titulo={`Vencimiento de ${v.ticker}`} />
            </li>
          ))}
        </ul>
      ) : null}
    </Tarjeta>
  )
}

function FilaCal({ f }: { f: FilaCalendario }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 py-1.5">
      <div className="min-w-0">
        <p className="text-sm text-text">{f.nombre}</p>
        <p className="text-xs text-muted">
          {[f.tipo === 'ingreso' ? 'entra' : f.tipo === 'vencimiento' ? 'cobrás' : 'sale', f.detalle].filter(Boolean).join(' · ')}
          {f.chips.filter((c) => c !== 'declarado').length ? ' ' : null}
          {f.chips
            .filter((c) => c !== 'declarado')
            .slice(0, 1)
            .map((c) => (
              <Chip key={c} className="ml-1">
                {nombreChip(c)}
              </Chip>
            ))}
        </p>
        {f.cargar_pago ? (
          <a href={`#pago-${f.cargar_pago.ticker}`} className="tocable mt-0.5 inline-flex min-h-9 items-center text-sm font-medium text-accent hover:underline">
            Cargar el pago al vencimiento de {f.cargar_pago.ticker}
          </a>
        ) : null}
      </div>
      <ParMonto par={f.valor} titulo={f.nombre} signo vertical className="text-sm" />
    </li>
  )
}

function MesCal({ m, className = '' }: { m: MesCalendario; className?: string }) {
  return (
    <li className={`min-w-0 rounded-item border border-border bg-surface-2 p-3 ${className}`} data-calendario={m.mes}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-text">{m.nombre}</h3>
        <span className="text-xs text-muted">{m.filas.length === 0 ? 'nada que ya se sepa' : m.filas.length === 1 ? '1 movimiento' : `${m.filas.length} movimientos`}</span>
      </div>
      <ul className="mt-1 divide-y divide-border">
        {m.filas.map((f, i) => (
          <FilaCal key={i} f={f} />
        ))}
      </ul>
      <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 border-t border-border pt-1.5">
        <p className="text-sm font-medium text-text">
          Neto del mes <ChipEtiqueta calc={m.neto.ars} omitir={['declarado']} />
        </p>
        <ParMonto par={m.neto} titulo={`Neto de ${m.nombre}`} signo vertical className="text-sm font-medium" />
      </div>
    </li>
  )
}

export function SeccionCalendario({ meses }: { meses: MesCalendario[] }) {
  // En el teléfono se ve el primer mes y el resto se despliega; desde 768 px, dos.
  const primeros = meses.slice(0, 2)
  const resto = meses.slice(2)
  return (
    <Tarjeta className="p-5" aria-labelledby="titulo-calendario">
      <Rotulo id="titulo-calendario">El calendario de la plata</Rotulo>
      <p className="mt-1 text-[13px] text-muted">Lo que ya se sabe de los próximos {meses.length} meses, sin supuestos: lo declarado, las cuotas del leasing y lo que vence. El neto no cuenta lo que vence (eso se reinvierte con tu regla).</p>
      <ul className="mt-3 grid gap-2 md:grid-cols-2">
        {primeros.map((m, i) => (
          <MesCal key={m.mes} m={m} className={i > 0 ? 'hidden md:block' : ''} />
        ))}
      </ul>
      {meses.length > 1 ? (
        <details className={`mt-2 ${resto.length ? '' : 'md:hidden'}`}>
          <summary className="tocable inline-flex min-h-10 cursor-pointer items-center text-[13px] text-muted hover:text-text">Ver los {meses.length} meses ▸</summary>
          <ul className="mt-2 grid gap-2 md:grid-cols-2">
            {primeros.slice(1).map((m) => (
              <MesCal key={m.mes} m={m} className="md:hidden" />
            ))}
            {resto.map((m) => (
              <MesCal key={m.mes} m={m} />
            ))}
          </ul>
        </details>
      ) : null}
    </Tarjeta>
  )
}

export function FaltanDatos({ items }: { items: VistaFlujo['faltan_datos'] }) {
  if (!items.length) return null
  return (
    <Tarjeta className="border-border-strong bg-surface-2 p-5" aria-labelledby="titulo-faltan">
      <h2 id="titulo-faltan" className="text-[14px] font-medium text-text">
        {items.length === 1 ? 'Falta un dato' : `Faltan ${items.length} datos`}
      </h2>
      <ul className="mt-1 space-y-1 text-sm text-text">
        {items.map((f) => (
          <li key={f.texto} className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="min-w-0">{f.texto}</span>
            {f.href && f.etiqueta ? (
              <a href={f.href} className="tocable inline-flex min-h-9 items-center font-medium text-accent hover:underline">
                {f.etiqueta}
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </Tarjeta>
  )
}
