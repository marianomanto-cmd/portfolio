// Revisión adversarial del motor de cálculo: src/lib/domain/*.ts,
// src/lib/vistas/armar.ts y src/lib/carga/conciliar.ts. Todos los números son
// inventados (D-24); los del Apéndice B salen de docs/vision.md.
//
// describe('bugs'): cada test describe un día real del dueño en el que el motor
// da un número equivocado o contradice el spec. FALLAN a propósito: pasan
// cuando se corrige el motor. El informe con el arreglo propuesto para cada uno
// está en el reporte de la revisión.
// describe('cobertura'): comportamientos correctos que no tenían test.

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { proponerCarga } from '@/lib/carga/conciliar'
import type { FilaLeida, LecturaCuenta } from '@/lib/carga/contratos'
import { compacto, Decimal, leerNumeroAR, monto } from '@/lib/domain/dinero'
import { diasHabilesEntre, esViejo, fechaEnCordoba } from '@/lib/domain/fechas'
import { financieros, foto } from '@/lib/domain/foto'
import { costoCalc, ppcCalc, tenencias } from '@/lib/domain/posiciones'
import type {
  Activo,
  Bien,
  BienValuacion,
  CargaResumen,
  Cotizacion,
  Cuenta,
  Fecha,
  Hechos,
  MovimientoCapital,
  Operacion,
  Pasivo,
  PasivoSaldo,
  Saldo,
  TipoCambio,
} from '@/lib/domain/tipos'
import { cuadre, observacionFresca, parteCalc, variacion } from '@/lib/domain/variacion'
import { armarCartera, armarExposicion, armarHoy, fechasDeCarga } from '@/lib/vistas/armar'

// ───────────── Fábrica de hechos ─────────────

const D = (x: string | number) => new Decimal(x)

const IEB = 1
const GALICIA = 2
const MP = 3

const CUENTAS: Cuenta[] = [
  { id: IEB, nombre: 'IEB', tipo: 'broker', formato_carga: 'excel_ieb', activa: true },
  { id: GALICIA, nombre: 'Galicia', tipo: 'banco', formato_carga: 'captura', activa: true },
  { id: MP, nombre: 'Mercado Pago', tipo: 'billetera', formato_carga: 'captura', activa: true },
]

const activo = (id: number, ticker: string, tipo: Activo['tipo'], moneda: 'ARS' | 'USD'): Activo => ({
  id,
  ticker,
  nombre: ticker,
  tipo,
  moneda_riesgo: moneda,
  geografia: tipo === 'cedear' ? 'US' : 'AR',
  indexacion: tipo === 'bono' || tipo === 'lecap' ? 'fija' : null,
  ticker_subyacente: tipo === 'cedear' ? ticker : null,
  fecha_vencimiento: null,
  color: null,
  activo_bool: true,
})

const SPY = activo(1, 'SPY', 'cedear', 'USD')
const S13N6 = activo(2, 'S13N6', 'lecap', 'ARS')
const YPFD = activo(3, 'YPFD', 'accion_local', 'ARS')
const T30J7 = activo(4, 'T30J7', 'lecap', 'ARS')
const FIMA = activo(5, 'FIMA', 'fci', 'ARS')
const TXMJ0 = activo(6, 'TXMJ0', 'bono', 'ARS')
const AL30 = activo(7, 'AL30', 'bono', 'ARS')
const TODOS = [SPY, S13N6, YPFD, T30J7, FIMA, TXMJ0, AL30]

let idOp = 1000
const op = (o: Partial<Operacion> & Pick<Operacion, 'fecha' | 'activo_id' | 'tipo' | 'cantidad'>): Operacion => ({
  id: idOp++,
  fecha_origen: null,
  cuenta_id: IEB,
  moneda: 'ARS',
  precio: null,
  importe: null,
  comisiones: D(0),
  ccl_del_dia: null,
  carga_id: 1,
  notas: null,
  ...o,
})

const tc = (fecha: Fecha, ccl: string | number | null, cripto: string | number | null = null): TipoCambio => ({
  fecha,
  ccl: ccl === null ? null : D(ccl),
  mep: null,
  cripto_venta: cripto === null ? null : D(cripto),
  oficial: null,
  carga_id: 1,
})
const cot = (fecha: Fecha, activo_id: number, precio: string | number): Cotizacion => ({
  fecha,
  activo_id,
  precio_pesos: D(precio),
  precio_usd_subyacente: null,
  carga_id: 1,
})
const saldo = (fecha: Fecha, cuenta_id: number, moneda: 'ARS' | 'USD', m: string | number): Saldo => ({
  fecha,
  cuenta_id,
  moneda,
  monto: D(m),
  carga_id: 1,
})
let idMov = 1
const mov = (m: Partial<MovimientoCapital> & Pick<MovimientoCapital, 'fecha' | 'tipo'>): MovimientoCapital => ({
  id: idMov++,
  fecha_acreditacion: null,
  cuenta_origen_id: null,
  cuenta_destino_id: null,
  moneda_origen: null,
  monto_origen: null,
  moneda_destino: null,
  monto_destino: null,
  tc_aplicado: null,
  impuesto: D(0),
  carga_id: 1,
  notas: null,
  ...m,
})
const carga = (id: number, fecha: Fecha, cuenta_id: number | null, estado: CargaResumen['estado'] = 'vigente'): CargaResumen => ({
  id,
  lote: null,
  fecha,
  cuenta_id,
  origen: cuenta_id === IEB ? 'excel' : cuenta_id === null ? 'manual' : 'captura',
  archivo_path: null,
  estado,
  creado_en: `${fecha}T21:00:00Z`,
  reemplaza_a: null,
  lector: null,
  tiempo_activo_ms: null,
})

const CASA: Bien = { id: 1, nombre: 'Casa', tipo: 'inmueble', moneda_valuacion: 'USD', geografia: 'AR', pasivo_id: null, activo_bool: true }
const CAMIONETA: Bien = { id: 2, nombre: 'Camioneta', tipo: 'vehiculo', moneda_valuacion: 'ARS', geografia: 'AR', pasivo_id: 1, activo_bool: true }
const LEASING: Pasivo = { id: 1, nombre: 'Leasing', tipo: 'leasing', moneda: 'ARS', fecha_inicio: '2025-08-17', cuotas_totales: 48, opcion_compra_fecha: null }
const valuacion = (bien_id: number, fecha: Fecha, valor: string | number): BienValuacion => ({ bien_id, fecha, valor: D(valor), fuente: 'tasación', carga_id: 1 })
const capital = (pasivo_id: number, fecha: Fecha, c: string | number): PasivoSaldo => ({ pasivo_id, fecha, capital_pendiente: D(c), carga_id: 1 })

function hechos(p: Partial<Hechos> = {}): Hechos {
  return {
    cuentas: CUENTAS,
    activos: TODOS,
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
    ...p,
  }
}

/** Patrimonio financiero recalculado desde los hechos (para el cuadre D-66). */
function financieroEn(h: Hechos, fecha: Fecha, moneda: 'ars' | 'usd'): Decimal {
  return financieros(foto(h, fecha)).reduce((a, i) => a.plus((moneda === 'ars' ? i.valor_ars : i.valor_usd).valor!), D(0))
}

/** Montos de una fórmula en es-AR ("$ 1.234,56", "−US$ 12,3", "8.000.000"). */
function montosDe(texto: string): Decimal[] {
  const out: Decimal[] = []
  for (const m of texto.matchAll(/([−-]?)(?:US\$|\$)?\s?(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?)/g)) {
    const n = leerNumeroAR(m[2].includes(',') ? m[2] : m[2].replace(/\./g, '') + ',0')
    if (n !== null) out.push(D(n).times(m[1] ? -1 : 1))
  }
  return out
}

// Lecturas para la conciliación
function filaIEB(ticker: string, cantidad: string, extra: Partial<FilaLeida> = {}): FilaLeida {
  return {
    clave: `IEB:${ticker}`,
    ticker,
    nombre: ticker,
    seccion: 'cedears',
    tipo_sugerido: 'cedear',
    moneda_emision: 'ARS',
    cantidad,
    precio_mostrado: null,
    escala: '1',
    precio_unitario: null,
    valorizado: null,
    ppc_mostrado: null,
    ppc_unitario: null,
    costo_total: null,
    liquidacion: 'disponible',
    estado: 'verificada',
    motivos: [],
    chequeo: null,
    lugar: null,
    ...extra,
  }
}
const lecturaIEB = (filas: FilaLeida[], fecha: Fecha): LecturaCuenta => ({
  cuenta: 'IEB',
  origen: 'excel',
  fecha_reporte: fecha,
  filas,
  saldos: [],
  controles: [],
  advertencias: [],
  lector: 'test',
  cruda: null,
})

// ═════════════════════════════════════════════════════════════════════════
// BUGS: fallan hasta que se corrija el motor
// ═════════════════════════════════════════════════════════════════════════

// Carga "media" (D-64) que usan B09 y B10.
// Carga "media" (D-64): solo el Excel de IEB. Galicia (S13N6) y Mercado Pago
// quedan con su último dato, y el CCL sube 10%.
const cargaMedia = () =>
  hechos({
    operaciones: [
      op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(10), precio: D(10000) }),
      op({ fecha: '2026-10-01', cuenta_id: GALICIA, activo_id: 2, tipo: 'apertura', cantidad: D(1000000), precio: D(1) }),
    ],
    tipos_cambio: [tc('2026-10-05', 1000), tc('2026-10-06', 1100)],
    cotizaciones: [cot('2026-10-05', 1, 10000), cot('2026-10-05', 2, 1), cot('2026-10-06', 1, 11000)],
    saldos: [saldo('2026-10-05', MP, 'ARS', 500000), saldo('2026-10-05', IEB, 'USD', 100), saldo('2026-10-06', IEB, 'USD', 100)],
  })

