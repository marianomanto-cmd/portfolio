import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { Decimal } from '@/lib/domain/dinero'
import { conAjuste, conVar } from '@/lib/domain/flujo/panel'
import { proyectar } from '@/lib/domain/flujo/proyeccion'
import { codificar, completarConIgual, decodificar } from '@/lib/domain/flujo/supuestos'
import type { Supuestos } from '@/lib/domain/flujo/tipos'
import { ejemploFlujo } from '@/lib/vistas/ejemplo-flujo'

// Propiedades de la proyección sobre la cartera del demo (números inventados),
// con supuestos al azar dentro de sus rangos:
// - el PnL del mes se parte sin residuo: aportes + precio + dólar = Δ financiero (D-35), en pesos y en dólares;
// - el excedente es ingresos − gastos − cuota (+ vencimientos aparte), cuando todo tiene dato;
// - nada inventado: ningún mes con NaN, y un "sin dato" nunca aparece como 0;
// - los supuestos van y vuelven por la URL sin perder nada.

const v = ejemploFlujo('completo')
const base = v.base!
const inicial = completarConIgual(v.supuestos_iniciales, base)

const decimal1 = (max: number) => fc.integer({ min: 0, max: max * 10 }).map((n) => (n / 10).toFixed(1))
const dir = fc.constantFrom<'baja' | 'igual' | 'sube'>('baja', 'igual', 'sube')
const variable = (max: number) => fc.record({ dir, valor: decimal1(max) }).map((x) => (x.dir === 'igual' ? { dir: x.dir, valor: null } : x))

const escenario = fc
  .record({
    horizonte: fc.integer({ min: 1, max: 36 }),
    dev: fc.record({ dir: fc.constantFrom<'igual' | 'sube'>('igual', 'sube'), valor: decimal1(8) }),
    cedear: variable(40),
    accion: variable(40),
    liquidez: variable(40),
    ingresoFeb: variable(60),
    ajuste: fc.option(decimal1(5), { nil: null }),
    pct: fc.integer({ min: 0, max: 100 }),
  })
  .map((x): Supuestos => {
    let s: Supuestos = { ...inicial, horizonte_meses: x.horizonte, politica: { ...inicial.politica, pct: String(x.pct), origen: 'elegida' } }
    s = conVar(s, 'devaluacion.0', x.dev.dir === 'igual' ? { dir: 'igual', valor: null } : x.dev)
    s = conVar(s, 'retorno.cedear', x.cedear)
    s = conVar(s, 'retorno.accion_local', x.accion)
    s = conVar(s, 'retorno.liquidez_pesos', x.liquidez)
    s = conVar(s, 'ingreso_usd.1', x.ingresoFeb)
    s = conAjuste(s, 0, x.ajuste)
    return s
  })

const D = (x: string | null) => (x === null ? null : new Decimal(x))

describe('propiedades de la proyección (demo inventado)', () => {
  it('aportes + precio + dólar = Δ financiero, cada mes, en pesos y en dólares', () => {
    fc.assert(
      fc.property(escenario, (s) => {
        const p = proyectar(base, s)
        expect(p.estado).toBe('lista')
        for (const [i, m] of p.meses.entries()) {
          for (const k of ['ars', 'usd'] as const) {
            const fin = D(m.financiero[k])
            const partes = [m.pnl.aportes[k], m.pnl.activo[k], m.pnl.tc[k]].map(D)
            if (fin === null || partes.some((x) => x === null)) continue
            const suma = (partes as Decimal[]).reduce((a, x) => a.plus(x), new Decimal(0))
            const anterior = i === 0 ? null : D(p.meses[i - 1].financiero[k])
            if (anterior !== null) expect(suma.minus(fin.minus(anterior)).abs().lt('1e-12'), `${m.mes} ${k}`).toBe(true)
          }
        }
      }),
      { numRuns: 60 },
    )
  })

  it('excedente = ingresos − gastos − cuota cuando todo tiene dato; nada es NaN', () => {
    fc.assert(
      fc.property(escenario, (s) => {
        const p = proyectar(base, s)
        for (const m of p.meses) {
          for (const k of ['ars', 'usd'] as const) {
            for (const campo of [m.ingresos, m.gastos, m.cuota, m.excedente, m.financiero, m.invertido]) {
              const x = campo[k]
              if (x !== null) expect(Number.isFinite(Number(x))).toBe(true)
            }
          }
          const [ing, gas, cuo, exc] = [m.ingresos.ars, m.gastos.ars, m.cuota.ars, m.excedente.ars].map(D)
          if (ing && gas && cuo && exc && !m.reintegro?.ars) expect(exc.minus(ing.minus(gas).minus(cuo)).abs().lt('1e-9'), m.mes).toBe(true)
        }
      }),
      { numRuns: 60 },
    )
  })

  it('los supuestos van y vuelven por la URL sin perder nada', () => {
    fc.assert(
      fc.property(escenario, (s) => {
        expect(decodificar(codificar(s))).toEqual(s)
      }),
      { numRuns: 100 },
    )
  })
})
