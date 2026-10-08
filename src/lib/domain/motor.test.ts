import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { armarCartera, armarExposicion, armarHoy } from '@/lib/vistas/armar'
import { calc } from './calc'
import { aTexto, dec, Decimal, leerNumeroAR, monto, numero, porcentaje } from './dinero'
import { diasHabilesEntre, esViejo, fechaEnCordoba } from './fechas'
import { foto, sumaCalc } from './foto'
import { ppcCalc, tenencias } from './posiciones'
import type { Activo, Cuenta, Hechos, Operacion } from './tipos'
import { parteCalc, variacion } from './variacion'

// ───────────── Fábrica de hechos (números inventados) ─────────────

const D = (x: string | number) => new Decimal(x)

const CUENTAS: Cuenta[] = [
  { id: 1, nombre: 'IEB', tipo: 'broker', formato_carga: 'excel_ieb', activa: true },
  { id: 2, nombre: 'Galicia', tipo: 'banco', formato_carga: 'captura', activa: true },
  { id: 3, nombre: 'Mercado Pago', tipo: 'billetera', formato_carga: 'captura', activa: true },
]

const activo = (id: number, ticker: string, tipo: Activo['tipo'], moneda: 'ARS' | 'USD'): Activo => ({
  id,
  ticker,
  nombre: ticker,
  tipo,
  moneda_riesgo: moneda,
  geografia: moneda === 'USD' ? 'US' : 'AR',
  indexacion: tipo === 'bono' || tipo === 'lecap' ? 'fija' : null,
  ticker_subyacente: tipo === 'cedear' ? ticker : null,
  fecha_vencimiento: null,
  color: null,
  activo_bool: true,
})

const SPY = activo(1, 'SPY', 'cedear', 'USD')
const LECAP = activo(2, 'S13N6', 'lecap', 'ARS')

let idOp = 1
const op = (o: Partial<Operacion> & Pick<Operacion, 'fecha' | 'activo_id' | 'tipo' | 'cantidad'>): Operacion => ({
  id: idOp++,
  fecha_origen: null,
  cuenta_id: 1,
  moneda: 'ARS',
  precio: null,
  importe: null,
  comisiones: D(0),
  ccl_del_dia: null,
  carga_id: 1,
  notas: null,
  ...o,
})

