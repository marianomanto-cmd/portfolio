// leerNumeroAR (B24) y compacto (B25). Números inventados (D-24).

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { compacto, Decimal, leerNumeroAR, numero } from './dinero'

describe('leerNumeroAR', () => {
  it('lee el formato argentino de siempre', () => {
    expect(leerNumeroAR('1.548,2')).toBe('1548.2')
    expect(leerNumeroAR('1548,20')).toBe('1548.2')
    expect(leerNumeroAR('1548.2')).toBe('1548.2')
    expect(leerNumeroAR('1548.20')).toBe('1548.2')
    expect(leerNumeroAR('1.548')).toBe('1548')
    expect(leerNumeroAR('12.345.678')).toBe('12345678')
    expect(leerNumeroAR('$ 12.345.678,90')).toBe('12345678.9')
    expect(leerNumeroAR('US$ 1.234,5')).toBe('1234.5')
    expect(leerNumeroAR('U$S 99')).toBe('99')
    expect(leerNumeroAR('−50.000,25')).toBe('-50000.25')
    expect(leerNumeroAR('-1.234')).toBe('-1234')
    expect(leerNumeroAR(' 1 234,5 ')).toBe('1234.5')
    expect(leerNumeroAR('0,0123')).toBe('0.0123')
    expect(leerNumeroAR('0.125')).toBe('0.125')
    expect(leerNumeroAR('42')).toBe('42')
  })

  it('B24: devuelve null ante agrupaciones imposibles o ambiguas, nunca miles inventados', () => {
    expect(leerNumeroAR('1.0852')).toBeNull() // un punto + 4 dígitos: ¿1,0852 o 10.852?
    expect(leerNumeroAR('1,548.20')).toBeNull() // punto después de la coma
    expect(leerNumeroAR('12.34.56')).toBeNull()
    expect(leerNumeroAR('1234.567')).toBeNull() // grupo inicial de 4 dígitos
    expect(leerNumeroAR('1.23.456')).toBeNull()
    expect(leerNumeroAR('1.234.56')).toBeNull()
    expect(leerNumeroAR('01.234')).toBeNull()
    expect(leerNumeroAR('12.3456,7')).toBeNull()
    expect(leerNumeroAR('1,2,3')).toBeNull()
    expect(leerNumeroAR(',5')).toBeNull()
    expect(leerNumeroAR('1.')).toBeNull()
    expect(leerNumeroAR('abc')).toBeNull()
    expect(leerNumeroAR('')).toBeNull()
    expect(leerNumeroAR('-')).toBeNull()
    expect(leerNumeroAR('1e5')).toBeNull()
  })

  // Montos con hasta 13 dígitos enteros y 0 a 6 decimales.
  const montos = fc
    .tuple(fc.bigInt({ min: 0n, max: 9_999_999_999_999n }), fc.integer({ min: 0, max: 6 }), fc.bigInt({ min: 0n, max: 999_999n }), fc.boolean())
    .map(([entero, dec, frac, neg]) => {
      const f = dec === 0 ? '' : (frac % 10n ** BigInt(dec)).toString().padStart(dec, '0')
      const d = new Decimal(`${neg ? '-' : ''}${entero}${f ? `.${f}` : ''}`)
      return { d, dec }
    })

  it('propiedad: lo que formatea numero() (es-AR) se lee igual', () => {
    fc.assert(
      fc.property(montos, ({ d, dec }) => {
        const texto = numero(d, dec).replace('−', '-')
        expect(leerNumeroAR(texto)).toBe(d.toDecimalPlaces(dec).toFixed())
      }),
      { numRuns: 500 },
    )
  })

  it('propiedad: un punto después de la coma nunca es un número', () => {
    fc.assert(
      fc.property(fc.nat(99_999), fc.nat(999), fc.nat(99), (a, b, c) => {
        expect(leerNumeroAR(`${a},${b}.${c}`)).toBeNull()
      }),
    )
  })

  it('propiedad: un solo punto con 4 o más dígitos detrás, y sin coma, es null', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 99_999 }), fc.stringMatching(/^\d{4,8}$/), (a, frac) => {
        expect(leerNumeroAR(`${a}.${frac}`)).toBeNull()
      }),
    )
  })

  it('propiedad: con grupos de miles válidos se leen miles; con un grupo roto, null', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1000, max: Number.MAX_SAFE_INTEGER }), (n) => {
        const conMiles = n.toLocaleString('es-AR', { useGrouping: true, maximumFractionDigits: 0 })
        expect(leerNumeroAR(conMiles)).toBe(String(n))
        // Correr un punto un lugar rompe el grupo.
        const i = conMiles.indexOf('.')
        const roto = conMiles.slice(0, i - 1) + '.' + conMiles[i - 1] + conMiles.slice(i + 1)
        if (roto !== conMiles && !roto.startsWith('.')) expect(leerNumeroAR(roto)).not.toBe(String(n))
      }),
      { numRuns: 300 },
    )
  })
})

describe('compacto', () => {
  const D = (x: string | number) => new Decimal(x)

  it('B25: elige la unidad después de redondear', () => {
    expect(compacto(D('999960'), 'ARS')).toBe('$ 1,0 M')
    expect(compacto(D('999.6'), 'ARS')).toBe('$ 1,0k')
    expect(compacto(D('999.996'), 'USD')).toBe('US$ 1,0k')
    expect(compacto(D('-999960'), 'ARS')).toBe('−$ 1,0 M')
  })

  it('mantiene los casos de siempre', () => {
    expect(compacto(D('67400'), 'USD')).toBe('US$ 67,4k')
    expect(compacto(D('104300000'), 'ARS')).toBe('$ 104,3 M')
    expect(compacto(D('950000'), 'ARS')).toBe('$ 950,0k')
    expect(compacto(D('999'), 'ARS')).toBe('$ 999')
    expect(compacto(D('12.5'), 'USD')).toBe('US$ 12,50')
    expect(compacto(D('-0.001'), 'USD')).toBe('US$ 0,00')
  })

  it('propiedad: nunca muestra 1.000 de una unidad y el valor mostrado está a medio dígito del real', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 10n ** 12n }), fc.constantFrom<'ARS' | 'USD'>('ARS', 'USD'), (n, moneda) => {
        const d = new Decimal(n.toString()).div(100)
        const texto = compacto(d, moneda)
        const m = /^(?:US)?\$ ([\d.,]+)( M|k)?$/.exec(texto)
        expect(m, texto).not.toBeNull()
        const cifra = new Decimal(leerNumeroAR(m![1])!)
        const unidad = m![2] === ' M' ? 1_000_000 : m![2] === 'k' ? 1_000 : 1
        if (unidad > 1) expect(cifra.lt(1000) || unidad === 1_000_000, texto).toBe(true)
        if (unidad === 1) expect(cifra.lt(1000), texto).toBe(true)
        const error = cifra.times(unidad).minus(d).abs()
        const medio = unidad === 1 ? new Decimal(moneda === 'ARS' ? '0.5' : '0.005') : new Decimal(unidad).times('0.05')
        expect(error.lte(medio), `${texto} vs ${d.toFixed()}`).toBe(true)
      }),
      { numRuns: 500 },
    )
  })
})
