import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { Decimal } from '@/lib/domain/dinero'
import type { Cuenta, Hechos } from '@/lib/domain/tipos'
import {
  construirExcelIEB,
  patrimonioIEB,
  portafolioApendiceB,
  portafolioEjemplo,
  posicionIEB,
  type PortafolioIEB,
  type SeccionIEB,
} from '../../../tests/fixtures/ieb'
import { proponerCarga } from './conciliar'
import type { ControlLeido, FilaLeida, LecturaCuenta } from './contratos'
import {
  decimalDeExcel,
  decimalesMostrados,
  detectarEscala,
  ErrorLectorIEB,
  LECTOR_IEB,
  leerExcelIEB,
  type LecturaCrudaIEB,
} from './ieb'

// Todos los números son inventados (D-24). El Excel se arma en memoria con la
// misma estructura que el export real de IEB (tests/fixtures/ieb.ts).

const leer = async (p: PortafolioIEB) => leerExcelIEB(await construirExcelIEB(p))

function fila(l: LecturaCuenta, ticker: string): FilaLeida {
  const f = l.filas.find((x) => x.ticker === ticker)
  if (!f) throw new Error(`No está la fila ${ticker}`)
  return f
}

function subtotal(l: LecturaCuenta, seccion: string): ControlLeido {
  const c = l.controles.find((x) => x.tipo === 'ieb_subtotal' && x.seccion === seccion)
  if (!c) throw new Error(`No está el Subtotal de ${seccion}`)
  return c
}

function b2(l: LecturaCuenta): ControlLeido {
  const c = l.controles.find((x) => x.tipo === 'ieb_b2')
  if (!c) throw new Error('No está el control de B2')
  return c
}

const saldo = (l: LecturaCuenta, moneda: 'ARS' | 'USD') => l.saldos.find((s) => s.moneda === moneda)

/** Copia del ejemplo con un cambio en una posición. */
function conPosicion(
  p: PortafolioIEB,
  ticker: string,
  cambio: Partial<SeccionIEB['posiciones'][number]>,
): PortafolioIEB {
  return {
    ...p,
    secciones: p.secciones.map((s) => ({
      ...s,
      posiciones: s.posiciones.map((x) => (x.especie.startsWith(`${ticker} - `) ? { ...x, ...cambio } : x)),
    })),
  }
}

const sinSeccion = (p: PortafolioIEB, titulo: string): PortafolioIEB => ({
  ...p,
  secciones: p.secciones.filter((s) => s.titulo !== titulo),
})

// ───────────── El Excel de ejemplo, completo ─────────────

