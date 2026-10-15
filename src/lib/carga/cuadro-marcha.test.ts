import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { Decimal } from '@/lib/domain/dinero'
import { aCuotas, leerCuadroMarcha, normalizarEncabezado, partirCsv, revisarCuadro } from './cuadro-marcha'

// Lector del cuadro de marcha (cuadro-marcha-csv@1). El fixture tiene el
// encabezado real de la planilla del dueño y montos inventados (D-24).

const FIXTURE = readFileSync(path.join(process.cwd(), 'tests/fixtures/cuadro-marcha.csv'), 'utf8')
const ENCABEZADO = FIXTURE.split('\n')[0]
const filasDe = (...xs: string[]) => [ENCABEZADO, ...xs].join('\n')
const CUOTA_1 = '1,2025-09-01,2025-08,1000000.00,80000.00,1080000.00,226800.00,32400.00,1339200.00,SI,comprobante,comprobante'
const CUOTA_15 = '15,2026-11-01,2026-10,1000000.00,60000.00,1060000.00,222600.00,31800.00,1314400.00,NO,CONFIRMAR,SUPUESTO'

describe('el fixture', () => {
  const l = leerCuadroMarcha(FIXTURE, { cuotasTotales: 35 })

  it('35 cuotas: 14 facturadas y pagadas, 21 proyectadas con la fuente de cada campo; la opción aparte', () => {
    expect(l.errores).toEqual([])
    expect(l.filas).toHaveLength(35)
    expect(l.filas.filter((f) => f.estado === 'facturada' && f.pagada)).toHaveLength(14)
    const p = l.filas.filter((f) => f.estado === 'proyectada')
    expect(p).toHaveLength(21)
    expect(p.every((f) => f.fuente_canon === 'contrato' && f.fuente_seguro === 'a_confirmar' && f.fuente_otros === 'supuesto' && !f.pagada)).toBe(true)
    expect(l.opcion).toEqual({ fila: 37, fecha: '2028-07-01', neto: '1000000', iva: '210000', total: '1210000' })
    expect(l.cargos).toEqual([])
  })

  it('guarda lo facturado sin derivar: seguro neto, IVA de la planilla, percepción 0 como cero real', () => {
    const c1 = l.filas[0]
    expect(c1).toMatchObject({ nro: 1, fecha_vencimiento: '2025-09-01', periodo: '2025-08-01', canon_neto: '1000000', seguro: '80000', iva_canon: '226800', otros_conceptos: '32400' })
    const c4 = l.filas[3]
    expect(c4.otros_conceptos).toBe('0')
    expect(c4.fuente_otros).toBe('comprobante')
    expect(l.advertencias.some((a) => a.startsWith('Cuota 4: la percepción es $ 0 de comprobante'))).toBe(true)
  })

  it('control de salida: la suma de la columna total = canon + IVA + seguro + percepción, al centavo', () => {
    const r = revisarCuadro(l, { cuotas_totales: 35, opcion_compra_neto: null, opcion_compra_fecha: null }, [])
    expect(r.total_planilla).toBe('46286400.00')
    expect(r.total_app).toBe(r.total_planilla)
    expect(r).toMatchObject({ leidas: 35, facturadas: 14, proyectadas: 21, pagadas: 14, nuevas: 35, actualizadas: 0, iguales: 0 })
    expect(r.a_confirmar).toEqual({ seguro: 21, percepcion: 0 })
    expect(r.supuestas).toEqual({ seguro: 0, percepcion: 21 })
    expect(r.opcion.estado).toBe('falta_en_contrato')
  })
})

