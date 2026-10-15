// Las partes de Flujo que no dependen de un escenario (plan §6 D.1 bloques 1 y
// 2, D.9): el mes en curso con los datos de hoy, el calendario de la plata que
// ya se sabe y lo proyectado contra lo real de cada mes. Sin estado: sirven en
// el servidor. Cada cifra viene armada (con su traza) desde armar-flujo.ts.

import Link from 'next/link'
import { NOMBRE_ETIQUETA, type Etiqueta } from '@/lib/domain/calc'
import type { FilaCalendario, MesActual, MesCalendario, MesCerrado, VistaFlujo } from '@/lib/vistas/contratos-flujo'
import { MontoTrazado, TextoConMontos } from '@/components/monto'
import { Chip, ChipEtiqueta, ParMonto, Rotulo, Tarjeta } from '@/components/ui'

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

export function SeccionMes({ m, pagador }: { m: MesActual; pagador: VistaFlujo['pagador_declarado'] }) {
  return (
    <Tarjeta className="p-4" aria-labelledby="titulo-mes">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Rotulo as="h2">
          <span id="titulo-mes">{m.nombre}, con los datos de hoy</span>
        </Rotulo>
        <span className="flex flex-wrap gap-1">
          {m.reales.ingresos ? <Chip>ingreso cargado</Chip> : <Chip>declarado</Chip>}
        </span>
      </div>
      <div className="mt-2">
        <Frase partes={m.partes} />
      </div>
      <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
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
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-border pt-3">
        <div className="min-w-0">
          <p className="text-xs text-muted" data-excedente-mes>
            Excedente invertible de {m.nombre.toLowerCase()} <ChipEtiqueta calc={m.excedente.ars} omitir={['declarado']} />
          </p>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-2xl font-semibold">
            <MontoTrazado calc={m.excedente.ars} moneda="ARS" titulo={`Excedente de ${m.nombre} · en pesos`} />
            <span className="text-lg font-medium">
              <MontoTrazado calc={m.excedente.usd} moneda="USD" titulo={`Excedente de ${m.nombre} · en dólares`} />
            </span>
          </div>
          {m.excedente.ars.valor === null ? <p className="mt-1 text-sm text-muted">{m.excedente.ars.motivo}</p> : null}
        </div>
        <Link href="/flujo/cargar?sentido=ingreso" className="tocable inline-flex min-h-10 items-center justify-center rounded-lg border border-accent/40 bg-accent-soft px-3 text-sm font-medium text-accent hover:border-accent">
          Cargar lo que entró
        </Link>
      </div>
      {m.cuotas.some((c) => c.quien === null) ? (
        <p className="mt-2 text-sm text-muted">¿Quién paga la cuota del leasing? Elegilo en tus supuestos (Vos · La empresa): hasta entonces, el excedente es sin dato.</p>
      ) : pagador === 'empresa' ? (
        <p className="mt-2 text-sm text-muted">La cuota la paga la empresa: no resta de tu excedente.</p>
      ) : null}
      {m.vencimientos.length ? (
        <ul className="mt-2 space-y-1 text-sm text-muted">
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
    <li className={`min-w-0 rounded-lg border border-border p-3 ${className}`} data-calendario={m.mes}>
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
    <Tarjeta className="p-4" aria-labelledby="titulo-calendario">
      <h2 id="titulo-calendario" className="text-base font-semibold text-text">
        El calendario de la plata
      </h2>
      <p className="mt-0.5 text-xs text-muted">Lo que ya se sabe de los próximos {meses.length} meses, sin supuestos: lo declarado, las cuotas del leasing y lo que vence. El neto no cuenta lo que vence (eso se reinvierte con tu regla).</p>
      <ul className="mt-3 grid gap-2 md:grid-cols-2">
        {primeros.map((m, i) => (
          <MesCal key={m.mes} m={m} className={i > 0 ? 'hidden md:block' : ''} />
        ))}
      </ul>
      {meses.length > 1 ? (
        <details className={`mt-2 ${resto.length ? '' : 'md:hidden'}`}>
          <summary className="tocable inline-flex min-h-10 cursor-pointer items-center text-sm font-medium text-accent">Ver los {meses.length} meses</summary>
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

export function SeccionRealContraProyectado({ meses }: { meses: MesCerrado[] }) {
  return (
    <div id="real-contra-proyectado" className="scroll-mt-4">
    <Tarjeta className="p-4" aria-labelledby="titulo-real">
      <h2 id="titulo-real" className="text-base font-semibold text-text">
        Proyectado contra real
      </h2>
      <p className="mt-0.5 text-xs text-muted">
        Cada mes nace proyectado con lo que declaraste y se vuelve real con lo que cargás (Cargar ingreso, las cuotas pagadas, tus cargas). Los gastos reales son sin dato salvo los que cargás. Lo extraordinario va aparte: no cambia lo recurrente.
      </p>
      {meses.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Todavía no hay meses con datos para comparar.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {meses.map((m) => (
            <section key={m.mes} aria-label={`${m.nombre}: proyectado contra real`} className="rounded-lg border border-border p-3" data-real={m.mes}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-text">{m.nombre}</h3>
                <Chip>{m.estado === 'en_curso' ? 'en curso' : 'cerrado'}</Chip>
              </div>
              {/* Teléfono: una tarjeta por línea. */}
              <ul className="mt-2 space-y-2 md:hidden">
                {m.filas.map((f) => (
                  <li key={f.linea} className="rounded-md bg-surface-2 p-2 text-sm" data-linea={f.linea}>
                    <p className="font-medium text-text">{f.nombre}</p>
                    <dl className="mt-1 space-y-1">
                      {(
                        [
                          ['Proyectado', f.proyectado],
                          ['Real', f.real],
                          ['Desvío', f.desvio],
                        ] as const
                      ).map(([t, p]) => (
                        <div key={t} className="flex flex-wrap items-baseline justify-between gap-x-2">
                          <dt className="text-muted">{t}</dt>
                          <dd>
                            <ParMonto par={p} titulo={`${f.nombre} de ${m.nombre} · ${t.toLowerCase()}`} signo={t === 'Desvío'} />
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                ))}
              </ul>
              {/* Desde 768 px, la tabla. */}
              <table className="mt-2 hidden w-full table-fixed text-sm md:table">
                <caption className="sr-only">{m.nombre}: proyectado, real y desvío por línea</caption>
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th scope="col" className="w-1/4 py-1 font-medium">
                      Línea
                    </th>
                    <th scope="col" className="py-1 text-right font-medium">
                      Proyectado
                    </th>
                    <th scope="col" className="py-1 text-right font-medium">
                      Real
                    </th>
                    <th scope="col" className="py-1 text-right font-medium">
                      Desvío
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {m.filas.map((f) => (
                    <tr key={f.linea} className="border-t border-border align-top" data-linea={f.linea}>
                      <th scope="row" className="py-1.5 pr-2 text-left font-normal text-text">
                        {f.nombre}
                      </th>
                      <td className="py-1.5 text-right">
                        <ParMonto par={f.proyectado} titulo={`${f.nombre} de ${m.nombre} · proyectado`} vertical />
                      </td>
                      <td className="py-1.5 text-right">
                        <ParMonto par={f.real} titulo={`${f.nombre} de ${m.nombre} · real`} vertical />
                      </td>
                      <td className="py-1.5 text-right">
                        <ParMonto par={f.desvio} titulo={`${f.nombre} de ${m.nombre} · desvío`} signo vertical />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </Tarjeta>
    </div>
  )
}

export function FaltanDatos({ items }: { items: VistaFlujo['faltan_datos'] }) {
  if (!items.length) return null
  return (
    <Tarjeta className="border-warn/40 bg-warn-soft p-4" aria-labelledby="titulo-faltan">
      <h2 id="titulo-faltan" className="text-sm font-semibold text-text">
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
