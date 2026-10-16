// Hoy (rediseño del 15/10, D-157, D-158): las cuentas de armar-hoy.ts. Con los
// hechos del ejemplo (números inventados, D-24): el patrimonio neto partido en
// activos y pasivos suma lo mismo que el total; la serie de 12 meses termina
// en el total de hoy; "Próximos 30 días" sale de la base de Flujo, en orden.
// Lo que falta es "sin dato" con su motivo, nunca cero.
import { describe, expect, it } from 'vitest'
import { calc, sinDato } from '@/lib/domain/calc'
import { Decimal } from '@/lib/domain/dinero'
import type { BaseProyeccion } from '@/lib/domain/flujo/tipos'
import { armarHoy } from './armar'
import { cclPeriodo, faltanParaElTotal, finDeMes, pesoEn, proximosDias, restarMeses, seriePatrimonio, SIN_BIENES, SIN_LEASING } from './armar-hoy'
import { hechosEjemplo, hechosVacios, HOY_EJEMPLO } from './ejemplo'
import { ejemploFlujo } from './ejemplo-flujo'

const D = (x: string | number) => new Decimal(x)

/** Los hechos del ejemplo sin bienes, o sin el leasing. */
function sinBienes() {
  const h = hechosEjemplo()
  h.bienes = []
  h.valuaciones = []
  return h
}
function sinPasivos() {
  const h = hechosEjemplo()
  h.pasivos = []
  h.pasivo_saldos = []
  return h
}

describe('faltanParaElTotal (D-03, D-126)', () => {
  it('con bienes y leasing cargados no falta nada', () => {
    expect(faltanParaElTotal(hechosEjemplo())).toEqual([])
  })

  it('sin bienes o sin leasing, cada uno con su motivo (dónde se cargan)', () => {
    expect(faltanParaElTotal(sinBienes()).map((x) => [x.nombre, x.calc.valor, x.calc.motivo])).toEqual([['Tus bienes (casa, auto)', null, SIN_BIENES]])
    expect(faltanParaElTotal(sinPasivos()).map((x) => [x.nombre, x.calc.motivo])).toEqual([['Capital pendiente del leasing', SIN_LEASING]])
  })
})

describe('pesoEn', () => {
  it('la fracción de un total positivo; null si falta algo o no hay nada que dibujar', () => {
    expect(pesoEn('25', '100')).toBe('0.25')
    expect(pesoEn(null, '100')).toBeNull()
    expect(pesoEn('25', null)).toBeNull()
    expect(pesoEn('25', '0')).toBeNull()
    expect(pesoEn('-25', '100')).toBeNull()
    expect(pesoEn('0', '100')).toBeNull()
  })
})

