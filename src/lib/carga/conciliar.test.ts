// Conciliación (D-14, D-15, D-19): B21, B22 y B23 de la revisión del motor, y
// casos vecinos. Números inventados (D-24).

import { describe, expect, it } from 'vitest'
import { Decimal } from '@/lib/domain/dinero'
import type { Activo, CargaResumen, Cuenta, Hechos, Operacion } from '@/lib/domain/tipos'
import { precioPendiente, proponerCarga } from './conciliar'
import type { FilaLeida, LecturaCuenta } from './contratos'
import { tenencias } from '@/lib/domain/posiciones'

const D = (x: string | number) => new Decimal(x)
const CUENTAS: Cuenta[] = [
  { id: 1, nombre: 'IEB', tipo: 'broker', formato_carga: 'excel_ieb', activa: true },
  { id: 3, nombre: 'Mercado Pago', tipo: 'billetera', formato_carga: 'captura', activa: true },
]
const SPY: Activo = {
  id: 1, ticker: 'SPY', nombre: 'SPY', tipo: 'cedear', moneda_riesgo: 'USD', geografia: 'US', indexacion: null,
  ticker_subyacente: 'SPY', fecha_vencimiento: null, color: null, activo_bool: true,
}
let id = 100
const op = (o: Partial<Operacion> & Pick<Operacion, 'fecha' | 'tipo' | 'cantidad'>): Operacion => ({
  id: id++, fecha_origen: null, cuenta_id: 1, activo_id: 1, moneda: 'ARS', precio: null, importe: null,
  comisiones: D(0), ccl_del_dia: null, carga_id: 1, notas: null, ...o,
})
const carga = (cid: number, fecha: string): CargaResumen => ({
  id: cid, lote: null, fecha, cuenta_id: 1, origen: 'excel', archivo_path: null, estado: 'vigente',
  creado_en: `${fecha}T21:00:00Z`, reemplaza_a: null, lector: null, tiempo_activo_ms: null,
})
const hechos = (p: Partial<Hechos>): Hechos => ({
  cuentas: CUENTAS, activos: [SPY], operaciones: [], cotizaciones: [], tipos_cambio: [], saldos: [], movimientos: [],
  pasivos: [], pasivo_saldos: [], bienes: [], valuaciones: [], feriados: [], cargas: [], ...p,
})
const fila = (cantidad: string, extra: Partial<FilaLeida> = {}): FilaLeida => ({
  clave: 'IEB:SPY', ticker: 'SPY', nombre: 'SPY', seccion: 'cedears', tipo_sugerido: 'cedear', moneda_emision: 'ARS',
  cantidad, precio_mostrado: '12300', escala: '1', precio_unitario: '12300', valorizado: null, ppc_mostrado: null,
  ppc_unitario: null, costo_total: null, liquidacion: 'disponible', estado: 'verificada', motivos: [], chequeo: null, lugar: null,
  ...extra,
})
const lectura = (filas: FilaLeida[], fecha = '2026-10-08'): LecturaCuenta => ({
  cuenta: 'IEB', origen: 'excel', fecha_reporte: fecha, filas, saldos: [], controles: [], advertencias: [], lector: 'test', cruda: null,
})

