// Cruce de realizado y no realizado (D-135) contra la referencia en Python
// (tests/referencia/realizado_referencia.py), escrita desde el plan sin mirar
// resultados.ts. casos-realizado.json trae 24 casos al azar con semilla fija
// (números inventados): apertura con y sin CCL de compra, compras, ventas
// parciales y totales, vencimientos, rentas y amortizaciones. Para regenerarlos:
// python3 tests/referencia/realizado_referencia.py
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { Decimal } from '@/lib/domain/dinero'
import { resultadosPorPartida } from '@/lib/domain/resultados'
import type { Activo, Hechos, Operacion } from '@/lib/domain/tipos'

type Txt = string | null
interface Caso {
  id: string
  riesgo: 'ARS' | 'USD'
  clase: 'cedear' | 'bono'
  t0: string
  t1: string
  ccl: Record<string, string>
  precios: Record<string, string>
  operaciones: { id: number; fecha: string; tipo: Operacion['tipo']; cantidad: string; precio: Txt; importe: Txt; ccl: Txt }[]
  esperado: Record<'resultado_ars' | 'resultado_usd' | 'realizado_ars' | 'realizado_usd' | 'no_realizado_ars' | 'no_realizado_usd', Txt>
}

const casos: Caso[] = JSON.parse(readFileSync(path.join(import.meta.dirname, 'casos-realizado.json'), 'utf8')).casos
const Dn = (x: Txt) => (x === null ? null : new Decimal(x))

function hechos(c: Caso): Hechos {
  const a: Activo = {
    id: 1,
    ticker: 'X1',
    nombre: 'X1',
    tipo: c.clase,
    moneda_riesgo: c.riesgo,
    geografia: c.riesgo === 'USD' ? 'US' : 'AR',
    indexacion: c.clase === 'bono' ? 'fija' : null,
    ticker_subyacente: null,
    fecha_vencimiento: null,
    color: null,
    activo_bool: true,
  }
  return {
    cuentas: [{ id: 1, nombre: 'IEB', tipo: 'broker', formato_carga: 'excel_ieb', activa: true }],
    activos: [a],
    operaciones: c.operaciones.map((o) => ({
      id: o.id,
      fecha: o.fecha,
      fecha_origen: null,
      cuenta_id: 1,
      activo_id: 1,
      tipo: o.tipo,
      cantidad: new Decimal(o.cantidad),
      moneda: 'ARS',
      precio: Dn(o.precio),
      importe: Dn(o.importe),
      comisiones: new Decimal(0),
      ccl_del_dia: Dn(o.ccl),
      carga_id: 1,
      notas: null,
    })),
    cotizaciones: Object.entries(c.precios).map(([fecha, p]) => ({ fecha, activo_id: 1, precio_pesos: new Decimal(p), precio_usd_subyacente: null, carga_id: 1 })),
    tipos_cambio: Object.entries(c.ccl).map(([fecha, x]) => ({ fecha, ccl: new Decimal(x), mep: null, cripto_venta: null, oficial: null, carga_id: 1 })),
    saldos: [],
    movimientos: [],
    pasivos: [],
    pasivo_saldos: [],
    bienes: [],
    valuaciones: [],
    feriados: [],
    cargas: [],
  }
}

const igual = (ref: Txt, motor: Decimal | null) => {
  if (ref === null || motor === null) return ref === null && motor === null
  const r = new Decimal(ref)
  const dif = r.minus(motor).abs()
  return dif.lte('1e-18') || dif.lte(Decimal.max(r.abs(), motor.abs()).times('1e-12'))
}

describe('realizado y no realizado contra la referencia en Python (D-135)', () => {
  it('hay al menos 20 casos', () => expect(casos.length).toBeGreaterThanOrEqual(20))
  for (const c of casos) {
    it(`${c.id}: ${c.riesgo}, ${c.operaciones.filter((o) => o.fecha > c.t0 && o.fecha <= c.t1).map((o) => o.tipo).join(', ') || 'sin operaciones en el período'}`, () => {
      const filas = resultadosPorPartida(hechos(c), c.t0, c.t1, c.t1)
      const f = filas.find((x) => x.clave === 'p:1:1')
      if (!f) {
        // Cerrada antes del período y sin operaciones adentro: nada que comparar (la referencia da 0).
        for (const k of ['resultado_ars', 'realizado_ars'] as const) expect(c.esperado[k] === null || new Decimal(c.esperado[k]!).isZero()).toBe(true)
        return
      }
      if (f.realizado === 'no_aplica' || f.no_realizado === 'no_aplica') throw new Error('una posición siempre tiene realizado')
      const dif: string[] = []
      for (const k of ['ars', 'usd'] as const) {
        const pares: [string, Txt, Decimal | null][] = [
          [`resultado_${k}`, c.esperado[`resultado_${k}`], f.resultado[k].valor],
          [`realizado_${k}`, c.esperado[`realizado_${k}`], f.realizado[k].valor],
          [`no_realizado_${k}`, c.esperado[`no_realizado_${k}`], f.no_realizado[k].valor],
        ]
        for (const [campo, ref, motor] of pares) if (!igual(ref, motor)) dif.push(`${campo}: referencia ${ref}, motor ${motor?.toFixed() ?? null}`)
      }
      expect(dif).toEqual([])
    })
  }
})