describe('leerExcelIEB · Portafolio de ejemplo', async () => {
  const p = portafolioEjemplo()
  const l = await leer(p)

  it('identifica la cuenta, el origen y el lector', () => {
    expect(l.cuenta).toBe('IEB')
    expect(l.origen).toBe('excel')
    expect(l.lector).toBe(LECTOR_IEB)
    expect(LECTOR_IEB).toBe('ieb-excel@1')
  })

  it('fecha del reporte: B1 son las 03:00 UTC, que es la medianoche del mismo día en Córdoba (D-61)', () => {
    expect(l.fecha_reporte).toBe('2026-10-07')
  })

  it('una fila por posición, en el orden del Excel; DOLARUSA no es una fila', () => {
    expect(l.filas.map((f) => f.ticker)).toEqual(['YPFD', 'T30J7', 'TXMJ0', 'S29Y7', 'SPY', 'XOM'])
    expect(l.filas.map((f) => f.clave)).toEqual(['IEB:YPFD', 'IEB:T30J7', 'IEB:TXMJ0', 'IEB:S29Y7', 'IEB:SPY', 'IEB:XOM'])
    expect(l.filas.some((f) => f.ticker === 'DOLARUSA')).toBe(false)
  })

  it('ticker y nombre salen de "TICKER - NOMBRE"; sección, moneda y tipo sugerido', () => {
    expect(fila(l, 'T30J7').nombre).toBe('BONO TESORO NAC. CAP. 30/06/27 $')
    expect(fila(l, 'SPY').nombre).toBe('CEDEAR SPDR S&P 500')
    const tipos = Object.fromEntries(l.filas.map((f) => [f.ticker, [f.seccion, f.tipo_sugerido, f.moneda_emision]]))
    expect(tipos).toEqual({
      YPFD: ['acciones', 'accion_local', 'ARS'],
      T30J7: ['bonos', 'bono', 'ARS'],
      TXMJ0: ['bonos', 'bono', 'ARS'],
      S29Y7: ['bonos', 'lecap', 'ARS'], // "LETRA" en el nombre
      SPY: ['cedears', 'cedear', 'ARS'],
      XOM: ['cedears', 'cedear', 'ARS'],
    })
  })

  it('escala ÷100 en bonos y letras, ×1 en acciones y CEDEARs; precio y PPP normalizados por 1 VN (D-12)', () => {
    const t = fila(l, 'T30J7')
    expect([t.escala, t.precio_mostrado, t.precio_unitario, t.ppc_mostrado, t.ppc_unitario]).toEqual([
      '0.01',
      '112.4',
      '1.124',
      '109.76',
      '1.0976',
    ])
    expect(fila(l, 'S29Y7').precio_unitario).toBe('1.0435') // 104,35 ÷ 100: en float daría 1,0434999999999999
    expect(fila(l, 'TXMJ0').ppc_unitario).toBe('1.005')
    const y = fila(l, 'YPFD')
    expect([y.escala, y.precio_mostrado, y.precio_unitario, y.ppc_unitario]).toEqual(['1', '52300', '52300', '48200'])
    expect(fila(l, 'SPY').ppc_unitario).toBe('30145.16')
    expect(fila(l, 'SPY').valorizado).toBe('43586000')
  })

  it('chequeo de cada fila: cantidad × precio × escala ≈ posición total, con la tolerancia de la precisión mostrada (D-11, D-37)', () => {
    expect(fila(l, 'T30J7').chequeo).toEqual({
      regla: 'cantidad × precio ÷ 100 ≈ posición total',
      esperado: '10116000',
      calculado: '10116000',
      tolerancia: '450.005', // 9.000.000 × 0,01 × 0,005 + 0,005
      ok: true,
    })
    expect(fila(l, 'YPFD').chequeo).toEqual({
      regla: 'cantidad × precio ≈ posición total',
      esperado: '15690000',
      calculado: '15690000',
      tolerancia: '1.505', // 300 × 0,005 + 0,005
      ok: true,
    })
  })

  it('las posiciones con todo en orden quedan verificadas, disponibles y sin motivos', () => {
    for (const t of ['YPFD', 'T30J7', 'TXMJ0', 'S29Y7', 'SPY']) {
      const f = fila(l, t)
      expect([f.ticker, f.estado, f.liquidacion, f.motivos]).toEqual([t, 'verificada', 'disponible', []])
    }
  })

  it('compra del día: PPP "-" → advertencia, sin costo, y la sub-fila dice Liquidar (D-19)', () => {
    const x = fila(l, 'XOM')
    expect(x.estado).toBe('advertencia')
    expect(x.motivos).toEqual(['PPP todavía no informado: compra del día'])
    expect(x.liquidacion).toBe('liquidar')
    expect([x.ppc_mostrado, x.ppc_unitario, x.costo_total]).toEqual([null, null, null])
    // El precio y la cuenta, en cambio, están: 47 × 2.873,65.
    expect([x.precio_unitario, x.valorizado, x.chequeo?.ok]).toEqual(['2873.65', '135061.55', true])
  })

  it('dice dónde está cada dato en el archivo', () => {
    expect(fila(l, 'YPFD').lugar).toBe('hoja Patrimonio, fila 11')
    expect(fila(l, 'XOM').lugar).toBe('hoja Patrimonio, fila 34')
    expect(saldo(l, 'ARS')?.lugar).toBe('hoja Saldos, fila 9')
  })

  it('saldo en pesos: el Total (neto de lo que falta liquidar), no Hoy; puede ser negativo (D-13)', () => {
    expect(saldo(l, 'ARS')).toEqual({
      moneda: 'ARS',
      monto: '-85500', // Hoy dice 50.000: con Hoy, la compra de XOM se contaría dos veces
      partes: [{ concepto: 'Saldo Total ARS', monto: '-85500' }],
      tna: null,
      estado: 'verificada',
      motivos: [],
      lugar: 'hoja Saldos, fila 9',
    })
  })

  it('saldo en dólares = Total USD de Saldos + DOLARUSA, con sus dos partes', () => {
    const u = saldo(l, 'USD')
    expect(u?.monto).toBe('4205.6')
    expect(u?.partes).toEqual([
      { concepto: 'Saldo Total USD', monto: '4182.2' },
      { concepto: 'DOLARUSA (dólares en especie)', monto: '23.4' },
    ])
    expect(u?.estado).toBe('verificada')
    expect(u?.lugar).toBe('hoja Saldos, fila 20 · DOLARUSA en hoja Patrimonio, fila 41')
    expect(l.saldos).toHaveLength(2)
  })

  it('cada Subtotal cierra contra la suma de su sección (incluida Otros, solo con DOLARUSA)', () => {
    expect(l.controles.filter((c) => c.tipo === 'ieb_subtotal').map((c) => [c.seccion, c.informado, c.calculado, c.ok])).toEqual([
      ['Acciones', '15690000', '15690000', true],
      ['Bonos', '17879750', '17879750', true],
      ['Cedears', '43721061.55', '43721061.55', true],
      ['Otros', '37697.4', '37697.4', true],
    ])
  })

  it('B2 = posiciones + Total ARS + Total USD × dólar de IEB (DOLARUSA), al centavo', () => {
    const c = b2(l)
    expect(c.informado).toBe(patrimonioIEB(p).toFixed())
    expect(c.calculado).toBe(c.informado)
    expect(c.ok).toBe(true)
    expect(c.detalle).toContain('US$ 4.182,20 × 1.611,00 (dólar de IEB, DOLARUSA)')
    expect(c.detalle).toContain('diferencia $ 0,00')
    // La tolerancia como dato (D-37) y el dólar de IEB con nombre (D-66).
    expect(c.tolerancia).toMatch(/^\d+(\.\d+)?$/)
    expect(new Decimal(c.tolerancia!).gt(0)).toBe(true)
    expect(l.tipo_cambio_fuente).toEqual({ dolar_ieb: '1611' })
    for (const s of l.controles.filter((x) => x.tipo === 'ieb_subtotal')) expect(s.tolerancia).toMatch(/^\d+(\.\d+)?$/)
  })

  it('no deja advertencias generales', () => {
    expect(l.advertencias).toEqual([])
  })

  it('la lectura cruda guarda cada celda no vacía de las dos hojas, con su valor y su formato', () => {
    const cruda = l.cruda as LecturaCrudaIEB
    expect(cruda.lector).toBe(LECTOR_IEB)
    expect(cruda.hojas.map((h) => h.nombre)).toEqual(['Patrimonio', 'Saldos'])
    const [pat, sal] = cruda.hojas
    const celda = (h: typeof pat, ref: string) => h.celdas.find((c) => c.ref === ref)
    expect(celda(pat, 'A1')).toEqual({ ref: 'A1', tipo: 'texto', valor: 'Fecha:', formato: null })
    expect(celda(pat, 'B1')).toEqual({ ref: 'B1', tipo: 'fecha', valor: '2026-10-07T03:00:00.000Z', formato: 'dd/mm/yyyy' })
    expect(celda(pat, 'B2')).toEqual({ ref: 'B2', tipo: 'numero', valor: patrimonioIEB(p).toFixed(), formato: '#,##0.00' })
    expect(celda(pat, 'C18')).toEqual({ ref: 'C18', tipo: 'numero', valor: '9000000', formato: '#,##0' })
    expect(celda(pat, 'F34')).toEqual({ ref: 'F34', tipo: 'texto', valor: '-', formato: '#,##0.00' })
    expect(celda(sal, 'A1')?.valor).toBe('ARS ') // tal cual, con el espacio final
    expect(celda(sal, 'C9')?.valor).toBe('-85500')
    // Nada vacío y ninguna celda repetida.
    for (const h of cruda.hojas) {
      expect(h.celdas.every((c) => c.valor.trim() !== '')).toBe(true)
      expect(new Set(h.celdas.map((c) => c.ref)).size).toBe(h.celdas.length)
    }
    expect(pat.celdas.length).toBeGreaterThan(200)
  })

  it('todo es JSON puro: viaja por la red y a cargas.lectura_cruda sin perder nada', () => {
    expect(JSON.parse(JSON.stringify(l))).toEqual(l)
  })
})

