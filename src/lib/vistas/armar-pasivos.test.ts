import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { CalcVista } from '@/lib/domain/calc'
import { leerCuadroMarcha, revisarCuadro } from '@/lib/carga/cuadro-marcha'
import { csvDeEjemplo, ejemploPasivos, hechosEjemploPasivos, hechosEjemploRevision, VARIANTES_PASIVOS, variantePasivos } from './ejemplo-pasivos'
import { armarPasivos, cclDeHoy } from './armar-pasivos'

// La vista de Pasivos (números inventados, D-24): toda cifra con su par ARS/USD
// y su traza, "sin dato" nunca cero, y cada estado del demo.

const esCalc = (x: unknown): x is CalcVista => typeof x === 'object' && x !== null && 'formula' in x && 'insumos' in x && 'etiquetas' in x

// Una cifra suelta (fuera de un par ARS/USD) solo donde el plan la pone así: el
// CCL, las partes de la frase (los pesos y los dólares van por separado), las
// columnas de la factura de cada cuota (su total tiene al lado total_usd), las
// tasas, los cocientes y los pesos de hoy (una lente que es en pesos).
const SUELTAS = [
  /^vista\.ccl$/,
  /^vista\.leasings\[\d+\]\.frase\[\d+\]\.calc$/,
  /^vista\.leasings\[\d+\]\.cuotas\[\d+\]\.(canon|seguro|subtotal|iva|percepcion|total|ccl_pago|total_usd)$/,
  /^vista\.leasings\[\d+\]\.(tea|tem|falta_pesos_hoy)$/,
  /^vista\.leasings\[\d+\]\.opcion\.alicuota$/,
  /^vista\.leasings\[\d+\]\.tarjetas\.costo\.(vs_valor|vs_valuacion)$/,
]

/** Recorre la vista: cada Calc tiene fórmula; cada cifra tiene su par (salvo SUELTAS); un sin dato tiene motivo. */
function revisar(v: unknown, camino = 'vista', out: string[] = []): string[] {
  if (Array.isArray(v)) v.forEach((x, i) => revisar(x, `${camino}[${i}]`, out))
  else if (esCalc(v)) {
    if (!v.formula) out.push(`${camino}: sin fórmula`)
    if (v.valor === null && !v.motivo) out.push(`${camino}: sin dato sin motivo`)
    if (!/\.(ars|usd)$/.test(camino) && !SUELTAS.some((r) => r.test(camino))) out.push(`${camino}: cifra sin su par en dólares`)
  } else if (typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>
    if ('ars' in o || 'usd' in o) {
      if (!esCalc(o.ars) && typeof o.ars !== 'string') out.push(`${camino}: falta ars`)
      if (!esCalc(o.usd) && typeof o.usd !== 'string') out.push(`${camino}: falta usd`)
    }
    for (const [k, x] of Object.entries(o)) revisar(x, `${camino}.${k}`, out)
  }
  return out
}

