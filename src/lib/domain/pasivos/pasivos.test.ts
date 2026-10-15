import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { aCargos, aCuotas, leerCuadroMarcha } from '@/lib/carga/cuadro-marcha'
import { calc, sinDato, type Calc } from '../calc'
import { CERO, Decimal } from '../dinero'
import {
  alicuotaIvaObservada,
  aperturaCuota,
  aperturasCuotas,
  campoCuota,
  capitalSegunCuadro,
  cuadroAmortizacion,
  cuotaEnUsd,
  cuotasDelMes,
  faltaPagar,
  licuacionDeuda,
  licuacionPagadas,
  opcionDeCompra,
  pagadorDe,
  recuperoFiscal,
  resumenLeasing,
  subtotalCuota,
  totalCuota,
  totalesApertura,
} from './cuadro'
import { temDeTea, tir, tirContrato, vpn } from './tir'
import type { ContratoPasivo, Cuota } from './tipos'

// Números inventados (D-24): el cuadro de tests/fixtures/cuadro-marcha.csv (35
// cánones de $ 1.000.000, 14 pagados) y un contrato de $ 22.000.000 financiados.

const FIXTURE = readFileSync(path.join(process.cwd(), 'tests/fixtures/cuadro-marcha.csv'), 'utf8')
const lectura = leerCuadroMarcha(FIXTURE, { cuotasTotales: 35 })
const CUOTAS: Cuota[] = aCuotas(lectura, 1, 7)
const CCL_HOY: Calc = calc(new Decimal(1500), 'CCL de hoy = 1.500,00')

function contrato(cambios: Partial<ContratoPasivo> = {}): ContratoPasivo {
  return {
    id: 1,
    nombre: 'Leasing de prueba',
    tipo: 'leasing',
    moneda: 'ARS',
    fecha_inicio: '2025-07-01',
    cuotas_totales: 35,
    monto_financiado_neto: new Decimal(22_000_000),
    anticipo_neto: new Decimal(3_000_000),
    opcion_compra_neto: new Decimal(1_000_000),
    opcion_compra_fecha: '2028-07-01',
    valor_bien: new Decimal(25_000_000),
    alicuota_ganancias: null,
    fecha_desembolso: '2025-07-25',
    pagador_habitual: null,
    reintegra_iva: null,
    notas: null,
    ...cambios,
  }
}

const cuota = (n: number) => CUOTAS.find((c) => c.nro === n)!

describe('el fixture se lee entero', () => {
  it('35 cuotas, 14 pagadas, la opción y sin errores', () => {
    expect(lectura.errores).toEqual([])
    expect(CUOTAS).toHaveLength(35)
    expect(CUOTAS.filter((c) => c.pagada)).toHaveLength(14)
    expect(lectura.opcion).toMatchObject({ fecha: '2028-07-01', neto: '1000000', iva: '210000', total: '1210000' })
  })
})

describe('totalCuota y sus etiquetas', () => {
  it('suma canon + IVA + seguro + percepción, exacto', () => {
    expect(totalCuota(cuota(1)).valor?.toFixed(2)).toBe('1339200.00')
    expect(totalCuota(cuota(4)).valor?.toFixed(2)).toBe('1306800.00')
    expect(totalCuota(cuota(15)).valor?.toFixed(2)).toBe('1314400.00')
    expect(subtotalCuota(cuota(15)).valor?.toFixed(2)).toBe('1060000.00')
    expect(totalCuota(cuota(15)).formula).toContain('canon $ 1.000.000,00 + IVA $ 222.600,00')
  })

  it('una facturada no lleva etiquetas; una proyectada lleva proyectado, supuesto y a confirmar', () => {
    expect(totalCuota(cuota(1)).etiquetas).toEqual([])
    expect(totalCuota(cuota(15)).etiquetas).toEqual(['supuesto', 'a_confirmar', 'proyectado'])
    expect(campoCuota(cuota(15), 'canon').etiquetas).toEqual(['proyectado'])
    expect(campoCuota(cuota(15), 'seguro').etiquetas).toEqual(['a_confirmar', 'proyectado'])
    expect(campoCuota(cuota(15), 'percepcion').etiquetas).toEqual(['supuesto', 'proyectado'])
    // El IVA de una proyectada sale del canon y el seguro: hereda el "a confirmar" del seguro.
    expect(campoCuota(cuota(15), 'iva').etiquetas).toEqual(['a_confirmar', 'proyectado'])
  })

  it('la percepción 0 de comprobante es un cero real, no "sin dato"', () => {
    const p = campoCuota(cuota(4), 'percepcion')
    expect(p.valor?.isZero()).toBe(true)
    expect(p.etiquetas).toEqual([])
  })
})

