// El gráfico principal de Exposición (handoff, captura 05): barras divergentes
// "Largo y corto · en pesos de hoy". Una fila por renglón (activos en pesos,
// pasivos en pesos, el neto, activos en dólares y, en la vista Total, los
// bienes sin moneda de riesgo), todas con la misma escala: los positivos
// crecen a la derecha del cero y los negativos a la izquierda. Cada barra se
// parte por activo. Función pura, con test: solo ubica lo que ya viene
// calculado (las cifras de la columna derecha son las de la vista, con su
// traza); los anchos son la única cuenta, y son de dibujo.

import { Decimal } from '@/lib/domain/dinero'
import type { CalcVista } from '@/lib/domain/calc'
import { COLOR_SIN_ELEGIR } from '@/lib/domain/colores'
import type { Par } from '@/lib/vistas/contratos'
import type { TramoExposicion, VistaExposicionPantalla } from '@/lib/vistas/contratos-exposicion'

export type ClaveFila = 'pesos' | 'deudas' | 'neto' | 'dolares' | 'bienes'
export type TonoTramo = 'activo' | 'deuda' | 'corto' | 'largo' | 'sin_elegir'

export interface TramoDibujo {
  clave: string
  etiqueta: string
  nombre: string
  color: string
  tono: TonoTramo
  /** Qué parte de la barra ocupa (0 a 1). */
  parte: number
}

export interface FilaLargoCorto {
  clave: ClaveFila
  rotulo: string
  /** El neto va destacado. */
  fuerte: boolean
  /** Las cifras de la columna derecha, con su traza. */
  valor: Par
  /** "−" delante: la deuda llega en positivo (lo que debés) y se lee como resta. */
  menos: boolean
  /** Dónde arranca y cuánto mide la barra, en % del ancho; null si no hay qué dibujar (sin dato o cero). */
  barra: { desde: number; ancho: number } | null
  tramos: TramoDibujo[]
}

export interface LargoCorto {
  /** Dónde está el cero, en % del ancho. */
  cero: number
  filas: FilaLargoCorto[]
}

type Vista = Pick<VistaExposicionPantalla, 'resumen' | 'activos_en_dolares' | 'tramos' | 'vista' | 'por_moneda'>

/** Dónde va el cero, en % del ancho (handoff: "el cero está en el 40% del ancho"): lo corto a la izquierda, lo largo a la derecha. */
export const CERO = 40

const num = (c: CalcVista): Decimal | null => (c.valor === null ? null : new Decimal(c.valor))

/** Los tramos que se dibujan: los de valor conocido y del signo de la barra, cada uno con su parte. */
function partes(ts: readonly TramoExposicion[], tono: TonoTramo, signo: 1 | -1): TramoDibujo[] {
  const conValor = ts.map((t) => ({ t, v: num(t.valor.ars) })).filter((x): x is { t: TramoExposicion; v: Decimal } => x.v !== null && x.v.times(signo).gt(0))
  const total = conValor.reduce((a, x) => a.plus(x.v.abs()), new Decimal(0))
  if (total.isZero()) return []
  return conValor.map(({ t, v }) => ({
    clave: t.clave,
    etiqueta: t.etiqueta,
    nombre: t.nombre,
    color: tono === 'sin_elegir' ? COLOR_SIN_ELEGIR : t.color,
    tono,
    parte: v.abs().div(total).toNumber(),
  }))
}

export function largoCorto(v: Vista): LargoCorto {
  const r = v.resumen
  const neto = num(r.neto_ars)
  const bienes = v.vista === 'total' && v.tramos.bienes.length ? (v.por_moneda.find((s) => s.clave === 'sin_elegir')?.valor ?? null) : null
  const base: (Omit<FilaLargoCorto, 'barra'> & { v: Decimal | null })[] = [
    { clave: 'pesos', rotulo: 'Activos en pesos', fuerte: false, valor: r.pesos_financieros, menos: false, v: num(r.pesos_financieros.ars), tramos: partes(v.tramos.pesos, 'activo', 1) },
    {
      clave: 'deudas',
      rotulo: 'Pasivos en pesos',
      fuerte: false,
      valor: r.deuda_pesos,
      menos: true,
      // La deuda llega en positivo (lo que debés): se dibuja a la izquierda del cero.
      v: num(r.deuda_pesos.ars)?.negated() ?? null,
      tramos: partes(v.tramos.deudas, 'deuda', -1),
    },
    {
      clave: 'neto',
      rotulo: 'Neto en pesos',
      fuerte: true,
      valor: { ars: r.neto_ars, usd: r.neto_usd },
      menos: false,
      v: neto,
      tramos:
        neto === null || neto.isZero()
          ? []
          : [{ clave: 'neto', etiqueta: neto.lt(0) ? 'CORTO' : 'LARGO', nombre: neto.lt(0) ? 'Corto en pesos' : 'Largo en pesos', color: '', tono: neto.lt(0) ? 'corto' : 'largo', parte: 1 }],
    },
    { clave: 'dolares', rotulo: 'Activos en dólares', fuerte: false, valor: v.activos_en_dolares, menos: false, v: num(v.activos_en_dolares.ars), tramos: partes(v.tramos.dolares, 'activo', 1) },
  ]
  if (bienes)
    base.push({ clave: 'bienes', rotulo: 'Bienes, sin moneda elegida', fuerte: false, valor: bienes, menos: false, v: num(bienes.ars), tramos: partes(v.tramos.bienes, 'sin_elegir', 1) })

  // Una sola escala para todas las filas: lo más largo de cada lado entra en su lado (40% a la izquierda, 60% a la derecha).
  const pos = base.reduce((a, f) => (f.v !== null && f.v.gt(a) ? f.v : a), new Decimal(0))
  const neg = base.reduce((a, f) => (f.v !== null && f.v.lt(0) && f.v.abs().gt(a) ? f.v.abs() : a), new Decimal(0))
  // Cuánto vale cada 1% del ancho.
  const escala = Decimal.max(neg.div(CERO), pos.div(100 - CERO))
  const filas = base.map(({ v: valor, ...f }): FilaLargoCorto => {
    if (valor === null || valor.isZero() || escala.isZero() || f.tramos.length === 0) return { ...f, barra: null }
    const ancho = valor.abs().div(escala).toNumber()
    return { ...f, barra: { desde: valor.lt(0) ? CERO - ancho : CERO, ancho } }
  })
  return { cero: CERO, filas }
}
