import type { ReactNode } from 'react'
import type { CalcVista } from '@/lib/domain/calc'
import { fechaLarga } from '@/lib/domain/fechas'
import type { FilaBalance, FilaPasivo, LineaNeto, VistaBalance } from '@/lib/vistas/contratos-balance'
import { TextoConMontos } from '@/components/monto'
import { Chip, ChipEtiqueta, Rotulo, Tarjeta } from '@/components/ui'
import { Cifra, ParCifra } from './cifra'
import { filasEstado } from '../../_lib/balance/estado'
import { GrillaEstado } from './grilla-estado'
import { Plegable } from './plegable'
import { Accion, Pct } from './tarjetas'

// El estado de situación patrimonial: ACTIVO (lo financiero agrupado y los
// bienes), PASIVO (cada deuda con su origen) y PATRIMONIO NETO, cada renglón
// en pesos, en dólares y en % del activo. Desde 768 px es la Grilla
// (grilla-estado.tsx, D-157); al imprimir, la tabla de acá (D-158); en el
// teléfono, tarjetas que se pliegan, nunca una tabla.

const POR: Record<VistaBalance['agrupar'], string> = { cuenta: 'por cuenta', instrumento: 'por instrumento', clase: 'por clase' }

function Chips({ calc, chips, sinViejo = false }: { calc: CalcVista; chips: string[]; sinViejo?: boolean }) {
  return (
    <>
      <ChipEtiqueta calc={calc} omitir={sinViejo ? ['viejo', 'parcial'] : ['parcial']} />
      {chips.map((c) => (
        <Chip key={c}>{c}</Chip>
      ))}
    </>
  )
}

// ───────────── Tabla (desde 768 px y al imprimir) ─────────────

function Celdas({ valor, peso, pct, titulo, fuerte = false }: { valor: { ars: CalcVista; usd: CalcVista }; peso: CalcVista; pct: string | null; titulo: string; fuerte?: boolean }) {
  const f = fuerte ? 'font-semibold' : ''
  return (
    <>
      <td className={`whitespace-nowrap px-2 py-1.5 text-right align-top ${f}`}>
        <Cifra calc={valor.ars} moneda="ARS" titulo={`${titulo} · en pesos`} />
      </td>
      <td className={`whitespace-nowrap px-2 py-1.5 text-right align-top ${f}`}>
        <Cifra calc={valor.usd} moneda="USD" titulo={`${titulo} · en dólares`} decimales={0} />
      </td>
      <td className={`whitespace-nowrap py-1.5 pl-2 pr-3 text-right align-top text-muted ${f}`}>
        <Pct pct={pct} calc={peso} titulo={`${titulo}: parte del activo`} />
      </td>
    </>
  )
}

function Seccion({ nombre }: { nombre: string }) {
  return (
    <tr className="sin-corte">
      <th colSpan={4} scope="colgroup" className="bg-surface-2 px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        {nombre}
      </th>
    </tr>
  )
}

function FilaPartida({ f, nivel, conCuenta = false }: { f: FilaBalance; nivel: 1 | 2; conCuenta?: boolean }) {
  return (
    <tr className="sin-corte border-t border-border/60">
      <th scope="row" className={`py-1.5 pr-2 text-left align-top font-normal ${nivel === 2 ? 'pl-10' : 'pl-6'}`}>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span aria-hidden className="size-2 shrink-0 rounded-sm" style={{ background: f.color }} />
          <span className="text-sm">{f.nombre}</span>
          <Chips calc={f.valor.ars} chips={f.chips} sinViejo />
        </span>
        <span className="block text-[12px] leading-4 text-muted">
          <TextoConMontos texto={f.detalle} />
          {conCuenta && f.cuenta ? ` · ${f.cuenta}` : null}
        </span>
        {f.accion ? (
          <span className="mt-0.5 block">
            <Accion accion={f.accion} />
          </span>
        ) : null}
      </th>
      <Celdas valor={f.valor} peso={f.peso} pct={f.pct} titulo={f.nombre} />
    </tr>
  )
}

