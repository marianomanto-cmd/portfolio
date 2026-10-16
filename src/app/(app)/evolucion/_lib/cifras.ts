// Las cuatro cifras clave de Evolución y PnL (handoff, captura 07): el
// resultado en pesos, en dólares, lo que pusieron tus activos y lo que puso el
// tipo de cambio, cada una con su nota. Las cifras llegan calculadas en la
// vista; acá se arman, con fórmula e insumos (trazabilidad), los porcentajes
// de las notas: el resultado sobre lo que tenías al empezar el período y qué
// parte del resultado en pesos puso cada uno. Función pura, con test.

import type { CalcVista } from '@/lib/domain/calc'
import { Decimal, monto, numero, porcentaje } from '@/lib/domain/dinero'
import { fechaCorta } from '@/lib/domain/fechas'
import { MOTIVO_SEGUNDA_CARGA } from '@/lib/domain/resultados'
import { cifra, texto, type ParteLectura } from '@/components/pantalla/lectura'
import type { VistaEvolucion } from '@/lib/vistas/contratos-evolucion'

type Moneda = 'ARS' | 'USD'

export interface CifraEvolucion {
  clave: 'resultado_ars' | 'resultado_usd' | 'activo' | 'tc'
  rotulo: string
  principal: { calc: CalcVista; moneda: Moneda; titulo: string }
  /** La misma cifra en la otra moneda (en su pastilla), si va. */
  secundaria: { calc: CalcVista; moneda: Moneda; titulo: string } | null
  /** Cómo se pinta: un resultado (verde o sangría, con signo), o un aporte en tinta u oro (el del tipo de cambio). */
  tono: 'resultado' | 'tinta' | 'oro'
  /** La nota de abajo: texto y cifras trazables. */
  nota: ParteLectura[]
}

const sinDato = (motivo: string, explicacion?: string): CalcVista => ({ valor: null, motivo, formula: 'sin dato', insumos: [], etiquetas: [], explicacion })

/** Una cifra como insumo de otra, con su traza adentro. */
const insumo = (nombre: string, c: CalcVista, unidad: 'ARS' | 'USD' | 'ratio') => ({ nombre, valor: c.valor, unidad, calc: c })

/** a ÷ b, con la fórmula y los dos insumos a la vista. Sin a o sin b, o con b en cero, "sin dato" con el porqué. */
export function cociente(a: CalcVista, b: CalcVista, o: { m: Moneda; nombreA: string; nombreB: string; explicacion: string; positivoB?: boolean }): CalcVista {
  const insumos = [insumo(o.nombreA, a, o.m), insumo(o.nombreB, b, o.m)]
  const etiquetas = [...new Set([...a.etiquetas, ...b.etiquetas])]
  if (a.valor === null) return { ...sinDato(a.motivo ?? `Falta ${o.nombreA.toLowerCase()}.`, o.explicacion), insumos, etiquetas }
  if (b.valor === null) return { ...sinDato(b.motivo ?? `Falta ${o.nombreB.toLowerCase()}.`, o.explicacion), insumos, etiquetas }
  const x = new Decimal(a.valor)
  const y = new Decimal(b.valor)
  if (y.isZero() || (o.positivoB && y.isNegative()))
    return { ...sinDato(`${o.nombreB} es ${y.isZero() ? 'cero' : 'negativo'}: no hay sobre qué calcular el porcentaje.`, o.explicacion), insumos, etiquetas }
  const f = x.div(y)
  return {
    valor: f.toFixed(),
    formula: `${monto(x, o.m, { decimales: 2, signo: true })} ÷ ${monto(y, o.m, { decimales: 2, signo: !o.positivoB })} = ${porcentaje(f, { signo: true })}`,
    insumos,
    etiquetas,
    explicacion: o.explicacion,
  }
}

/** Un porcentaje para una nota, con un decimal ("+23,6%"). */
export const pct1 = (c: CalcVista, signo = true) => (c.valor === null ? '' : porcentaje(c.valor, { decimales: 1, signo }))

/** El motivo de un "sin dato" como nota (sin repetir el punto final). */
const motivo = (c: CalcVista): ParteLectura[] => [texto(c.motivo ?? 'Falta un dato.')]

