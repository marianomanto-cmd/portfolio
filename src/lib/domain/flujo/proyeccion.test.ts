import { describe, expect, it } from 'vitest'
import { Decimal } from '../dinero'
import { controlCripto } from './control'
import { cuotaBase, mesesSinCuota } from './cuotas'
import { excedenteMes } from './excedente'
import { nombreVariable } from './panel'
import { nombreMes, proyectar, trazaMes } from './proyeccion'
import { desvioMes } from './real'
import { delMes, finDeMes, tocaEnMes, vigentesEn } from './recurrentes'
import {
  codificar,
  completarConIgual,
  decodificar,
  esquemaSupuestos,
  faltantes,
  fechaMes,
  rebasar,
  supuestosIniciales,
  supuestosVacios,
  textoBoton,
} from './supuestos'
import { temImplicitaValor } from './tem'
import type { BaseProyeccion, CuotaBase, PartidaBase, RecurrenteBase, Supuestos } from './tipos'

// Todos los números son inventados (D-24).

const D = (x: string | number) => new Decimal(x)

function partida(p: Partial<PartidaBase> & Pick<PartidaBase, 'clave' | 'clase' | 'moneda_riesgo' | 'valor'>): PartidaBase {
  return { nombre: p.clave, activo_id: null, cuenta_id: null, peso: null, cantidad: null, fecha_vencimiento: null, ley: 'clase', ...p }
}

const R = (r: Partial<RecurrenteBase> & Pick<RecurrenteBase, 'id' | 'sentido' | 'moneda' | 'monto'>): RecurrenteBase => ({
  concepto: `fila ${r.id}`,
  vigente_desde: '2026-10-01',
  vigente_hasta: null,
  frecuencia: 'mensual',
  primer_mes: null,
  pagador: null,
  naturaleza: null,
  ...r,
})

/** Una base chica: un CEDEAR (US$ 10.000), pesos ($ 3.000.000), sin letras. CCL 1.500, cripto 1.485 (brecha −1%). */
function baseChica(extra: Partial<BaseProyeccion> = {}): BaseProyeccion {
  return {
    fecha: '2026-10-14',
    hoy: '2026-10-15',
    ccl: '1500',
    cripto: '1485',
    fecha_cripto: '2026-10-14',
    partidas: [
      partida({ clave: 'p:1:1', clase: 'cedear', moneda_riesgo: 'USD', valor: { ars: '15000000', usd: '10000' }, ticker: 'SPY' }),
      partida({ clave: 'liq:ARS', clase: 'liquidez', moneda_riesgo: 'ARS', valor: { ars: '3000000', usd: '2000' } }),
    ],
    recurrentes: [R({ id: 1, sentido: 'ingreso', moneda: 'USD', monto: '2000' }), R({ id: 2, sentido: 'ingreso', moneda: 'ARS', monto: '620000' }), R({ id: 3, sentido: 'gasto', moneda: 'ARS', monto: '1800000' })],
    cuotas: [],
    vencimientos: [],
    bienes: [],
    deudas: [],
    flujos_reales: [],
    ...extra,
  }
}

function todoIgual(s: Supuestos, h = 12, b: BaseProyeccion = baseChica()): Supuestos {
  const x = completarConIgual(s, b)
  x.horizonte_meses = h
  return x
}

const cuota = (nro: number, fecha: string, extra: Partial<CuotaBase> = {}): CuotaBase => ({
  pasivo_id: 1,
  nro,
  fecha_vencimiento: fecha,
  total: '1339200',
  amortizacion: null,
  iva_y_percepcion: '259200',
  pagada: false,
  pagador: null,
  etiquetas: ['proyectado'],
  ...extra,
})

