import { describe, expect, it } from 'vitest'
import { Decimal } from '@/lib/domain/dinero'
import { proponerCarga } from '@/lib/carga/conciliar'
import { aplicarEdiciones, editarFila, toleranciaEditada } from './ediciones'
import {
  SIN_ELECCIONES,
  alternativasFila,
  claveAusente,
  estadoFila,
  problemaRegistroAusente,
  alternativasSaldo,
  diferenciaDolarIEB,
  enlaceMovimiento,
  huellaFila,
  huellaSaldo,
  precioACompletar,
  resumirBandeja,
  saltoDeSaldo,
  textoBoton,
  type Elecciones,
} from './bandeja'
import type { DecisionFila, FilaLeida } from '@/lib/carga/contratos'
import { catalogoEjemplo, lecturaGaliciaEjemplo, lecturaIEBEjemplo, lecturaMPEjemplo } from './ejemplos'
import { conCompraPendiente, hechosSinBase } from './demo'

const FECHA = '2026-10-14'
const propuestaEjemplo = (ccl: string | null = '1548.2') =>
  proponerCarga(
    [lecturaIEBEjemplo(FECHA), lecturaGaliciaEjemplo(), lecturaMPEjemplo()],
    hechosSinBase(catalogoEjemplo()),
    FECHA,
    { ccl: ccl === null ? null : new Decimal(ccl) },
  )

describe('resumirBandeja', () => {
  it('cuenta leídas, verificadas y a revisar como el Apéndice B', () => {
    const r = resumirBandeja(propuestaEjemplo(), SIN_ELECCIONES, 2)
    // 6 filas + 3 saldos + CCL y cripto.
    expect(r.leidas).toBe(11)
    // FIMA no está en el catálogo y MP tiene dos lecturas distintas.
    expect(r.aRevisar).toBe(2)
    expect(r.verificadas).toBe(9)
    expect(r.errores).toBe(0)
    expect(r.quedanPendientes).toBe(2)
    // Lo que no cerró va primero.
    expect(r.items[0].estado).not.toBe('verificada')
    expect(r.items.at(-1)?.estado).toBe('verificada')
  })

  it('una advertencia se acepta de a una, con su motivo', () => {
    const p = propuestaEjemplo()
    const mp = p.saldos.find((s) => s.cuenta === 'Mercado Pago')!
    const e: Elecciones = {
      ...SIN_ELECCIONES,
      saldos: { [mp.clave]: { resolucion: 'aceptada', motivo: 'elegí la lectura 1', monto: '4912300', huella: huellaSaldo(mp) } },
    }
    const r = resumirBandeja(p, e, 2)
    expect(r.verificadas).toBe(10)
    expect(r.aRevisar).toBe(1)
  })

  it('una elección hecha sobre otra propuesta no vale', () => {
    const p = propuestaEjemplo()
    const mp = p.saldos.find((s) => s.cuenta === 'Mercado Pago')!
    const e: Elecciones = {
      ...SIN_ELECCIONES,
      saldos: { [mp.clave]: { resolucion: 'aceptada', motivo: 'x', monto: '1', huella: 'otra' } },
    }
    expect(resumirBandeja(p, e, 2).verificadas).toBe(9)
  })

  it('sin CCL, una compra queda en error y frena el Enter', () => {
    // Segunda carga de IEB con una compra: la app ya tiene 8.000.000 de T30J7.
    const hechos = hechosSinBase(catalogoEjemplo())
    hechos.operaciones.push({
      id: 1, fecha: '2026-10-01', fecha_origen: null, cuenta_id: 1, activo_id: -3, tipo: 'apertura',
      cantidad: new Decimal(8_000_000), moneda: 'ARS', precio: new Decimal('1.097475'), importe: null,
      comisiones: new Decimal(0), ccl_del_dia: null, carga_id: 1, notas: null,
    })
    const ieb = lecturaIEBEjemplo(FECHA)
    ieb.filas = ieb.filas.filter((f) => f.ticker === 'T30J7')
    const p = proponerCarga([ieb], hechos, FECHA, { ccl: null })
    const t30 = p.filas.find((f) => f.ticker === 'T30J7')!
    expect(t30.accion).toBe('compra')
    const r = resumirBandeja(p, SIN_ELECCIONES, 0)
    expect(r.errores).toBe(1)
    const b = textoBoton(r, { leyendo: [], proponiendo: false, guardando: false })
    expect(b.habilitado).toBe(false)
    expect(b.texto).toBe('Resolvé 1 error para guardar')
    // Dejarla pendiente destraba el Enter.
    const e: Elecciones = { ...SIN_ELECCIONES, filas: { [t30.clave]: { resolucion: 'pendiente', motivo: 'la dejé pendiente', operacion: null, huella: huellaFila(t30) } } }
    const r2 = resumirBandeja(p, e, 0)
    expect(r2.errores).toBe(0)
    expect(textoBoton(r2, { leyendo: [], proponiendo: false, guardando: false }).habilitado).toBe(true)
  })
})