function FilaTotal({ nombre, detalle, valor, peso, pct, nivel, fuerte = true, borde = true, extra }: { nombre: string; detalle?: string; valor: { ars: CalcVista; usd: CalcVista }; peso: CalcVista; pct: string | null; nivel: 0 | 1; fuerte?: boolean; borde?: boolean; extra?: ReactNode }) {
  return (
    <tr className={`sin-corte ${borde ? 'border-t border-border' : ''}`}>
      <th scope="row" className={`py-1.5 pr-2 text-left align-top ${nivel === 1 ? 'pl-6' : 'pl-3'} ${fuerte ? 'font-semibold' : 'font-medium'}`}>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm">{nombre}</span>
          <ChipEtiqueta calc={valor.ars} />
          {extra}
        </span>
        {detalle ? <span className="block text-[12px] font-normal leading-4 text-muted">{detalle}</span> : null}
      </th>
      <Celdas valor={valor} peso={peso} pct={pct} titulo={nombre} fuerte={fuerte} />
    </tr>
  )
}

function FilaDeuda({ f }: { f: FilaPasivo }) {
  return (
    <tr className="sin-corte border-t border-border/60">
      <th scope="row" className="py-1.5 pl-6 pr-2 text-left align-top font-normal">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm">{f.nombre}</span>
          <Chips calc={f.valor.ars} chips={f.chips} />
        </span>
        <span className="block text-[12px] leading-4 text-muted">
          <TextoConMontos texto={f.detalle} />
          {f.bien ? ` · financia ${f.bien.toLowerCase()}` : ''}
        </span>
        {f.accion ? (
          <span className="mt-0.5 block">
            <Accion accion={f.accion} />
          </span>
        ) : null}
      </th>
      <Celdas valor={f.valor} peso={f.peso} pct={f.pct} titulo={f.nombre} />
    </tr>
  )
}

function FilaReferencia({ f }: { f: FilaPasivo }) {
  return (
    <tr className="sin-corte">
      <th scope="row" className="py-1 pl-10 pr-2 text-left align-top text-[12px] font-normal text-muted">
        Lo que falta pagar según contrato: {f.referencia ? <TextoConMontos texto={f.referencia.nota} /> : 'aparece cuando importes el cuadro de marcha'} · no es la deuda (incluye intereses, IVA y seguro) y no se resta
        {f.referencia ? (
          <span className="ml-2 inline-flex align-middle">
            <ChipEtiqueta calc={f.referencia.valor.ars} />
          </span>
        ) : null}
      </th>
      {f.referencia ? (
        <>
          <td className="whitespace-nowrap px-2 py-1 text-right align-top text-[13px] text-muted">
            <Cifra calc={f.referencia.valor.ars} moneda="ARS" titulo="Lo que falta pagar según contrato · en pesos" />
          </td>
          <td className="whitespace-nowrap px-2 py-1 text-right align-top text-[13px] text-muted">
            <Cifra calc={f.referencia.valor.usd} moneda="USD" titulo="Lo que falta pagar según contrato · en dólares" decimales={0} />
          </td>
          <td />
        </>
      ) : (
        <td colSpan={3} />
      )}
    </tr>
  )
}

function FilaNeto({ l }: { l: LineaNeto }) {
  return (
    <FilaTotal
      nombre={l.nombre}
      detalle={l.detalle}
      valor={l.valor}
      peso={l.peso}
      pct={l.pct}
      nivel={l.principal ? 0 : 1}
      fuerte={l.principal}
      borde={l.principal}
    />
  )
}

