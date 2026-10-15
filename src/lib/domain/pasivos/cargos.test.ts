import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { aCuotas, leerCuadroMarcha } from '@/lib/carga/cuadro-marcha'
import { calc } from '../calc'
import { Decimal } from '../dinero'
import { cuotaBase, importeCargosPorCuota } from '../flujo/cuotas'
import { cargosPorCuota } from './cargos'
import { aperturasCuotas } from './cuadro'
import { tirContrato } from './tir'
import type { CargoExtra, ContratoPasivo, Cuota } from './tipos'

// Una sola regla para los cargos extra del leasing (Pasivos, Evolución y Flujo).
// Números inventados (D-24): el cuadro de tests/fixtures/cuadro-marcha.csv.

const CUOTAS: Cuota[] = aCuotas(leerCuadroMarcha(readFileSync(path.join(process.cwd(), 'tests/fixtures/cuadro-marcha.csv'), 'utf8'), { cuotasTotales: 35 }), 1, 7)
const c15 = CUOTAS.find((c) => c.nro === 15) as Cuota
const mes15 = c15.fecha_vencimiento.slice(0, 7)

const cargo = (k: Partial<CargoExtra>): CargoExtra => ({
  id: 1,
  pasivo_id: 1,
  fecha: `${mes15}-20`,
  concepto: 'multa',
  detalle: null,
  importe: new Decimal(12_000),
  cuota_nro: null,
  fuente: 'comprobante',
  anulado: false,
  carga_id: 9,
  notas: null,
  ...k,
})

const contrato: ContratoPasivo = {
  id: 1,
  nombre: 'Leasing de prueba',
  tipo: 'leasing',
  moneda: 'ARS',
  fecha_inicio: '2025-07-01',
  cuotas_totales: 35,
  monto_financiado_neto: new Decimal(22_000_000),
  anticipo_neto: null,
  opcion_compra_neto: new Decimal(1_000_000),
  opcion_compra_fecha: '2028-07-01',
  valor_bien: new Decimal(25_000_000),
  alicuota_ganancias: null,
  fecha_desembolso: '2025-07-25',
  pagador_habitual: 'titular',
  reintegra_iva: null,
  notas: null,
}

describe('a qué cuota va cada cargo extra', () => {
  it('el de su número; uno sin cuota, con la del mes de su fecha; el anulado, con ninguna', () => {
    const cargos = [cargo({ id: 1, cuota_nro: 16, importe: new Decimal(5_000) }), cargo({ id: 2 }), cargo({ id: 3, anulado: true })]
    const m = cargosPorCuota(CUOTAS, cargos)
    expect(m.get('1-16')?.map((k) => k.id)).toEqual([1])
    expect(m.get('1-15')?.map((k) => k.id)).toEqual([2])
    expect([...m.values()].flat().map((k) => k.id).sort()).toEqual([1, 2])
  })

  it('uno sin cuota en un mes sin cuota, o con una cuota que no está en el cuadro, va con la cuota siguiente; uno posterior a la última, con ninguna', () => {
    const ultima = CUOTAS.reduce((a, c) => (c.fecha_vencimiento > a.fecha_vencimiento ? c : a))
    const despuesDe15 = CUOTAS.filter((c) => c.fecha_vencimiento > c15.fecha_vencimiento).sort((a, b) => (a.fecha_vencimiento < b.fecha_vencimiento ? -1 : 1))[0]
    const cargos = [
      // El día después del vencimiento de la 15, en un mes que ya pagó su cuota: va con la del mes que viene.
      cargo({ id: 5, fecha: `${mes15}-28` }),
      cargo({ id: 6, cuota_nro: 99, fecha: `${mes15}-20` }),
      cargo({ id: 7, fecha: '2030-01-10' }),
      cargo({ id: 8, fecha: '2020-01-10' }),
    ]
    const m = cargosPorCuota(CUOTAS, cargos)
    // El mismo mes que la 15 (aunque sea después de su día) va con la 15: la regla es por mes.
    expect(m.get('1-15')?.map((k) => k.id)).toEqual([5, 6])
    expect(m.get(`1-${CUOTAS[0].nro}`)?.map((k) => k.id)).toEqual([8])
    expect([...m.values()].flat().map((k) => k.id)).not.toContain(7)
    expect(despuesDe15.nro).toBe(16)
    expect(ultima.fecha_vencimiento < '2030-01-10').toBe(true)
  })

  it('Pasivos (la apertura), Flujo (lo que se debita) y Evolución (que usa la apertura) suman el mismo cargo en la misma cuota', () => {
    const cargos = [cargo({ id: 2 })]
    const apertura = aperturasCuotas(contrato, CUOTAS, cargos, tirContrato(contrato, CUOTAS), calc(new Decimal(1500), 'CCL'))
    expect(apertura.find((a) => a.nro === 15)?.cargos.ars.valor?.toFixed()).toBe('12000')
    const conCargo = cuotaBase(c15, contrato, null, importeCargosPorCuota(CUOTAS, cargos).get('1-15') ?? null)
    const sinCargo = cuotaBase(c15, contrato)
    expect(new Decimal(conCargo.total).minus(sinCargo.total).toFixed()).toBe('12000')
    expect(conCargo.partes?.cargos).toBe('12000')
    expect(sinCargo.partes?.cargos).toBeUndefined()
  })
})