describe('variantes de formato', () => {
  it('punto y coma con coma decimal (es-AR) entre comillas o no', () => {
    const t = [
      ENCABEZADO.replace(/,/g, ';'),
      '1;2025-09-01;2025-08;1.000.000,00;80.000,00;1.080.000,00;226.800,00;32.400,00;1.339.200,00;SI;comprobante;comprobante',
      '2;2025-10-01;2025-09;"1.000.000,00";80000,00;1080000,00;226800,00;32400,00;1339200,00;SI;comprobante;comprobante',
    ].join('\n')
    const l = leerCuadroMarcha(t)
    expect(l.separador).toBe(';')
    expect(l.errores).toEqual([])
    expect(l.filas.map((f) => f.total)).toEqual(['1339200', '1339200'])
  })

  it('BOM y CRLF', () => {
    const l = leerCuadroMarcha('﻿' + filasDe(CUOTA_1).replace(/\n/g, '\r\n') + '\r\n')
    expect(l.errores).toEqual([])
    expect(l.filas).toHaveLength(1)
  })

  it('encabezado con acentos, mayúsculas, otro orden y sinónimos', () => {
    const t = [
      'Cuota,Vencimiento,Total,Canon,Seguro,Subtotal,IVA 21%,Percepción IVA RG 3337,Pagada,Origen Seguro,Origen Percepción,Período',
      '1,2025-09-01,1339200.00,1000000.00,80000.00,1080000.00,226800.00,32400.00,Sí,comprobante,comprobante,2025-08',
    ].join('\n')
    const l = leerCuadroMarcha(t)
    expect(l.errores).toEqual([])
    expect(l.filas[0]).toMatchObject({ nro: 1, total: '1339200', periodo: '2025-08-01', pagada: true, estado: 'facturada' })
  })

  it('Sí, si, SI y x son pagada; NO y vacío, impaga', () => {
    for (const v of ['Sí', 'si', 'SI', 'x']) expect(leerCuadroMarcha(filasDe(CUOTA_1.replace(',SI,', `,${v},`))).filas[0].pagada).toBe(true)
    expect(leerCuadroMarcha(filasDe(CUOTA_15.replace(',NO,', ',,'))).filas[0].pagada).toBe(false)
  })

  it('comillas con comillas adentro', () => {
    expect(partirCsv('a,"b ""c"" d",e\n', ',')).toEqual([['a', 'b "c" d', 'e']])
    expect(normalizarEncabezado('Percepción IVA RG 3337')).toBe('percepcion_iva_rg_3337')
  })
})

describe('errores con fila y columna (frenan el Enter)', () => {
  it('un total que no cierra', () => {
    const l = leerCuadroMarcha(filasDe(CUOTA_1.replace('1339200.00', '1339300.00')))
    expect(l.errores).toEqual([{ fila: 2, columna: 'total_cuota', mensaje: 'dice $ 1.339.300,00 y canon + seguro + IVA + percepción da $ 1.339.200,00.' }])
  })

  it('un subtotal que no cierra', () => {
    const l = leerCuadroMarcha(filasDe(CUOTA_1.replace('1080000.00', '1080001.00')))
    expect(l.errores[0]).toMatchObject({ fila: 2, columna: 'subtotal_neto' })
  })

  it('una fuente vacía en una cuota impaga no se adivina', () => {
    const l = leerCuadroMarcha(filasDe(CUOTA_15.replace('CONFIRMAR', '')))
    expect(l.errores[0]).toMatchObject({ fila: 2, columna: 'origen_seguro', mensaje: expect.stringContaining('falta de dónde sale') })
    expect(l.filas).toEqual([])
  })

  it('una fuente vacía en una pagada es de comprobante (una pagada tiene factura)', () => {
    const l = leerCuadroMarcha(filasDe(CUOTA_1.replace(/comprobante,comprobante$/, ',')))
    expect(l.errores).toEqual([])
    expect(l.filas[0]).toMatchObject({ estado: 'facturada', fuente_seguro: 'comprobante', fuente_otros: 'comprobante' })
  })

  it('una pagada que no es de comprobante', () => {
    const l = leerCuadroMarcha(filasDe(CUOTA_15.replace(',NO,', ',SI,')))
    expect(l.errores[0]).toMatchObject({ fila: 2, columna: 'origen_seguro', mensaje: expect.stringContaining('una cuota pagada tiene factura') })
  })

  it('n/a con un monto', () => {
    const l = leerCuadroMarcha(filasDe(CUOTA_15.replace('SUPUESTO', 'n/a')))
    expect(l.errores[0]).toMatchObject({ columna: 'percepcion_iva_rg3337', mensaje: expect.stringContaining('n/a') })
  })

  it('n/a con 0: no aplica, sin error', () => {
    const l = leerCuadroMarcha(filasDe('1,2025-09-01,2025-08,1000000.00,60000.00,1060000.00,222600.00,0.00,1282600.00,NO,CONFIRMAR,n/a'))
    expect(l.errores).toEqual([])
    expect(l.filas[0].fuente_otros).toBe('no_aplica')
  })

  it('huecos, repetidos, vencimientos que no crecen y más cuotas que el contrato', () => {
    const l = leerCuadroMarcha(filasDe(CUOTA_1, CUOTA_1, '3,2025-08-01,2025-07,1000000.00,80000.00,1080000.00,226800.00,32400.00,1339200.00,SI,comprobante,comprobante'), {
      cuotasTotales: 2,
    })
    const m = l.errores.map((e) => e.mensaje).join(' | ')
    expect(m).toContain('la cuota 1 ya está en la fila 2')
    expect(m).toContain('faltan las cuotas 2')
    expect(m).toContain('la cuota 3 vence el 2025-08-01, no después de la 1')
    expect(m).toContain('el contrato tiene 2')
  })

  it('una fila que no es cuota, ni OC, ni un cargo reconocible', () => {
    const l = leerCuadroMarcha(filasDe(CUOTA_1, 'ajuste raro,2025-09-15,,,,,,,5000.00,NO,comprobante,n/a'))
    expect(l.errores[0]).toMatchObject({ fila: 3, columna: 'nro_cuota', mensaje: expect.stringContaining('no reconozco "ajuste raro"') })
  })

  it('un número que no se entiende y una fecha que no existe', () => {
    const l = leerCuadroMarcha(filasDe(CUOTA_1.replace('1000000.00', 'un millón').replace('2025-09-01', '2025-02-30')))
    expect(l.errores.map((e) => e.columna)).toEqual(expect.arrayContaining(['canon_neto', 'fecha_vencimiento']))
  })

  it('un encabezado sin las columnas obligatorias', () => {
    const l = leerCuadroMarcha('a,b,c\n1,2,3')
    expect(l.errores[0].mensaje).toMatch(/Al encabezado le faltan columnas: nro_cuota, fecha_vencimiento, canon_neto, total_cuota, pagado/)
  })
})

