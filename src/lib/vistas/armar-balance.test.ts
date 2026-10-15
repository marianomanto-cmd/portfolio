import { describe, expect, it } from 'vitest'
import type { CalcVista } from '@/lib/domain/calc'
import { Decimal } from '@/lib/domain/dinero'
import { F13, F14, hechosBalance } from '@/lib/domain/balance.fixture'
import { armarBalance, chipsDe, redondearTramos, repartir, textoSin, titularBalance } from './armar-balance'
import type { VistaBalance } from './contratos-balance'
import { ejemploBalance, VARIANTES_BALANCE, varianteBalance } from './ejemplo-balance'

// Números inventados (balance.fixture.ts y el Apéndice B, D-24).

const esCalc = (x: unknown): x is CalcVista => typeof x === 'object' && x !== null && 'formula' in x && 'insumos' in x && 'etiquetas' in x

/** Recorre la vista y junta cada cifra con su camino ("activo.grupos.0.total.ars"). */
function cifras(v: unknown, camino = ''): { camino: string; c: CalcVista }[] {
  if (esCalc(v)) return [{ camino, c: v }]
  if (Array.isArray(v)) return v.flatMap((x, i) => cifras(x, `${camino}.${i}`))
  if (typeof v === 'object' && v !== null) return Object.entries(v).flatMap(([k, x]) => (k === 'serie' ? [] : cifras(x, camino ? `${camino}.${k}` : k)))
  return []
}

/** Cifras que no son montos: porcentajes, el CCL y las partes de la frase (que traen su par en el texto). */
const NO_MONTO = /(^|\.)(peso|financiero_peso|bienes_peso|total_peso|ccl)$|^frase\.|^indicadores\./

describe('toda cifra con su par y su traza (CLAUDE.md)', () => {
  for (const variante of VARIANTES_BALANCE) {
    it(`demo ${variante}`, () => {
      const v = ejemploBalance(variante)
      expect(() => JSON.parse(JSON.stringify(v))).not.toThrow()
      const todas = cifras(v)
      expect(todas.length).toBeGreaterThan(variante === 'vacio' ? 5 : 40)
      for (const { camino, c } of todas) {
        expect(c.formula, camino).not.toBe('')
        if (c.valor === null) expect(c.motivo, `${camino} sin motivo`).toBeTruthy()
        // Un monto vive en un Par: su camino termina en .ars o .usd, y existe el otro.
        if (!NO_MONTO.test(camino)) expect(camino, `${camino} no está en un par`).toMatch(/\.(ars|usd)$/)
      }
      const pares = todas.filter((x) => /\.ars$/.test(x.camino)).map((x) => x.camino.replace(/\.ars$/, '.usd'))
      const usd = new Set(todas.map((x) => x.camino))
      for (const p of pares) expect(usd.has(p), `${p} falta`).toBe(true)
    })
  }

  it('un "sin dato" nunca es cero ni trae un valor', () => {
    for (const variante of VARIANTES_BALANCE) {
      for (const { c } of cifras(ejemploBalance(variante))) if (c.valor === null) expect(c.formula).toBe('sin dato')
    }
  })
})

