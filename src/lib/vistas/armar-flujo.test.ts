import { describe, expect, it } from 'vitest'
import type { CalcVista } from '@/lib/domain/calc'
import { proyectar } from '@/lib/domain/flujo/proyeccion'
import { completarConIgual } from '@/lib/domain/flujo/supuestos'
import { Decimal } from '@/lib/domain/dinero'
import { armarBase, armarFlujo, movimientosDeDatos, resumenParaHoy } from './armar-flujo'
import { datosEjemplo, ejemploFlujo } from './ejemplo-flujo'
import { HOY_EJEMPLO } from './ejemplo'

// El demo pasa por el mismo armador que los datos reales: estos tests son del
// armador y, a la vez, del demo (números inventados, D-24).

const esCalc = (x: unknown): x is CalcVista => typeof x === 'object' && x !== null && 'formula' in x && 'etiquetas' in x && 'insumos' in x

/** Recorre la vista: todo par tiene las dos monedas con fórmula, y todo "sin dato" tiene su motivo. */
function revisar(x: unknown, ruta: string, problemas: string[]) {
  if (Array.isArray(x)) return x.forEach((y, i) => revisar(y, `${ruta}[${i}]`, problemas))
  if (typeof x !== 'object' || x === null) return
  const o = x as Record<string, unknown>
  if ('ars' in o && 'usd' in o && (esCalc(o.ars) || esCalc(o.usd))) {
    if (!esCalc(o.ars) || !esCalc(o.usd)) problemas.push(`${ruta}: un par sin una de sus monedas`)
  }
  if (esCalc(o)) {
    if (!o.formula) problemas.push(`${ruta}: sin fórmula`)
    if (o.valor === null && !o.motivo) problemas.push(`${ruta}: sin dato sin motivo`)
    return
  }
  if (ruta.endsWith('.base')) return
  for (const [k, v] of Object.entries(o)) revisar(v, `${ruta}.${k}`, problemas)
}

describe('vista de Flujo (demo)', () => {
  it('completo: toda cifra en las dos monedas, con su traza, y todo sin dato con su motivo', () => {
    const v = ejemploFlujo('completo')
    const problemas: string[] = []
    revisar(v, 'vista', problemas)
    expect(problemas).toEqual([])
    expect(v.base).not.toBeNull()
    expect(v.calendario).toHaveLength(12)
  })

  it('completo: el excedente del mes cuadra a mano (inventado)', () => {
    const v = ejemploFlujo('completo')
    // oct-26: US$ 3.800 × cripto 1.541,00 + $ 850.000 − $ 2.450.000 − cuota 14 ($ 1.339.200, la pagás vos según tu regla) = $ 2.916.600
    expect(v.mes_actual?.excedente.ars.valor).toBe('2916600')
    expect(v.mes_actual?.cuotas.map((c) => [c.nro, c.quien])).toEqual([[14, 'titular']])
    expect(v.mes_actual?.partes.some((p) => p.calc !== null)).toBe(true)
  })

  it('completo: el calendario trae ingresos, gastos, cuotas con sus chips y el vencimiento de S13N6 al centavo', () => {
    const v = ejemploFlujo('completo')
    const nov = v.calendario.find((m) => m.mes === '2026-11-01')!
    expect(nov.filas.map((f) => f.tipo)).toEqual(expect.arrayContaining(['ingreso', 'gasto', 'cuota', 'vencimiento']))
    const cuota = nov.filas.find((f) => f.tipo === 'cuota')!
    expect(cuota.chips).toEqual(expect.arrayContaining(['proyectado', 'supuesto', 'a_confirmar']))
    const s13 = nov.filas.find((f) => f.nombre.includes('S13N6'))!
    // 11.500.000 VN × $ 1,1046 = $ 12.702.900
    expect(s13.valor.ars.valor).toBe('12702900')
  })

  it('completo: con "Completar con Igual" y un horizonte, la proyección corre y da números', () => {
    const v = ejemploFlujo('completo')
    const s = completarConIgual(v.supuestos_iniciales, v.base!)
    s.horizonte_meses = 24
    const p = proyectar(v.base!, s)
    expect(p.estado).toBe('lista')
    expect(p.meses).toHaveLength(25)
    expect(p.meses[1].financiero.ars).not.toBeNull()
    expect(p.meses[1].vencimientos.ars).toBe('12702900')
    // Sin la apertura de la cuota (llega con Pasivos), el neto completo es sin dato desde la primera cuota.
    expect(p.meses[1].neto_completo.ars).toBeNull()
  })

  it('parcial: sin cripto ni pago al vencimiento, dice qué falta y no inventa', () => {
    const v = ejemploFlujo('parcial')
    expect(v.base?.cripto).toBeNull()
    expect(v.mes_actual?.excedente.ars.valor).toBeNull()
    expect(v.mes_actual?.excedente.ars.motivo).toMatch(/cripto/)
    expect(v.faltan_datos.map((f) => f.texto).join(' ')).toMatch(/S13N6/)
    const nov = v.calendario.find((m) => m.mes === '2026-11-01')!
    const s13 = nov.filas.find((f) => f.nombre.includes('S13N6'))!
    expect(s13.valor.ars.valor).toBeNull()
    expect(s13.cargar_pago).toEqual({ activo_id: 3, ticker: 'S13N6' })
    const p = proyectar(v.base!, completarConIgual(v.supuestos_iniciales, v.base!))
    expect(p.estado).toBe('faltan')
    expect(p.meses).toEqual([])
  })

  it('sin ingresos: el calendario de cuotas y vencimientos igual, y el excedente "faltan tus ingresos y gastos"', () => {
    const v = ejemploFlujo('sin-ingresos')
    expect(v.mes_actual?.sin_declaraciones).toBe(true)
    expect(v.mes_actual?.excedente.ars.motivo).toMatch(/ingresos y gastos/)
    expect(v.calendario.flatMap((m) => m.filas).some((f) => f.tipo === 'cuota')).toBe(true)
  })

  it('vacío: sin cargas, sin base', () => {
    const v = ejemploFlujo('vacio')
    expect(v.base).toBeNull()
    expect(v.faltan_datos[0].texto).toMatch(/Todavía no hay cargas/)
  })

  it('comparar: los escenarios guardados se leen y se proyectan', () => {
    const v = ejemploFlujo('comparar')
    expect(v.escenarios.map((e) => e.nombre)).toEqual(['Todo igual', 'Dólar arriba', 'Ingreso baja en feb-27'])
    for (const e of v.escenarios) expect(proyectar(v.base!, e.supuestos!).estado).toBe('lista')
  })

  it('ningún texto compara escenarios ni recomienda (D-07)', () => {
    const texto = JSON.stringify(ejemploFlujo('comparar'))
    expect(texto).not.toMatch(/\b(mejor|conviene|deber[ií]as)\b/i)
  })
})