describe('bugs', () => {
  // B21–B25 son de conciliar.ts y dinero.ts (la parte de la carga): se dejan como estaban.

  it('B21 · conciliar una carga atrasada compara contra operaciones posteriores y propone una venta que no existió', () => {
    // Ya cargaste el vie 09/10 (con una compra de 20). Ahora cargás el Excel del jue 08/10, que dice 100.
    const h = hechos({
      operaciones: [
        op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(100), precio: D(20000) }),
        op({ fecha: '2026-10-09', activo_id: 1, tipo: 'compra', cantidad: D(20), precio: D(21000), ccl_del_dia: D(1525) }),
      ],
      cargas: [carga(1, '2026-10-01', IEB), carga(2, '2026-10-09', IEB)],
    })
    const p = proponerCarga([lecturaIEB([filaIEB('SPY', '100', { precio_unitario: '20500' })], '2026-10-08')], h, '2026-10-08', { ccl: D(1519) })
    expect(p.filas[0].accion).toBe('ninguna')
  })

  it('B22 · conciliar un cambio de ratio propone una compra a precio 0, que la base rechaza (precio > 0)', () => {
    // El bróker duplica la cantidad y parte el PPP: (10.000 × 200 − 2.000.000) ÷ 100 = 0.
    const h = hechos({
      operaciones: [op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(100), precio: D(20000) })],
      cargas: [carga(1, '2026-10-01', IEB)],
    })
    const p = proponerCarga([lecturaIEB([filaIEB('SPY', '200', { ppc_unitario: '10000', precio_unitario: '10500' })], '2026-10-08')], h, '2026-10-08', { ccl: D(1500) })
    const o = p.filas[0].operacion
    expect(o === null || o.precio === null || D(o.precio).gt(0)).toBe(true)
  })

  it('B23 · D-19: la carga siguiente no completa el precio de la compra pendiente (queda "pendiente" para siempre)', () => {
    const h = hechos({
      operaciones: [
        op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(100), precio: D(10000) }),
        op({ fecha: '2026-10-07', activo_id: 1, tipo: 'compra', cantidad: D(10), ccl_del_dia: D(1500) }), // PPP "-"
      ],
      cargas: [carga(1, '2026-10-01', IEB), carga(2, '2026-10-07', IEB)],
    })
    const p = proponerCarga([lecturaIEB([filaIEB('SPY', '110', { ppc_unitario: '10200', precio_unitario: '12300' })], '2026-10-08')], h, '2026-10-08', { ccl: D(1510) })
    // (PPP₁ × q₁ − PPP₀ × q₀) ÷ Δq = (10.200 × 110 − 10.000 × 100) ÷ 10 = 12.200. Hoy: acción "ninguna", sin rastro.
    expect(JSON.stringify(p.filas[0])).toContain('12200')
  })

  it('B24 · leerNumeroAR acepta agrupaciones imposibles y lee mal por 10.000 o por 1.000', () => {
    expect(['1.0852', null]).toContain(leerNumeroAR('1.0852')) // hoy: '10852'
    expect(['1548.2', null]).toContain(leerNumeroAR('1,548.20')) // hoy: '1.5482'
  })

  it('B25 · compacto redondea a "1.000,0k" en lugar de pasar a millones', () => {
    expect(compacto(D('999960'), 'ARS')).toBe('$ 1,0 M') // hoy: '$ 1.000,0k'
  })
})

// ═════════════════════════════════════════════════════════════════════════
// REGRESIONES: bugs del motor ya corregidos (fase 1a, informe fase2-motor)
// ═════════════════════════════════════════════════════════════════════════