describe('la cuota en dólares', () => {
  it('pagada sin CCL del pago: sin dato, y dice que la planilla no trae la fecha', () => {
    const u = cuotaEnUsd(cuota(3), CCL_HOY, 'pago')
    expect(u.valor).toBeNull()
    expect(u.motivo).toMatch(/falta la fecha del pago y su CCL/)
  })

  it('pagada con CCL del pago: al CCL de ese día, nunca al de hoy', () => {
    const c = { ...cuota(3), fecha_pago: '2025-11-03', ccl_del_dia_pago: new Decimal(1200), ccl_fuente: 'Ámbito, cierre' }
    expect(cuotaEnUsd(c, CCL_HOY, 'pago').valor?.toFixed(2)).toBe('1116.00')
  })

  it('impaga: al CCL de hoy, rotulado así', () => {
    const u = cuotaEnUsd(cuota(15), CCL_HOY, 'hoy')
    expect(u.valor?.toFixed(2)).toBe('876.27')
    expect(u.formula).toContain('CCL de hoy')
    expect(u.etiquetas).toContain('proyectado')
  })
})

describe('alícuota observada y opción de compra', () => {
  it('la alícuota sale de las facturadas (21%), no de una constante', () => {
    expect(alicuotaIvaObservada(CUOTAS).valor?.toFixed()).toBe('0.21')
  })

  it('si dos facturas tienen distinta alícuota, sin dato con la lista', () => {
    const rara = { ...cuota(2), iva_canon: new Decimal(113400) }
    const a = alicuotaIvaObservada([cuota(1), rara])
    expect(a.valor).toBeNull()
    expect(a.motivo).toMatch(/10,50%.*21,00%|21,00%.*10,50%/)
  })

  it('sin facturadas, sin dato', () => {
    expect(alicuotaIvaObservada(CUOTAS.filter((c) => !c.pagada)).valor).toBeNull()
  })

  it('el IVA de la opción a la alícuota observada; proyectado', () => {
    const o = opcionDeCompra(contrato(), alicuotaIvaObservada(CUOTAS), CCL_HOY)
    expect(o.iva.ars.valor?.toFixed(2)).toBe('210000.00')
    expect(o.total.ars.valor?.toFixed(2)).toBe('1210000.00')
    expect(o.neto.ars.etiquetas).toContain('proyectado')
    expect(o.total.usd.valor?.toFixed(2)).toBe('806.67')
  })

  it('sin opción en el contrato: sin dato, nunca $ 0', () => {
    const o = opcionDeCompra(contrato({ opcion_compra_neto: null }), alicuotaIvaObservada(CUOTAS), CCL_HOY)
    expect(o.neto.ars.valor).toBeNull()
    expect(o.total.ars.valor).toBeNull()
  })
})