describe('cargos extra', () => {
  it('una multa con su cuota, una comisión y una reserva: van a pasivo_cargos con su fuente', () => {
    const l = leerCuadroMarcha(
      filasDe(
        CUOTA_1,
        'multa 1,2025-09-10,Multa por mora,,,,,,15000.00,SI,comprobante,n/a',
        'Comisión,2025-09-12,,,,,,,8000.00,NO,CONFIRMAR,n/a',
        'reserva de fondos,2025-09-15,,,,,,,50000.00,NO,SUPUESTO,n/a',
      ),
    )
    expect(l.errores).toEqual([])
    expect(l.cargos).toEqual([
      { fila: 3, fecha: '2025-09-10', concepto: 'multa', detalle: 'Multa por mora', importe: '15000', cuota_nro: 1, fuente: 'comprobante' },
      { fila: 4, fecha: '2025-09-12', concepto: 'comision', detalle: 'Comisión', importe: '8000', cuota_nro: null, fuente: 'a_confirmar' },
      { fila: 5, fecha: '2025-09-15', concepto: 'reserva_fondos', detalle: 'reserva de fondos', importe: '50000', cuota_nro: null, fuente: 'supuesto' },
    ])
  })

  it('un cargo impago sin origen: error, no se adivina', () => {
    const l = leerCuadroMarcha(filasDe('interés,2025-09-10,,,,,,,1500.00,NO,,'))
    expect(l.errores[0]).toMatchObject({ fila: 2, columna: 'origen_seguro' })
  })
})

