import { describe, expect, it } from 'vitest'
import { ANCHO_FICHA, columnasVisibles, type MedidaColumna } from '@/components/grilla/columnas'
import type { CalcVista } from '@/lib/domain/calc'
import type { Par } from '@/lib/vistas/contratos'
import type { ClaveLineaPuente, MesVista } from '@/lib/vistas/contratos-evolucion'
import { ejemploEvolucion } from '@/lib/vistas/ejemplo-evolucion'
import { ALTO_DOS_RENGLONES_TACTIL, altoFilaMontos, anchoMontos, anchoTitulo, medidasColumnasMes, PX_POR_CARACTER, PX_POR_CARACTER_TITULO, textoCifra } from './anchos'
import { POR_DEFECTO } from './parametros'

const c = (valor: string | null): CalcVista => ({ valor, formula: valor === null ? 'sin dato' : `${valor} = ${valor}`, insumos: [], etiquetas: [], motivo: valor === null ? 'Falta un dato.' : undefined })
const par = (ars: string | null, usd: string | null): Par => ({ ars: c(ars), usd: c(usd) })

describe('el ancho de una columna de montos', () => {
  it('el texto de la celda: signo, flecha y "sin dato"', () => {
    expect(textoCifra('5000', 'USD', { signo: true, color: true })).toBe('+US$ 5.000,00 ▲')
    expect(textoCifra('-3737797', 'ARS', { signo: true })).toBe('−$ 3.737.797')
    expect(textoCifra('-133.13', 'USD', { signo: true, color: true })).toBe('−US$ 133,13 ▼')
    expect(textoCifra('0', 'ARS', { signo: true, color: true })).toBe('$ 0')
    expect(textoCifra(null, 'USD')).toBe('sin dato')
  })

  it('el monto más largo de la columna manda; con "Ambas", el renglón más ancho', () => {
    const pares = [par('3737797', '2432.8'), par('-185000', '-119.5'), null]
    const enPesos = anchoMontos(pares, 'ars', { signo: true, color: true, minimo: 0 })
    const enDolares = anchoMontos(pares, 'usd', { signo: true, color: true, minimo: 0 })
    expect(anchoMontos(pares, 'ambas', { signo: true, color: true, minimo: 0 })).toBe(Math.max(enPesos, enDolares))
    // "+US$ 2.432,80 ▲": 15 caracteres, la pastilla, la flecha y la celda.
    expect(enDolares).toBe(Math.ceil(15 * PX_POR_CARACTER + 18 + 6 + 17))
    // Un dígito más, un carácter más de ancho.
    expect(anchoMontos([par('37377970', null)], 'ars', { signo: true, minimo: 0 }) - anchoMontos([par('3737797', null)], 'ars', { signo: true, minimo: 0 })).toBeGreaterThanOrEqual(Math.floor(PX_POR_CARACTER))
  })

  it('nunca menos que lo que pide el título; sin filas, el mínimo', () => {
    expect(anchoMontos([par('1', '1')], 'ars', { minimo: 116 })).toBe(116)
    expect(anchoMontos([], 'usd', { minimo: 128 })).toBe(128)
  })

  it('el título se lee entero: sus caracteres en mono de 10 px con tracking, el relleno del encabezado (12 px de cada lado) y un margen', () => {
    // "CUOTAS DEL LEASING": 18 caracteres; con un mínimo fijo de 150 se cortaba con puntos suspensivos.
    expect(anchoTitulo('Cuotas del leasing')).toBeGreaterThanOrEqual(18 * PX_POR_CARACTER_TITULO + 24)
    expect(anchoTitulo('Cuotas del leasing')).toBe(156)
    expect(anchoTitulo('Sin atribuir')).toBe(113)
    expect(anchoTitulo('Por tus activos') - anchoTitulo('Por el dólar')).toBeGreaterThanOrEqual(Math.floor(3 * PX_POR_CARACTER_TITULO))
    // Los mínimos fijos de antes cortaban estos dos con una sola moneda, a 768 px: "POR EL PREC…" y "LO QUE YA TRA…".
    expect(anchoTitulo('Por el precio')).toBeGreaterThan(116)
    expect(anchoTitulo('Lo que ya traías')).toBeGreaterThan(130)
  })
})

