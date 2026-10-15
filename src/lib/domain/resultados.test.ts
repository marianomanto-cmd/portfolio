import { describe, expect, it } from 'vitest'
import { calc, type DobleCalc } from './calc'
import { Decimal } from './dinero'
import { foto } from './foto'
import type { AperturaCuota } from './pasivos/tipos'
import type { FlujoReal, RecurrenteBase } from './flujo/tipos'
import {
  MOTIVO_SEGUNDA_CARGA,
  agruparResultados,
  capitalAportado,
  cuotasPagadasDesdeCuentas,
  estadoResultados,
  noRealizadoAlDiaCero,
  pnlPorMes,
  puente,
  resultadosPorPartida,
  sensibilidadCcl,
  serieEvolucion,
  type LineaPuente,
  type Puente,
} from './resultados'
import { AAA, BBB, D, aporte, ccl, cuota, op, precio, saldo, vacios } from './resultados.fixture'
import type { Hechos } from './tipos'

const v = (x: { valor: Decimal | null }) => (x.valor === null ? null : x.valor.toFixed())
const linea = (p: Puente, clave: LineaPuente['clave']) => p.lineas.find((l) => l.clave === clave)!
const cerca = (a: Decimal | null, b: string) => {
  expect(a).not.toBeNull()
  expect(a!.minus(b).abs().lt('1e-12'), `${a!.toFixed()} ≈ ${b}`).toBe(true)
}

/** AAA (arriesga dólares): apertura con PPP y CCL de compra, venta parcial el 02/10. IEB sigue su caja en pesos. */
function conVenta(): Hechos {
  const h = vacios()
  ccl(h, '2026-10-01', '1000')
  ccl(h, '2026-10-02', '1100')
  ccl(h, '2026-10-05', '1100')
  precio(h, '2026-10-01', AAA.id, '10000')
  precio(h, '2026-10-02', AAA.id, '11000')
  precio(h, '2026-10-05', AAA.id, '12000')
  h.operaciones.push(
    op({ fecha: '2026-10-01', activo_id: AAA.id, tipo: 'apertura', cantidad: D(100), precio: D(9000), ccl_del_dia: D(900) }),
    op({ fecha: '2026-10-02', activo_id: AAA.id, tipo: 'venta', cantidad: D(40), precio: D(11000), importe: D(440_000), ccl_del_dia: D(1100) }),
  )
  saldo(h, '2026-10-01', 1, 'ARS', '500000')
  saldo(h, '2026-10-02', 1, 'ARS', '940000')
  saldo(h, '2026-10-05', 1, 'ARS', '940000')
  return h
}