describe('balanceHoy: de qué está hecho el patrimonio neto (D-158)', () => {
  const v = armarHoy(hechosEjemplo(), HOY_EJEMPLO)
  const b = v.balance!

  it('activos (financiero + bienes) + pasivos = el patrimonio neto, en pesos y en dólares', () => {
    expect(b.activos.ars.valor).toBe('451911540')
    expect(D(b.activos.ars.valor!).minus(b.bienes.ars.valor!).toFixed()).toBe(v.financiero.valor.ars.valor)
    expect(b.pasivos.ars.valor).toBe('-21400000')
    for (const k of ['ars', 'usd'] as const) {
      expect(D(b.activos[k].valor!).plus(b.pasivos[k].valor!).toFixed()).toBe(D(v.total.valor[k].valor!).toFixed())
    }
    // Cada cifra con su traza.
    for (const c of [b.activos.ars, b.activos.usd, b.bienes.ars, b.bienes.usd, b.pasivos.ars, b.pasivos.usd]) expect(c.formula).toMatch(/=/)
  })

  it('los tramos: lo dolarizado primero, después lo que está en pesos (de mayor a menor), la liquidez junta y los bienes', () => {
    expect(b.tramos_activos.map((t) => t.rotulo)).toEqual(['SPY', 'YPFD', 'S13N6', 'T30J7', 'FIMA', 'TXMJ0', 'LIQ', 'CASA', 'CAMIONETA'])
    expect(b.tramos_pasivos.map((t) => t.rotulo)).toEqual(['LEASING'])
    // Los tramos suman el activo y sus pesos suman 1.
    expect(b.tramos_activos.reduce((a, t) => a.plus(t.valor.ars.valor!), D(0)).toFixed()).toBe(b.activos.ars.valor)
    expect(b.tramos_activos.reduce((a, t) => a + Number(t.peso), 0)).toBeCloseTo(1, 12)
    // La liquidez: los tres saldos (con el negativo) en un solo tramo.
    expect(b.tramos_activos.find((t) => t.clave === 'liquidez')?.valor.ars.valor).toBe('11229740')
    // La deuda se dibuja con su tamaño (positivo) sobre el activo.
    expect(Number(b.tramos_pasivos[0].peso)).toBeCloseTo(21400000 / 451911540, 12)
    // Toda cifra, en las dos monedas.
    for (const t of [...b.tramos_activos, ...b.tramos_pasivos]) {
      expect(t.valor.ars.valor, t.rotulo).not.toBeNull()
      expect(t.valor.usd.valor, t.rotulo).not.toBeNull()
    }
  })

  it('sin bienes: los bienes y el activo son "sin dato" con el motivo, nunca $ 0', () => {
    const x = armarHoy(sinBienes(), HOY_EJEMPLO).balance!
    expect(x.bienes.ars.valor).toBeNull()
    expect(x.bienes.ars.motivo).toBe(SIN_BIENES)
    expect(x.activos.ars.valor).toBeNull()
    expect(x.activos.ars.etiquetas).toContain('parcial')
    expect(x.tramos_activos.map((t) => t.rotulo)).not.toContain('CASA')
    // Sin el activo total no se dibuja ningún tramo a escala.
    expect(x.tramos_activos.every((t) => t.peso === null)).toBe(true)
  })

  it('sin leasing: los pasivos son "sin dato" con el motivo, nunca una deuda de $ 0', () => {
    const x = armarHoy(sinPasivos(), HOY_EJEMPLO).balance!
    expect(x.pasivos.ars.valor).toBeNull()
    expect(x.pasivos.usd.motivo).toBe(SIN_LEASING)
    expect(x.tramos_pasivos).toEqual([])
  })

  it('sin cargas no hay balance', () => {
    expect(armarHoy(hechosVacios(), HOY_EJEMPLO).balance).toBeNull()
  })
})

describe('cclPeriodo: el CCL del período de la frase', () => {
  const c = (v: string) => calc(D(v), v)

  it('hasta ÷ desde − 1, con la fórmula y las dos puntas', () => {
    const p = cclPeriodo(c('1531.7'), c('1548.2'), '2026-10-13', '2026-10-14')
    expect(Number(p.variacion.valor)).toBeCloseTo(1548.2 / 1531.7 - 1, 15)
    expect(p.variacion.formula).toBe('1.548,20 ÷ 1.531,70 − 1 = +1,08%')
    expect(p.desde.valor).toBe('1531.7')
    expect(p.hasta.valor).toBe('1548.2')
  })

  it('el que arma Hoy es el del período de la frase', () => {
    const v = armarHoy(hechosEjemplo(), HOY_EJEMPLO)
    expect(v.ccl_periodo?.variacion.formula).toBe('1.548,20 ÷ 1.531,70 − 1 = +1,08%')
  })

  it('sin un CCL, o con el anterior en cero, es "sin dato" con el motivo', () => {
    expect(cclPeriodo(c('1531.7'), sinDato('x'), '2026-10-13', '2026-10-14').variacion.motivo).toBe('Falta el CCL del mié 14/10.')
    expect(cclPeriodo(sinDato('x'), c('1548.2'), '2026-10-13', '2026-10-14').variacion.motivo).toBe('Falta el CCL del mar 13/10.')
    expect(cclPeriodo(c('0'), c('1548.2'), '2026-10-13', '2026-10-14').variacion.motivo).toBe('El CCL de la carga anterior es cero.')
  })
})