describe('tirContrato contra la referencia en Python (tests/referencia/tir_referencia.py)', () => {
  // Valores de la referencia (bisección en Decimal de precisión 50, 300 vueltas).
  const REF = { demo: '0.410283862606', corto: '0.539705785968', escalonado: '0.262928760920', tasa_negativa: '-0.203746810484' }
  const mes = (desde: string, k: number) => {
    const [a, m] = desde.split('-').map(Number)
    const t = m - 1 + k
    return `${a + Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-01`
  }
  const contratoDe = (financiado: string, desembolso: string, primera: string, canones: string[], opcion: string, fechaOpcion: string) => {
    const k = contrato({
      cuotas_totales: canones.length,
      monto_financiado_neto: new Decimal(financiado),
      fecha_desembolso: desembolso,
      opcion_compra_neto: new Decimal(opcion),
      opcion_compra_fecha: fechaOpcion,
    })
    const cs = canones.map((c, i) => ({ ...cuota(15), nro: i + 1, fecha_vencimiento: mes(primera, i), canon_neto: new Decimal(c) }))
    return { k, cs }
  }
  const casos = {
    demo: contratoDe('22000000', '2025-07-25', '2025-09-01', Array(35).fill('1000000'), '1000000', '2028-07-01'),
    corto: contratoDe('1000000', '2026-01-10', '2026-02-01', Array(12).fill('100000'), '50000', '2027-02-01'),
    escalonado: contratoDe('5000000', '2025-03-15', '2025-04-01', Array.from({ length: 24 }, (_, k) => String(200000 + 5000 * k)), '250000', '2027-03-01'),
    tasa_negativa: contratoDe('1000000', '2026-01-01', '2026-02-01', Array(10).fill('90000'), '0', '2026-11-01'),
  }

  for (const [nombre, { k, cs }] of Object.entries(casos)) {
    it(`${nombre}: la misma TEA que la referencia (diferencia < 1e-10) y VPN < $ 0,01`, () => {
      const t = tirContrato(k, cs)
      expect(t.valor, t.motivo).not.toBeNull()
      expect(t.valor!.minus(REF[nombre as keyof typeof REF]).abs().lt('1e-10')).toBe(true)
      const flujos = [{ fecha: k.fecha_desembolso!, monto: k.monto_financiado_neto!.negated() }, ...cs.map((c) => ({ fecha: c.fecha_vencimiento, monto: c.canon_neto })), { fecha: k.opcion_compra_fecha!, monto: k.opcion_compra_neto! }]
      expect(vpn(flujos, t.valor!, k.fecha_desembolso!).abs().lt('0.01')).toBe(true)
    })
  }

  it('la referencia en Python da lo mismo hoy (si hay python3)', () => {
    let salida: string
    try {
      salida = execFileSync('python3', ['-I', path.join(process.cwd(), 'tests/referencia/tir_referencia.py')], { encoding: 'utf8', timeout: 60_000 })
    } catch {
      return // sin python3 en la máquina: quedan los valores de arriba
    }
    const r = JSON.parse(salida) as { nombre: string; tea: string }[]
    expect(Object.fromEntries(r.map((x) => [x.nombre, x.tea]))).toEqual(REF)
  })

  it('un caso a mano: $ 1.000 hoy y $ 1.100 en un año dan 10% exacto', () => {
    const r = tir([
      { fecha: '2025-01-01', monto: new Decimal(-1000) },
      { fecha: '2026-01-01', monto: new Decimal(1100) },
    ])
    expect(r?.tea.toDecimalPlaces(10).toFixed()).toBe('0.1')
  })

  it('la TEM es (1 + TEA)^(1/12) − 1', () => {
    const tea = tirContrato(contrato(), CUOTAS)
    expect(temDeTea(tea).valor!.minus('0.029063587553').abs().lt('1e-11')).toBe(true)
  })

  it('sin monto financiado o sin fecha de desembolso: "Completar el contrato", nombrando lo que falta; nunca fecha_inicio', () => {
    const a = tirContrato(contrato({ monto_financiado_neto: null }), CUOTAS)
    expect(a.valor).toBeNull()
    expect(a.motivo).toBe('Completar el contrato: falta el monto financiado neto.')
    const b = tirContrato(contrato({ fecha_desembolso: null }), CUOTAS)
    expect(b.motivo).toBe('Completar el contrato: falta la fecha de desembolso (la entrega del bien).')
    const c = tirContrato(contrato({ monto_financiado_neto: null, fecha_desembolso: null }), CUOTAS)
    expect(c.motivo).toMatch(/monto financiado neto y la fecha de desembolso/)
  })

  it('con el cuadro incompleto, sin dato', () => {
    expect(tirContrato(contrato(), CUOTAS.slice(0, 30)).motivo).toMatch(/hay 30 de 35 cuotas/)
  })

  it('un canon supuesto hace supuesta la tasa', () => {
    const cs = CUOTAS.map((c) => (c.nro === 20 ? { ...c, fuente_canon: 'supuesto' as const } : c))
    expect(tirContrato(contrato(), cs).etiquetas).toContain('supuesto')
  })
})

