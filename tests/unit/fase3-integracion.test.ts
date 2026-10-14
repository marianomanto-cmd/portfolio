// Fase 3 de la revisión adversarial, integración: los pedidos cruzados entre
// carga, motor y pantallas. Un test por cambio de comportamiento; cada uno
// falla con el árbol anterior. Hechos armados a mano, números inventados (D-24).

import { describe, expect, it, vi } from 'vitest'
import { sinDato } from '@/lib/domain/calc'
import { Decimal } from '@/lib/domain/dinero'
import { sumaCalc } from '@/lib/domain/foto'
import type { Activo, CargaResumen, Cuenta, Fecha, Hechos, Operacion, Saldo, TipoCambio } from '@/lib/domain/tipos'
import { cuadre, desgloseDesdeCompra, variacion } from '@/lib/domain/variacion'
import { armarCartera, armarExposicion, armarHoy } from '@/lib/vistas/armar'
import { ejemploHoyVariante, hechosEjemplo, HOY_EJEMPLO } from '@/lib/vistas/ejemplo'
import { diasEnPosicion } from '@/components/calculos'

// La lectura de la base, sin base: cada tabla devuelve las filas de `tablas`.
const tablas: Record<string, Record<string, unknown>[]> = {}
const columnasPedidas: Record<string, string> = {}
vi.mock('@/lib/server/supabase', () => ({
  leerTodo: async (tabla: string, columnas: string) => {
    columnasPedidas[tabla] = columnas
    return tablas[tabla] ?? []
  },
}))

// ───────────── Fábrica de hechos ─────────────

const D = (x: Decimal | string | number) => new Decimal(x)
const IEB = 1
const GALICIA = 2
const CUENTAS: Cuenta[] = [
  { id: IEB, nombre: 'IEB', tipo: 'broker', formato_carga: 'excel_ieb', activa: true },
  { id: GALICIA, nombre: 'Galicia', tipo: 'banco', formato_carga: 'captura', activa: true },
  { id: 3, nombre: 'Mercado Pago', tipo: 'billetera', formato_carga: 'captura', activa: true },
]
const SPY: Activo = {
  id: 1,
  ticker: 'SPY',
  nombre: 'SPY',
  tipo: 'cedear',
  moneda_riesgo: 'USD',
  geografia: 'US',
  indexacion: null,
  ticker_subyacente: 'SPY',
  fecha_vencimiento: null,
  color: null,
  activo_bool: true,
}
let idOp = 1
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
const tc = (fecha: Fecha, ccl: string | number): TipoCambio => ({ fecha, ccl: D(ccl), mep: null, cripto_venta: null, oficial: null, carga_id: 1 })
const cot = (fecha: Fecha, precio: string | number) => ({ fecha, activo_id: SPY.id, precio_pesos: D(precio), precio_usd_subyacente: null, carga_id: 1 })
const saldo = (fecha: Fecha, m: string | number): Saldo => ({ fecha, cuenta_id: IEB, moneda: 'ARS', monto: D(m), carga_id: 1 })
const carga = (id: number, fecha: Fecha, p: Partial<CargaResumen> = {}): CargaResumen => ({
  id,
  lote: null,
  fecha,
  cuenta_id: IEB,
  origen: 'excel',
  archivo_path: null,
  estado: 'vigente',
  creado_en: `${fecha}T21:00:00Z`,
  reemplaza_a: null,
  lector: 'ieb-excel@1',
  tiempo_activo_ms: null,
  ...p,
})

/** IEB: 100 SPY desde el jue 01/10 (apertura con CCL), cargas del lun 05/10 y el mar 06/10. */
function hechos(p: Partial<Hechos> = {}): Hechos {
  return {
    cuentas: CUENTAS,
    activos: [SPY],
    operaciones: [op({ fecha: '2026-10-01', activo_id: SPY.id, tipo: 'apertura', cantidad: D(100), precio: D(10000), ccl_del_dia: D(1000) })],
    cotizaciones: [cot('2026-10-05', 10000), cot('2026-10-06', 10100)],
    tipos_cambio: [tc('2026-10-05', 1000), tc('2026-10-06', 1010)],
    saldos: [saldo('2026-10-05', 50000), saldo('2026-10-06', 50000)],
    movimientos: [],
    pasivos: [],
    pasivo_saldos: [],
    bienes: [],
    valuaciones: [],
    feriados: [],
    cargas: [carga(10, '2026-10-05'), carga(11, '2026-10-06')],
    ...p,
  }
}

// ───────────── carga → motor: listado_completo ─────────────