describe('leerExcelIEB · el set del Apéndice B (docs/vision.md)', () => {
  it('cuadra contra B2: $74.547.000 + DOLARUSA − $185.000 + US$ 4.176,60 × 1.540 = $80.830.000,00', async () => {
    const l = await leer(portafolioApendiceB())
    expect(b2(l)).toMatchObject({ informado: '80830000', calculado: '80830000', ok: true })
    expect(saldo(l, 'USD')?.monto).toBe('4200')
    expect(saldo(l, 'ARS')?.monto).toBe('-185000')
    const valorizado = l.filas.reduce((a, f) => a.plus(f.valorizado ?? 'NaN'), new Decimal(0))
    expect(valorizado.toFixed()).toBe('74547000') // SPY, YPFD, T30J7 y TXMJ0
    expect(l.filas.map((f) => [f.ticker, f.precio_unitario])).toEqual([
      ['YPFD', '52300'],
      ['T30J7', '1.124'],
      ['TXMJ0', '1.031'],
      ['SPY', '35150'],
    ])
  })
})

// ───────────── Fecha del reporte ─────────────

describe('leerExcelIEB · fecha del reporte (D-61)', () => {
  it('no depende de la zona horaria del servidor', async () => {
    const bytes = await construirExcelIEB(portafolioEjemplo())
    const antes = process.env.TZ
    try {
      for (const tz of ['UTC', 'America/Argentina/Cordoba', 'America/Los_Angeles', 'Pacific/Pago_Pago', 'Asia/Tokyo', 'Pacific/Kiritimati']) {
        process.env.TZ = tz
        expect([tz, (await leerExcelIEB(bytes)).fecha_reporte]).toEqual([tz, '2026-10-07'])
      }
    } finally {
      if (antes === undefined) delete process.env.TZ
      else process.env.TZ = antes
    }
  })

  it('una fecha sin hora (00:00) es ese día, no el anterior', async () => {
    const l = await leer({ ...portafolioEjemplo(), b1: new Date('2026-10-07T00:00:00Z') })
    expect(l.fecha_reporte).toBe('2026-10-07')
    expect(l.advertencias).toEqual([])
  })

  it('con hora entre las 00:00 y las 03:00 UTC vale el día de Córdoba, y lo avisa', async () => {
    const l = await leer({ ...portafolioEjemplo(), b1: new Date('2026-10-08T01:30:00Z') })
    expect(l.fecha_reporte).toBe('2026-10-07')
    expect(l.advertencias).toEqual([
      'B1 trae fecha y hora (08/10/2026 01:30); en hora de Córdoba es el 07/10/2026, y esa es la fecha que se usa.',
    ])
  })

  it('acepta la fecha escrita como texto dd/mm/aaaa', async () => {
    expect((await leer({ ...portafolioEjemplo(), b1: '07/10/2026', b1Formato: null })).fecha_reporte).toBe('2026-10-07')
  })

  it('acepta el número de serie de Excel con formato General', async () => {
    const serie = Date.UTC(2026, 9, 7, 3) / 86_400_000 + 25569
    expect((await leer({ ...portafolioEjemplo(), b1: serie, b1Formato: null })).fecha_reporte).toBe('2026-10-07')
  })

  it('una fecha ilegible queda sin dato, con aviso', async () => {
    const l = await leer({ ...portafolioEjemplo(), b1: 'ayer', b1Formato: null })
    expect(l.fecha_reporte).toBeNull()
    expect(l.advertencias).toEqual(['No pude leer la fecha del reporte en B1 («ayer»).'])
  })
})

// ───────────── Números exactos ─────────────

describe('leerExcelIEB · números exactos: nada pasa por float (D-32)', () => {
  it('el ruido binario de quien generó el Excel no entra: cada número se lee con las 15 cifras de Excel', async () => {
    // Un export que calcula en float escribe estos dobles; el valor que muestra es el exacto.
    const jBono = (9000000 * 112.43) / 100
    const jCedear = 47 * 2873.65
    expect(String(jBono)).toBe('10118700.000000002')
    expect(String(jCedear)).toBe('135061.55000000002')
    let p = conPosicion(portafolioEjemplo(), 'T30J7', { precio: '112.43', posicionEscrita: jBono })
    p = conPosicion(p, 'XOM', { posicionEscrita: jCedear })
    const l = await leer(p)
    expect(fila(l, 'T30J7')).toMatchObject({ valorizado: '10118700', precio_unitario: '1.1243', estado: 'verificada' })
    expect(fila(l, 'T30J7').chequeo).toMatchObject({ calculado: '10118700', esperado: '10118700', ok: true })
    expect(fila(l, 'XOM').valorizado).toBe('135061.55')
    // La cruda conserva el doble tal cual, para la traza.
    const celdas = (l.cruda as LecturaCrudaIEB).hojas[0].celdas
    expect(celdas.find((c) => c.ref === 'J18')?.valor).toBe('10118700.000000002')
  })

  it('0,1 × 3 es 0,3, no 0,30000000000000004', async () => {
    const p: PortafolioIEB = {
      ...portafolioEjemplo(),
      secciones: [
        { titulo: 'Cedears', escala: '1', posiciones: [{ especie: 'KO - CEDEAR COCA-COLA', cantidad: '3', precio: '0.1', ppp: '0.1', posicionEscrita: 0.1 * 3 }] },
        ...portafolioEjemplo().secciones.filter((s) => s.titulo === 'Otros'),
      ],
    }
    const l = await leer(p)
    expect(fila(l, 'KO')).toMatchObject({ valorizado: '0.3', precio_unitario: '0.1', estado: 'verificada' })
    expect(fila(l, 'KO').chequeo).toMatchObject({ calculado: '0.3', esperado: '0.3', ok: true })
    expect(subtotal(l, 'Cedears')).toMatchObject({ calculado: '0.3', ok: true })
  })

  it('números guardados como texto: se leen en formato argentino, la cuenta los verifica y se avisa', async () => {
    const p = conPosicion(portafolioEjemplo(), 'T30J7', {
      cantidadEscrita: { texto: '9.000.000' },
      precioEscrito: { texto: '112,40' },
      posicionEscrita: { texto: '10.116.000,00' },
    })
    const l = await leer(p)
    const t = fila(l, 'T30J7')
    expect([t.cantidad, t.precio_mostrado, t.valorizado, t.escala, t.precio_unitario, t.estado]).toEqual([
      '9000000',
      '112.4',
      '10116000',
      '0.01',
      '1.124',
      'verificada',
    ])
    expect(t.chequeo?.tolerancia).toBe('450.005') // "112,40": 2 decimales escritos
    expect(l.advertencias).toEqual([
      'Hay números guardados como texto en la hoja Patrimonio (C18, D18, J18): se leyeron en formato argentino y la cuenta de cada fila los verifica.',
    ])
  })

  it('decimalDeExcel: 15 cifras significativas, sin notación científica ni −0', () => {
    expect(decimalDeExcel(0.1 + 0.2).toFixed()).toBe('0.3')
    expect(decimalDeExcel(1.0434999999999999).toFixed()).toBe('1.0435')
    expect(decimalDeExcel(4.7130251).toFixed()).toBe('4.7130251')
    expect(decimalDeExcel(1e-7).toFixed()).toBe('0.0000001')
    expect(decimalDeExcel(-185000).toFixed()).toBe('-185000')
    expect(decimalDeExcel(-0).isNegative()).toBe(false)
    expect(() => decimalDeExcel(Number.NaN)).toThrow()
  })

  it('decimalesMostrados lee el formato de la celda', () => {
    const v = new Decimal('1.0852')
    expect(decimalesMostrados('#,##0.00', v)).toBe(2)
    expect(decimalesMostrados('#,##0', v)).toBe(0)
    expect(decimalesMostrados('0.0000', v)).toBe(4)
    expect(decimalesMostrados('0.00%', v)).toBe(4)
    expect(decimalesMostrados('#,##0.00;[Red]-#,##0.00', v)).toBe(2)
    expect(decimalesMostrados('_-* #,##0.00_-;-* #,##0.00_-;_-* "-"??_-;_-@_-', v)).toBe(2)
    expect(decimalesMostrados('"US$" #,##0.000', v)).toBe(3)
    // General: los decimales del propio valor.
    expect(decimalesMostrados(null, v)).toBe(4)
    expect(decimalesMostrados('General', new Decimal('23.4'))).toBe(1)
  })
})