describe('apertura de la cuota (D-152)', () => {
  const tea = tirContrato(contrato(), CUOTAS)

  it('Σ amortizaciones + amortización de la opción = monto financiado neto, al centavo', () => {
    const cuadro = cuadroAmortizacion(contrato(), CUOTAS, tea)
    if (!('filas' in cuadro)) throw new Error(cuadro.motivo)
    const suma = cuadro.filas.reduce((a, f) => a.plus(f.amortizacion), CERO)
    expect(suma.toFixed(2)).toBe('22000000.00')
    expect(cuadro.filas[cuadro.filas.length - 1].saldo_final.isZero()).toBe(true)
    // Cada canon = interés + amortización, exacto.
    for (const f of cuadro.filas) expect(f.interes.plus(f.amortizacion).eq(f.pago)).toBe(true)
  })

  it('al centavo también con otro contrato (propiedad sobre varios montos)', () => {
    for (const financiado of ['18000000', '20500000.37', '23999999.99']) {
      const k = contrato({ monto_financiado_neto: new Decimal(financiado) })
      const t = tirContrato(k, CUOTAS)
      const cuadro = cuadroAmortizacion(k, CUOTAS, t)
      if (!('filas' in cuadro)) throw new Error(cuadro.motivo)
      expect(cuadro.filas.reduce((a, f) => a.plus(f.amortizacion), CERO).toFixed(2)).toBe(new Decimal(financiado).toFixed(2))
    }
  })

  it('la apertura suma la cuota: amortización + interés + IVA + seguro + percepción + cargos = total; gasto = total − amortización', () => {
    const cargos = aCargos({ cargos: [{ fila: 40, fecha: '2026-03-05', concepto: 'multa', detalle: 'Multa', importe: '15000', cuota_nro: 7, fuente: 'comprobante' }] }, 1, 7)
    const as = aperturasCuotas(contrato(), CUOTAS, cargos, tea, CCL_HOY)
    for (const a of as) {
      const partes = [a.amortizacion, a.interes, a.iva, a.seguro, a.percepcion, a.cargos].reduce((s, d) => s.plus(d.ars.valor!), CERO)
      expect(partes.eq(a.total.ars.valor!)).toBe(true)
      expect(a.gasto.ars.valor!.eq(a.total.ars.valor!.minus(a.amortizacion.ars.valor!))).toBe(true)
    }
    const siete = as.find((a) => a.nro === 7)!
    expect(siete.cargos.ars.valor?.toFixed()).toBe('15000')
    expect(siete.interes.ars.etiquetas).toContain('estimado')
    expect(siete.amortizacion.ars.etiquetas).toContain('estimado')
    // Una pagada sin CCL del pago: en dólares, sin dato (nunca al CCL de hoy).
    expect(siete.amortizacion.usd.valor).toBeNull()
    // Una impaga: al CCL de hoy.
    expect(as.find((a) => a.nro === 20)!.total.usd.valor?.toFixed(2)).toBe('876.27')
    expect(aperturaCuota(cuota(20), contrato(), tea, CUOTAS, cargos, CCL_HOY).nro).toBe(20)
  })

  it('totales de pagadas y pendientes: cuánto fue amortización y cuánto gasto', () => {
    const as = aperturasCuotas(contrato(), CUOTAS, [], tea, CCL_HOY)
    const pend = totalesApertura(as.filter((a) => a.nro > 14), 'pendientes')
    const pag = totalesApertura(as.filter((a) => a.nro <= 14), 'pagadas')
    expect(pend.total.ars.valor?.toFixed(2)).toBe('27602400.00')
    expect(pend.amortizacion.ars.valor!.plus(pend.gasto.ars.valor!).eq(pend.total.ars.valor!)).toBe(true)
    // Pagadas en dólares: sin el CCL de los pagos, sin dato (no inventa).
    expect(pag.amortizacion.usd.valor).toBeNull()
  })

  it('sin tasa, amortización e interés sin dato con el motivo; IVA, seguro y percepción se ven igual', () => {
    const t = tirContrato(contrato({ monto_financiado_neto: null }), CUOTAS)
    const [a] = aperturasCuotas(contrato({ monto_financiado_neto: null }), CUOTAS, [], t, CCL_HOY)
    expect(a.amortizacion.ars.valor).toBeNull()
    expect(a.amortizacion.ars.motivo).toMatch(/Completar el contrato/)
    expect(a.iva.ars.valor?.toFixed(2)).toBe('226800.00')
    expect(a.gasto.ars.valor).toBeNull()
  })
})

