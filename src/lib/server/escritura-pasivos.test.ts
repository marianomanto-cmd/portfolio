import { describe, expect, it } from 'vitest'
import { normalizarCuadroMarcha, normalizarCuota, normalizarDatosPasivo, traducirErrorPasivos, type CuotaAlta } from './escritura-pasivos'
import { cargosQueCuentan, armarHechosPasivos, LECTOR_PLANILLA } from './hechos-pasivos'
import { Decimal } from '@/lib/domain/dinero'

// Números inventados (D-24).
const LOTE = '9b2f7a10-1c2d-4e5f-8a9b-0c1d2e3f4a5b'
const FACTURADA: CuotaAlta = {
  nro: 1,
  fecha_vencimiento: '2025-09-01',
  periodo: '2025-08-01',
  canon_neto: '1000000.00',
  iva_canon: '226800.00',
  seguro: '80000.00',
  otros_conceptos: '32400.00',
  estado: 'facturada',
  fuente_canon: 'comprobante',
  fuente_seguro: 'comprobante',
  fuente_otros: 'comprobante',
  pagada: true,
}
const PROYECTADA: CuotaAlta = { ...FACTURADA, nro: 15, estado: 'proyectada', fuente_canon: 'contrato', fuente_seguro: 'a_confirmar', fuente_otros: 'supuesto', pagada: false }

describe('normalizarCuota', () => {
  it('una facturada pagada sin datos del pago: no manda las claves del pago (la base deja las que había)', () => {
    const c = normalizarCuota(FACTURADA)
    expect(c).not.toHaveProperty('fecha_pago')
    expect(c).not.toHaveProperty('ccl_del_dia_pago')
    expect(c).toMatchObject({ nro: 1, canon_neto: '1000000.00', pagada: true, estado: 'facturada' })
  })

  it('con los datos del pago, los manda', () => {
    const c = normalizarCuota({ ...FACTURADA, fecha_pago: '2025-09-01', ccl_del_dia_pago: '1350.25', ccl_fuente: ' Ámbito ', pagador: 'titular' })
    expect(c).toMatchObject({ fecha_pago: '2025-09-01', ccl_del_dia_pago: '1350.25', ccl_fuente: 'Ámbito', pagador: 'titular' })
  })

  it('dice en castellano cada regla de la base', () => {
    expect(() => normalizarCuota({ ...PROYECTADA, fuente_seguro: 'comprobante' })).toThrow('Una cuota proyectada no puede tener fuente "comprobante"')
    expect(() => normalizarCuota({ ...FACTURADA, fuente_seguro: 'supuesto' })).toThrow('Una cuota facturada tiene sus montos de comprobante')
    expect(() => normalizarCuota({ ...PROYECTADA, pagada: true })).toThrow('Una cuota pagada tiene factura')
    expect(() => normalizarCuota({ ...FACTURADA, ccl_del_dia_pago: '1300', fecha_pago: '2025-09-01' })).toThrow('van juntos')
    expect(() => normalizarCuota({ ...FACTURADA, ccl_del_dia_pago: '1300', ccl_fuente: 'x' })).toThrow('necesitan la fecha del pago')
    expect(() => normalizarCuota({ ...PROYECTADA, fecha_pago: '2026-11-01' })).toThrow('solo en una cuota pagada')
    expect(() => normalizarCuota({ ...PROYECTADA, fuente_otros: 'no_aplica' })).toThrow('dice n/a pero tiene monto')
    expect(() => normalizarCuota({ ...FACTURADA, periodo: '2025-08-15' })).toThrow('día 1')
    expect(() => normalizarCuota({ ...FACTURADA, canon_neto: '1.000.000,00' })).toThrow('no es un número decimal')
    expect(() => normalizarCuota({ ...FACTURADA, canon_neto: 1000000 as unknown as string })).toThrow('viajan como texto')
  })
})

