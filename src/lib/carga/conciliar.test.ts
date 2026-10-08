// Conciliación (D-14, D-15, D-19): B21, B22 y B23 de la revisión del motor, y
// casos vecinos. Números inventados (D-24).

import { describe, expect, it } from 'vitest'
import { Decimal } from '@/lib/domain/dinero'
import type { Activo, CargaResumen, Cuenta, Hechos, Operacion } from '@/lib/domain/tipos'
import { cclDelDia, precioPendiente, proponerCarga } from './conciliar'
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

// ───────────── Revisión de la fase 1a (números inventados) ─────────────

const LECAP: Activo = {
  id: 2, ticker: 'S09O6', nombre: 'LECAP 09/10/26', tipo: 'lecap', moneda_riesgo: 'ARS', geografia: 'AR', indexacion: 'fija',
  ticker_subyacente: null, fecha_vencimiento: '2026-10-07', color: null, activo_bool: true,
}
const BONO: Activo = { ...LECAP, id: 3, ticker: 'T15E7', nombre: 'BONTE 15/01/27', tipo: 'bono', fecha_vencimiento: '2027-01-15' }
const tc = (fecha: string, ccl: string | null) => ({ fecha, ccl: ccl === null ? null : D(ccl), mep: null, cripto_venta: null, oficial: null, carga_id: 9 })
const coti = (fecha: string, activo_id: number, precio: string) => ({ fecha, activo_id, precio_pesos: D(precio), precio_usd_subyacente: null, carga_id: 1 })

