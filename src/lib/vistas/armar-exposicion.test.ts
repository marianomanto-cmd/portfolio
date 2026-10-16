// Lo que suma la pantalla Exposición del rediseño (D-158) a la vista del motor:
// las barras de "Largo y corto" partidas por activo suman lo mismo que el
// resumen del motor (no se calcula nada nuevo), cada tramo trae su traza, la
// serie del neto pasa a dólares al CCL de cada día y un "sin dato" nunca es
// cero. Con los hechos inventados del demo (Apéndice B).
import { describe, expect, it } from 'vitest'
import type { CalcVista } from '@/lib/domain/calc'
import { Decimal } from '@/lib/domain/dinero'
import { armarExposicionPantalla, etiquetaDeuda, serieNeta } from './armar-exposicion'
import type { TramoExposicion } from './contratos-exposicion'
import { hechosVacios, HOY_EJEMPLO } from './ejemplo'
import { hechosBalance } from './ejemplo-balance'

const suma = (ts: TramoExposicion[], m: 'ars' | 'usd' = 'ars') => ts.reduce((a, t) => a.plus(t.valor[m].valor as string), new Decimal(0))
const dec = (c: CalcVista) => new Decimal(c.valor as string)

/** Con traza: un valor con su fórmula, o "sin dato" con su motivo. */
const conTraza = (c: CalcVista) => (c.valor === null ? Boolean(c.motivo) : c.formula.trim().length > 0)

describe('armarExposicionPantalla', () => {
  const { h, hoy } = hechosBalance('estimada')
  const v = armarExposicionPantalla(h, hoy, 'financiero')

  it('las barras de largo y corto suman lo mismo que el resumen del motor, en pesos y en dólares', () => {
    expect(suma(v.tramos.pesos).toFixed(2)).toBe(dec(v.resumen.pesos_financieros.ars).toFixed(2))
    expect(suma(v.tramos.pesos, 'usd').toFixed(2)).toBe(dec(v.resumen.pesos_financieros.usd).toFixed(2))
    // La deuda va con su signo: negativa en el tramo, positiva en el resumen ("lo que debés").
    expect(suma(v.tramos.deudas).neg().toFixed(2)).toBe(dec(v.resumen.deuda_pesos.ars).toFixed(2))
    expect(suma(v.tramos.dolares).toFixed(2)).toBe(dec(v.activos_en_dolares.ars).toFixed(2))
    expect(suma(v.tramos.pesos).plus(suma(v.tramos.deudas)).toFixed(2)).toBe(dec(v.resumen.neto_ars).toFixed(2))
  })

  it('cada título por su ticker, de mayor a menor, y la liquidez de cada moneda junta, al final', () => {
    for (const [ts, liq] of [
      [v.tramos.pesos, 'LIQ'],
      [v.tramos.dolares, 'LIQ US$'],
    ] as const) {
      expect(ts.at(-1)?.etiqueta).toBe(liq)
      const titulos = ts.slice(0, -1)
      expect(titulos.length).toBeGreaterThan(0)
      const valores = titulos.map((t) => dec(t.valor.ars).abs())
      for (let i = 1; i < valores.length; i++) expect(valores[i - 1].gte(valores[i])).toBe(true)
    }
    // La liquidez junta es una suma con sus partes como insumos.
    const liq = v.tramos.pesos.at(-1) as TramoExposicion
    expect(liq.valor.ars.formula).toContain('=')
    expect(liq.valor.ars.insumos.length).toBeGreaterThan(0)
    expect(v.tramos.deudas.map((t) => t.etiqueta)).toEqual(['Leasing'])
    expect(dec(v.tramos.deudas[0].valor.ars).isNegative()).toBe(true)
  })

  it('toda cifra de un tramo abre su traza, en pesos y en dólares', () => {
    const todos = [...v.tramos.pesos, ...v.tramos.deudas, ...v.tramos.dolares]
    for (const t of todos) {
      expect(conTraza(t.valor.ars), `${t.nombre} · pesos`).toBe(true)
      expect(conTraza(t.valor.usd), `${t.nombre} · dólares`).toBe(true)
    }
  })

  it('los bienes solo en la vista Total, mientras no tengan moneda de riesgo', () => {
    expect(v.tramos.bienes).toEqual([])
    const t = armarExposicionPantalla(h, hoy, 'total')
    expect(t.tramos.bienes.map((b) => b.etiqueta).sort()).toEqual([...t.sin_moneda_de_riesgo].sort())
    // El resto de las barras no cambia: los bienes no arriesgan ninguna moneda todavía.
    expect(suma(t.tramos.pesos).toFixed(2)).toBe(suma(v.tramos.pesos).toFixed(2))
    expect(suma(t.tramos.dolares).toFixed(2)).toBe(suma(v.tramos.dolares).toFixed(2))
  })

  it('las posiciones más grandes: tres, la primera es la del TOP 1', () => {
    expect(v.mayores).toHaveLength(3)
    const primera = [...v.tramos.pesos, ...v.tramos.dolares].find((t) => t.etiqueta === v.mayores[0])
    expect(primera?.nombre ?? v.mayores[0]).toBe(v.concentracion.top1_nombre)
  })

  it('el neto de cada fecha, en dólares al CCL de ese día; sin el neto, sin dato (nunca cero)', () => {
    expect(v.serie_neto.map((p) => p.fecha)).toEqual(v.serie.map((p) => p.fecha))
    // Antes del 08/10 (el estimado de la deuda) el neto no se sabe; desde ahí, sí.
    const conNeto = v.serie_neto.filter((p) => p.neto_ars !== null)
    expect(conNeto.length).toBeGreaterThan(0)
    for (const p of v.serie_neto) {
      expect(p.ccl).not.toBeNull()
      if (p.neto_ars === null) expect(p.neto_usd).toBeNull()
      else expect(new Decimal(p.neto_usd as string).toFixed(6)).toBe(new Decimal(p.neto_ars).div(p.ccl as string).toFixed(6))
    }
    expect(conNeto.at(-1)?.neto_ars).toBe(v.resumen.neto_ars.valor)
    const sin = hechosBalance('sin-deuda')
    const s = serieNeta(sin.h, armarExposicionPantalla(sin.h, sin.hoy, 'financiero'))
    expect(s.length).toBeGreaterThan(0)
    for (const p of s) {
      expect(p.neto_ars).toBeNull()
      expect(p.neto_usd).toBeNull()
    }
  })

  it('sin cargas: nada que dibujar, y nada en cero', () => {
    const vacia = armarExposicionPantalla(hechosVacios(), HOY_EJEMPLO, 'financiero')
    expect(vacia.tramos).toEqual({ pesos: [], deudas: [], dolares: [], bienes: [] })
    expect(vacia.serie_neto).toEqual([])
    expect(vacia.mayores).toEqual([])
  })

  it('el nombre corto de una deuda es su primera palabra', () => {
    expect(etiquetaDeuda('Leasing de la camioneta')).toBe('Leasing')
    expect(etiquetaDeuda('  Hipoteca ')).toBe('Hipoteca')
  })
})