describe('D-19 (B23): la carga siguiente completa el precio de la compra pendiente', () => {
  const ops = () => [
    op({ fecha: '2026-10-01', tipo: 'apertura', cantidad: D(100), precio: D(10000) }),
    op({ fecha: '2026-10-07', tipo: 'compra', cantidad: D(10), ccl_del_dia: D(1500) }),
  ]

  it('propone completar con (PPP₁ × q₁ − PPP₀ × q₀) ÷ Δq, como advertencia a aceptar', () => {
    const o = ops()
    const p = proponerCarga([lectura([fila('110', { ppc_unitario: '10200', ppc_mostrado: '10200' })])], hechos({ operaciones: o, cargas: [carga(1, '2026-10-07')] }), '2026-10-08', { ccl: D(1510) })
    const f = p.filas[0]
    expect(f.accion).toBe('completar_precio')
    expect(f.estado).toBe('advertencia')
    expect(f.operacion).toBeNull()
    expect(f.completar).toMatchObject({ operacion_id: o[1].id, precio: '12200', fecha: '2026-10-07', cantidad: '10' })
    expect(f.completar!.formula).toContain('$ 1.000.000,00')
    expect(f.motivos[0]).toMatch(/^Completar el precio de la compra del mié 07\/10/)
    expect(f.cotizacion).toEqual({ precio_pesos: '12300' })
  })

  it('con el PPP todavía en "-", no propone nada (la compra sigue pendiente)', () => {
    const p = proponerCarga([lectura([fila('110')])], hechos({ operaciones: ops(), cargas: [carga(1, '2026-10-07')] }), '2026-10-08', { ccl: D(1510) })
    expect(p.filas[0].accion).toBe('ninguna')
    expect(p.filas[0].completar).toBeNull()
  })

  it('un PPP que da un precio ≤ 0 pide revisar, sin completar', () => {
    const p = proponerCarga([lectura([fila('110', { ppc_unitario: '9000' })])], hechos({ operaciones: ops(), cargas: [carga(1, '2026-10-07')] }), '2026-10-08', { ccl: D(1510) })
    expect(p.filas[0].accion).toBe('ninguna')
    expect(p.filas[0].completar).toBeNull()
    expect(p.filas[0].estado).toBe('advertencia')
    expect(p.filas[0].motivos[0]).toMatch(/no explica la compra/)
  })

  it('dos compras pendientes: un PPP no alcanza para separarlas', () => {
    const o = [...ops(), op({ fecha: '2026-10-08', tipo: 'compra', cantidad: D(5), ccl_del_dia: D(1510) })]
    const p = proponerCarga([lectura([fila('115', { ppc_unitario: '10300' })], '2026-10-09')], hechos({ operaciones: o, cargas: [carga(1, '2026-10-08')] }), '2026-10-09', { ccl: D(1510) })
    expect(p.filas[0].completar).toBeNull()
    expect(p.filas[0].motivos[0]).toMatch(/2 compras con precio pendiente/)
  })

  it('una venta posterior a la compra pendiente: la fórmula sigue las reglas del motor (costo proporcional)', () => {
    // 100 a $10.000 + 10 pendientes a p; venta de 55 (la mitad); quedan 55 con PPP 10.200.
    const o = [...ops(), op({ fecha: '2026-10-08', tipo: 'venta', cantidad: D(55), precio: D(12000), ccl_del_dia: D(1510) })]
    const r = precioPendiente(tenencias(o, '2026-10-09').get('1:1'), o, '2026-10-09', '10200')
    expect(r).toMatchObject({ ok: true, completar: { precio: '12200' } })
  })

  it('con otra parte sin costo (apertura sin PPP), no se puede inferir', () => {
    const o = [op({ fecha: '2026-10-01', tipo: 'apertura', cantidad: D(100) }), op({ fecha: '2026-10-07', tipo: 'compra', cantidad: D(10), ccl_del_dia: D(1500) })]
    const r = precioPendiente(tenencias(o, '2026-10-08').get('1:1'), o, '2026-10-08', '10200')
    expect(r).toMatchObject({ ok: false })
  })
})

describe('B21: una carga atrasada se concilia contra lo que la app tenía ese día', () => {
  it('no inventa una venta por una compra posterior, y avisa la carga posterior', () => {
    const h = hechos({
      operaciones: [
        op({ fecha: '2026-10-01', tipo: 'apertura', cantidad: D(100), precio: D(20000) }),
        op({ fecha: '2026-10-09', tipo: 'compra', cantidad: D(20), precio: D(21000), ccl_del_dia: D(1525) }),
      ],
      cargas: [carga(1, '2026-10-01'), carga(2, '2026-10-09')],
    })
    const p = proponerCarga([lectura([fila('100')])], h, '2026-10-08', { ccl: D(1519) })
    expect(p.filas[0].accion).toBe('ninguna')
    expect(p.filas[0].cantidad_app).toBe('100')
    expect(p.advertencias.join(' ')).toMatch(/ya hay una carga posterior \(del vie 09\/10\)/)
  })

  it('los ausentes también se calculan a la fecha de la carga', () => {
    const h = hechos({
      operaciones: [op({ fecha: '2026-10-09', tipo: 'apertura', cantidad: D(100), precio: D(20000) })],
      cargas: [carga(2, '2026-10-09')],
    })
    const p = proponerCarga([lectura([])], h, '2026-10-08', { ccl: D(1519) })
    expect(p.ausentes).toEqual([])
  })

  it('anterior a la primera carga de la cuenta: no vuelve a abrir una tenencia que ya tiene apertura', () => {
    const h = hechos({
      operaciones: [op({ fecha: '2026-10-09', tipo: 'apertura', cantidad: D(100), precio: D(20000) })],
      cargas: [carga(2, '2026-10-09')],
    })
    const p = proponerCarga([lectura([fila('100')])], h, '2026-10-08', { ccl: D(1519) })
    expect(p.filas[0].accion).toBe('revisar')
    expect(p.filas[0].operacion).toBeNull()
    expect(p.filas[0].motivos[0]).toMatch(/ya tiene la apertura de SPY del vie 09\/10/)
  })

  it('una operación propuesta en una carga atrasada lo avisa', () => {
    const h = hechos({
      operaciones: [op({ fecha: '2026-10-01', tipo: 'apertura', cantidad: D(100), precio: D(20000) })],
      cargas: [carga(1, '2026-10-01'), carga(2, '2026-10-09')],
    })
    const p = proponerCarga([lectura([fila('90')])], h, '2026-10-08', { ccl: D(1519) })
    expect(p.filas[0].accion).toBe('venta')
    expect(p.filas[0].motivos.join(' ')).toMatch(/ya hay una carga posterior de IEB/)
  })
})