describe('regresiones', () => {
  it('B15 · Cartera: el desglose desde la compra no es la suma de los intervalos entre cargas (D-35, visión 4.5)', () => {
    // Compra el 01/10 a CCL 1.000; el CCL va a 1.100 y vuelve a 1.000; el CEDEAR sube 10% en dólares.
    const h = hechos({
      operaciones: [op({ fecha: '2026-10-01', activo_id: 1, tipo: 'compra', cantidad: D(10), precio: D(10000), ccl_del_dia: D(1000) })],
      tipos_cambio: [tc('2026-10-01', 1000), tc('2026-10-02', 1100), tc('2026-10-05', 1000)],
      cotizaciones: [cot('2026-10-01', 1, 10000), cot('2026-10-02', 1, 12100), cot('2026-10-05', 1, 11000)],
    })
    const diario = (
      [
        ['2026-10-01', '2026-10-02'],
        ['2026-10-02', '2026-10-05'],
      ] as const
    )
      .map(([a, b]) => variacion(h, a, b).contribuciones[0].tc.ars)
      .reduce((a, b) => a.plus(b), D(0))
    const fila = armarCartera(h, '2026-10-05').filas[0]
    // Suma de los intervalos: TC −$1.000 y activo +$11.000. Cartera: TC $0 y activo +$10.000.
    expect(D(fila.desglose!.tc.valor!).toFixed()).toBe(diario.toFixed())
  })

  it('B01 · un saldo que se carga por primera vez entra como ganancia (Día cero repartido en dos días)', () => {
    // 01/10: CCL y Excel de IEB. 02/10: misma cartera, mismo precio, mismo CCL, y
    // recién hoy pegás la captura de Mercado Pago. MP ya tenía los $5.000.000.
    const h = hechos({
      operaciones: [op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(10), precio: D(10000) })],
      tipos_cambio: [tc('2026-10-01', 1000), tc('2026-10-02', 1000)],
      cotizaciones: [cot('2026-10-01', 1, 10000), cot('2026-10-02', 1, 10000)],
      saldos: [saldo('2026-10-02', MP, 'ARS', 5000000)],
    })
    const r = armarHoy(h, '2026-10-02').frase!.variacion.ars.valor
    // Esperado: 0 (o "sin dato"). Hoy: +$5.000.000 "por los activos".
    expect(r === null || D(r).isZero()).toBe(true)
  })

  it('B02 · un depósito a MP registrado un día sin captura de MP aparece al día siguiente como ganancia (D-06)', () => {
    // lun 05/10: MP $1.000.000. mar 06/10: carga express + aporte de $500.000 a MP
    // (sin captura). mié 07/10: captura de MP, $1.500.300 (el aporte + $300 de interés).
    const h = hechos({
      tipos_cambio: [tc('2026-10-05', 1000), tc('2026-10-06', 1000), tc('2026-10-07', 1000)],
      saldos: [saldo('2026-10-05', MP, 'ARS', 1000000), saldo('2026-10-07', MP, 'ARS', 1500300)],
      movimientos: [mov({ fecha: '2026-10-06', tipo: 'aporte', cuenta_destino_id: MP, moneda_destino: 'ARS', monto_destino: D(500000) })],
    })
    // El martes la frase dice "sin atribuir −$500.000"; el miércoles, "tus activos +$500.300".
    const act = parteCalc(variacion(h, '2026-10-06', '2026-10-07'), h, 'financiero', 'activo', 'ARS')
    expect(act.valor!.toFixed()).toBe('300')
  })

  it('B03 · un cobro en USD un día sin carga: el título y el saldo lo pasan a pesos con CCL distintos y el resultado no es la variación del patrimonio', () => {
    // Dividendo de US$ 50 el mar 06/10 (CCL de la operación 1.050), sin carga ese día.
    const h = hechos({
      operaciones: [
        op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(10), precio: D(10000) }),
        op({ fecha: '2026-10-06', activo_id: 1, tipo: 'renta', cantidad: D(0), moneda: 'USD', importe: D(50), ccl_del_dia: D(1050) }),
      ],
      tipos_cambio: [tc('2026-10-05', 1000), tc('2026-10-07', 1100)],
      cotizaciones: [cot('2026-10-05', 1, 10000), cot('2026-10-07', 1, 11000)],
      saldos: [saldo('2026-10-05', IEB, 'USD', 100), saldo('2026-10-07', IEB, 'USD', 150)],
    })
    const r = parteCalc(variacion(h, '2026-10-05', '2026-10-07'), h, 'financiero', 'resultado', 'ARS')
    const delta = financieroEn(h, '2026-10-07', 'ars').minus(financieroEn(h, '2026-10-05', 'ars'))
    // Sin aportes ni retiros, resultado = variación del patrimonio: $75.000. Hoy: $77.500.
    expect(r.valor!.toFixed()).toBe(delta.toFixed())
  })

  it('B04 · el cuadre da ✓ aunque la frase no cierre contra el patrimonio recalculado (D-66: el ✓ tiene que poder fallar)', () => {
    const h = hechos({
      operaciones: [
        op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(10), precio: D(10000) }),
        op({ fecha: '2026-10-06', activo_id: 1, tipo: 'renta', cantidad: D(0), moneda: 'USD', importe: D(50), ccl_del_dia: D(1050) }),
      ],
      tipos_cambio: [tc('2026-10-05', 1000), tc('2026-10-07', 1100)],
      cotizaciones: [cot('2026-10-05', 1, 10000), cot('2026-10-07', 1, 11000)],
      saldos: [saldo('2026-10-05', IEB, 'USD', 100), saldo('2026-10-07', IEB, 'USD', 150)],
    })
    const v = armarHoy(h, '2026-10-07')
    const ayer = financieroEn(h, '2026-10-05', 'ars')
    const cierra = ayer.plus(v.frase!.variacion.ars.valor!).eq(v.financiero.valor.ars.valor!) // sin aportes
    expect(v.cuadre.ars_ok).toBe(cierra)
  })

  it('B05 · un dividendo cobrado después de vender el CEDEAR se toma como aporte y el ingreso desaparece del resultado', () => {
    const h = hechos({
      operaciones: [
        op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(10), precio: D(10000) }),
        op({ fecha: '2026-10-02', activo_id: 1, tipo: 'venta', cantidad: D(10), precio: D(10500), ccl_del_dia: D(1000) }),
        op({ fecha: '2026-10-20', activo_id: 1, tipo: 'renta', cantidad: D(0), moneda: 'USD', importe: D(5), ccl_del_dia: D(1000) }),
      ],
      tipos_cambio: [tc('2026-10-19', 1000), tc('2026-10-20', 1000)],
      saldos: [saldo('2026-10-19', IEB, 'USD', 100), saldo('2026-10-20', IEB, 'USD', 105)],
    })
    const r = parteCalc(variacion(h, '2026-10-19', '2026-10-20'), h, 'financiero', 'resultado', 'USD')
    // Entraron US$ 5 de dividendo, sin aportes: el resultado es +US$ 5. Hoy: 0.
    expect(r.valor!.toFixed()).toBe('5')
  })

  it('B05b · compra y venta dentro del mismo intervalo (volviste después de un hueco): la ganancia del trade desaparece', () => {
    // Entre la carga del lun 05/10 y la del jue 08/10 compraste 100 GGAL a $1.000 y las vendiste a $1.200.
    const GGAL = activo(8, 'GGAL', 'accion_local', 'ARS')
    const h = hechos({
      activos: [...TODOS, GGAL],
      operaciones: [
        op({ fecha: '2026-10-06', activo_id: 8, tipo: 'compra', cantidad: D(100), precio: D(1000), ccl_del_dia: D(1000) }),
        op({ fecha: '2026-10-07', activo_id: 8, tipo: 'venta', cantidad: D(100), precio: D(1200), ccl_del_dia: D(1000) }),
      ],
      tipos_cambio: [tc('2026-10-05', 1000), tc('2026-10-08', 1000)],
      cotizaciones: [cot('2026-10-07', 8, 1200)],
      saldos: [saldo('2026-10-05', IEB, 'ARS', 500000), saldo('2026-10-08', IEB, 'ARS', 520000)],
    })
    const r = parteCalc(variacion(h, '2026-10-05', '2026-10-08'), h, 'financiero', 'resultado', 'ARS')
    expect(r.valor!.toFixed()).toBe('20000') // hoy: 0 (los $20.000 se toman como aporte)
  })

  it('B06 · una deuda en dólares con capital constante da resultado en USD y ninguno en pesos (al revés)', () => {
    const h = hechos({
      tipos_cambio: [tc('2026-10-05', 1000), tc('2026-10-06', 1100)],
      pasivos: [{ id: 2, nombre: 'Tarjeta USD', tipo: 'tarjeta', moneda: 'USD', fecha_inicio: '2026-01-01', cuotas_totales: 1, opcion_compra_fecha: null }],
      pasivo_saldos: [capital(2, '2026-10-01', 1000)],
    })
    const c = variacion(h, '2026-10-05', '2026-10-06').contribuciones.find((x) => x.clave === 'd:2')!
    // Debés US$ 1.000 los dos días: en dólares no cambió nada; en pesos la deuda creció $100.000.
    expect({ usd: c.resultado.usd.toFixed(), ars: c.resultado.ars.toFixed() }).toEqual({ usd: '0', ars: '-100000' })
  })

  it('B07 · cambio de ratio sin precio nuevo: valúa la cantidad nueva con el precio viejo y duplica el valor', () => {
    const h = hechos({
      operaciones: [
        op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(100), precio: D(20000) }),
        op({ fecha: '2026-10-06', activo_id: 1, tipo: 'ajuste_ratio', cantidad: D(100), ccl_del_dia: D(1000) }),
      ],
      tipos_cambio: [tc('2026-10-05', 1000), tc('2026-10-06', 1000)],
      cotizaciones: [cot('2026-10-05', 1, 20000)],
    })
    const spy = foto(h, '2026-10-06').items.find((i) => i.clave === 'p:1:1')!
    // Esperado: "sin dato" (el precio es de antes del cambio de ratio). Hoy: $4.000.000 (el doble).
    expect(spy.valor_ars.valor).toBeNull()
  })

  it('B08 · día cargado sin CCL: el desglose afirma "el CCL sumó $0" con el CCL del día anterior', () => {
    // 06/10: Excel con precios nuevos y solo el dólar cripto (la carga se puede guardar sin CCL).
    const h = hechos({
      operaciones: [op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(10), precio: D(10000) })],
      tipos_cambio: [tc('2026-10-05', 1000), tc('2026-10-06', null, 1050)],
      cotizaciones: [cot('2026-10-05', 1, 10000), cot('2026-10-06', 1, 11000)],
    })
    const v = variacion(h, '2026-10-05', '2026-10-06')
    const c = v.contribuciones[0]
    // Sin CCL del 06/10 no hay con qué separar activo de TC: "sin dato" o "sin atribuir", nunca TC = 0.
    expect(v.faltantes.length > 0 || (c.activo.ars.isZero() && c.tc.ars.isZero())).toBe(true)
  })

  it('B09 · carga media (solo IEB): la frase oculta el "sin atribuir" en USD y sus partes no suman', () => {
    const f = armarHoy(cargaMedia(), '2026-10-06').frase!
    // "+$ 20.000 en pesos, pero −US$ 136,36 en dólares ... En dólares, tus activos US$ 0,00 y el CCL US$ 0,00".
    expect(f.sin_atribuir).not.toBeNull()
  })

  it('B10 · tarjeta de patrimonio en carga media: activos + TC no suman la variación (no hay "sin atribuir")', () => {
    const t = armarHoy(cargaMedia(), '2026-10-06').financiero
    const d = t.desglose as unknown as Record<string, { usd: { valor: string | null } } | undefined>
    const suma = D(d.activos!.usd.valor!).plus(d.tc!.usd.valor!).plus(d.sin_atribuir?.usd.valor ?? 0)
    expect(suma.toFixed()).toBe(D(t.variacion!.usd.valor!).toFixed())
  })

  it('B11 · "Quién movió" lista el resultado total, no la parte de activos (Apéndice B: los US$ quietos no se mueven como activo)', () => {
    const h = hechos({
      tipos_cambio: [tc('2026-10-13', '1531.7'), tc('2026-10-14', '1548.2')],
      saldos: [saldo('2026-10-13', IEB, 'USD', 4200), saldo('2026-10-14', IEB, 'USD', 4200)],
    })
    const m = armarHoy(h, '2026-10-14').movimientos.find((x) => x.clave === 's:1:USD')!
    // Esperado $0 (todo es CCL). Hoy: +$69.300.
    expect(D(m.aporte.ars.valor!).toFixed()).toBe('0')
  })

  it('B12 · el cuadre queda "no verificable" si a la casa le falta la valuación, aunque el financiero esté completo', () => {
    const h = hechos({
      operaciones: [op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(10), precio: D(10000) })],
      tipos_cambio: [tc('2026-10-05', 1000), tc('2026-10-06', 1100)],
      cotizaciones: [cot('2026-10-05', 1, 10000), cot('2026-10-06', 1, 11500)],
      bienes: [CASA],
    })
    const v = armarHoy(h, '2026-10-06')
    expect(v.frase!.variacion.ars.valor).not.toBeNull() // la frase (financiero) sí se calcula
    expect(v.cuadre.ars_ok).toBe(true)
  })

  it('B13 · apertura con fecha de compra declarada pero sin CCL: no aparece "Declarar CCL de compra"', () => {
    const h = hechos({
      operaciones: [op({ fecha: '2026-10-01', activo_id: 3, tipo: 'apertura', cantidad: D(300), precio: D(48200), fecha_origen: '2026-05-04' })],
      tipos_cambio: [tc('2026-10-05', 1500)],
      cotizaciones: [cot('2026-10-05', 3, 52300)],
    })
    const hoy = armarHoy(h, '2026-10-05')
    const fila = armarCartera(h, '2026-10-05').filas[0]
    expect(fila.ppc.usd.valor).toBeNull()
    expect(hoy.atencion.some((p) => p.id.startsWith('ccl-compra:'))).toBe(true)
  })

  it('B14 · Cartera: el total "Res. USD" sin dato muestra la suma parcial del costo, no la del resultado (D-65, visión 4.5)', () => {
    const h = hechos({
      operaciones: [
        op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(1000), precio: D(29100), ccl_del_dia: D(1390), fecha_origen: '2026-03-02' }),
        op({ fecha: '2026-10-01', activo_id: 3, tipo: 'apertura', cantidad: D(300), precio: D(48200) }),
      ],
      tipos_cambio: [tc('2026-10-14', '1548.2')],
      cotizaciones: [cot('2026-10-14', 1, 35150), cot('2026-10-14', 3, 52300)],
    })
    const v = armarCartera(h, '2026-10-14')
    const spy = v.filas.find((f) => f.ticker === 'SPY')!
    const parcial = monto(D(spy.resultado.usd.valor!), 'USD', { decimales: 2 }) // US$ 1.768,53
    expect(v.totales.resultado.usd.valor).toBeNull()
    // Hoy el motivo dice "Suma parcial (1 de 2): US$ 20.935,25" (el costo de SPY).
    expect(v.totales.resultado.usd.motivo).toContain(parcial)
  })

  it('B16 · una amortización devuelve capital y Cartera la muestra como pérdida (el costo no baja)', () => {
    const h = hechos({
      operaciones: [
        op({ fecha: '2026-10-01', activo_id: 7, tipo: 'apertura', cantidad: D(1000), precio: D(1) }),
        op({ fecha: '2026-10-05', activo_id: 7, tipo: 'amortizacion', cantidad: D(0), importe: D(500), ccl_del_dia: D(1000) }),
      ],
      tipos_cambio: [tc('2026-10-05', 1000)],
      cotizaciones: [cot('2026-10-05', 7, '0.5')],
      saldos: [saldo('2026-10-05', IEB, 'ARS', 500)],
    })
    const fila = armarCartera(h, '2026-10-05').filas.find((f) => f.ticker === 'AL30')!
    // Pagaste $1.000, cobraste $500 de amortización y te quedan $500: resultado 0. Hoy: −$500 (−50%).
    expect(D(fila.resultado.ars.valor!).toFixed()).toBe('0')
  })

  it('B17 · la etiqueta "declarado" (del CCL de compra) se pega también al PPC en pesos', () => {
    const t = tenencias([
      op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(10), precio: D(1000), ccl_del_dia: D(900), fecha_origen: '2026-05-01' }),
    ]).get('1:1')!
    expect(ppcCalc(t, 'USD').etiquetas).toContain('declarado')
    // El PPC en pesos es el PPP del bróker: no tiene nada declarado (visión 4.0: lo verificado no lleva chip).
    expect(ppcCalc(t, 'ARS').etiquetas).not.toContain('declarado')
  })

  it('B18 · badge "ganás en pesos, perdés en dólares" con resultado en pesos exactamente 0 (Decimal(0).isPositive() es true)', () => {
    const h = hechos({
      operaciones: [op({ fecha: '2026-10-01', activo_id: 2, tipo: 'apertura', cantidad: D(1000), precio: D(1), ccl_del_dia: D(900), fecha_origen: '2026-09-01' })],
      tipos_cambio: [tc('2026-10-05', 1000)],
      cotizaciones: [cot('2026-10-05', 2, 1)],
    })
    const fila = armarCartera(h, '2026-10-05').filas[0]
    expect(D(fila.resultado.ars.valor!).isZero()).toBe(true)
    expect(fila.ganas_pesos_perdes_dolares).toBe(false)
  })

  it('B19 · Exposición, vista Total: la concentración la encabeza la casa (D-03: se calcula sobre el financiero)', () => {
    const h = hechos({
      operaciones: [op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(100), precio: D(20000) })],
      tipos_cambio: [tc('2026-10-05', 1000)],
      cotizaciones: [cot('2026-10-05', 1, 20000)],
      saldos: [saldo('2026-10-05', MP, 'ARS', 500000)],
      bienes: [CASA],
      valuaciones: [valuacion(1, '2026-09-15', 200000)],
    })
    const fin = armarExposicion(h, '2026-10-05', 'financiero')
    const tot = armarExposicion(h, '2026-10-05', 'total')
    expect(tot.concentracion.top1_nombre).toBe(fin.concentracion.top1_nombre)
  })

  it('B20 · Exposición, vista Total: usa la moneda de valuación de los bienes como moneda de riesgo (D-73, D-101: "sin dato")', () => {
    const h = hechos({
      operaciones: [op({ fecha: '2026-10-01', activo_id: 2, tipo: 'apertura', cantidad: D(1000000), precio: D(1) })],
      tipos_cambio: [tc('2026-10-05', 1000)],
      cotizaciones: [cot('2026-10-05', 2, 1)],
      bienes: [CASA, CAMIONETA],
      valuaciones: [valuacion(1, '2026-09-15', 200000), valuacion(2, '2026-03-01', 38000000)],
      pasivos: [LEASING],
      pasivo_saldos: [capital(1, '2026-09-30', 21400000)],
    })
    const tot = armarExposicion(h, '2026-10-05', 'total')
    // Apéndice B: "Vista Total: sin dato, porque la casa y la camioneta no tienen moneda de riesgo elegida".
    expect(tot.resumen.neto_ars.valor).toBeNull()
  })

  it('B26 · traza: la fórmula del costo después de una venta parcial no suma ("$ 10.000,00 = $ 6.000,00")', () => {
    const t = tenencias([
      op({ fecha: '2026-10-01', activo_id: 1, tipo: 'compra', cantidad: D(10), precio: D(1000), ccl_del_dia: D(1000) }),
      op({ fecha: '2026-10-02', activo_id: 1, tipo: 'venta', cantidad: D(4), precio: D(1500), ccl_del_dia: D(1000) }),
    ]).get('1:1')!
    const c = costoCalc(t, 'ARS')
    const [izq, der] = c.formula.split('=')
    const montosIzq = montosDe(izq)
    // Hoy: un solo monto a la izquierda (el costo de compra) distinto del de la derecha.
    expect(montosIzq.length === 1 && !montosIzq[0].eq(montosDe(der)[0])).toBe(false)
  })

  it('B27 · traza: el valor de un bono con precio de 6 decimales muestra el precio a 4 y la cuenta no da', () => {
    const h = hechos({
      operaciones: [op({ fecha: '2026-10-01', activo_id: 4, tipo: 'apertura', cantidad: D(8000000), precio: D('1.097475') })],
      tipos_cambio: [tc('2026-10-05', 1500)],
      cotizaciones: [cot('2026-10-05', 4, '1.097475')],
    })
    const i = foto(h, '2026-10-05').items[0]
    const [q, p, total] = montosDe(i.valor_ars.formula)
    // "8.000.000 × $ 1,0975 = $ 8.779.800,00": 8.000.000 × 1,0975 = 8.780.000.
    expect(q.times(p).eq(total) || q.times(p).div(100).eq(total)).toBe(true)
  })

  it('B28 · D-35: el término cruzado no se devuelve aparte ni aparece en la traza ("de lo cual: interacción")', () => {
    const h = hechos({
      operaciones: [op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(100), precio: D(10000) })],
      tipos_cambio: [tc('2026-10-01', 1000), tc('2026-10-02', 1120)],
      cotizaciones: [cot('2026-10-01', 1, 10000), cot('2026-10-02', 1, 11000)],
    })
    const v = variacion(h, '2026-10-01', '2026-10-02')
    const traza = JSON.stringify(parteCalc(v, h, 'financiero', 'activo', 'ARS'))
    expect('interaccion' in v.contribuciones[0] || /interacci/i.test(traza)).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════