describe('supuestos', () => {
  it('un escenario nuevo no tiene nada de mercado elegido; solo la regla del dueño, rotulada', () => {
    const s = supuestosVacios()
    expect(esquemaSupuestos.parse(s)).toEqual(s)
    expect(s.devaluacion[0].dir).toBeNull()
    expect(s.retorno.cedear.dir).toBeNull()
    expect(s.horizonte_meses).toBeNull()
    expect(s.politica).toMatchObject({ regla: 'proporcional_ultima_carga', pct: '100', origen: 'declarada_14_10' })
    expect(s.pagador_cuota).toEqual({ quien: 'titular', desde_mes: null })
  })

  it('neutralidad: sin elegir, la proyección no inventa ningún mes y dice qué falta', () => {
    const p = proyectar(baseChica(), supuestosVacios())
    expect(p.estado).toBe('faltan')
    expect(p.meses).toEqual([])
    const vars = p.faltan.map((f) => f.variable)
    expect(vars).toEqual(expect.arrayContaining(['horizonte', 'devaluacion.0', 'brecha_cripto', 'ingreso_usd.0', 'ingreso_pesos.0', 'gastos', 'retorno.cedear', 'retorno.liquidez_pesos']))
  })

  it('Baja o Sube sin valor es "falta"; con valor, no', () => {
    const s = todoIgual(supuestosVacios())
    s.devaluacion[0] = { dir: 'sube', valor: null, hasta_mes: null }
    expect(faltantes(baseChica(), s).bloquean.map((f) => f.variable)).toEqual(['devaluacion.0'])
    s.devaluacion[0].valor = '2'
    expect(faltantes(baseChica(), s).bloquean).toEqual([])
  })

  it('"Completar con Igual" no pisa lo elegido', () => {
    const s = supuestosVacios()
    s.retorno.cedear = { dir: 'sube', valor: '8' }
    const c = completarConIgual(s, baseChica())
    expect(c.retorno.cedear).toEqual({ dir: 'sube', valor: '8' })
    expect(c.devaluacion[0].dir).toBe('igual')
    expect(s.devaluacion[0].dir).toBeNull()
  })

  it('el ingreso arranca con el tramo de feb-2027 (lo anunció el dueño), sin elegir', () => {
    const s = supuestosIniciales({ fecha: '2026-10-14', partidas: [] })
    expect(s.ingreso_usd.map((t) => t.desde_mes)).toEqual([1, 4])
    expect(s.ingreso_usd.every((t) => t.dir === null)).toBe(true)
  })

  describe('un escenario guardado se abre con otra carga: sus meses siguen en el mismo mes del calendario (rebasar)', () => {
    const oct = { ...supuestosIniciales({ fecha: '2026-10-14', partidas: [] }) }
    oct.ingreso_usd = oct.ingreso_usd.map((t, i) => ({ ...t, dir: 'igual' as const, valor: null, crecimiento_anual: i === 1 ? '0' : null }))

    it('guarda el mes de la carga con que se armó', () => {
      expect(oct.base_mes).toBe('2026-10-01')
    })

    it('con la carga de noviembre, el cambio de feb-2027 pasa del mes 4 al 3; con la misma carga no cambia nada', () => {
      const nov = rebasar(oct, '2026-11-20')
      expect(nov.base_mes).toBe('2026-11-01')
      expect(nov.ingreso_usd.map((t) => t.desde_mes)).toEqual([1, 3])
      expect(nov.ingreso_pesos.map((t) => t.desde_mes)).toEqual([1, 3])
      expect(rebasar(oct, '2026-10-30')).toBe(oct)
    })

    it('en feb-2027 el tramo nuevo ya empezó: rige desde el mes 1 y el anterior sale', () => {
      const feb = rebasar(oct, '2027-02-03')
      expect(feb.ingreso_usd).toEqual([{ ...oct.ingreso_usd[1], desde_mes: 1 }])
    })

    it('un tramo de devaluación que ya terminó sale; el que termina en el mes de la carga todavía rige ese mes; el que sigue se corre', () => {
      // Armado en octubre: sube hasta el mes 3 (enero), después igual.
      const s: Supuestos = { ...oct, devaluacion: [{ dir: 'sube', valor: '2', hasta_mes: 3 }, { dir: 'igual', valor: null, hasta_mes: null }] }
      expect(rebasar(s, '2026-12-01').devaluacion).toEqual([{ dir: 'sube', valor: '2', hasta_mes: 1 }, { dir: 'igual', valor: null, hasta_mes: null }])
      expect(rebasar(s, '2027-01-05').devaluacion).toEqual([{ dir: 'sube', valor: '2', hasta_mes: 0 }, { dir: 'igual', valor: null, hasta_mes: null }])
      expect(rebasar(s, '2027-02-05').devaluacion).toEqual([{ dir: 'igual', valor: null, hasta_mes: null }])
      const ene = rebasar(s, '2027-01-05')
      expect(nombreVariable('devaluacion.0', ene, { fecha: '2027-01-05' })).toBe('Devaluación (CCL) · este mes')
      expect(nombreVariable('devaluacion.1', ene, { fecha: '2027-01-05' })).toMatch(/· desde feb/)
      expect(decodificar(codificar(ene))).toEqual(ene)
    })

    it('"la empresa paga desde el mes N" se corre; el mes anterior todavía paga el otro; si ya pasó, rige desde ahora', () => {
      // Armado en octubre: la empresa paga desde el mes 5 (marzo).
      const s: Supuestos = { ...oct, pagador_cuota: { quien: 'empresa', desde_mes: 5 } }
      expect(rebasar(s, '2026-12-01').pagador_cuota).toEqual({ quien: 'empresa', desde_mes: 3 })
      expect(rebasar(s, '2027-02-01').pagador_cuota).toEqual({ quien: 'empresa', desde_mes: 1 }) // febrero todavía la pagás vos
      expect(rebasar(s, '2027-03-01').pagador_cuota).toEqual({ quien: 'empresa', desde_mes: null })
    })

    it('abierto con la carga de enero, el cambio de feb-2027 sigue en febrero: enero conserva el tramo de antes', () => {
      const conBaja: Supuestos = { ...oct, ingreso_usd: [{ ...oct.ingreso_usd[0] }, { ...oct.ingreso_usd[1], dir: 'baja', valor: '30', crecimiento_anual: null }] }
      const ene = rebasar(conBaja, '2027-01-14')
      expect(ene.ingreso_usd.map((t) => [t.desde_mes, t.dir])).toEqual([
        [1, 'igual'],
        [1, 'baja'],
      ])
      expect(nombreVariable('ingreso_usd.0', ene, { fecha: '2027-01-14' })).toMatch(/· desde ahora$/)
      expect(nombreVariable('ingreso_usd.1', ene, { fecha: '2027-01-14' })).toMatch(/· desde feb/)
      // La proyección: enero (mes 0) con el ingreso de siempre, febrero (mes 1) con la baja.
      const b = baseChica({ fecha: '2027-01-14', hoy: '2027-01-15', fecha_cripto: '2027-01-14' })
      const p = proyectar(b, todoIgual(ene, 6, b))
      expect(D(p.meses[1].ingresos.ars as string).lt(p.meses[0].ingresos.ars as string)).toBe(true)
      const igual = proyectar(b, todoIgual(rebasar(oct, '2027-01-14'), 6, b))
      expect(p.meses[0].ingresos).toEqual(igual.meses[0].ingresos)
    })

    it('un escenario nuevo armado en enero: el tramo de feb-2027 empieza el mes que viene, no en enero', () => {
      const s = supuestosIniciales({ fecha: '2027-01-14', partidas: [] })
      expect(s.ingreso_usd.map((t) => t.desde_mes)).toEqual([1, 1])
      expect(nombreVariable('ingreso_usd.1', s, { fecha: '2027-01-14' })).toMatch(/· desde feb/)
      const b = baseChica({ fecha: '2027-01-14', hoy: '2027-01-15', fecha_cripto: '2027-01-14' })
      const c = todoIgual(s, 6, b)
      c.ingreso_usd[1] = { ...c.ingreso_usd[1], dir: 'baja', valor: '30' }
      const p = proyectar(b, c)
      expect(D(p.meses[1].ingresos.ars as string).lt(p.meses[0].ingresos.ars as string)).toBe(true)
    })

    it('un ?s= de antes (sin el mes de la base) se toma contado desde esta carga', () => {
      const { base_mes: _, ...viejo } = oct
      const r = rebasar(viejo, '2026-12-01')
      expect(r.base_mes).toBe('2026-12-01')
      expect(r.ingreso_usd.map((t) => t.desde_mes)).toEqual([1, 4])
    })

    it('lo corrido sigue siendo un escenario válido (pasa el esquema de la base y de la URL)', () => {
      const r = rebasar(oct, '2027-01-10')
      expect(esquemaSupuestos.safeParse(r).success).toBe(true)
      expect(decodificar(codificar(r))).toEqual(r)
    })
  })

  it('?s= ida y vuelta; otra versión o fuera de rango no se lee', () => {
    const s = todoIgual(supuestosVacios())
    s.devaluacion[0] = { dir: 'sube', valor: '2.5', hasta_mes: null }
    expect(decodificar(codificar(s))).toEqual(s)
    expect(decodificar(codificar({ ...s, v: 2 as unknown as 1 }))).toBeNull()
    expect(decodificar(codificar({ ...s, devaluacion: [{ dir: 'sube', valor: '40', hasta_mes: null }] }))).toBeNull()
    expect(decodificar('no-es-base64-json')).toBeNull()
  })

  it('el número va en el botón', () => {
    expect(textoBoton('devaluacion', 'sube', '2')).toBe('Sube +2,0%/mes')
    expect(textoBoton('retorno.cedear', 'baja', '10')).toBe('Baja −10,0%/año')
    expect(textoBoton('devaluacion', 'igual', null)).toBe('Igual')
  })
})

