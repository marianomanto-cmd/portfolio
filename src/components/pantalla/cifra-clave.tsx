import type { ReactNode } from 'react'
import { MontoTrazado } from '@/components/monto'
import { ChipEtiqueta, Tarjeta } from '@/components/ui'
import type { Par } from '@/lib/vistas/contratos'

/**
 * Cifra clave (D-157, anatomía 3): rótulo en mono 10 px, el monto en pesos en
 * mono 20–22 px y el de dólares debajo, en su pastilla dorada; una nota de 11
 * px. Hasta cuatro por pantalla, dentro de <CifrasClave>. Cada cifra abre su
 * traza y lleva el chip de su etiqueta más grave (estimado, parcial…).
 *
 *   <CifrasClave>
 *     <CifraClave rotulo="Valor de la cartera" par={v.totales.valor} titulo="Valor de la cartera" />
 *     <CifraClave rotulo="Resultado total" par={v.totales.resultado} titulo="Resultado total" signo color nota="Sobre lo que te costó" />
 *     <CifraClave rotulo="Mejor · GOOGL" principal={<Porcentaje calc={…} titulo="…" color />} secundaria={<Porcentaje calc={…} titulo="…" color />} />
 *   </CifrasClave>
 *
 * Con `par`, `titulo` es el de las trazas ("Valor de la cartera · en pesos").
 * Con `principal` y `secundaria` va lo que quieras (porcentajes, un ticker).
 */
export function CifraClave({
  rotulo,
  par,
  titulo,
  principal,
  secundaria,
  nota,
  signo = false,
  color = false,
  decimalesUsd,
  className = '',
}: {
  rotulo: ReactNode
  par?: Par
  titulo?: string
  principal?: ReactNode
  secundaria?: ReactNode
  nota?: ReactNode
  /** "+" en los positivos (resultados y variaciones). */
  signo?: boolean
  /** Verde o sangría según el signo (solo resultados). */
  color?: boolean
  decimalesUsd?: number
  className?: string
}) {
  const t = titulo ?? (typeof rotulo === 'string' ? rotulo : 'Cifra')
  const arriba = par ? <MontoTrazado calc={par.ars} moneda="ARS" titulo={`${t} · en pesos`} signo={signo} color={color} /> : principal
  const abajo = par ? <MontoTrazado calc={par.usd} moneda="USD" titulo={`${t} · en dólares`} signo={signo} color={color} decimales={decimalesUsd} /> : secundaria
  return (
    <Tarjeta as="div" className={`@container flex min-w-0 flex-col gap-2 px-[18px] py-4 ${className}`}>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <p className="rotulo text-[10px]">{rotulo}</p>
        {par ? <ChipEtiqueta calc={par.ars} /> : null}
      </div>
      {arriba ? <span className="cifra min-w-0 text-[18px] leading-tight @min-[230px]:text-[22px]">{arriba}</span> : null}
      {abajo ? <span className="num min-w-0 self-start text-[13px]">{abajo}</span> : null}
      {nota ? <p className="text-[11px] leading-snug text-muted">{nota}</p> : null}
    </Tarjeta>
  )
}

/** La grilla de cifras clave: columnas de 200 px como mínimo, 12 px entre tarjetas (una sola columna en el teléfono). */
export function CifrasClave({ children, className = '', 'aria-label': etiqueta }: { children: ReactNode; className?: string; 'aria-label'?: string }) {
  return (
    <section aria-label={etiqueta ?? 'Cifras clave'} className={`grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 ${className}`}>
      {children}
    </section>
  )
}
