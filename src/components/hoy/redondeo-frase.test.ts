// Mostrar: lo que se ve en la frase y en las tarjetas de Hoy suma exacto lo
// que se ve (visión §4.0, manual §4.1). Con el ejemplo (números inventados) y
// con valores al azar.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { CalcVista } from '@/lib/domain/calc'
import { Decimal } from '@/lib/domain/dinero'
import type { FraseDelDia, TarjetaPatrimonio, VistaHoy } from '@/lib/vistas/contratos'
import { ejemploHoy, ejemploHoyVariante } from '@/lib/vistas/ejemplo'
import { Mostrar } from './redondeo-frase'

const suma = (m: Mostrar, cs: (CalcVista | null | undefined)[]) =>
  cs.filter((c): c is CalcVista => Boolean(c)).reduce((a, c) => a.plus(m.valor(c) ?? 'NaN'), new Decimal(0))

/** Total mostrado − suma de las partes mostradas, en pesos y en dólares, de la frase y de cada tarjeta. */
function diferencias(v: VistaHoy): Record<string, string> {
  const m = new Mostrar(v.frase, [v.financiero, v.total])
  const out: Record<string, string> = {}
  const f = v.frase
  if (f) {
    for (const k of ['ars', 'usd'] as const) {
      if (f.variacion[k].valor === null) continue
      out[`frase ${k}`] = new Decimal(m.valor(f.variacion[k])!).minus(suma(m, [f.tc[k], f.activos[k], f.sin_atribuir?.[k]])).toFixed()
    }
  }
  for (const t of [v.financiero, v.total]) {
    if (!t.variacion || !t.desglose) continue
    for (const k of ['ars', 'usd'] as const) {
      const d = t.desglose
      if (t.variacion[k].valor === null || [d.tc[k], d.activos[k], d.sin_atribuir[k]].some((c) => c.valor === null)) continue
      out[`${t.titulo} ${k}`] = new Decimal(m.valor(t.variacion[k])!).minus(suma(m, [d.tc[k], d.activos[k], d.sin_atribuir[k]])).toFixed()
    }
  }
  return out
}

describe('Mostrar: lo que se ve suma exacto lo que se ve', () => {
  for (const [nombre, v] of [
    ['el ejemplo', ejemploHoy()],
    ['la carga express', ejemploHoyVariante('express')],
    ['datos viejos', ejemploHoyVariante('viejo')],
  ] as const) {
    it(nombre, () => {
      const d = diferencias(v)
      expect(Object.keys(d).length).toBeGreaterThan(0)
      for (const [donde, dif] of Object.entries(d)) expect(dif, donde).toBe('0')
    })
  }

  it('con valores al azar: el total y sus partes, redondeados a enteros, siguen sumando', () => {
    const c = (valor: string, formula: string): CalcVista => ({ valor, formula, insumos: [], etiquetas: [] })
    const centavos = fc.integer({ min: -5_000_000_00, max: 5_000_000_00 }).map((n) => new Decimal(n).div(100))
    fc.assert(
      fc.property(centavos, centavos, centavos, (a, b, s) => {
        const par = (x: Decimal, n: string) => ({ ars: c(x.toFixed(), `${n} en pesos`), usd: c(x.div(1500).toFixed(), `${n} en dólares`) })
        const tc = par(a, 'TC')
        const act = par(b, 'activos')
        const sin = par(s, 'sin atribuir')
        const vari = { ars: c(a.plus(b).plus(s).toFixed(), 'variación en pesos'), usd: c(a.div(1500).plus(b.div(1500)).plus(s.div(1500)).toFixed(), 'variación en dólares') }
        const frase = { variacion: vari, tc, activos: act, sin_atribuir: sin, partes: [], desde: '2026-10-14', hasta: '2026-10-15' } as unknown as FraseDelDia
        const tarjeta = { titulo: 'Patrimonio financiero', variacion: vari, desglose: { tc, activos: act, sin_atribuir: sin } } as unknown as TarjetaPatrimonio
        const m = new Mostrar(frase, [tarjeta])
        for (const k of ['ars', 'usd'] as const) {
          expect(new Decimal(m.valor(vari[k])!).minus(suma(m, [tc[k], act[k], sin[k]])).toFixed()).toBe('0')
          // Y cada parte mostrada está a menos de una unidad de su valor exacto.
          for (const p of [tc[k], act[k], sin[k]]) expect(new Decimal(m.valor(p)!).minus(p.valor!).abs().lt(1)).toBe(true)
        }
      }),
      { numRuns: 300 },
    )
  })
})
