import { describe, expect, it } from 'vitest'
import { ejemploFlujo } from '@/lib/vistas/ejemplo-flujo'
import { controlCripto, avisoCripto, posibleDobleCarga } from './control'
import { leerNumeroAR } from '../dinero'
import { pagoUnico, vistaPreviaPago } from './pago'
import {
  acotarHorizonte,
  agregarTramo,
  atajosHorizonte,
  claveDeRuta,
  claveRecordada,
  conAjuste,
  conVar,
  diferenciaConLoPuesto,
  diferencias,
  esTodoIgual,
  extremosBarra,
  fraccionBarra,
  leerPosicion,
  leerVar,
  limitesBarra,
  mesesHastaFinLeasing,
  nombreVariable,
  pasoBarra,
  pasoDeslizante,
  posicionDe,
  recordadosDe,
  recordadosDeRuta,
  resumenHorizonte,
  rutasDelPanel,
  sacarTramo,
  sentidoPosicion,
  sinIgualPosible,
  textoDeslizante,
  textoIgual,
  textoPosicion,
  todoIgualDe,
  valorDeslizante,
  varDePosicion,
} from './panel'
import { proyectar } from './proyeccion'
import { completarConIgual, conArranque, HORIZONTE_ARRANQUE, supuestosDeArranque, supuestosVacios } from './supuestos'

// Todo inventado: la base es la del demo (ejemplo-flujo.ts).
const vista = ejemploFlujo('completo')
const base = vista.base!