describe('para Hoy (integración)', () => {
  it('el excedente del mes y lo que vence en los próximos días', () => {
    const v = ejemploFlujo('completo')
    const r = resumenParaHoy(v)!
    expect(r.mes).toBe('octubre') // en medio de la frase de Hoy: "Excedente de octubre"
    expect(r.excedente).toEqual(v.mes_actual!.excedente)
    expect(r.vencimientos).toEqual([]) // S13N6 vence el 13/11: faltan más de 10 días
    expect(resumenParaHoy(v, 30)!.vencimientos.map((x) => x.ticker)).toEqual(['S13N6'])
    expect(resumenParaHoy(ejemploFlujo('vacio'))).toBeNull()
  })
})

describe('vencimientos de un bono con el pago "a determinar"', () => {
  it('el dual sin interés cierto: el pago es sin dato con su motivo, y el bono va por su propia variable', () => {
    const { h, d } = datosEjemplo('completo')
    // TXMJ0 (inventado): el pago al vencimiento depende de la tasa; el interés es "a determinar" (null).
    d.flujos_bono.push({ activo_id: 6, fecha: '2030-06-28', interes: null, amortizacion: new Decimal(1), fuente: 'prospecto (ejemplo)' })
    const base = armarBase(h, d, HOY_EJEMPLO)!
    const v = base.vencimientos.find((x) => x.ticker === 'TXMJ0')!
    expect(v.monto_ars).toBeNull()
    expect(v.motivo).toContain('a determinar')
    expect(base.partidas.find((p) => p.ticker === 'TXMJ0')?.ley).toBe('propia')
  })
})

describe('movimientos de Datos para el aviso de doble carga', () => {
  it('trae los aportes y retiros recientes, sin transferencias ni los que creó Cargar ingreso', () => {
    const { h, d } = datosEjemplo('completo')
    const base = { tipo: 'aporte' as const, fecha_acreditacion: null, cuenta_origen_id: null, cuenta_destino_id: 1, moneda_origen: 'USD' as const, monto_origen: new Decimal(3800), moneda_destino: 'USD' as const, monto_destino: new Decimal(3800), tc_aplicado: null, impuesto: new Decimal(0), notas: null }
    h.movimientos.push({ ...base, id: 801, fecha: '2026-10-15', carga_id: 7001 })
    h.movimientos.push({ ...base, id: 802, fecha: '2026-10-15', carga_id: 7002, tipo: 'transferencia', cuenta_origen_id: 2 })
    h.movimientos.push({ ...base, id: 803, fecha: '2026-06-01', carga_id: 7003 })
    h.movimientos.push({ ...base, id: 804, fecha: '2026-10-15', carga_id: 7004 })
    d.flujos.push({ id: 1, fecha: '2026-10-15', sentido: 'ingreso', concepto: 'mensual', moneda: 'USD', monto: '3800', cuenta_id: 1, cripto_usado: null, pesos_recibidos: null, anulado: false, carga_id: 7004, notas: null, lote: null, revertida: false, creado_en: null })
    const m = movimientosDeDatos(h, d, HOY_EJEMPLO)
    const nuevos = m.filter((x) => x.fecha === '2026-10-15' && x.cuenta_id === 1)
    expect(nuevos).toEqual([{ fecha: '2026-10-15', tipo: 'aporte', cuenta_id: 1, montos: [{ moneda: 'USD', monto: '3800' }, { moneda: 'USD', monto: '3800' }] }])
    expect(m.some((x) => x.fecha === '2026-06-01')).toBe(false)
  })
})