export function cifrasEvolucion(v: Pick<VistaEvolucion, 'estado' | 'desde' | 'hasta' | 'totales' | 'puente' | 'ccl' | 'ccl_desde'>): CifraEvolucion[] {
  const t = v.totales
  const falta = v.estado === 'sin_cargas' ? 'Todavía no hay cargas.' : MOTIVO_SEGUNDA_CARGA
  const nada = sinDato(falta)
  const res = { ars: t?.resultado.ars ?? nada, usd: t?.resultado.usd ?? nada }
  const activo = { ars: t?.activo.ars ?? nada, usd: t?.activo.usd ?? nada }
  const tc = { ars: t?.tc.ars ?? nada, usd: t?.tc.usd ?? nada }
  const inicial = v.puente?.lineas.find((l) => l.clave === 'inicial')?.valor ?? { ars: nada, usd: nada }
  const desde = v.desde ? fechaCorta(v.desde) : null
  const sobreInicio = (m: Moneda) =>
    cociente(m === 'ARS' ? res.ars : res.usd, m === 'ARS' ? inicial.ars : inicial.usd, {
      m,
      nombreA: m === 'ARS' ? 'Resultado del período en pesos' : 'Resultado del período en dólares',
      nombreB: `Tu patrimonio al ${desde ?? 'inicio'}`,
      positivoB: true,
      explicacion: 'Qué parte de lo que tenías al empezar el período ganaste o perdiste. No cuenta lo que pusiste o sacaste en el medio.',
    })
  const parte = (c: CalcVista, quien: string) =>
    cociente(c, res.ars, {
      m: 'ARS',
      nombreA: quien,
      nombreB: 'Resultado del período en pesos',
      explicacion: 'Qué parte del resultado en pesos del período explica esto (D-35). Con resultados de signo distinto, una parte puede pasar el 100%.',
    })
  const notaPct = (c: CalcVista, titulo: string, resto: string): ParteLectura[] => (c.valor === null ? motivo(c) : [cifra(pct1(c), c, titulo), texto(resto)])

  const pArs = sobreInicio('ARS')
  const pUsd = sobreInicio('USD')
  const parteActivo = parte(activo.ars, 'Lo que pusieron tus activos, en pesos')
  const parteTc = parte(tc.ars, 'Lo que puso el tipo de cambio, en pesos')
  const cclDe = v.ccl_desde
  const notaTc: ParteLectura[] =
    parteTc.valor === null
      ? motivo(parteTc)
      : [
          cifra(pct1(parteTc), parteTc, 'Del tipo de cambio: parte del resultado en pesos'),
          ...(cclDe && cclDe.valor !== null && v.ccl.valor !== null
            ? [texto(' · CCL de '), cifra(numero(cclDe.valor, 0), cclDe, `CCL al ${desde}`), texto(' a '), cifra(numero(v.ccl.valor, 0), v.ccl, `CCL al ${v.hasta ? fechaCorta(v.hasta) : 'final'}`)]
            : [texto(' del resultado en pesos')]),
        ]
  return [
    {
      clave: 'resultado_ars',
      rotulo: 'Resultado en pesos',
      principal: { calc: res.ars, moneda: 'ARS', titulo: 'Resultado del período · en pesos' },
      secundaria: null,
      tono: 'resultado',
      nota: res.ars.valor === null ? motivo(res.ars) : notaPct(pArs, 'Resultado sobre tu patrimonio al empezar, en pesos', ` sobre lo que tenías al ${desde}`),
    },
    {
      clave: 'resultado_usd',
      rotulo: 'Resultado en dólares',
      principal: { calc: res.usd, moneda: 'USD', titulo: 'Resultado del período · en dólares' },
      secundaria: null,
      tono: 'resultado',
      nota: res.usd.valor === null ? motivo(res.usd) : notaPct(pUsd, 'Resultado sobre tu patrimonio al empezar, en dólares', ` sobre lo que tenías al ${desde}`),
    },
    {
      clave: 'activo',
      rotulo: 'De tus activos',
      principal: { calc: activo.ars, moneda: 'ARS', titulo: 'Lo que pusieron tus activos · en pesos' },
      secundaria: { calc: activo.usd, moneda: 'USD', titulo: 'Lo que pusieron tus activos · en dólares' },
      tono: 'tinta',
      nota: activo.ars.valor === null ? motivo(activo.ars) : notaPct(parteActivo, 'De tus activos: parte del resultado en pesos', ' del resultado en pesos'),
    },
    {
      clave: 'tc',
      rotulo: 'Del tipo de cambio',
      principal: { calc: tc.ars, moneda: 'ARS', titulo: 'Lo que puso el tipo de cambio · en pesos' },
      secundaria: { calc: tc.usd, moneda: 'USD', titulo: 'Lo que puso el tipo de cambio · en dólares' },
      tono: 'oro',
      nota: tc.ars.valor === null ? motivo(tc.ars) : notaTc,
    },
  ]
}
