import { describe, expect, it } from 'vitest'
import { lecturaPlana, validarLectura } from '@/components/pantalla/lectura'
import { ejemploPasivos } from '@/lib/vistas/ejemplo-pasivos'
import type { FilaCuota, VistaLeasing } from '@/lib/vistas/contratos-pasivos'
import { cifrasPasivo, fechaEnPalabras, filtrarCuadro, hayInciertas, lecturaPasivos, notaCuota, proximasCuotas, tendenciaUsd, tiraCuotas, vencidasSinPagar } from './pantalla'

// La lectura, la tira, las cuatro cifras y las próximas cuotas de Pasivos
// (rediseño del 15/10), sobre el ejemplo inventado del demo (D-24): 35 cuotas,
// 14 pagadas, la próxima el 01/11/2026.

const conUsd = (c: FilaCuota, usd: string | null): FilaCuota => ({ ...c, total_usd: { ...c.total_usd, valor: usd } })

describe('lecturaPasivos', () => {
  it('sin CCL de los pagos: cuántas pagaste y cuántas faltan, con un solo énfasis', () => {
    const l = lecturaPasivos(ejemploPasivos('cuadro'))
    expect(validarLectura(l)).toEqual({ ok: true })
    expect(lecturaPlana(l)).toBe('Pagaste 14 de 35 cuotas. Te faltan 21, hasta el 1 de julio de 2028.')
    expect(l.find((p) => p.enfasis)?.texto).toBe('21')
  })

  it('con el CCL de cada pago: cómo cambió la cuota en dólares (la última contra la primera, si no bajó siempre)', () => {
    const v = ejemploPasivos('completo')
    const l = lecturaPasivos(v)
    expect(validarLectura(l)).toEqual({ ok: true })
    // En el ejemplo la cuota 4 no trae percepción: la 5 cuesta un poco más en dólares que la 4.
    expect(lecturaPlana(l)).toBe('Pagaste 14 de 35 cuotas. En dólares, la última te costó menos que la primera.')
  })

  it('si cada una costó menos dólares que la anterior, lo dice así (el énfasis del diseño)', () => {
    const [l0] = ejemploPasivos('completo').leasings
    const usd = ['900', '880', '880', '850', '820', '800', '780', '760', '740', '720', '700', '690', '680', '670']
    const cuotas = l0.cuotas.map((c) => (c.pagada ? conUsd(c, usd[c.nro - 1]) : c))
    const l = lecturaPasivos({ leasings: [{ ...l0, cuotas }] })
    expect(lecturaPlana(l)).toBe('Pagaste 14 de 35 cuotas. Cada una te costó menos dólares que la anterior.')
    expect(l.find((p) => p.enfasis)?.texto).toBe('menos')
  })

  it('una cuota vencida que la planilla no marca pagada va primero', () => {
    const [l0] = ejemploPasivos('cuadro').leasings
    const l = lecturaPasivos({ leasings: [{ ...l0, hoy: '2026-11-05' }] })
    expect(lecturaPlana(l)).toBe('Pagaste 14 de 35 cuotas. La 15 venció y tu planilla no la marca pagada.')
    const dos = lecturaPasivos({ leasings: [{ ...l0, hoy: '2026-12-05' }] })
    expect(lecturaPlana(dos)).toBe('Pagaste 14 de 35 cuotas. Las 15 y 16 vencieron y tu planilla no las marca pagadas.')
  })

  it('sin cuadro, sin pasivos y con todo pagado', () => {
    expect(lecturaPlana(lecturaPasivos(ejemploPasivos('sin-cuadro')))).toContain('todavía no importaste el cuadro de marcha')
    expect(lecturaPlana(lecturaPasivos(ejemploPasivos('sin-pasivo')))).toContain('Todavía no cargaste ningún pasivo')
    const [l0] = ejemploPasivos('cuadro').leasings
    const todas = l0.cuotas.map((c) => ({ ...c, pagada: true }))
    const l = lecturaPasivos({ leasings: [{ ...l0, cuotas: todas, tarjetas: { ...l0.tarjetas, pagadas: 35 } }] })
    expect(lecturaPlana(l)).toBe('Pagaste las 35 cuotas: queda la opción de compra, el 1 de julio de 2028.')
    for (const x of [lecturaPasivos(ejemploPasivos('sin-cuadro')), lecturaPasivos(ejemploPasivos('sin-pasivo')), l]) expect(validarLectura(x)).toEqual({ ok: true })
  })
})

describe('tendenciaUsd', () => {
  const [l] = ejemploPasivos('completo').leasings
  it('solo cuenta las pagadas con el CCL de su pago', () => {
    expect(tendenciaUsd(l.cuotas)).toEqual({ tipo: 'menos', cuotas: 14 })
    expect(tendenciaUsd(ejemploPasivos('cuadro').leasings[0].cuotas)).toBeNull()
    // Con una sola, no hay con qué comparar.
    const una = l.cuotas.map((c) => (c.nro === 1 ? c : conUsd(c, null)))
    expect(tendenciaUsd(una)).toBeNull()
  })
  it('sube e igual', () => {
    const sube = l.cuotas.map((c) => (c.pagada ? conUsd(c, String(500 + c.nro)) : c))
    expect(tendenciaUsd(sube)?.tipo).toBe('mas')
    const igual = l.cuotas.map((c) => (c.pagada ? conUsd(c, '700') : c))
    expect(tendenciaUsd(igual)?.tipo).toBe('igual')
  })
})