describe('puente del período', () => {
  it('con una sola carga: el inicial se conoce y todo lo demás es "sin dato · necesita una segunda carga", nunca 0', () => {
    const h = conVenta()
    const p = puente(h, '2026-10-01', '2026-10-01', 'financiero', '2026-10-01')
    expect(v(linea(p, 'inicial').ars)).toBe('1500000')
    for (const l of p.lineas.filter((x) => x.clave !== 'inicial')) {
      expect(l.ars.valor, l.clave).toBeNull()
      expect(l.usd.valor, l.clave).toBeNull()
      expect(l.ars.motivo).toBe(MOTIVO_SEGUNDA_CARGA)
    }
    expect(p.cuadre.ok).toBeNull()
  })

  it('cierra en las dos monedas: inicial + líneas = final, y el cuadre es 0 calculado', () => {
    const h = conVenta()
    const p = puente(h, '2026-10-01', '2026-10-05', 'financiero', '2026-10-05')
    expect(p.cuadre.ok).toBe(true)
    expect(v(p.cuadre.ars)).toBe('0')
    expect(v(p.cuadre.usd)).toBe('0')
    // Sin aportes ni cuotas: la venta es interna (la plata va al saldo de IEB).
    expect(v(linea(p, 'aportes').ars)).toBe('0')
    expect(v(linea(p, 'cuotas').ars)).toBe('0')
  })

  it('un aporte no es ganancia; una cuota pagada desde una cuenta seguida es una salida, no una pérdida (D-137)', () => {
    const h = vacios()
    for (const [f, c] of [
      ['2026-10-01', '1000'],
      ['2026-10-02', '1100'],
      ['2026-10-05', '1100'],
    ] as const)
      ccl(h, f, c)
    saldo(h, '2026-10-01', 3, 'ARS', '1000000')
    saldo(h, '2026-10-05', 3, 'ARS', '1200000')
    aporte(h, '2026-10-03', 3, 'ARS', '500000')
    const cuotas = [cuota({ nro: 15, fecha_vencimiento: '2026-10-04', fecha_pago: '2026-10-04', cuenta_pago_id: 3, monto_pagado: D(300_000) })]
    // Sin la cuota, el débito se lee como pérdida de tus pesos.
    const sin = puente(h, '2026-10-01', '2026-10-05', 'financiero', '2026-10-05')
    expect(v(linea(sin, 'activo').ars)).toBe('-300000')
    const con = puente(h, '2026-10-01', '2026-10-05', 'financiero', '2026-10-05', { cuotas })
    expect(v(linea(con, 'aportes').ars)).toBe('500000')
    expect(v(linea(con, 'cuotas').ars)).toBe('-300000')
    expect(v(linea(con, 'activo').ars)).toBe('0')
    cerca(linea(con, 'cuotas').usd.valor, new Decimal(-300000).div(1100).toFixed())
    // En dólares: lo único que queda es el dólar sobre tus pesos.
    cerca(linea(con, 'tc').usd.valor, new Decimal(1_000_000).times(new Decimal(1).div(1100).minus(new Decimal(1).div(1000))).toFixed())
    expect(con.cuadre.ok).toBe(true)
    expect(linea(con, 'cuotas').ars.insumos[0].nombre).toContain('cuota 15 del leasing')
    expect(v(cuotasPagadasDesdeCuentas(h, cuotas, '2026-10-01', '2026-10-05').ars)).toBe('-300000')
  })

  it('una cuota sin fecha de pago, sin cuenta o desde una caja que la app no sigue no entra, y se dice por qué', () => {
    const h = vacios()
    ccl(h, '2026-10-01', '1000')
    ccl(h, '2026-10-05', '1000')
    saldo(h, '2026-10-01', 3, 'ARS', '1000000')
    saldo(h, '2026-10-05', 3, 'ARS', '1000000')
    const cuotas = [
      cuota({ nro: 1, fecha_vencimiento: '2026-10-02' }),
      cuota({ nro: 2, fecha_vencimiento: '2026-10-03', fecha_pago: '2026-10-03' }),
      cuota({ nro: 3, fecha_vencimiento: '2026-10-04', fecha_pago: '2026-10-04', cuenta_pago_id: 2 }),
      cuota({ nro: 4, fecha_vencimiento: '2026-11-04', pagada: false }),
    ]
    const p = puente(h, '2026-10-01', '2026-10-05', 'financiero', '2026-10-05', { cuotas })
    expect(p.cuotas_fuera.map((c) => c.nro)).toEqual([1, 2, 3])
    expect(p.cuotas_fuera[0].motivo).toMatch(/sin fecha de pago/)
    expect(p.cuotas_fuera[1].motivo).toMatch(/desde qué cuenta/)
    expect(p.cuotas_fuera[2].motivo).toMatch(/Galicia/)
    expect(v(linea(p, 'cuotas').ars)).toBe('0')
    expect(p.cuadre.ok).toBe(true)
  })

  it('vista Total: amortización de la deuda, revaluación de bienes y el dólar sobre la deuda; cierra', () => {
    const h = conVenta()
    h.pasivos.push({ id: 1, nombre: 'Leasing', tipo: 'leasing', moneda: 'ARS', fecha_inicio: '2025-08-17', cuotas_totales: 48, opcion_compra_fecha: null })
    h.pasivo_saldos.push(
      { pasivo_id: 1, fecha: '2026-09-30', capital_pendiente: D(2_000_000), naturaleza: 'informado', fuente: null, carga_id: 2 },
      { pasivo_id: 1, fecha: '2026-10-03', capital_pendiente: D(1_900_000), naturaleza: 'informado', fuente: null, carga_id: 3 },
    )
    h.bienes.push({ id: 1, nombre: 'Casa', tipo: 'inmueble', moneda_valuacion: 'USD', geografia: 'AR', pasivo_id: null, activo_bool: true })
    h.valuaciones.push(
      { bien_id: 1, fecha: '2026-09-01', valor: D(100_000), fuente: 'inventada', carga_id: 4 },
      { bien_id: 1, fecha: '2026-10-04', valor: D(110_000), fuente: 'inventada', carga_id: 5 },
    )
    const p = puente(h, '2026-10-01', '2026-10-05', 'total', '2026-10-05')
    expect(p.cuadre.ok).toBe(true)
    expect(v(linea(p, 'amortizacion').ars)).toBe('100000')
    // La casa: +US$ 10.000 por la valuación nueva (activo); en pesos, × CCL de llegada.
    expect(v(linea(p, 'de_lo_cual_bienes').usd)).toBe('10000')
    // La deuda en pesos se licúa en dólares (TC positivo: debés menos).
    expect(linea(p, 'de_lo_cual_deuda').usd.valor!.gt(0)).toBe(true)
    expect(linea(p, 'de_lo_cual_bienes').informativa).toBe(true)
  })

  it('vista Total: el dólar sobre tus bienes va en su renglón (la camioneta en pesos pierde dólares, la casa en dólares gana pesos)', () => {
    const h = vacios()
    ccl(h, '2026-10-01', '1000')
    ccl(h, '2026-10-05', '1250')
    saldo(h, '2026-10-01', 1, 'ARS', '500000')
    saldo(h, '2026-10-05', 1, 'ARS', '500000')
    h.bienes.push(
      { id: 1, nombre: 'Casa', tipo: 'inmueble', moneda_valuacion: 'USD', geografia: 'AR', pasivo_id: null, activo_bool: true },
      { id: 2, nombre: 'Camioneta', tipo: 'vehiculo', moneda_valuacion: 'ARS', geografia: 'AR', pasivo_id: null, activo_bool: true },
    )
    h.valuaciones.push(
      { bien_id: 1, fecha: '2026-09-01', valor: D(100_000), fuente: 'inventada', carga_id: 4 },
      { bien_id: 2, fecha: '2026-09-01', valor: D(50_000_000), fuente: 'inventada', carga_id: 5 },
    )
    h.pasivos.push({ id: 1, nombre: 'Leasing', tipo: 'leasing', moneda: 'ARS', fecha_inicio: '2025-08-17', cuotas_totales: 48, opcion_compra_fecha: null })
    h.pasivo_saldos.push({ pasivo_id: 1, fecha: '2026-09-30', capital_pendiente: D(10_000_000), naturaleza: 'informado', fuente: null, carga_id: 2 })
    const p = puente(h, '2026-10-01', '2026-10-05', 'total', '2026-10-05')
    expect(p.cuadre.ok).toBe(true)
    const bienesTc = linea(p, 'de_lo_cual_bienes_tc')
    expect(bienesTc.informativa).toBe(true)
    // En dólares: la camioneta 50.000.000 ÷ 1.250 − 50.000.000 ÷ 1.000 = −10.000; la casa en dólares no cambia.
    cerca(bienesTc.usd.valor, '-10000')
    // En pesos: la casa US$ 100.000 × (1.250 − 1.000) = +25.000.000; la camioneta en pesos no cambia.
    cerca(bienesTc.ars.valor, '25000000')
    // La deuda en pesos: en dólares 10.000.000 ÷ 1.000 − 10.000.000 ÷ 1.250 = +2.000 (debés menos).
    cerca(linea(p, 'de_lo_cual_deuda').usd.valor, '2000')
    expect(bienesTc.usd.formula).toMatch(/Camioneta/)
  })
})