// ───────────── Escala ─────────────

describe('detectarEscala (D-12, D-37)', () => {
  it('reproduce la tolerancia del Apéndice B: S13N6, precio con 4 decimales → ±575,005', () => {
    const r = detectarEscala({
      cantidad: new Decimal('11500000'),
      precio: new Decimal('1.0852'),
      decimalesPrecio: 4,
      valorizado: new Decimal('12479800'),
      decimalesValorizado: 2,
      preferida: null,
    })
    expect(r).toMatchObject({ escala: '1', ambigua: false })
    expect(r.chequeo).toEqual({
      regla: 'cantidad × precio ≈ posición total',
      esperado: '12479800',
      calculado: '12479800',
      tolerancia: '575.005',
      ok: true,
    })
  })

  it('detecta ÷100 (bonos) y ÷1.000 (cuotapartes cada mil) sin que se la digan', () => {
    const base = { decimalesPrecio: 2, decimalesValorizado: 2, preferida: null }
    expect(
      detectarEscala({ ...base, cantidad: new Decimal('9000000'), precio: new Decimal('112.4'), valorizado: new Decimal('10116000') }).escala,
    ).toBe('0.01')
    expect(
      detectarEscala({ ...base, cantidad: new Decimal('1250000'), precio: new Decimal('4812'), valorizado: new Decimal('6015000') }).escala,
    ).toBe('0.001')
  })

  it('si ninguna escala cierra, no inventa: escala null y el chequeo de la que más se acerca, fallido', () => {
    const r = detectarEscala({
      cantidad: new Decimal('9000000'),
      precio: new Decimal('112.5'),
      decimalesPrecio: 2,
      valorizado: new Decimal('10116000'),
      decimalesValorizado: 2,
      preferida: '0.01',
    })
    expect(r).toMatchObject({ escala: null, probada: '0.01' })
    expect(r.chequeo).toMatchObject({ calculado: '10125000', esperado: '10116000', ok: false })
  })

  it('con cantidad 0 cierran todas: es ambigua y se queda con la de la sección', () => {
    const r = detectarEscala({
      cantidad: new Decimal('0'),
      precio: new Decimal('112.4'),
      decimalesPrecio: 2,
      valorizado: new Decimal('0'),
      decimalesValorizado: 2,
      preferida: '0.01',
    })
    expect(r).toMatchObject({ escala: '0.01', ambigua: true })
  })
})

// ───────────── Datos adulterados ─────────────

describe('leerExcelIEB · un dato adulterado no pasa en silencio (D-11)', () => {
  it('precio adulterado: la fila queda en error, su chequeo falla y no se propone ningún precio', async () => {
    const l = await leer(conPosicion(portafolioEjemplo(), 'T30J7', { precioEscrito: '112.5' }))
    const t = fila(l, 'T30J7')
    expect(t.estado).toBe('error')
    expect(t.chequeo).toMatchObject({ esperado: '10116000', calculado: '10125000', ok: false })
    expect([t.escala, t.precio_unitario, t.ppc_unitario]).toEqual([null, null, null])
    expect(t.precio_mostrado).toBe('112.5')
    expect(t.motivos[0]).toBe(
      'La cuenta no cierra: 9.000.000 × 112,50 ÷ 100 = $ 10.125.000,00, y la posición total dice $ 10.116.000,00 (diferencia $ 9.000,00, tolerancia ±$ 450,01).',
    )
    // Las sumas no miran precios: por eso existe el chequeo de cada fila.
    expect(subtotal(l, 'Bonos').ok).toBe(true)
    expect(b2(l).ok).toBe(true)
  })

  it('posición total adulterada: fallan la fila, su Subtotal y B2', async () => {
    const l = await leer(conPosicion(portafolioEjemplo(), 'T30J7', { posicionEscrita: '10117000' }))
    expect(fila(l, 'T30J7').estado).toBe('error')
    expect(subtotal(l, 'Bonos')).toMatchObject({ informado: '17879750', calculado: '17880750', ok: false })
    expect(subtotal(l, 'Acciones').ok).toBe(true)
    expect(b2(l).ok).toBe(false)
    expect(b2(l).detalle).toContain('diferencia $ 1.000,00')
  })

  it('una fila que falta en la lectura la detecta su Subtotal', async () => {
    // El Subtotal y B2 dicen lo que tenía el Excel; acá se borra una posición sin tocarlos.
    const p = portafolioEjemplo()
    const informado = p.secciones[1].posiciones.reduce((a, x) => a.plus(posicionIEB(p.secciones[1], x)), new Decimal(0))
    const b2Real = patrimonioIEB(p)
    p.secciones[1] = { ...p.secciones[1], posiciones: p.secciones[1].posiciones.slice(1), subtotal: informado.toFixed() }
    const l = await leer({ ...p, patrimonioTotal: b2Real.toFixed() })
    expect(subtotal(l, 'Bonos').ok).toBe(false)
    expect(b2(l).ok).toBe(false)
  })

  it('cantidad o precio faltante: error, nunca cero', async () => {
    const l = await leer(conPosicion(portafolioEjemplo(), 'YPFD', { cantidadEscrita: '-', cantidadSubfila: '300' }))
    const y = fila(l, 'YPFD')
    expect(y.estado).toBe('error')
    expect(y.cantidad).toBeNull()
    expect(y.chequeo).toBeNull()
    expect(y.motivos[0]).toBe('Falta la cantidad (C11).')
  })
})