describe('normalizarCuadroMarcha', () => {
  it('la planilla necesita su archivo; una cuota a mano, no', () => {
    expect(() => normalizarCuadroMarcha({ lote: LOTE, fecha: '2026-10-15', pasivo_id: 1, lector: 'cuadro-marcha-csv@1', cuotas: [FACTURADA] })).toThrow('Falta el archivo')
    const p = normalizarCuadroMarcha({ lote: LOTE.toUpperCase(), fecha: '2026-10-15', pasivo_id: 1, lector: 'manual', cuotas: [FACTURADA] })
    expect(p).toMatchObject({ lote: LOTE, lector: 'manual', pasivo_id: 1 })
    expect(p).not.toHaveProperty('archivo')
  })

  it('una cuota repetida, nada para grabar o un lote inválido', () => {
    expect(() => normalizarCuadroMarcha({ lote: LOTE, fecha: '2026-10-15', pasivo_id: 1, lector: 'manual', cuotas: [FACTURADA, FACTURADA] })).toThrow('aparece dos veces')
    expect(() => normalizarCuadroMarcha({ lote: LOTE, fecha: '2026-10-15', pasivo_id: 1, lector: 'manual', cuotas: [] })).toThrow('No hay cuotas ni cargos')
    expect(() => normalizarCuadroMarcha({ lote: 'x', fecha: '2026-10-15', pasivo_id: 1, lector: 'manual', cuotas: [FACTURADA] })).toThrow('lote')
  })

  it('un cargo: concepto conocido e importe positivo', () => {
    const base = { lote: LOTE, fecha: '2026-10-15', pasivo_id: 1, lector: 'manual' as const, cuotas: [] }
    expect(normalizarCuadroMarcha({ ...base, cargos: [{ fecha: '2026-01-10', concepto: 'multa', importe: '15000', fuente: 'comprobante' }] })).toMatchObject({
      cargos: [{ concepto: 'multa', importe: '15000', cuota_nro: null, detalle: null }],
    })
    expect(() => normalizarCuadroMarcha({ ...base, cargos: [{ fecha: '2026-01-10', concepto: 'multa', importe: '0', fuente: 'comprobante' }] })).toThrow('mayor que cero')
  })
})

describe('normalizarDatosPasivo', () => {
  it('cambia solo lo que viene', () => {
    expect(normalizarDatosPasivo({ pagador_habitual: 'titular' })).toEqual({ pagador_habitual: 'titular' })
    expect(normalizarDatosPasivo({ reintegra_iva: null, fecha_desembolso: '2025-07-25' })).toEqual({ reintegra_iva: null, fecha_desembolso: '2025-07-25' })
    expect(() => normalizarDatosPasivo({})).toThrow('nada para cambiar')
    expect(() => normalizarDatosPasivo({ pagador_habitual: 'socio' as 'titular' })).toThrow('quién paga')
  })
})

describe('traducirErrorPasivos', () => {
  it('las restricciones nuevas en castellano, con el contexto de la función', () => {
    const e = traducirErrorPasivos(
      { code: '23514', message: 'new row for relation "pasivo_cuotas" violates check constraint "pasivo_cuotas_pagada_facturada"', details: 'cuota 4 de Leasing' },
      'guardar el cuadro de marcha',
    )
    expect(e.message).toBe('Una cuota pagada tiene factura: no puede estar proyectada (cuota 4 de Leasing).')
  })

  it('los mensajes propios de la función pasan tal cual', () => {
    expect(traducirErrorPasivos({ code: 'P0001', message: 'La cuota 12 ya tiene factura: corregila desde su fila' }, 'x').message).toBe('La cuota 12 ya tiene factura: corregila desde su fila.')
  })

  it('sin la migración aplicada, dice cuál falta', () => {
    expect(traducirErrorPasivos({ code: 'PGRST202', message: 'Could not find the function public.guardar_cuadro_marcha(p)' }, 'x').message).toMatch(/20261015124724_pasivos_cuadro_marcha/)
  })
})

