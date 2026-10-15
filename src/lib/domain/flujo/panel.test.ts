import { describe, expect, it } from 'vitest'
import { ejemploFlujo } from '@/lib/vistas/ejemplo-flujo'
import { controlCripto, avisoCripto, posibleDobleCarga } from './control'
import { leerNumeroAR } from '../dinero'
import { pagoUnico, vistaPreviaPago } from './pago'
import {
  agregarTramo,
  atajosHorizonte,
  claveDeRuta,
  claveRecordada,
  conAjuste,
  conVar,
  diferencias,
  elegirDireccion,
  leerVar,
  mesesHastaFinLeasing,
  nombreVariable,
  pasoDeslizante,
  recordadosDe,
  resumenHorizonte,
  rutasDelPanel,
  sacarTramo,
  textoIgual,
  valorDeslizante,
} from './panel'
import { proyectar } from './proyeccion'
import { completarConIgual, supuestosVacios } from './supuestos'

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

  it('Baja o Sube arrancan sin número (o con el que recordás), Igual no lleva número', () => {
    expect(elegirDireccion({ dir: null, valor: null }, 'sube', null)).toEqual({ dir: 'sube', valor: null })
    expect(elegirDireccion({ dir: null, valor: null }, 'sube', '2.5')).toEqual({ dir: 'sube', valor: '2.5' })
    expect(elegirDireccion({ dir: 'sube', valor: '3.0' }, 'igual', '2.5')).toEqual({ dir: 'igual', valor: null })
    expect(elegirDireccion({ dir: 'sube', valor: '3.0' }, 'sube', '2.5')).toEqual({ dir: 'sube', valor: '3.0' })
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

  it('atajos del horizonte: 6, 12, 24 y el fin del leasing; ninguno arranca elegido', () => {
    expect(vista.supuestos_iniciales.horizonte_meses).toBeNull()
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
    expect(d).toEqual(['Devaluación (CCL): Igual · Sube +2,0%/mes'])
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
    expect(diferencias(s0, s1, base)).toContain('Ajuste del ingreso en pesos: nominal y nominal · 2,0%/mes y nominal')
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
