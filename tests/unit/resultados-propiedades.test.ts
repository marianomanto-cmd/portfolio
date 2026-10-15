// Propiedades de Evolución y PnL (plan §4 B.2, D-135, D-137), con fast-check y
// montos inventados: para secuencias al azar de apertura, compras, ventas
// parciales, rentas, amortizaciones, precios y CCL, y cuotas del leasing pagadas
// desde una cuenta seguida:
//   - activo + TC + sin atribuir = resultado = realizado + no realizado, por
//     partida y en el total, en pesos y en dólares;
//   - el realizado coincide con un cálculo independiente (PPC promedio escrito
//     acá) y el no realizado con la variación de (valor − costo);
//   - el puente cierra (cuadre 0) y un período es la suma de sus partes;
//   - una cuota pagada desde tus cuentas es una salida: el saldo que la paga no
//     pierde nada.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { Decimal } from '@/lib/domain/dinero'
import { sumarDias } from '@/lib/domain/fechas'
import { foto } from '@/lib/domain/foto'
import { tenencias } from '@/lib/domain/posiciones'
import { puente, resultadosPorPartida, type Puente } from '@/lib/domain/resultados'
import { AAA, BBB, D, ccl, cuota, op, precio, reiniciarIds, saldo, vacios } from '@/lib/domain/resultados.fixture'
import type { Cuota } from '@/lib/domain/pasivos/tipos'
import type { Fecha, Hechos, Operacion } from '@/lib/domain/tipos'

const TOL = new Decimal('1e-12')
const igual = (a: Decimal, b: Decimal) => a.minus(b).abs().lte(TOL.times(Decimal.max(1, a.abs(), b.abs())))

type Evento = { tipo: 'compra' | 'venta' | 'renta' | 'amortizacion'; activo: 0 | 1; x: number }

const arbCaso = fc.record({
  dias: fc.integer({ min: 3, max: 6 }),
  saltos: fc.array(fc.integer({ min: 1, max: 3 }), { minLength: 6, maxLength: 6 }),
  ccl: fc.array(fc.integer({ min: 90_000, max: 160_000 }), { minLength: 6, maxLength: 6 }),
  precios: fc.array(fc.array(fc.integer({ min: 500, max: 5_000 }), { minLength: 6, maxLength: 6 }), { minLength: 2, maxLength: 2 }),
  aperturas: fc.array(fc.record({ q: fc.integer({ min: 10, max: 500 }), ppp: fc.integer({ min: 300, max: 6_000 }), conCcl: fc.boolean() }), { minLength: 2, maxLength: 2 }),
  eventos: fc.array(
    fc.record({
      dia: fc.integer({ min: 1, max: 5 }),
      tipo: fc.constantFrom<Evento['tipo']>('compra', 'venta', 'renta', 'amortizacion'),
      activo: fc.constantFrom<0 | 1>(0, 1),
      x: fc.integer({ min: 1, max: 90 }),
    }),
    { maxLength: 6 },
  ),
  cuotas: fc.array(fc.record({ dia: fc.integer({ min: 1, max: 5 }), monto: fc.integer({ min: 10_000, max: 90_000 }) }), { maxLength: 2 }),
  periodo: fc.tuple(fc.nat(), fc.nat()),
})

interface Armado {
  h: Hechos
  fechas: Fecha[]
  cuotas: Cuota[]
}

type CasoAzar = typeof arbCaso extends fc.Arbitrary<infer T> ? T : never