describe('una carga que dejó filas pendientes (listado_completo = false)', () => {
  it('hechos.ts lee la columna y la pasa a CargaResumen (null o true = completo)', async () => {
    tablas.cargas = [
      { id: 10, lote: null, fecha: '2026-10-05', cuenta_id: IEB, origen: 'excel', archivo_path: null, estado: 'vigente', creado_en: 'x', reemplaza_a: null, lector: 'ieb-excel@1', tiempo_activo_ms: null, listado_completo: true, ausentes: null },
      { id: 11, lote: null, fecha: '2026-10-06', cuenta_id: IEB, origen: 'excel', archivo_path: null, estado: 'vigente', creado_en: 'y', reemplaza_a: null, lector: 'ieb-excel@1', tiempo_activo_ms: null, listado_completo: false, ausentes: null },
      { id: 12, lote: null, fecha: '2026-10-06', cuenta_id: null, origen: 'manual', archivo_path: null, estado: 'vigente', creado_en: 'z', reemplaza_a: null, lector: 'tipeado', tiempo_activo_ms: null, listado_completo: null, ausentes: null },
    ]
    const { leerHechos } = await import('@/lib/server/hechos')
    const h = await leerHechos()
    expect(columnasPedidas.cargas.split(',')).toContain('listado_completo')
    expect(h.cargas.map((c) => [c.id, c.listado_completo])).toEqual([
      [10, true],
      [11, false],
      [12, true],
    ])
  })

  it('la fuente queda ≠ "parcial" y Atención lo dice, con el botón a Cargar', () => {
    const v = armarHoy(hechos({ cargas: [carga(10, '2026-10-05'), carga(11, '2026-10-06', { listado_completo: false })] }), '2026-10-06')
    const ieb = v.fuentes.find((f) => f.nombre === 'IEB')
    expect(ieb).toMatchObject({ estado: 'diferencia', carga_id: 11, detalle: 'Última carga: mar 06/10 · parcial: quedaron filas pendientes' })
    const a = v.atencion.find((x) => x.id === 'parcial:1:11')
    expect(a).toMatchObject({ gravedad: 'media', titulo: 'IEB: la carga del mar 06/10 quedó parcial', accion: { etiqueta: 'Cargar', href: '/carga' } })
    expect(a?.detalle).toContain('una tenencia que todavía no diste de alta no entra en los totales')
  })

  it('una carga completa (o sin el dato) no marca nada; tampoco una vieja si la última de la cuenta cerró', () => {
    for (const cargas of [
      [carga(10, '2026-10-05'), carga(11, '2026-10-06', { listado_completo: true })],
      [carga(10, '2026-10-05'), carga(11, '2026-10-06')],
      [carga(10, '2026-10-05', { listado_completo: false }), carga(11, '2026-10-06', { listado_completo: true })],
      // Una carga reemplazada (recarga del mismo día) no cuenta.
      [carga(10, '2026-10-05'), carga(11, '2026-10-06', { listado_completo: false, estado: 'reemplazada' }), carga(12, '2026-10-06')],
    ]) {
      const v = armarHoy(hechos({ cargas }), '2026-10-06')
      expect(v.fuentes.find((f) => f.nombre === 'IEB')?.estado).toBe('ok')
      expect(v.atencion.filter((x) => x.id.startsWith('parcial:'))).toEqual([])
    }
  })
})

// ───────────── pantallas → motor ─────────────

describe('la frase de una carga express: "de tus US$ X" es una cifra con traza', () => {
  it('va como parte tocable, con la suma de tus dólares de la carga anterior', () => {
    const f = ejemploHoyVariante('express').frase!
    const i = f.partes.findIndex((p) => p.texto === ' de tus ')
    expect(i).toBeGreaterThan(0)
    const base = f.partes[i + 1]
    expect(base.texto).toMatch(/^US\$ [\d.]+$/)
    expect(base.calc).not.toBeNull()
    expect(base.calc?.explicacion).toMatch(/^Tus dólares en efectivo en la carga anterior/)
    expect(base.calc?.formula).toMatch(/= US\$ [\d.]+,\d\d$/)
    expect(base.calc?.insumos.length).toBeGreaterThan(0)
    expect(base.calc?.insumos.every((x) => x.unidad === 'USD')).toBe(true)
    // La parte de antes es el monto en pesos con su traza (+$ … de tus US$ …).
    expect(f.partes[i - 1].calc).not.toBeNull()
  })
})