export function TablaEstado({ v }: { v: VistaBalance }) {
  const a = v.activo
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">Estado de situación patrimonial al {v.fecha ? fechaLarga(v.fecha) : '—'}, en pesos, en dólares y en % del activo</caption>
      <thead>
        <tr className="border-b border-border text-[12px] text-muted">
          <th scope="col" className="px-3 py-2 text-left font-medium">
            Partida
          </th>
          <th scope="col" className="px-2 py-2 text-right font-medium">
            En pesos
          </th>
          <th scope="col" className="px-2 py-2 text-right font-medium">
            En dólares
          </th>
          <th scope="col" className="py-2 pl-2 pr-3 text-right font-medium">
            % del activo
          </th>
        </tr>
      </thead>
      <tbody>
        <Seccion nombre="Activo" />
        <FilaTotal nombre="Financiero" detalle={`títulos y liquidez de tus cuentas, ${POR[v.agrupar]}`} valor={a.financiero} peso={a.financiero_peso} pct={a.financiero_pct} nivel={0} borde={false} />
        {a.grupos.map((g) => (
          <GrupoTabla key={g.clave} g={g} plano={g.filas.length === 1 && v.agrupar !== 'cuenta'} conCuenta={v.agrupar !== 'cuenta'} />
        ))}
        {a.bienes.length ? (
          <>
            <FilaTotal nombre="Bienes" detalle="cada uno a su última valuación, con su fuente" valor={a.bienes_total} peso={a.bienes_peso} pct={a.bienes_pct} nivel={0} />
            {a.bienes.map((b) => (
              <FilaPartida key={b.clave} f={b} nivel={1} />
            ))}
          </>
        ) : (
          <tr className="border-t border-border">
            <th scope="row" colSpan={4} className="py-1.5 pl-3 text-left text-sm font-normal text-muted">
              Bienes: todavía no cargaste la casa ni el auto. <Accion accion={{ etiqueta: 'Cargar tus bienes', href: '/datos/bienes' }} />
            </th>
          </tr>
        )}
        <FilaTotal nombre="Total del activo" valor={a.total} peso={a.total_peso} pct={a.total_pct} nivel={0} />

        <Seccion nombre="Pasivo" />
        {v.pasivo.filas.length === 0 ? (
          <tr>
            <th scope="row" colSpan={4} className="py-1.5 pl-6 text-left text-sm font-normal text-muted">
              Sin deudas cargadas.
            </th>
          </tr>
        ) : (
          v.pasivo.filas.map((f) => (
            <Deuda key={f.clave} f={f} />
          ))
        )}
        <FilaTotal nombre="Total del pasivo" valor={v.pasivo.total} peso={v.pasivo.peso} pct={v.pasivo.pct} nivel={0} />

        <Seccion nombre="Patrimonio neto" />
        {v.neto.lineas.map((l) => (
          <FilaNeto key={l.clave} l={l} />
        ))}
      </tbody>
    </table>
  )
}

function Deuda({ f }: { f: FilaPasivo }) {
  return (
    <>
      <FilaDeuda f={f} />
      {f.bien ? <FilaReferencia f={f} /> : null}
    </>
  )
}

function GrupoTabla({ g, plano, conCuenta }: { g: VistaBalance['activo']['grupos'][number]; plano: boolean; conCuenta: boolean }) {
  if (plano) return <FilaPartida f={g.filas[0]} nivel={1} conCuenta={conCuenta} />
  return (
    <>
      <FilaTotal nombre={g.nombre} valor={g.total} peso={g.peso} pct={g.pct} nivel={1} fuerte={false} borde />
      {g.filas.map((f) => (
        <FilaPartida key={f.clave} f={f} nivel={2} conCuenta={conCuenta} />
      ))}
    </>
  )
}

// ───────────── Teléfono: tarjetas que se pliegan ─────────────