describe('textoBoton', () => {
  const base = resumirBandeja(propuestaEjemplo(), SIN_ELECCIONES, 2)
  it('dice qué va a hacer el Enter, con números', () => {
    expect(textoBoton(base, { leyendo: [], proponiendo: false, guardando: false })).toEqual({
      texto: 'Guardar 9 · dejar 2 pendientes',
      habilitado: true,
      motivo: null,
    })
  })
  it('espera a que terminen las lecturas', () => {
    expect(textoBoton(base, { leyendo: ['MP'], proponiendo: false, guardando: false }).texto).toBe('Esperando MP (leyendo…)')
  })
  it('carga express: solo los tipos de cambio', () => {
    const r = resumirBandeja(null, SIN_ELECCIONES, 2)
    expect(textoBoton(r, { leyendo: [], proponiendo: false, guardando: false }).texto).toBe('Guardar 2')
  })
  it('sin nada no guarda', () => {
    const r = resumirBandeja(null, SIN_ELECCIONES, 0)
    expect(textoBoton(r, { leyendo: [], proponiendo: false, guardando: false }).habilitado).toBe(false)
  })
})

describe('ediciones', () => {
  const f = lecturaGaliciaEjemplo().filas[0]
  it('una edición que cierra contra el valorizado queda verificada', () => {
    const r = editarFila({ ...f, estado: 'error', precio_unitario: null }, { cantidad: null, precio_unitario: '1.0852' })
    expect(r.estado).toBe('verificada')
    expect(r.chequeo?.ok).toBe(true)
  })
  it('una edición que no cierra sigue en error, con la cuenta a la vista', () => {
    // 1,09 tiene menos decimales que la fuente: no alcanza para cerrar.
    const r = editarFila(f, { cantidad: null, precio_unitario: '1.09' })
    expect(r.estado).toBe('error')
    expect(r.motivos[0]).toMatch(/no cierra/)
  })
  it('sin valorizado no hay control: queda como advertencia', () => {
    const r = editarFila({ ...f, valorizado: null }, { cantidad: '100', precio_unitario: '2' })
    expect(r.estado).toBe('advertencia')
  })
  it('tolerancia: medio último dígito por la cantidad más medio centavo (D-37)', () => {
    expect(toleranciaEditada('11500000', '1.0852').toFixed()).toBe('575.005')
  })
  it('no toca la lectura original', () => {
    const l = lecturaGaliciaEjemplo()
    const [editada] = aplicarEdiciones([l], { [f.clave]: { cantidad: '1', precio_unitario: null } })
    expect(editada.filas[0].cantidad).toBe('1')
    expect(l.filas[0].cantidad).toBe('11500000')
  })
})