describe('la cifra grande', () => {
  it('deuda estimada (hoy en producción): "Patrimonio neto · deuda del leasing estimada", con lo firme debajo', () => {
    const v = armarBalance(hechosBalance({ deuda: 'estimada' }), F14)
    expect(v.titular.rotulo).toBe('Patrimonio neto · deuda del leasing estimada')
    expect(v.titular.estimado).toBe(true)
    expect(v.titular.parcial).toBe(false)
    expect(v.titular.valor.ars.valor).toBe('390000000')
    expect(v.titular.valor.ars.etiquetas).toContain('estimado')
    expect(v.titular.firme?.rotulo).toBe('Sin la camioneta: financiero + casa')
    expect(v.titular.firme?.valor.ars.valor).toBe('375000000')
    expect(v.titular.firme?.valor.ars.etiquetas).not.toContain('estimado')
    expect(v.titular.chips).toEqual(['estimado'])
    expect(v.titular.firme?.chips).toEqual([])
    expect(v.titular.nota).toMatch(/estimaste el jue 08\/10/)
    expect(v.titular.accion?.href).toBe('/datos/leasing')
    expect(v.pasivo.filas[0].detalle).toBe('estimada por vos el jue 08/10 · provisoria')
    expect(v.pasivo.filas[0].origen).toBe('estimada')
  })

  it('sin ninguna deuda: la cifra grande es "sin la camioneta", parcial, y el completo es sin dato', () => {
    const v = armarBalance(hechosBalance({ deuda: 'ninguna' }), F14)
    expect(v.titular.parcial).toBe(true)
    expect(v.titular.rotulo).toBe('Patrimonio neto sin la camioneta')
    expect(v.titular.chips).toEqual(['parcial'])
    expect(v.titular.valor.ars.valor).toBe('375000000')
    // La traza de la cifra grande lleva "parcial" y dice qué deja afuera; el renglón de lo firme, no.
    expect(v.titular.valor.ars.etiquetas).toContain('parcial')
    expect(v.titular.valor.ars.explicacion).toMatch(/^Lo que tenés, sin la camioneta: la camioneta y su leasing entran juntos cuando la leasera te pase el valor de cancelación\./)
    expect(v.neto.lineas.find((l) => l.clave === 'sin_financiados')?.valor.ars.etiquetas).not.toContain('parcial')
    expect(v.titular.nota).toBe('La camioneta ($ 36,0 M) y su leasing entran juntos cuando cargues el valor de cancelación.')
    expect(v.neto.completo.ars.valor).toBeNull()
    expect(v.neto.completo.ars.etiquetas).toContain('parcial')
    expect(v.pasivo.filas[0].valor.ars.valor).toBeNull()
    expect(v.pasivo.filas[0].accion?.etiqueta).toBe('Cargar el valor de cancelación')
  })

  it('con el valor de cancelación: "Patrimonio neto" a secas y la camioneta neta como renglón', () => {
    const v = armarBalance(hechosBalance({ deuda: 'informada' }), F14)
    expect(v.titular.rotulo).toBe('Patrimonio neto')
    expect(v.titular.firme).toBeNull()
    expect(v.titular.estimado).toBe(false)
    expect(v.neto.lineas.find((l) => l.clave.startsWith('participacion'))?.valor.ars.valor).toBe('16500000')
    expect(v.pasivo.filas[0].accion).toBeNull()
  })

  it('una casa sin valuación sale de lo firme y se nombra', () => {
    const v = armarBalance(hechosBalance({ deuda: 'estimada', casaSinValuacion: true }), F14)
    expect(v.sin_texto).toBe('sin la camioneta ni la casa, que no tiene valuación')
    expect(v.titular.parcial).toBe(true)
    expect(v.activo.bienes.find((b) => b.nombre === 'Casa')?.accion?.etiqueta).toBe('Cargar valuación')
    expect(v.activo.bienes.find((b) => b.nombre === 'Casa')?.valor.ars.valor).toBeNull()
  })

  it('sin bienes: sin dato con el financiero como suma parcial', () => {
    const v = armarBalance(hechosBalance({ sinBienes: true }), F14)
    expect(v.titular.valor.ars.valor).toBeNull()
    expect(v.titular.valor.ars.motivo).toMatch(/Faltan tus bienes/)
    expect(v.titular.firme?.valor.ars.valor).toBe('105000000')
    expect(v.frase.map((x) => x.texto).join('')).toMatch(/faltan tus bienes/)
  })

  it('sin cargas: el estado vacío dice qué hacer', () => {
    const v = ejemploBalance('vacio')
    expect(v.estado).toBe('sin_cargas')
    expect(v.titular.accion?.href).toBe('/carga')
    expect(v.serie).toEqual([])
  })
})