describe('apertura sin CCL de compra: se declara desde la 1b, no hay dónde en la 1a', () => {
  const sinCcl = () => hechos({ operaciones: [op({ fecha: '2026-10-01', activo_id: SPY.id, tipo: 'apertura', cantidad: D(100), precio: D(10000) })] })
  it('el PPC y el costo en dólares lo dicen así', () => {
    const fila = armarCartera(sinCcl(), '2026-10-06').filas.find((x) => x.ticker === 'SPY')!
    expect(fila.ppc.usd.motivo).toBe('Falta el CCL de compra de la apertura: se declara desde la 1b (Pendientes).')
    expect(JSON.stringify(fila)).not.toContain('declaralo')
  })
  it('el desglose desde la compra también', () => {
    const d = desgloseDesdeCompra(sinCcl(), `p:${IEB}:${SPY.id}`, '2026-10-06')
    expect(d).toEqual({ tipo: 'sin_dato', motivo: 'Falta el CCL de compra de la apertura: se declara desde la 1b (Pendientes).' })
  })
})

describe('cuadre ≠: el detalle no repite "no cierra por" (Hoy ya lo dice con su traza)', () => {
  it('arranca por la explicación', () => {
    const h = hechos()
    const v = variacion(h, '2026-10-05', '2026-10-06')
    const roto = { ...v, contribuciones: v.contribuciones.map((c) => (c.clase === 'posicion' ? { ...c, activo: { ars: c.activo.ars.plus(1), usd: c.activo.usd } } : c)) }
    const c = cuadre(roto, h)
    expect(c.ars_ok).toBe(false)
    expect(c.diferencia?.ars.valor?.toFixed(2)).toBe('-1.00')
    expect(c.detalle).toBe('Si no tiene explicación, es un bug: revisalo.')
  })
})

describe('una suma sin ninguna parte conocida es "sin dato", nunca "suma parcial (0 de 1): $ 0,00"', () => {
  it('sumaCalc', () => {
    const nada = sumaCalc([{ nombre: 'Leasing', calc: sinDato('No cargaste el capital pendiente de Leasing.') }], 'ARS', 'Deuda.')
    expect(nada.valor).toBeNull()
    expect(nada.motivo).toBe('No cargaste el capital pendiente de Leasing.')
    expect(nada.etiquetas).not.toContain('parcial')
    // Con motivos distintos, dice cuántas faltan.
    const dos = sumaCalc([{ nombre: 'A', calc: sinDato('Falta A.') }, { nombre: 'B', calc: sinDato('Falta B.') }], 'ARS', '')
    expect(dos.motivo).toBe('Faltan 2 partes.')
    // Con alguna conocida, la suma parcial sigue.
    const una = sumaCalc([{ nombre: 'A', calc: sinDato('Falta A.') }, { nombre: 'B', calc: { valor: D(5), formula: '5', insumos: [], etiquetas: [] } }], 'ARS', '')
    expect(una.motivo).toBe('Falta A. Suma parcial (1 de 2): $ 5,00.')
    expect(una.etiquetas).toContain('parcial')
  })

  it('Exposición con el leasing sin capital pendiente: el neto dice qué falta, sin "$ 0,00" de deuda', () => {
    const h = hechosEjemplo()
    h.pasivo_saldos = []
    const r = armarExposicion(h, HOY_EJEMPLO, 'financiero').resumen
    expect(r.deuda_pesos.ars.valor).toBeNull()
    expect(r.neto_ars.valor).toBeNull()
    expect(r.neto_ars.motivo).not.toMatch(/\(0 de \d+\)/)
    expect(r.neto_ars.motivo).toMatch(/^No cargaste el capital pendiente de .+\. Suma parcial, sin la deuda: largo \$ [\d.]+,\d\d\.$/)
  })
})

describe('Cartera, Días: la traza muestra la resta de fechas', () => {
  it('la fila trae la fecha de inicio y la fórmula la usa', () => {
    const fila = armarCartera(hechos(), '2026-10-15').filas.find((x) => x.ticker === 'SPY')!
    expect(fila.fecha_inicio).toBe('2026-10-01')
    expect(fila.dias_en_posicion).toBe(14)
    const c = diasEnPosicion(fila.dias_en_posicion, fila.dias_desde, fila.fecha_inicio ?? null)
    expect(c.formula).toBe('jue 15/10 − jue 01/10 = 14 días desde la apertura en la app')
    expect(c.insumos.map((i) => [i.nombre, i.valor])).toEqual([
      ['Apertura en la app', '2026-10-01'],
      ['Hoy', '2026-10-15'],
    ])
    // Sin la fecha, como antes.
    expect(diasEnPosicion(14, 'apertura').formula).toBe('14 días desde la apertura en la app')
  })
})
