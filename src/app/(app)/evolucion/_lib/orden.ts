// Ordenar la tabla de resultados por una columna, en la moneda que mirás. Solo
// compara lo que ya viene calculado (texto decimal): no suma ni resta nada.
// "Sin dato" y "no aplica" van siempre al final, en cualquier sentido.

import type { Par } from '@/lib/vistas/contratos'
import type { FilaResultado, GrupoVista } from '@/lib/vistas/contratos-evolucion'

export type ColumnaOrden = 'nombre' | 'resultado' | 'activo' | 'tc' | 'sin_atribuir' | 'realizado' | 'no_realizado' | 'peso'
export interface Orden {
  col: ColumnaOrden
  desc: boolean
}

export const ORDEN_INICIAL: Orden = { col: 'resultado', desc: true }

type Ordenable = Pick<FilaResultado, 'resultado' | 'activo' | 'tc' | 'sin_atribuir' | 'realizado' | 'no_realizado' | 'peso'> & { nombre: string; ticker?: string; cuenta?: string | null }

/** Lo que se lee en la tabla: el ticker y la cuenta de una fila, o el nombre de un grupo. */
const rotulo = (x: Ordenable) => (x.ticker ? `${x.ticker} · ${x.cuenta ?? ''}` : x.nombre)

function valor(x: Ordenable, col: Exclude<ColumnaOrden, 'nombre'>, k: 'ars' | 'usd'): number | null {
  const p: Par | null = x[col]
  const v = p ? p[k].valor : null
  return v === null ? null : Number(v)
}

/** Ordena una copia (no toca la lista que recibe). */
export function ordenar<T extends Ordenable>(xs: readonly T[], o: Orden, k: 'ars' | 'usd'): T[] {
  const signo = o.desc ? -1 : 1
  return [...xs].sort((a, b) => {
    if (o.col === 'nombre') return signo * rotulo(a).localeCompare(rotulo(b), 'es')
    const va = valor(a, o.col, k)
    const vb = valor(b, o.col, k)
    if (va === null && vb === null) return rotulo(a).localeCompare(rotulo(b), 'es')
    if (va === null) return 1
    if (vb === null) return -1
    return va === vb ? rotulo(a).localeCompare(rotulo(b), 'es') : signo * (va < vb ? -1 : 1)
  })
}

/** Tocar la misma columna da vuelta el sentido; una nueva arranca de mayor a menor (o de la A a la Z). */
export function siguienteOrden(actual: Orden, col: ColumnaOrden): Orden {
  if (actual.col === col) return { col, desc: !actual.desc }
  return { col, desc: col !== 'nombre' }
}

/** Las filas de cada grupo, en el orden elegido; los grupos también se ordenan por su subtotal. */
export function gruposOrdenados(grupos: readonly GrupoVista[], filas: readonly FilaResultado[], o: Orden, k: 'ars' | 'usd'): { grupo: GrupoVista; filas: FilaResultado[] }[] {
  const porClave = new Map(filas.map((f) => [f.clave, f]))
  return ordenar(grupos, o, k).map((g) => ({
    grupo: g,
    filas: ordenar(
      g.claves.map((c) => porClave.get(c)).filter((f): f is FilaResultado => Boolean(f)),
      o,
      k,
    ),
  }))
}