describe('agrupar por cuenta o por activo', () => {
  it('cada grupo suma exacto sus partidas; el mismo ticker en dos cuentas suma junto; la liquidez sola "no aplica"', () => {
    const h = conVenta()
    // AAA también en Galicia, abierto el día cero con su CCL de compra; Galicia sigue su caja en pesos.
    h.operaciones.push(op({ fecha: '2026-10-01', cuenta_id: 2, activo_id: AAA.id, tipo: 'apertura', cantidad: D(10), precio: D(9500), ccl_del_dia: D(950) }))
    saldo(h, '2026-10-01', 2, 'ARS', '200000')
    saldo(h, '2026-10-05', 2, 'ARS', '200000')
    const filas = resultadosPorPartida(h, '2026-10-01', '2026-10-05', '2026-10-05')
    const total = (sel: (x: (typeof filas)[number]) => { ars: { valor: Decimal | null } }) => filas.reduce((a, x) => a.plus(sel(x).ars.valor!), D(0))
    for (const por of ['cuenta', 'activo'] as const) {
      const gs = agruparResultados(filas, por)
      // Cada partida está en un solo grupo, y la suma de los grupos es el total.
      expect(gs.flatMap((g) => g.claves).sort()).toEqual(filas.map((x) => x.clave).sort())
      cerca(gs.reduce((a, g) => a.plus(g.resultado.ars.valor!), D(0)), total((x) => x.resultado).toFixed())
      for (const g of gs) for (const k of ['ars', 'usd'] as const) {
        const miembros = filas.filter((x) => g.claves.includes(x.clave))
        cerca(g.resultado[k].valor, miembros.reduce((a, x) => a.plus(x.resultado[k].valor!), D(0)).toFixed())
        cerca(g.activo[k].valor!.plus(g.tc[k].valor!).plus(g.sin_atribuir[k].valor!), g.resultado[k].valor!.toFixed())
      }
    }
    const porActivo = agruparResultados(filas, 'activo')
    const aaa = porActivo.find((g) => g.nombre === 'AAA')!
    expect(aaa.claves).toHaveLength(2)
    if (aaa.realizado === 'no_aplica') throw new Error('aplica')
    // La traza del grupo nombra cada partida que suma.
    expect(aaa.resultado.ars.insumos.map((i) => i.nombre)).toEqual(['AAA (IEB)', 'AAA (Galicia)'])
    const pesos = porActivo.find((g) => g.nombre === 'Pesos (liquidez)')!
    expect(pesos.realizado).toBe('no_aplica')
    expect(pesos.claves).toHaveLength(2)
    const porCuenta = agruparResultados(filas, 'cuenta')
    expect(porCuenta.map((g) => g.nombre).sort()).toEqual(['Galicia', 'IEB'])
    expect(porCuenta.find((g) => g.nombre === 'IEB')!.claves).toHaveLength(2)
  })
})