function Valores({ valor, peso, pct, titulo, fuerte = false }: { valor: { ars: CalcVista; usd: CalcVista }; peso: CalcVista; pct: string | null; titulo: string; fuerte?: boolean }) {
  // Los pesos y los dólares a la derecha (bajan de renglón si no entran) y el % en su columna, alineado en todas las filas.
  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_3.25rem] items-baseline gap-x-2 ${fuerte ? 'font-semibold' : ''}`}>
      <span className="flex min-w-0 flex-wrap items-baseline justify-end gap-x-3 gap-y-0.5">
        <Cifra calc={valor.ars} moneda="ARS" titulo={`${titulo} · en pesos`} />
        <Cifra calc={valor.usd} moneda="USD" titulo={`${titulo} · en dólares`} decimales={0} />
      </span>
      <span className="text-right text-[13px] font-normal text-muted">
        <Pct pct={pct} calc={peso} titulo={`${titulo}: parte del activo`} />
      </span>
    </div>
  )
}

function PartidaMovil({ f, conCuenta }: { f: FilaBalance; conCuenta: boolean }) {
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span aria-hidden className="size-2 shrink-0 rounded-sm" style={{ background: f.color }} />
        <span className="min-w-0 text-sm font-medium">{f.nombre}</span>
        <Chips calc={f.valor.ars} chips={f.chips} sinViejo />
      </div>
      <p className="text-[12px] leading-4 text-muted">
        <TextoConMontos texto={f.detalle} />
        {conCuenta && f.cuenta ? ` · ${f.cuenta}` : ''}
      </p>
      <Valores valor={f.valor} peso={f.peso} pct={f.pct} titulo={f.nombre} />
      {f.accion ? <Accion accion={f.accion} /> : null}
    </li>
  )
}

export function EstadoMovil({ v }: { v: VistaBalance }) {
  const a = v.activo
  return (
    <div className="flex flex-col gap-3">
      <Tarjeta className="p-4" aria-labelledby="activo-movil">
        <Rotulo as="h3">
          <span id="activo-movil">Activo {POR[v.agrupar]}</span>
        </Rotulo>
        <div className="mt-1 divide-y divide-border">
          {a.grupos.map((g) => (
            <Plegable
              key={g.clave}
              titulo={g.nombre}
              detalle={`${g.filas.length} ${g.filas.length === 1 ? 'partida' : 'partidas'}`}
              resumen={<Valores valor={g.total} peso={g.peso} pct={g.pct} titulo={g.nombre} />}
            >
              <ul className="divide-y divide-border">
                {g.filas.map((f) => (
                  <PartidaMovil key={f.clave} f={f} conCuenta={v.agrupar !== 'cuenta'} />
                ))}
              </ul>
            </Plegable>
          ))}
          {a.bienes.length ? (
            <Plegable titulo="Bienes" detalle={a.bienes.map((b) => b.nombre).join(', ')} resumen={<Valores valor={a.bienes_total} peso={a.bienes_peso} pct={a.bienes_pct} titulo="Bienes" />}>
              <ul className="divide-y divide-border">
                {a.bienes.map((f) => (
                  <PartidaMovil key={f.clave} f={f} conCuenta={false} />
                ))}
              </ul>
            </Plegable>
          ) : (
            <p className="py-2 text-sm text-muted">
              Bienes: todavía no cargaste la casa ni el auto. <Accion accion={{ etiqueta: 'Cargar tus bienes', href: '/datos/bienes' }} />
            </p>
          )}
        </div>
        <div className="mt-2 border-t border-border pt-2">
          <p className="text-sm font-semibold">Total del activo</p>
          <Valores valor={a.total} peso={a.total_peso} pct={a.total_pct} titulo="Total del activo" fuerte />
        </div>
      </Tarjeta>

      <Tarjeta className="p-4" aria-labelledby="neto-movil">
        <Rotulo as="h3">
          <span id="neto-movil">Pasivo y patrimonio neto</span>
        </Rotulo>
        <ul className="mt-1 divide-y divide-border">
          <li className="py-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-sm font-medium">Total del pasivo</span>
              <ChipEtiqueta calc={v.pasivo.total.ars} />
            </div>
            <p className="text-[12px] text-muted">lo que debés, con el origen de cada deuda arriba</p>
            <Valores valor={v.pasivo.total} peso={v.pasivo.peso} pct={v.pasivo.pct} titulo="Total del pasivo" />
          </li>
          {v.neto.lineas.map((l) => (
            <li key={l.clave} className="py-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className={`text-sm ${l.principal ? 'font-semibold' : 'font-medium'}`}>{l.nombre}</span>
                <ChipEtiqueta calc={l.valor.ars} />
              </div>
              <p className="text-[12px] text-muted">{l.detalle}</p>
              <Valores valor={l.valor} peso={l.peso} pct={l.pct} titulo={l.nombre} fuerte={l.principal} />
            </li>
          ))}
        </ul>
      </Tarjeta>
    </div>
  )
}

export function EstadoSituacion({ v }: { v: VistaBalance }) {
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby="estado-situacion">
      <div className="hidden flex-wrap items-baseline justify-between gap-2 md:flex print:flex">
        <Rotulo as="h3">
          <span id="estado-situacion">Estado de situación patrimonial</span>
        </Rotulo>
        <span className="text-[12px] text-muted">al {v.fecha ? fechaLarga(v.fecha) : '—'} · en pesos, en dólares al CCL de la fecha y en % del activo</span>
      </div>
      {/* Al imprimir, una tabla (AG Grid no arma hojas A4, D-158); en pantalla, la Grilla. */}
      <div className="hidden print:block">
        <TablaEstado v={v} />
      </div>
      <div className="hidden min-w-0 md:block print:hidden">
        <GrillaEstado filas={filasEstado(v)} fecha={v.fecha} />
      </div>
      <p className="hidden text-[12px] text-muted md:block print:block">
        Cada cifra se toca y muestra su fórmula. Lo que no tiene dato dice "sin dato", nunca cero. Un bien financiado y su deuda entran juntos: nunca se suma el bien sin su deuda (D-03).
      </p>
      <div className="md:hidden print:hidden">
        <EstadoMovil v={v} />
      </div>
    </section>
  )
}

export { ParCifra }
