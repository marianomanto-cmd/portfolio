// El armador de Evolución (plan §1 y §4 B.3): toda cifra de la vista viene en
// par (pesos y dólares), cada una con su traza (fórmula no vacía, o "sin dato"
// con su motivo); el período se resuelve sobre fechas con carga; y con datos
// inventados de la app el puente cierra.
import { describe, expect, it } from 'vitest'
import type { CalcVista } from '@/lib/domain/calc'
import { hechosEjemplo, HOY_EJEMPLO } from './ejemplo'
import { armarEvolucion, futuroVista, resolverPeriodo, SIN_ENTRADAS } from './armar-evolucion'
import { ejemploEvolucion } from './ejemplo-evolucion'
import { destinoRecordado, hayEleccionEnLaUrl, hrefEvolucion, leerParametros, leerRecordado, paraRecordar, POR_DEFECTO } from '@/app/(app)/evolucion/_lib/parametros'

const esCalc = (x: unknown): x is CalcVista =>
  typeof x === 'object' && x !== null && 'formula' in x && 'insumos' in x && 'etiquetas' in x && 'valor' in x

/** Recorre la vista: cada CalcVista con traza, y cada objeto con ars o usd tiene las dos. */
function revisar(x: unknown, camino: string, problemas: string[]) {
  if (Array.isArray(x)) return x.forEach((y, i) => revisar(y, `${camino}[${i}]`, problemas))
  if (typeof x !== 'object' || x === null) return
  if (esCalc(x)) {
    if (x.valor === null && !x.motivo) problemas.push(`${camino}: "sin dato" sin motivo`)
    if (x.valor !== null && !x.formula.trim()) problemas.push(`${camino}: cifra sin fórmula`)
    return
  }
  const o = x as Record<string, unknown>
  if ('ars' in o || 'usd' in o) {
    const parDeCalc = esCalc(o.ars) || esCalc(o.usd)
    if (parDeCalc && !(esCalc(o.ars) && esCalc(o.usd))) problemas.push(`${camino}: monto sin su par`)
  }
  for (const [k, v] of Object.entries(o)) revisar(v, `${camino}.${k}`, problemas)
}