describe('panel de supuestos', () => {
  it('rutas: leer y cambiar una variable devuelve una copia y no toca el resto', () => {
    const s = vista.supuestos_iniciales
    expect(claveDeRuta('devaluacion.0')).toBe('devaluacion')
    expect(claveDeRuta('retorno.cedear')).toBe('retorno.cedear')
    expect(claveDeRuta('dual.TXMJ0')).toBe('dual.TXMJ0')
    expect(claveDeRuta('ingreso_usd.1')).toBe('ingreso_usd')
    const n = conVar(s, 'ingreso_usd.1', { dir: 'baja', valor: '20.0' })
    expect(leerVar(n, 'ingreso_usd.1')).toMatchObject({ dir: 'baja', valor: '20.0', desde_mes: 4 })
    expect(leerVar(s, 'ingreso_usd.1')).toMatchObject({ dir: null, valor: null })
    expect(leerVar(n, 'ingreso_usd.0')).toEqual(leerVar(s, 'ingreso_usd.0'))
    expect(leerVar(s, 'devaluacion.5')).toBeNull()
  })

  it('las claves de lo recordado: minúsculas, sin el tramo', () => {
    expect(claveRecordada('retorno.cedear', 'sube')).toBe('retorno.cedear.sube')
    expect(claveRecordada('dual.TXMJ0', 'baja')).toBe('dual.txmj0.baja')
    expect(claveRecordada('dual.TXMJ0', 'baja')).toMatch(/^[a-z][a-z0-9_.]{0,79}$/)
  })

  it('el deslizante va de a 0,1 entre 0 y el máximo, sin errores de coma flotante', () => {
    expect(pasoDeslizante(null, 0.1, 15)).toBe('0.1')
    expect(pasoDeslizante('0.2', 0.1, 15)).toBe('0.3')
    expect(pasoDeslizante('14.95', 0.1, 15)).toBe('15.0')
    expect(pasoDeslizante('0.0', -0.1, 15)).toBe('0.0')
    expect(valorDeslizante('2.0000000001', 15)).toBe('2.0')
    expect(valorDeslizante('99', 15)).toBe('15.0')
    expect(valorDeslizante('abc', 15)).toBeNull()
  })

  it('el texto exacto de "Igual", con los datos de tu última carga', () => {
    expect(textoIgual('devaluacion.0', base)).toBe('el CCL queda en el de tu última carga ($ 1.548,20)')
    expect(textoIgual('brecha_cripto', base)).toBe('la de hoy: cripto $ 1.541,00 contra CCL $ 1.548,20 (−0,47 pts)')
    expect(textoIgual('ingreso_usd.1', base)).toBe('lo declarado en ese tramo (hoy US$ 3.800,00 por mes)')
    expect(textoIgual('retorno.cedear', base)).toBe('precio quieto: 0%/año')
    expect(textoIgual('tem_renovacion', base)).toMatch(/^la TEM implícita de hoy de tus letras, ponderada por valor \(\d+,\d{2}% por mes\)$/)
    const sinCripto = ejemploFlujo('parcial').base!
    expect(textoIgual('brecha_cripto', sinCripto)).toContain('sin dato')
  })

  it('el panel muestra solo las variables que esta base usa', () => {
    const g = rutasDelPanel(base, vista.supuestos_iniciales)
    const todas = g.flatMap((x) => x.rutas)
    expect(todas).toContain('devaluacion.0')
    expect(todas).toContain('ingreso_usd.1')
    expect(todas).toContain('retorno.cedear')
    expect(todas).not.toContain('inflacion.0') // solo con gastos atados a la inflación
    const atados = rutasDelPanel(base, { ...vista.supuestos_iniciales, gastos: { ...vista.supuestos_iniciales.gastos, atado_inflacion: true } }).flatMap((x) => x.rutas)
    expect(atados).toContain('inflacion.0')
  })

  it('tramos: el ingreso suma uno "desde el mes N"; la devaluación, "hasta"; sacar uno deja todo contiguo', () => {
    const s = supuestosVacios()
    const a = agregarTramo(s, 'ingreso_usd', 7)
    expect(a.ingreso_usd.map((t) => t.desde_mes)).toEqual([1, 7])
    expect(agregarTramo(a, 'ingreso_usd', 7).ingreso_usd).toHaveLength(2)
    const d = agregarTramo(agregarTramo(s, 'devaluacion', 7), 'devaluacion', 13)
    expect(d.devaluacion.map((t) => t.hasta_mes)).toEqual([6, 12, null])
    expect(sacarTramo(d, 'devaluacion', 1).devaluacion.map((t) => t.hasta_mes)).toEqual([12, null])
    expect(sacarTramo(d, 'devaluacion', 2).devaluacion.map((t) => t.hasta_mes)).toEqual([6, null])
    expect(sacarTramo(d, 'devaluacion', 0).devaluacion).toHaveLength(3)
    expect(nombreVariable('ingreso_usd.1', vista.supuestos_iniciales, base)).toBe('Ingreso en dólares · desde feb-27')
    expect(nombreVariable('devaluacion.1', d, base)).toBe('Devaluación (CCL) · desde may-27 hasta oct-27')
  })

  it('atajos del horizonte: 6, 12, 24 y el fin del leasing; el escenario arranca en 12 (D-164)', () => {
    expect(vista.supuestos_iniciales.horizonte_meses).toBeNull()
    expect(supuestosDeArranque(base).horizonte_meses).toBe(HORIZONTE_ARRANQUE)
    expect(HORIZONTE_ARRANQUE).toBe(12)
    const fin = mesesHastaFinLeasing(base)
    expect(fin).toBeGreaterThan(24)
    expect(atajosHorizonte(base).map((a) => a.meses)).toEqual([6, 12, 24, fin])
  })

  it('valores recordados: el número de cada deslizante movido, sin el signo, por variable y dirección', () => {
    let s = conVar(supuestosVacios(), 'devaluacion.0', { dir: 'sube', valor: '2.0' })
    s = conVar(s, 'retorno.cedear', { dir: 'baja', valor: '10.5' })
    s = conVar(s, 'casa', { dir: 'igual', valor: null })
    expect(recordadosDe(s)).toEqual({ 'devaluacion.sube': '2', 'retorno.cedear.baja': '10.5' })
  })

  it('comparar: solo lo que cambia, sin valorar', () => {
    const a = completarConIgual(vista.supuestos_iniciales, base)
    const b = conVar(a, 'devaluacion.0', { dir: 'sube', valor: '2.0' })
    const d = diferencias(a, b, base)
    expect(d).toEqual(['Devaluación (CCL): Igual · Sube +2,0 %/mes'])
    expect(d.join(' ')).not.toMatch(/mejor|conviene|deber/i)
  })

  it('al horizonte: el excedente acumulado es la suma de los meses, con su traza; con faltantes, nada', () => {
    const s = { ...completarConIgual(vista.supuestos_iniciales, base), horizonte_meses: 12 }
    const p = proyectar(base, s)
    const r = resumenHorizonte(p)!
    const suma = p.meses.reduce((a, m) => a + Number(m.excedente.ars), 0)
    expect(Number(r.excedente.ars.valor)).toBeCloseTo(suma, 6)
    expect(r.excedente.ars.formula).toContain('Σ excedente de oct-26 a oct-27 (13 meses)')
    expect(r.excedente.usd.valor).not.toBeNull()
    expect(r.excedente.ars.etiquetas).toContain('supuesto')
    expect(resumenHorizonte(proyectar(base, vista.supuestos_iniciales))).toBeNull()
  })
})