function armar(c: CasoAzar): Armado {
  reiniciarIds()
  const h = vacios()
  const fechas: Fecha[] = ['2026-10-01']
  for (let i = 1; i < c.dias; i++) fechas.push(sumarDias(fechas[i - 1], c.saltos[i]))
  const activos = [AAA, BBB]
  const cclDe = (i: number) => new Decimal(c.ccl[i]).div(100)
  fechas.forEach((f, i) => {
    ccl(h, f, cclDe(i).toFixed())
    activos.forEach((a, k) => precio(h, f, a.id, String(c.precios[k][i])))
  })
  // Aperturas el día cero, con el PPP del bróker y, a veces, el CCL de compra.
  activos.forEach((a, k) => {
    const ap = c.aperturas[k]
    h.operaciones.push(op({ fecha: fechas[0], activo_id: a.id, tipo: 'apertura', cantidad: D(ap.q), precio: D(ap.ppp), ccl_del_dia: ap.conCcl ? cclDe(0).minus(37) : null }))
  })
  // Eventos: cada uno con el CCL de su día y montos coherentes con la tenencia de ese momento.
  const eventos = [...c.eventos].filter((e) => e.dia < c.dias).sort((a, b) => a.dia - b.dia)
  for (const e of eventos) {
    const a = activos[e.activo]
    const f = fechas[e.dia]
    const p = new Decimal(c.precios[e.activo][e.dia])
    const ccld = cclDe(e.dia)
    const t = tenencias(h.operaciones, f).get(`1:${a.id}`)
    const q = t?.cantidad ?? new Decimal(0)
    if (e.tipo === 'compra') {
      const cant = new Decimal(e.x)
      h.operaciones.push(op({ fecha: f, activo_id: a.id, tipo: 'compra', cantidad: cant, precio: p, importe: cant.times(p), ccl_del_dia: ccld }))
    } else if (e.tipo === 'venta') {
      if (q.isZero()) continue
      const cant = q.times(e.x).div(100).toDecimalPlaces(0, Decimal.ROUND_DOWN)
      if (cant.isZero() || cant.gte(q)) continue
      h.operaciones.push(op({ fecha: f, activo_id: a.id, tipo: 'venta', cantidad: cant, precio: p, importe: cant.times(p), ccl_del_dia: ccld }))
    } else if (e.tipo === 'renta') {
      if (q.isZero()) continue
      h.operaciones.push(op({ fecha: f, activo_id: a.id, tipo: 'renta', cantidad: D(0), importe: q.times(e.x), ccl_del_dia: ccld }))
    } else {
      // Amortización chica: no llega a dejar el costo en cero (B16 queda afuera de esta propiedad).
      if (q.isZero() || t?.costo_ars === null || t?.costo_ars === undefined) continue
      const imp = t.costo_ars.times(e.x).div(1000).toDecimalPlaces(2, Decimal.ROUND_DOWN)
      if (imp.isZero()) continue
      h.operaciones.push(op({ fecha: f, activo_id: a.id, tipo: 'amortizacion', cantidad: D(0), importe: imp, ccl_del_dia: ccld }))
    }
  }
  // Mercado Pago: un saldo en pesos que solo baja por las cuotas del leasing que paga.
  const cuotas: Cuota[] = []
  let mp = new Decimal(1_000_000)
  const pagos = new Map<number, Decimal>()
  c.cuotas.forEach((q, i) => {
    if (q.dia >= c.dias) return
    pagos.set(q.dia, (pagos.get(q.dia) ?? new Decimal(0)).plus(q.monto))
    cuotas.push(cuota({ nro: i + 1, fecha_vencimiento: fechas[q.dia], fecha_pago: fechas[q.dia], cuenta_pago_id: 3, monto_pagado: D(q.monto) }))
  })
  fechas.forEach((f, i) => {
    mp = mp.minus(pagos.get(i) ?? 0)
    saldo(h, f, 3, 'ARS', mp.toFixed())
  })
  return { h, fechas, cuotas }
}

/** Realizado independiente: PPC promedio, cada venta saca costo en proporción; rentas suman; amortizaciones bajan el costo. */
function realizadoAMano(ops: Operacion[], activo_id: number, d0: Fecha, d1: Fecha): { ars: Decimal; usd: Decimal | null } {
  let q = new Decimal(0)
  let cArs = new Decimal(0)
  let cUsd: Decimal | null = new Decimal(0)
  let rArs = new Decimal(0)
  let rUsd: Decimal | null = new Decimal(0)
  const mias = ops.filter((o) => o.activo_id === activo_id && o.fecha <= d1).sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.id - b.id))
  for (const o of mias) {
    const dentro = o.fecha > d0
    if (o.tipo === 'apertura' || o.tipo === 'compra') {
      const costo = o.importe ?? o.cantidad.times(o.precio!)
      q = q.plus(o.cantidad)
      cArs = cArs.plus(costo)
      cUsd = cUsd === null || o.ccl_del_dia === null ? null : cUsd.plus(costo.div(o.ccl_del_dia))
    } else if (o.tipo === 'venta') {
      const f = o.cantidad.div(q)
      if (dentro) {
        rArs = rArs.plus(o.importe!).minus(cArs.times(f))
        rUsd = rUsd === null || cUsd === null ? null : rUsd.plus(o.importe!.div(o.ccl_del_dia!)).minus(cUsd.times(f))
      }
      cArs = cArs.minus(cArs.times(f))
      cUsd = cUsd === null ? null : cUsd.minus(cUsd.times(f))
      q = q.minus(o.cantidad)
    } else if (o.tipo === 'renta') {
      if (dentro) {
        rArs = rArs.plus(o.importe!)
        rUsd = rUsd === null ? null : rUsd.plus(o.importe!.div(o.ccl_del_dia!))
      }
    } else if (o.tipo === 'amortizacion') {
      cArs = cArs.minus(o.importe!)
      cUsd = cUsd === null ? null : cUsd.minus(o.importe!.div(o.ccl_del_dia!))
    }
  }
  return { ars: rArs, usd: rUsd }
}

const sumables = (p: Puente) => p.lineas.filter((l) => !l.informativa && l.clave !== 'inicial' && l.clave !== 'final')