describe('deuda según el cuadro de marcha', () => {
  const tea = tirContrato(contrato(), CUOTAS)

  it('VP a la TEA de los cánones impagos y la opción; estimado', () => {
    const d = capitalSegunCuadro(contrato(), CUOTAS, tea, '2026-10-14', CCL_HOY)
    expect(d.ars.etiquetas).toContain('estimado')
    expect(d.usd.etiquetas).toContain('estimado')
    // Coincide con el saldo del cuadro de amortización después de la cuota 14, llevado al 14/10.
    const cuadro = cuadroAmortizacion(contrato(), CUOTAS, tea)
    if (!('filas' in cuadro)) throw new Error(cuadro.motivo)
    const saldo14 = cuadro.filas.find((f) => f.nro === 14)!.saldo_final
    const llevado = saldo14.times(new Decimal(1).plus(tea.valor!).pow(new Decimal(13).div(365)))
    expect(d.ars.valor!.minus(llevado).abs().lt(1)).toBe(true)
  })

  it('sin tasa, sin dato (nunca el estimado ni cero)', () => {
    const d = capitalSegunCuadro(contrato({ fecha_desembolso: null }), CUOTAS, tirContrato(contrato({ fecha_desembolso: null }), CUOTAS), '2026-10-14', CCL_HOY)
    expect(d.ars.valor).toBeNull()
    expect(d.ars.etiquetas).toContain('estimado')
  })
})

describe('resumenLeasing', () => {
  const r = resumenLeasing(contrato(), CUOTAS, [], CCL_HOY, '2026-10-14')

  it('cuenta pagadas, próxima y lo que falta', () => {
    expect(r.pagadas).toBe(14)
    expect(r.cargadas).toBe(35)
    expect(r.proxima?.nro).toBe(15)
    expect(r.proxima?.total.ars.valor?.toFixed(2)).toBe('1314400.00')
    expect(r.proxima?.total.usd.valor?.toFixed(2)).toBe('876.27')
    expect(r.falta.cuotas).toBe(21)
    expect(r.falta.total.ars.valor?.toFixed(2)).toBe('27602400.00')
    expect(r.falta.canon.ars.valor?.toFixed(2)).toBe('21000000.00')
    expect(r.falta.resto.ars.valor?.toFixed(2)).toBe('6602400.00')
    expect(r.falta.total.ars.etiquetas).toEqual(expect.arrayContaining(['supuesto', 'a_confirmar', 'proyectado']))
  })

  it('lo que falta, partido por fuente, suma lo que falta', () => {
    const f = r.falta.por_fuente
    const suma = [f.comprobante, f.contrato, f.supuesto, f.a_confirmar].reduce((s, c) => s.plus(c.valor ?? CERO), CERO)
    expect(suma.toFixed(2)).toBe('27602400.00')
    expect(f.contrato.valor?.toFixed(2)).toBe('21000000.00')
    expect(f.supuesto.valor?.toFixed(2)).toBe('667800.00')
  })

  it('lo pagado: en pesos exacto; en dólares sin dato hasta tener los CCL de los pagos, y suma parcial con algunos', () => {
    expect(r.pagado.ars.valor?.toFixed(2)).toBe('18684000.00')
    expect(r.pagado.usd.valor).toBeNull()
    const con = CUOTAS.map((c) => (c.nro <= 2 ? { ...c, fecha_pago: c.fecha_vencimiento, ccl_del_dia_pago: new Decimal(1000), ccl_fuente: 'ejemplo' } : c))
    const r2 = resumenLeasing(contrato(), con, [], CCL_HOY, '2026-10-14')
    expect(r2.pagado.usd.valor).toBeNull()
    expect(r2.pagado.usd.etiquetas).toContain('parcial')
    expect(r2.pagado.usd.motivo).toMatch(/Suma parcial \(2 de 14\): US\$ 2\.678,40/)
  })

  it('costo total contra el valor del bien', () => {
    // 18.684.000 + 27.602.400 + 1.210.000 = 47.496.400; ÷ 25.000.000 = 1,899856
    expect(r.costo_total.ars.valor?.toFixed(2)).toBe('47496400.00')
    expect(r.costo_vs_valor.valor?.toFixed()).toBe('1.899856')
    expect(resumenLeasing(contrato({ valor_bien: null }), CUOTAS, [], CCL_HOY, '2026-10-14').costo_vs_valor.valor).toBeNull()
  })

  it('el cuadro incompleto hace parcial lo que falta', () => {
    const r3 = resumenLeasing(contrato(), CUOTAS.slice(0, 30), [], CCL_HOY, '2026-10-14')
    expect(r3.falta.total.ars.valor).toBeNull()
    expect(r3.falta.total.ars.etiquetas).toContain('parcial')
  })
})