describe('recurrentes', () => {
  it('una fila cuenta si está vigente el último día del mes; un cambio desde feb no suma dos filas', () => {
    const viejo = R({ id: 1, sentido: 'ingreso', moneda: 'USD', monto: '2000', vigente_hasta: '2027-01-31' })
    const nuevo = R({ id: 2, sentido: 'ingreso', moneda: 'USD', monto: '2600', vigente_desde: '2027-02-01' })
    expect(vigentesEn([viejo, nuevo], '2027-01-01').map((r) => r.id)).toEqual([1])
    expect(vigentesEn([viejo, nuevo], '2027-02-01').map((r) => r.id)).toEqual([2])
    expect(finDeMes('2027-02-01')).toBe('2027-02-28')
  })

  it('un gasto trimestral toca cada tres meses desde su primer mes', () => {
    const g = R({ id: 3, sentido: 'gasto', moneda: 'ARS', monto: '180000', frecuencia: 'trimestral', primer_mes: '2026-11-01' })
    expect(['2026-10-01', '2026-11-01', '2026-12-01', '2027-02-01'].map((m) => tocaEnMes(g, m))).toEqual([false, true, false, true])
    expect(delMes([g], '2027-02-01', 'gasto', 'ARS')).toHaveLength(1)
  })
})