describe('B22: más cantidad con el mismo costo total', () => {
  const h = () =>
    hechos({ operaciones: [op({ fecha: '2026-10-01', tipo: 'apertura', cantidad: D(100), precio: D(20000) })], cargas: [carga(1, '2026-10-01')] })

  it('se propone como "¿cambio de ratio?": un ajuste de ratio sin precio, a revisar', () => {
    const p = proponerCarga([lectura([fila('200', { ppc_unitario: '10000', precio_unitario: '10500' })])], h(), '2026-10-08', { ccl: D(1500) })
    const f = p.filas[0]
    expect(f.accion).toBe('revisar')
    expect(f.estado).toBe('advertencia')
    expect(f.operacion).toMatchObject({ tipo: 'ajuste_ratio', cantidad: '100', precio: null, importe: null, ccl_del_dia: '1500' })
    expect(f.motivos[0]).toMatch(/^¿Cambio de ratio\?/)
  })

  it('un PPP redondeado (dentro del 1% del costo) sigue siendo cambio de ratio', () => {
    const p = proponerCarga([lectura([fila('300', { ppc_unitario: '6666.67' })])], h(), '2026-10-08', { ccl: D(1500) })
    expect(p.filas[0].operacion?.tipo).toBe('ajuste_ratio')
  })

  it('un precio implícito ≤ 0 nunca va como precio de compra (la base exige > 0)', () => {
    // Costo del bróker bastante menor que el de la app: no es un ratio limpio ni una compra.
    const p = proponerCarga([lectura([fila('200', { ppc_unitario: '9000' })])], h(), '2026-10-08', { ccl: D(1500) })
    const f = p.filas[0]
    expect(f.accion).toBe('revisar')
    expect(f.operacion).toMatchObject({ tipo: 'compra', precio: null })
    expect(f.motivos[0]).toMatch(/el PPP no la explica/)
  })

  it('una compra de verdad sigue infiriendo su precio', () => {
    // (20.200 × 110 − 2.000.000) ÷ 10 = 22.200
    const p = proponerCarga([lectura([fila('110', { ppc_unitario: '20200' })])], h(), '2026-10-08', { ccl: D(1500) })
    expect(p.filas[0]).toMatchObject({ accion: 'compra', operacion: { tipo: 'compra', cantidad: '10', precio: '22200' } })
  })
})

describe('motivos: primero lo que frena', () => {
  it('sin CCL, el motivo principal de una compra es el CCL que falta', () => {
    const h = hechos({ operaciones: [op({ fecha: '2026-10-01', tipo: 'apertura', cantidad: D(100), precio: D(20000) })], cargas: [carga(1, '2026-10-01')] })
    const p = proponerCarga([lectura([fila('110', { motivos: ['nota del lector'], estado: 'advertencia' })])], h, '2026-10-08', { ccl: null })
    expect(p.filas[0].estado).toBe('error')
    expect(p.filas[0].motivos[0]).toMatch(/^Falta el CCL del día/)
    expect(p.filas[0].motivos.at(-1)).toBe('nota del lector')
  })
  it('una fila que el lector dejó en error conserva su motivo antes que la propuesta', () => {
    const p = proponerCarga([lectura([fila('110', { motivos: ['La cuenta no cierra.'], estado: 'error' })])], hechos({}), '2026-10-08', { ccl: D(1500) })
    expect(p.filas[0].motivos[0]).toBe('La cuenta no cierra.')
  })
})
