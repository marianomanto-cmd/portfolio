import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { altoGrilla, ANCHO_FICHA, columnasVisibles, entraLoImprescindible, iniciosDeGrupo, medidas, type MedidaColumna } from './columnas'
import { compararAsc, compararOrden, esDecimal, ordenarFilas } from './orden'

// La grilla común (AG Grid, D-157): el orden de los montos, las columnas que
// entran sin scroll horizontal y el alto. Números inventados (D-24).

describe('el orden: montos en texto decimal, exactos', () => {
  it('compara como número, no como texto: "9" < "10" y "-1234.5" < "-12"', () => {
    expect(compararAsc('9', '10')).toBeLessThan(0)
    expect(compararAsc('-1234.5', '-12')).toBeLessThan(0)
    expect(compararAsc('0.1', '0.10')).toBe(0)
    expect(compararAsc('1e3', '999')).toBeGreaterThan(0)
  })

  it('distingue lo que un float no distingue', () => {
    const a = '12345678901234567.01'
    const b = '12345678901234567.02'
    expect(Number(a)).toBe(Number(b))
    expect(compararAsc(a, b)).toBeLessThan(0)
  })

  it('"sin dato" va al final de menor a mayor y también de mayor a menor', () => {
    const filas = [{ k: 'a', v: '5' }, { k: 'b', v: null }, { k: 'c', v: '-3' }, { k: 'd', v: '120.5' }]
    expect(ordenarFilas(filas, (f) => f.v, 'asc').map((f) => f.k)).toEqual(['c', 'a', 'd', 'b'])
    expect(ordenarFilas(filas, (f) => f.v, 'desc').map((f) => f.k)).toEqual(['d', 'a', 'c', 'b'])
  })

  it('el comparador de AG Grid compensa la inversión del descendente para "sin dato"', () => {
    // AG Grid multiplica por −1 en descendente: con eso, null tiene que seguir al final.
    const desc = (a: string | null, b: string | null) => -compararOrden(a, b, true)
    expect(desc(null, '5')).toBeGreaterThan(0)
    expect(desc('5', null)).toBeLessThan(0)
    expect(desc('7', '5')).toBeLessThan(0)
  })

  it('los textos en castellano: sin distinguir mayúsculas ni tildes, con los números en su orden', () => {
    expect(compararAsc('ánet', 'ANET')).toBe(0)
    expect(compararAsc('S13N6', 'S130')).toBeLessThan(0)
    expect(compararAsc('Galicia', 'IEB')).toBeLessThan(0)
    // Un número va antes que un texto.
    expect(compararAsc('12', 'GOOGL')).toBeLessThan(0)
  })

  it('reconoce un decimal escrito como texto', () => {
    expect(esDecimal('1234.5')).toBe(true)
    expect(esDecimal('-0.001')).toBe(true)
    expect(esDecimal('1.234,5')).toBe(false)
    expect(esDecimal('GOOGL')).toBe(false)
  })

  it('a igual valor conserva el orden de llegada', () => {
    const filas = [{ k: 'x', v: '1' }, { k: 'y', v: '1' }, { k: 'z', v: '1' }]
    expect(ordenarFilas(filas, (f) => f.v, 'desc').map((f) => f.k)).toEqual(['x', 'y', 'z'])
  })
})

describe('las columnas que entran (nunca scroll horizontal)', () => {
  const cols = [
    { id: 'activo', ancho: 170, prioridad: 0 },
    { id: 'valor', ancho: 130, prioridad: 0 },
    { id: 'resultado', ancho: 130, prioridad: 1 },
    { id: 'ppc', ancho: 110, prioridad: 3 },
    { id: 'peso', ancho: 90, prioridad: 2 },
  ]

  it('en un ancho grande entran todas y no hace falta la ficha', () => {
    const r = columnasVisibles(cols, 1000)
    expect([...r.visibles]).toEqual(['activo', 'valor', 'resultado', 'peso', 'ppc'])
    expect(r.ocultas).toEqual([])
  })

  it('en un ancho medio se ocultan primero las de prioridad más alta, y se reserva la ficha', () => {
    // 170 + 130 + 130 + 90 = 520; con la ppc, 630. En 600 no entra la ppc: queda lugar para la ficha (600 − 48 ≥ 520).
    const r = columnasVisibles(cols, 600)
    expect(r.ocultas).toEqual(['ppc'])
    const usado = cols.filter((c) => r.visibles.has(c.id)).reduce((s, c) => s + c.ancho, 0)
    expect(usado + ANCHO_FICHA).toBeLessThanOrEqual(600)
  })

  it('lo de prioridad 0 se ve siempre, aunque no sume', () => {
    const r = columnasVisibles(cols, 200)
    expect(r.visibles.has('activo') && r.visibles.has('valor')).toBe(true)
    expect(r.ocultas).toEqual(['resultado', 'ppc', 'peso'])
  })

  it('para cada ancho, lo que se ve más la ficha nunca pasa el ancho (salvo lo imprescindible)', () => {
    for (let ancho = 300; ancho <= 1400; ancho += 7) {
      const r = columnasVisibles(cols, ancho)
      const usado = cols.filter((c) => r.visibles.has(c.id)).reduce((s, c) => s + c.ancho, 0) + (r.ocultas.length ? ANCHO_FICHA : 0)
      const minimo = cols.filter((c) => c.prioridad === 0).reduce((s, c) => s + c.ancho, 0) + ANCHO_FICHA
      expect(usado <= ancho || usado <= minimo, `ancho ${ancho}`).toBe(true)
    }
  })
})