// ───────────── Robustez ─────────────

describe('leerExcelIEB · robustez', () => {
  it('nombres de hoja con otras mayúsculas y espacios, y hojas de más', async () => {
    const l = await leer({ ...portafolioEjemplo(), hojas: { patrimonio: ' PATRIMONIO ', saldos: 'saldos ' }, otrasHojas: ['Notas'] })
    expect(l.filas).toHaveLength(6)
    expect(fila(l, 'YPFD').lugar).toBe('hoja PATRIMONIO, fila 11')
    expect(l.controles.every((c) => c.ok === true)).toBe(true)
    expect((l.cruda as LecturaCrudaIEB).otras_hojas).toEqual(['Notas'])
  })

  it('filas en blanco de más y títulos combinados en A:J', async () => {
    const l = await leer({ ...portafolioEjemplo(), blancosExtra: 2, combinarTitulos: true })
    expect(l.filas.map((f) => f.ticker)).toEqual(['YPFD', 'T30J7', 'TXMJ0', 'S29Y7', 'SPY', 'XOM'])
    expect(l.controles).toHaveLength(5)
    expect(l.controles.every((c) => c.ok === true)).toBe(true)
    expect(l.advertencias).toEqual([])
  })

  it('una sección ausente', async () => {
    const l = await leer(sinSeccion(portafolioEjemplo(), 'Acciones'))
    expect(l.filas.map((f) => f.ticker)).toEqual(['T30J7', 'TXMJ0', 'S29Y7', 'SPY', 'XOM'])
    expect(l.controles.map((c) => c.seccion)).toEqual(['Bonos', 'Cedears', 'Otros', null])
    expect(b2(l).ok).toBe(true)
  })

  it('una sección sin posiciones: su Subtotal en 0 cierra', async () => {
    const p = portafolioEjemplo()
    p.secciones[0] = { ...p.secciones[0], posiciones: [] }
    const l = await leer(p)
    expect(l.filas.some((f) => f.seccion === 'acciones')).toBe(false)
    expect(subtotal(l, 'Acciones')).toMatchObject({ informado: '0', calculado: '0', ok: true })
    expect(b2(l).ok).toBe(true)
  })

  it('una sección desconocida se lee igual y avisa', async () => {
    const p = portafolioEjemplo()
    p.secciones.splice(3, 0, {
      titulo: 'Obligaciones Negociables',
      escala: '0.01',
      posiciones: [{ especie: 'YCA6O - ON YPF CLASE 26', moneda: 'USD', cantidad: '10000', precio: '145600', ppp: '140000' }],
    })
    const l = await leer(p)
    expect(fila(l, 'YCA6O')).toMatchObject({ seccion: 'bonos', tipo_sugerido: 'bono', escala: '0.01', precio_unitario: '1456', moneda_emision: 'USD' })
    expect(subtotal(l, 'Obligaciones Negociables').ok).toBe(true)
    expect(b2(l).ok).toBe(true)
    expect(l.advertencias).toEqual([
      'La sección «Obligaciones Negociables» no está en el formato verificado del Excel de IEB: su posición se leyó igual; revisá el tipo de cada una.',
    ])
  })

  it('sin DOLARUSA y con dólares en Saldos: B2 no se puede verificar (ok null, nunca OK)', async () => {
    const l = await leer({ ...sinSeccion(portafolioEjemplo(), 'Otros'), dolarIEB: '1611' })
    expect(saldo(l, 'USD')).toMatchObject({ monto: '4182.2', partes: [{ concepto: 'Saldo Total USD', monto: '4182.2' }], estado: 'verificada' })
    expect(b2(l)).toMatchObject({ calculado: null, ok: null })
    expect(b2(l).detalle).toContain('no trae DOLARUSA')
  })

  it('sin dólares en ningún lado, B2 cierra sin el término en USD', async () => {
    const p = sinSeccion(portafolioEjemplo(), 'Otros')
    const l = await leer({ ...p, saldos: { ...p.saldos, usd: { hoy: '0' } } })
    expect(saldo(l, 'USD')?.monto).toBe('0')
    expect(b2(l).ok).toBe(true)
  })

  it('Total ARS "-": el saldo en pesos queda sin dato (nunca cero) y B2 no se verifica', async () => {
    const p = portafolioEjemplo()
    const l = await leer({ ...p, saldos: { ...p.saldos, ars: { hoy: '50000', total: '-' } }, patrimonioTotal: '1' })
    expect(saldo(l, 'ARS')).toBeUndefined()
    expect(l.advertencias).toContain('El Total ARS de la hoja Saldos (fila 9) no es un número: el saldo en pesos de IEB no se lee.')
    expect(b2(l)).toMatchObject({ calculado: null, ok: null })
  })

  it('USD Ext. con saldo: avisa y no lo suma', async () => {
    const p = portafolioEjemplo()
    const l = await leer({ ...p, saldos: { ...p.saldos, usdExt: '250' } })
    expect(saldo(l, 'USD')?.monto).toBe('4205.6')
    expect(l.advertencias).toEqual([
      'La hoja Saldos trae US$ 250,00 en «USD Ext.» (fila 25): no se suman al saldo de IEB. Revisá si corresponde.',
    ])
  })

  it('un ticker repetido deja las dos filas en error: no se pueden conciliar por separado', async () => {
    const p = portafolioEjemplo()
    const ced = p.secciones[2]
    p.secciones[2] = { ...ced, posiciones: [...ced.posiciones, { especie: 'SPY - CEDEAR SPDR S&P 500', cantidad: '10', precio: '35150', ppp: '35000' }] }
    const l = await leer(p)
    const spy = l.filas.filter((f) => f.ticker === 'SPY')
    expect(spy.map((f) => [f.clave, f.estado])).toEqual([
      ['IEB:SPY', 'error'],
      ['IEB:SPY#2', 'error'],
    ])
    expect(spy[0].motivos[0]).toContain('aparece más de una vez')
  })

  it('una posición de menos de un centavo: la escala es ambigua, se queda con la de la sección y lo avisa', async () => {
    const p = conPosicion(portafolioEjemplo(), 'T30J7', { cantidad: '1', precio: '0.01', ppp: '0.01' })
    const t = fila(await leer(p), 'T30J7')
    expect(t).toMatchObject({ escala: '0.01', precio_unitario: '0.0001', valorizado: '0.0001', estado: 'advertencia' })
    expect(t.motivos).toEqual(['La escala del precio es ambigua con estos montos; se tomó ÷100.'])
  })

  it('sin sub-fila: no se sabe si está por liquidar, y lo dice', async () => {
    const l = await leer(conPosicion(portafolioEjemplo(), 'YPFD', { liquidacion: null }))
    expect(fila(l, 'YPFD')).toMatchObject({ estado: 'advertencia', liquidacion: null })
    expect(fila(l, 'YPFD').motivos).toEqual(['Sin sub-fila Disponible / Liquidar: no se sabe si está pendiente de liquidar.'])
  })

  it('acepta un ArrayBuffer y no toca los bytes que recibe', async () => {
    const bytes = await construirExcelIEB(portafolioEjemplo())
    const copia = bytes.slice()
    const l = await leerExcelIEB(bytes.slice().buffer)
    expect(l.filas).toHaveLength(6)
    await leerExcelIEB(bytes)
    expect(Buffer.compare(bytes, copia)).toBe(0)
  })
})