describe('realizado y no realizado (D-135)', () => {
  it('venta parcial: realizado = cobro − costo × vendido ÷ tenencia; con el no realizado suma el resultado, en las dos monedas', () => {
    const h = conVenta()
    const filas = resultadosPorPartida(h, '2026-10-01', '2026-10-05', '2026-10-05')
    const a = filas.find((f) => f.ticker === 'AAA')!
    expect(v(a.resultado.ars)).toBe('160000')
    if (a.realizado === 'no_aplica' || a.no_realizado === 'no_aplica') throw new Error('aplica')
    expect(v(a.realizado.ars)).toBe('80000') // 440.000 − 900.000 × 40/100
    expect(v(a.no_realizado.ars)).toBe('80000') // 720.000 − 1.000.000 + 360.000
    cerca(a.realizado.usd.valor, '0') // 400 − 1.000 × 0,4
    for (const k of ['ars', 'usd'] as const) cerca(a.realizado[k].valor!.plus(a.no_realizado[k].valor!), a.resultado[k].valor!.toFixed())
    const liquidez = filas.find((f) => f.clase === 'saldo')!
    expect(liquidez.realizado).toBe('no_aplica')
    expect(liquidez.no_aplica).toMatch(/no tiene costo/)
  })

  it('venta con el costo en dólares sin dato: realizado y no realizado "sin dato" en dólares, el resultado conocido', () => {
    const h = conVenta()
    h.operaciones[0] = { ...h.operaciones[0], ccl_del_dia: null }
    const a = resultadosPorPartida(h, '2026-10-01', '2026-10-05', '2026-10-05').find((f) => f.ticker === 'AAA')!
    if (a.realizado === 'no_aplica' || a.no_realizado === 'no_aplica') throw new Error('aplica')
    expect(a.realizado.usd.valor).toBeNull()
    expect(a.realizado.usd.motivo).toMatch(/Falta el costo de AAA/)
    expect(a.no_realizado.usd.valor).toBeNull()
    expect(a.resultado.usd.valor).not.toBeNull()
    expect(v(a.realizado.ars)).toBe('80000')
  })

  it('una apertura dentro del período entra a su valor del día: lo que traías al abrir no es resultado', () => {
    const h = vacios()
    ccl(h, '2026-10-01', '1000')
    ccl(h, '2026-10-02', '1000')
    ccl(h, '2026-10-05', '1000')
    precio(h, '2026-10-02', BBB.id, '60')
    precio(h, '2026-10-05', BBB.id, '65')
    saldo(h, '2026-10-01', 1, 'ARS', '1000')
    saldo(h, '2026-10-05', 1, 'ARS', '1000')
    h.operaciones.push(op({ fecha: '2026-10-02', activo_id: BBB.id, tipo: 'apertura', cantidad: D(100), precio: D(50), ccl_del_dia: D(1000) }))
    const b = resultadosPorPartida(h, '2026-10-01', '2026-10-05', '2026-10-05').find((f) => f.ticker === 'BBB')!
    expect(v(b.resultado.ars)).toBe('500')
    if (b.no_realizado === 'no_aplica') throw new Error('aplica')
    expect(v(b.no_realizado.ars)).toBe('500')
    const p = puente(h, '2026-10-01', '2026-10-05', 'financiero', '2026-10-05')
    expect(v(linea(p, 'aportes').ars)).toBe('6000') // la apertura, a su valor del día
    expect(p.cuadre.ok).toBe(true)
  })
})

describe('PnL por mes, serie y capital aportado', () => {
  function dosMeses(): Hechos {
    const h = vacios()
    const dias = ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-05']
    dias.forEach((d, i) => {
      ccl(h, d, String(1000 + 10 * i))
      precio(h, d, AAA.id, String(10000 + 150 * i))
      saldo(h, d, 1, 'ARS', i < 3 ? '100000' : '160000')
    })
    h.operaciones.push(op({ fecha: '2026-09-29', activo_id: AAA.id, tipo: 'apertura', cantidad: D(10), precio: D(9000), ccl_del_dia: D(900) }))
    aporte(h, '2026-10-02', 1, 'ARS', '60000')
    return h
  }

  it('cada mes es la suma de sus días y los meses suman el período', () => {
    const h = dosMeses()
    const meses = pnlPorMes(h, '2026-09-29', '2026-10-05', 'financiero', '2026-10-05')
    expect(meses.map((m) => m.mes)).toEqual(['2026-09-01', '2026-10-01'])
    expect(meses[0].parcial).toMatch(/desde el/)
    const total = puente(h, '2026-09-29', '2026-10-05', 'financiero', '2026-10-05')
    for (const clave of ['aportes', 'activo', 'tc', 'sin_atribuir'] as const)
      for (const k of ['ars', 'usd'] as const) {
        const suma = meses.reduce((a, m) => a.plus(linea(m.puente, clave)[k].valor!), new Decimal(0))
        cerca(suma, linea(total, clave)[k].valor!.toFixed())
      }
  })

  it('capital aportado arranca en el patrimonio del día cero y suma los aportes; patrimonio − aportado = lo ganado', () => {
    const h = dosMeses()
    const serie = serieEvolucion(h, 'financiero', '2026-10-05')
    const ap = capitalAportado(h, 'financiero', '2026-10-05')
    expect(serie).toHaveLength(5)
    expect(ap[0]).toEqual(serie[0])
    expect(new Decimal(ap[3].ars!).minus(ap[2].ars!).toFixed()).toBe('60000') // el aporte del 02/10
    expect(ap[4].ars).toBe(ap[3].ars)
    const p = puente(h, '2026-09-29', '2026-10-05', 'financiero', '2026-10-05')
    for (const k of ['ars', 'usd'] as const) {
      const ganado = (['activo', 'tc', 'sin_atribuir'] as const).reduce((a, c) => a.plus(linea(p, c)[k].valor!), new Decimal(0))
      cerca(new Decimal(serie[4][k]!).minus(ap[4][k]!), ganado.toFixed())
    }
  })
})

