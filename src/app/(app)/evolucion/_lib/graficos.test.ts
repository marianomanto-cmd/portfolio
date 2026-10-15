// Los gráficos de Evolución muestran lo mismo que la vista (plan §8): mismo
// largo, ningún NaN, null donde hay "sin dato", sin tortas, y en modo privado
// ningún monto en la tabla ni en los ejes. Con la vista del modo demo (números inventados).
import { describe, expect, it } from 'vitest'
import { conTema, TEMA_CLARO, tieneTorta } from '@/components/graficos/tema'
import { ejemploEvolucion } from '@/lib/vistas/ejemplo-evolucion'
import { barrasContribuyentes, cifraTexto, deltasPuente, etiquetaFecha, finDeMes, indice100, opcionContribuyentes, opcionIndice, opcionMeses, opcionPatrimonio, opcionPuente, quienesDe } from './graficos'
import { POR_DEFECTO } from './parametros'

type Serie = { type: string; data: unknown[] }
const series = (o: Record<string, unknown>) => o.series as Serie[]
/** El valor de cada punto: un número, un objeto { value } o un par [fecha, valor] de un eje de tiempo. */
const valores = (s: Serie) =>
  s.data.map((d) => {
    const x = d !== null && typeof d === 'object' && !Array.isArray(d) ? (d as { value: unknown }).value : d
    return Array.isArray(x) ? (x[1] as number | null) : (x as number | null)
  })
const sinNaN = (o: Record<string, unknown>) => series(o).every((s) => valores(s).every((v) => v === null || Number.isFinite(v)))