describe('leerExcelIEB · archivos que no son el Portafolio', () => {
  const rechaza = async (datos: Uint8Array, mensaje: RegExp) => {
    const e = await leerExcelIEB(datos).then(
      () => null,
      (x: unknown) => x,
    )
    expect(e).toBeInstanceOf(ErrorLectorIEB)
    expect((e as Error).message).toMatch(mensaje)
  }

  it('sin la hoja Patrimonio', async () => {
    await rechaza(
      await construirExcelIEB({ ...portafolioEjemplo(), hojas: { patrimonio: null } }),
      /^El Excel no tiene la hoja Patrimonio: ¿es el Portafolio de IEB\? \(hojas del archivo: Saldos\)$/,
    )
  })

  it('sin la hoja Saldos', async () => {
    await rechaza(await construirExcelIEB({ ...portafolioEjemplo(), hojas: { saldos: null } }), /^El Excel no tiene la hoja Saldos: ¿es el Portafolio de IEB\?/)
  })

  it('un archivo vacío, un texto, un .xls viejo y un zip que no es Excel', async () => {
    await rechaza(new Uint8Array(), /vacío/)
    await rechaza(new TextEncoder().encode('Especie;Cantidad\nYPFD;300\n'), /no es un Excel \(\.xlsx\)/)
    await rechaza(Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]), /formato viejo \(\.xls\)/)
    const zipVacio = Uint8Array.from([0x50, 0x4b, 0x05, 0x06, ...new Array(18).fill(0)])
    await rechaza(zipVacio, /Portafolio de IEB/)
    const zipRoto = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6, 7, 8])
    await rechaza(zipRoto, /No pude abrir el Excel/)
  })
})

// ───────────── Propiedades ─────────────

const centavos = (min: number, max: number) => fc.integer({ min, max }).map((c) => new Decimal(c).div(100).toFixed())

const arbPosiciones = (escala: '1' | '0.01', prefijo: string) =>
  fc
    .array(
      // Montos reales: precio desde $ 1 y bonos desde 1.000 VN. Con posiciones de
      // menos de un centavo la escala es ambigua de verdad (tiene su propio test).
      fc.record({
        cantidad: escala === '0.01' ? fc.integer({ min: 1_000, max: 50_000_000 }) : fc.integer({ min: 1, max: 200_000 }),
        precio: escala === '0.01' ? centavos(100, 300_000) : centavos(100, 10_000_000),
        ppp: fc.option(escala === '0.01' ? centavos(100, 300_000) : centavos(100, 10_000_000), { nil: null }),
        liquidar: fc.boolean(),
        letra: fc.boolean(),
      }),
      { maxLength: 4 },
    )
    .map((xs) =>
      xs.map((x, i) => ({
        especie: `${prefijo}${i} - ${escala === '0.01' ? (x.letra ? 'LETRA DEL TESORO' : 'BONO DEL TESORO') : 'EMPRESA'} ${i}`,
        cantidad: String(x.cantidad),
        precio: x.precio,
        ppp: x.ppp,
        liquidacion: x.liquidar ? 'Liquidar' : 'Disponible',
      })),
    )

const arbPortafolio: fc.Arbitrary<PortafolioIEB> = fc
  .record({
    acciones: fc.option(arbPosiciones('1', 'ACC'), { nil: null }),
    bonos: fc.option(arbPosiciones('0.01', 'BON'), { nil: null }),
    cedears: fc.option(arbPosiciones('1', 'CED'), { nil: null }),
    dolares: fc.option(fc.record({ cantidad: centavos(1, 10_000_000), tasa: centavos(10_000, 300_000) }), { nil: null }),
    ars: centavos(-1_000_000_000, 1_000_000_000),
    usd: centavos(0, 50_000_000),
    dia: fc.integer({ min: 0, max: 3650 }),
  })
  .map((g) => {
    const secciones: SeccionIEB[] = []
    if (g.acciones) secciones.push({ titulo: 'Acciones', escala: '1', posiciones: g.acciones })
    if (g.bonos) secciones.push({ titulo: 'Bonos', escala: '0.01', posiciones: g.bonos })
    if (g.cedears) secciones.push({ titulo: 'Cedears', escala: '1', posiciones: g.cedears })
    if (g.dolares) {
      secciones.push({
        titulo: 'Otros',
        escala: '1',
        posiciones: [{ especie: 'DOLARUSA - DOLARES USA ESP 7000', moneda: 'USD', cantidad: g.dolares.cantidad, precio: g.dolares.tasa, ppp: null }],
      })
    }
    const fecha = new Date(Date.UTC(2024, 0, 1 + g.dia)).toISOString().slice(0, 10)
    // Sin DOLARUSA no hay dólar para valuar el saldo USD: ese caso tiene su propio test.
    return { fecha, secciones, saldos: { ars: { hoy: g.ars }, usd: { hoy: g.dolares ? g.usd : '0' } } }
  })