describe('ajuste mensual del ingreso en pesos', () => {
  it('se elige por tramo, de 0 a 15 %/mes, y mueve el ingreso proyectado: × (1 + a)^k', () => {
    const s0 = { ...completarConIgual(vista.supuestos_iniciales, base), horizonte_meses: 3 }
    const s1 = conAjuste(s0, 0, '2.0')
    expect(s1.ingreso_pesos[0].ajuste_mensual).toBe('2.0')
    expect(conAjuste(s0, 0, '99').ingreso_pesos[0].ajuste_mensual).toBe('15.0')
    expect(conAjuste(s1, 0, null).ingreso_pesos[0].ajuste_mensual).toBeNull()
    const a = proyectar(base, s0)
    const b = proyectar(base, s1)
    // Mes 1: el fijo en pesos (inventado, $ 850.000) sube 2%: $ 17.000 más.
    expect(Number(b.meses[1].ingresos.ars) - Number(a.meses[1].ingresos.ars)).toBeCloseTo(17000, 6)
    expect(Number(b.meses[2].ingresos.ars) - Number(a.meses[2].ingresos.ars)).toBeCloseTo(850000 * (1.02 ** 2 - 1), 6)
    expect(b.meses[0].ingresos.ars).toBe(a.meses[0].ingresos.ars)
    expect(diferencias(s0, s1, base)).toContain('Ajuste del ingreso en pesos: nominal y nominal · 2,0 %/mes y nominal')
  })
})

describe('pago al vencimiento', () => {
  it('un pago único: devuelve el VN y lo demás es lo que capitalizó', () => {
    expect(pagoUnico('1.1046')).toEqual({ amortizacion: '1', interes: '0.1046' })
    expect(pagoUnico('0.5')).toEqual({ amortizacion: '0.5', interes: '0' })
    expect(() => pagoUnico('0')).toThrow()
  })

  it('la vista previa: VN × pago por VN, en pesos y en dólares, con traza; sin pago, sin dato', () => {
    const v = vistaPreviaPago('1.1046', '11500000', 'S13N6', '2026-11-13', '1548.2')
    expect(v.ars.valor).toBe('12702900')
    expect(v.ars.formula).toBe('11.500.000 VN × $ 1,1046 = $ 12.702.900,00')
    expect(Number(v.usd.valor)).toBeCloseTo(12702900 / 1548.2, 9)
    const sin = vistaPreviaPago(null, '11500000', 'S13N6', null, '1548.2')
    expect(sin.ars.valor).toBeNull()
    expect(sin.ars.motivo).toContain('Falta el pago')
    expect(vistaPreviaPago('1.1', '100', 'X', null, null).usd.valor).toBeNull()
  })
})

describe('control del cripto a la vista (D-37)', () => {
  it('avisa si los pesos no cierran con US$ × cripto, sin frenar', () => {
    expect(avisoCripto('3.800', '', '', leerNumeroAR).estado).toBe('incompleto')
    expect(avisoCripto('3.800', '1.541', '', leerNumeroAR).texto).toContain('van juntos')
    expect(avisoCripto('3.800', '1.541', '5.855.800', leerNumeroAR)).toEqual({ estado: 'ok', texto: 'Cierra: US$ × cripto = $ 5.855.800,00.' })
    const no = avisoCripto('3.800', '1.541', '5.100.000', leerNumeroAR)
    expect(no.estado).toBe('no_cierra')
    expect(no.texto).toContain('el cripto sería 1.342,11')
    // La tolerancia es la precisión tipeada (mismo control que el servidor y la base).
    expect(controlCripto('3800', '1541', '5855830').ok).toBe(true) // ± 3.800 × 0,5 + 0,5
    expect(controlCripto('3800', '1541.00', '5855830').ok).toBe(false) // ± 3.800 × 0,005 + 0,5
  })
})