describe('revisión contra la app', () => {
  const l = leerCuadroMarcha(FIXTURE)
  const actuales = aCuotas(l, 1, 3)

  it('la planilla actualizada: la 15 pasa a facturada y pagada; dice qué cambia, cuota por cuota', () => {
    const nueva = leerCuadroMarcha(FIXTURE.replace(CUOTA_15, '15,2026-11-01,2026-10,1000000.00,80000.00,1080000.00,226800.00,32400.00,1339200.00,SI,comprobante,comprobante'))
    expect(nueva.errores).toEqual([])
    const r = revisarCuadro(nueva, { cuotas_totales: 35, opcion_compra_neto: new Decimal(1000000), opcion_compra_fecha: '2028-07-01' }, actuales)
    expect(r).toMatchObject({ nuevas: 0, actualizadas: 1, iguales: 34, errores: [] })
    expect(r.cambios).toEqual([{ nro: 15, campos: ['pasa a facturada', 'pagada', 'seguro', 'IVA', 'percepción', 'origen del seguro', 'origen de la percepción'] }])
  })

  it('la misma planilla otra vez: 35 iguales', () => {
    const r = revisarCuadro(l, { cuotas_totales: 35, opcion_compra_neto: new Decimal(1000000), opcion_compra_fecha: '2028-07-01' }, actuales)
    expect(r).toMatchObject({ nuevas: 0, actualizadas: 0, iguales: 35, errores: [], cambios: [] })
    expect(r.opcion.estado).toBe('igual')
  })

  it('la 15 ya facturada en la app y la planilla vieja la trae proyectada: error con su fila', () => {
    const conFactura = actuales.map((c) => (c.nro === 15 ? { ...c, estado: 'facturada' as const, fuente_canon: 'comprobante' as const, fuente_seguro: 'comprobante' as const, fuente_otros: 'comprobante' as const } : c))
    const r = revisarCuadro(l, { cuotas_totales: 35, opcion_compra_neto: null, opcion_compra_fecha: null }, conFactura)
    expect(r.errores).toEqual([expect.objectContaining({ fila: 16, mensaje: expect.stringContaining('la cuota 15 ya tiene factura') })])
  })

  it('una opción distinta de la del contrato', () => {
    const r = revisarCuadro(l, { cuotas_totales: 35, opcion_compra_neto: new Decimal(900000), opcion_compra_fecha: '2028-07-01' }, [])
    expect(r.opcion.estado).toBe('distinta')
  })

  it('más cuotas que el contrato', () => {
    const r = revisarCuadro(l, { cuotas_totales: 30, opcion_compra_neto: null, opcion_compra_fecha: null }, [])
    expect(r.errores).toHaveLength(5)
  })

  it('un cargo que dice una cuota que el contrato no tiene frena el guardado con su fila', () => {
    const contrato = { cuotas_totales: 35, opcion_compra_neto: null, opcion_compra_fecha: null }
    const conCargo = { ...l, cargos: [...l.cargos, { fila: 40, fecha: '2026-01-10', concepto: 'multa' as const, detalle: null, importe: '1000', cuota_nro: 99, fuente: 'comprobante' as const }] }
    expect(revisarCuadro(conCargo, contrato, []).errores).toContainEqual({ fila: 40, columna: 'nro_cuota', mensaje: 'el cargo dice la cuota 99 y el contrato tiene 35 cuotas.' })
  })

  it('una planilla que no completa el cuadro avisa antes del Enter qué cuotas faltan (sus meses quedan sin dato)', () => {
    const contrato = { cuotas_totales: 35, opcion_compra_neto: null, opcion_compra_fecha: null }
    const corta = { ...l, filas: l.filas.filter((f) => f.nro <= 20 && f.nro !== 7) }
    const aviso = (r: ReturnType<typeof revisarCuadro>) => r.advertencias.filter((a) => a.startsWith('Con esta planilla'))
    expect(aviso(revisarCuadro(corta, contrato, []))).toEqual([
      'Con esta planilla quedan 19 de las 35 cuotas del contrato: faltan las cuotas 7 y 21 a 35. Hasta que importes la planilla completa, la tasa del contrato y la deuda según el cuadro quedan sin dato (se resta tu estimado, si lo hay), y el mes de cada cuota que falta queda sin dato en Flujo, Hoy y Evolución.',
    ])
    // Las que ya están en la app cuentan: completar con una planilla corta no avisa.
    expect(aviso(revisarCuadro(corta, contrato, actuales))).toEqual([])
    // La planilla entera tampoco.
    expect(aviso(revisarCuadro(l, contrato, []))).toEqual([])
  })
})

describe('revisión: lo que la base rechaza lo dice la revisión, antes del Enter', () => {
  it('una impaga que mezcla comprobante con CONFIRMAR, SUPUESTO o contrato: error con fila y columna (no un "No pude guardar" después del Enter)', () => {
    const mezcla = '2,2025-10-01,2025-09,1000000.00,60000.00,1060000.00,222600.00,31800.00,1314400.00,NO,contrato,comprobante'
    const l = leerCuadroMarcha(filasDe(CUOTA_1, mezcla))
    expect(l.errores).toEqual([expect.objectContaining({ fila: 3, columna: 'origen_percepcion' })])
    expect(l.errores[0].mensaje).toMatch(/comprobante/)
  })

  it('una impaga toda de comprobante (facturada, todavía sin pagar) sigue valiendo', () => {
    const facturada = '2,2025-10-01,2025-09,1000000.00,60000.00,1060000.00,222600.00,31800.00,1314400.00,NO,comprobante,comprobante'
    const l = leerCuadroMarcha(filasDe(CUOTA_1, facturada))
    expect(l.errores).toEqual([])
    expect(l.filas[1]).toMatchObject({ estado: 'facturada', pagada: false, fuente_canon: 'comprobante' })
  })
})
