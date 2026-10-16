import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Selector segmentado en pastilla (D-157; handoff: el período de Evolución y
 * el escenario de Flujo): borde hairline, 4 px de relleno y de separación,
 * opciones en JetBrains Mono 11 px con tracking .08em; la elegida en
 * surface-3 y tinta. Cada opción es un link (lo elegido vive en la dirección)
 * y mide 44 px con el dedo.
 *
 *   <Segmentado
 *     etiqueta="Período"
 *     opciones={[{ href: '/evolucion?periodo=mes', nombre: '1M', actual: false, titulo: 'El último mes' }, …]}
 *   />
 *
 * `oculto` suma texto para el lector de pantalla (y para quien busque el link
 * por su nombre), sin ocupar lugar: "pesos financieros − deuda del leasing".
 */
export function Segmentado({
  etiqueta,
  opciones,
  className = '',
}: {
  etiqueta: string
  opciones: { href: string; nombre: ReactNode; actual: boolean; titulo?: string; oculto?: string }[]
  className?: string
}) {
  return (
    <nav aria-label={etiqueta} className={`flex max-w-full flex-wrap gap-1 rounded-full border border-border p-1 ${className}`}>
      {opciones.map((o) => (
        <Link
          key={o.href}
          href={o.href}
          title={o.titulo}
          aria-current={o.actual ? 'page' : undefined}
          scroll={false}
          className={`tocable inline-flex min-h-8 items-center justify-center rounded-full px-[14px] py-[7px] font-mono text-[11px] uppercase leading-none tracking-[0.08em] transition-colors duration-200 ${
            o.actual ? 'bg-surface-3 text-text' : 'text-muted hover:text-text'
          }`}
        >
          {o.nombre}
          {o.oculto ? <span className="sr-only"> {o.oculto}</span> : null}
        </Link>
      ))}
    </nav>
  )
}

/**
 * La misma pastilla con botones, para lo que se elige sin cambiar de dirección
 * (la moneda de un gráfico, cómo agrupar una tabla). Va dentro de un
 * componente de cliente, que maneja `alElegir`.
 *
 *   <SegmentadoBotones etiqueta="Moneda del gráfico" opciones={[{ valor: 'ARS', nombre: 'Pesos' }, …]} actual={m} alElegir={setM} />
 */
export function SegmentadoBotones<T extends string>({
  etiqueta,
  opciones,
  actual,
  alElegir,
  className = '',
}: {
  etiqueta: string
  opciones: { valor: T; nombre: ReactNode }[]
  actual: T
  alElegir: (v: T) => void
  className?: string
}) {
  return (
    <div role="group" aria-label={etiqueta} className={`flex max-w-full flex-wrap gap-1 rounded-full border border-border p-1 ${className}`}>
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          aria-pressed={o.valor === actual}
          onClick={() => alElegir(o.valor)}
          className={`tocable inline-flex min-h-8 items-center justify-center rounded-full px-[14px] py-[7px] font-mono text-[11px] uppercase leading-none tracking-[0.08em] transition-colors duration-200 ${
            o.valor === actual ? 'bg-surface-3 text-text' : 'text-muted hover:text-text'
          }`}
        >
          {o.nombre}
        </button>
      ))}
    </div>
  )
}
