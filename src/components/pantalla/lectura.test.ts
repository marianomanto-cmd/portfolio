import { describe, expect, it } from 'vitest'
import type { CalcVista } from '@/lib/domain/calc'
import { cifra, enfasis, lecturaPlana, texto, validarLectura } from './lectura'

// La lectura de cada pantalla (D-157): una frase con un solo énfasis, armada
// por funciones puras. Números inventados (D-24).

const calc = (valor: string | null): CalcVista =>
  valor === null
    ? { valor: null, motivo: 'Falta el CCL.', formula: 'sin dato', insumos: [], etiquetas: [] }
    : { valor, formula: `$ ${valor}`, insumos: [], etiquetas: [] }

describe('la lectura de una pantalla', () => {
  const buena = [texto('Hoy sumaste '), cifra('$ 182.400', calc('182400'), 'Variación · en pesos', 'ARS'), texto('. Dos tercios vinieron del '), enfasis('dólar'), texto('.')]

  it('una frase con un solo énfasis está bien armada', () => {
    expect(validarLectura(buena)).toEqual({ ok: true })
    expect(lecturaPlana(buena)).toBe('Hoy sumaste $ 182.400. Dos tercios vinieron del dólar.')
  })

  it('sin énfasis o con dos, no', () => {
    expect(validarLectura([texto('Siete posiciones.')])).toMatchObject({ ok: false, motivo: expect.stringContaining('un solo énfasis') })
    expect(validarLectura([enfasis('una'), texto(' y '), enfasis('otra')])).toMatchObject({ ok: false })
  })

  it('una cifra "sin dato" no va en la lectura: la frase dice qué falta', () => {
    const r = validarLectura([texto('Llegás a '), cifra('sin dato', calc(null), 'Patrimonio a 36 meses'), enfasis(' algo')])
    expect(r).toMatchObject({ ok: false, motivo: expect.stringContaining('sin dato') })
  })

  it('el énfasis puede ser una cifra con su traza', () => {
    const p = enfasis('US$ 87.587', calc('87587'), 'Patrimonio a 36 meses · en dólares', 'USD')
    expect(p).toMatchObject({ enfasis: true, calc: { valor: '87587' }, moneda: 'USD' })
    expect(validarLectura([texto('En tres años llegás a '), p, texto('.')])).toEqual({ ok: true })
  })

  it('una parte vacía es un error de armado', () => {
    expect(validarLectura([texto(''), enfasis('x')])).toMatchObject({ ok: false, motivo: 'Hay una parte vacía.' })
  })
})