describe('propiedades de Evolución y PnL', () => {
  it('por partida: activo + TC + sin atribuir = resultado = realizado + no realizado; realizado y no realizado como a mano', () => {
    fc.assert(
      fc.property(arbCaso, (c) => {
        const { h, fechas, cuotas } = armar(c)
        const i = c.periodo[0] % fechas.length
        const j = c.periodo[1] % fechas.length
        const [d0, d1] = i < j ? [fechas[i], fechas[j]] : i > j ? [fechas[j], fechas[i]] : [fechas[0], fechas.at(-1)!]
        const hoy = fechas.at(-1)!
        const filas = resultadosPorPartida(h, d0, d1, hoy, { cuotas })
        expect(filas.length).toBeGreaterThan(0)
        for (const f of filas) {
          for (const k of ['ars', 'usd'] as const) {
            const r = f.resultado[k].valor!
            expect(r, `${f.ticker} ${k}`).not.toBeNull()
            expect(igual(f.activo[k].valor!.plus(f.tc[k].valor!).plus(f.sin_atribuir[k].valor!), r), `${f.ticker} ${k}: partes`).toBe(true)
            if (f.realizado === 'no_aplica' || f.no_realizado === 'no_aplica') continue
            const re = f.realizado[k].valor
            const nr = f.no_realizado[k].valor
            if (re === null) {
              expect(nr).toBeNull()
              continue
            }
            expect(igual(re.plus(nr!), r), `${f.ticker} ${k}: realizado + no realizado`).toBe(true)
          }
          if (f.clase === 'posicion' && f.realizado !== 'no_aplica' && f.no_realizado !== 'no_aplica') {
            const activo_id = Number(f.clave.split(':')[2])
            const mano = realizadoAMano(h.operaciones, activo_id, d0, d1)
            expect(igual(f.realizado.ars.valor!, mano.ars), `${f.ticker}: realizado en pesos`).toBe(true)
            if (mano.usd === null) expect(f.realizado.usd.valor).toBeNull()
            else expect(igual(f.realizado.usd.valor!, mano.usd), `${f.ticker}: realizado en dólares`).toBe(true)
            // No realizado = cambio de (valor − costo): sin aperturas dentro del período.
            const t0 = tenencias(h.operaciones, d0).get(`1:${activo_id}`)
            const t1 = tenencias(h.operaciones, d1).get(`1:${activo_id}`)
            const v0 = foto(h, d0, { traza: false }).items.find((x) => x.clave === f.clave)?.valor_ars.valor ?? new Decimal(0)
            const v1 = foto(h, d1, { traza: false }).items.find((x) => x.clave === f.clave)?.valor_ars.valor ?? new Decimal(0)
            const gan = (v: Decimal, t?: ReturnType<typeof tenencias> extends Map<string, infer T> ? T : never) => v.minus(t?.costo_ars ?? 0)
            expect(igual(f.no_realizado.ars.valor!, gan(v1, t1).minus(gan(v0, t0))), `${f.ticker}: no realizado = Δ(valor − costo)`).toBe(true)
          }
          // El saldo que paga las cuotas no pierde nada: cada cuota es una salida.
          if (f.clave === 's:3:ARS') expect(f.resultado.ars.valor!.isZero(), 'Mercado Pago no pierde por las cuotas').toBe(true)
        }
      }),
      { numRuns: 120 },
    )
  })

  it('el puente cierra en las dos monedas y un período es la suma de sus partes', () => {
    fc.assert(
      fc.property(arbCaso, (c) => {
        const { h, fechas, cuotas } = armar(c)
        const hoy = fechas.at(-1)!
        const a = fechas[0]
        const m = fechas[Math.floor(fechas.length / 2)]
        const z = fechas.at(-1)!
        for (const vista of ['financiero', 'total'] as const) {
          const todo = puente(h, a, z, vista, hoy, { cuotas })
          if (vista === 'financiero') expect(todo.cuadre.ok, todo.cuadre.detalle).toBe(true)
          const p1 = puente(h, a, m, vista, hoy, { cuotas })
          const p2 = puente(h, m, z, vista, hoy, { cuotas })
          for (const l of sumables(todo)) {
            for (const k of ['ars', 'usd'] as const) {
              const x1 = p1.lineas.find((x) => x.clave === l.clave)![k].valor!
              const x2 = p2.lineas.find((x) => x.clave === l.clave)![k].valor!
              expect(igual(x1.plus(x2), l[k].valor!), `${vista} ${l.clave} ${k}`).toBe(true)
            }
          }
          const cuotasLinea = todo.lineas.find((l) => l.clave === 'cuotas')!
          const pagado = cuotas.filter((q) => q.fecha_pago! > a && q.fecha_pago! <= z).reduce((s, q) => s.plus(q.monto_pagado!), new Decimal(0))
          expect(igual(cuotasLinea.ars.valor!, pagado.negated())).toBe(true)
        }
      }),
      { numRuns: 80 },
    )
  })
})