function hechosBase(): Hechos {
  return {
    cuentas: CUENTAS,
    activos: [SPY, LECAP],
    operaciones: [],
    cotizaciones: [],
    tipos_cambio: [],
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

const tc = (fecha: string, ccl: string | number) => ({ fecha, ccl: D(ccl), mep: null, cripto_venta: null, oficial: null, carga_id: 1 })
const cot = (fecha: string, activo_id: number, precio: string | number) => ({ fecha, activo_id, precio_pesos: D(precio), precio_usd_subyacente: null, carga_id: 1 })

// ───────────── Dinero y fechas ─────────────

describe('dinero', () => {
  it('rechaza números de JavaScript: los numeric se leen como texto (D-32)', () => {
    expect(() => dec(1.5 as unknown as string)).toThrow(/::text/)
    expect(dec(null)).toBeNull()
    expect(dec('')).toBeNull()
    expect(dec('0.1')!.plus(dec('0.2')!).toFixed()).toBe('0.3')
    expect(() => dec('NaN')).toThrow()
  })
  it('formatea en es-AR sin pasar por float', () => {
    expect(numero('1234567.891', 2)).toBe('1.234.567,89')
    expect(monto('-1234.5', 'USD')).toBe('−US$ 1.234,50')
    expect(monto('590125', 'ARS', { signo: true })).toBe('+$ 590.125')
    expect(porcentaje('0.0057', { signo: true })).toBe('+0,57%')
    expect(numero('12345678901234567890.12', 2)).toBe('12.345.678.901.234.567.890,12')
    expect(aTexto(D('1e-7'))).toBe('0.0000001')
  })
  it('lee números escritos en formato argentino', () => {
    expect(leerNumeroAR('1.548,2')).toBe('1548.2')
    expect(leerNumeroAR('1548,20')).toBe('1548.2')
    expect(leerNumeroAR('1548.2')).toBe('1548.2')
    expect(leerNumeroAR('1.548')).toBe('1548')
    expect(leerNumeroAR('$ 14.625.459,70')).toBe('14625459.7')
    expect(leerNumeroAR('abc')).toBeNull()
  })
})

describe('fechas', () => {
  it('la fecha es la de Córdoba, no la del servidor', () => {
    expect(fechaEnCordoba(new Date('2026-10-07T03:00:00Z'))).toBe('2026-10-07')
    expect(fechaEnCordoba(new Date('2026-10-08T02:30:00Z'))).toBe('2026-10-07')
  })
  it('días hábiles y dato viejo (D-16)', () => {
    const fer = new Set<string>()
    expect(diasHabilesEntre('2026-10-09', '2026-10-13', fer)).toBe(2) // vie → mar
    expect(esViejo('2026-10-09', '2026-10-12', fer)).toBe(false) // el lunes no es viejo
    expect(esViejo('2026-10-07', '2026-10-12', fer)).toBe(true)
    expect(diasHabilesEntre('2026-10-09', '2026-10-13', new Set(['2026-10-12']))).toBe(1)
  })
})

// ───────────── PPC ─────────────

describe('tenencias y PPC', () => {
  it('promedio ponderado en pesos y en dólares, cada compra a su CCL', () => {
    const ops = [
      op({ fecha: '2026-10-01', activo_id: 1, tipo: 'compra', cantidad: D(10), precio: D(20000), ccl_del_dia: D(1000) }),
      op({ fecha: '2026-10-02', activo_id: 1, tipo: 'compra', cantidad: D(10), precio: D(22000), ccl_del_dia: D(1100) }),
    ]
    const t = tenencias(ops).get('1:1')!
    expect(t.cantidad.toFixed()).toBe('20')
    expect(t.costo_ars!.toFixed()).toBe('420000')
    expect(t.costo_usd!.toFixed()).toBe('400') // 200 + 200
    expect(ppcCalc(t, 'ARS').valor!.toFixed()).toBe('21000')
    expect(ppcCalc(t, 'USD').valor!.toFixed()).toBe('20')
  })
  it('una venta saca costo en proporción; un ajuste de ratio no toca el costo', () => {
    const ops = [
      op({ fecha: '2026-10-01', activo_id: 1, tipo: 'compra', cantidad: D(10), precio: D(1000), ccl_del_dia: D(1000) }),
      op({ fecha: '2026-10-02', activo_id: 1, tipo: 'venta', cantidad: D(4), precio: D(1500), ccl_del_dia: D(1000) }),
      op({ fecha: '2026-10-03', activo_id: 1, tipo: 'ajuste_ratio', cantidad: D(6) }),
    ]
    const t = tenencias(ops).get('1:1')!
    expect(t.cantidad.toFixed()).toBe('12')
    expect(t.costo_ars!.toFixed()).toBe('6000')
  })
  it('apertura sin CCL: PPC en pesos sí, en dólares "sin dato" (D-14)', () => {
    const t = tenencias([op({ fecha: '2026-10-01', activo_id: 2, tipo: 'apertura', cantidad: D(1000), precio: D('1.06') })]).get('1:2')!
    expect(ppcCalc(t, 'ARS').valor!.toFixed()).toBe('1.06')
    const u = ppcCalc(t, 'USD')
    expect(u.valor).toBeNull()
    expect(u.motivo).toMatch(/CCL de compra/)
  })
  it('compra del día sin precio: pendiente, nunca cero (D-19)', () => {
    const t = tenencias([op({ fecha: '2026-10-07', activo_id: 1, tipo: 'compra', cantidad: D(191), ccl_del_dia: D(1500) })]).get('1:1')!
    expect(t.cantidad.toFixed()).toBe('191')
    expect(t.costo_ars).toBeNull()
    expect(t.etiquetas).toContain('pendiente')
  })
})

// ───────────── Desglose D-35: los ejemplos de la investigación ─────────────

describe('desglose activo / tipo de cambio (D-35)', () => {
  it('CEDEAR: sube 10% en pesos, el CCL sube 12%: perdés en dólares', () => {
    const h = hechosBase()
    h.operaciones = [op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(100), precio: D(10000) })]
    h.tipos_cambio = [tc('2026-10-01', 1000), tc('2026-10-02', 1120)]
    h.cotizaciones = [cot('2026-10-01', 1, 10000), cot('2026-10-02', 1, 11000)]
    const v = variacion(h, '2026-10-01', '2026-10-02')
    const c = v.contribuciones[0]
    expect(c.resultado.ars.toFixed()).toBe('100000')
    expect(c.tc.ars.toFixed()).toBe('120000') // US$ 1.000 × (1120 − 1000)
    expect(c.activo.ars.toFixed(2)).toBe('-20000.00')
    expect(c.resultado.usd.toFixed(2)).toBe('-17.86')
    expect(c.activo.usd.toFixed(2)).toBe('-17.86')
    expect(c.tc.usd.isZero()).toBe(true)
  })
  it('LECAP: +2,5% en pesos con el mismo salto de CCL', () => {
    const h = hechosBase()
    h.operaciones = [op({ fecha: '2026-10-01', activo_id: 2, tipo: 'apertura', cantidad: D(1000000), precio: D(1) })]
    h.tipos_cambio = [tc('2026-10-01', 1000), tc('2026-10-02', 1120)]
    h.cotizaciones = [cot('2026-10-01', 2, 1), cot('2026-10-02', 2, '1.025')]
    const c = variacion(h, '2026-10-01', '2026-10-02').contribuciones[0]
    expect(c.activo.usd.toFixed(2)).toBe('25.00')
    expect(c.tc.usd.toFixed(2)).toBe('-109.82')
    expect(c.resultado.usd.toFixed(2)).toBe('-84.82')
  })
  it('una compra en el intervalo es un flujo, no una ganancia', () => {
    const h = hechosBase()
    h.operaciones = [
      op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(10), precio: D(1000) }),
      op({ fecha: '2026-10-02', activo_id: 1, tipo: 'compra', cantidad: D(10), precio: D(1000), ccl_del_dia: D(1000) }),
    ]
    h.tipos_cambio = [tc('2026-10-01', 1000), tc('2026-10-02', 1000)]
    h.cotizaciones = [cot('2026-10-01', 1, 1000), cot('2026-10-02', 1, 1000)]
    const c = variacion(h, '2026-10-01', '2026-10-02').contribuciones[0]
    expect(c.resultado.ars.isZero()).toBe(true)
    expect(c.resultado.usd.isZero()).toBe(true)
  })
  it('sin precio nuevo: el cambio va a "sin atribuir" (D-64)', () => {
    const h = hechosBase()
    h.operaciones = [op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(10), precio: D(1000) })]
    h.tipos_cambio = [tc('2026-10-01', 1000), tc('2026-10-02', 1100)]
    h.cotizaciones = [cot('2026-10-01', 1, 1000)]
    const c = variacion(h, '2026-10-01', '2026-10-02').contribuciones[0]
    expect(c.arrastrado).toBe(true)
    expect(c.activo.ars.isZero() && c.tc.ars.isZero()).toBe(true)
    expect(c.sin_atribuir.usd.toFixed(4)).toBe(c.resultado.usd.toFixed(4))
  })
  it('falta un precio: el total es "sin dato" con la suma parcial a la vista (D-65)', () => {
    const h = hechosBase()
    h.operaciones = [
      op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(10), precio: D(1000) }),
      op({ fecha: '2026-10-01', activo_id: 2, tipo: 'apertura', cantidad: D(10), precio: D(1) }),
    ]
    h.tipos_cambio = [tc('2026-10-01', 1000), tc('2026-10-02', 1000)]
    h.cotizaciones = [cot('2026-10-01', 1, 1000), cot('2026-10-02', 1, 1100)]
    const r = parteCalc(variacion(h, '2026-10-01', '2026-10-02'), h, 'financiero', 'resultado', 'ARS')
    expect(r.valor).toBeNull()
    expect(r.motivo).toMatch(/Suma parcial/)
    expect(r.etiquetas).toContain('parcial')
  })
})