// ───────────── Revisión (15/10): como está producción hoy ─────────────

describe('como producción hoy: un leasing sin cuadro de marcha, letras sin cronograma, deuda estimada', () => {
  function produccion() {
    const { h, d } = datosEjemplo('completo')
    d.leasing.cuotas = []
    d.flujos_bono = []
    for (const s of h.pasivo_saldos) {
      s.naturaleza = 'estimado'
      s.fuente = 'estimado de prueba'
    }
    return { h, d }
  }

  it('la cuota del mes no es $ 0: la frase la nombra sin dato y el excedente es sin dato con el motivo', () => {
    const { h, d } = produccion()
    const v = armarFlujo(h, d, HOY_EJEMPLO)
    expect(v.mes_actual?.cuota.ars.valor).toBeNull()
    expect(v.mes_actual?.excedente.ars.valor).toBeNull()
    expect(v.mes_actual?.excedente.usd.valor).toBeNull()
    expect(v.mes_actual?.excedente.ars.motivo).toMatch(/cuadro de marcha/)
    const frase = v.mes_actual?.partes.map((p) => p.texto).join('') ?? ''
    expect(frase).toMatch(/cuota del leasing/)
    expect(frase).toMatch(/sin dato/)
    // El excedente sin dato se dice una vez, con su motivo (no "sin dato (sin dato)").
    expect(frase).not.toMatch(/sin dato \(sin dato\)/)
    expect(frase).toMatch(/Excedente invertible: sin dato · Falta el cuadro de marcha/)
    const problemas: string[] = []
    revisar(v, 'vista', problemas)
    expect(problemas).toEqual([])
  })

  it('el calendario muestra la cuota de cada mes del plazo como sin dato (y el neto también), nunca la omite', () => {
    const { h, d } = produccion()
    const v = armarFlujo(h, d, HOY_EJEMPLO)
    for (const m of v.calendario) {
      const c = m.filas.find((f) => f.tipo === 'cuota')
      expect(c, m.mes).toBeDefined()
      expect(c?.valor.ars.valor).toBeNull()
      expect(m.neto.ars.valor).toBeNull()
    }
  })

  it('"Faltan datos" nombra el cuadro de marcha, con su botón a Datos › Leasing (no solo las letras)', () => {
    const { h, d } = produccion()
    const v = armarFlujo(h, d, HOY_EJEMPLO)
    const cuadro = v.faltan_datos.find((f) => f.href === '/datos/leasing#cuadro-de-marcha')
    expect(cuadro?.texto).toMatch(/^Falta el cuadro de marcha de .+: sin él, la cuota de cada mes queda sin dato/)
    expect(cuadro?.etiqueta).toBe('Importar el cuadro de marcha')
    // Con el cuadro importado, no se pide.
    const conCuadro = datosEjemplo('completo')
    expect(armarFlujo(conCuadro.h, conCuadro.d, HOY_EJEMPLO).faltan_datos.some((f) => f.href?.startsWith('/datos/leasing'))).toBe(false)
  })

  it('un cobro en dólares sin el CCL de su día queda sin dato en la base (no × 0)', () => {
    const { h, d } = produccion()
    h.operaciones.push({ id: 999, fecha: '2026-10-09', fecha_origen: null, cuenta_id: 1, activo_id: 1, tipo: 'renta', cantidad: new Decimal(1), moneda: 'USD', precio: null, importe: new Decimal(25), comisiones: new Decimal(0), ccl_del_dia: null, carga_id: 1, notas: null })
    const b = armarBase(h, d, HOY_EJEMPLO)
    expect(b?.cobros_reales?.find((c) => c.fecha === '2026-10-09')?.ars).toBeNull()
  })
})

describe('el excedente del mes lleva las etiquetas de lo que suma', () => {
  it('con una cuota proyectada con seguro supuesto, el excedente del mes las trae (el chip las muestra)', () => {
    const v = ejemploFlujo('completo')
    expect(v.mes_actual?.excedente.ars.etiquetas).toEqual(expect.arrayContaining(['supuesto']))
    expect(v.mes_actual?.excedente.usd.etiquetas).toEqual(expect.arrayContaining(['supuesto']))
  })
})

describe('el demo no comparte estado entre usos', () => {
  it('tocar los datos de un uso no cambia los del siguiente (DEMO_VACIO queda vacío)', () => {
    const a = datosEjemplo('completo')
    a.d.flujos.push({ id: 1, fecha: '2026-10-15', sentido: 'ingreso', concepto: 'mensual', moneda: 'USD', monto: '1', cuenta_id: null, cripto_usado: null, pesos_recibidos: null, anulado: false, carga_id: 1, notas: null, lote: null, revertida: false, creado_en: null })
    a.d.recordados.x = '1'
    const b = datosEjemplo('completo')
    expect(b.d.flujos).toEqual([])
    expect(b.d.recordados).toEqual({})
  })
})