describe('el día cero (D-136)', () => {
  it('lo que ya traías: valor − costo del PPP; sin CCL de compra, "sin dato" en dólares y el total es la suma parcial', () => {
    const h = conVenta()
    h.operaciones.push(op({ fecha: '2026-10-01', activo_id: BBB.id, tipo: 'apertura', cantidad: D(10), precio: D(40) }))
    precio(h, '2026-10-01', BBB.id, '55')
    const r = noRealizadoAlDiaCero(h, '2026-10-01')!
    expect(r.fecha).toBe('2026-10-01')
    const a = r.filas.find((f) => f.ticker === 'AAA')!
    expect(v(a.resultado.ars)).toBe('100000') // 1.000.000 − 900.000
    expect(v(a.resultado.usd)).toBe('0') // 1.000 − 1.000
    const b = r.filas.find((f) => f.ticker === 'BBB')!
    expect(b.resultado.usd.valor).toBeNull()
    expect(b.pendiente).toMatch(/CCL de compra de BBB/)
    expect(v(r.total.ars)).toBe('100150')
    expect(r.total.usd.valor).toBeNull()
    expect(r.total.usd.etiquetas).toContain('parcial')
    expect(r.total.usd.motivo).toMatch(/Suma parcial \(1 de 2\)/)
  })

  it('la sensibilidad al CCL: en pesos sube lo que arriesga dólares; en dólares baja lo que arriesga pesos', () => {
    const h = conVenta()
    const f = foto(h, '2026-10-01')
    const s = sensibilidadCcl(f, new Decimal('0.01'))
    expect(v(s.ars)).toBe('10000') // 1.000.000 × 1%
    cerca(s.usd.valor, new Decimal(-500000).div(1000).times(new Decimal('0.01').div('1.01')).toFixed())
  })
})