// Los títulos de las columnas del PnL por mes (bloques.tsx, NOMBRE_COLUMNA_MES).
const NOMBRES: Record<string, string> = {
  aportes: 'Aportes y retiros',
  cuotas: 'Cuotas del leasing',
  amortizacion: 'Amortización',
  activo: 'Por tus activos',
  tc: 'Por el dólar',
  sin_atribuir: 'Sin atribuir',
}
const CLAVES = Object.keys(NOMBRES)
/** El lugar de la grilla a 768 px de ventana: la tarjeta del PnL por mes le deja 602 px y la grilla resta su borde. */
const LUGAR_768 = 600

/** Lo que ocupan las columnas a la vista, con la ficha si alguna quedó afuera. */
function ocupado(cols: readonly MedidaColumna[], lugar: number): { visibles: Set<string>; ocultas: string[]; px: number } {
  const { visibles, ocultas } = columnasVisibles(cols, lugar)
  const px = cols.filter((x) => visibles.has(x.id)).reduce((s, x) => s + x.ancho, 0) + (ocultas.length ? ANCHO_FICHA : 0)
  return { visibles, ocultas, px }
}

describe('el PnL por mes a 768 px (D-30: sin scroll horizontal en la grilla)', () => {
  it('con las cifras del ejemplo, en cada vista y moneda: el mes, por tus activos, por el dólar y sin atribuir a la vista, y todo entra con la ficha', () => {
    for (const vista of ['financiero', 'total'] as const) {
      const v = ejemploEvolucion({ ...POR_DEFECTO, vista }, 'mes')
      const claves = CLAVES.filter((k) => v.meses.some((x) => x.lineas.some((l) => l.clave === k)))
      expect(claves).toEqual(expect.arrayContaining(['aportes', 'activo', 'tc', 'sin_atribuir']))
      for (const moneda of ['ars', 'usd', 'ambas'] as const) {
        const r = ocupado(medidasColumnasMes(v.meses, claves, NOMBRES, moneda), LUGAR_768)
        expect([...r.visibles], `${vista} · ${moneda}`).toEqual(expect.arrayContaining(['mes', 'activo', 'tc', 'sin_atribuir']))
        expect(r.px, `${vista} · ${moneda}`).toBeLessThanOrEqual(LUGAR_768)
      }
    }
  })

  it('con cifras grandes (US$ 99.999,99 en cada línea), sin atribuir va a la ficha antes que desbordar: el mes y el resultado partido siguen a la vista', () => {
    const grande = par('-123456789', '-99999.99')
    const meses: MesVista[] = [
      {
        mes: '2026-10-01',
        nombre: 'oct-26',
        parcial: null,
        desde: '2026-10-01',
        hasta: '2026-10-31',
        lineas: CLAVES.map((clave) => ({ clave: clave as ClaveLineaPuente, nombre: NOMBRES[clave], valor: grande, informativa: false })),
        cuadre_ok: true,
      },
    ]
    const cols = medidasColumnasMes(meses, CLAVES, NOMBRES, 'ambas')
    // "−US$ 99.999,99 ▼": 16 caracteres, la pastilla y la flecha.
    expect(cols.find((x) => x.id === 'tc')?.ancho).toBe(Math.ceil(16 * PX_POR_CARACTER + 18 + 6 + 17))
    const r = ocupado(cols, LUGAR_768)
    expect(r.visibles).toEqual(new Set(['mes', 'activo', 'tc']))
    expect(r.ocultas).toEqual(['aportes', 'cuotas', 'amortizacion', 'sin_atribuir'])
    expect(r.px).toBeLessThanOrEqual(LUGAR_768)
  })
})

describe('el alto de las filas', () => {
  it('una moneda, un renglón; "Ambas", dos cifras apiladas', () => {
    expect(altoFilaMontos('ars', false)).toBe(44)
    expect(altoFilaMontos('usd', true)).toBe(44)
    expect(altoFilaMontos('ambas', false)).toBe(56)
  })

  it('con el dedo y las dos monedas, las dos cifras de 44 px (con su espacio de 2 px) entran en la fila y no pisan las de al lado (D-100)', () => {
    expect(altoFilaMontos('ambas', true)).toBe(ALTO_DOS_RENGLONES_TACTIL)
    // La fila tiene 1 px de borde; la celda, el resto.
    expect(altoFilaMontos('ambas', true) - 1).toBeGreaterThanOrEqual(44 + 2 + 44)
  })
})