describe('una tenencia que la fuente ya no lista: se propone registrar la venta o el vencimiento', () => {
  const base = (extra: Partial<Hechos> = {}) =>
    hechos({
      activos: [SPY, LECAP, BONO],
      operaciones: [
        op({ fecha: '2026-10-01', tipo: 'apertura', cantidad: D(100), precio: D(10000) }),
        op({ fecha: '2026-10-01', tipo: 'apertura', activo_id: 2, cantidad: D(1_000_000), precio: D('1.02') }),
        op({ fecha: '2026-10-01', tipo: 'apertura', activo_id: 3, cantidad: D(500_000), precio: D('1.1') }),
      ],
      cotizaciones: [coti('2026-10-05', 1, '12000'), coti('2026-10-06', 1, '12100'), coti('2026-10-06', 2, '1.049')],
      cargas: [carga(1, '2026-10-06')],
      ...extra,
    })

  it('Excel sin SPY, sin la LECAP vencida y sin el bono: venta, vencimiento y venta (o vencimiento), con su cuenta y su activo', () => {
    const p = proponerCarga([lectura([])], base(), '2026-10-08', { ccl: D(1530) })
    expect(p.ausentes).toEqual([
      {
        cuenta: 'IEB', cuenta_id: 1, activo_id: 1, ticker: 'SPY', tipo_activo: 'cedear', cantidad_app: '100',
        sugerida: 'venta', opciones: ['venta'], ultimo_precio: { fecha: '2026-10-06', precio_pesos: '12100' }, ccl_del_dia: '1530',
      },
      expect.objectContaining({ activo_id: 2, ticker: 'S09O6', cantidad_app: '1000000', sugerida: 'vencimiento', opciones: ['vencimiento', 'venta'] }),
      expect.objectContaining({ activo_id: 3, ticker: 'T15E7', sugerida: 'venta', opciones: ['venta', 'vencimiento'], ultimo_precio: null }),
    ])
  })

  it('sin CCL tipeado, la ausente lleva el CCL que el día ya tiene (nunca el de otro día)', () => {
    const conDia = proponerCarga([lectura([])], base({ tipos_cambio: [tc('2026-10-07', '1500'), tc('2026-10-08', '1531.5')] }), '2026-10-08', { ccl: null })
    expect(conDia.ausentes.map((a) => a.ccl_del_dia)).toEqual(['1531.5', '1531.5', '1531.5'])
    expect(conDia.ccl).toEqual({ valor: '1531.5', origen: 'cargado' })
    const sinDia = proponerCarga([lectura([])], base({ tipos_cambio: [tc('2026-10-07', '1500')] }), '2026-10-08', { ccl: null })
    expect(sinDia.ausentes.map((a) => a.ccl_del_dia)).toEqual([null, null, null])
    expect(sinDia.ccl).toBeNull()
  })

  it('una captura solo declara ausente lo que cubre: la sección y la moneda de un total que cierra', () => {
    const galicia: Cuenta = { id: 2, nombre: 'Galicia', tipo: 'banco', formato_carga: 'captura', activa: true }
    const enGalicia = (o: Operacion) => ({ ...o, cuenta_id: 2 })
    const h = base({
      cuentas: [...CUENTAS, galicia],
      operaciones: base().operaciones.map(enGalicia),
      cargas: [{ ...carga(1, '2026-10-06'), cuenta_id: 2, origen: 'captura' }],
    })
    const captura = (controles: LecturaCuenta['controles']): LecturaCuenta => ({
      cuenta: 'Galicia', origen: 'captura', fecha_reporte: null, filas: [], saldos: [], controles, advertencias: [], lector: 'test', cruda: null,
    })
    const total = (ok: boolean | null, seccion: 'bonos' | 'cedears', moneda: 'ARS' | 'USD' = 'ARS') => ({
      tipo: 'galicia_total' as const, seccion: 'Bonos en pesos', moneda, cobertura: { seccion, moneda },
      informado: '0', calculado: ok === null ? null : '0', ok, detalle: null, tolerancia: null,
    })
    // "Bonos en pesos" en cero y cerrando: la LECAP y el bono ya no están. SPY (CEDEAR) no está cubierto.
    expect(proponerCarga([captura([total(true, 'bonos')])], h, '2026-10-08', { ccl: D(1530) }).ausentes.map((a) => a.ticker)).toEqual(['S09O6', 'T15E7'])
    // Un total que no cierra (o que no se pudo controlar) no declara nada.
    expect(proponerCarga([captura([total(false, 'bonos')])], h, '2026-10-08', { ccl: D(1530) }).ausentes).toEqual([])
    expect(proponerCarga([captura([total(null, 'bonos')])], h, '2026-10-08', { ccl: D(1530) }).ausentes).toEqual([])
    // Otra moneda u otra sección: tampoco.
    expect(proponerCarga([captura([total(true, 'bonos', 'USD')])], h, '2026-10-08', { ccl: D(1530) }).ausentes).toEqual([])
    expect(proponerCarga([captura([total(true, 'cedears')])], h, '2026-10-08', { ccl: D(1530) }).ausentes.map((a) => a.ticker)).toEqual(['SPY'])
  })
})

describe('CCL de las operaciones: el tipeado o el que el día ya tiene (recarga del mismo día)', () => {
  const h = () =>
    hechos({
      operaciones: [op({ fecha: '2026-10-01', tipo: 'apertura', cantidad: D(100), precio: D(20000) })],
      cargas: [carga(1, '2026-10-08')],
      tipos_cambio: [tc('2026-10-07', '1500'), tc('2026-10-08', '1548.2')],
    })

  it('cclDelDia: tipeado > cargado ese día; nunca el de otro día', () => {
    expect(cclDelDia(h(), '2026-10-08', D('1550'))).toEqual({ valor: D('1550'), origen: 'tipeado' })
    expect(cclDelDia(h(), '2026-10-08', null)).toEqual({ valor: D('1548.2'), origen: 'cargado' })
    expect(cclDelDia(h(), '2026-10-09', null)).toBeNull()
    expect(cclDelDia(hechos({ tipos_cambio: [tc('2026-10-08', null)] }), '2026-10-08', null)).toBeNull()
  })

  it('una compra en una recarga de la tarde usa el CCL ya cargado: no frena con "Falta el CCL del día"', () => {
    const p = proponerCarga([lectura([fila('110', { ppc_unitario: '20200' })])], h(), '2026-10-08', { ccl: null })
    expect(p.filas[0]).toMatchObject({ accion: 'compra', estado: 'advertencia', operacion: { tipo: 'compra', ccl_del_dia: '1548.2' } })
    expect(p.filas[0].motivos.join(' ')).not.toMatch(/Falta el CCL/)
  })
})