describe('la frase de arriba', () => {
  it('estimada: dice el neto, lo firme y cómo se reparte, con cada cifra tocable', () => {
    const v = armarBalance(hechosBalance({ deuda: 'estimada' }), F14)
    const t = v.frase.map((x) => x.texto).join('')
    expect(t).toBe('Tu patrimonio neto es $ 390,0 M (US$ 260.000), con la deuda del leasing estimada. Sin la camioneta, $ 375,0 M (US$ 250.000). De eso, la casa es el 72%; lo invertible, el 28%.')
    expect(v.frase.filter((x) => x.calc).length).toBe(6)
  })

  it('sin deuda: "Tenés … sin contar la camioneta"', () => {
    const v = armarBalance(hechosBalance({ deuda: 'ninguna' }), F14)
    expect(v.frase.map((x) => x.texto).join('')).toMatch(/^Tenés \$ 375,0 M \(US\$ 250\.000\) sin contar la camioneta\. La casa es el 72%; lo invertible, el 28%\.$/)
  })

  it('con una sola parte no hay reparto ("lo invertible es el 100%" no se dice)', () => {
    const v = ejemploBalance('sin-valuacion')
    const texto = v.frase.map((x) => x.texto).join('')
    expect(texto).toMatch(/^Tenés .+ sin contar la camioneta ni la casa, que no tiene valuación\.$/)
    expect(texto).not.toMatch(/100%/)
  })

  it('informada: el neto repartido en lo invertible, la casa y tu parte de la camioneta, que suman 100%', () => {
    const v = armarBalance(hechosBalance({ deuda: 'informada' }), F14)
    const t = v.frase.map((x) => x.texto).join('')
    expect(t).toMatch(/^Tu patrimonio neto es \$ 391,5 M/)
    const pcts = v.frase.filter((x) => /%$/.test(x.texto)).map((x) => Number(x.texto.replace('%', '')))
    expect(pcts.reduce((a, b) => a + b, 0)).toBe(100)
  })
})

describe('composición y pesos', () => {
  it('cada barra suma 100,0% a la vista y su ancho sale del peso exacto', () => {
    const v = ejemploBalance('estimada')
    for (const per of ['financiero', 'total'] as const) {
      for (const eje of ['moneda', 'clase', 'liquidez'] as const) {
        const s = v.composicion[per][eje]
        expect(s.length).toBeGreaterThan(0)
        const total = s.reduce((a, x) => a.plus(x.pct ?? '0'), new Decimal(0))
        expect(total.toFixed(1), `${per}/${eje}`).toBe('100.0')
      }
    }
    expect(v.composicion.total.moneda.find((s) => s.clave === 'sin_elegir')?.regla).toMatch(/D-73/)
    expect(v.activo.tramos.map((t) => t.nombre)).toEqual(['Financiero', 'Casa', 'Camioneta'])
  })

  it('redondearTramos: sin dato en uno, ninguno lleva porcentaje', () => {
    const sd: CalcVista = { valor: null, motivo: 'x', formula: 'sin dato', insumos: [], etiquetas: [] }
    const ok: CalcVista = { valor: '0.5', formula: 'f', insumos: [], etiquetas: [] }
    expect(redondearTramos([{ peso: ok }, { peso: sd }]).map((x) => x.pct)).toEqual([null, null])
    expect(redondearTramos([{ peso: { ...ok, valor: '0.33333' } }, { peso: { ...ok, valor: '0.33333' } }, { peso: { ...ok, valor: '0.33334' } }]).map((x) => x.pct)).toEqual(['33.3', '33.3', '33.4'])
  })

  it('el activo total suma sus partidas y cada peso es sobre el activo', () => {
    const v = armarBalance(hechosBalance({ deuda: 'estimada' }), F14)
    expect(v.activo.total.ars.valor).toBe('411000000')
    expect(v.activo.total.usd.valor).toBe('274000')
    expect(new Decimal(v.activo.financiero_peso.valor!).toFixed(4)).toBe('0.2555')
    expect(v.activo.tramos.map((t) => t.pct)).toEqual(['25.5', '65.7', '8.8'])
    // Las partidas de lo financiero suman lo que se ve del financiero; los grupos, sus partidas.
    const hojas = v.activo.grupos.flatMap((g) => g.filas)
    expect(hojas.reduce((a, f) => a.plus(f.pct!), new Decimal(0)).toFixed(1)).toBe('25.5')
    for (const g of v.activo.grupos) expect(g.filas.reduce((a, f) => a.plus(f.pct!), new Decimal(0)).toFixed(1)).toBe(g.pct)
    expect(v.activo.total_pct).toBe('100.0')
    const filas = [...v.activo.grupos.flatMap((g) => g.filas), ...v.activo.bienes]
    const suma = filas.reduce((a, f) => a.plus(f.peso.valor!), new Decimal(0))
    expect(suma.minus(1).abs().lt('1e-30')).toBe(true)
  })
})

