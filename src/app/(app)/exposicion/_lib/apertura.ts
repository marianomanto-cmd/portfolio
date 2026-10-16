// "Apertura de activos" (handoff, captura 05): barras 100% apiladas por clase y
// por geografía, con el rótulo y el porcentaje adentro de cada tramo cuando
// entran. Función pura, con test: el porcentaje ya viene calculado en la vista
// (con su traza, que está en el detalle); acá solo se decide el ancho y qué
// texto cabe en cada tramo.

import { Decimal, numero } from '@/lib/domain/dinero'
import type { Segmento } from '@/lib/vistas/contratos'

export interface TramoApertura {
  clave: string
  nombre: string
  color: string
  /** Ancho CSS ("67.0123%"). */
  ancho: string
  /** "67,0%". */
  pct: string
  /** Lo que se escribe adentro: nombre y %, solo el %, o nada si no entra. */
  rotulo: string
}

/** Desde qué parte del ancho entra el nombre con el %, y desde cuál solo el %. */
const CON_NOMBRE = new Decimal('0.18')
const SOLO_PCT = new Decimal('0.07')

export function tramosApertura(segmentos: readonly Segmento[]): TramoApertura[] {
  const conPeso = segmentos.filter((s) => s.peso.valor !== null && new Decimal(s.peso.valor).gt(0))
  const total = conPeso.reduce((a, s) => a.plus(s.peso.valor as string), new Decimal(0))
  if (total.isZero()) return []
  return conPeso.map((s) => {
    const p = new Decimal(s.peso.valor as string)
    // El ancho, sobre lo que se dibuja (si hay algún tramo negativo o sin dato, el resto llena la barra).
    const parte = p.div(total)
    const pct = `${numero(p.times(100), 1)}%`
    return {
      clave: s.clave,
      nombre: s.nombre,
      color: s.color,
      ancho: `${parte.times(100).toDecimalPlaces(4).toFixed()}%`,
      pct,
      rotulo: parte.gte(CON_NOMBRE) ? `${s.nombre} ${pct}` : parte.gte(SOLO_PCT) ? pct : '',
    }
  })
}
