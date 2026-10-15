import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supuestosVacios } from '@/lib/domain/flujo/supuestos'

// Escrituras de Flujo: lo que se valida antes de mandar a la base (errores en
// castellano) y lo que se manda. Cliente falso de Supabase: registra las
// llamadas y responde lo que diga cada test. Montos inventados.
const fake = vi.hoisted(() => {
  const estado = {
    rpc: [] as { fn: string; args: Record<string, unknown> }[],
    respuestas: [] as { data: unknown; error: unknown }[],
  }
  const cliente = {
    rpc: (fn: string, args: Record<string, unknown>) => {
      estado.rpc.push({ fn, args })
      return Promise.resolve(estado.respuestas.shift() ?? { data: null, error: { code: 'XX000', message: 'sin respuesta' } })
    },
  }
  return { estado, cliente }
})
vi.mock('./supabase', () => ({ supabase: () => fake.cliente, configurado: () => true }))

import {
  guardarEscenario,
  guardarFlujoReal,
  guardarRecurrente,
  normalizarEscenario,
  normalizarFlujoReal,
  normalizarFlujosBono,
  normalizarRecurrente,
  traducirErrorFlujo,
} from './escritura-flujo'

const INGRESO = { fecha: '2026-10-15', sentido: 'ingreso', concepto: 'mensual', moneda: 'USD', monto: '3800', cuenta_id: 1 } as const

beforeEach(() => {
  fake.estado.rpc.length = 0
  fake.estado.respuestas.length = 0
})

describe('Cargar ingreso / Cargar gasto', () => {
  it('normaliza y exige el concepto, la moneda y un monto positivo', () => {
    expect(normalizarFlujoReal({ ...INGRESO })).toMatchObject({ fecha: '2026-10-15', sentido: 'ingreso', concepto: 'mensual', moneda: 'USD', monto: '3800', cuenta_id: 1, cripto_usado: null, pesos_recibidos: null })
    expect(() => normalizarFlujoReal({ ...INGRESO, concepto: '' as never })).toThrow('Elegí el concepto: ingreso mensual o extraordinario.')
    expect(() => normalizarFlujoReal({ ...INGRESO, sentido: 'gasto', concepto: 'x' as never })).toThrow('gasto fijo del mes o extraordinario')
    expect(() => normalizarFlujoReal({ ...INGRESO, moneda: 'EUR' as never })).toThrow('US$ o $')
    expect(() => normalizarFlujoReal({ ...INGRESO, monto: '0' })).toThrow()
    expect(normalizarFlujoReal({ ...INGRESO, cuenta_id: null }).cuenta_id).toBeNull()
  })

  it('el cripto y los pesos van juntos, solo con dólares de ingreso, y tienen que cerrar (D-37)', () => {
    expect(normalizarFlujoReal({ ...INGRESO, cripto_usado: '1541', pesos_recibidos: '5855800' })).toMatchObject({ cripto_usado: '1541', pesos_recibidos: '5855800' })
    expect(() => normalizarFlujoReal({ ...INGRESO, cripto_usado: '1541' })).toThrow('van juntos')
    expect(() => normalizarFlujoReal({ ...INGRESO, moneda: 'ARS', cripto_usado: '1541', pesos_recibidos: '5855800' })).toThrow('solo con dólares')
    expect(() => normalizarFlujoReal({ ...INGRESO, cripto_usado: '1541', pesos_recibidos: '5000000' })).toThrow('no cierran')
  })

  it('manda guardar_flujo_real con un lote y lee lo que devuelve; un error de la base sale en castellano', async () => {
    fake.estado.respuestas.push({ data: { carga_id: 41, flujo_id: 7, movimiento: 'aporte', repetido: false }, error: null })
    const r = await guardarFlujoReal({ ...INGRESO }, '0b6f2a52-6a2e-4c43-9d3f-2b7d6c7e8f90')
    expect(r).toEqual({ carga_id: 41, flujo_id: 7, movimiento: 'aporte', repetido: false })
    expect(fake.estado.rpc[0].fn).toBe('guardar_flujo_real')
    expect(fake.estado.rpc[0].args.p).toMatchObject({ lote: '0b6f2a52-6a2e-4c43-9d3f-2b7d6c7e8f90', monto: '3800', cuenta_id: 1 })
    fake.estado.respuestas.push({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } })
    await expect(guardarFlujoReal({ ...INGRESO })).rejects.toThrow('falta aplicar las migraciones de Flujo')
  })
})