describe('saltoDeSaldo', () => {
  it('la suba que explica la TNA no pregunta nada (Apéndice B: MP subió $3.700)', () => {
    const r = saltoDeSaldo('4908600', '4912300', '27.5', 1)
    expect(r.suba).toBe('3700')
    expect(r.sinExplicar).toBeNull()
  })
  it('una suba mayor pregunta "¿entró o salió plata?"', () => {
    const r = saltoDeSaldo('4908600', '5412300', '0.275', 1)
    expect(r.sinExplicar).not.toBeNull()
    expect(Number(r.sinExplicar)).toBeGreaterThan(499_000)
  })
  it('sin TNA solo muestra la diferencia', () => {
    // Sin TNA (el efectivo de IEB baja con cada compra), una baja no pregunta nada.
    expect(saltoDeSaldo('100', '50', null, 1)).toEqual({ suba: '-50', explicadoHasta: null, sinExplicar: null, baja: null })
  })
})

describe('alternativasSaldo', () => {
  const base = { ...lecturaMPEjemplo().saldos[0], alternativas: undefined }
  it('toma las partes rotuladas como lecturas (lecturas viejas)', () => {
    const conPartes = {
      ...base,
      partes: [
        { concepto: 'lectura 1', monto: '4912300' },
        { concepto: 'lectura 2', monto: '4912800' },
      ],
    }
    expect(alternativasSaldo(conPartes)).toEqual([
      { concepto: 'lectura 1', monto: '4912300', propuesta: true },
      { concepto: 'lectura 2', monto: '4912800', propuesta: false },
    ])
  })
  it('lee el motivo del lector de capturas', () => {
    const s = { ...base, partes: [], motivos: ['Saldo — Lectura A: $ 4.912.300,00 · Lectura B: $ 4.912.800 (se propone la A).'] }
    expect(alternativasSaldo(s)).toEqual([
      { concepto: 'lectura A', monto: '4912300', propuesta: true },
      { concepto: 'lectura B', monto: '4912800', propuesta: false },
    ])
  })
  it('usa las alternativas estructuradas del lector cuando las hay (y su propuesta)', () => {
    const s = { ...base, partes: [], motivos: ['texto libre'], alternativas: [{ campo: 'monto', a: '4912300.00', b: '4912800', propuesta: 'B' as const }] }
    expect(alternativasSaldo(s)).toEqual([
      { concepto: 'lectura A', monto: '4912300', propuesta: false },
      { concepto: 'lectura B', monto: '4912800', propuesta: true },
    ])
    expect(alternativasSaldo({ ...s, alternativas: [{ campo: 'monto', a: '4912300', b: '"49l2" (ilegible)', propuesta: 'A' as const }] })).toEqual([])
  })
  it('si una lectura es ilegible, no ofrece elegir', () => {
    const s = { ...base, partes: [], motivos: ['Saldo — Lectura A: $ 4.912.300 · Lectura B: "49l2" (ilegible) (se propone la A).'] }
    expect(alternativasSaldo(s)).toEqual([])
    expect(alternativasSaldo({ ...base, partes: [{ concepto: 'Total de la hoja Saldos', monto: '1' }], motivos: [] })).toEqual([])
  })
})