describe('lectura: lo que no cuenta no llega', () => {
  const k = (id: number, carga_id: number, anulado = false) => ({
    id,
    pasivo_id: 1,
    fecha: '2026-01-10',
    concepto: 'multa' as const,
    detalle: null,
    importe: new Decimal(100),
    cuota_nro: null,
    fuente: 'comprobante' as const,
    anulado,
    carga_id,
    notas: null,
  })
  const cargas = [
    { id: 10, estado: 'vigente' as const, lector: LECTOR_PLANILLA, pasivo_id: 1 },
    { id: 11, estado: 'vigente' as const, lector: LECTOR_PLANILLA, pasivo_id: 1 },
    { id: 12, estado: 'revertida' as const, lector: LECTOR_PLANILLA, pasivo_id: 1 },
    { id: 13, estado: 'vigente' as const, lector: 'manual', pasivo_id: 1 },
  ]

  it('cuentan los de la última planilla vigente y los cargados a mano, sin anular', () => {
    const r = cargosQueCuentan([k(1, 10), k(2, 11), k(3, 12), k(4, 13), k(5, 13, true), k(6, 99)], cargas)
    expect(r.map((x) => x.id)).toEqual([2, 4])
  })

  it('revertir la última planilla vuelve a mostrar los cargos de la anterior', () => {
    const r = cargosQueCuentan([k(1, 10), k(3, 12)], [cargas[0], cargas[2]])
    expect(r.map((x) => x.id)).toEqual([1])
  })

  it('las filas de la base a los hechos: montos exactos, cuotas de una carga revertida afuera', () => {
    const h = armarHechosPasivos(
      [{ id: 1, nombre: 'L', tipo: 'leasing', moneda: 'ARS', fecha_inicio: '2025-07-01', cuotas_totales: 35, monto_financiado_neto: '22000000', anticipo_neto: null, opcion_compra_neto: '1000000', opcion_compra_fecha: '2028-07-01', valor_bien: null, alicuota_ganancias: null, fecha_desembolso: null, pagador_habitual: null, reintegra_iva: null, notas: null }],
      [
        { pasivo_id: 1, nro: 1, fecha_vencimiento: '2025-09-01', periodo: '2025-08-01', canon_neto: '1000000.00', iva_canon: '226800.00', seguro: '80000.00', otros_conceptos: '0.00', base_ganancias: null, estado: 'facturada', fuente_canon: 'comprobante', fuente_seguro: 'comprobante', fuente_otros: 'comprobante', pagada: true, fecha_pago: null, monto_pagado: null, cuenta_pago_id: null, ccl_del_dia_pago: null, ccl_fuente: null, pagador: null, carga_id: 10, notas: null },
        { pasivo_id: 1, nro: 2, fecha_vencimiento: '2025-10-01', periodo: null, canon_neto: '1000000.00', iva_canon: '0', seguro: '0', otros_conceptos: '0', base_ganancias: null, estado: 'proyectada', fuente_canon: 'contrato', fuente_seguro: 'contrato', fuente_otros: 'contrato', pagada: false, fecha_pago: null, monto_pagado: null, cuenta_pago_id: null, ccl_del_dia_pago: null, ccl_fuente: null, pagador: null, carga_id: 12, notas: null },
      ],
      [],
      [
        { id: 10, estado: 'vigente', lector: LECTOR_PLANILLA, pasivo: 1 },
        { id: 12, estado: 'revertida', lector: LECTOR_PLANILLA, pasivo: 1 },
      ],
    )
    expect(h.contratos[0].monto_financiado_neto?.toFixed()).toBe('22000000')
    expect(h.contratos[0].reintegra_iva).toBeNull()
    expect(h.cuotas.map((c) => c.nro)).toEqual([1])
    expect(h.cuotas[0].otros_conceptos.toFixed(2)).toBe('0.00')
  })
})