describe('repartir (resto mayor hacia un total dado)', () => {
  it('suma el objetivo y cada parte queda a menos de una unidad', () => {
    const r = repartir(new Decimal('25.5'), ['10.6', '10.17', '4.777'].map((x) => new Decimal(x)), 1)
    expect(r.map((x) => x.toFixed(1))).toEqual(['10.6', '10.1', '4.8'])
    const neg = repartir(new Decimal('5.0'), ['5.12', '-0.12'].map((x) => new Decimal(x)), 1)
    expect(neg.reduce((a, x) => a.plus(x), new Decimal(0)).toFixed(1)).toBe('5.0')
  })
})

describe('fecha, agrupar y evolución', () => {
  it('cualquier fecha de carga; una que no es de carga vuelve a la última', () => {
    const h = hechosBalance({ deuda: 'estimada' })
    expect(armarBalance(h, F14, { fecha: F13 }).fecha).toBe(F13)
    expect(armarBalance(h, F14, { fecha: F13 }).ultima).toBe(false)
    expect(armarBalance(h, F14, { fecha: '2026-10-01' }).fecha).toBe(F14)
    expect(armarBalance(h, F14, { fecha: F13 }).serie.map((p) => p.fecha)).toEqual([F13])
  })

  it('agrupar por instrumento y por clase; un valor que no existe vuelve a cuenta', () => {
    const h = hechosBalance({ deuda: 'estimada' })
    expect(armarBalance(h, F14, { agrupar: 'instrumento' }).activo.grupos.map((g) => g.clave)).toContain('m:ARS')
    expect(armarBalance(h, F14, { agrupar: 'clase' }).agrupar).toBe('clase')
    expect(armarBalance(h, F14, { agrupar: 'cualquiera' }).agrupar).toBe('cuenta')
  })

  it('un día: la evolución es un punto', () => {
    expect(ejemploBalance('un-dia').serie).toHaveLength(1)
    expect(ejemploBalance('estimada').serie.length).toBeGreaterThan(5)
  })

  it('precios viejos: chip en la fila y "viejo" en el total del grupo', () => {
    const v = ejemploBalance('viejo')
    const filas = v.activo.grupos.flatMap((g) => g.filas)
    expect(filas.some((f) => f.chips.some((c) => /^viejo · hace \d+ d háb\.$/.test(c)))).toBe(true)
    expect(v.activo.grupos.some((g) => g.total.ars.etiquetas.includes('viejo'))).toBe(true)
    // …y en las cifras de arriba que la incluyen, además de "estimado".
    expect(v.titular.chips).toEqual(['estimado', 'viejo'])
    expect(v.titular.firme?.chips).toEqual(['viejo'])
    expect(v.activo.total_chips).toEqual(['viejo'])
  })

  it('chipsDe: primero lo que dice la pantalla, sin repetir, por gravedad, sin "declarado" ni "inferido"', () => {
    expect(chipsDe({ etiquetas: ['viejo', 'estimado', 'declarado', 'parcial'] }, ['estimado'], ['parcial'])).toEqual(['estimado', 'viejo'])
    expect(chipsDe({ etiquetas: ['inferido'] })).toEqual([])
    expect(chipsDe({ etiquetas: ['a_confirmar', 'proyectado'] })).toEqual(['a confirmar', 'proyectado'])
  })
})