// IEB_CORRIDAS=500 npx vitest run src/lib/carga/ieb.test.ts para una pasada larga.
const CORRIDAS = Number(process.env.IEB_CORRIDAS) || null
// Cada corrida arma y lee un Excel: con la máquina cargada (servidores y otras
// suites en paralelo) 40 corridas pasan los 5 s por defecto. Margen holgado.
const LIMITE = CORRIDAS ? 600_000 : 60_000

describe('leerExcelIEB · propiedades (fast-check)', () => {
  it('cualquier portafolio sintético cierra: cada fila, cada Subtotal y B2', async () => {
    await fc.assert(
      fc.asyncProperty(arbPortafolio, async (p) => {
        const l = await leer(p)
        expect(l.fecha_reporte).toBe(p.fecha)
        const esperadas = p.secciones.flatMap((s) => (s.titulo === 'Otros' ? [] : s.posiciones.map((x) => ({ s, x }))))
        expect(l.filas).toHaveLength(esperadas.length)
        esperadas.forEach(({ s, x }, i) => {
          const f = l.filas[i]
          expect(f.escala).toBe(s.escala)
          expect(f.cantidad).toBe(new Decimal(x.cantidad).toFixed())
          expect(f.precio_unitario).toBe(new Decimal(x.precio).times(s.escala).toFixed())
          expect(f.valorizado).toBe(posicionIEB(s, x).toFixed())
          expect(f.ppc_unitario).toBe(x.ppp === null ? null : new Decimal(x.ppp).times(s.escala).toFixed())
          expect(f.chequeo?.ok).toBe(true)
          expect(f.estado).toBe(x.ppp === null ? 'advertencia' : 'verificada')
          expect(f.liquidacion).toBe(x.liquidacion === 'Liquidar' ? 'liquidar' : 'disponible')
          if (s.titulo === 'Bonos') expect(f.tipo_sugerido).toBe(x.especie.includes('LETRA') ? 'lecap' : 'bono')
        })
        expect(l.controles).toHaveLength(p.secciones.length + 1)
        expect(l.controles.every((c) => c.ok === true)).toBe(true)
        expect(b2(l).calculado).toBe(patrimonioIEB(p).toFixed())
        const dolarusa = p.secciones.find((s) => s.titulo === 'Otros')?.posiciones[0]
        expect(saldo(l, 'ARS')?.monto).toBe(new Decimal(p.saldos.ars?.hoy ?? 'NaN').toFixed())
        expect(saldo(l, 'USD')?.monto).toBe(new Decimal(p.saldos.usd?.hoy ?? 'NaN').plus(dolarusa?.cantidad ?? 0).toFixed())
        expect(l.advertencias).toEqual([])
      }),
      { numRuns: CORRIDAS ?? 40 },
    )
  }, LIMITE)

  it('adulterar la posición total de cualquier fila hace fallar su chequeo, su Subtotal y B2', async () => {
    const arb = arbPortafolio
      .filter((p) => p.secciones.some((s) => s.titulo !== 'Otros' && s.posiciones.length > 0))
      .chain((p) => {
        const candidatas = p.secciones.flatMap((s, i) => (s.titulo === 'Otros' ? [] : s.posiciones.map((_, j) => [i, j] as const)))
        return fc.tuple(fc.constant(p), fc.constantFrom(...candidatas), fc.integer({ min: 1_000_000, max: 100_000_000 }), fc.boolean())
      })
    await fc.assert(
      fc.asyncProperty(arb, async ([p, [i, j], centavosDelta, resta]) => {
        const s = p.secciones[i]
        const x = s.posiciones[j]
        const delta = new Decimal(centavosDelta).div(100).times(resta ? -1 : 1)
        const adulterada = posicionIEB(s, x).plus(delta).toFixed()
        const q: PortafolioIEB = {
          ...p,
          secciones: p.secciones.map((t, k) =>
            k !== i ? t : { ...t, posiciones: t.posiciones.map((y, m) => (m !== j ? y : { ...y, posicionEscrita: adulterada })) },
          ),
        }
        const l = await leer(q)
        const k = p.secciones.slice(0, i).reduce((a, t) => a + (t.titulo === 'Otros' ? 0 : t.posiciones.length), 0) + j
        expect(l.filas[k].estado).toBe('error')
        expect(l.filas[k].chequeo?.ok).toBe(false)
        expect(subtotal(l, s.titulo).ok).toBe(false)
        expect(b2(l).ok).toBe(false)
      }),
      { numRuns: CORRIDAS ?? 25 },
    )
  }, LIMITE)
})

// ───────────── Encaja con la conciliación ─────────────