describe('excedente del mes, con los datos de hoy', () => {
  it('si declaraste que la empresa te reintegra el IVA, el IVA y la percepción de tus cuotas del mes vuelven al excedente (como en la proyección)', () => {
    const leasing = { id: 1, nombre: 'Leasing de prueba', pagador_habitual: 'titular' as const, reintegra_iva: true, tipo: 'leasing' as const, fecha_inicio: '2025-08-17', cuotas_totales: 48 }
    const todas = Array.from({ length: 48 }, (_, i) => cuota(i + 1, `${fechaMes('2025-08-01', i).slice(0, 7)}-17`))
    const sin = excedenteMes(baseChica({ pasivos: [{ ...leasing, reintegra_iva: null }], cuotas: todas }), '2026-10-01', { pagador_declarado: 'titular' })
    const con = excedenteMes(baseChica({ pasivos: [leasing], cuotas: todas }), '2026-10-01', { pagador_declarado: 'titular' })
    expect((con.excedente.ars.valor as Decimal).minus(sin.excedente.ars.valor as Decimal).toFixed()).toBe('259200')
    expect(con.excedente.ars.formula).toContain('(reintegro del IVA y la percepción)')
    expect((con.excedente.usd.valor as Decimal).toFixed(6)).toBe((con.excedente.ars.valor as Decimal).div(1500).toFixed(6))
  })

  it('ingreso en US$ × cripto de hoy + pesos − gastos − cuota (la pagás vos), con traza', () => {
    const b = baseChica({ cuotas: [cuota(15, '2026-10-17')] })
    const e = excedenteMes(b, '2026-10-01', { pagador_declarado: 'titular' })
    // 2.000 × 1.485 + 620.000 − 1.800.000 − 1.339.200 = 450.800
    expect(e.excedente.ars.valor?.toFixed()).toBe('450800')
    expect(e.excedente.usd.valor?.toFixed()).toBe(D(450800).div(1500).toFixed())
    expect(e.excedente.ars.formula).toContain('=')
    expect(e.ingreso_usd.ars.formula).toContain('cripto')
  })

  it('si la paga la empresa, la cuota no resta', () => {
    const b = baseChica({ cuotas: [cuota(15, '2026-10-17', { pagador: 'empresa' })] })
    expect(excedenteMes(b, '2026-10-01').excedente.ars.valor?.toFixed()).toBe('1790000')
  })

  it('sin cripto: el ingreso en dólares no se pasa a pesos (sin dato, nunca 0)', () => {
    const e = excedenteMes(baseChica({ cripto: null }), '2026-10-01')
    expect(e.excedente.ars.valor).toBeNull()
    expect(e.excedente.ars.motivo).toMatch(/cripto/)
  })

  it('sin declaraciones: sin dato · faltan tus ingresos y gastos', () => {
    const e = excedenteMes(baseChica({ recurrentes: [] }), '2026-10-01')
    expect(e.excedente.ars.valor).toBeNull()
    expect(e.excedente.ars.motivo).toMatch(/ingresos y gastos/)
  })

  it('sin ingreso declarado vigente, el ingreso del mes es sin dato (nunca 0), y el excedente también', () => {
    const e = excedenteMes(baseChica({ recurrentes: [R({ id: 3, sentido: 'gasto', moneda: 'ARS', monto: '1800000' })] }), '2026-10-01')
    expect(e.ingresos.ars.valor).toBeNull()
    expect(e.ingresos.ars.motivo).toContain('no declaraste tu ingreso')
    expect(e.excedente.ars.valor).toBeNull()
    const g = excedenteMes(baseChica({ recurrentes: [R({ id: 2, sentido: 'ingreso', moneda: 'ARS', monto: '100000' })] }), '2026-10-01')
    expect(g.gastos.ars.valor).toBeNull()
    expect(g.ingresos.ars.valor?.toFixed()).toBe('100000')
  })

  it('vigencias que cambian en feb-2027: enero con la vieja, febrero con la nueva', () => {
    const b = baseChica({
      recurrentes: [
        R({ id: 1, sentido: 'ingreso', moneda: 'ARS', monto: '560000', vigente_hasta: '2027-01-31' }),
        R({ id: 2, sentido: 'ingreso', moneda: 'ARS', monto: '650000', vigente_desde: '2027-02-01' }),
      ],
    })
    expect(excedenteMes(b, '2027-01-01').ingresos.ars.valor?.toFixed()).toBe('560000')
    expect(excedenteMes(b, '2027-02-01').ingresos.ars.valor?.toFixed()).toBe('650000')
  })
})