// ───────────── Propiedades: el desglose siempre suma exacto ─────────────

describe('propiedades', () => {
  const precio = fc.integer({ min: 1, max: 5_000_000 }).map((n) => D(n).div(100))
  const ccl = fc.integer({ min: 50_000, max: 400_000 }).map((n) => D(n).div(100))
  const cant = fc.integer({ min: 1, max: 1_000_000 })

  it('activo + TC + sin atribuir = resultado, en pesos y en dólares, con flujos', () => {
    fc.assert(
      fc.property(precio, precio, ccl, ccl, cant, cant, fc.boolean(), fc.boolean(), fc.boolean(), (p0, p1, c0, c1, q, qCompra, usd, hayCompra, fresco) => {
        const h = hechosBase()
        const id = usd ? 1 : 2
        h.operaciones = [op({ fecha: '2026-10-01', activo_id: id, tipo: 'apertura', cantidad: D(q), precio: p0 })]
        if (hayCompra) h.operaciones.push(op({ fecha: '2026-10-02', activo_id: id, tipo: 'compra', cantidad: D(qCompra), precio: p1, ccl_del_dia: c1 }))
        h.tipos_cambio = [tc('2026-10-01', c0.toFixed()), tc('2026-10-02', c1.toFixed())]
        h.cotizaciones = [cot('2026-10-01', id, p0.toFixed()), ...(fresco ? [cot('2026-10-02', id, p1.toFixed())] : [])]
        const v = variacion(h, '2026-10-01', '2026-10-02')
        for (const c of v.contribuciones) {
          const sa = c.activo.ars.plus(c.tc.ars).plus(c.sin_atribuir.ars).minus(c.resultado.ars).abs()
          const su = c.activo.usd.plus(c.tc.usd).plus(c.sin_atribuir.usd).minus(c.resultado.usd).abs()
          if (sa.gt('1e-15') || su.gt('1e-15')) return false
        }
        return true
      }),
      { numRuns: 1500 },
    )
  })

  it('la suma de partes con un faltante nunca es cero: es "sin dato"', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -1e9, max: 1e9 }), { minLength: 1, maxLength: 8 }), fc.nat(7), (xs, k) => {
        const partes = xs.map((x, i) => ({ nombre: `p${i}`, calc: calc(D(x), String(x)) }))
        const idx = k % partes.length
        partes[idx] = { nombre: 'falta', calc: { valor: null, motivo: 'x', formula: 'sin dato', insumos: [], etiquetas: [] } }
        return sumaCalc(partes, 'ARS', '').valor === null
      }),
    )
  })

  it('los montos nunca pasan por float: el valor en pesos es cantidad × precio exacto', () => {
    fc.assert(
      fc.property(cant, precio, ccl, (q, p, c) => {
        const h = hechosBase()
        h.operaciones = [op({ fecha: '2026-10-01', activo_id: 2, tipo: 'apertura', cantidad: D(q), precio: p })]
        h.tipos_cambio = [tc('2026-10-01', c.toFixed())]
        h.cotizaciones = [cot('2026-10-01', 2, p.toFixed())]
        const it0 = foto(h, '2026-10-01').items[0]
        return it0.valor_ars.valor!.eq(D(q).times(p))
      }),
    )
  })
})