describe('D-19 en la bandeja: completar el precio de una compra pendiente', () => {
  const d = {
    accion: 'completar_precio',
    completar: { operacion_id: 31, precio: '12200', fecha: '2026-10-07', cantidad: '10', formula: 'f' },
  } as unknown as DecisionFila
  it('sin elegir, usa el precio propuesto; tipeado, el tuyo; null, no completa', () => {
    expect(precioACompletar(d, null)).toBe('12200')
    const e = { resolucion: 'aceptada' as const, motivo: null, operacion: null, huella: 'h' }
    expect(precioACompletar(d, e)).toBe('12200')
    expect(precioACompletar(d, { ...e, precio_completar: '12250.5' })).toBe('12250.5')
    expect(precioACompletar(d, { ...e, precio_completar: null })).toBeNull()
    expect(precioACompletar(d, { ...e, precio_completar: '0' })).toBeNull()
    expect(precioACompletar(d, { ...e, precio_completar: 'abc' })).toBeNull()
    expect(precioACompletar({ ...d, accion: 'ninguna' } as DecisionFila, e)).toBeNull()
  })
  it('la huella cambia si cambia el precio propuesto: la elección vieja se cae', () => {
    const base = { estado: 'advertencia', activo_id: 1, accion: 'completar_precio', operacion: null, cotizacion: null } as unknown as DecisionFila
    const h1 = huellaFila({ ...base, completar: { ...d.completar!, precio: '12200' } })
    const h2 = huellaFila({ ...base, completar: { ...d.completar!, precio: '12300' } })
    expect(h1).not.toBe(h2)
  })
})

describe('las dos lecturas de una fila (4.2.1)', () => {
  const f: FilaLeida = {
    ...lecturaGaliciaEjemplo().filas[0],
    estado: 'advertencia',
    alternativas: [
      { campo: 'cantidad', a: '11500000', b: '11800000', propuesta: 'A' },
      { campo: 'precio', a: '108.52', b: '108.25', propuesta: 'A' },
      { campo: 'rendimiento_monto', a: '489900', b: '"48990O" (ilegible)', propuesta: 'A' },
    ],
    escala: '0.01',
    precio_mostrado: '108.52',
  }
  it('la propuesta acepta la fila; la otra corrige el número (el precio, con la escala de la fila)', () => {
    const [q, p, r] = alternativasFila(f, null)
    expect(q.etiqueta).toBe('Cantidad')
    expect(q.opciones[0]).toMatchObject({ lectura: 'A', propuesta: true, edicion: 'aceptar' })
    expect(q.opciones[1].edicion).toEqual({ cantidad: '11800000', precio_unitario: null, valorizado: null })
    expect(p.opciones[1].edicion).toEqual({ cantidad: null, precio_unitario: '1.0825', valorizado: null })
    // Rendimiento: se muestra, pero no se elige con un toque (y la ilegible nunca).
    expect(r.opciones[0].edicion).toBe('aceptar')
    expect(r.opciones[1].edicion).toBeNull()
  })
  it('elegir otra lectura respeta lo que ya corregiste en otro campo', () => {
    const [q] = alternativasFila(f, { cantidad: null, precio_unitario: '1.0825', valorizado: null })
    expect(q.opciones[1].edicion).toEqual({ cantidad: '11800000', precio_unitario: '1.0825', valorizado: null })
    // Volver a la propuesta de la cantidad deja solo la corrección del precio.
    expect(q.opciones[0].edicion).toEqual({ cantidad: null, precio_unitario: '1.0825', valorizado: null })
  })
  it('sin escala conocida, el precio no se elige con un toque', () => {
    const [, p] = alternativasFila({ ...f, escala: null }, null)
    expect(p.opciones[1].edicion).toBeNull()
  })
  it('una fila sin alternativas no muestra nada', () => {
    expect(alternativasFila(lecturaGaliciaEjemplo().filas[0], null)).toEqual([])
  })
  it('elegir el valorizado de la otra lectura se controla contra la cuenta', () => {
    const g = { ...lecturaGaliciaEjemplo().filas[0], alternativas: [{ campo: 'valorizado', a: '12479800', b: '12497800', propuesta: 'A' as const }] }
    const [v] = alternativasFila(g, null)
    const e = v.opciones[1].edicion
    expect(e).toEqual({ cantidad: null, precio_unitario: null, valorizado: '12497800' })
    const editada = editarFila(g, e as { cantidad: null; precio_unitario: null; valorizado: string })
    expect(editada.valorizado).toBe('12497800')
    expect(editada.estado).toBe('error')
    expect(editada.motivos[0]).toMatch(/valorizado/)
  })
})