describe('para Flujo: cuotasDelMes y pagadorDe', () => {
  it('las cuotas de un mes', () => {
    expect(cuotasDelMes(CUOTAS, '2026-11').map((c) => c.nro)).toEqual([15])
    expect(cuotasDelMes(CUOTAS, '2026-11-01').map((c) => c.nro)).toEqual([15])
    expect(cuotasDelMes(CUOTAS, '2030-01')).toEqual([])
  })

  it('el pagador: el de la cuota, si no el habitual; null = sin declarar', () => {
    expect(pagadorDe(cuota(15), contrato())).toBeNull()
    expect(pagadorDe(cuota(15), contrato({ pagador_habitual: 'titular' }))).toBe('titular')
    expect(pagadorDe({ ...cuota(15), pagador: 'empresa' }, contrato({ pagador_habitual: 'titular' }))).toBe('empresa')
  })
})

describe('recupero fiscal y licuaciones', () => {
  it('IVA y percepción pagados: crédito fiscal de la sociedad; Ganancias sin alícuota, sin dato', () => {
    const r = recuperoFiscal(contrato(), CUOTAS, CCL_HOY)
    // 14 × 226.800 + 12 × 32.400
    expect(r.iva.ars.valor?.toFixed(2)).toBe('3564000.00')
    expect(r.ganancias.ars.valor).toBeNull()
    expect(r.ganancias.ars.motivo).toMatch(/alícuota de Ganancias/)
    const conAlicuota = recuperoFiscal(contrato({ alicuota_ganancias: new Decimal('0.35') }), CUOTAS, CCL_HOY)
    expect(conAlicuota.ganancias.ars.motivo).toMatch(/base de Ganancias/)
  })

  it('cuánto menos pagaste en dólares: con menos de dos CCL de pago, sin dato', () => {
    expect(licuacionPagadas(CUOTAS, CCL_HOY).usd.valor).toBeNull()
    const con = CUOTAS.map((c) =>
      c.nro <= 3 ? { ...c, fecha_pago: c.fecha_vencimiento, ccl_del_dia_pago: new Decimal([1000, 1100, 1200][c.nro - 1]), ccl_fuente: 'ejemplo' } : c,
    )
    const l = licuacionPagadas(con.filter((c) => c.nro <= 3), CCL_HOY)
    // 1.339.200/1000 − 1.339.200/1100 + 1.339.200/1000 − 1.339.200/1200
    expect(l.usd.valor?.toFixed(2)).toBe('344.95')
  })

  it('licuación de la deuda: con una sola carga, sin dato; con dos, deuda × (1/CCL₀ − 1/CCL₁)', () => {
    const d = (v: number) => calc(new Decimal(v), String(v))
    expect(licuacionDeuda([{ fecha: '2026-10-14', deuda: d(20_000_000), ccl: d(1500) }], CCL_HOY).usd.valor).toBeNull()
    const l = licuacionDeuda(
      [
        { fecha: '2026-10-14', deuda: d(20_000_000), ccl: d(1500) },
        { fecha: '2026-11-14', deuda: d(19_500_000), ccl: d(1600) },
      ],
      CCL_HOY,
    )
    expect(l.usd.valor?.toFixed(2)).toBe('833.33')
    const est = licuacionDeuda(
      [
        { fecha: '2026-10-14', deuda: calc(new Decimal(1), '1', [], { etiquetas: ['estimado'] }), ccl: d(1500) },
        { fecha: '2026-11-14', deuda: sinDato('x'), ccl: d(1600) },
      ],
      CCL_HOY,
    )
    expect(est.usd.etiquetas).toContain('estimado')
  })
})

