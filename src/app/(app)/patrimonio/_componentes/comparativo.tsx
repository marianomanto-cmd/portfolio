import { fechaCorta } from '@/lib/domain/fechas'
import type { CalcVista } from '@/lib/domain/calc'
import type { ComparativoVista, LineaComparativa } from '@/lib/vistas/contratos-balance'
import { Traza } from '@/components/traza'
import { Chip, Rotulo, Tarjeta } from '@/components/ui'
import { Cifra } from './cifra'
import { ElegirComparacion } from './elegir-comparacion'

// El balance comparado con otra fecha de carga (D-133), como lo presenta un
// contador: el mismo renglón a las dos fechas y lo que cambió. La diferencia
// no es una ganancia (incluye lo que pusiste o sacaste): el resultado está en
// Evolución y PnL. Desde 768 px, una tabla; en el teléfono, tarjetas.

const conAnio = (f: string) => `${fechaCorta(f)}/${f.slice(0, 4)}`

/** Una diferencia: "sin cambios" si es cero de verdad (con su traza), si no, el monto con signo. */
function Diferencia({ calc, moneda, titulo, sinCambios }: { calc: CalcVista; moneda: 'ARS' | 'USD'; titulo: string; sinCambios: boolean }) {
  if (!sinCambios) return <Cifra calc={calc} moneda={moneda} titulo={titulo} decimales={moneda === 'USD' ? 0 : undefined} signo />
  return (
    <span data-cifra={titulo} className="inline-flex text-muted">
      <Traza calc={calc} titulo={titulo} moneda={moneda}>
        sin cambios
      </Traza>
    </span>
  )
}

function Par({ l, cual, fecha }: { l: LineaComparativa; cual: 'actual' | 'anterior' | 'diferencia'; fecha: string }) {
  const titulo = cual === 'diferencia' ? `${l.nombre}: diferencia` : `${l.nombre} al ${fechaCorta(fecha)}`
  if (cual === 'diferencia') {
    return (
      <span className="inline-flex flex-col items-end gap-0.5">
        <Diferencia calc={l.diferencia.ars} moneda="ARS" titulo={`${titulo} · en pesos`} sinCambios={l.sin_cambios.ars} />
        <Diferencia calc={l.diferencia.usd} moneda="USD" titulo={`${titulo} · en dólares`} sinCambios={l.sin_cambios.usd} />
      </span>
    )
  }
  const p = l[cual]
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <Cifra calc={p.ars} moneda="ARS" titulo={`${titulo} · en pesos`} />
      <Cifra calc={p.usd} moneda="USD" titulo={`${titulo} · en dólares`} decimales={0} />
    </span>
  )
}

export function Comparativo({ c, fecha, demo, ruta }: { c: ComparativoVista | null; fecha: string; demo: string | null; ruta: { fecha: string | null; agrupar: string } }) {
  if (!c) return null
  return (
    <Tarjeta className="p-4 md:p-5" aria-labelledby="comparativo-balance">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <Rotulo as="h2">
            <span id="comparativo-balance">Comparativo</span>
          </Rotulo>
          <p className="mt-1 text-[12px] text-muted">
            Tu balance al {conAnio(fecha)} y al {conAnio(c.fecha)}. La diferencia no es una ganancia: incluye lo que pusiste o sacaste; el resultado está en Evolución y PnL.
          </p>
        </div>
        <ElegirComparacion opciones={c.opciones} actual={c.fecha} porDefecto={c.por_defecto} demo={demo} ruta={ruta} />
      </div>

      {/* Desde 768 px y al imprimir: tabla. */}
      <table className="mt-3 hidden w-full border-collapse text-sm md:table print:table">
        <caption className="sr-only">
          Comparativo del balance al {conAnio(fecha)} y al {conAnio(c.fecha)}, en pesos y en dólares
        </caption>
        <thead>
          <tr className="border-b border-border text-[12px] text-muted">
            <th scope="col" className="py-2 pr-2 text-left font-medium">
              Renglón
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              Al {fechaCorta(fecha)}
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              Al {conAnio(c.fecha)}
            </th>
            <th scope="col" className="py-2 pl-2 text-right font-medium">
              Diferencia
            </th>
          </tr>
        </thead>
        <tbody>
          {c.lineas.map((l) => (
            <tr key={l.clave} className={`sin-corte border-t ${l.principal ? 'border-border font-semibold' : 'border-border/60'}`}>
              <th scope="row" className={`py-1.5 pr-2 text-left align-top ${l.principal ? 'font-semibold' : 'font-normal'}`}>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {l.nombre}
                  {l.chip ? <Chip>{l.chip}</Chip> : null}
                </span>
              </th>
              <td className="whitespace-nowrap px-2 py-1.5 text-right align-top">
                <Par l={l} cual="actual" fecha={fecha} />
              </td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right align-top">
                <Par l={l} cual="anterior" fecha={c.fecha} />
              </td>
              <td className="whitespace-nowrap py-1.5 pl-2 text-right align-top">
                <Par l={l} cual="diferencia" fecha={fecha} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* En el teléfono: una tarjeta por renglón, nunca una tabla. */}
      <ul className="mt-3 divide-y divide-border md:hidden print:hidden">
        {c.lineas.map((l) => (
          <li key={l.clave} className="py-2">
            <p className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm ${l.principal ? 'font-semibold' : 'font-medium'}`}>
              {l.nombre}
              {l.chip ? <Chip>{l.chip}</Chip> : null}
            </p>
            <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1 text-sm">
              <dt className="text-[12px] text-muted">Al {fechaCorta(fecha)}</dt>
              <dd className="flex min-w-0 flex-wrap justify-end gap-x-2">
                <Cifra calc={l.actual.ars} moneda="ARS" titulo={`${l.nombre} al ${fechaCorta(fecha)} · en pesos`} />
                <Cifra calc={l.actual.usd} moneda="USD" titulo={`${l.nombre} al ${fechaCorta(fecha)} · en dólares`} decimales={0} />
              </dd>
              <dt className="text-[12px] text-muted">Al {fechaCorta(c.fecha)}</dt>
              <dd className="flex min-w-0 flex-wrap justify-end gap-x-2">
                <Cifra calc={l.anterior.ars} moneda="ARS" titulo={`${l.nombre} al ${fechaCorta(c.fecha)} · en pesos`} />
                <Cifra calc={l.anterior.usd} moneda="USD" titulo={`${l.nombre} al ${fechaCorta(c.fecha)} · en dólares`} decimales={0} />
              </dd>
              <dt className="text-[12px] text-muted">Diferencia</dt>
              <dd className="flex min-w-0 flex-wrap justify-end gap-x-2">
                <Diferencia calc={l.diferencia.ars} moneda="ARS" titulo={`${l.nombre}: diferencia · en pesos`} sinCambios={l.sin_cambios.ars} />
                <Diferencia calc={l.diferencia.usd} moneda="USD" titulo={`${l.nombre}: diferencia · en dólares`} sinCambios={l.sin_cambios.usd} />
              </dd>
            </dl>
          </li>
        ))}
      </ul>
    </Tarjeta>
  )
}