describe('estado de resultados (D-138)', () => {
  const dobleArs = (ars: string, usd: string, etiquetas: ('estimado' | 'proyectado')[] = []): DobleCalc => ({
    ars: calc(D(ars), `${ars}`, [], { etiquetas }),
    usd: calc(D(usd), `${usd}`, [], { etiquetas }),
  })
  const apertura = (nro: number, fecha: string): AperturaCuota => ({
    pasivo_id: 1,
    nro,
    fecha_vencimiento: fecha,
    amortizacion: dobleArs('690000', '460'),
    interes: dobleArs('310000', '206.67', ['estimado']),
    iva: dobleArs('226800', '151.2'),
    seguro: dobleArs('80000', '53.33'),
    percepcion: dobleArs('32400', '21.6'),
    cargos: dobleArs('0', '0'),
    total: dobleArs('1339200', '892.8'),
    gasto: dobleArs('649200', '432.8'),
  })
  const recurrentes: RecurrenteBase[] = [
    { id: 1, sentido: 'ingreso', concepto: 'Ingreso en dólares', moneda: 'USD', monto: '4000', vigente_desde: '2026-10-01', vigente_hasta: null, frecuencia: 'mensual', primer_mes: null, pagador: null, naturaleza: null },
    { id: 2, sentido: 'gasto', concepto: 'Gastos fijos', moneda: 'ARS', monto: '3100000', vigente_desde: '2026-10-01', vigente_hasta: null, frecuencia: 'mensual', primer_mes: null, pagador: 'titular', naturaleza: null },
  ]
  const conLeasing = () => {
    const h = conVenta()
    h.pasivos.push({ id: 1, nombre: 'Leasing', tipo: 'leasing', moneda: 'ARS', fecha_inicio: '2025-08-17', cuotas_totales: 48, opcion_compra_fecha: null })
    h.pasivo_saldos.push({ pasivo_id: 1, fecha: '2026-09-30', capital_pendiente: D(2_000_000), naturaleza: 'estimado', fuente: 'inventada', carga_id: 2 })
    h.bienes.push({ id: 1, nombre: 'Casa', tipo: 'inmueble', moneda_valuacion: 'USD', geografia: 'AR', pasivo_id: null, activo_bool: true })
    h.valuaciones.push({ bien_id: 1, fecha: '2026-09-01', valor: D(100_000), fuente: 'inventada', carga_id: 4 })
    // El dólar cripto de cada carga (inventado): al que se venden los ingresos en dólares, como en Flujo.
    h.tipos_cambio = h.tipos_cambio.map((t) => ({ ...t, cripto_venta: D('1480') }))
    return h
  }

  it('con una sola carga: el flujo del mes en curso se ve; lo patrimonial es "sin dato · necesita una segunda carga"', () => {
    const h = conLeasing()
    const e = estadoResultados(h, { leasing: [apertura(15, '2026-10-17')], flujos: [], recurrentes }, '2026-10-01', '2026-10-01', '2026-10-01')
    expect(e.un_dia).toBe(true)
    const l = (c: string) => e.lineas.find((x) => x.clave === c)!
    expect(l('ingresos_mensuales').rotulo).toBe('declarado')
    expect(l('ingresos_mensuales').ars.etiquetas).toContain('declarado')
    expect(v(l('ingresos_mensuales').usd)).toBe('4000') // octubre entero
    expect(v(l('ingresos_mensuales').ars)).toBe('5920000') // vendidos al cripto, como en Flujo: 4.000 × 1.480
    expect(l('ingresos_mensuales').ars.formula).toContain('× cripto 1.480,00')
    expect(v(l('gastos_fijos').ars)).toBe('3100000')
    expect(l('ingresos_extra').nota).toBe('ninguno cargado')
    expect(v(l('leasing').ars)).toBe('649200') // interés + seguro + cargos + IVA + percepción
    expect(l('leasing_iva').ars.etiquetas).toContain('a_confirmar')
    expect(l('leasing_interes').ars.etiquetas).toContain('estimado')
    expect(l('inversiones').ars.motivo).toBe(MOTIVO_SEGUNDA_CARGA)
    expect(e.no_explicado.ars.valor).toBeNull()
  })

  it('un ingreso declarado en dólares sin el dólar cripto cargado es "sin dato" y lo dice (no se pasa al CCL)', () => {
    const h = conLeasing()
    h.tipos_cambio = h.tipos_cambio.map((t) => ({ ...t, cripto_venta: null }))
    const e = estadoResultados(h, { leasing: [apertura(15, '2026-10-17')], flujos: [], recurrentes }, '2026-10-01', '2026-10-01', '2026-10-01')
    const ing = e.lineas.find((x) => x.clave === 'ingresos_mensuales')!
    expect(ing.ars.valor).toBeNull()
    expect(ing.ars.motivo).toMatch(/dólar cripto/)
  })

  it('con el cuadro importado y la cuota de la empresa, el costo del leasing es $ 0 y lo dice (no "falta el cuadro de marcha")', () => {
    const h = conLeasing()
    const empresa = estadoResultados(h, { leasing: [], flujos: [], recurrentes, leasing_vacio: 'empresa' }, '2026-10-01', '2026-10-01', '2026-10-01')
    const l = empresa.lineas.find((x) => x.clave === 'leasing')!
    expect(v(l.ars)).toBe('0')
    expect(l.nota).toBe('la cuota la paga la empresa')
  })

  it('si la empresa te reintegra el IVA, el IVA y la percepción no se suman', () => {
    const h = conLeasing()
    const e = estadoResultados(h, { leasing: [apertura(15, '2026-10-17')], flujos: [], recurrentes, reintegra_iva: true }, '2026-10-01', '2026-10-01', '2026-10-01')
    expect(v(e.lineas.find((x) => x.clave === 'leasing')!.ars)).toBe('390000')
  })

  it('sin el cuadro de marcha, el costo del leasing es "sin dato" y lo dice; el ahorro queda sin dato con la suma parcial', () => {
    const h = conLeasing()
    const e = estadoResultados(h, { leasing: [], flujos: [], recurrentes }, '2026-10-01', '2026-10-01', '2026-10-01')
    expect(e.lineas.find((x) => x.clave === 'leasing')!.ars.motivo).toMatch(/cuadro de marcha/)
    const ahorro = e.lineas.find((x) => x.clave === 'ahorro')!
    expect(ahorro.ars.valor).toBeNull()
    expect(ahorro.ars.etiquetas).toContain('parcial')
  })

  it('como hoy en producción (nada declarado ni cargado, sin cuadro de marcha): el ahorro es "sin dato" y nunca dice "$ 0"', () => {
    const h = conLeasing()
    const e = estadoResultados(h, { leasing: [], flujos: [], recurrentes: [] }, '2026-10-01', '2026-10-01', '2026-10-01')
    const ahorro = e.lineas.find((x) => x.clave === 'ahorro')!
    expect(ahorro.ars.valor).toBeNull()
    expect(ahorro.ars.etiquetas).not.toContain('parcial')
    expect(ahorro.ars.motivo).not.toMatch(/\$\s?0/)
    expect(ahorro.ars.motivo).toMatch(/Cargar ingreso/)
  })

  it('con dos cargas: un ingreso cargado reemplaza al declarado de su mes; no explicado = real − explicada', () => {
    const h = conLeasing()
    const flujos: FlujoReal[] = [
      { id: 1, fecha: '2026-10-03', sentido: 'ingreso', concepto: 'mensual', moneda: 'USD', monto: '2000', cuenta_id: null, cripto_usado: '1480', pesos_recibidos: '2960000', anulado: false, carga_id: 50, notas: null },
      { id: 2, fecha: '2026-10-04', sentido: 'ingreso', concepto: 'extraordinario', moneda: 'ARS', monto: '100000', cuenta_id: null, cripto_usado: null, pesos_recibidos: null, anulado: false, carga_id: 51, notas: null },
      { id: 3, fecha: '2026-10-04', sentido: 'gasto', concepto: 'extraordinario', moneda: 'ARS', monto: '50000', cuenta_id: null, cripto_usado: null, pesos_recibidos: null, anulado: true, carga_id: 52, notas: null },
    ]
    const e = estadoResultados(h, { leasing: [apertura(15, '2026-10-04')], flujos, recurrentes }, '2026-10-01', '2026-10-05', '2026-10-05')
    const l = (c: string) => e.lineas.find((x) => x.clave === c)!
    expect(v(l('ingresos_mensuales').ars)).toBe('2960000')
    expect(l('ingresos_mensuales').rotulo).toBeNull()
    expect(v(l('ingresos_extra').ars)).toBe('100000')
    expect(l('gastos_extra').nota).toBe('ninguno cargado') // el anulado no cuenta
    // Gastos fijos declarados, prorrateados: 4 de 31 días de octubre.
    expect(v(l('gastos_fijos').ars)).toBe(new Decimal(3_100_000).times(4).div(31).toFixed())
    expect(v(l('inversiones').ars)).toBe('160000')
    for (const k of ['ars', 'usd'] as const) cerca(e.no_explicado[k].valor, l('real')[k].valor!.minus(l('explicada')[k].valor!).toFixed())
  })

  it('cargar el ingreso del mes en dólares no borra el ingreso en pesos declarado (como en Flujo y en Hoy: se reemplaza por moneda)', () => {
    const h = conLeasing()
    const conPesos: RecurrenteBase[] = [
      ...recurrentes,
      { id: 3, sentido: 'ingreso', concepto: 'Ingreso en pesos', moneda: 'ARS', monto: '620000', vigente_desde: '2026-10-01', vigente_hasta: null, frecuencia: 'mensual', primer_mes: null, pagador: null, naturaleza: null },
    ]
    const flujos: FlujoReal[] = [
      { id: 1, fecha: '2026-10-03', sentido: 'ingreso', concepto: 'mensual', moneda: 'USD', monto: '2000', cuenta_id: null, cripto_usado: '1480', pesos_recibidos: '2960000', anulado: false, carga_id: 50, notas: null },
    ]
    const e = estadoResultados(h, { leasing: [apertura(15, '2026-10-04')], flujos, recurrentes: conPesos }, '2026-10-01', '2026-10-05', '2026-10-05')
    const ing = e.lineas.find((x) => x.clave === 'ingresos_mensuales')!
    // Los dólares cargados (los pesos que recibiste) + los pesos declarados, prorrateados: 4 de 31 días.
    expect(v(ing.ars)).toBe(new Decimal(2_960_000).plus(new Decimal(620_000).times(4).div(31)).toFixed())
    expect(ing.ars.formula).toContain('Ingreso en pesos declarado')
    expect(ing.ars.formula).not.toContain('Ingreso en dólares declarado')
  })
})