describe('doble carga (Cargar ingreso contra Datos › Movimientos)', () => {
  it('avisa si el mismo día ya hay un aporte igual a la misma cuenta; si no, nada', () => {
    const movs = [
      { fecha: '2026-10-15', tipo: 'aporte' as const, cuenta_id: 1, montos: [{ moneda: 'ARS' as const, monto: '5855800' }, { moneda: 'USD' as const, monto: '3800' }] },
      { fecha: '2026-10-14', tipo: 'retiro' as const, cuenta_id: 2, montos: [{ moneda: 'ARS' as const, monto: '250000' }] },
    ]
    const ingreso = { fecha: '2026-10-15', sentido: 'ingreso' as const, cuenta_id: 1, moneda: 'USD' as const, monto: '3800' }
    expect(posibleDobleCarga(movs, ingreso)).toEqual(movs[0])
    expect(posibleDobleCarga(movs, { ...ingreso, monto: '3800.00' })).toEqual(movs[0])
    expect(posibleDobleCarga(movs, { ...ingreso, cuenta_id: 2 })).toBeNull()
    expect(posibleDobleCarga(movs, { ...ingreso, fecha: '2026-10-16' })).toBeNull()
    expect(posibleDobleCarga(movs, { ...ingreso, cuenta_id: null })).toBeNull()
    expect(posibleDobleCarga(movs, { ...ingreso, monto: null })).toBeNull()
    expect(posibleDobleCarga(movs, { fecha: '2026-10-14', sentido: 'gasto', cuenta_id: 2, moneda: 'ARS', monto: '250000' })).toEqual(movs[1])
  })
})