// COBERTURA: comportamientos correctos que no tenían test
// ═════════════════════════════════════════════════════════════════════════

/** El set del Apéndice B de docs/vision.md al 13/10 y al 14/10 (con la carga express del 15/10). */
function apendiceB(conExpress = false): Hechos {
  const ap = (cuenta_id: number, activo_id: number, q: string | number) =>
    op({ fecha: '2026-10-01', cuenta_id, activo_id, tipo: 'apertura', cantidad: D(q), precio: D(1) })
  const precios: [number, string, string][] = [
    [1, '34700', '35150'],
    [3, '52500', '52300'],
    [2, '1.0845', '1.0852'],
    [4, '1.1232', '1.1240'],
    [5, '4.8105', '4.8120'],
    [6, '1.0306', '1.0310'],
  ]
  return hechos({
    operaciones: [ap(IEB, 1, 1240), ap(IEB, 3, 300), ap(GALICIA, 2, 11500000), ap(IEB, 4, 9000000), ap(GALICIA, 5, 1250000), ap(IEB, 6, 5000000)],
    tipos_cambio: [tc('2026-10-13', '1531.70'), tc('2026-10-14', '1548.20'), ...(conExpress ? [tc('2026-10-15', '1560.00')] : [])],
    cotizaciones: precios.flatMap(([id, p13, p14]) => [cot('2026-10-13', id, p13), cot('2026-10-14', id, p14)]),
    saldos: [
      saldo('2026-10-13', IEB, 'USD', 4200),
      saldo('2026-10-14', IEB, 'USD', 4200),
      saldo('2026-10-13', IEB, 'ARS', -185000),
      saldo('2026-10-14', IEB, 'ARS', -185000),
      saldo('2026-10-13', MP, 'ARS', 4908600),
      saldo('2026-10-14', MP, 'ARS', 4912300),
    ],
    bienes: [CASA, CAMIONETA],
    valuaciones: [valuacion(1, '2025-09-15', 200000), valuacion(2, '2026-03-01', 38000000)],
    pasivos: [LEASING],
    pasivo_saldos: [capital(1, '2026-09-30', 21400000)],
    feriados: [{ mercado: 'AR', fecha: '2026-10-12', descripcion: 'Feriado' }],
  })
}

const suma = (xs: Decimal[]) => xs.reduce((a, b) => a.plus(b), D(0))
const a4 = (d: Decimal | string) => new Decimal(d).toDecimalPlaces(4).toFixed(4)