describe('indicadores', () => {
  it('con la deuda estimada: solvencia, endeudamiento e inmovilización, redondeados y con su chip', () => {
    const v = armarBalance(hechosBalance({ deuda: 'estimada' }), F14)
    expect(v.indicadores.map((x) => x.clave)).toEqual(['solvencia', 'endeudamiento', 'inmovilizacion'])
    expect(v.indicadores[0].texto).toMatch(/^\d+,\d veces$/)
    expect(v.indicadores[1].texto).toMatch(/^\d+,\d%$/)
    expect(v.indicadores[0].chips).toEqual(['estimado'])
    expect(v.indicadores[2].chips).toEqual([])
  })

  it('sin la deuda: sin dato, nunca cero; sin cargas: ninguno', () => {
    const v = armarBalance(hechosBalance({ deuda: 'ninguna' }), F14)
    expect(v.indicadores[0].texto).toBeNull()
    expect(v.indicadores[0].valor.motivo).toBeTruthy()
    expect(ejemploBalance('vacio').indicadores).toEqual([])
  })
})

describe('comparativo', () => {
  it('por defecto contra la primera carga; otra fecha anterior si la pedís; una inválida vuelve a la primera', () => {
    const v = ejemploBalance('estimada')
    const c = v.comparativo
    expect(c?.fecha).toBe(v.fechas[0])
    expect(c?.por_defecto).toBe(v.fechas[0])
    expect(c?.opciones).toEqual(v.fechas.filter((f) => f < (v.fecha as string)))
    expect(ejemploBalance('estimada', { comparar: '2026-10-08' }).comparativo?.fecha).toBe('2026-10-08')
    expect(ejemploBalance('estimada', { comparar: '2026-10-14' }).comparativo?.fecha).toBe(v.fechas[0])
    expect(ejemploBalance('estimada', { comparar: 'cualquiera' }).comparativo?.fecha).toBe(v.fechas[0])
  })

  it('cada renglón: lo actual es la cifra del balance y la diferencia es actual − anterior, en las dos monedas', () => {
    const v = ejemploBalance('estimada', { comparar: '2026-10-08' })
    const c = v.comparativo!
    expect(c.lineas.map((l) => l.clave)).toEqual(['financiero', 'bienes', 'activo', 'pasivo', 'completo', 'sin_financiados'])
    const neto = c.lineas.find((l) => l.clave === 'completo')!
    expect(neto.actual).toEqual(v.neto.completo)
    for (const l of c.lineas) {
      for (const m of ['ars', 'usd'] as const) {
        const [a, b, d] = [l.actual[m].valor, l.anterior[m].valor, l.diferencia[m].valor]
        if (a === null || b === null) expect(d).toBeNull()
        else expect(new Decimal(d as string).eq(new Decimal(a).minus(b))).toBe(true)
        expect(l.sin_cambios[m]).toBe(d !== null && new Decimal(d).isZero())
      }
    }
    expect(neto.diferencia.ars.explicacion).toMatch(/No es una ganancia/)
  })

  it('con una sola fecha de carga (hasta la del balance) no hay comparativo', () => {
    expect(ejemploBalance('un-dia').comparativo).toBeNull()
    expect(ejemploBalance('estimada', { fecha: ejemploBalance('estimada').fechas[0] }).comparativo).toBeNull()
  })
})