describe('faltaPagar', () => {
  it('sin cuotas cargadas: sin dato, nunca $ 0', () => {
    const f = faltaPagar(contrato(), [], CCL_HOY)
    expect(f.total.ars.valor).toBeNull()
  })
})

describe('revisión: la deuda según el cuadro contra el cuadro de amortización', () => {
  it('a la fecha de una cuota pagada, el VP de lo que falta es el saldo del cuadro de amortización (al peso)', () => {
    const k = contrato()
    const tea = tirContrato(k, CUOTAS)
    const cuadro = cuadroAmortizacion(k, CUOTAS, tea)
    if (!('filas' in cuadro)) throw new Error(cuadro.motivo)
    for (const nro of [1, 14, 20, 34]) {
      const fila = cuadro.filas.find((f) => f.nro === nro)!
      // Las cuotas hasta la nro, pagadas; el resto, impagas.
      const cs = CUOTAS.map((c) => ({ ...c, pagada: c.nro <= nro }))
      const vp = capitalSegunCuadro(k, cs, tea, fila.fecha, CCL_HOY).ars.valor!
      expect(vp.minus(fila.saldo_final).abs().lt(1), `cuota ${nro}: ${vp.toFixed(2)} contra ${fila.saldo_final.toFixed(2)}`).toBe(true)
    }
  })

  it('el cuadro cierra a la tasa del contrato: lo que la opción paga de interés es el del tramo, al peso (Σ amortizaciones = financiado es cierto por construcción; esto no)', () => {
    for (const fechaOpcion of ['2028-07-01', '2028-08-15']) {
      const k = contrato({ opcion_compra_fecha: fechaOpcion })
      const tea = tirContrato(k, CUOTAS)
      const cuadro = cuadroAmortizacion(k, CUOTAS, tea)
      if (!('filas' in cuadro)) throw new Error(cuadro.motivo)
      const o = cuadro.filas[cuadro.filas.length - 1]
      const esperado = o.saldo_inicial.times(new Decimal(1).plus(tea.valor!).pow(new Decimal(o.dias).div(365)).minus(1))
      expect(o.interes.minus(esperado).abs().lt(1), `opción el ${fechaOpcion}: interés ${o.interes.toFixed(2)} contra ${esperado.toFixed(2)}`).toBe(true)
    }
  })

  it('lo pagado en dólares sin los CCL de los pagos: "sin dato" con un motivo que dice qué falta, no "Faltan 14 partes."', () => {
    const r = resumenLeasing(contrato(), CUOTAS, [], CCL_HOY, '2026-10-14')
    expect(r.pagado.usd.valor).toBeNull()
    expect(r.pagado.usd.motivo).toMatch(/^La cuota 1 está pagada, pero falta la fecha del pago y su CCL.*Lo mismo en las otras 13\.$/)
    expect(r.iva_percepcion.pagado.usd.motivo).toMatch(/Lo mismo en las otras 13\.$/)
    // Con un motivo común (sin CCL cargado), queda ese motivo.
    const sinCcl = resumenLeasing(contrato(), CUOTAS, [], sinDato('Todavía no cargaste ningún CCL.'), '2026-10-14')
    expect(sinCcl.falta.total.usd.motivo).toBe('Todavía no cargaste ningún CCL.')
  })

  it('el IVA y la percepción son crédito fiscal de la sociedad que toma el leasing (a la que le factura la leasera), no de quien factura', () => {
    const r = resumenLeasing(contrato(), CUOTAS, [], CCL_HOY, '2026-10-14')
    expect(r.iva_percepcion.pagado.ars.explicacion).not.toMatch(/quien factura/)
    expect(r.iva_percepcion.pagado.ars.explicacion).toMatch(/la sociedad que toma el leasing/)
  })
})