describe('cobertura', () => {
  describe('Apéndice B: lo que el set de ejemplo no verifica', () => {
    it('total del día 13/10 → 14/10: casa, camioneta y licuación del leasing (D-05, D-35)', () => {
      const h = apendiceB()
      const v = variacion(h, '2026-10-13', '2026-10-14')
      const c = (k: string) => v.contribuciones.find((x) => x.clave === k)!
      expect(c('b:1').tc.ars.toFixed()).toBe('3300000') // 200.000 × (1.548,20 − 1.531,70)
      expect(a4(c('b:2').tc.usd)).toBe('-264.4032') // camioneta valuada en pesos
      expect(a4(c('d:1').tc.usd)).toBe('148.9008') // licuación del leasing
      expect(c('d:1').flujos).toEqual([]) // el capital no cambió: no hay flujo
      expect(parteCalc(v, h, 'total', 'resultado', 'ARS').valor!.toFixed()).toBe('3890125')
      expect(a4(parteCalc(v, h, 'total', 'resultado', 'USD').valor!)).toBe('-455.7472')
      const hoy = armarHoy(h, '2026-10-14')
      expect(D(hoy.total.valor.ars.valor!).toFixed()).toBe('430511540')
      expect(a4(hoy.total.variacion!.usd.valor!)).toBe('-455.7472')
    })

    it('carga express del 15/10: todo queda sin atribuir, activo y CCL valen 0 (D-35, D-64)', () => {
      const h = apendiceB(true)
      const v = variacion(h, '2026-10-14', '2026-10-15')
      const p = (parte: 'resultado' | 'activo' | 'tc' | 'sin_atribuir', m: 'ARS' | 'USD') => parteCalc(v, h, 'financiero', parte, m).valor!
      expect(p('resultado', 'ARS').toFixed()).toBe('49560')
      expect(a4(p('resultado', 'USD'))).toBe('-477.6744')
      expect(p('activo', 'ARS').isZero() && p('tc', 'ARS').isZero() && p('activo', 'USD').isZero() && p('tc', 'USD').isZero()).toBe(true)
      expect(p('sin_atribuir', 'ARS').eq(p('resultado', 'ARS'))).toBe(true)
      expect(p('sin_atribuir', 'USD').eq(p('resultado', 'USD'))).toBe(true)
      expect(a4(v.contribuciones.find((c) => c.clave === 'p:1:1')!.sin_atribuir.usd)).toBe('-212.9499')
      const f = armarHoy(h, '2026-10-15').frase!
      expect(f.sin_atribuir).not.toBeNull() // hay dólares en IEB: el "sin atribuir" en pesos es +$49.560
      expect(armarHoy(h, '2026-10-15').movimientos.every((m) => m.sin_precio_nuevo)).toBe(true)
    })

    it('exposición: activos en dólares, moneda de riesgo, geografía, concentración y liquidez', () => {
      const e = armarExposicion(apendiceB(), '2026-10-14', 'financiero')
      expect(D(e.activos_en_dolares.ars.valor!).toFixed()).toBe('50088440')
      expect(D(e.activos_en_dolares.usd.valor!).toFixed(2)).toBe('32352.69')
      const pct = (ss: typeof e.por_moneda, k: string) => D(ss.find((s) => s.clave === k)!.peso.valor!).times(100).toFixed(2)
      expect(pct(e.por_moneda, 'USD')).toBe('48.04')
      expect(pct(e.por_geografia, 'US')).toBe('41.80')
      expect(pct(e.por_clase, 'liquidez')).toBe('10.77')
      expect(e.concentracion.top1_nombre).toBe('SPY')
      expect(D(e.concentracion.top1.valor!).times(100).toFixed(2)).toBe('41.80')
      expect(D(e.concentracion.top3.valor!).times(100).toFixed(2)).toBe('68.82')
      // +1% de CCL con el neto largo en pesos: pierde dólares (signo negativo)
      expect(D(e.resumen.sensibilidad_usd_1pct.valor!).toFixed(2)).toBe('-209.65')
    })

    it('cada parte de la frase y el cuadre salen por posición, y suman exacto (D-35, D-66)', () => {
      const h = apendiceB()
      const v = variacion(h, '2026-10-13', '2026-10-14')
      const fin = v.contribuciones.filter((c) => c.clase === 'posicion' || c.clase === 'saldo')
      for (const k of ['ars', 'usd'] as const) {
        const partes = suma(fin.map((c) => c.activo[k].plus(c.tc[k]).plus(c.sin_atribuir[k])))
        const delta = financieroEn(h, '2026-10-14', k).minus(financieroEn(h, '2026-10-13', k))
        expect(partes.minus(delta).abs().lt('1e-20')).toBe(true)
      }
    })
  })

  describe('días reales', () => {
    it('compra del día con PPP "-": la cantidad cuenta, el PPC es "pendiente" y el flujo se infiere al precio del día (D-19)', () => {
      const h = hechos({
        operaciones: [
          op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(100), precio: D(10000) }),
          op({ fecha: '2026-10-06', activo_id: 1, tipo: 'compra', cantidad: D(10), ccl_del_dia: D(1000) }),
        ],
        tipos_cambio: [tc('2026-10-05', 1000), tc('2026-10-06', 1000)],
        cotizaciones: [cot('2026-10-05', 1, 10000), cot('2026-10-06', 1, 10000)],
        saldos: [saldo('2026-10-05', IEB, 'ARS', 200000), saldo('2026-10-06', IEB, 'ARS', 100000)],
      })
      const fila = armarCartera(h, '2026-10-06').filas.find((f) => f.ticker === 'SPY')!
      expect(fila.cantidad.valor).toBe('110')
      expect(D(fila.valor.ars.valor!).toFixed()).toBe('1100000')
      expect(fila.ppc.ars.valor).toBeNull()
      expect(fila.ppc.ars.etiquetas).toContain('pendiente')
      expect(fila.pendiente).toMatch(/pendiente/)
      expect(armarHoy(h, '2026-10-06').atencion.some((p) => p.id === 'pendiente:p:1:1')).toBe(true)
      const v = variacion(h, '2026-10-05', '2026-10-06')
      const spy = v.contribuciones.find((c) => c.clave === 'p:1:1')!
      expect(spy.flujos[0].inferido).toBe(true)
      expect(parteCalc(v, h, 'financiero', 'resultado', 'ARS').valor!.isZero()).toBe(true) // nada se ganó
    })

    it('apertura sin PPP (Día cero): el costo es "sin dato", nunca cero, y el total de Cartera también (D-14, D-65)', () => {
      const h = hechos({
        operaciones: [op({ fecha: '2026-10-01', activo_id: 3, tipo: 'apertura', cantidad: D(300) })],
        tipos_cambio: [tc('2026-10-01', 1500)],
        cotizaciones: [cot('2026-10-01', 3, 52300)],
      })
      const c = armarCartera(h, '2026-10-01')
      expect(c.filas[0].ppc.ars.valor).toBeNull()
      expect(c.filas[0].resultado.ars.valor).toBeNull()
      expect(c.totales.costo.ars.valor).toBeNull()
      expect(c.totales.resultado.ars.valor).toBeNull()
      expect(D(c.totales.valor.ars.valor!).toFixed()).toBe('15690000')
    })

    it('Día cero: una sola carga muestra el patrimonio, sin frase y sin cuadre', () => {
      const h = hechos({
        operaciones: [op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(10), precio: D(10000) })],
        tipos_cambio: [tc('2026-10-01', 1000)],
        cotizaciones: [cot('2026-10-01', 1, 10000)],
      })
      const v = armarHoy(h, '2026-10-01')
      expect(v.hay_datos).toBe(true)
      expect(v.frase).toBeNull()
      expect(v.financiero.variacion).toBeNull()
      expect(v.cuadre.ars_ok).toBeNull()
      expect(D(v.financiero.valor.usd.valor!).toFixed()).toBe('100')
      expect(v.cargo_hoy).toBe(true)
    })

    it('vendida a cero y recomprada: la tenencia nueva arranca de cero (costo y fecha de inicio)', () => {
      const t = tenencias([
        op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(10), precio: D(1000), ccl_del_dia: D(800), fecha_origen: '2026-01-01' }),
        op({ fecha: '2026-10-05', activo_id: 1, tipo: 'venta', cantidad: D(10), precio: D(1500), ccl_del_dia: D(1000) }),
        op({ fecha: '2026-10-07', activo_id: 1, tipo: 'compra', cantidad: D(4), precio: D(2000), comisiones: D(8), ccl_del_dia: D(1100) }),
      ]).get('1:1')!
      expect(t.cantidad.toFixed()).toBe('4')
      expect(t.costo_ars!.toFixed()).toBe('8008')
      expect(t.costo_usd!.toFixed()).toBe(D(8008).div(1100).toFixed())
      expect(t.fecha_inicio).toBe('2026-10-07')
      expect(t.etiquetas).not.toContain('declarado') // la etiqueta de la apertura vendida no se hereda
    })

    it('venta mayor que la tenencia: cierra en cero, sin cantidades negativas', () => {
      const m = tenencias([
        op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(10), precio: D(1000) }),
        op({ fecha: '2026-10-02', activo_id: 1, tipo: 'venta', cantidad: D(12), precio: D(1000), ccl_del_dia: D(1000) }),
      ])
      expect(m.size).toBe(0)
    })

    it('cambio de ratio con precio nuevo del mismo día: no es flujo, el costo no cambia y el PPC se parte', () => {
      const h = hechos({
        operaciones: [
          op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(100), precio: D(20000), ccl_del_dia: D(1000), fecha_origen: '2026-01-02' }),
          op({ fecha: '2026-10-06', activo_id: 1, tipo: 'ajuste_ratio', cantidad: D(100), ccl_del_dia: D(1000) }),
        ],
        tipos_cambio: [tc('2026-10-05', 1000), tc('2026-10-06', 1000)],
        cotizaciones: [cot('2026-10-05', 1, 20000), cot('2026-10-06', 1, 10100)],
      })
      const v = variacion(h, '2026-10-05', '2026-10-06')
      const c = v.contribuciones[0]
      expect(c.flujos).toEqual([])
      expect(c.resultado.ars.toFixed()).toBe('20000') // 200 × 10.100 − 100 × 20.000
      const t = tenencias(h.operaciones).get('1:1')!
      expect(ppcCalc(t, 'ARS').valor!.toFixed()).toBe('10000')
      expect(ppcCalc(t, 'USD').valor!.toFixed()).toBe('10')
    })

    it('vencimiento de una LECAP: la posición sale, la plata entra al saldo y el resultado es solo el último devengamiento', () => {
      const h = hechos({
        operaciones: [
          op({ fecha: '2026-10-01', activo_id: 2, tipo: 'apertura', cantidad: D(1000000), precio: D('1.05') }),
          op({ fecha: '2026-11-13', activo_id: 2, tipo: 'vencimiento', cantidad: D(1000000), importe: D(1105000), ccl_del_dia: D(1600) }),
        ],
        tipos_cambio: [tc('2026-11-12', 1600), tc('2026-11-13', 1600)],
        cotizaciones: [cot('2026-11-12', 2, '1.1048')],
        saldos: [saldo('2026-11-12', IEB, 'ARS', 0), saldo('2026-11-13', IEB, 'ARS', 1105000)],
      })
      const v = variacion(h, '2026-11-12', '2026-11-13')
      expect(foto(h, '2026-11-13').items.some((i) => i.clase === 'posicion')).toBe(false)
      expect(parteCalc(v, h, 'financiero', 'resultado', 'ARS').valor!.toFixed()).toBe('200') // 1.105.000 − 1.104.800
      expect(v.contribuciones.find((c) => c.clave === 's:1:ARS')!.resultado.ars.isZero()).toBe(true)
    })

    it('cobro en USD el día de la carga: los dos lados del flujo se cancelan en las dos monedas', () => {
      const h = hechos({
        operaciones: [
          op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(10), precio: D(10000) }),
          op({ fecha: '2026-10-06', activo_id: 1, tipo: 'renta', cantidad: D(0), moneda: 'USD', importe: D(50), ccl_del_dia: D(1100) }),
        ],
        tipos_cambio: [tc('2026-10-05', 1000), tc('2026-10-06', 1100)],
        cotizaciones: [cot('2026-10-05', 1, 10000), cot('2026-10-06', 1, 11000)],
        saldos: [saldo('2026-10-05', IEB, 'USD', 100), saldo('2026-10-06', IEB, 'USD', 150)],
      })
      const v = variacion(h, '2026-10-05', '2026-10-06')
      for (const [k, m] of [['ars', 'ARS'], ['usd', 'USD']] as const) {
        const delta = financieroEn(h, '2026-10-06', k).minus(financieroEn(h, '2026-10-05', k))
        expect(parteCalc(v, h, 'financiero', 'resultado', m).valor!.minus(delta).abs().lt('1e-20')).toBe(true)
      }
      // el dividendo es resultado del CEDEAR, no del saldo
      expect(v.contribuciones.find((c) => c.clave === 's:1:USD')!.resultado.usd.isZero()).toBe(true)
      expect(v.contribuciones.find((c) => c.clave === 'p:1:1')!.resultado.usd.toFixed()).toBe('50')
    })

    it('depósito a Mercado Pago con la captura del mismo día: el resultado es solo el interés (D-06)', () => {
      const h = hechos({
        tipos_cambio: [tc('2026-10-05', 1000), tc('2026-10-06', 1000)],
        saldos: [saldo('2026-10-05', MP, 'ARS', 1000000), saldo('2026-10-06', MP, 'ARS', 1500300)],
        movimientos: [mov({ fecha: '2026-10-06', tipo: 'aporte', cuenta_destino_id: MP, moneda_destino: 'ARS', monto_destino: D(500000) })],
      })
      const f = armarHoy(h, '2026-10-06').frase!
      expect(f.variacion.ars.valor).toBe('300')
      expect(D(f.variacion.usd.valor!).toFixed()).toBe('0.3')
    })

    it('transferencia entre cuentas propias con acreditación al día siguiente: no es resultado', () => {
      const h = hechos({
        tipos_cambio: [tc('2026-10-05', 1000), tc('2026-10-06', 1000), tc('2026-10-07', 1000)],
        saldos: [
          saldo('2026-10-05', GALICIA, 'ARS', 800000),
          saldo('2026-10-06', GALICIA, 'ARS', 300000),
          saldo('2026-10-07', GALICIA, 'ARS', 300000),
          saldo('2026-10-05', MP, 'ARS', 100000),
          saldo('2026-10-06', MP, 'ARS', 100000),
          saldo('2026-10-07', MP, 'ARS', 600000),
        ],
        movimientos: [
          mov({ fecha: '2026-10-06', fecha_acreditacion: '2026-10-07', tipo: 'transferencia', cuenta_origen_id: GALICIA, cuenta_destino_id: MP, moneda_origen: 'ARS', monto_origen: D(500000), moneda_destino: 'ARS', monto_destino: D(500000) }),
        ],
      })
      for (const [a, b] of [['2026-10-05', '2026-10-06'], ['2026-10-06', '2026-10-07']] as const) {
        expect(parteCalc(variacion(h, a, b), h, 'financiero', 'resultado', 'ARS').valor!.isZero()).toBe(true)
      }
    })

    it('saldo negativo de IEB: resta en el financiero y en los pesos; con el CCL en alza, se licúa en dólares', () => {
      const h = hechos({
        tipos_cambio: [tc('2026-10-05', 1000), tc('2026-10-06', 1100)],
        saldos: [saldo('2026-10-05', IEB, 'ARS', -110000), saldo('2026-10-06', IEB, 'ARS', -110000), saldo('2026-10-05', MP, 'ARS', 1100000), saldo('2026-10-06', MP, 'ARS', 1100000)],
      })
      const hoy = armarHoy(h, '2026-10-06')
      expect(D(hoy.financiero.valor.ars.valor!).toFixed()).toBe('990000')
      expect(D(hoy.exposicion.pesos_financieros.ars.valor!).toFixed()).toBe('990000')
      const ieb = variacion(h, '2026-10-05', '2026-10-06').contribuciones.find((c) => c.clave === 's:1:ARS')!
      expect(ieb.tc.usd.toDecimalPlaces(20).toFixed()).toBe('10') // −110.000 × (1/1.100 − 1/1.000) = +10
    })

    it('dólares en IEB: con el CCL en alza, en pesos todo es tipo de cambio y en dólares no hay resultado', () => {
      const h = hechos({
        tipos_cambio: [tc('2026-10-05', 1000), tc('2026-10-06', 1100)],
        saldos: [saldo('2026-10-05', IEB, 'USD', 4200), saldo('2026-10-06', IEB, 'USD', 4200)],
      })
      const c = variacion(h, '2026-10-05', '2026-10-06').contribuciones[0]
      expect(c.tc.ars.toFixed()).toBe('420000')
      expect(c.activo.ars.isZero() && c.resultado.usd.isZero()).toBe(true)
    })

    it('casa valuada en dólares y leasing en pesos: el total suma la casa al CCL y resta el capital', () => {
      const h = hechos({
        tipos_cambio: [tc('2026-10-05', 1000)],
        saldos: [saldo('2026-10-05', MP, 'ARS', 1000000)],
        bienes: [CASA, CAMIONETA],
        valuaciones: [valuacion(1, '2025-09-15', 200000), valuacion(2, '2026-03-01', 38000000)],
        pasivos: [LEASING],
        pasivo_saldos: [capital(1, '2026-09-30', 21400000)],
      })
      const v = armarHoy(h, '2026-10-05')
      expect(D(v.financiero.valor.ars.valor!).toFixed()).toBe('1000000') // D-03: sin la casa
      expect(D(v.total.valor.ars.valor!).toFixed()).toBe(D(1000000).plus(200000000).plus(38000000).minus(21400000).toFixed())
      expect(D(v.exposicion.deuda_pesos.ars.valor!).toFixed()).toBe('21400000')
    })

    it('bono o letra: el valor es cantidad × precio por 1 VN, sin dividir por 100 (D-12)', () => {
      const h = hechos({
        operaciones: [op({ fecha: '2026-10-01', activo_id: 4, tipo: 'apertura', cantidad: D(9000000), precio: D('1.097475') })],
        tipos_cambio: [tc('2026-10-14', '1548.2')],
        cotizaciones: [cot('2026-10-14', 4, '1.124')],
      })
      expect(foto(h, '2026-10-14').items[0].valor_ars.valor!.toFixed()).toBe('10116000')
    })

    it('apertura con CCL de compra declarado: PPC en dólares "declarado" y días desde la compra real (D-14)', () => {
      const h = hechos({
        operaciones: [op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(1000), precio: D(29100), ccl_del_dia: D(1390), fecha_origen: '2026-03-02' })],
        tipos_cambio: [tc('2026-10-14', '1548.2')],
        cotizaciones: [cot('2026-10-14', 1, 35150)],
      })
      const f = armarCartera(h, '2026-10-14').filas[0]
      expect(D(f.ppc.usd.valor!).toFixed(4)).toBe(D(29100).div(1390).toFixed(4))
      expect(f.ppc.usd.etiquetas).toContain('declarado')
      expect(f.dias_en_posicion).toBe(226)
      expect(f.pendiente).toBeNull()
      const suma = D(f.desglose!.activo.valor!).plus(f.desglose!.tc.valor!)
      expect(suma.minus(f.resultado.ars.valor!).abs().lt('1e-20')).toBe(true)
    })
  })

  describe('datos que faltan o están viejos', () => {
    it('sin CCL cargado: todo lo que está en dólares es "sin dato", nunca cero, y el total muestra la suma parcial', () => {
      const h = hechos({
        operaciones: [op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(10), precio: D(10000) })],
        cotizaciones: [cot('2026-10-01', 1, 10000)],
        saldos: [saldo('2026-10-01', IEB, 'USD', 100)],
      })
      const v = armarHoy(h, '2026-10-01')
      expect(v.financiero.valor.usd.valor).toBeNull()
      expect(v.financiero.valor.ars.valor).toBeNull() // los dólares de IEB no se pueden pasar a pesos
      expect(v.financiero.valor.ars.etiquetas).toContain('parcial')
      expect(v.atencion[0].id).toBe('sin-ccl')
    })

    it('D-65: sacar todos los precios de cualquier posición deja el total en "sin dato" con la suma parcial', () => {
      for (const id of [1, 2, 3, 4, 5, 6]) {
        const h = apendiceB()
        h.cotizaciones = h.cotizaciones.filter((c) => c.activo_id !== id)
        const v = armarHoy(h, '2026-10-14')
        expect(v.financiero.valor.ars.valor).toBeNull()
        expect(v.financiero.valor.ars.motivo).toMatch(/Suma parcial \(8 de 9\)/)
        expect(v.frase!.variacion.ars.valor).toBeNull()
        expect(v.frase!.variacion.ars.motivo).toMatch(/Suma parcial/)
        expect(v.cuadre.ars_ok).toBeNull()
      }
    })

    it('precio de más de 2 días hábiles: se valúa con el último, marcado "viejo", y entra en Atención (D-16)', () => {
      const h = hechos({
        operaciones: [op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(10), precio: D(10000) })],
        tipos_cambio: [tc('2026-10-01', 1000), tc('2026-10-07', 1100)],
        cotizaciones: [cot('2026-10-01', 1, 10000)],
      })
      const item = foto(h, '2026-10-07').items[0]
      expect(item.viejo).toBe(true)
      expect(item.valor_usd.etiquetas).toContain('viejo')
      expect(item.valor_ars.valor!.toFixed()).toBe('100000')
      expect(armarHoy(h, '2026-10-07').atencion.some((p) => p.id === 'viejo:p:1:1')).toBe(true)
      expect(variacion(h, '2026-10-01', '2026-10-07').contribuciones[0].arrastrado).toBe(true)
    })

    it('feriado y fin de semana: un precio del viernes no es viejo el martes después de un lunes feriado (D-16)', () => {
      const fer = new Set(['2026-10-12'])
      expect(diasHabilesEntre('2026-10-09', '2026-10-14', fer)).toBe(2)
      expect(esViejo('2026-10-09', '2026-10-14', fer)).toBe(false)
      expect(esViejo('2026-10-09', '2026-10-15', fer)).toBe(true)
      expect(esViejo('2026-10-09', '2026-10-11', fer)).toBe(false) // domingo
      const h = hechos({
        operaciones: [op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(10), precio: D(10000) })],
        tipos_cambio: [tc('2026-10-09', 1000)],
        cotizaciones: [cot('2026-10-09', 1, 10000)],
        feriados: [{ mercado: 'AR', fecha: '2026-10-12', descripcion: 'Feriado' }],
      })
      const v = armarHoy(h, '2026-10-13')
      expect(v.atencion.some((p) => p.id.startsWith('viejo:'))).toBe(false)
      expect(armarHoy(h, '2026-10-12').es_habil_hoy).toBe(false)
    })

    it('la fecha es la de Córdoba a medianoche, también el 31/12', () => {
      expect(fechaEnCordoba(new Date('2026-12-31T02:59:59Z'))).toBe('2026-12-30')
      expect(fechaEnCordoba(new Date('2026-12-31T03:00:00Z'))).toBe('2026-12-31')
    })

    it('carga express de sábado: todo queda sin atribuir y nada se rompe', () => {
      const h = apendiceB()
      h.tipos_cambio.push(tc('2026-10-17', '1555'))
      const v = armarHoy(h, '2026-10-17')
      expect(v.es_habil_hoy).toBe(false)
      expect(v.frase!.activos.ars.valor).toBe('0')
      expect(v.frase!.sin_atribuir).not.toBeNull()
      expect(v.cuadre.ars_ok).toBe(true)
    })
  })

  describe('cargas', () => {
    it('dos cargas el mismo día cuentan como una fecha, y la reemplazada no es la última fuente', () => {
      const h = apendiceB()
      h.cargas = [carga(30, '2026-10-14', IEB, 'reemplazada'), carga(31, '2026-10-14', IEB), carga(20, '2026-10-13', IEB)]
      expect(fechasDeCarga(h)).toEqual(['2026-10-13', '2026-10-14'])
      const ieb = armarHoy(h, '2026-10-14').fuentes.find((f) => f.nombre === 'IEB')!
      expect(ieb.carga_id).toBe(31)
    })

    it('conciliar: compra del día con PPP "-" en el Día cero entra como compra pendiente (D-19)', () => {
      const h = hechos()
      const p = proponerCarga([lecturaIEB([filaIEB('SPY', '191', { liquidacion: 'liquidar', precio_unitario: '35150' })], '2026-10-01')], h, '2026-10-01', { ccl: D(1500) })
      expect(p.filas[0].accion).toBe('compra')
      expect(p.filas[0].operacion!.precio).toBeNull()
      expect(p.filas[0].operacion!.ccl_del_dia).toBe('1500')
    })

    it('conciliar: el precio de la compra faltante sale del cambio de PPP (D-15, D-19; Apéndice B, T30J7)', () => {
      const h = hechos({
        operaciones: [op({ fecha: '2026-10-01', activo_id: 4, tipo: 'apertura', cantidad: D(8000000), precio: D('1.097475') })],
        cargas: [carga(1, '2026-10-01', IEB)],
      })
      const p = proponerCarga([lecturaIEB([filaIEB('T30J7', '9000000', { ppc_unitario: '1.0976', precio_unitario: '1.1232' })], '2026-10-08')], h, '2026-10-08', { ccl: D('1519.4') })
      expect(p.filas[0].accion).toBe('compra')
      expect(p.filas[0].operacion!.cantidad).toBe('1000000')
      expect(p.filas[0].operacion!.precio).toBe('1.0986')
    })

    it('conciliar: una carga revertida no cuenta como cuenta ya cargada (vuelve a proponer aperturas)', () => {
      const h = hechos({ cargas: [] }) // leerHechos ya filtra las revertidas y sus filas se borraron
      const p = proponerCarga([lecturaIEB([filaIEB('SPY', '100', { ppc_unitario: '20000' })], '2026-10-02')], h, '2026-10-02', { ccl: null })
      expect(p.filas[0].accion).toBe('apertura')
      expect(p.filas[0].estado).not.toBe('error') // una apertura no necesita CCL
    })
  })

  describe('propiedades', () => {
    it('con CCL coherentes, el resultado del financiero es la variación del patrimonio menos los aportes, en las dos monedas', () => {
      const precio = fc.integer({ min: 100, max: 5_000_000 }).map((n) => D(n).div(100))
      const ccl = fc.integer({ min: 50_000, max: 400_000 }).map((n) => D(n).div(100))
      const q = fc.integer({ min: 1, max: 100_000 })
      fc.assert(
        fc.property(
          fc.boolean(), precio, precio, ccl, ccl, q,
          fc.option(fc.tuple(q, precio, fc.integer({ min: 0, max: 5000 })), { nil: null }),
          fc.option(fc.tuple(fc.integer({ min: 1, max: 100 }), precio), { nil: null }),
          fc.option(fc.integer({ min: 1, max: 10_000_000 }), { nil: null }),
          fc.integer({ min: -1_000_000, max: 50_000_000 }),
          (usd, p0, p1, c0, c1, q0, compra, venta, aporte, s0) => {
            const id = usd ? 1 : 2
            const ops: Operacion[] = [op({ fecha: '2026-10-01', activo_id: id, tipo: 'apertura', cantidad: D(q0), precio: p0 })]
            let s1 = D(s0)
            if (compra) {
              ops.push(op({ fecha: '2026-10-06', activo_id: id, tipo: 'compra', cantidad: D(compra[0]), precio: compra[1], comisiones: D(compra[2]), ccl_del_dia: c1 }))
              s1 = s1.minus(D(compra[0]).times(compra[1]).plus(compra[2]))
            }
            if (venta) {
              const qv = Math.min(venta[0], q0)
              ops.push(op({ fecha: '2026-10-06', activo_id: id, tipo: 'venta', cantidad: D(qv), precio: venta[1], ccl_del_dia: c1 }))
              s1 = s1.plus(D(qv).times(venta[1]))
            }
            if (aporte) s1 = s1.plus(aporte)
            const h = hechos({
              operaciones: ops,
              tipos_cambio: [tc('2026-10-05', c0.toFixed()), tc('2026-10-06', c1.toFixed())],
              cotizaciones: [cot('2026-10-05', id, p0.toFixed()), cot('2026-10-06', id, p1.toFixed())],
              saldos: [saldo('2026-10-05', IEB, 'ARS', s0), saldo('2026-10-06', IEB, 'ARS', s1.toFixed())],
              movimientos: aporte ? [mov({ fecha: '2026-10-06', tipo: 'aporte', cuenta_destino_id: IEB, moneda_destino: 'ARS', monto_destino: D(aporte) })] : [],
            })
            const v = variacion(h, '2026-10-05', '2026-10-06')
            const ap = D(aporte ?? 0)
            const okA = parteCalc(v, h, 'financiero', 'resultado', 'ARS').valor!.minus(financieroEn(h, '2026-10-06', 'ars').minus(financieroEn(h, '2026-10-05', 'ars')).minus(ap)).abs().lt('1e-18')
            const okU = parteCalc(v, h, 'financiero', 'resultado', 'USD').valor!.minus(financieroEn(h, '2026-10-06', 'usd').minus(financieroEn(h, '2026-10-05', 'usd')).minus(ap.div(c1))).abs().lt('1e-18')
            return okA && okU
          },
        ),
        { numRuns: 400 },
      )
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════
// ATRIBUCIÓN ANCLADA (decisión A de la fase 1a, provisoria; visión 4.2, D-35)
// y decisiones B, C y D. Números inventados.
// ═════════════════════════════════════════════════════════════════════════

const PARTES = ['resultado', 'activo', 'tc', 'sin_atribuir'] as const
const MONEDAS = ['ars', 'usd'] as const
const cerca18 = (a: Decimal, b: Decimal) => a.minus(b).abs().lte('1e-18')

/** Historia aleatoria de 6 días hábiles con cargas completas, medias, express y sin CCL. */
function historia(
  tipos: ('completa' | 'media' | 'express' | 'sin_ccl')[],
  ccls: number[],
  pSpy: number[],
  pLecap: number[],
  sIeb: number[],
  sMp: number[],
  compra: { dia: number; q: number; precio: number } | null,
  aporte: { dia: number; monto: number } | null,
): Hechos {
  const DIAS = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-12']
  const h = hechos({
    operaciones: [
      op({ fecha: DIAS[0], activo_id: 1, tipo: 'apertura', cantidad: D(100), precio: D(pSpy[0]) }),
      op({ fecha: DIAS[0], cuenta_id: GALICIA, activo_id: 2, tipo: 'apertura', cantidad: D(1000000), precio: D(pLecap[0]).div(1000) }),
    ],
  })
  tipos.forEach((t, i) => {
    const d = DIAS[i]
    const tipo = i === 0 ? 'completa' : t
    if (tipo !== 'sin_ccl') h.tipos_cambio.push(tc(d, ccls[i]))
    if (tipo === 'completa' || tipo === 'media' || tipo === 'sin_ccl') {
      h.cotizaciones.push(cot(d, 1, pSpy[i]))
      h.saldos.push(saldo(d, IEB, 'ARS', sIeb[i]))
    }
    if (tipo === 'completa' || tipo === 'sin_ccl') {
      h.cotizaciones.push(cot(d, 2, D(pLecap[i]).div(1000).toFixed()))
      h.saldos.push(saldo(d, MP, 'ARS', sMp[i]))
    }
  })
  if (compra) {
    const d = DIAS[compra.dia]
    h.operaciones.push(op({ fecha: d, activo_id: 1, tipo: 'compra', cantidad: D(compra.q), precio: D(compra.precio), ccl_del_dia: D(ccls[compra.dia]) }))
  }
  if (aporte) {
    h.movimientos.push(mov({ fecha: DIAS[aporte.dia], tipo: 'aporte', cuenta_destino_id: MP, moneda_destino: 'ARS', monto_destino: D(aporte.monto) }))
  }
  return h
}

const arbHistoria = fc
  .record({
    tipos: fc.array(fc.constantFrom('completa' as const, 'media' as const, 'express' as const, 'sin_ccl' as const), { minLength: 6, maxLength: 6 }),
    ccls: fc.array(fc.integer({ min: 900, max: 1300 }), { minLength: 6, maxLength: 6 }),
    pSpy: fc.array(fc.integer({ min: 8000, max: 14000 }), { minLength: 6, maxLength: 6 }),
    pLecap: fc.array(fc.integer({ min: 900, max: 1300 }), { minLength: 6, maxLength: 6 }),
    sIeb: fc.array(fc.integer({ min: -200000, max: 2000000 }), { minLength: 6, maxLength: 6 }),
    sMp: fc.array(fc.integer({ min: 0, max: 5000000 }), { minLength: 6, maxLength: 6 }),
    compra: fc.option(fc.record({ dia: fc.integer({ min: 1, max: 5 }), q: fc.integer({ min: 1, max: 50 }), precio: fc.integer({ min: 8000, max: 14000 }) }), { nil: null }),
    aporte: fc.option(fc.record({ dia: fc.integer({ min: 1, max: 5 }), monto: fc.integer({ min: 1, max: 1000000 }) }), { nil: null }),
  })
  .map((r) => historia(r.tipos, r.ccls, r.pSpy, r.pLecap, r.sIeb, r.sMp, r.compra, r.aporte))

describe('atribución anclada (decisión A)', () => {
  it('propiedad: activo + TC + sin atribuir = resultado, por partida y en las dos monedas', () => {
    fc.assert(
      fc.property(arbHistoria, (h) => {
        const fs = fechasDeCarga(h)
        for (let i = 1; i < fs.length; i++) {
          for (const c of variacion(h, fs[i - 1], fs[i]).contribuciones)
            for (const k of MONEDAS) if (!cerca18(c.activo[k].plus(c.tc[k]).plus(c.sin_atribuir[k]), c.resultado[k])) return false
        }
        return true
      }),
      { numRuns: 150 },
    )
  })

  it('propiedad: el desglose de un período es la suma exacta de sus días', () => {
    fc.assert(
      fc.property(arbHistoria, (h) => {
        const fs = fechasDeCarga(h)
        const periodo = variacion(h, fs[0], fs.at(-1)!)
        const dias = fs.slice(1).map((d, i) => variacion(h, fs[i], d))
        for (const parte of PARTES)
          for (const m of ['ARS', 'USD'] as const) {
            const p = parteCalc(periodo, h, 'financiero', parte, m).valor
            const s = dias.map((v) => parteCalc(v, h, 'financiero', parte, m).valor)
            if (p === null || s.some((x) => x === null)) continue
            if (!cerca18(p, suma(s as Decimal[]))) return false
          }
        return true
      }),
      { numRuns: 100 },
    )
  })

  it('propiedad: una carga express entre dos completas no cambia el desglose del período', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 900, max: 1300 }), { minLength: 3, maxLength: 3 }),
        fc.array(fc.integer({ min: 8000, max: 14000 }), { minLength: 3, maxLength: 3 }),
        fc.array(fc.integer({ min: 900, max: 1300 }), { minLength: 3, maxLength: 3 }),
        fc.array(fc.integer({ min: -200000, max: 2000000 }), { minLength: 3, maxLength: 3 }),
        fc.array(fc.integer({ min: 0, max: 5000000 }), { minLength: 3, maxLength: 3 }),
        (ccls, pSpy, pLecap, sIeb, sMp) => {
          // Días 0 y 2 completos, día 1 express (solo CCL). Sin ese CCL, el día 1 no es una carga.
          const con = historia(['completa', 'express', 'completa'], ccls, pSpy, pLecap, sIeb, sMp, null, null)
          const sin = historia(['completa', 'express', 'completa'], ccls, pSpy, pLecap, sIeb, sMp, null, null)
          sin.tipos_cambio = sin.tipos_cambio.filter((t) => t.fecha !== '2026-10-06')
          const a = variacion(con, '2026-10-05', '2026-10-07')
          const b = variacion(sin, '2026-10-05', '2026-10-07')
          for (const ca of a.contribuciones) {
            const cb = b.contribuciones.find((x) => x.clave === ca.clave)!
            for (const parte of PARTES) for (const k of MONEDAS) if (!cerca18(ca[parte][k], cb[parte][k])) return false
          }
          return true
        },
      ),
      { numRuns: 150 },
    )
  })

  it('propiedad: sin atribuir de un período = pendiente al final − pendiente al principio (cero si las dos puntas son completas)', () => {
    fc.assert(
      fc.property(arbHistoria, (h) => {
        const fs = fechasDeCarga(h)
        const d0 = fs[0]
        const d1 = fs.at(-1)!
        const v = variacion(h, d0, d1)
        // Pendiente de una partida en d = resultado desde su última observación fresca hasta d.
        const pendiente = (clave: string, d: Fecha, k: 'ars' | 'usd'): Decimal => {
          const anclas = fs.filter((x) => x <= d && observacionFresca(h, clave, x, d1))
          const a = anclas.at(-1)
          if (!a || a === d) return D(0)
          return variacion(h, a, d).contribuciones.find((c) => c.clave === clave)?.resultado[k] ?? D(0)
        }
        for (const c of v.contribuciones) {
          if (c.clase !== 'posicion' && c.clase !== 'saldo') continue
          for (const k of MONEDAS) {
            const esperado = pendiente(c.clave, d1, k).minus(pendiente(c.clave, d0, k))
            if (!c.sin_atribuir[k].minus(esperado).abs().lte('1e-12')) return false
          }
        }
        return true
      }),
      { numRuns: 60 },
    )
  })

  it('visión 4.2: el viernes completo devuelve lo que el jueves express dejó sin atribuir (hallazgo 4 de la referencia)', () => {
    const h = hechos({
      operaciones: [op({ fecha: '2026-10-07', activo_id: 1, tipo: 'apertura', cantidad: D(100), precio: D(10000) })],
      tipos_cambio: [tc('2026-10-07', 1000), tc('2026-10-08', 1100), tc('2026-10-09', 1120)],
      cotizaciones: [cot('2026-10-07', 1, 10000), cot('2026-10-09', 1, 11000)],
    })
    const jue = variacion(h, '2026-10-07', '2026-10-08').contribuciones[0]
    expect(jue.arrastrado).toBe(true)
    expect(a4(jue.sin_atribuir.usd)).toBe('-90.9091')
    const vie = variacion(h, '2026-10-08', '2026-10-09').contribuciones[0]
    // D-35 sobre mié → vie: activo −$20.000 y TC +$120.000; en dólares activo −US$ 17,86 y vuelven +US$ 90,91.
    expect(vie.activo.ars.toDecimalPlaces(12).toFixed()).toBe('-20000')
    expect(vie.tc.ars.toDecimalPlaces(12).toFixed()).toBe('120000')
    expect(a4(vie.activo.usd)).toBe('-17.8571')
    expect(a4(vie.sin_atribuir.usd)).toBe('90.9091')
    expect(vie.ancla?.desde).toBe('2026-10-07')
    // La frase del viernes lo dice.
    const f = armarHoy(h, '2026-10-09').frase!
    expect(f.partes.map((p) => p.texto).join('')).toMatch(/había quedado sin atribuir/)
    // La semana entera: nada sin atribuir.
    const sem = variacion(h, '2026-10-07', '2026-10-09').contribuciones[0]
    expect(sem.sin_atribuir.ars.isZero() && sem.sin_atribuir.usd.abs().lt('1e-18')).toBe(true)
  })

  it('B02 con la decisión A: el miércoles los activos son el interés (+$300) y vuelve el −$500.000 del martes', () => {
    const h = hechos({
      tipos_cambio: [tc('2026-10-05', 1000), tc('2026-10-06', 1000), tc('2026-10-07', 1000)],
      saldos: [saldo('2026-10-05', MP, 'ARS', 1000000), saldo('2026-10-07', MP, 'ARS', 1500300)],
      movimientos: [mov({ fecha: '2026-10-06', tipo: 'aporte', cuenta_destino_id: MP, moneda_destino: 'ARS', monto_destino: D(500000) })],
    })
    const mar = variacion(h, '2026-10-05', '2026-10-06').contribuciones[0]
    expect(mar.sin_atribuir.ars.toFixed()).toBe('-500000')
    const mie = variacion(h, '2026-10-06', '2026-10-07').contribuciones[0]
    expect(mie.activo.ars.toFixed()).toBe('300')
    expect(mie.sin_atribuir.ars.toFixed()).toBe('500000')
    const periodo = variacion(h, '2026-10-05', '2026-10-07').contribuciones[0]
    expect(periodo.activo.ars.toFixed()).toBe('300')
    expect(periodo.sin_atribuir.ars.toFixed()).toBe('0')
  })

  it('hallazgo 3 de la referencia: una posición nueva valuada a un precio viejo queda sin atribuir', () => {
    const h = hechos({
      tipos_cambio: [tc('2026-10-05', 1000), tc('2026-10-06', 1100)],
      cotizaciones: [cot('2026-10-01', 1, 10000)],
      operaciones: [op({ fecha: '2026-10-06', activo_id: 1, tipo: 'compra', cantidad: D(10), precio: D(10500), ccl_del_dia: D(1100) })],
    })
    const c = variacion(h, '2026-10-05', '2026-10-06').contribuciones.find((x) => x.clave === 'p:1:1')!
    expect(c.activo.ars.isZero() && c.tc.ars.isZero() && c.activo.usd.isZero()).toBe(true)
    expect(c.sin_atribuir.ars.toFixed()).toBe('-5000')
  })

  it('B08 con la decisión A: sin CCL tipeado el día, nada se atribuye y la frase lo dice', () => {
    const h = hechos({
      operaciones: [op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(10), precio: D(10000) })],
      tipos_cambio: [tc('2026-10-05', 1000), tc('2026-10-06', null, 1050)],
      cotizaciones: [cot('2026-10-05', 1, 10000), cot('2026-10-06', 1, 11000)],
    })
    const hoy = armarHoy(h, '2026-10-06')
    expect(hoy.frase!.sin_ccl_nuevo).toBe(true)
    expect(hoy.frase!.partes.map((p) => p.texto).join('')).toMatch(/no tiene CCL/)
    expect(D(hoy.frase!.sin_atribuir!.ars.valor!).toFixed()).toBe('10000')
  })

  it('carga express: la frase dice "Cargaste solo tipos de cambio" (visión 4.2)', () => {
    const f = armarHoy(apendiceB(true), '2026-10-15').frase!
    expect(f.solo_tipos_de_cambio).toBe(true)
    expect(f.partes.map((p) => p.texto).join('')).toMatch(/Cargaste solo tipos de cambio: ningún precio ni saldo es nuevo, así que todo el cambio queda sin atribuir/)
    // Visión 4.2: "en dólares, −US$ 213 de SPY, −US$ 242 de tus posiciones en pesos y −US$ 23 de tus pesos en efectivo; en pesos, +$49.560 de tus US$ 4.200".
    expect(f.partes.map((p) => p.texto).join('')).toMatch(
      /Es lo que da valuar al CCL nuevo lo que tenías el miércoles: en dólares, −US\$ 212,95 de SPY, −US\$ 241,63 de tus posiciones en pesos y −US\$ 23,10 de tus pesos en efectivo; en pesos, \+\$ 49\.560 de tus US\$ 4\.200\./,
    )
  })
})