describe('la tarjeta de Hoy (§10.5)', () => {
  it('titularBalance dice lo mismo que la cifra grande del Balance, a la última fecha', () => {
    for (const deuda of ['estimada', 'informada', 'ninguna'] as const) {
      const h = hechosBalance({ deuda })
      const t = titularBalance(h, F14)
      const v = armarBalance(h, F14)
      expect(t?.fecha).toBe(v.fecha)
      expect(t?.rotulo).toBe(v.titular.rotulo)
      expect(t?.valor).toEqual(v.titular.valor)
      expect(t?.chips).toEqual(v.titular.chips)
      expect(t?.firme).toEqual(v.titular.firme)
    }
    expect(titularBalance({ ...hechosBalance(), cargas: [], tipos_cambio: [], cotizaciones: [], saldos: [], operaciones: [] }, F14)).toBeNull()
  })
})

describe('integración con Pasivos (§10.3)', () => {
  it('según el cuadro de marcha: el origen y lo que falta pagar, que nunca resta', () => {
    const v: VistaBalance = ejemploBalance('segun-cuadro')
    expect(v.neto.origen_deuda).toBe('segun_cuadro')
    expect(v.pasivo.filas[0].detalle).toMatch(/cuadro de marcha/)
    expect(v.pasivo.filas[0].referencia?.cuotas).toBe(34)
    // El pasivo total es la deuda, no lo que falta pagar.
    expect(v.pasivo.total.ars.valor).toBe('20949248.34')
  })

  it('sin cuadro de marcha, la referencia es null (la pantalla muestra su estado vacío)', () => {
    expect(ejemploBalance('estimada').pasivo.filas[0].referencia).toBeNull()
  })
})

describe('palabras', () => {
  it('textoSin y varianteBalance', () => {
    const v = armarBalance(hechosBalance({ deuda: 'ninguna' }), F14)
    expect(v.sin_texto).toBe('sin la camioneta')
    expect(textoSin({ excluidos: [] } as never)).toBeNull()
    expect(varianteBalance('nada')).toBe('estimada')
  })
})

// Revisión del 15/10: casos que fallaban (cada uno, con su arreglo).
describe('revisión: sin CCL, la cifra grande no pide el valor de cancelación que ya está', () => {
  it('todo en pesos y sin ningún CCL: "Patrimonio neto · deuda estimada" en pesos, los dólares sin dato por el CCL', () => {
    const base = hechosBalance({ deuda: 'estimada' })
    const h = {
      ...base,
      tipos_cambio: [],
      saldos: base.saldos.filter((s) => s.moneda === 'ARS'),
      bienes: base.bienes.map((b) => (b.id === 1 ? { ...b, moneda_valuacion: 'ARS' as const } : b)),
      valuaciones: base.valuaciones.map((x) => (x.bien_id === 1 ? { ...x, valor: new Decimal('270000000') } : x)),
    }
    const v = armarBalance(h, F14)
    expect(v.titular.rotulo).toBe('Patrimonio neto · deuda del leasing estimada')
    expect(v.titular.valor.ars.valor).toBe('384000000') // 99 + 270 + (36 − 21)
    expect(v.titular.valor.usd.valor).toBeNull()
    expect(v.titular.valor.usd.motivo).toMatch(/CCL/)
    expect(v.pasivo.filas[0].detalle).toMatch(/^estimada por vos el /)
    expect(v.pasivo.filas[0].valor.ars.valor).toBe('21000000')
    expect(v.pasivo.filas[0].accion?.etiqueta).toBe('Cargar el valor de la leasera')
  })
})