// ───────────── Revisión adversaria (15/10): defectos encontrados, con su test ─────────────

describe('revisión: la deuda estimada (D-154) rotula todo lo que sale de ella', () => {
  /** Como producción: la casa en dólares, la deuda del leasing estimada (sin saldo nuevo) y el CCL que sube entre dos cargas. */
  const conDeuda = (naturaleza: 'estimado' | 'informado', segundoSaldo: string | null = null) => {
    const h = conVenta()
    h.pasivos.push({ id: 1, nombre: 'Leasing', tipo: 'leasing', moneda: 'ARS', fecha_inicio: '2025-08-17', cuotas_totales: 48, opcion_compra_fecha: null })
    h.pasivo_saldos.push({ pasivo_id: 1, fecha: '2026-09-28', capital_pendiente: D(2_000_000), naturaleza, fuente: naturaleza === 'estimado' ? 'inventada' : null, carga_id: 2 })
    if (segundoSaldo) h.pasivo_saldos.push({ pasivo_id: 1, fecha: '2026-10-05', capital_pendiente: D(segundoSaldo), naturaleza, fuente: naturaleza === 'estimado' ? 'inventada' : null, carga_id: 3 })
    h.bienes.push({ id: 1, nombre: 'Casa', tipo: 'inmueble', moneda_valuacion: 'USD', geografia: 'AR', pasivo_id: null, activo_bool: true })
    h.valuaciones.push({ bien_id: 1, fecha: '2026-09-01', valor: D(100_000), fuente: 'inventada', carga_id: 4 })
    return h
  }
  const et = (c: { etiquetas: string[] }) => c.etiquetas

  it('en el puente Total: la amortización, el dólar sobre la deuda y el resultado por el tipo de cambio (en dólares) llevan "estimado"', () => {
    const p = puente(conDeuda('estimado', '1900000'), '2026-10-01', '2026-10-05', 'total', '2026-10-05')
    expect(v(linea(p, 'amortizacion').ars)).toBe('100000')
    for (const k of ['ars', 'usd'] as const) expect(et(linea(p, 'amortizacion')[k]), k).toContain('estimado')
    expect(et(linea(p, 'de_lo_cual_deuda').usd)).toContain('estimado')
    expect(et(linea(p, 'tc').usd)).toContain('estimado')
    expect(et(linea(p, 'final').usd)).toContain('estimado')
    expect(p.cuadre.ok).toBe(true)
  })

  it('sin saldo nuevo, la amortización "0" sale de una deuda estimada que no se actualizó: lleva "estimado"', () => {
    const p = puente(conDeuda('estimado'), '2026-10-01', '2026-10-05', 'total', '2026-10-05')
    expect(v(linea(p, 'amortizacion').ars)).toBe('0')
    expect(et(linea(p, 'amortizacion').ars)).toContain('estimado')
  })

  it('con la deuda informada, ninguna línea lleva "estimado" (control)', () => {
    const p = puente(conDeuda('informado', '1900000'), '2026-10-01', '2026-10-05', 'total', '2026-10-05')
    for (const l of p.lineas) for (const k of ['ars', 'usd'] as const) expect(et(l[k]), `${l.clave} ${k}`).not.toContain('estimado')
  })

  it('en la vista Financiero la deuda no entra: nada lleva "estimado"', () => {
    const p = puente(conDeuda('estimado', '1900000'), '2026-10-01', '2026-10-05', 'financiero', '2026-10-05')
    for (const l of p.lineas) for (const k of ['ars', 'usd'] as const) expect(et(l[k]), `${l.clave} ${k}`).not.toContain('estimado')
  })

  it('la fila del leasing en los resultados (vista Total) y la licuación del estado de resultados llevan "estimado"', () => {
    const h = conDeuda('estimado', '1900000')
    const fila = resultadosPorPartida(h, '2026-10-01', '2026-10-05', '2026-10-05', { vista: 'total' }).find((f) => f.clase === 'pasivo')!
    expect(et(fila.resultado.usd)).toContain('estimado')
    expect(et(fila.tc.usd)).toContain('estimado')
    const e = estadoResultados(h, { leasing: [], flujos: [], recurrentes: [] }, '2026-10-01', '2026-10-05', '2026-10-05')
    const lic = e.lineas.find((l) => l.clave === 'licuacion')!
    expect(lic.usd.valor).not.toBeNull()
    expect(et(lic.usd)).toContain('estimado')
  })

  it('la serie del patrimonio Total marca los días con la deuda estimada (para rotular el gráfico)', () => {
    const h = conDeuda('estimado')
    expect(serieEvolucion(h, 'total', '2026-10-05').every((p) => p.estimado)).toBe(true)
    expect(serieEvolucion(h, 'financiero', '2026-10-05').some((p) => p.estimado)).toBe(false)
  })
})