describe('restarMeses y finDeMes', () => {
  it('restan meses sin pasarse del último día del mes', () => {
    expect(restarMeses('2026-10-15', 12)).toBe('2025-10-15')
    expect(restarMeses('2026-01-15', 1)).toBe('2025-12-15')
    expect(restarMeses('2026-03-31', 1)).toBe('2026-02-28')
    expect(restarMeses('2028-03-31', 1)).toBe('2028-02-29')
    expect(restarMeses('2026-10-15', 0)).toBe('2026-10-15')
  })

  it('el último día del mes', () => {
    expect(finDeMes('2026-10-15')).toBe('2026-10-31')
    expect(finDeMes('2026-12-01')).toBe('2026-12-31')
    expect(finDeMes('2026-02-10')).toBe('2026-02-28')
    expect(finDeMes('2028-02-10')).toBe('2028-02-29')
  })
})

describe('seriePatrimonio: el patrimonio neto en cada fecha de carga', () => {
  it('un punto por carga, sin inventar días, y el último es el patrimonio neto de hoy', () => {
    const v = armarHoy(hechosEjemplo(), HOY_EJEMPLO)
    const s = seriePatrimonio(hechosEjemplo(), HOY_EJEMPLO)
    expect(s.puntos.map((p) => p.fecha)).toEqual(['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-13', '2026-10-14'])
    const ultimo = s.puntos.at(-1)!
    expect(ultimo.ars).toBe(v.total.valor.ars.valor)
    expect(D(ultimo.usd!).toFixed()).toBe(D(v.total.valor.usd.valor!).toFixed())
    // La historia del ejemplo arranca adentro de los 12 meses: el período no está completo.
    expect(s.periodo).toEqual({ desde: '2026-10-01', hasta: '2026-10-14', completo: false })
    expect(s.motivo).toBeNull()
  })

  it('cuánto cambió en cada moneda, con su fórmula, y el CCL de las dos puntas', () => {
    const s = seriePatrimonio(hechosEjemplo(), HOY_EJEMPLO)
    expect(s.variacion.ars.formula).toBe('$ 430.511.540 ÷ $ 418.067.910 − 1 = +2,98%')
    expect(Number(s.variacion.ars.valor)).toBeCloseTo(430511540 / 418067910 - 1, 12)
    expect(s.variacion.usd.formula).toMatch(/^US\$ 278\.072,30 ÷ US\$ 279\.214,53 − 1 = −0,41%$/)
    expect([s.ccl?.desde.valor, s.ccl?.hasta.valor]).toEqual(['1497.3', '1548.2'])
  })

  it('con historia más vieja que la ventana, la corta y lo dice (período completo)', () => {
    const s = seriePatrimonio(hechosEjemplo(), '2026-11-05', 1)
    expect(s.periodo).toEqual({ desde: '2026-10-05', hasta: '2026-10-14', completo: true })
    expect(s.puntos[0].fecha).toBe('2026-10-05')
  })

  it('sin bienes o sin leasing no hay patrimonio neto: vacía, con el motivo', () => {
    const s = seriePatrimonio(sinBienes(), HOY_EJEMPLO)
    expect(s.puntos).toEqual([])
    expect(s.motivo).toBe(`${SIN_BIENES} Sin eso no hay patrimonio neto.`)
    expect(s.variacion.ars.valor).toBeNull()
    expect(seriePatrimonio(sinPasivos(), HOY_EJEMPLO).motivo).toBe(`${SIN_LEASING} Sin eso no hay patrimonio neto.`)
  })

  it('sin cargas, o sin cargas en la ventana, lo dice', () => {
    expect(seriePatrimonio(hechosVacios(), HOY_EJEMPLO).motivo).toBe('Todavía no hay cargas.')
    expect(seriePatrimonio(hechosEjemplo(), '2027-12-01').motivo).toBe('No hay cargas en los últimos 12 meses.')
  })

  it('con una sola carga, la variación es "sin dato": hace falta una segunda', () => {
    const s = seriePatrimonio(hechosEjemplo(), '2026-10-01')
    expect(s.puntos).toHaveLength(1)
    expect(s.variacion.ars.motivo).toBe('Hace falta una segunda carga para ver cuánto cambió.')
  })
})