describe('tiraCuotas', () => {
  it('una celda por cuota del contrato: pagadas, la próxima y las que faltan', () => {
    const [l] = ejemploPasivos('cuadro').leasings
    const t = tiraCuotas(l)
    expect(t.celdas).toHaveLength(35)
    expect(t.celdas.filter((c) => c.estado === 'pagada')).toHaveLength(14)
    expect(t.celdas[14]).toEqual({ nro: 15, estado: 'proxima', titulo: 'Cuota 15 · vence el 01/11/2026 · la próxima' })
    expect(t.celdas.filter((c) => c.estado === 'pendiente')).toHaveLength(20)
    expect(t.rotulo).toBe('Leasing de la camioneta · 35 cuotas')
    expect(t.proxima).toBe('Próxima: cuota 15 · 1 de noviembre')
    expect(t.resumen).toBe('14 de 35 cuotas pagadas; la próxima, la 15, el 01/11/2026')
    // Con el cuadro entero, la tira no necesita nota.
    expect(t.nota).toBeNull()
  })

  it('el largo sale del contrato (o del cuadro, si trae más), nunca fijo; lo que el cuadro no trae no se pinta como pagado', () => {
    const [l] = ejemploPasivos('cuadro').leasings
    const corto: VistaLeasing = { ...l, cuotas: l.cuotas.filter((c) => c.nro <= 30) }
    const t = tiraCuotas(corto)
    expect(t.celdas).toHaveLength(35)
    expect(t.celdas.slice(30).every((c) => c.estado === 'sin_dato')).toBe(true)
    expect(t.resumen).toContain('5 que el cuadro de marcha no trae')
    // A la vista también, con dónde se completa.
    expect(t.nota).toBe('El cuadro de marcha trae 30 de 35 cuotas: las 5 que faltan van punteadas. Importá la planilla completa en Datos › Leasing.')
    expect(tiraCuotas({ ...l, cuotas: l.cuotas.filter((c) => c.nro !== 35) }).nota).toContain('la que falta va punteada')
    // Sin cuadro: todas punteadas, y la nota dice que falta importarlo (no "trae 0 de 35").
    const [sin] = ejemploPasivos('sin-cuadro').leasings
    const vacia = tiraCuotas(sin)
    expect(vacia.celdas.every((c) => c.estado === 'sin_dato')).toBe(true)
    expect(vacia.nota).toBe('Todavía no importaste el cuadro de marcha: las 35 cuotas van punteadas hasta que lo importes en Datos › Leasing.')
    const largo = tiraCuotas({ ...l, contrato: { ...l.contrato, cuotas_totales: 48 } })
    expect(largo.celdas).toHaveLength(48)
  })

  it('una vencida sin pagar se distingue', () => {
    const [l] = ejemploPasivos('cuadro').leasings
    const t = tiraCuotas({ ...l, hoy: '2026-12-05', tarjetas: { ...l.tarjetas, proxima: { ...l.tarjetas.proxima!, nro: 17, fecha: '2027-01-01' } } })
    expect(t.celdas[14].estado).toBe('vencida')
    expect(t.celdas[15].estado).toBe('vencida')
    expect(t.celdas[16].estado).toBe('proxima')
    expect(vencidasSinPagar({ ...l, hoy: '2026-12-05' }).map((c) => c.nro)).toEqual([15, 16])
  })
})