describe('revisión: el aviso de cuotas que no entran al puente habla solo de las del período', () => {
  it('una cuota pagada sin fecha que venció antes del período no aparece; una que vence adentro, sí', () => {
    const h = conVenta()
    const cuotas = [cuota({ nro: 14, fecha_vencimiento: '2026-09-17' }), cuota({ nro: 15, fecha_vencimiento: '2026-10-04' })]
    const p = puente(h, '2026-10-01', '2026-10-05', 'financiero', '2026-10-05', { cuotas })
    expect(p.cuotas_fuera.map((c) => c.nro)).toEqual([15])
    // Con una sola carga no hay período: ninguna cuota que avisar.
    expect(puente(h, '2026-10-01', '2026-10-01', 'financiero', '2026-10-01', { cuotas }).cuotas_fuera).toEqual([])
  })

  it('una cuota pagada desde una caja que la app no sigue avisa solo si se pagó en el período', () => {
    const h = conVenta()
    const cuotas = [cuota({ nro: 13, fecha_vencimiento: '2026-08-17', fecha_pago: '2026-08-17', cuenta_pago_id: 3 }), cuota({ nro: 15, fecha_vencimiento: '2026-10-04', fecha_pago: '2026-10-04', cuenta_pago_id: 3 })]
    const p = puente(h, '2026-10-01', '2026-10-05', 'financiero', '2026-10-05', { cuotas })
    expect(p.cuotas_fuera.map((c) => c.nro)).toEqual([15])
  })
})

describe('revisión: PnL por mes, el mes cortado a mitad dice hasta cuándo', () => {
  it('un período que termina antes de la última carga del mes rotula el mes "del … al …", aunque el mes ya haya pasado', () => {
    const h = conVenta()
    const meses = pnlPorMes(h, '2026-10-01', '2026-10-02', 'financiero', '2026-11-20')
    expect(meses).toHaveLength(1)
    expect(meses[0].parcial).toBe('del jue 01/10 al vie 02/10')
  })

  it('un mes pasado que llega hasta su última carga no se rotula "hasta" (control)', () => {
    const h = conVenta()
    expect(pnlPorMes(h, '2026-10-01', '2026-10-05', 'financiero', '2026-11-20')[0].parcial).toBe('parcial, desde el jue 01/10')
  })
})
