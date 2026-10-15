// Cuentas de la grilla (components/grilla), puras y con test: qué columnas
// entran en un ancho (nunca scroll horizontal, D-30), qué alto tiene (alto
// automático hasta ~25 filas, spec §UI) y dónde empieza cada grupo de filas.

export interface MedidaColumna {
  id: string
  /** Ancho mínimo en px (incluye el relleno de la celda). */
  ancho: number
  /** 0 = siempre se ve. Las de número más alto se ocultan primero. */
  prioridad: number
}

/** El ancho de la columna de la ficha (⋯), que aparece cuando alguna columna no entra. */
export const ANCHO_FICHA = 48

/**
 * Las columnas que entran en `disponible` px: primero las de prioridad 0, y
 * después, de la prioridad más baja a la más alta (a igual prioridad, en el
 * orden de las columnas), mientras sumen. Si alguna queda afuera, se reserva el
 * lugar de la columna de la ficha, donde se ven las que no entraron.
 *
 * Las de prioridad 0 entran siempre (aunque no sumen): es responsabilidad de
 * la pantalla que lo imprescindible quepa en 768 px.
 */
export function columnasVisibles(cols: readonly MedidaColumna[], disponible: number): { visibles: Set<string>; ocultas: string[] } {
  const elegir = (lugar: number) => {
    const orden = cols.map((c, i) => ({ c, i })).sort((a, b) => a.c.prioridad - b.c.prioridad || a.i - b.i)
    const visibles = new Set<string>()
    let usado = 0
    for (const { c } of orden) {
      if (c.prioridad === 0 || usado + c.ancho <= lugar) {
        visibles.add(c.id)
        usado += c.ancho
      }
    }
    return visibles
  }
  let visibles = elegir(disponible)
  if (visibles.size < cols.length) visibles = elegir(disponible - ANCHO_FICHA)
  return { visibles, ocultas: cols.filter((c) => !visibles.has(c.id)).map((c) => c.id) }
}

/**
 * El alto de la grilla. Hasta `maxFilas` filas no tiene scroll propio (crece
 * con la página: null = alto automático); con más, mide `maxFilas` filas más
 * el encabezado y la fila de totales, y adentro scrollea vertical.
 */
export function altoGrilla(e: { filas: number; maxFilas: number; altoFila: number; altoEncabezado: number; conTotales: boolean }): number | null {
  if (e.filas <= e.maxFilas) return null
  return e.altoEncabezado + e.maxFilas * e.altoFila + (e.conTotales ? e.altoFila : 0) + 2
}

/**
 * El alto de las filas y del encabezado. Con el dedo (una tablet, o el
 * teléfono acostado: D-100), los dos miden `minimo` (44 px) como mínimo: el
 * encabezado ordena y cada fila tiene cifras que se tocan.
 */
export function medidas(e: { grueso: boolean; altoFila: number; altoEncabezado: number; minimo: number }): { altoFila: number; altoEncabezado: number } {
  if (!e.grueso) return { altoFila: e.altoFila, altoEncabezado: e.altoEncabezado }
  return { altoFila: Math.max(e.altoFila, e.minimo), altoEncabezado: Math.max(e.altoEncabezado, e.minimo) }
}

/**
 * Las filas que empiezan un grupo (Registro: el primer renglón de cada lote)
 * en el orden en que se ven: una fila empieza grupo si la anterior es de otro.
 */
export function iniciosDeGrupo(claves: readonly string[]): boolean[] {
  return claves.map((k, i) => i === 0 || claves[i - 1] !== k)
}