describe('proyección', () => {
  it('todo Igual (sin letras): CCL y precios quietos; el financiero cambia solo por lo invertido, exacto', () => {
    const b = baseChica()
    const p = proyectar(b, todoIgual(supuestosIniciales(b)))
    expect(p.estado).toBe('lista')
    expect(p.meses).toHaveLength(13)
    let previo = D('18000000')
    for (const m of p.meses) {
      expect(m.ccl).toBe('1500')
      const inv = D(m.pnl.aportes.ars as string)
      // Exacto salvo el polvo del último de los 40 dígitos de Decimal.
      expect(D(m.financiero.ars as string).minus(previo.plus(inv)).abs().lt('1e-20')).toBe(true)
      expect(D(m.pnl.activo.ars as string).abs().lt('1e-20')).toBe(true)
      expect(D(m.pnl.tc.ars as string).abs().lt('1e-20')).toBe(true)
      previo = D(m.financiero.ars as string)
    }
    // Excedente de un mes entero: 2.000 × 1.485 + 620.000 − 1.800.000 = 1.790.000
    expect(p.meses[3].excedente.ars).toBe('1790000')
  })

  it('devaluación 2%/mes: CCL_12 = CCL_0 × 1,02^12', () => {
    const b = baseChica()
    const s = todoIgual(supuestosIniciales(b))
    s.devaluacion[0] = { dir: 'sube', valor: '2', hasta_mes: null }
    const p = proyectar(b, s)
    expect(p.meses[12].ccl).toBe(D(1500).times(D('1.02').pow(12)).toFixed())
    expect(p.meses[12].etiquetas).toEqual(expect.arrayContaining(['supuesto', 'proyectado']))
  })

  it('PnL proyectado: aportes + activo + tc = Δ financiero, en pesos y en dólares, cada mes (d35)', () => {
    const b = baseChica()
    const s = todoIgual(supuestosIniciales(b), 24)
    s.devaluacion[0] = { dir: 'sube', valor: '1.5', hasta_mes: null }
    s.retorno.cedear = { dir: 'sube', valor: '9' }
    s.retorno.liquidez_pesos = { dir: 'sube', valor: '30' }
    const p = proyectar(b, s)
    let prevA = D('18000000')
    let prevU = D('12000')
    for (const m of p.meses) {
      for (const k of ['ars', 'usd'] as const) {
        const suma = D(m.pnl.aportes[k] as string).plus(m.pnl.activo[k] as string).plus(m.pnl.tc[k] as string)
        const delta = D(m.financiero[k] as string).minus(k === 'ars' ? prevA : prevU)
        expect(suma.minus(delta).abs().lt('1e-20'), `${m.mes} ${k}`).toBe(true)
      }
      prevA = D(m.financiero.ars as string)
      prevU = D(m.financiero.usd as string)
    }
  })

  it('una letra va a vencimiento: cobrás el pago contractual al centavo y deja de valer', () => {
    const b = baseChica({
      partidas: [
        partida({ clave: 'p:2:3', clase: 'lecap', moneda_riesgo: 'ARS', valor: { ars: '10852000', usd: D('10852000').div(1500).toFixed() }, ticker: 'S13N6', ley: 'cronograma', cantidad: '10000000', activo_id: 3, tem: temImplicitaValor(D('10852000'), [{ dias: 30, monto: D('11046000') }])!.toFixed(), fecha_vencimiento: '2026-11-13' }),
        partida({ clave: 'liq:ARS', clase: 'liquidez', moneda_riesgo: 'ARS', valor: { ars: '1000000', usd: D(1000000).div(1500).toFixed() } }),
      ],
      vencimientos: [{ activo_id: 3, clave: 'p:2:3', ticker: 'S13N6', fecha: '2026-11-13', monto_ars: '11046000', motivo: null, valor_hoy_ars: '10852000', es_ultimo: true, cantidad: '10000000', pago_por_vn: '1.1046' }],
    })
    const s = todoIgual(supuestosIniciales(b), 6, b)
    const p = proyectar(b, s)
    expect(p.estado).toBe('lista')
    expect(p.meses[1].vencimientos.ars).toBe('11046000')
    expect(p.meses[0].vencimientos.ars).toBe('0')
    // La TEM de renovación Igual es la de hoy: lo reinvertido sigue rindiendo.
    expect(D(p.meses[2].financiero.ars as string).gt(p.meses[1].financiero.ars as string)).toBe(true)
  })

  it('sin el pago al vencimiento de una letra: falta la TEM de renovación y no se inventa nada (la caja sí se proyecta)', () => {
    const b = baseChica({
      partidas: [partida({ clave: 'p:2:3', clase: 'lecap', moneda_riesgo: 'ARS', valor: { ars: '10852000', usd: '7234.67' }, ticker: 'S13N6', ley: 'sin_cronograma', fecha_vencimiento: '2026-11-13' })],
    })
    const p = proyectar(b, todoIgual(supuestosIniciales(b)))
    expect(p.faltan_parciales?.find((f) => f.variable === 'tem_renovacion')?.texto).toMatch(/pago al vencimiento/)
    // El texto dice todo lo que queda sin dato: también el patrimonio financiero (no solo el neto).
    expect(p.faltan_parciales?.find((f) => f.variable === 'tem_renovacion')?.texto).toMatch(/patrimonio financiero y el neto proyectados$/)
    for (const m of p.meses) {
      expect(m.financiero.ars).toBeNull()
      expect(m.financiero.usd).toBeNull()
    }
  })

  it('la cuota de la empresa no resta; una cuota con seguro supuesto marca el mes', () => {
    const b = baseChica({ cuotas: [cuota(15, '2026-11-17', { etiquetas: ['proyectado', 'supuesto'] }), cuota(16, '2026-12-17', { pagador: 'empresa' })] })
    const p = proyectar(b, todoIgual(supuestosIniciales(b)))
    expect(p.meses[1].cuota.ars).toBe('1339200')
    expect(p.meses[1].excedente.ars).toBe(D(1790000).minus(1339200).toFixed())
    expect(p.meses[1].etiquetas).toContain('supuesto')
    expect(p.meses[2].cuota.ars).toBe('0')
  })

  it('sin elegir la casa: el pie del panel dice qué falta y qué queda sin dato, no la clave interna', () => {
    const b = baseChica({ bienes: [{ id: 3, nombre: 'Casa', tipo: 'inmueble', moneda: 'USD', valor: '180000', pasivo_id: null }] })
    const s = supuestosIniciales(b)
    const { parciales } = faltantes(b, s)
    expect(parciales.map((f) => f.texto)).toEqual(['Casa: elegí Baja, Igual o Sube; sin eso, el patrimonio neto proyectado queda sin dato'])
    expect(faltantes(b, completarConIgual(s, b)).parciales).toEqual([])
  })

  it('sin la apertura de la cuota, el neto completo es sin dato con su motivo (la caja anda igual)', () => {
    const b = baseChica({
      cuotas: [cuota(15, '2026-11-17')],
      bienes: [{ id: 2, nombre: 'Camioneta', tipo: 'vehiculo', moneda: 'ARS', valor: '38000000', pasivo_id: 1 }],
      deudas: [{ pasivo_id: 1, ars: '21400000', origen: 'estimada' }],
    })
    const p = proyectar(b, todoIgual(supuestosIniciales(b)))
    expect(p.meses[0].neto_completo.ars).not.toBeNull()
    expect(p.meses[0].etiquetas).toContain('estimado')
    expect(p.meses[1].neto_completo.ars).toBeNull()
    expect(p.meses[1].motivos?.deuda_leasing).toMatch(/apertura de la cuota/)
    expect(p.meses[1].excedente.ars).not.toBeNull()
  })

  it('un excedente negativo sale de la liquidez en pesos; si no alcanza, el mes dice "no se cubre"', () => {
    // Ingresos $ 100.000 y gastos $ 1.900.000: el mes da − $ 1.800.000 (sin ingresos declarados no se proyecta).
    const b = baseChica({ recurrentes: [R({ id: 2, sentido: 'ingreso', moneda: 'ARS', monto: '100000' }), R({ id: 3, sentido: 'gasto', moneda: 'ARS', monto: '1900000' })] })
    const p = proyectar(b, todoIgual(supuestosIniciales(b)))
    // El mes de la carga ya resta los gastos (pasan a fin de mes): de $ 3.000.000 quedan $ 1.200.000.
    expect(p.meses[0].no_se_cubre).toBeNull()
    expect(p.meses[0].liquidez_pesos?.ars).toBe('1200000')
    expect(p.meses[1].pnl.aportes.ars).toBe('-1800000')
    expect(p.meses[1].no_se_cubre?.ars).toBe('600000')
    expect(p.meses[2].no_se_cubre?.ars).toBe('1800000')
  })

  it('sin ingresos o sin gastos declarados no se proyecta: lo no declarado no es cero', () => {
    const b = baseChica({ recurrentes: [R({ id: 3, sentido: 'gasto', moneda: 'ARS', monto: '1800000' })] })
    const p = proyectar(b, todoIgual(supuestosIniciales(b)))
    expect(p.estado).toBe('faltan')
    expect(p.meses).toEqual([])
    expect(p.faltan.map((f) => f.variable)).toContain('ingresos_declarados')
    const sinGastos = baseChica({ recurrentes: [R({ id: 2, sentido: 'ingreso', moneda: 'ARS', monto: '100000' })] })
    expect(proyectar(sinGastos, todoIgual(supuestosIniciales(sinGastos))).faltan.map((f) => f.variable)).toEqual(['gastos_declarados'])
  })

  it('lo que cargaste del mes reemplaza a lo declarado', () => {
    const b = baseChica({
      flujos_reales: [{ id: 1, fecha: '2026-11-28', sentido: 'ingreso', concepto: 'mensual', moneda: 'USD', monto: '2100', cuenta_id: 3, cripto_usado: '1490', pesos_recibidos: '3129000', anulado: false, carga_id: 9, notas: null }],
    })
    const p = proyectar(b, todoIgual(supuestosIniciales(b)))
    expect(p.meses[1].reales).toContain('ingresos')
    expect(p.meses[1].ingresos.ars).toBe(D(3129000).plus(620000).toFixed())
  })

  it('la traza de una cifra, a pedido, da el mismo número que la proyección', () => {
    const b = baseChica()
    const s = todoIgual(supuestosIniciales(b))
    s.devaluacion[0] = { dir: 'sube', valor: '2', hasta_mes: null }
    const p = proyectar(b, s)
    const t = trazaMes(b, s, p.meses[3].mes, 'excedente')
    expect(t.valor).toBe(p.meses[3].excedente.ars)
    expect(t.formula).toContain('=')
    expect(t.etiquetas).toContain('supuesto')
    const tu = trazaMes(b, s, p.meses[3].mes, 'financiero', 'USD')
    expect(new Decimal(tu.valor as string).minus(p.meses[3].financiero.usd as string).abs().lt('1e-20')).toBe(true)
  })

  it('120 meses se proyectan rápido (sin trazas)', () => {
    const b = baseChica({ cuotas: Array.from({ length: 40 }, (_, k) => cuota(k + 1, `${2026 + Math.floor((k + 10) / 12)}-${String(((k + 10) % 12) + 1).padStart(2, '0')}-17`)) })
    const s = todoIgual(supuestosIniciales(b), 120)
    s.devaluacion[0] = { dir: 'sube', valor: '2', hasta_mes: null }
    s.retorno.cedear = { dir: 'sube', valor: '10' }
    proyectar(b, s)
    const t0 = performance.now()
    for (let i = 0; i < 5; i++) {
      s.devaluacion[0].valor = String(1 + i / 10)
      proyectar(b, s)
    }
    expect((performance.now() - t0) / 5).toBeLessThan(150)
  })

  it('nombreMes', () => {
    expect(nombreMes('2027-02-01')).toBe('feb-27')
  })
})