describe('un PPP o un precio de 0 es "sin dato" (D-107), nunca un costo ni un precio', () => {
  it('primera carga con PPP 0: apertura con el costo sin dato, en advertencia', () => {
    const p = proponerCarga([lectura([fila('300', { ppc_unitario: '0', ppc_mostrado: '0' })])], hechos({}), '2026-10-08', { ccl: D(1500) })
    expect(p.filas[0]).toMatchObject({ accion: 'apertura', estado: 'advertencia', operacion: { tipo: 'apertura', precio: null } })
    expect(p.filas[0].motivos.join(' ')).toMatch(/Sin PPP/)
  })

  it('una compra con PPP 0 no se infiere a $ 0: queda con el precio pendiente', () => {
    // IEB ya cargada y sin SPY: la posición llegó (por ejemplo, transferida) con PPP 0.
    const p = proponerCarga([lectura([fila('300', { ppc_unitario: '0' })])], hechos({ cargas: [carga(1, '2026-10-01')] }), '2026-10-08', { ccl: D(1500) })
    expect(p.filas[0].operacion).toMatchObject({ tipo: 'compra', cantidad: '300', precio: null })
  })

  it('un precio de 0 no se graba como cotización: avisa y deja el último', () => {
    const p = proponerCarga([lectura([fila('100', { precio_unitario: '0', precio_mostrado: '0' })])], hechos({ operaciones: [op({ fecha: '2026-10-01', tipo: 'apertura', cantidad: D(100), precio: D(20000) })], cargas: [carga(1, '2026-10-01')] }), '2026-10-08', { ccl: D(1500) })
    expect(p.filas[0].cotizacion).toBeNull()
    expect(p.filas[0].estado).toBe('advertencia')
    expect(p.filas[0].motivos.join(' ')).toMatch(/precio en \$ 0,00: no se graba/)
  })
})

describe('una tenencia que quedó pendiente el Día cero: "Ya la tenía" (apertura) además de la compra', () => {
  it('en una cuenta ya cargada, una tenencia que la app nunca tuvo ofrece la apertura con el PPP como otra opción', () => {
    const h = hechos({ activos: [SPY, BONO], operaciones: [op({ fecha: '2026-10-07', tipo: 'apertura', cantidad: D(100), precio: D(20000) })], cargas: [carga(1, '2026-10-07')] })
    const t = { ...fila('9000000', { ppc_unitario: '1.0976', precio_unitario: '1.124' }), clave: 'IEB:T15E7', ticker: 'T15E7', seccion: 'bonos' as const }
    const p = proponerCarga([lectura([fila('100'), t])], h, '2026-10-08', { ccl: D(1500) })
    const f = p.filas.find((x) => x.ticker === 'T15E7')!
    expect(f.accion).toBe('compra')
    expect(f.operacion).toMatchObject({ tipo: 'compra', cantidad: '9000000', precio: '1.0976', ccl_del_dia: '1500' })
    expect(f.apertura_alternativa).toEqual({
      activo_id: 3, moneda: 'ARS', importe: null, comisiones: '0', notas: null,
      tipo: 'apertura', cantidad: '9000000', precio: '1.0976', ccl_del_dia: null, fecha_origen: null,
    })
    expect(f.motivos.join(' ')).toMatch(/Ya la tenía/)
    // Una compra de una tenencia que ya tuvo operaciones en la cuenta no la ofrece.
    expect(p.filas.find((x) => x.ticker === 'SPY')?.apertura_alternativa).toBeUndefined()
  })

  it('una tenencia que ya tuvo operaciones en la cuenta (vendida toda y recomprada) no ofrece la apertura', () => {
    const h = hechos({
      operaciones: [
        op({ fecha: '2026-10-01', tipo: 'apertura', cantidad: D(100), precio: D(20000) }),
        op({ fecha: '2026-10-05', tipo: 'venta', cantidad: D(100), precio: D(21000), ccl_del_dia: D(1500) }),
      ],
      cargas: [carga(1, '2026-10-05')],
    })
    const p = proponerCarga([lectura([fila('50', { ppc_unitario: '21500' })])], h, '2026-10-08', { ccl: D(1500) })
    expect(p.filas[0].accion).toBe('compra')
    expect(p.filas[0].apertura_alternativa).toBeUndefined()
  })
})