describe('armarEvolucion', () => {
  for (const demo of ['un-dia', 'semana', 'mes', null] as const) {
    for (const vista of ['financiero', 'total'] as const) {
      it(`${demo ?? 'por defecto'} · ${vista}: toda cifra con su par y su traza`, () => {
        const v = ejemploEvolucion({ ...POR_DEFECTO, vista }, demo)
        const problemas: string[] = []
        revisar(v, 'vista', problemas)
        expect(problemas).toEqual([])
      })
    }
  }

  it('demo "mes": el vencimiento de la LECAP cobra adentro de la app (no es un retiro); los aportes son solo el ingreso depositado', () => {
    const v = ejemploEvolucion({ ...POR_DEFECTO }, 'mes')
    expect(v.puente?.lineas.find((l) => l.clave === 'aportes')?.valor.ars.valor).toBe('3000000')
    expect(v.puente?.cuadre.ok).toBe(true)
  })

  it('el puente cierra con los hechos de ejemplo de la app (01/10 al 14/10)', () => {
    const v = armarEvolucion(hechosEjemplo(), HOY_EJEMPLO, POR_DEFECTO)
    expect(v.estado).toBe('periodo')
    expect(v.puente?.cuadre.ok).toBe(true)
    expect(v.puente?.cuadre.diferencia.ars.valor).toBe('0')
    expect(v.frase?.partes.length).toBeGreaterThan(3)
    expect(v.meses.map((m) => m.nombre)).toEqual(['oct-26'])
  })

  it('el período: semana, mes y 3 meses arrancan en la última carga en o antes del corte; elegir valida las fechas', () => {
    const fechas = ['2026-08-03', '2026-09-14', '2026-10-01', '2026-10-07', '2026-10-14']
    const p = POR_DEFECTO
    expect(resolverPeriodo(fechas, { ...p, periodo: 'todo' })).toMatchObject({ desde: '2026-08-03', hasta: '2026-10-14' })
    expect(resolverPeriodo(fechas, { ...p, periodo: 'semana' })).toMatchObject({ desde: '2026-10-07', hasta: '2026-10-14' })
    expect(resolverPeriodo(fechas, { ...p, periodo: 'mes' })).toMatchObject({ desde: '2026-09-14' })
    expect(resolverPeriodo(fechas, { ...p, periodo: '3m' })).toMatchObject({ desde: '2026-08-03' })
    expect(resolverPeriodo(fechas, { ...p, periodo: 'elegir', desde: '2026-09-14', hasta: '2026-10-07' })).toMatchObject({ desde: '2026-09-14', hasta: '2026-10-07', aviso: null })
    expect(resolverPeriodo(fechas, { ...p, periodo: 'elegir', desde: '2026-10-07', hasta: '2026-09-14' }).aviso).toMatch(/Elegí dos fechas/)
    expect(resolverPeriodo(['2026-10-14'], p)).toEqual({ desde: '2026-10-14', hasta: '2026-10-14', aviso: null })
    expect(resolverPeriodo([], p)).toEqual({ desde: null, hasta: null, aviso: null })
  })

  it('los parámetros de la URL: lo que no se entiende vuelve al valor por defecto; los enlaces no repiten lo que ya está por defecto', () => {
    expect(leerParametros({})).toEqual(POR_DEFECTO)
    expect(leerParametros({ vista: 'total', moneda: 'usd', periodo: 'mes', s: 'abc_-1' })).toMatchObject({ vista: 'total', moneda: 'usd', periodo: 'mes', s: 'abc_-1' })
    expect(leerParametros({ vista: 'x', moneda: 'eur', periodo: 'año', desde: '14/10', s: 'no válido!' })).toEqual(POR_DEFECTO)
    expect(hrefEvolucion(POR_DEFECTO)).toBe('/evolucion')
    expect(hrefEvolucion(POR_DEFECTO, { moneda: 'usd' }, 'mes')).toBe('/evolucion?demo=mes&moneda=usd')
    expect(hrefEvolucion(POR_DEFECTO, { periodo: 'elegir', desde: '2026-10-01', hasta: '2026-10-14' })).toBe('/evolucion?periodo=elegir&desde=2026-10-01&hasta=2026-10-14')
    // Un escenario guardado elegido en el bloque Futuro (?e=): solo un id.
    expect(leerParametros({ e: '7' }).e).toBe(7)
    for (const raro of ['0', '-1', '7x', '1.5', '']) expect(leerParametros({ e: raro }).e).toBeNull()
    expect(hrefEvolucion(POR_DEFECTO, { e: 7, s: null })).toBe('/evolucion?e=7')
  })

  it('lo recordado en el dispositivo (HO-7): solo qué mirás, la moneda y el período, validado al leerlo; la dirección manda', () => {
    expect(hayEleccionEnLaUrl({})).toBe(false)
    expect(hayEleccionEnLaUrl({ demo: 'mes', s: 'abc' })).toBe(false)
    expect(hayEleccionEnLaUrl({ periodo: 'semana' })).toBe(true)
    // Los controles escriben la elección entera: "Desde el día cero" manda sobre la semana recordada.
    expect(hrefEvolucion(POR_DEFECTO, { periodo: 'todo' }, null, { explicito: true })).toBe('/evolucion?vista=financiero&moneda=ambas&periodo=todo')
    expect(hayEleccionEnLaUrl(Object.fromEntries(new URLSearchParams('vista=financiero&moneda=ambas&periodo=todo')))).toBe(true)
    const p = leerParametros({ vista: 'total', moneda: 'usd', periodo: 'elegir', desde: '2026-10-01', hasta: '2026-10-14', s: 'abc' })
    const guardado = paraRecordar(p)
    expect(guardado).toEqual({ vista: 'total', moneda: 'usd', periodo: 'elegir', desde: '2026-10-01', hasta: '2026-10-14' })
    expect(leerRecordado(JSON.parse(JSON.stringify(guardado)))).toEqual({ ...p, s: null })
    // Lo que no se entiende no se usa.
    for (const raro of [null, 'semana', ['mes'], {}, { otra: 'cosa' }, 42]) expect(leerRecordado(raro)).toBeNull()
    expect(leerRecordado({ periodo: 'año', moneda: 'eur' })).toEqual(POR_DEFECTO)
    // Lo recordado cambia el período, nunca el escenario elegido: "Ver con: «…»" (?e=) no se pierde.
    const recordado = leerRecordado({ vista: 'financiero', moneda: 'ambas', periodo: 'todo' })!
    expect(destinoRecordado(recordado, { ...POR_DEFECTO, e: 7 })).toBeNull()
    expect(destinoRecordado(leerRecordado({ periodo: 'mes' })!, { ...POR_DEFECTO, e: 7 })).toBe('/evolucion?periodo=mes&e=7')
  })

  it('el futuro de un escenario guardado: "Ajustar supuestos" lleva sus supuestos a Flujo y se puede cambiar por otro guardado', () => {
    const pv = { escenario: { id: 8, nombre: 'Dólar al 2% por mes' }, proyeccion: { estado: 'faltan' as const, faltan: [], meses: [], cobertura: null, debajo: null } }
    const guardados = [
      { id: 8, nombre: 'Dólar al 2% por mes' },
      { id: 7, nombre: 'Dólar quieto' },
    ]
    // Sin ?s= en la dirección (se llegó a Evolución por el menú): antes, "Ajustar" abría Flujo vacío.
    const v = armarEvolucion(hechosEjemplo(), HOY_EJEMPLO, POR_DEFECTO, { ...SIN_ENTRADAS, futuro: pv, futuro_s: 'eyJ2IjoxfQ', escenarios: guardados })
    // Con su número: Flujo lo abre como ese escenario y "Guardar cambios" lo actualiza (no crea otro).
    expect(v.futuro?.ajustar).toBe('/flujo?s=eyJ2IjoxfQ&e=8')
    expect(v.futuro?.otros).toEqual([{ id: 7, nombre: 'Dólar quieto' }])
    expect(futuroVista(pv, null).otros).toEqual([])
    expect(futuroVista(pv, null).ajustar).toBe('/flujo')
  })

  it('el bloque Futuro: cada cifra proyectada lleva "supuesto" y "Ajustar supuestos" lleva los mismos supuestos a Flujo', () => {
    const v = ejemploEvolucion({ ...POR_DEFECTO, s: 'eyJ2IjoxfQ' }, 'mes')
    expect(v.futuro?.ajustar).toBe('/flujo?s=eyJ2IjoxfQ&e=1')
    for (const m of v.futuro!.meses) for (const c of [m.financiero.ars, m.aportes.usd, m.activo.ars, m.tc.usd]) expect(c.etiquetas).toContain('supuesto')
  })
})