describe('revisión: los nombres de las deudas en los motivos', () => {
  it('sin deuda: "Falta la deuda del leasing de la camioneta"; sin bienes: "el bien que financia el leasing…"', () => {
    expect(ejemploBalance('sin-deuda').pasivo.filas[0].valor.ars.motivo).toMatch(/^Falta la deuda del leasing de la camioneta:/)
    const sb = ejemploBalance('sin-bienes')
    expect(sb.pasivo.filas[0].valor.ars.motivo).toMatch(/^No cargaste el bien que financia el leasing de la camioneta:/)
    expect(sb.neto.lineas[0].valor.ars.motivo).toMatch(/^Falta el bien que financia el leasing de la camioneta\./)
    expect(ejemploBalance('estimada').activo.bienes.find((b) => b.nombre === 'Camioneta')?.chips).toContain('financiada por el leasing de la camioneta')
  })
})

describe('revisión: los porcentajes del pasivo y del patrimonio neto suman lo que dicen', () => {
  const suma = (xs: (string | null | undefined)[]) => xs.reduce((a, x) => a.plus(x as string), new Decimal(0)).toFixed(1)
  const casos: [string, VistaBalance][] = [
    ['fixture estimada', armarBalance(hechosBalance({ deuda: 'estimada' }), F14)],
    ['fixture informada', armarBalance(hechosBalance({ deuda: 'informada' }), F14)],
    ['demo completo', ejemploBalance('completo')],
    ['demo segun-cuadro', ejemploBalance('segun-cuadro')],
    ['demo estimada', ejemploBalance('estimada')],
  ]
  for (const [nombre, v] of casos) {
    it(`${nombre}: pasivo + patrimonio neto = 100,0% y lo firme + tu parte = patrimonio neto`, () => {
      const linea = (clave: string) => v.neto.lineas.find((l) => l.clave === clave)
      const completo = linea('completo')?.pct
      expect(completo, nombre).not.toBeNull()
      expect(suma([v.pasivo.pct, completo]), nombre).toBe('100.0')
      const partes = v.neto.lineas.filter((l) => l.clave === 'sin_financiados' || l.clave.startsWith('participacion:')).map((l) => l.pct)
      expect(suma(partes), nombre).toBe(new Decimal(completo as string).toFixed(1))
      expect(suma(v.pasivo.filas.map((f) => f.pct)), nombre).toBe(new Decimal(v.pasivo.pct as string).toFixed(1))
    })
  }
})

describe('revisión: la liquidez de cada partida va a su traza (D-132)', () => {
  it('el porcentaje de cada fila dice su liquidez y la regla', () => {
    const v = ejemploBalance('estimada')
    const spy = v.activo.grupos.flatMap((g) => g.filas).find((f) => f.nombre.startsWith('SPY'))!
    expect(spy.peso.explicacion).toContain(spy.regla_liquidez)
    expect(spy.peso.explicacion).toMatch(/Liquidez: con venta en el mercado/)
    const casa = v.activo.bienes.find((b) => b.nombre === 'Casa')!
    expect(casa.peso.explicacion).toContain(casa.regla_liquidez)
  })
})

describe('revisión: la deuda según el cuadro del demo es la cuenta que dice su fórmula', () => {
  it('VP de 34 cánones de $ 1.000.000 y la opción de $ 3.800.000, a la TEA escrita en la fórmula', () => {
    const v = ejemploBalance('segun-cuadro')
    const c = v.pasivo.filas[0].valor.ars.insumos[0].calc!
    const m = /TEA del contrato de (\d+),(\d+)%/.exec(c.formula)
    expect(m, c.formula).not.toBeNull()
    const tea = new Decimal(`${m![1]}.${m![2]}`).div(100)
    const i = tea.plus(1).pow(new Decimal(1).div(12)).minus(1)
    const vf = i.plus(1).pow(-34)
    const vp = new Decimal(1_000_000).times(new Decimal(1).minus(vf)).div(i).plus(new Decimal(3_800_000).times(vf))
    // Lo que dice la fórmula es lo que vale (al centavo).
    expect(new Decimal(c.valor!).minus(vp).abs().lte('0.01'), `${c.valor} ≠ ${vp.toFixed(2)}`).toBe(true)
    expect(v.pasivo.total.ars.valor).toBe('20949248.34')
  })
})