describe('gráficos de Evolución', () => {
  const v = ejemploEvolucion(POR_DEFECTO, 'mes')
  const unDia = ejemploEvolucion(POR_DEFECTO, 'un-dia')

  it('ninguno es una torta, y todos pasan por el tema compartido', () => {
    const opciones = [
      opcionPuente(v.puente!.lineas, 'ARS', false).opcion,
      opcionContribuyentes(v.contribuyentes, 'USD', false, null).opcion,
      opcionPatrimonio(v.serie, v.aportado, v.futuro, 'ARS', false).opcion,
      opcionMeses(v.meses, 'ARS', false).opcion,
    ]
    for (const o of opciones) {
      expect(tieneTorta(o)).toBe(false)
      expect(() => conTema(o, TEMA_CLARO, { movil: true, animar: false })).not.toThrow()
      expect(sinNaN(o)).toBe(true)
    }
  })

  it('la cascada de deltas: una barra por línea sumable y el cambio total al final; el inicio y el final no son barras', () => {
    const { opcion, tabla } = opcionPuente(v.puente!.lineas, 'ARS', false)
    const deltas = v.puente!.lineas.filter((l) => !l.informativa && l.clave !== 'inicial' && l.clave !== 'final')
    const [base, tramo] = series(opcion)
    expect(base.data).toHaveLength(deltas.length + 1)
    expect((opcion as { xAxis: { data: string[] } }).xAxis.data.at(-1)).toBe('Cambio')
    const activo = deltas.findIndex((l) => l.clave === 'activo')
    expect(valores(tramo)[activo]).toBeCloseTo(Math.abs(Number(deltas[activo].valor.ars.valor)), 6)
    // El cambio total es final − inicial (el puente cuadra ✓).
    const ini = Number(v.puente!.lineas.find((l) => l.clave === 'inicial')!.valor.ars.valor)
    const fin = Number(v.puente!.lineas.find((l) => l.clave === 'final')!.valor.ars.valor)
    expect(valores(tramo).at(-1)).toBeCloseTo(Math.abs(fin - ini), 4)
    // Cada escalón arranca donde terminó el anterior.
    let corrido = 0
    deltas.forEach((l, i) => {
      const x = Number(l.valor.ars.valor)
      expect(base.data[i] as number).toBeCloseTo(Math.min(corrido, corrido + x), 4)
      corrido += x
    })
    expect(tabla.filas).toHaveLength(v.puente!.lineas.length)
  })

  it('tocar un escalón: el índice de la barra es su línea; en activos o dólar, los 3 que más sumaron y los 2 que más restaron', () => {
    const deltas = deltasPuente(v.puente!.lineas)
    expect((opcionPuente(v.puente!.lineas, 'USD', false).opcion as { xAxis: { data: string[] } }).xAxis.data).toHaveLength(deltas.length + 1)
    for (const parte of ['activo', 'tc'] as const) {
      const q = quienesDe(v.contribuyentes, parte, 'USD')
      expect(q.suman.length).toBeLessThanOrEqual(3)
      expect(q.restan.length).toBeLessThanOrEqual(2)
      const vs = (xs: typeof q.suman) => xs.map((x) => Number(x[parte].usd.valor))
      expect(vs(q.suman).every((x) => x > 0)).toBe(true)
      expect(vs(q.suman)).toEqual([...vs(q.suman)].sort((a, b) => b - a))
      expect(vs(q.restan).every((x) => x < 0)).toBe(true)
      expect(vs(q.restan)).toEqual([...vs(q.restan)].sort((a, b) => a - b))
    }
    // En dólares, el dólar restó a alguien (los pesos y las letras): aparece entre los que restaron.
    expect(quienesDe(v.contribuyentes, 'tc', 'USD').restan.length).toBeGreaterThan(0)
  })

  it('con una sola carga, la cascada no inventa escalones: null donde es "sin dato"', () => {
    const { opcion, tabla } = opcionPuente(unDia.puente!.lineas, 'USD', false)
    const [, tramo] = series(opcion)
    expect(valores(tramo).every((x) => x === null)).toBe(true)
    expect(tabla.filas[0][1]).not.toBe('sin dato')
    expect(tabla.filas.slice(1).every((f) => f[1] === 'sin dato')).toBe(true)
  })

  it('quién sumó y quién restó: dos tramos por partida (precio y dólar), y en el teléfono solo las primeras', () => {
    const todas = opcionContribuyentes(v.contribuyentes, 'ARS', false, null)
    expect(series(todas.opcion).map((s) => s.data.length)).toEqual([v.contribuyentes.length, v.contribuyentes.length])
    const cinco = opcionContribuyentes(v.contribuyentes, 'ARS', false, 5)
    expect(series(cinco.opcion)[0].data).toHaveLength(Math.min(5, v.contribuyentes.length))
    expect(cinco.tabla.filas).toHaveLength(v.contribuyentes.length)
    // El mismo ticker en varias cuentas (pesos en IEB, Galicia y Mercado Pago) se distingue por la cuenta; el resto, por el ticker solo.
    const rotulos = (todas.opcion as { yAxis: { data: string[] } }).yAxis.data
    expect(new Set(rotulos).size).toBe(rotulos.length)
    expect(rotulos.filter((r) => r.startsWith('ARS · ')).sort()).toEqual(['ARS · Galicia', 'ARS · IEB', 'ARS · Mercado Pago'])
    expect(rotulos).toContain('SPY')
    // Tocar la barra i abre la traza de barrasContribuyentes(…)[i]: el mismo orden que el eje.
    const barras = barrasContribuyentes(v.contribuyentes, null)
    expect(barras.map((x) => x.ticker)).toEqual(rotulos.map((r) => r.split(' · ')[0]))
    expect(barras.at(-1)).toBe(v.contribuyentes[0])
    expect(barrasContribuyentes(v.contribuyentes, 5)).toHaveLength(Math.min(5, v.contribuyentes.length))
  })

  it('un día con algún precio viejo (CO-5) es un punto hueco, con el mismo valor', () => {
    const viejos = v.serie.map((p, i) => (p.viejo ? i : -1)).filter((i) => i >= 0)
    expect(viejos.length).toBeGreaterThan(0)
    const [pat] = series(opcionPatrimonio(v.serie, v.aportado, null, 'ARS', false).opcion)
    for (const i of viejos) expect(pat.data[i]).toMatchObject({ symbol: 'emptyCircle', value: [v.serie[i].fecha, Number(v.serie[i].ars)] })
    const nuevo = v.serie.findIndex((p) => !p.viejo)
    expect(pat.data[nuevo]).toEqual([v.serie[nuevo].fecha, Number(v.serie[nuevo].ars)])
  })

  it('patrimonio, capital aportado y escenario en un eje de tiempo: el escenario arranca en el último dato real y sigue cada mes a su cierre', () => {
    const { opcion } = opcionPatrimonio(v.serie, v.aportado, v.futuro, 'USD', false)
    expect((opcion as { xAxis: { type: string } }).xAxis.type).toBe('time')
    const [pat, cap, esc] = series(opcion)
    const xs = (s: Serie) => s.data.map((d) => (Array.isArray(d) ? d : (d as { value: [string, number | null] }).value))
    expect(pat.data).toHaveLength(v.serie.length)
    expect(cap.data).toHaveLength(v.aportado.length)
    expect(xs(pat).map((p) => p[0])).toEqual(v.serie.map((p) => p.fecha))
    expect(xs(pat).map((p) => p[1])).toEqual(v.serie.map((p) => (p.usd === null ? null : Number(p.usd))))
    const e = xs(esc)
    expect(e).toHaveLength(v.futuro!.meses.length + 1)
    expect(e[0]).toEqual([v.serie.at(-1)!.fecha, Number(v.serie.at(-1)!.usd)])
    expect(e[1][0]).toBe(finDeMes(v.futuro!.meses[0].mes))
    expect(e.map((p) => p[0])).toEqual([...e.map((p) => p[0])].sort())
    expect(finDeMes('2027-02-01')).toBe('2027-02-28')
    expect(finDeMes('2028-02-01')).toBe('2028-02-29')
    expect(etiquetaFecha(Date.parse('2026-10-14T12:00:00'), false)).toBe('14/10')
    expect(etiquetaFecha(Date.parse('2026-10-14T12:00:00'), true)).toBe('oct-26')
    // Con un solo punto y sin escenario: una semana alrededor, sin marcas de horas.
    const uno = opcionPatrimonio(unDia.serie, unDia.aportado, null, 'ARS', false).opcion as { xAxis: { min: number; max: number; minInterval: number } }
    expect(uno.xAxis.max - uno.xAxis.min).toBe(6 * 86_400_000)
    expect(uno.xAxis.minInterval).toBe(86_400_000)
  })

  it('índice 100: las dos monedas arrancan en 100 el día cero y no muestran montos', () => {
    expect(indice100(['200', null, '250', '150'])).toEqual([100, null, 125, 75])
    expect(indice100([null, '50', '75'])).toEqual([null, 100, 150])
    expect(indice100([null, null])).toEqual([null, null])
    const { opcion, tabla } = opcionIndice(v.serie)
    const [ars, usd] = series(opcion)
    expect(valores(ars)[0]).toBe(100)
    expect(valores(usd)[0]).toBe(100)
    expect(ars.data).toHaveLength(v.serie.length)
    expect(tabla.filas.flat().join(' ')).not.toMatch(/\$/)
  })

  it('PnL por mes: una barra por mes en cada serie', () => {
    const { opcion, tabla } = opcionMeses(v.meses, 'ARS', false)
    for (const s of series(opcion)) expect(s.data).toHaveLength(v.meses.length)
    expect(tabla.filas).toHaveLength(v.meses.length)
  })

  it('modo privado: ni la tabla ni los ejes muestran montos', () => {
    for (const { opcion, tabla } of [opcionPuente(v.puente!.lineas, 'ARS', true), opcionMeses(v.meses, 'USD', true), opcionPatrimonio(v.serie, v.aportado, v.futuro, 'ARS', true)]) {
      expect(tabla.filas.flat().join(' ')).not.toMatch(/\$\s?[−+-]?\d/)
      const eje = (opcion.yAxis ?? opcion.xAxis) as { axisLabel?: { formatter?: (x: number) => string } }
      expect(eje.axisLabel?.formatter?.(1234567)).toBe('')
    }
    expect(cifraTexto(null, 'ARS', true)).toBe('sin dato')
  })
})