describe('la barra de cada variable (D-164): de Baja a Sube, con Igual en el medio', () => {
  it('va de −el máximo de Baja al máximo de Sube; Igual es el 0', () => {
    expect(limitesBarra('devaluacion')).toEqual({ min: -15, max: 15 })
    expect(limitesBarra('inflacion')).toEqual({ min: -5, max: 15 })
    expect(posicionDe({ dir: 'igual', valor: null })).toBe('0.0')
    expect(posicionDe({ dir: 'sube', valor: '2' })).toBe('2.0')
    expect(posicionDe({ dir: 'baja', valor: '1.5' })).toBe('-1.5')
    expect(posicionDe({ dir: 'sube', valor: null })).toBeNull()
    expect(posicionDe({ dir: null, valor: null })).toBeNull()
  })

  it('una posición dice la variable: a la izquierda Baja, a la derecha Sube, el 0 es Igual (sin número)', () => {
    expect(varDePosicion('0', 'devaluacion')).toEqual({ dir: 'igual', valor: null })
    expect(varDePosicion('-0.04', 'devaluacion')).toEqual({ dir: 'igual', valor: null })
    expect(varDePosicion('2.04', 'devaluacion')).toEqual({ dir: 'sube', valor: '2.0' })
    expect(varDePosicion('-1.55', 'devaluacion')).toEqual({ dir: 'baja', valor: '1.6' })
    // Fuera de la barra, se acota a sus extremos.
    expect(varDePosicion('-99', 'inflacion')).toEqual({ dir: 'baja', valor: '5.0' })
    expect(varDePosicion('99', 'inflacion')).toEqual({ dir: 'sube', valor: '15.0' })
  })

  it('lo que llega del control se lee con cuidado: un número acotado a 0,1, o null', () => {
    expect(leerPosicion('2.5', 'devaluacion')).toBe('2.5')
    expect(leerPosicion(' -1.30000001 ', 'devaluacion')).toBe('-1.3')
    expect(leerPosicion('abc', 'devaluacion')).toBeNull()
    expect(leerPosicion('', 'devaluacion')).toBeNull()
  })

  it('− y + de a 0,1, cruzan Igual y no pasan los extremos; sin elegir cuenta como Igual', () => {
    expect(pasoBarra('0.0', 0.1, 'devaluacion')).toBe('0.1')
    expect(pasoBarra('-0.1', 0.1, 'devaluacion')).toBe('0.0')
    expect(pasoBarra(null, -0.1, 'devaluacion')).toBe('-0.1')
    expect(pasoBarra('15.0', 0.1, 'devaluacion')).toBe('15.0')
    expect(pasoBarra('-5.0', -0.1, 'inflacion')).toBe('-5.0')
    expect(pasoBarra('0.2', 0.1, 'devaluacion')).toBe('0.3')
  })

  it('dónde cae cada posición en el riel (de 0 a 1), con el 0 de Igual donde está', () => {
    expect(fraccionBarra('0', -15, 15)).toBe(0.5)
    expect(fraccionBarra('-15', -15, 15)).toBe(0)
    expect(fraccionBarra('15', -15, 15)).toBe(1)
    expect(fraccionBarra('0', -5, 15)).toBe(0.25)
    expect(fraccionBarra('99', -5, 15)).toBe(1)
    expect(fraccionBarra('1', 3, 3)).toBe(0)
  })

  it('el número a la vista, los extremos y qué hace cada lado, en palabras', () => {
    expect(textoPosicion('2.0', 'devaluacion')).toBe('Sube +2,0 %/mes')
    expect(textoPosicion('-1.5', 'brecha_cripto')).toBe('Baja −1,5 pts')
    expect(textoPosicion('0.0', 'devaluacion')).toBe('Igual')
    expect(textoPosicion(null, 'devaluacion')).toBe('sin elegir')
    expect(extremosBarra('devaluacion')).toEqual(['Baja −15', 'Sube +15'])
    expect(extremosBarra('inflacion')).toEqual(['Baja −5', 'Sube +15'])
    expect(sentidoPosicion('2.0', 'devaluacion')).toBe('el CCL sube')
    expect(sentidoPosicion('0.0', 'devaluacion')).toBeNull()
  })

  it('el texto de los deslizantes de una sola dirección (lo que invertís, el ajuste)', () => {
    expect(textoDeslizante('100', '%')).toBe('100 %')
    expect(textoDeslizante('2', '%/mes', { signo: true })).toBe('+2,0 %/mes')
    expect(textoDeslizante('0.0', '%/mes', { signo: true, enCero: 'nominal' })).toBe('nominal')
    expect(textoDeslizante(null, '%')).toBe('sin número')
  })

  it('el horizonte: de 1 a 120 meses, entero', () => {
    expect(acotarHorizonte(0)).toBe(1)
    expect(acotarHorizonte(121)).toBe(120)
    expect(acotarHorizonte(12.4)).toBe(12)
    expect(acotarHorizonte(Number.NaN)).toBe(12)
  })

  it('lo que recordás de una variable se ofrece como posición de su barra (sin la de ahora ni Igual)', () => {
    const rec = { 'devaluacion.sube': '2.5', 'devaluacion.baja': '1', 'retorno.cedear.sube': '8' }
    expect(recordadosDeRuta('devaluacion.0', rec, null)).toEqual([
      { pos: '-1.0', texto: 'Baja −1,0 %/mes' },
      { pos: '2.5', texto: 'Sube +2,5 %/mes' },
    ])
    expect(recordadosDeRuta('devaluacion.0', rec, '2.5')).toEqual([{ pos: '-1.0', texto: 'Baja −1,0 %/mes' }])
    expect(recordadosDeRuta('casa', rec, null)).toEqual([])
  })

  it('sin Igual posible (sin cripto, sin TEM de hoy), la barra no aparece: dice qué falta', () => {
    expect(sinIgualPosible('brecha_cripto', base)).toBeNull()
    expect(sinIgualPosible('brecha_cripto', ejemploFlujo('parcial').base!)).toContain('dólar cripto')
    expect(sinIgualPosible('tem_renovacion', ejemploFlujo('parcial').base!)).toContain('TEM de hoy')
    expect(sinIgualPosible('devaluacion.0', ejemploFlujo('parcial').base!)).toBeNull()
  })
})