describe('Galicia: compra inferida con el costo total exacto, no con el PPP redondeado', () => {
  it('(6.050.000 − 5.000.000) ÷ 1.000.000 = 1,05 exacto', () => {
    const galicia: Cuenta = { id: 2, nombre: 'Galicia', tipo: 'banco', formato_carga: 'captura', activa: true }
    const h = hechos({
      cuentas: [...CUENTAS, galicia],
      activos: [SPY, LECAP],
      operaciones: [op({ fecha: '2026-10-01', tipo: 'apertura', cuenta_id: 2, activo_id: 2, cantidad: D(5_000_000), precio: D(1) })],
      cargas: [{ ...carga(1, '2026-10-01'), cuenta_id: 2, origen: 'captura' }],
    })
    const l: LecturaCuenta = {
      cuenta: 'Galicia', origen: 'captura', fecha_reporte: null, saldos: [], controles: [], advertencias: [], lector: 'test', cruda: null,
      filas: [
        fila('6000000', {
          clave: 'Galicia:S09O6', ticker: 'S09O6', seccion: 'bonos', precio_unitario: '1.06',
          // (valorizado − rendimiento $) ÷ cantidad, con 12 decimales: 6.050.000 ÷ 6.000.000.
          ppc_unitario: '1.008333333333', costo_total: '6050000',
        }),
      ],
    }
    const p = proponerCarga([l], h, '2026-10-08', { ccl: D(1500) })
    expect(p.filas[0].operacion).toMatchObject({ tipo: 'compra', cantidad: '1000000', precio: '1.05' })
  })
})

describe('Galicia: una fila en dólares no se graba como precio en pesos', () => {
  it('moneda_precio USD: error con su motivo, sin cotización ni operación', () => {
    const galicia: Cuenta = { id: 2, nombre: 'Galicia', tipo: 'banco', formato_carga: 'captura', activa: true }
    const l: LecturaCuenta = {
      cuenta: 'Galicia', origen: 'captura', fecha_reporte: null, saldos: [], controles: [], advertencias: [], lector: 'test', cruda: null,
      filas: [fila('1000', { clave: 'Galicia:GD30D', ticker: 'GD30D', seccion: 'bonos', moneda_emision: 'USD', moneda_precio: 'USD', precio_unitario: '0.65', ppc_unitario: '0.6' })],
    }
    const p = proponerCarga([l], hechos({ cuentas: [...CUENTAS, galicia] }), '2026-10-08', { ccl: D(1500) })
    expect(p.filas[0]).toMatchObject({ estado: 'error', cotizacion: null, operacion: null, accion: 'revisar' })
    expect(p.filas[0].motivos[0]).toMatch(/en dólares/)
  })

  it('en IEB, moneda_emision USD con precio en pesos sigue grabando su precio (no es una fila en dólares)', () => {
    const p = proponerCarga([lectura([fila('100', { moneda_emision: 'USD', precio_unitario: '1456' })])], hechos({}), '2026-10-08', { ccl: D(1500) })
    expect(p.filas[0].cotizacion).toEqual({ precio_pesos: '1456' })
    expect(p.filas[0].estado).not.toBe('error')
  })
})