describe('proximosDias: "Próximos 30 días" (handoff, fila 3)', () => {
  const base = () => structuredClone(ejemploFlujo('completo').base) as BaseProyeccion

  it('la carga que falta, la cuota, el cierre del mes y lo que cobrás, en orden de fecha', () => {
    const e = proximosDias(base(), HOY_EJEMPLO, { cargaPendiente: true })
    expect(e.map((x) => [x.id, x.fecha, x.titulo, x.detalle, x.alerta])).toEqual([
      ['carga-hoy', '2026-10-15', 'Todavía no cargaste hoy', 'Ya cerró BYMA: los datos del día están para cargar.', true],
      ['cuota-1-14', '2026-10-17', 'Cuota 14 del leasing', 'La pagás vos', false],
      ['cierre-2026-10-31', '2026-10-31', 'Cierre del mes', 'Cargá el flujo real', false],
      ['vence-S13N6-2026-11-13', '2026-11-13', 'Vence S13N6', 'En 29 días · cobrás', false],
    ])
  })

  it('cada monto en pesos y en dólares (al CCL de la última carga), con su traza', () => {
    const e = proximosDias(base(), HOY_EJEMPLO)
    // La carga y el cierre no tienen monto: no se inventa uno.
    expect(e.filter((x) => x.tipo === 'cierre').map((x) => x.valor)).toEqual([null])
    const cuota = e.find((x) => x.tipo === 'cuota')!
    expect(cuota.valor?.ars.formula).toBe('cuota 14 = $ 1.339.200,00')
    expect(cuota.valor?.usd.formula).toBe('$ 1.339.200,00 ÷ CCL 1.548,20 = US$ 865,00')
    expect(Number(cuota.valor?.usd.valor)).toBeCloseTo(1339200 / 1548.2, 10)
    const s13 = e.find((x) => x.tipo === 'vencimiento')!
    expect(s13.valor?.ars.formula).toBe('11.500.000 VN × $ 1,1046 = $ 12.702.900,00')
    expect(s13.valor?.usd.valor).not.toBeNull()
  })

  it('un vencimiento a menos de 15 días va en alerta', () => {
    const s13 = proximosDias(base(), '2026-11-01').find((x) => x.tipo === 'vencimiento')!
    expect([s13.detalle, s13.alerta]).toEqual(['En 12 días · cobrás', true])
  })

  it('sin la carga pendiente no la muestra; sin base de Flujo, queda el cierre del mes', () => {
    expect(proximosDias(base(), HOY_EJEMPLO).map((x) => x.id)).not.toContain('carga-hoy')
    expect(proximosDias(null, HOY_EJEMPLO).map((x) => x.id)).toEqual(['cierre-2026-10-31'])
  })

  it('una cuota vencida que tu planilla no marca pagada: solo la más vieja, en alerta', () => {
    const b = base()
    const pasadas = b.cuotas.filter((c) => c.fecha_vencimiento < HOY_EJEMPLO).sort((x, y) => x.nro - y.nro)
    const [vieja, otra] = pasadas.slice(-2)
    vieja.pagada = false
    otra.pagada = false
    const cuotas = proximosDias(b, HOY_EJEMPLO).filter((x) => x.tipo === 'cuota')
    expect(cuotas.map((x) => x.id)).toEqual([`cuota-1-${vieja.nro}`, 'cuota-1-14'])
    expect(cuotas[0].alerta).toBe(true)
    expect(cuotas[0].detalle).toMatch(/^Venció el .+ y tu planilla no la marca pagada$/)
  })

  it('la cuota que paga la empresa lo dice', () => {
    const b = base()
    for (const c of b.cuotas) c.pagador = 'empresa'
    expect(proximosDias(b, HOY_EJEMPLO).find((x) => x.tipo === 'cuota')?.detalle).toBe('La paga la empresa')
  })

  it('sin CCL, los dólares son "sin dato"; sin el pago del bono, los dos', () => {
    const b = base()
    b.ccl = null
    const cuota = proximosDias(b, HOY_EJEMPLO).find((x) => x.tipo === 'cuota')!
    expect(cuota.valor?.ars.valor).toBe('1339200')
    expect(cuota.valor?.usd.valor).toBeNull()
    expect(cuota.valor?.usd.motivo).toBe('Falta el CCL para pasar a dólares.')
    const c = base()
    for (const v of c.vencimientos) {
      v.monto_ars = null
      v.motivo = 'Falta el cronograma.'
    }
    const s13 = proximosDias(c, HOY_EJEMPLO).find((x) => x.tipo === 'vencimiento')!
    expect([s13.valor?.ars.valor, s13.valor?.ars.motivo, s13.valor?.usd.valor]).toEqual([null, 'Falta el cronograma.', null])
  })
})
