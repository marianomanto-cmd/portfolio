import type { ReactNode } from 'react'

// Modo privado (manual §4.7): el CSS desenfoca todo lo que lleve la clase
// `monto`. Cargar y Datos arman muchos montos como texto (motivos, controles,
// fórmulas); estas piezas los marcan para que el ojo también los tape.

/** Un monto ya formateado. En dólares, con la pastilla `usd` (D-68). */
export function M({ children, usd = false }: { children: ReactNode; usd?: boolean }) {
  return <span className={usd ? 'monto usd' : 'monto'}>{children}</span>
}

/** "$ 1.234,56", "US$ 620,00", "−$ 3,5", "+$ 1.000": lo que en un texto es plata (con su signo). */
export const RE_MONTO = /[−+-]?(?:US\$|\$)\s?[−+-]?\d[\d.]*(?:,\d+)?/g

/** Partes de un texto: los montos, marcados; el resto, tal cual. Puro (para los tests). */
export function partirMontos(texto: string): { texto: string; monto: boolean }[] {
  const out: { texto: string; monto: boolean }[] = []
  let desde = 0
  for (const m of texto.matchAll(RE_MONTO)) {
    const i = m.index ?? 0
    if (i > desde) out.push({ texto: texto.slice(desde, i), monto: false })
    out.push({ texto: m[0], monto: true })
    desde = i + m[0].length
  }
  if (desde < texto.length) out.push({ texto: texto.slice(desde), monto: false })
  return out
}

/** Un texto armado (un motivo, una fórmula) con sus montos marcados. */
export function ConMontos({ texto }: { texto: string }) {
  return (
    <>
      {partirMontos(texto).map((p, i) => (p.monto ? <M key={i} usd={p.texto.includes('US$')}>{p.texto}</M> : p.texto))}
    </>
  )
}