describe('decisiones B, C y D', () => {
  it('B: sin CCL del día se usa el último tipeado, la traza muestra su fecha, "viejo" a los 2 días hábiles y Hoy dice cuál usa', () => {
    const h = hechos({
      operaciones: [op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(10), precio: D(10000) })],
      tipos_cambio: [tc('2026-10-05', 1000)],
      cotizaciones: [cot('2026-10-05', 1, 10000), cot('2026-10-06', 1, 11000), cot('2026-10-09', 1, 11000)],
    })
    const f6 = foto(h, '2026-10-06')
    expect(f6.ccl.valor!.toFixed()).toBe('1000')
    expect(f6.ccl.formula).toMatch(/CCL del lun 05\/10/)
    expect(f6.ccl.etiquetas).not.toContain('viejo')
    expect(f6.items[0].valor_usd.valor!.toFixed()).toBe('110')
    expect(foto(h, '2026-10-09').ccl.etiquetas).toContain('viejo')
    const hoy = armarHoy(h, '2026-10-09')
    expect(hoy.fecha_ccl).toBe('2026-10-05')
    expect(hoy.atencion.some((p) => p.id.startsWith('ccl-arrastrado:'))).toBe(true)
  })

  it('C: la compra con precio pendiente se valúa al precio del día y lleva "inferido" hasta los totales', () => {
    const h = hechos({
      operaciones: [
        op({ fecha: '2026-10-01', activo_id: 1, tipo: 'apertura', cantidad: D(100), precio: D(10000) }),
        op({ fecha: '2026-10-06', activo_id: 1, tipo: 'compra', cantidad: D(10), ccl_del_dia: D(1100) }),
      ],
      tipos_cambio: [tc('2026-10-05', 1000), tc('2026-10-06', 1100)],
      cotizaciones: [cot('2026-10-05', 1, 10000), cot('2026-10-06', 1, 11000)],
      saldos: [saldo('2026-10-05', IEB, 'ARS', 500000), saldo('2026-10-06', IEB, 'ARS', 390000)],
    })
    const v = variacion(h, '2026-10-05', '2026-10-06')
    const spy = v.contribuciones.find((c) => c.clave === 'p:1:1')!
    expect(spy.inferido).toBe(true)
    expect(spy.flujos[0].ars.toFixed()).toBe('110000') // 10 × $11.000 del día
    const res = parteCalc(v, h, 'financiero', 'resultado', 'ARS')
    expect(res.etiquetas).toContain('inferido')
    expect(res.explicacion).toMatch(/precio pendiente: se usó el precio del día hasta que llegue el PPP \(D-19\)/)
    // El total del portafolio es exacto: la pata de caja cancela la compra.
    expect(res.valor!.toFixed()).toBe('100000') // 100 × (11.000 − 10.000)
    const hoy = armarHoy(h, '2026-10-06')
    expect(hoy.financiero.variacion!.ars.etiquetas).toContain('inferido')
  })

  it('D: con bienes, la vista Total no inventa moneda de riesgo: neto "sin dato" con la suma parcial, bienes "sin elegir"', () => {
    const e = armarExposicion(apendiceB(), '2026-10-14', 'total')
    expect(e.resumen.neto_ars.valor).toBeNull()
    expect(e.resumen.neto_ars.motivo).toMatch(/Suma parcial sin ellas: largo \$ 32\.783\.100,00/)
    expect(e.resumen.neto_ars.etiquetas).toContain('parcial')
    expect(e.sin_moneda_de_riesgo).toEqual(['Casa', 'Camioneta'])
    expect(e.por_moneda.some((s) => s.clave === 'sin_elegir')).toBe(true)
    expect(D(e.activos_en_dolares.ars.valor!).toFixed()).toBe('50088440') // sin la casa
    expect(e.concentracion.top1_nombre).toBe('SPY')
    // Lo que convertía la pantalla ahora viene del motor, con traza.
    expect(D(e.resumen.pesos_financieros.usd.valor!).toFixed(2)).toBe(D(54183100).div('1548.2').toFixed(2))
    expect(e.ccl.valor).toBe('1548.2')
  })
})

describe('cuadre (D-66, B04)', () => {
  it('falla con una variación inconsistente', () => {
    const h = apendiceB()
    const v = variacion(h, '2026-10-13', '2026-10-14')
    expect(cuadre(v, h)).toMatchObject({ ars_ok: true, usd_ok: true })
    const roto = { ...v, contribuciones: v.contribuciones.map((c, i) => (i === 0 ? { ...c, activo: { ars: c.activo.ars.plus(1), usd: c.activo.usd } } : c)) }
    expect(cuadre(roto, h)).toMatchObject({ ars_ok: false, usd_ok: true })
    expect(cuadre(roto, h).detalle).toMatch(/no cierra/)
  })

  it('una partida financiera sin dato lo deja "no verificable"; un bien sin valuación, no', () => {
    const h = apendiceB()
    const sinPrecio = { ...h, cotizaciones: h.cotizaciones.filter((c) => !(c.activo_id === 1 && c.fecha === '2026-10-14')) }
    sinPrecio.cotizaciones = sinPrecio.cotizaciones.filter((c) => c.activo_id !== 1)
    expect(cuadre(variacion(sinPrecio, '2026-10-13', '2026-10-14'), sinPrecio).ars_ok).toBeNull()
  })
})
