import { fechaCorta } from '@/lib/domain/fechas'
import type { ComparativoVista } from '@/lib/vistas/contratos-balance'
import { Chip, Rotulo } from '@/components/ui'
import { ParComparado } from './comparativo-cifras'
import { ElegirComparacion } from './elegir-comparacion'
import { GrillaComparativo } from './grilla-comparativo'

// El balance comparado con otra fecha de carga (D-133), como lo presenta un
// contador: el mismo renglón a las dos fechas y lo que cambió. La diferencia
// no es una ganancia (incluye lo que pusiste o sacaste): el resultado está en
// Evolución y PnL. En pantalla, la Grilla (D-157: tarjetas debajo de 768 px);
// al imprimir, una tabla simple que entra en la hoja A4 (D-158).

const conAnio = (f: string) => `${fechaCorta(f)}/${f.slice(0, 4)}`

/** Al imprimir: la tabla del comparativo (AG Grid no arma hojas A4). */
function TablaImpresa({ c, fecha }: { c: ComparativoVista; fecha: string }) {
  return (
    <table className="hidden w-full border-collapse text-sm print:table">
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
              <ParComparado l={l} cual="actual" fecha={fecha} />
            </td>
            <td className="whitespace-nowrap px-2 py-1.5 text-right align-top">
              <ParComparado l={l} cual="anterior" fecha={c.fecha} />
            </td>
            <td className="whitespace-nowrap py-1.5 pl-2 text-right align-top">
              <ParComparado l={l} cual="diferencia" fecha={fecha} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function Comparativo({ c, fecha, demo, ruta }: { c: ComparativoVista | null; fecha: string; demo: string | null; ruta: { fecha: string | null; agrupar: string; vista?: string | null } }) {
  if (!c) return null
  // La grilla ES la tarjeta (D-157): el título y el selector van arriba, sin otra caja.
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby="comparativo-balance">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <Rotulo as="h3">
            <span id="comparativo-balance">Comparativo</span>
          </Rotulo>
          <p className="mt-1 text-[12px] text-muted">
            Tu balance al {conAnio(fecha)} y al {conAnio(c.fecha)}. La diferencia no es una ganancia: incluye lo que pusiste o sacaste; el resultado está en Evolución y PnL.
          </p>
        </div>
        <ElegirComparacion opciones={c.opciones} actual={c.fecha} porDefecto={c.por_defecto} demo={demo} ruta={ruta} />
      </div>
      <TablaImpresa c={c} fecha={fecha} />
      <div className="min-w-0 print:hidden">
        <GrillaComparativo c={c} fecha={fecha} />
      </div>
    </section>
  )
}
