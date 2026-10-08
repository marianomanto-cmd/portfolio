import { describe, expect, it } from 'vitest'
import {
  MAXIMO_ORIGENES,
  OLVIDO_MS,
  TRABA_MAXIMA_MS,
  anotarError,
  anotarExito,
  esperaPendiente,
  origenDelPedido,
  textoEspera,
  trabaTrasErrores,
  type Registro,
} from './intentos'

const T0 = Date.UTC(2026, 9, 8, 12, 0, 0)

describe('trabaTrasErrores', () => {
  it('uno o dos errores no traban; después se duplica hasta 5 minutos', () => {
    expect([1, 2, 3, 4, 5, 6].map(trabaTrasErrores)).toEqual([0, 0, 1000, 2000, 4000, 8000])
    expect(trabaTrasErrores(11)).toBe(256_000)
    expect(trabaTrasErrores(12)).toBe(TRABA_MAXIMA_MS)
    expect(trabaTrasErrores(1000)).toBe(TRABA_MAXIMA_MS)
  })
})

describe('registro de intentos', () => {
  it('traba al tercer error seguido y destraba cuando pasa el rato', () => {
    const r: Registro = new Map()
    expect(anotarError(r, 'ip', T0)).toBe(0)
    expect(anotarError(r, 'ip', T0 + 10)).toBe(0)
    expect(esperaPendiente(r, 'ip', T0 + 20)).toBe(0)
    expect(anotarError(r, 'ip', T0 + 30)).toBe(1000)
    expect(esperaPendiente(r, 'ip', T0 + 30)).toBe(1000)
    expect(esperaPendiente(r, 'ip', T0 + 530)).toBe(500)
    expect(esperaPendiente(r, 'ip', T0 + 1030)).toBe(0)
    expect(anotarError(r, 'ip', T0 + 1100)).toBe(2000)
    // Otro origen no se entera.
    expect(esperaPendiente(r, 'otra', T0 + 1100)).toBe(0)
  })

  it('entrar limpia el contador', () => {
    const r: Registro = new Map()
    for (let i = 0; i < 5; i++) anotarError(r, 'ip', T0 + i)
    anotarExito(r, 'ip')
    expect(esperaPendiente(r, 'ip', T0 + 10)).toBe(0)
    expect(anotarError(r, 'ip', T0 + 20)).toBe(0)
  })

  it('pasado un rato sin errores, el contador vuelve a cero', () => {
    const r: Registro = new Map()
    for (let i = 0; i < 4; i++) anotarError(r, 'ip', T0 + i)
    expect(anotarError(r, 'ip', T0 + OLVIDO_MS + 10_000)).toBe(0)
  })

  it('no recuerda más de MAXIMO_ORIGENES orígenes (se olvida de los más viejos)', () => {
    const r: Registro = new Map()
    for (let i = 0; i < MAXIMO_ORIGENES + 50; i++) anotarError(r, `ip${i}`, T0 + i)
    expect(r.size).toBe(MAXIMO_ORIGENES)
    expect(r.has('ip0')).toBe(false)
    expect(r.has(`ip${MAXIMO_ORIGENES + 49}`)).toBe(true)
  })
})

describe('textoEspera', () => {
  it('en segundos o minutos, redondeando para arriba', () => {
    expect(textoEspera(1)).toBe('Esperá 1 segundo')
    expect(textoEspera(4000)).toBe('Esperá 4 segundos')
    expect(textoEspera(59_000)).toBe('Esperá 59 segundos')
    expect(textoEspera(59_001)).toBe('Esperá 1 minuto')
    expect(textoEspera(61_000)).toBe('Esperá 2 minutos')
    expect(textoEspera(TRABA_MAXIMA_MS)).toBe('Esperá 5 minutos')
  })
})

describe('origenDelPedido', () => {
  const h = (o: Record<string, string>) => new Headers(o)
  it('usa la IP que informa Vercel', () => {
    expect(origenDelPedido(h({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '198.51.100.1' }))).toBe('203.0.113.7')
    expect(origenDelPedido(h({ 'x-forwarded-for': '198.51.100.1, 10.0.0.1' }))).toBe('198.51.100.1')
    expect(origenDelPedido(h({}))).toBe('local')
  })
})