describe('la vista de Pasivos', () => {
  it('el CSV del ejemplo es el fixture de los tests (un solo ejemplo inventado)', () => {
    expect(csvDeEjemplo()).toBe(readFileSync(path.join(process.cwd(), 'tests/fixtures/cuadro-marcha.csv'), 'utf8'))
  })

  for (const v of VARIANTES_PASIVOS) {
    it(`demo "${v}": toda cifra con par y traza, y todo sin dato con su motivo`, () => {
      const vista = ejemploPasivos(v)
      expect(revisar(vista)).toEqual([])
      expect(JSON.parse(JSON.stringify(vista))).toEqual(vista) // serializable
    })
  }

  it('un estado desconocido es el de hoy (cuadro)', () => {
    expect(variantePasivos('x')).toBe('cuadro')
    expect(variantePasivos(undefined)).toBe('cuadro')
  })

  it('sin pasivo: aviso y ningún leasing', () => {
    const v = ejemploPasivos('sin-pasivo')
    expect(v.leasings).toEqual([])
    expect(v.aviso).toMatch(/Datos › Leasing/)
  })

  it('cuadro: la frase cuenta lo pagado, la próxima y lo que falta; valor de cancelación sin dato', () => {
    const [l] = ejemploPasivos('cuadro').leasings
    const frase = l.frase.map((p) => p.texto).join('')
    expect(frase).toContain('pagaste 14 de 35 cuotas')
    expect(frase).toContain('La próxima, la 15, vence el dom 01/11: $ 1.314.400')
    expect(frase).toContain('Faltan 21 cuotas: $ 27,6 M nominales')
    expect(frase).toContain('con el seguro a confirmar y la percepción supuesta según tu planilla')
    expect(frase).toContain('Valor de cancelación: sin dato (pedíselo a la leasera).')
    expect(l.tarjetas.pagadas).toBe(14)
    expect(l.cuotas[0].estado_texto).toBe('pagada · fecha sin dato')
    expect(l.cuotas[20].estado_texto).toBe('pendiente')
    expect(l.cuotas[20].usd_rotulo).toBe('al CCL de hoy')
    // Pagado en USD sin los CCL de los pagos: sin dato, no $ 0.
    expect(l.totales.pagado.usd.valor).toBeNull()
    expect(l.deuda.informada).toBeNull()
    expect(l.deuda.estimada?.par.ars.etiquetas).toContain('estimado')
    expect(l.deuda.segun_cuadro.ars.etiquetas).toContain('estimado')
    expect(l.deuda.segun_cuadro.ars.valor).not.toBeNull()
    expect(l.tea.valor).not.toBeNull()
    expect(l.indexado).toEqual([])
    expect(l.indexado_motivo).toMatch(/al menos dos cuotas/)
  })

  it('sin tasa: "Completar el contrato" en la TEA, la deuda según cuadro y la apertura', () => {
    const [l] = ejemploPasivos('sin-tasa').leasings
    expect(l.tea.valor).toBeNull()
    expect(l.tea.motivo).toMatch(/^Completar el contrato: falta el monto financiado neto y la fecha de desembolso/)
    expect(l.deuda.segun_cuadro.ars.valor).toBeNull()
    expect(l.cuotas[0].apertura.amortizacion.ars.valor).toBeNull()
    expect(l.contrato.faltan_para_tasa).toHaveLength(2)
  })

  it('completo: lo pagado en dólares, el gráfico indexado, el valor informado y el cargo', () => {
    const [l] = ejemploPasivos('completo').leasings
    expect(l.totales.pagado.usd.valor).not.toBeNull()
    expect(l.indexado).toHaveLength(14)
    expect(l.indexado[0]).toMatchObject({ nro: 1, ars: '100', usd: '100' })
    expect(Number(l.indexado[13].usd)).toBeLessThan(100)
    expect(l.deuda.informada?.par.ars.valor).toBe('19250000')
    expect(l.frase.map((p) => p.texto).join('')).toContain('Valor de cancelación que informó la leasera: $ 19.250.000')
    expect(l.cargos).toHaveLength(1)
    expect(l.cuotas[6].apertura.cargos.ars.valor).toBe('15000')
    expect(l.licuacion_pagadas.usd.valor).not.toBeNull()
    expect(l.contrato.pagador_habitual).toBe('titular')
  })

  it('apertura: en las pendientes, amortización + gasto = total', () => {
    const [l] = ejemploPasivos('cuadro').leasings
    const t = l.totales.apertura_pendientes
    expect(Number(t.amortizacion.ars.valor) + Number(t.gasto.ars.valor)).toBeCloseTo(Number(t.total.ars.valor), 2)
  })

  it('sin CCL cargado: sin dato con motivo; un CCL de hace una semana es viejo', () => {
    const { h, hp } = hechosEjemploPasivos('cuadro')
    expect(cclDeHoy({ tipos_cambio: [], feriados: [] }, '2026-10-14').motivo).toMatch(/ningún CCL/)
    expect(cclDeHoy(h, '2026-10-22').etiquetas).toContain('viejo')
    const v = armarPasivos({ ...h, tipos_cambio: [] }, hp, '2026-10-14')
    expect(v.leasings[0].tarjetas.falta.total.usd.valor).toBeNull()
    expect(v.leasings[0].tarjetas.falta.total.ars.valor).not.toBeNull()
  })
})