describe('ingresos y gastos declarados', () => {
  it('alta: concepto, moneda, monto y desde; cambiar desde: monto y desde; cerrar: hasta', () => {
    expect(normalizarRecurrente({ accion: 'alta', sentido: 'ingreso', concepto: 'Honorarios', moneda: 'USD', monto: '3800', desde: '2026-10-01' })).toMatchObject({ accion: 'alta', concepto: 'Honorarios', moneda: 'USD', monto: '3800', desde: '2026-10-01' })
    expect(() => normalizarRecurrente({ accion: 'alta', sentido: 'ingreso', moneda: 'USD', monto: '3800', desde: '2026-10-01' })).toThrow('Falta el concepto.')
    expect(normalizarRecurrente({ accion: 'cambiar_desde', sentido: 'ingreso', id: 3, monto: '4000', desde: '2027-02-01' })).toMatchObject({ accion: 'cambiar_desde', id: 3, monto: '4000', desde: '2027-02-01' })
    expect(() => normalizarRecurrente({ accion: 'cerrar', sentido: 'gasto', id: 3 })).toThrow()
    expect(normalizarRecurrente({ accion: 'anular', sentido: 'gasto', id: 3 })).toEqual({ accion: 'anular', sentido: 'gasto', id: 3 })
  })

  it('manda guardar_recurrente y devuelve el id', async () => {
    fake.estado.respuestas.push({ data: { id: 12, cerrada: 3 }, error: null })
    expect(await guardarRecurrente({ accion: 'cambiar_desde', sentido: 'ingreso', id: 3, monto: '4000', desde: '2027-02-01' })).toBe(12)
    expect(fake.estado.rpc[0].fn).toBe('guardar_recurrente')
  })

  it('las restricciones de la base salen en castellano', () => {
    expect(traducirErrorFlujo({ code: '23514', message: 'violates check constraint "gastos_fijos_frecuencia_con_mes"' }, 'guardar').message).toBe('Un gasto que no es mensual necesita su primer mes.')
  })
})

describe('pago al vencimiento', () => {
  it('exige la fuente y al menos un pago', () => {
    expect(normalizarFlujosBono({ activo_id: 3, fuente: 'aviso de licitación (ejemplo)', flujos: [{ fecha: '2026-11-13', interes: '0.1', amortizacion: '1' }] })).toMatchObject({ activo_id: 3, flujos: [{ fecha: '2026-11-13', interes: '0.1', amortizacion: '1' }] })
    expect(() => normalizarFlujosBono({ activo_id: 3, fuente: ' ', flujos: [{ fecha: '2026-11-13', interes: null, amortizacion: '1' }] })).toThrow('Falta la fuente')
    expect(() => normalizarFlujosBono({ activo_id: 3, fuente: 'x', flujos: [] })).toThrow('Falta al menos un pago.')
  })
})

describe('escenarios', () => {
  it('guarda supuestos válidos con nombre; los valores recordados con clave válida y sin signo', () => {
    const s = supuestosVacios()
    const n = normalizarEscenario({ accion: 'guardar', nombre: 'Dólar quieto', supuestos: s, recordados: { 'devaluacion.sube': '2', 'Malo!': '3', 'casa.baja': '-1' } as Record<string, string> })
    expect(n).toMatchObject({ accion: 'guardar', nombre: 'Dólar quieto', recordados: { 'devaluacion.sube': '2' } })
    expect(() => normalizarEscenario({ accion: 'guardar', nombre: ' ', supuestos: s })).toThrow('Ponele un nombre')
    expect(() => normalizarEscenario({ accion: 'guardar', nombre: 'x', supuestos: { ...s, v: 2 } as never })).toThrow('forma esperada')
    expect(normalizarEscenario({ accion: 'archivar', id: 4 })).toEqual({ accion: 'archivar', id: 4 })
  })

  it('manda guardar_escenario y devuelve el id', async () => {
    fake.estado.respuestas.push({ data: 5, error: null })
    expect(await guardarEscenario({ accion: 'guardar', nombre: 'A', supuestos: supuestosVacios() })).toBe(5)
    expect(fake.estado.rpc[0].fn).toBe('guardar_escenario')
  })
})