describe('cifrasPasivo', () => {
  it('el saldo de capital es la deuda que cuenta (D-131): la según el cuadro, con su nota', () => {
    const [l] = ejemploPasivos('cuadro').leasings
    const c = cifrasPasivo(l)
    expect(c.map((x) => x.rotulo)).toEqual(['Saldo de capital', 'Pagado · 14 cuotas', 'Falta · 21 cuotas', 'Opción de compra'])
    expect(c[0].par).toBe(l.deuda.segun_cuadro)
    expect(c[0].nota).toContain('Según el cuadro de marcha')
    expect(c[0].deuda).toBe(true)
    expect(c[1].par).toBe(l.totales.pagado)
    // Sin el CCL de cada pago, lo pagado en dólares es sin dato, y la nota dice dónde se carga.
    expect(l.totales.pagado.usd.valor).toBeNull()
    expect(c[1].nota).toContain('Datos › Leasing')
    expect(c[2].par).toBe(l.tarjetas.falta.total)
    expect(c[3].par).toBe(l.opcion.total)
    // Notas cortas, como en el diseño ("Al CCL de hoy", "Al CCL de cada pago", "Al final del contrato").
    expect(c[0].nota).toBe('Según el cuadro de marcha, al 14/10/2026. Al CCL de hoy.')
    expect(c[1].nota).toBe('Al CCL de cada pago: cargalos en Datos › Leasing.')
    expect(c[2].nota).toBe('Nominal, sin la opción. Al CCL de hoy: una referencia.')
    expect(c[3].nota).toBe('Al final del contrato, el 01/07/2028. Con IVA.')
  })

  it('con el valor de cancelación informado, ese; sin tasa, la estimada; sin nada, sin dato (nunca cero)', () => {
    const [completo] = ejemploPasivos('completo').leasings
    expect(cifrasPasivo(completo)[0].par).toBe(completo.deuda.informada!.par)
    expect(cifrasPasivo(completo)[0].nota).toContain('La informó la leasera')
    const [sinTasa] = ejemploPasivos('sin-tasa').leasings
    expect(sinTasa.deuda.vigente).toBe('estimada')
    expect(cifrasPasivo(sinTasa)[0].par).toBe(sinTasa.deuda.estimada!.par)
    const nada = cifrasPasivo({ ...sinTasa, deuda: { ...sinTasa.deuda, vigente: null, estimada: null } })[0]
    expect(nada.par.ars.valor).toBeNull()
    expect(nada.par.ars.motivo).toContain('leasera')
  })

  it('sin cuadro de marcha, lo pagado y lo que falta son sin dato (nunca una suma vacía en cero)', () => {
    const [l] = ejemploPasivos('sin-cuadro').leasings
    const c = cifrasPasivo(l)
    expect(c[1].rotulo).toBe('Pagado')
    expect(c[1].par.ars.valor).toBeNull()
    expect(c[1].par.ars.motivo).toContain('cuadro de marcha')
    expect(c[2].par.ars.valor).toBeNull()
  })
})

describe('las próximas y el cuadro completo', () => {
  const [l] = ejemploPasivos('cuadro').leasings
  it('las próximas: las primeras impagas, en orden', () => {
    expect(proximasCuotas(l.cuotas).map((c) => c.nro)).toEqual([15, 16, 17, 18, 19, 20])
    expect(proximasCuotas(l.cuotas, 2).map((c) => c.nro)).toEqual([15, 16])
  })
  it('el filtro del cuadro', () => {
    expect(filtrarCuadro(l.cuotas, 'por_pagar')).toHaveLength(21)
    expect(filtrarCuadro(l.cuotas, 'pagadas')).toHaveLength(14)
    expect(filtrarCuadro(l.cuotas, 'todas').map((c) => c.nro)).toEqual(Array.from({ length: 35 }, (_, i) => i + 1))
  })
  it('las próximas sin factura avisan una vez que traen montos supuestos o a confirmar', () => {
    expect(hayInciertas(proximasCuotas(l.cuotas))).toBe(true)
    // Las pagadas del ejemplo son facturadas: comprobante.
    expect(hayInciertas(l.cuotas.filter((c) => c.pagada))).toBe(false)
    expect(hayInciertas([])).toBe(false)
  })
})

describe('la nota del gráfico de la cuota', () => {
  it('sin el CCL de ningún pago: lo punteado y que las pagadas, en dólares, son sin dato', () => {
    const [l] = ejemploPasivos('cuadro').leasings
    expect(notaCuota(l.cuotas)).toBe(
      'Punteado: las que faltan, al CCL de hoy (una referencia, no una proyección del dólar). Las pagadas, en dólares, sin dato hasta que cargues el CCL de cada pago en Datos › Leasing.',
    )
  })
  it('con el CCL de cada pago: sólido y punteado', () => {
    const [l] = ejemploPasivos('completo').leasings
    expect(notaCuota(l.cuotas)).toBe('Sólido: las pagadas, al CCL de cada pago. Punteado: las que faltan, al CCL de hoy (una referencia, no una proyección del dólar).')
  })
  it('si a algunas les falta, lo dice: es un hueco, nunca un cero', () => {
    const [l] = ejemploPasivos('completo').leasings
    const una = l.cuotas.map((c) => (c.nro === 3 ? conUsd(c, null) : c))
    expect(notaCuota(una)).toContain('a una le falta y queda un hueco')
    const dos = l.cuotas.map((c) => (c.nro === 3 || c.nro === 4 ? conUsd(c, null) : c))
    expect(notaCuota(dos)).toContain('a 2 les falta')
  })
  it('sin ninguna pagada, solo lo punteado', () => {
    const [l] = ejemploPasivos('cuadro').leasings
    expect(notaCuota(l.cuotas.map((c) => ({ ...c, pagada: false })))).toBe('Punteado: las que faltan, al CCL de hoy (una referencia, no una proyección del dólar).')
  })
})

describe('fechaEnPalabras', () => {
  it('con el año solo si es otro', () => {
    expect(fechaEnPalabras('2026-11-01', '2026-10-14')).toBe('1 de noviembre')
    expect(fechaEnPalabras('2028-07-01', '2026-10-14')).toBe('1 de julio de 2028')
    expect(fechaEnPalabras('2028-07-01')).toBe('1 de julio de 2028')
  })
})