describe('¿entró o salió plata? → Datos › Movimientos', () => {
  it('una baja también se marca (los intereses no restan)', () => {
    expect(saltoDeSaldo('1000000', '700000', '27.5', 1).baja).toBe('300000')
    expect(saltoDeSaldo('1000000', '1000200', '27.5', 1).baja).toBeNull()
  })
  it('el enlace precarga tipo, cuenta, moneda, monto y fecha', () => {
    const u = enlaceMovimiento({ tipo: 'aporte', cuenta_id: 3, moneda: 'ARS', monto: '499650.25', fecha: '2026-10-14' })
    expect(u).toBe('/datos/movimientos?tipo=aporte&cuenta=3&moneda=ARS&monto=499650.25&fecha=2026-10-14')
  })
})

describe('D-66: DOLARUSA al dólar de IEB vs tu CCL', () => {
  it('diferencia con nombre, en pesos y en proporción del CCL', () => {
    expect(diferenciaDolarIEB('1540', '1548.2')).toEqual({ dolar: '1540', ccl: '1548.2', diferencia: '-8.2', fraccion: new Decimal('-8.2').div('1548.2').toFixed() })
  })
  it('sin uno de los dos, no hay diferencia (nunca cero)', () => {
    expect(diferenciaDolarIEB(null, '1548.2')).toBeNull()
    expect(diferenciaDolarIEB('1540', null)).toBeNull()
    expect(diferenciaDolarIEB('1540', '0')).toBeNull()
  })
})

describe('escenario demo "compra pendiente" (D-19)', () => {
  it('con el ejemplo de IEB, SPY propone completar el precio de la compra pendiente', () => {
    const p = proponerCarga([lecturaIEBEjemplo(FECHA)], conCompraPendiente(hechosSinBase(catalogoEjemplo())), FECHA, { ccl: new Decimal('1548.2') })
    const spy = p.filas.find((f) => f.ticker === 'SPY')!
    expect(spy.accion).toBe('completar_precio')
    expect(spy.completar).toMatchObject({ operacion_id: -2, precio: '35699.84', fecha: '2026-01-05' })
    expect(conCompraPendiente(hechosSinBase([])).operaciones).toEqual([])
  })
})

// ───────────── Revisión de la fase 1a (números inventados) ─────────────

describe('saltoDeSaldo: la TNA viene siempre en porcentaje', () => {
  it('una TNA de 1 % no se toma como 100 %: al 1 % los intereses explican unos $ 123 en 3 días', () => {
    const r = saltoDeSaldo('1000000', '1010000', '1', 3)
    // Tope: 1,5 % (medio último dígito de más) × 1.000.000 × 3 ÷ 365.
    expect(r.explicadoHasta).toBe('123.29')
    expect(r.sinExplicar).toBe('9876.71')
  })
})

