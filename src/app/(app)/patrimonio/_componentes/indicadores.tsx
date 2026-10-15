import type { IndicadorVista } from '@/lib/vistas/contratos-balance'
import { SinDato } from '@/components/monto'
import { Traza } from '@/components/traza'
import { Chip, Rotulo, Tarjeta } from '@/components/ui'

// Tres indicadores del estado de situación (D-133): solvencia, endeudamiento
// e inmovilización. Cocientes sin moneda (en pesos y en dólares dan lo mismo),
// cada uno con su fórmula al tocarlo. Describen, no juzgan: no hay umbral.

export function Indicadores({ xs }: { xs: IndicadorVista[] }) {
  if (xs.length === 0) return null
  return (
    <Tarjeta className="p-4 md:p-5" aria-labelledby="indicadores-balance">
      <Rotulo as="h2">
        <span id="indicadores-balance">Indicadores del balance</span>
      </Rotulo>
      <p className="mt-1 text-[12px] text-muted">Cocientes del balance: dan lo mismo en pesos que en dólares. Describen, no juzgan: la app no tiene un número bueno o malo.</p>
      <ul className="mt-3 grid gap-3 md:grid-cols-3 md:gap-4">
        {xs.map((x) => (
          <li key={x.clave} className="sin-corte rounded-lg border border-border px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-medium">{x.nombre}</span>
              {x.chips.map((c) => (
                <Chip key={c}>{c}</Chip>
              ))}
            </div>
            <div className="mt-1 text-xl font-semibold">
              <Traza calc={x.valor} titulo={x.nombre}>
                {x.texto === null ? <SinDato motivo={x.valor.motivo} /> : <span className="num">{x.texto}</span>}
              </Traza>
            </div>
            <p className="mt-0.5 text-[12px] leading-4 text-muted">{x.lectura}</p>
          </li>
        ))}
      </ul>
    </Tarjeta>
  )
}
