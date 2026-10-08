import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { interpretarTC, leerMonto, textoReferencia, variacionContra } from './entrada'
import { registrarGesto, relojNuevo, puntaAPuntaMs, textoDuracion, CORTE_MS } from './tiempo'

describe('interpretarTC', () => {
  it('acepta formato argentino y muestra lo que entendió', () => {
    expect(interpretarTC('1548,2')).toMatchObject({ valor: '1548.2', eco: '= 1.548,20', error: null })
    expect(interpretarTC('1.548,20')).toMatchObject({ valor: '1548.2', eco: '= 1.548,20' })
    expect(interpretarTC('1548.2')).toMatchObject({ valor: '1548.2' })
    expect(interpretarTC('1541')).toMatchObject({ valor: '1541', eco: '= 1.541,00' })
    expect(interpretarTC(' 1.548,255 ')).toMatchObject({ valor: '1548.255', eco: '= 1.548,255' })
  })

  it('un punto de miles no es un decimal', () => {
    expect(interpretarTC('1.548')).toMatchObject({ valor: '1548' })
  })

  it('vacío es "sin dato", no cero', () => {
    expect(interpretarTC('')).toEqual({ texto: '', valor: null, eco: null, error: null })
    expect(interpretarTC('   ').valor).toBeNull()
  })

  it('rechaza lo que no es un número o no es positivo', () => {
    expect(interpretarTC('abc')).toMatchObject({ valor: null, error: expect.stringContaining('número') })
    expect(interpretarTC('0')).toMatchObject({ valor: null, error: expect.stringContaining('mayor que cero') })
    expect(interpretarTC('-1548')).toMatchObject({ valor: null })
  })

  it('nunca devuelve un número de JavaScript', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 9_999_999 }), fc.integer({ min: 0, max: 99 }), (entero, dec) => {
        const r = interpretarTC(`${entero},${String(dec).padStart(2, '0')}`)
        expect(typeof r.valor).toBe('string')
        expect(r.valor).toBe(String(Number(`${entero}.${String(dec).padStart(2, '0')}`)))
      }),
    )
  })
})

describe('variacionContra y textoReferencia', () => {
  it('compara contra la referencia con signo', () => {
    expect(variacionContra('1548.2', '1531.7')).toBe('+1,08%')
    expect(variacionContra('1541', '1548.2')).toBe('−0,47%')
  })
  it('sin referencia no hay variación', () => {
    expect(variacionContra('1548.2', null)).toBeNull()
    expect(variacionContra(null, '1531.7')).toBeNull()
  })
  it('formatea la ayuda', () => {
    expect(textoReferencia('1531.7')).toBe('1.531,70')
    expect(textoReferencia(null)).toBeNull()
  })
})

describe('leerMonto', () => {
  it('lee montos negativos y exige positivos cuando corresponde', () => {
    expect(leerMonto('-185.000')).toEqual({ valor: '-185000', error: null })
    expect(leerMonto('0', { positivo: true }).error).toMatch(/mayor que cero/)
    expect(leerMonto('').error).toMatch(/Falta/)
  })
})

describe('tiempo activo', () => {
  it('suma los intervalos entre gestos', () => {
    let r = relojNuevo()
    for (const t of [0, 1000, 5000, 41_000]) r = registrarGesto(r, t)
    expect(r.activoMs).toBe(41_000)
    expect(r.tramos).toBe(1)
  })

  it('un intervalo de más de 60 s corta el tramo y no cuenta', () => {
    let r = relojNuevo()
    for (const t of [0, 9_000, 9_000 + 30 * 60_000, 9_000 + 30 * 60_000 + 32_000]) r = registrarGesto(r, t)
    expect(r.activoMs).toBe(41_000)
    expect(r.tramos).toBe(2)
    expect(puntaAPuntaMs(r)).toBe(9_000 + 30 * 60_000 + 32_000)
  })

  it('exactamente 60 s todavía cuenta', () => {
    let r = registrarGesto(relojNuevo(), 0)
    r = registrarGesto(r, CORTE_MS)
    expect(r.activoMs).toBe(CORTE_MS)
  })

  it('un reloj que va para atrás no cambia nada', () => {
    let r = registrarGesto(relojNuevo(), 10_000)
    r = registrarGesto(r, 5_000)
    expect(r.activoMs).toBe(0)
    expect(r.ultimo).toBe(10_000)
  })

  it('nunca supera el tiempo de punta a punta ni es negativo', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 200_000 }), { maxLength: 50 }), (pasos) => {
        let r = relojNuevo()
        let t = 0
        for (const p of pasos) {
          t += p
          r = registrarGesto(r, t)
        }
        expect(r.activoMs).toBeGreaterThanOrEqual(0)
        expect(r.activoMs).toBeLessThanOrEqual(puntaAPuntaMs(r) ?? 0)
      }),
    )
  })

  it('se lee en segundos o minutos', () => {
    expect(textoDuracion(41_400)).toBe('41 s')
    expect(textoDuracion(65_000)).toBe('1 min 05 s')
  })
})