describe('el arranque y "Todo igual" (D-164)', () => {
  it('Flujo arranca todo en Igual y en 12 meses: la proyección y sus gráficos se ven sin tocar nada', () => {
    const s = supuestosDeArranque(base)
    expect(s.devaluacion[0]).toMatchObject({ dir: 'igual', valor: null })
    expect(s.retorno.cedear).toMatchObject({ dir: 'igual', valor: null })
    expect(s.ingreso_usd.every((t) => t.dir === 'igual')).toBe(true)
    expect(s.politica.origen).toBe('declarada_14_10')
    const p = proyectar(base, s)
    expect(p.estado).toBe('lista')
    expect(p.meses).toHaveLength(13)
    expect(esTodoIgual(s)).toBe(true)
  })

  it('lo que no tiene Igual posible queda sin elegir y dice qué falta (nunca se inventa)', () => {
    const b = ejemploFlujo('parcial').base!
    const s = supuestosDeArranque(b)
    expect(s.brecha_cripto.dir).toBeNull()
    const p = proyectar(b, s)
    expect(p.faltan.map((f) => f.variable)).toContain('brecha_cripto')
  })

  it('un escenario de antes (con algo sin elegir o sin horizonte) arranca en Igual; lo elegido no se toca', () => {
    const viejo = conVar({ ...vista.supuestos_iniciales, horizonte_meses: null }, 'devaluacion.0', { dir: 'sube', valor: '2.0' })
    const s = conArranque(viejo, base)
    expect(s.horizonte_meses).toBe(12)
    expect(s.devaluacion[0]).toMatchObject({ dir: 'sube', valor: '2.0' })
    expect(s.retorno.cedear.dir).toBe('igual')
    // Sube sin número (o con 0) también es Igual.
    expect(conArranque(conVar(viejo, 'casa', { dir: 'sube', valor: null }), base).casa.dir).toBe('igual')
    expect(conArranque({ ...viejo, horizonte_meses: 36 }, base).horizonte_meses).toBe(36)
  })

  it('"Todo igual" pone todas las barras en Igual y el ingreso en pesos nominal, y deja el resto', () => {
    let s = conVar(supuestosDeArranque(base), 'devaluacion.0', { dir: 'sube', valor: '2.0' })
    s = conAjuste(s, 0, '3.0')
    s = { ...s, horizonte_meses: 24, politica: { ...s.politica, pct: '50', origen: 'elegida' } }
    expect(esTodoIgual(s)).toBe(false)
    const t = todoIgualDe(s)
    expect(esTodoIgual(t)).toBe(true)
    expect(t.devaluacion[0]).toMatchObject({ dir: 'igual', valor: null })
    expect(t.ingreso_pesos[0].ajuste_mensual).toBeNull()
    expect(t.horizonte_meses).toBe(24)
    expect(t.politica.pct).toBe('50')
    // Un 0 no es un movimiento.
    expect(esTodoIgual(conVar(supuestosDeArranque(base), 'casa', { dir: 'sube', valor: '0.0' }))).toBe(true)
  })

  it('¿terminás debajo de lo que pusiste? el financiero menos lo que pusiste, con su traza', () => {
    const p = proyectar(base, supuestosDeArranque(base))
    const ult = p.meses[p.meses.length - 1]
    const d = diferenciaConLoPuesto(ult)
    expect(Number(d.ars.valor)).toBeCloseTo(Number(ult.financiero.ars) - Number(ult.aportado!.ars), 6)
    expect(Number(d.usd.valor)).toBeCloseTo(Number(ult.financiero.usd) - Number(ult.aportado!.usd), 6)
    expect(d.debajo).toBe(Number(d.ars.valor) < 0)
    expect(d.ars.formula).toContain(' − ')
    expect(d.ars.insumos).toHaveLength(2)
    expect(d.ars.etiquetas).toContain('supuesto')
    const sin = diferenciaConLoPuesto({ ...ult, financiero: { ars: null, usd: null } })
    expect(sin.debajo).toBeNull()
    expect(sin.usd.valor).toBeNull()
  })
})