describe('lo imprescindible: si no entra, tarjetas (D-167)', () => {
  // Las mismas columnas: todas suman 630; lo de prioridad 0 (activo y valor), 300; con la ficha, 348.
  const cols = [
    { id: 'activo', ancho: 170, prioridad: 0 },
    { id: 'valor', ancho: 130, prioridad: 0 },
    { id: 'resultado', ancho: 130, prioridad: 1 },
    { id: 'ppc', ancho: 110, prioridad: 3 },
    { id: 'peso', ancho: 90, prioridad: 2 },
  ]

  it('si entran todas, entra: no hace falta la ficha', () => {
    expect(entraLoImprescindible(cols, 1000)).toBe(true)
    expect(entraLoImprescindible(cols, 630)).toBe(true)
  })

  it('si alguna queda afuera, lo de prioridad 0 más la ficha: justo en el límite entra, un píxel menos no', () => {
    expect(entraLoImprescindible(cols, 629)).toBe(true)
    expect(entraLoImprescindible(cols, 300 + ANCHO_FICHA)).toBe(true)
    expect(entraLoImprescindible(cols, 300 + ANCHO_FICHA - 1)).toBe(false)
  })

  it('lo de prioridad 0 solo, sin lugar para la ficha, no alcanza', () => {
    // 300 px entran activo y valor, pero las otras tres columnas no tendrían dónde verse.
    expect(entraLoImprescindible(cols, 300)).toBe(false)
    expect(columnasVisibles(cols, 300).ocultas).toEqual(['resultado', 'ppc', 'peso'])
  })

  it('si todas son imprescindibles, no hay ficha: entran o no entran', () => {
    const todas = [
      { id: 'renglon', ancho: 175, prioridad: 0 },
      { id: 'actual', ancho: 150, prioridad: 0 },
      { id: 'anterior', ancho: 150, prioridad: 0 },
      { id: 'diferencia', ancho: 150, prioridad: 0 },
    ]
    expect(entraLoImprescindible(todas, 625)).toBe(true)
    expect(entraLoImprescindible(todas, 624)).toBe(false)
  })

  it('una columna más angosta que la ficha: si entran todas, entra; si no, hace falta la ficha y no entra', () => {
    // 300 + 40 = 340 sin ficha; sacar la de 40 pide la ficha de 48: 348.
    const angosta = [
      { id: 'nombre', ancho: 300, prioridad: 0 },
      { id: 'dias', ancho: 40, prioridad: 1 },
    ]
    expect(entraLoImprescindible(angosta, 340)).toBe(true)
    expect(entraLoImprescindible(angosta, 339)).toBe(false)
    expect(entraLoImprescindible(angosta, 348)).toBe(true)
  })

  it('entra justo cuando lo que elige columnasVisibles, con su ficha, no pasa el ancho (columnas y anchos al azar)', () => {
    const columna = fc.record({ ancho: fc.integer({ min: 30, max: 320 }), prioridad: fc.integer({ min: 0, max: 4 }) })
    fc.assert(
      fc.property(fc.array(columna, { minLength: 1, maxLength: 12 }), fc.integer({ min: 0, max: 2600 }), (xs, disponible) => {
        const cs: MedidaColumna[] = xs.map((x, i) => ({ id: `c${i}`, ...x }))
        const r = columnasVisibles(cs, disponible)
        const usado = cs.filter((c) => r.visibles.has(c.id)).reduce((s, c) => s + c.ancho, 0) + (r.ocultas.length ? ANCHO_FICHA : 0)
        return entraLoImprescindible(cs, disponible) === usado <= disponible
      }),
      { numRuns: 2000 },
    )
  })
})

describe('el alto', () => {
  it('hasta 25 filas no tiene scroll propio; con más, mide 25 filas, el encabezado y los totales', () => {
    expect(altoGrilla({ filas: 25, maxFilas: 25, altoFila: 44, altoEncabezado: 40, conTotales: true })).toBeNull()
    expect(altoGrilla({ filas: 26, maxFilas: 25, altoFila: 44, altoEncabezado: 40, conTotales: true })).toBe(40 + 25 * 44 + 44 + 2)
    expect(altoGrilla({ filas: 40, maxFilas: 25, altoFila: 40, altoEncabezado: 40, conTotales: false })).toBe(40 + 25 * 40 + 2)
  })
})

describe('con el dedo (D-100)', () => {
  it('el encabezado y las filas miden 44 px como mínimo; con mouse, lo pedido', () => {
    expect(medidas({ grueso: true, altoFila: 40, altoEncabezado: 40, minimo: 44 })).toEqual({ altoFila: 44, altoEncabezado: 44 })
    expect(medidas({ grueso: true, altoFila: 52, altoEncabezado: 40, minimo: 44 })).toEqual({ altoFila: 52, altoEncabezado: 44 })
    expect(medidas({ grueso: false, altoFila: 40, altoEncabezado: 40, minimo: 44 })).toEqual({ altoFila: 40, altoEncabezado: 40 })
  })
})

describe('los grupos de filas (Registro: un lote)', () => {
  it('una fila empieza grupo si la anterior es de otro', () => {
    expect(iniciosDeGrupo(['a', 'a', 'b', 'a', 'a'])).toEqual([true, false, true, true, false])
    expect(iniciosDeGrupo([])).toEqual([])
  })
})