describe('real contra proyectado', () => {
  it('ingreso cargado contra lo declarado; los gastos reales son sin dato salvo los cargados', () => {
    const b = baseChica({
      flujos_reales: [{ id: 1, fecha: '2026-10-30', sentido: 'ingreso', concepto: 'mensual', moneda: 'ARS', monto: '3600000', cuenta_id: null, cripto_usado: null, pesos_recibidos: null, anulado: false, carga_id: 3, notas: null }],
      historia_tc: [{ fecha: '2026-10-14', ccl: '1500', cripto: '1485' }],
    })
    const filas = desvioMes(b, '2026-10-01')
    const ing = filas.find((f) => f.linea === 'ingresos')!
    // Proyectado: 2.000 × 1.485 + 620.000 = 3.590.000; real 3.600.000.
    expect(ing.proyectado.ars.valor?.toFixed()).toBe('3590000')
    expect(ing.real.ars.valor?.toFixed()).toBe('3600000')
    expect(ing.desvio.ars.valor?.toFixed()).toBe('10000')
    const gas = filas.find((f) => f.linea === 'gastos')!
    expect(gas.real.ars.valor).toBeNull()
    expect(gas.desvio.ars.valor).toBeNull()
  })
})

describe('piezas', () => {
  it('cuotaBase: total = canon + IVA + seguro + percepción, con sus chips; sin apertura, amortización null', () => {
    const c = cuotaBase({
      pasivo_id: 1, nro: 20, fecha_vencimiento: '2027-04-17', periodo: null, canon_neto: D(1000000), iva_canon: D(226800), seguro: D(80000), otros_conceptos: D(32400),
      estado: 'proyectada', fuente_canon: 'contrato', fuente_seguro: 'supuesto', fuente_otros: 'a_confirmar', pagada: false, fecha_pago: null, monto_pagado: null,
      cuenta_pago_id: null, ccl_del_dia_pago: null, ccl_fuente: null, pagador: null, carga_id: 1, notas: null,
    }, { pagador_habitual: 'titular' })
    expect(c.total).toBe('1339200')
    expect(c.iva_y_percepcion).toBe('259200')
    expect(c.amortizacion).toBeNull()
    expect(c.pagador).toBe('titular')
    expect(c.etiquetas).toEqual(['supuesto', 'a_confirmar', 'proyectado'])
  })

  it('TEM implícita de un solo pago', () => {
    const t = temImplicitaValor(D(100), [{ dias: 30, monto: D(102) }])!
    expect(t.toFixed(10)).toBe('0.0200000000')
    const t2 = temImplicitaValor(D(100), [{ dias: 30, monto: D(1) }, { dias: 60, monto: D(101) }])!
    expect(t2.toFixed(6)).toBe('0.010000')
  })

  it('control del cripto (D-37): pesos ≈ US$ × cripto con la precisión tipeada', () => {
    expect(controlCripto('3100', '1541.20', '4777720').ok).toBe(true)
    expect(controlCripto('100', '1541.2', '154124').ok).toBe(true)
    expect(controlCripto('3100', '1541.20', '4700000').ok).toBe(false)
    expect(controlCripto('3100', '1541.20', '4700000').efectivo).toBe(D(4700000).div(3100).toFixed())
  })
})