// ───────────── Pantallas armadas desde los hechos ─────────────

describe('armado de pantallas', () => {
  function cartera(): Hechos {
    const h = hechosBase()
    h.operaciones = [
      op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(100), precio: D(20000), ccl_del_dia: D(1400), fecha_origen: '2026-06-01' }),
      op({ fecha: '2026-10-01', activo_id: 2, tipo: 'apertura', cantidad: D(1000000), precio: D('1.05') }),
    ]
    h.tipos_cambio = [tc('2026-10-01', 1500), tc('2026-10-02', 1530)]
    h.cotizaciones = [cot('2026-10-01', 1, 20870), cot('2026-10-01', 2, '1.07'), cot('2026-10-02', 1, 21300), cot('2026-10-02', 2, '1.071')]
    h.saldos = [
      { fecha: '2026-10-01', cuenta_id: 3, moneda: 'ARS', monto: D(1000000), carga_id: 1 },
      { fecha: '2026-10-02', cuenta_id: 3, moneda: 'ARS', monto: D(1001000), carga_id: 1 },
      { fecha: '2026-10-02', cuenta_id: 1, moneda: 'ARS', monto: D(-5000), carga_id: 1 },
    ]
    h.bienes = [{ id: 1, nombre: 'Casa', tipo: 'inmueble', moneda_valuacion: 'USD', geografia: 'AR', pasivo_id: null, activo_bool: true }]
    h.valuaciones = [{ bien_id: 1, fecha: '2026-09-15', valor: D(200000), fuente: 'tasación', carga_id: 1 }]
    h.pasivos = [{ id: 1, nombre: 'Leasing', tipo: 'leasing', moneda: 'ARS', fecha_inicio: '2025-06-01', cuotas_totales: 36, opcion_compra_fecha: null }]
    h.pasivo_saldos = [{ pasivo_id: 1, fecha: '2026-10-01', capital_pendiente: D(30000000), carga_id: 1 }]
    return h
  }

  it('Hoy: frase en dos monedas, tarjetas y cuadre', () => {
    const v = armarHoy(cartera(), '2026-10-02')
    expect(v.hay_datos).toBe(true)
    expect(v.frase).not.toBeNull()
    expect(v.frase!.partes.map((p) => p.texto).join('')).toMatch(/en pesos .* en dólares/)
    expect(v.financiero.valor.ars.valor).not.toBeNull()
    expect(v.total.valor.usd.valor).not.toBeNull()
    expect(v.cuadre.ars_ok).toBe(true)
    expect(v.cuadre.usd_ok).toBe(true)
    // financiero = títulos + liquidez (incluye el saldo deudor de IEB)
    const esperado = D(100).times(21300).plus(D(1000000).times('1.071')).plus(1001000).minus(5000)
    expect(D(v.financiero.valor.ars.valor!).eq(esperado)).toBe(true)
  })

  it('Cartera: resultado en dos monedas y desglose desde la compra que suma exacto', () => {
    const v = armarCartera(cartera(), '2026-10-02')
    const spy = v.filas.find((f) => f.ticker === 'SPY')!
    expect(spy.desglose).not.toBeNull()
    const suma = D(spy.desglose!.activo.valor!).plus(spy.desglose!.tc.valor!)
    expect(suma.minus(spy.resultado.ars.valor!).abs().lt('1e-12')).toBe(true)
    const lecap = v.filas.find((f) => f.ticker === 'S13N6')!
    expect(lecap.ppc.usd.valor).toBeNull() // apertura sin CCL de compra
    expect(lecap.pendiente).toMatch(/CCL de compra/)
    expect(spy.dias_en_posicion).toBe(123)
  })

  it('Exposición: los pasivos en pesos netean contra los pesos', () => {
    const v = armarExposicion(cartera(), '2026-10-02', 'financiero')
    const pesos = D(1000000).times('1.071').plus(1001000).minus(5000)
    expect(D(v.resumen.pesos_financieros.valor!).eq(pesos)).toBe(true)
    expect(D(v.resumen.deuda_pesos.valor!).eq(30000000)).toBe(true)
    expect(D(v.resumen.neto_ars.valor!).eq(pesos.minus(30000000))).toBe(true)
    expect(v.por_clase.length).toBeGreaterThan(0)
  })

  it('sin cargas: todo es "sin dato", nunca cero', () => {
    const v = armarHoy(hechosBase(), '2026-10-02')
    expect(v.hay_datos).toBe(false)
    expect(v.financiero.valor.ars.valor).toBeNull()
    expect(v.atencion[0].id).toBe('primera-carga')
  })
})