describe('el demo de Datos › Leasing con la revisión abierta', () => {
  it('la planilla de ejemplo es el fixture, y la actualizada trae la 14 facturada y una multa', () => {
    expect(csvDeEjemplo()).toBe(readFileSync(path.join(process.cwd(), 'tests/fixtures/cuadro-marcha.csv'), 'utf8'))
    const { hp, csv } = hechosEjemploRevision()
    expect(hp.cuotas.filter((c) => c.pagada)).toHaveLength(13)
    const l = leerCuadroMarcha(csv, { cuotasTotales: 35 })
    expect(l.errores).toEqual([])
    const r = revisarCuadro(l, hp.contratos[0], hp.cuotas)
    expect(r).toMatchObject({ leidas: 35, facturadas: 14, proyectadas: 21, nuevas: 0, actualizadas: 1, iguales: 34, cargos: 1, errores: [] })
    expect(r.cambios[0]).toMatchObject({ nro: 14, campos: expect.arrayContaining(['pasa a facturada', 'pagada']) })
    expect(r.opcion.estado).toBe('igual')
    expect(r.total_planilla).toBe(r.total_app)
    expect(l.cargos).toEqual([expect.objectContaining({ concepto: 'multa', cuota_nro: 13, importe: '15000', fuente: 'comprobante', fecha: '2026-09-10' })])
  })
})

describe('la licuación de la deuda y la tercera lente de lo que falta', () => {
  it('con una sola carga: sin dato, con el motivo', () => {
    const l = ejemploPasivos('cuadro').leasings[0]
    expect(l.licuacion_deuda.usd.valor).toBeNull()
    expect(l.licuacion_deuda.usd.motivo).toMatch(/segunda carga/)
    expect(l.falta_pesos_hoy.valor).toBeNull()
    expect(l.falta_pesos_hoy.motivo).toMatch(/IPC/)
  })

  it('con dos cargas: deuda del 30/09 × (1/1.460 − 1/1.500), con la etiqueta de la deuda', () => {
    const l = ejemploPasivos('completo').leasings[0]
    const usd = l.licuacion_deuda.usd
    expect(usd.valor).not.toBeNull()
    expect(Number(usd.valor)).toBeGreaterThan(0)
    // Al 30/09 no había saldo cargado: la deuda es la según el cuadro a esa fecha (estimado).
    expect(usd.etiquetas).toContain('estimado')
    expect(usd.insumos.map((i) => i.nombre)).toEqual(['Del 30/09/2026 al 14/10/2026'])
    expect(Number(usd.valor)).toBeCloseTo(312.04, 2)
  })
})

describe('las tarjetas', () => {
  it('la barra de progreso: 14 de 35 = 40 %', () => {
    const t = ejemploPasivos('cuadro').leasings[0].tarjetas
    expect({ pagadas: t.pagadas, total: t.total, progreso: t.progreso }).toEqual({ pagadas: 14, total: 35, progreso: 40 })
  })

  it('sin cuadro de marcha: 0 de 35 y la barra vacía', () => {
    const t = ejemploPasivos('sin-cuadro').leasings[0].tarjetas
    expect({ pagadas: t.pagadas, cargadas: t.cargadas, progreso: t.progreso }).toEqual({ pagadas: 0, cargadas: 0, progreso: 0 })
  })
})