// ───────────── Revisión (15/10): lo que faltaba probar ─────────────

describe('sin cuadro de marcha, la cuota del leasing no es $ 0', () => {
  it('los meses sin su cuota de un cuadro incompleto (para Evolución); sin cuadro o completo, ninguno', () => {
    const contrato = { fecha_inicio: '2026-01-01', cuotas_totales: 3 }
    expect(mesesSinCuota(contrato, [])).toEqual([])
    expect(mesesSinCuota(contrato, ['2026-02-01', '2026-03-01', '2026-04-01'])).toEqual([])
    // Falta la de marzo: marzo, y también enero (el plazo va del mes de inicio al de inicio + 3, de más, nunca de menos).
    expect(mesesSinCuota(contrato, ['2026-02-01', '2026-04-01'])).toEqual(['2026-01-01', '2026-03-01'])
  })

  const leasing = { id: 1, nombre: 'Leasing de prueba', pagador_habitual: null, reintegra_iva: null, tipo: 'leasing' as const, fecha_inicio: '2025-08-17', cuotas_totales: 48 }

  it('el excedente del mes es sin dato con el motivo, en pesos y en dólares', () => {
    const b = baseChica({ pasivos: [leasing] })
    const m = excedenteMes(b, '2026-10-01', { pagador_declarado: 'titular' })
    expect(m.cuota.ars.valor).toBeNull()
    expect(m.cuota.ars.motivo).toMatch(/cuadro de marcha/)
    expect(m.cuota.usd.valor).toBeNull()
    expect(m.excedente.ars.valor).toBeNull()
    expect(m.excedente.usd.valor).toBeNull()
    expect(m.excedente.ars.motivo).toMatch(/cuadro de marcha/)
    // Lo que no depende de la cuota sigue con su número.
    expect(m.ingresos.ars.valor?.toFixed()).toBe(D(2000).times(1485).plus(620000).toFixed())
  })

  it('si la paga la empresa no hace falta el cuadro; terminado el plazo, tampoco', () => {
    const empresa = baseChica({ pasivos: [{ ...leasing, pagador_habitual: 'empresa' }] })
    expect(excedenteMes(empresa, '2026-10-01', { pagador_declarado: 'titular' }).cuota.ars.valor?.toFixed()).toBe('0')
    const b = baseChica({ pasivos: [leasing] })
    expect(excedenteMes(b, '2029-10-01', { pagador_declarado: 'titular' }).cuota.ars.valor?.toFixed()).toBe('0')
  })

  it('con el cuadro completo manda el cuadro (un mes sin cuota es $ 0 de verdad)', () => {
    const todas = Array.from({ length: 48 }, (_, i) => cuota(i + 1, `${fechaMes('2025-08-01', i).slice(0, 7)}-17`))
    const b = baseChica({ pasivos: [leasing], cuotas: todas })
    expect(excedenteMes(b, '2026-10-01', { pagador_declarado: 'titular' }).cuota.ars.valor?.toFixed()).toBe('1339200')
    // El mes de margen del plazo, sin cuota en el cuadro completo: no se paga.
    expect(excedenteMes(b, '2029-08-01', { pagador_declarado: 'titular' }).cuota.ars.valor?.toFixed()).toBe('0')
  })

  it('con el cuadro incompleto (por ejemplo, después de deshacer una planilla), el mes que no tiene su cuota es sin dato, nunca $ 0', () => {
    const b = baseChica({ pasivos: [leasing], cuotas: [cuota(15, '2026-11-17')] })
    const oct = excedenteMes(b, '2026-10-01', { pagador_declarado: 'titular' })
    expect(oct.cuota.ars.valor).toBeNull()
    expect(oct.cuota.ars.motivo).toMatch(/tiene 1 de 48 cuotas/)
    expect(excedenteMes(b, '2026-11-01', { pagador_declarado: 'titular' }).cuota.ars.valor?.toFixed()).toBe('1339200')
  })

  it('la proyección no inventa la cuota: pide el cuadro, salvo que elijas que la paga la empresa', () => {
    const b = baseChica({ pasivos: [leasing] })
    const s = todoIgual(supuestosIniciales(b), 12, b)
    const p = proyectar(b, s)
    expect(p.estado).toBe('faltan')
    expect(p.faltan.find((f) => f.variable === 'cuadro_leasing')?.texto).toMatch(/cuadro de marcha/)
    expect(proyectar(b, { ...s, pagador_cuota: { quien: 'empresa', desde_mes: null } }).estado).toBe('lista')
  })
})

