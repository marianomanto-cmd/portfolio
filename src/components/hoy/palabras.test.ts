// Números en palabras para las lecturas (D-157): la fracción como la diría una
// persona, cantidades, la fecha de la pregunta de Hoy y listas.
import { describe, expect, it } from 'vitest'
import { cantidadEnPalabras, enLista, fechaEnPalabras, fraccionEnPalabras } from './palabras'

const dicho = (x: number) => {
  const r = fraccionEnPalabras(x)
  return `${r.antes}${r.nucleo}`
}

describe('fraccionEnPalabras', () => {
  it('la fracción común más cercana, con "casi" si queda abajo y "más de" si queda arriba', () => {
    expect(dicho(0.727)).toBe('casi tres cuartos')
    expect(dicho(0.75)).toBe('tres cuartos')
    expect(dicho(0.76)).toBe('tres cuartos') // dentro de la tolerancia
    expect(dicho(0.55)).toBe('más de la mitad')
    expect(dicho(0.5)).toBe('la mitad')
    expect(dicho(2 / 3)).toBe('dos tercios')
    expect(dicho(0.34)).toBe('un tercio')
    expect(dicho(0.07)).toBe('casi un décimo')
    expect(dicho(0.98)).toBe('casi todo')
    expect(dicho(1)).toBe('todo')
  })

  it('menos de 5% es "muy poco"; fuera de [0, 1] se recorta', () => {
    expect(dicho(0.03)).toBe('muy poco')
    expect(dicho(-0.2)).toBe('muy poco')
    expect(dicho(1.4)).toBe('todo')
  })

  it('dice si el verbo va en plural ("dos tercios vinieron", "la mitad vino")', () => {
    expect(fraccionEnPalabras(2 / 3).plural).toBe(true)
    expect(fraccionEnPalabras(0.75).plural).toBe(true)
    expect(fraccionEnPalabras(0.5).plural).toBe(false)
    expect(fraccionEnPalabras(1).plural).toBe(false)
  })
})

describe('cantidadEnPalabras', () => {
  it('en palabras hasta veinte, en cifras después, con el sustantivo en singular o plural', () => {
    expect(cantidadEnPalabras(6, 'posición', 'posiciones')).toBe('Seis posiciones')
    expect(cantidadEnPalabras(1, 'posición', 'posiciones')).toBe('Una posición')
    expect(cantidadEnPalabras(20, 'posición', 'posiciones')).toBe('Veinte posiciones')
    expect(cantidadEnPalabras(23, 'posición', 'posiciones')).toBe('23 posiciones')
    expect(cantidadEnPalabras(2, 'cuota', 'cuotas', false)).toBe('dos cuotas')
  })
})

describe('fechaEnPalabras', () => {
  it('el día de la semana y la fecha, sin depender de la zona horaria', () => {
    expect(fechaEnPalabras('2026-10-15')).toBe('Jueves 15 de octubre')
    expect(fechaEnPalabras('2026-11-01')).toBe('Domingo 1 de noviembre')
    expect(fechaEnPalabras('2027-02-28')).toBe('Domingo 28 de febrero')
  })
})

describe('enLista', () => {
  it('con comas y una "y" antes del último', () => {
    expect(enLista([])).toBe('')
    expect(enLista(['SPY'])).toBe('SPY')
    expect(enLista(['SPY', 'YPFD'])).toBe('SPY y YPFD')
    expect(enLista(['SPY', 'YPFD', 'FIMA'])).toBe('SPY, YPFD y FIMA')
  })
})
