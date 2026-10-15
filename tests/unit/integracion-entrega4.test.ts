import { describe, expect, it } from 'vitest'
import { armarRegistro, porGravedad, type TablasRegistro } from '@/lib/vistas/armar'
import type { Pendiente } from '@/lib/vistas/contratos'

// Integración de la entrega 4 (lead): el Registro reconoce las cargas sin
// cuenta que graban el cuadro de marcha y "Cargar ingreso", y dice qué grabaron.
// Números inventados (D-24).

const base: TablasRegistro = {
  cargas: [
    { id: 1, lote: 'l1', fecha: '2026-10-14', cuenta_id: null, origen: 'manual', archivo_path: null, estado: 'vigente', creado_en: '2026-10-14T10:00:00Z', lector: 'tipeado', tiempo_activo_ms: null },
    { id: 2, lote: 'l2', fecha: '2026-10-15', cuenta_id: null, origen: 'manual', archivo_path: null, estado: 'vigente', creado_en: '2026-10-15T10:00:00Z', lector: 'cuadro-marcha-csv@1', tiempo_activo_ms: null },
    { id: 3, lote: 'l3', fecha: '2026-10-15', cuenta_id: null, origen: 'manual', archivo_path: null, estado: 'vigente', creado_en: '2026-10-15T11:00:00Z', lector: 'flujo_real', tiempo_activo_ms: null },
    { id: 4, lote: 'l4', fecha: '2026-10-15', cuenta_id: null, origen: 'manual', archivo_path: null, estado: 'vigente', creado_en: '2026-10-15T12:00:00Z', lector: 'manual', tiempo_activo_ms: null },
  ],
  cuentas: [{ id: 3, nombre: 'Mercado Pago' }],
  cotizaciones: [],
  saldos: [],
  operaciones: [],
  valuaciones: [],
  capitales: [{ carga_id: 4, pasivo_id: 1 }],
  movimientos: [{ carga_id: 3, id: 9, tipo: 'aporte', cuenta_origen_id: null, cuenta_destino_id: 3 }],
  bienes: [],
  pasivos: [{ id: 1, nombre: 'Leasing de prueba' }],
  cuotas: [
    { carga_id: 2, pasivo_id: 1 },
    { carga_id: 2, pasivo_id: 1 },
    { carga_id: 2, pasivo_id: 1 },
  ],
  cargos: [{ carga_id: 2 }],
  flujos: [{ carga_id: 3, sentido: 'ingreso', concepto: 'mensual' }],
}

describe('Registro con las cargas de la entrega 4', () => {
  const filas = new Map(armarRegistro(base).filas.map((f) => [f.carga_id, f]))

  it('el tipo de cambio sigue siendo "Tipo de cambio", sin detalle', () => {
    expect(filas.get(1)).toMatchObject({ cuenta: 'Tipo de cambio', detalle: null })
  })

  it('el cuadro de marcha es "Leasing" y dice cuántas cuotas y cargos grabó', () => {
    expect(filas.get(2)).toMatchObject({ cuenta: 'Leasing', detalle: 'cuadro de marcha de Leasing de prueba · 3 cuotas · 1 cargo extra' })
  })

  it('"Cargar ingreso" es "Flujo" y dice el concepto y el aporte que creó', () => {
    expect(filas.get(3)).toMatchObject({ cuenta: 'Flujo', detalle: 'ingreso mensual · aporte a Mercado Pago' })
  })

  it('un guardado de Datos sigue siendo "Datos"', () => {
    expect(filas.get(4)).toMatchObject({ cuenta: 'Datos', detalle: 'capital pendiente de Leasing de prueba' })
  })
})

describe('Hoy › Atención con lo que traen Flujo y Pasivos', () => {
  const p = (id: string, gravedad: Pendiente['gravedad']): Pendiente => ({ id, gravedad, titulo: id, detalle: '', accion: null })

  it('la cuota que vence no queda plegada detrás de pendientes leves: la lista unida se ordena por gravedad', () => {
    const delMotor = [p('ccl-YPFD', 'baja'), p('ccl-FIMA', 'baja'), p('ccl-TXMJ0', 'baja')]
    const deFlujoYPasivos = [p('cuota-15', 'media'), p('vence-S13N6', 'media')]
    expect(porGravedad([...delMotor, ...deFlujoYPasivos]).map((x) => x.id)).toEqual(['cuota-15', 'vence-S13N6', 'ccl-YPFD', 'ccl-FIMA', 'ccl-TXMJ0'])
    // Una cuota vencida (alta) va primera; a igual gravedad, en el orden en que llegó.
    expect(porGravedad([p('parcial', 'media'), p('cuota-14', 'alta'), p('capital', 'alta')]).map((x) => x.id)).toEqual(['cuota-14', 'capital', 'parcial'])
  })
})