describe('sin el pago al vencimiento de una letra, la caja se proyecta igual', () => {
  it('corre: el excedente tiene número; el vencimiento y el financiero, sin dato con el nombre de la letra', () => {
    const b = baseChica({
      partidas: [
        partida({ clave: 'p:1:1', clase: 'cedear', moneda_riesgo: 'USD', valor: { ars: '15000000', usd: '10000' }, ticker: 'SPY' }),
        partida({ clave: 'p:2:3', clase: 'lecap', moneda_riesgo: 'ARS', valor: { ars: '10852000', usd: '7234.67' }, ticker: 'S13N6', ley: 'sin_cronograma', fecha_vencimiento: '2026-11-13', activo_id: 3 }),
        partida({ clave: 'liq:ARS', clase: 'liquidez', moneda_riesgo: 'ARS', valor: { ars: '3000000', usd: '2000' } }),
      ],
    })
    const p = proyectar(b, todoIgual(supuestosIniciales(b), 12, b))
    expect(p.estado).toBe('lista')
    expect(p.faltan_parciales?.map((f) => f.variable)).toContain('tem_renovacion')
    expect(p.meses[1].excedente.ars).toBe(D(1790000).toFixed())
    expect(p.meses[1].vencimientos.ars).toBeNull()
    expect(p.meses[1].financiero.ars).toBeNull()
    expect(p.meses[1].motivos?.financiero).toMatch(/S13N6/)
  })
})

describe('cobertura de la cuota: nunca una conclusión sacada de lo que no se sabe', () => {
  const cuotas = Array.from({ length: 30 }, (_, k) => cuota(15 + k, `${2026 + Math.floor((10 + k) / 12)}-${String(((10 + k) % 12) + 1).padStart(2, '0')}-17`))

  it('con menos de 13 meses de horizonte no se puede medir, y lo dice', () => {
    const b = baseChica({ cuotas })
    const p = proyectar(b, todoIgual(supuestosIniciales(b), 6, b))
    expect(p.cobertura?.texto).toMatch(/13 meses/)
    expect(p.cobertura?.texto).not.toMatch(/no alcanza/)
  })

  it('si el resultado de los meses es sin dato, la cobertura también', () => {
    const b = baseChica({
      cuotas,
      partidas: [partida({ clave: 'p:2:3', clase: 'lecap', moneda_riesgo: 'ARS', valor: { ars: '10852000', usd: '7234.67' }, ticker: 'S13N6', ley: 'sin_cronograma', fecha_vencimiento: '2026-11-13' })],
    })
    const p = proyectar(b, todoIgual(supuestosIniciales(b), 24, b))
    expect(p.estado).toBe('lista')
    expect(p.cobertura?.texto).toMatch(/^Sin dato/)
    expect(p.cobertura?.texto).not.toMatch(/no alcanza/)
  })

  it('si la cuota la paga la empresa, no hay nada que cubrir', () => {
    const b = baseChica({ cuotas: cuotas.map((c) => ({ ...c, pagador: 'empresa' as const })) })
    expect(proyectar(b, todoIgual(supuestosIniciales(b), 24, b)).cobertura).toBeNull()
  })

  it('con todo conocido y 24 meses, "no alcanza antes del horizonte" es un resultado válido', () => {
    const b = baseChica({ cuotas })
    expect(proyectar(b, todoIgual(supuestosIniciales(b), 24, b)).cobertura?.texto).toMatch(/no alcanza la cuota antes del horizonte/)
  })
})

describe('real contra proyectado: nada × 0', () => {
  it('un cobro en dólares sin el CCL de su día es sin dato, no $ 0', () => {
    const b = baseChica({ cobros_reales: [{ fecha: '2026-10-10', ticker: 'GD30', ars: null }] })
    const v = desvioMes(b, '2026-10-01').find((f) => f.linea === 'vencimientos')
    expect(v?.real.ars.valor).toBeNull()
    expect(v?.real.ars.motivo).toMatch(/CCL/)
  })

  it('sin CCL, un gasto o un ingreso en dólares cargado no se pasa a pesos × 0', () => {
    const b = baseChica({
      ccl: null,
      flujos_reales: [
        { id: 1, fecha: '2026-10-05', sentido: 'gasto', concepto: 'mensual', moneda: 'USD', monto: '300', cuenta_id: null, cripto_usado: null, pesos_recibidos: null, anulado: false, carga_id: 9, notas: null },
        { id: 2, fecha: '2026-10-06', sentido: 'ingreso', concepto: 'mensual', moneda: 'USD', monto: '2000', cuenta_id: null, cripto_usado: null, pesos_recibidos: null, anulado: false, carga_id: 9, notas: null },
        { id: 3, fecha: '2026-10-07', sentido: 'ingreso', concepto: 'extraordinario', moneda: 'USD', monto: '500', cuenta_id: null, cripto_usado: null, pesos_recibidos: null, anulado: false, carga_id: 9, notas: null },
      ],
    })
    const filas = desvioMes(b, '2026-10-01')
    for (const l of ['gastos', 'ingresos', 'extraordinarios'] as const) expect(filas.find((f) => f.linea === l)?.real.ars.valor, l).toBeNull()
  })

  it('lo proyectado de los gastos incluye los declarados en dólares (al CCL del mes)', () => {
    const b = baseChica({ recurrentes: [...baseChica().recurrentes, R({ id: 4, sentido: 'gasto', moneda: 'USD', monto: '100' })] })
    const g = desvioMes(b, '2026-10-01').find((f) => f.linea === 'gastos')
    expect(g?.proyectado.ars.valor?.toFixed()).toBe(D(1800000).plus(D(100).times(1500)).toFixed())
  })
})

describe('real contra proyectado sin cuadro de marcha', () => {
  it('la línea de la cuota aparece, sin dato, en vez de faltar', () => {
    const b = baseChica({ pasivos: [{ id: 1, nombre: 'Leasing de prueba', pagador_habitual: null, reintegra_iva: null, tipo: 'leasing', fecha_inicio: '2025-08-17', cuotas_totales: 48 }] })
    const c = desvioMes(b, '2026-10-01', { pagador_declarado: 'titular' }).find((f) => f.linea === 'cuota')
    expect(c?.proyectado.ars.valor).toBeNull()
    expect(c?.proyectado.ars.motivo).toMatch(/cuadro de marcha/)
  })
})