describe('leerExcelIEB → proponerCarga (src/lib/carga/conciliar.ts)', async () => {
  const CUENTAS: Cuenta[] = [
    { id: 1, nombre: 'IEB', tipo: 'broker', formato_carga: 'excel_ieb', activa: true },
    { id: 2, nombre: 'Galicia', tipo: 'banco', formato_carga: 'captura', activa: true },
    { id: 3, nombre: 'Mercado Pago', tipo: 'billetera', formato_carga: 'captura', activa: true },
  ]
  const hechos: Hechos = {
    cuentas: CUENTAS,
    activos: [],
    operaciones: [],
    cotizaciones: [],
    tipos_cambio: [],
    saldos: [],
    movimientos: [],
    pasivos: [],
    pasivo_saldos: [],
    bienes: [],
    valuaciones: [],
    feriados: [],
    cargas: [],
  }
  const lectura = await leer(portafolioEjemplo())
  const propuesta = proponerCarga([lectura], hechos, '2026-10-07', { ccl: new Decimal('1548.2') })
  const decision = (ticker: string) => {
    const d = propuesta.filas.find((x) => x.ticker === ticker)
    if (!d) throw new Error(`Sin decisión para ${ticker}`)
    return d
  }

  it('primera carga: una apertura por posición, con el PPP por 1 VN como costo (D-14)', () => {
    expect(propuesta.filas).toHaveLength(6)
    for (const [ticker, cantidad, precio] of [
      ['YPFD', '300', '48200'],
      ['T30J7', '9000000', '1.0976'],
      ['TXMJ0', '5000000', '1.005'],
      ['S29Y7', '2500000', '1.012'],
      ['SPY', '1240', '30145.16'],
    ] as const) {
      const d = decision(ticker)
      expect([ticker, d.cuenta_id, d.accion, d.operacion?.tipo, d.operacion?.cantidad, d.operacion?.precio]).toEqual([
        ticker,
        1,
        'apertura',
        'apertura',
        cantidad,
        precio,
      ])
    }
    expect(decision('T30J7').cotizacion).toEqual({ precio_pesos: '1.124' })
  })

  it('el CEDEAR comprado hoy entra como compra con el precio pendiente y el CCL del día (D-19)', () => {
    const d = decision('XOM')
    expect(d.accion).toBe('compra')
    expect(d.operacion).toMatchObject({ tipo: 'compra', cantidad: '47', precio: null, ccl_del_dia: '1548.2' })
    expect(d.estado).toBe('advertencia')
    expect(d.motivos).toContain('Compra del día: el PPP llega con la próxima carga (D-19).')
  })

  it('los tickers nuevos traen una sugerencia de alta coherente con lo leído', () => {
    expect(decision('S29Y7').activo_nuevo).toMatchObject({ tipo: 'lecap', moneda_riesgo: 'ARS', geografia: 'AR', indexacion: 'fija' })
    expect(decision('TXMJ0').activo_nuevo).toMatchObject({ tipo: 'bono', indexacion: 'dual_cer_tamar' })
    expect(decision('SPY').activo_nuevo).toMatchObject({ tipo: 'cedear', moneda_riesgo: 'USD', geografia: 'US', ticker_subyacente: 'SPY' })
    expect(decision('YPFD').activo_nuevo).toMatchObject({ tipo: 'accion_local', nombre: 'YPF' })
  })

  it('pasan los dos saldos y los cinco controles, sin advertencias de fecha', () => {
    expect(propuesta.saldos.map((s) => [s.clave, s.monto, s.estado])).toEqual([
      ['IEB:saldo:ARS', '-85500', 'verificada'],
      ['IEB:saldo:USD', '4205.6', 'verificada'],
    ])
    expect(propuesta.controles).toHaveLength(5)
    expect(propuesta.controles.every((c) => c.cuenta === 'IEB' && c.control.ok === true)).toBe(true)
    expect(propuesta.advertencias).toEqual([])
    expect(propuesta.ausentes).toEqual([])
  })

  it('si la carga es de otro día que el Excel, la conciliación lo avisa', () => {
    const otra = proponerCarga([lectura], hechos, '2026-10-08', { ccl: new Decimal('1548.2') })
    expect(otra.advertencias).toEqual(['IEB: la fuente es del mié 07/10 y la carga es del jue 08/10.'])
  })
})

// ───────────── Revisión de la fase 1a (números inventados) ─────────────

describe('leerExcelIEB · un PPP de 0 es "sin dato" (D-107)', () => {
  it('PPP 0: el costo queda sin dato, con aviso; la primera carga propone la apertura sin costo, nunca a $ 0', async () => {
    const l = await leer(conPosicion(portafolioEjemplo(), 'YPFD', { ppp: '0' }))
    const f = fila(l, 'YPFD')
    expect(f).toMatchObject({ ppc_mostrado: null, ppc_unitario: null, estado: 'advertencia' })
    expect(f.motivos.join(' ')).toMatch(/PPP en .*0,00: el costo queda sin dato/)
    const cuentas: Cuenta[] = [{ id: 1, nombre: 'IEB', tipo: 'broker', formato_carga: 'excel_ieb', activa: true }]
    const hechos: Hechos = {
      cuentas,
      activos: [{ id: 2, ticker: 'YPFD', nombre: 'YPF', tipo: 'accion_local', moneda_riesgo: 'ARS', geografia: 'AR', indexacion: null, ticker_subyacente: null, fecha_vencimiento: null, color: null, activo_bool: true }],
      operaciones: [], cotizaciones: [], tipos_cambio: [], saldos: [], movimientos: [], pasivos: [], pasivo_saldos: [], bienes: [], valuaciones: [], feriados: [], cargas: [],
    }
    const d = proponerCarga([l], hechos, '2026-10-07', { ccl: new Decimal('1500') }).filas.find((x) => x.ticker === 'YPFD')!
    expect(d.operacion).toMatchObject({ tipo: 'apertura', cantidad: '300', precio: null })
    expect(d.estado).toBe('advertencia')
  })
})

describe('leerExcelIEB · un control que no cierra no deja nada verificado (D-11)', () => {
  it('B2 no cierra: aviso arriba y todas las filas y saldos de la cuenta en advertencia', async () => {
    const p = portafolioEjemplo()
    const l = await leer({ ...p, patrimonioTotal: patrimonioIEB(p).plus(1_000_000).toFixed() })
    expect(b2(l).ok).toBe(false)
    expect(l.advertencias[0]).toMatch(/^El Patrimonio total \(B2\) no cierra con lo leído/)
    expect(l.filas.every((f) => f.estado !== 'verificada')).toBe(true)
    expect(l.saldos.every((s) => s.estado !== 'verificada')).toBe(true)
    expect(fila(l, 'SPY').motivos).toContain('El Patrimonio total (B2) no cierra con lo leído: ¿falta una posición o hay un número mal leído?')
  })

  it('un Subtotal que no cierra: solo esa sección baja a advertencia, con el aviso arriba', async () => {
    const p = portafolioEjemplo()
    const l = await leer({ ...p, secciones: p.secciones.map((s) => (s.titulo === 'Bonos' ? { ...s, subtotal: '17000000' } : s)) })
    expect(subtotal(l, 'Bonos').ok).toBe(false)
    expect(l.advertencias.some((a) => a.startsWith('El Subtotal de Bonos no cierra'))).toBe(true)
    expect(['T30J7', 'TXMJ0', 'S29Y7'].map((t) => fila(l, t).estado)).toEqual(['advertencia', 'advertencia', 'advertencia'])
    expect(fila(l, 'SPY').estado).toBe('verificada')
    expect(b2(l).ok).toBe(true)
  })
})