describe('revisión: una cuota vencida sin pagar y la deuda que cuenta', () => {
  it('la 15 venció y la planilla no la marca pagada: la frase y la tarjeta lo dicen; la próxima es la 16', () => {
    const { h, hp } = hechosEjemploPasivos('cuadro')
    const [l] = armarPasivos(h, hp, '2026-11-05').leasings
    const frase = l.frase.map((p) => p.texto).join('')
    expect(frase).toContain('La cuota 15 venció el dom 01/11 y tu planilla no la marca pagada')
    expect(frase).toContain('La próxima, la 16, vence el')
    expect(l.tarjetas.vencidas).toEqual([{ nro: 15, fecha: '2026-11-01' }])
    expect(l.cuotas[14].estado_texto).toBe('vencida, sin pagar')
    // Con dos vencidas, en plural.
    const [l2] = armarPasivos(h, hp, '2026-12-03').leasings
    expect(l2.frase.map((p) => p.texto).join('')).toContain('Las cuotas 15 y 16 vencieron y tu planilla no las marca pagadas')
  })

  it('al día (la 15 vence el 01/11 y hoy es 14/10): ninguna vencida', () => {
    const [l] = ejemploPasivos('cuadro').leasings
    expect(l.tarjetas.vencidas).toEqual([])
    expect(l.frase.map((p) => p.texto).join('')).not.toContain('venció')
  })

  it('la deuda que cuenta (D-131): informada › según cuadro › estimada; sin ninguna, null (nunca "estimada" de mentira)', () => {
    expect(ejemploPasivos('completo').leasings[0].deuda.vigente).toBe('informada')
    expect(ejemploPasivos('cuadro').leasings[0].deuda.vigente).toBe('segun_cuadro')
    expect(ejemploPasivos('sin-tasa').leasings[0].deuda.vigente).toBe('estimada')
    expect(ejemploPasivos('sin-cuadro').leasings[0].deuda.vigente).toBe('estimada')
    // Sin saldo cargado y sin tasa: no hay ninguna deuda; el chip no puede decir "estimada".
    const { h, hp } = hechosEjemploPasivos('sin-tasa')
    const [l] = armarPasivos({ ...h, pasivo_saldos: [] }, hp, '2026-10-14').leasings
    expect(l.deuda.vigente).toBeNull()
  })
})

describe('revisión: el CCL dice de qué día es', () => {
  it('el último CCL cargado no es "de hoy" si es de otro día: la vista trae su fecha y "viejo" si pasaron más de 2 días hábiles', () => {
    const { h, hp } = hechosEjemploPasivos('cuadro')
    const al14 = armarPasivos(h, hp, '2026-10-14')
    expect(al14.ccl_fecha).toBe('2026-10-14')
    const al22 = armarPasivos(h, hp, '2026-10-22')
    expect(al22.ccl_fecha).toBe('2026-10-14')
    expect(al22.ccl.etiquetas).toContain('viejo')
    expect(armarPasivos({ ...h, tipos_cambio: [] }, hp, '2026-10-14').ccl_fecha).toBeNull()
  })
})

describe('revisión: la frase en el teléfono', () => {
  it('cada cifra de la frase está en su detalle, en pesos y en dólares, con traza (con el dedo la frase es texto)', () => {
    for (const v of ['cuadro', 'completo', 'sin-tasa'] as const) {
      const [l] = ejemploPasivos(v).leasings
      const enDetalle = new Set(l.frase_detalle.flatMap((f) => [f.ars?.valor, f.usd?.valor]))
      for (const p of l.frase.filter((x) => x.calc)) expect(enDetalle.has(p.calc!.valor), `${v}: "${p.texto}"`).toBe(true)
      for (const f of l.frase_detalle) {
        expect(f.ars?.formula, `${v}: ${f.etiqueta}`).toBeTruthy()
        expect(f.usd?.formula, `${v}: ${f.etiqueta}`).toBeTruthy()
      }
    }
    expect(ejemploPasivos('cuadro').leasings[0].frase_detalle.map((f) => f.etiqueta)).toEqual([
      'Próxima cuota (la 15)',
      'Falta pagar (21 cuotas)',
      'Canon que falta',
      'IVA, seguro y percepción que faltan',
    ])
    expect(ejemploPasivos('sin-cuadro').leasings[0].frase_detalle).toEqual([])
  })
})