describe('tenencias que la fuente ya no lista en la bandeja', () => {
  // IEB ya cargada con SPY; el Excel de hoy no trae ninguna posición.
  function propuestaSinSPY(ccl: string | null = '1548.2') {
    const h = hechosSinBase(catalogoEjemplo())
    h.cargas.push({ id: 1, lote: null, fecha: '2026-10-13', cuenta_id: 1, origen: 'excel', archivo_path: 'x', estado: 'vigente', creado_en: '', reemplaza_a: null, lector: null, tiempo_activo_ms: null })
    h.operaciones.push({
      id: 1, fecha: '2026-10-01', fecha_origen: null, cuenta_id: 1, activo_id: -1, tipo: 'apertura', cantidad: new Decimal(1240), moneda: 'ARS',
      precio: new Decimal('30145.16'), importe: null, comisiones: new Decimal(0), ccl_del_dia: null, carga_id: 1, notas: null,
    })
    return proponerCarga([{ ...lecturaIEBEjemplo(FECHA), filas: [] }], h, FECHA, { ccl: ccl === null ? null : new Decimal(ccl) })
  }

  it('sin elegir queda a revisar; registrada se guarda; pendiente queda pendiente', () => {
    const p = propuestaSinSPY()
    const a = p.ausentes[0]
    const item = (e: Elecciones) => resumirBandeja(p, e, 1).items.find((i) => i.tipo === 'ausente')!
    expect(item(SIN_ELECCIONES).estado).toBe('advertencia')
    expect(item({ ...SIN_ELECCIONES, ausentes: { [claveAusente(a)]: 'pendiente' } }).estado).toBe('pendiente')
    const venta = { tipo: 'venta' as const, cantidad: '1240', precio: '35150', importe: null }
    const r = resumirBandeja(p, { ...SIN_ELECCIONES, ausentes: { [claveAusente(a)]: venta } }, 1)
    expect(r.items.find((i) => i.tipo === 'ausente')?.estado).toBe('aceptada')
    expect(textoBoton(r, { leyendo: [], proponiendo: false, guardando: false })).toMatchObject({ texto: 'Guardar 4', habilitado: true })
  })

  it('una registración incompleta es un error que frena el Enter con su porqué', () => {
    const p = propuestaSinSPY()
    const a = p.ausentes[0]
    const sinPrecio = { tipo: 'venta' as const, cantidad: '1240', precio: null, importe: null }
    const r = resumirBandeja(p, { ...SIN_ELECCIONES, ausentes: { [claveAusente(a)]: sinPrecio } }, 1)
    expect(r.errores).toBe(1)
    expect(problemaRegistroAusente(a, sinPrecio)).toBe('la venta necesita el precio o el importe')
    expect(problemaRegistroAusente(a, { tipo: 'venta', cantidad: '1240', precio: '0', importe: null })).toBe('el precio tiene que ser mayor que cero')
    // SPY es un CEDEAR: solo se vende (un vencimiento no se ofrece y la elección no vale).
    expect(a.opciones).toEqual(['venta'])
    const vto = { tipo: 'vencimiento' as const, cantidad: '1240', precio: null, importe: '43000000' }
    expect(resumirBandeja(p, { ...SIN_ELECCIONES, ausentes: { [claveAusente(a)]: vto } }, 1).items.find((i) => i.tipo === 'ausente')?.estado).toBe('advertencia')
  })

  it('sin CCL (ni tipeado ni cargado ese día) no se puede registrar', () => {
    const p = propuestaSinSPY(null)
    const a = p.ausentes[0]
    expect(problemaRegistroAusente(a, { tipo: 'venta', cantidad: '1240', precio: '35150', importe: null })).toBe('la venta necesita el CCL del día: tipealo arriba')
  })
})

describe('"Ya la tenía" en la bandeja', () => {
  it('elegir la apertura destraba una compra cuyo único error era el CCL (la apertura no lo lleva)', () => {
    const h = hechosSinBase(catalogoEjemplo())
    h.cargas.push({ id: 1, lote: null, fecha: '2026-10-07', cuenta_id: 1, origen: 'excel', archivo_path: 'x', estado: 'vigente', creado_en: '', reemplaza_a: null, lector: null, tiempo_activo_ms: null })
    const l = lecturaIEBEjemplo(FECHA)
    l.filas = l.filas.filter((f) => f.ticker === 'T30J7')
    const d = proponerCarga([l], h, FECHA, { ccl: null }).filas[0]
    expect(estadoFila(d, null)).toBe('error')
    expect(estadoFila(d, { resolucion: 'aceptada', motivo: 'ya la tenía', operacion: null, apertura: true, huella: huellaFila(d) })).toBe('aceptada')
    // Aceptar la compra sin CCL sigue en error.
    expect(estadoFila(d, { resolucion: 'aceptada', motivo: 'compra', operacion: null, huella: huellaFila(d) })).toBe('error')
  })
})
