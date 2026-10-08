import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConfirmacionCarga, CuentaAGrabar } from '@/lib/carga/contratos'
import { hoyCordoba } from '@/lib/domain/fechas'

// Cliente falso de Supabase: registra las llamadas y responde lo que diga cada test.
const fake = vi.hoisted(() => {
  const estado = {
    rpc: [] as { fn: string; args: Record<string, unknown> }[],
    respuestasRpc: [] as { data: unknown; error: unknown }[],
    inserts: [] as { tabla: string; fila: unknown }[],
    respuestaInsert: { data: { id: 7 } as unknown, error: null as unknown },
    uploads: [] as { bucket: string; path: string; opciones: unknown }[],
    respuestaUpload: { data: null as unknown, error: null as unknown },
  }
  const cliente = {
    rpc: (fn: string, args: Record<string, unknown>) => {
      estado.rpc.push({ fn, args })
      return Promise.resolve(estado.respuestasRpc.shift() ?? { data: null, error: { code: 'XX000', message: 'sin respuesta' } })
    },
    from: (tabla: string) => ({
      insert: (fila: unknown) => {
        estado.inserts.push({ tabla, fila })
        return { select: () => ({ single: () => Promise.resolve(estado.respuestaInsert) }) }
      },
    }),
    storage: {
      from: (bucket: string) => ({
        upload: (path: string, _bytes: Uint8Array, opciones: unknown) => {
          estado.uploads.push({ bucket, path, opciones })
          return Promise.resolve(estado.respuestaUpload)
        },
      }),
    },
  }
  return { estado, cliente }
})

vi.mock('./supabase', () => ({ supabase: () => fake.cliente }))

import {
  actualizarActivo,
  confirmarCarga,
  crearActivo,
  crearBien,
  crearPasivo,
  ErrorEscritura,
  esDuplicado,
  extensionArchivo,
  fechaOpcional,
  fechaRequerida,
  guardarPasivoSaldo,
  guardarValuacionBien,
  leerId,
  leerResultadoConfirmacion,
  leerResumenReversion,
  loteValido,
  montoParaBase,
  montoRequerido,
  normalizarActivoNuevo,
  normalizarBien,
  normalizarCambiosActivo,
  normalizarConfirmacion,
  normalizarPasivo,
  revertirLote,
  rutaArchivo,
  sha256Hex,
  subirArchivo,
  tiempoActivo,
  tipoContenido,
  traducirErrorBase,
} from './escritura'

const LOTE = 'a0000000-0000-4000-8000-00000000000a'
const SHA = '1111111111111111111111111111111111111111111111111111111111111111'

function cuentaIEB(cambios: Partial<CuentaAGrabar> = {}): CuentaAGrabar {
  return {
    cuenta_id: 1,
    origen: 'excel',
    archivo_path: `2026/11/${SHA}.xlsx`,
    archivo_sha256: SHA,
    lector: 'ieb-excel@1',
    lectura_cruda: { hoja: 'Patrimonio' },
    grabado: { filas: 2 },
    listado_completo: true,
    cotizaciones: [
      { activo_id: 10, precio_pesos: '20000.50' },
      { activo_id: 11, precio_pesos: '1.2345' },
    ],
    saldos: [
      { moneda: 'ARS', monto: '-50000.25' },
      { moneda: 'USD', monto: '120.5' },
    ],
    operaciones: [
      {
        activo_id: 11,
        tipo: 'apertura',
        cantidad: '1000000',
        moneda: 'ARS',
        precio: '1.2',
        importe: null,
        comisiones: '0',
        ccl_del_dia: null,
        fecha_origen: null,
        notas: null,
      },
    ],
    ...cambios,
  }
}

function confirmacion(cambios: Partial<ConfirmacionCarga> = {}): ConfirmacionCarga {
  return {
    lote: LOTE,
    fecha: '2026-11-02',
    tipo_cambio: { ccl: '1500.50', cripto_venta: '1480', mep: null, oficial: null },
    cuentas: [cuentaIEB()],
    tiempo_activo_ms: 41234.6,
    nota: '  el CCL saltó  ',
    ...cambios,
  }
}

/** Ejecuta y devuelve el mensaje del error (falla si no lanza). */
function mensaje(f: () => unknown): string {
  try {
    f()
  } catch (e) {
    expect(e).toBeInstanceOf(ErrorEscritura)
    return (e as Error).message
  }
  throw new Error('debía lanzar')
}

async function mensajeAsync(f: () => Promise<unknown>): Promise<string> {
  try {
    await f()
  } catch (e) {
    return (e as Error).message
  }
  throw new Error('debía lanzar')
}

beforeEach(() => {
  fake.estado.rpc.length = 0
  fake.estado.respuestasRpc.length = 0
  fake.estado.inserts.length = 0
  fake.estado.uploads.length = 0
  fake.estado.respuestaInsert = { data: { id: 7 }, error: null }
  fake.estado.respuestaUpload = { data: { path: 'x' }, error: null }
})

describe('montoParaBase (D-32)', () => {
  it('acepta texto decimal y lo manda tal cual, sin pasar por float', () => {
    expect(montoParaBase('1234.56', 'el precio')).toBe('1234.56')
    expect(montoParaBase(' 1500.50 ', 'el CCL', 'positivo')).toBe('1500.50')
    expect(montoParaBase('-50000.25', 'el saldo')).toBe('-50000.25')
    expect(montoParaBase('0.1000000000000000000001', 'x')).toBe('0.1000000000000000000001')
  })

  it('vacío o ausente es "sin dato", nunca cero', () => {
    expect(montoParaBase(null, 'x')).toBeNull()
    expect(montoParaBase(undefined, 'x')).toBeNull()
    expect(montoParaBase('  ', 'x')).toBeNull()
  })

  it('rechaza un number de JavaScript', () => {
    expect(mensaje(() => montoParaBase(1500.5, 'el CCL'))).toBe('El valor del CCL llegó como número: los montos viajan como texto (D-32).')
  })

  it.each(['NaN', 'Infinity', '-Infinity', '1e3', '0x10', '1.234,56', '12abc', '+5', '.5', '5.', '--1'])(
    'rechaza "%s"',
    (v) => {
      expect(mensaje(() => montoParaBase(v, 'el precio'))).toMatch(/no es un número decimal/)
    },
  )

  it('aplica el signo permitido', () => {
    expect(mensaje(() => montoParaBase('0', 'el CCL', 'positivo'))).toBe('El valor del CCL tiene que ser mayor que cero.')
    expect(mensaje(() => montoParaBase('-0.01', 'las comisiones', 'no_negativo'))).toBe('El valor de las comisiones no puede ser negativo.')
    expect(montoParaBase('0', 'las comisiones', 'no_negativo')).toBe('0')
  })

  it('montoRequerido avisa qué falta', () => {
    expect(mensaje(() => montoRequerido(null, 'el valor de la valuación'))).toBe('Falta el valor de la valuación.')
  })
})

describe('fechas, lote y tiempo activo', () => {
  it('fechas AAAA-MM-DD que existen', () => {
    expect(fechaOpcional('2026-10-08', 'la fecha')).toBe('2026-10-08')
    expect(fechaOpcional(null, 'la fecha')).toBeNull()
    expect(mensaje(() => fechaOpcional('2026-02-30', 'la fecha'))).toMatch(/no existe en el calendario/)
    expect(mensaje(() => fechaOpcional('8/10/2026', 'la fecha'))).toMatch(/AAAA-MM-DD/)
    expect(mensaje(() => fechaRequerida('', 'la fecha de la carga'))).toBe('Falta la fecha de la carga.')
  })

  it('lote: uuid en minúscula', () => {
    expect(loteValido('A0000000-0000-4000-8000-00000000000A')).toBe(LOTE)
    expect(mensaje(() => loteValido('123'))).toMatch(/lote no es un identificador válido/)
  })

  it('tiempo activo: milisegundos enteros, no negativos', () => {
    expect(tiempoActivo(41234.6)).toBe(41235)
    expect(tiempoActivo(null)).toBeNull()
    expect(mensaje(() => tiempoActivo(-1))).toMatch(/no negativo/)
    expect(mensaje(() => tiempoActivo(Number.NaN))).toMatch(/milisegundos/)
  })
})

describe('normalizarConfirmacion', () => {
  it('normaliza una confirmación válida', () => {
    const p = normalizarConfirmacion(
      confirmacion({
        lote: LOTE.toUpperCase(),
        cuentas: [
          cuentaIEB({
            operaciones: [
              {
                activo_id: 10,
                tipo: 'compra',
                cantidad: '10',
                moneda: null as unknown as 'ARS',
                precio: null,
                importe: null,
                comisiones: null as unknown as string,
                ccl_del_dia: '1500.50',
                fecha_origen: null,
                notas: ' compra del día ',
              },
            ],
          }),
        ],
      }),
    )
    expect(p.lote).toBe(LOTE)
    expect(p.tiempo_activo_ms).toBe(41235)
    expect(p.nota).toBe('el CCL saltó')
    expect(p.tipo_cambio).toEqual({ ccl: '1500.50', cripto_venta: '1480', mep: null, oficial: null })
    expect(p.cuentas[0].operaciones[0]).toEqual({
      activo_id: 10,
      tipo: 'compra',
      cantidad: '10',
      moneda: 'ARS',
      precio: null,
      importe: null,
      comisiones: '0',
      ccl_del_dia: '1500.50',
      fecha_origen: null,
      notas: 'compra del día',
    })
    expect(p.cuentas[0].saldos).toEqual([
      { moneda: 'ARS', monto: '-50000.25' },
      { moneda: 'USD', monto: '120.5' },
    ])
  })

  it('un tipo de cambio sin valores no se manda', () => {
    const p = normalizarConfirmacion(confirmacion({ tipo_cambio: { ccl: null, cripto_venta: '', mep: null, oficial: null } }))
    expect(p.tipo_cambio).toBeNull()
  })

  it('sin tipo de cambio ni cuentas no hay nada para grabar', () => {
    expect(mensaje(() => normalizarConfirmacion(confirmacion({ tipo_cambio: null, cuentas: [] })))).toMatch(/No hay nada para grabar/)
  })

  it('rechaza la misma cuenta dos veces', () => {
    expect(mensaje(() => normalizarConfirmacion(confirmacion({ cuentas: [cuentaIEB(), cuentaIEB()] })))).toMatch(/aparece dos veces/)
  })

  it('exige el archivo con su sha256 en una carga de Excel o captura, y ninguno en una manual', () => {
    expect(mensaje(() => normalizarConfirmacion(confirmacion({ cuentas: [cuentaIEB({ archivo_path: null, archivo_sha256: null })] })))).toMatch(
      /Falta el archivo/,
    )
    expect(mensaje(() => normalizarConfirmacion(confirmacion({ cuentas: [cuentaIEB({ archivo_sha256: null })] })))).toMatch(/necesita su sha256/)
    expect(mensaje(() => normalizarConfirmacion(confirmacion({ cuentas: [cuentaIEB({ archivo_sha256: 'abc' })] })))).toMatch(/sha256 .* no es válido/)
    expect(
      mensaje(() => normalizarConfirmacion(confirmacion({ cuentas: [cuentaIEB({ archivo_path: '2026/11/otro.xlsx' })] }))),
    ).toMatch(/no corresponde a su sha256/)
    expect(mensaje(() => normalizarConfirmacion(confirmacion({ cuentas: [cuentaIEB({ origen: 'manual' })] })))).toMatch(
      /manual no lleva archivo/,
    )
    const manual = normalizarConfirmacion(
      confirmacion({ cuentas: [cuentaIEB({ origen: 'manual', archivo_path: null, archivo_sha256: null })] }),
    )
    expect(manual.cuentas[0].archivo_path).toBeNull()
  })

  it('un activo sin dar de alta (id 0) se avisa antes de mandar', () => {
    const op = { ...cuentaIEB().operaciones[0], activo_id: 0 }
    expect(mensaje(() => normalizarConfirmacion(confirmacion({ cuentas: [cuentaIEB({ operaciones: [op] })] })))).toMatch(
      /falta darlo de alta/,
    )
  })

  it('rechaza tipos y monedas fuera de catálogo, y duplicados', () => {
    const op = { ...cuentaIEB().operaciones[0], tipo: 'regalo' as never }
    expect(mensaje(() => normalizarConfirmacion(confirmacion({ cuentas: [cuentaIEB({ operaciones: [op] })] })))).toMatch(/opciones: apertura/)
    expect(
      mensaje(() =>
        normalizarConfirmacion(confirmacion({ cuentas: [cuentaIEB({ saldos: [{ moneda: 'EUR' as never, monto: '1' }] })] })),
      ),
    ).toMatch(/moneda/)
    expect(
      mensaje(() =>
        normalizarConfirmacion(
          confirmacion({
            cuentas: [
              cuentaIEB({
                cotizaciones: [
                  { activo_id: 10, precio_pesos: '1' },
                  { activo_id: 10, precio_pesos: '2' },
                ],
              }),
            ],
          }),
        ),
      ),
    ).toMatch(/dos cotizaciones/)
    expect(
      mensaje(() =>
        normalizarConfirmacion(
          confirmacion({
            cuentas: [
              cuentaIEB({
                saldos: [
                  { moneda: 'ARS', monto: '1' },
                  { moneda: 'ARS', monto: '2' },
                ],
              }),
            ],
          }),
        ),
      ),
    ).toMatch(/dos saldos en ARS/)
  })

  it('un precio como number no pasa (D-32)', () => {
    const cot = [{ activo_id: 10, precio_pesos: 20000.5 as unknown as string }]
    expect(mensaje(() => normalizarConfirmacion(confirmacion({ cuentas: [cuentaIEB({ cotizaciones: cot })] })))).toMatch(
      /viajan como texto/,
    )
  })
})

describe('respuestas de la base', () => {
  it('leerResultadoConfirmacion acepta la forma de ResultadoConfirmacion', () => {
    const r = leerResultadoConfirmacion(
      {
        lote: LOTE,
        cargas: [
          { carga_id: 1, cuenta_id: null },
          { carga_id: 2, cuenta_id: 1 },
        ],
        repetido: false,
      },
      LOTE,
    )
    expect(r).toEqual({
      lote: LOTE,
      cargas: [
        { carga_id: 1, cuenta_id: null },
        { carga_id: 2, cuenta_id: 1 },
      ],
      repetido: false,
    })
  })

  it.each([
    ['no es un objeto', null],
    ['otro lote', { lote: 'b0000000-0000-4000-8000-00000000000b', cargas: [{ carga_id: 1, cuenta_id: null }], repetido: false }],
    ['sin "repetido"', { lote: LOTE, cargas: [{ carga_id: 1, cuenta_id: null }] }],
    ['sin cargas', { lote: LOTE, cargas: [], repetido: true }],
    ['carga sin id', { lote: LOTE, cargas: [{ carga_id: 0, cuenta_id: null }], repetido: false }],
    ['cuenta sin id', { lote: LOTE, cargas: [{ carga_id: 3 }], repetido: false }],
  ])('leerResultadoConfirmacion rechaza: %s', (_, data) => {
    expect(mensaje(() => leerResultadoConfirmacion(data, LOTE))).toMatch(/respondió algo inesperado/)
  })

  it('leerResumenReversion', () => {
    expect(leerResumenReversion({ lote: LOTE, cargas: [4, 5], borradas: 1, restauradas: 3 }, LOTE)).toEqual({
      lote: LOTE,
      cargas: [4, 5],
      borradas: 1,
      restauradas: 3,
    })
    expect(mensaje(() => leerResumenReversion({ lote: LOTE, cargas: [4], borradas: -1, restauradas: 0 }, LOTE))).toMatch(/sin conteos/)
  })

  it('leerId', () => {
    expect(leerId(5, 'x')).toBe(5)
    expect(leerId('7', 'x')).toBe(7)
    for (const malo of [0, 1.5, null, 'abc', -3]) expect(() => leerId(malo, 'x')).toThrow(ErrorEscritura)
  })
})

describe('traducirErrorBase', () => {
  it('los mensajes propios de la base pasan tal cual', () => {
    const e = traducirErrorBase({ code: 'P0001', message: 'Falta el motivo de la reversión' }, 'revertir el lote')
    expect(e.message).toBe('Falta el motivo de la reversión.')
    expect(e.codigo).toBe('P0001')
  })

  it('unique violation → "Ya existe …"', () => {
    expect(
      traducirErrorBase(
        {
          code: '23505',
          message: 'duplicate key value violates unique constraint "activos_ticker_key"',
          details: 'Key (ticker)=(SPY) already exists.',
        },
        'dar de alta el activo',
      ).message,
    ).toBe('Ya existe un activo con ese ticker: SPY.')
    expect(
      traducirErrorBase(
        { code: '23505', message: 'duplicate key value violates unique constraint "x_key"', details: 'Key (a)=(b) already exists.' },
        'x',
      ).message,
    ).toBe('Ya existe un registro con a = b.')
  })

  it('check violation → qué campo, con el contexto que agrega la base', () => {
    expect(
      traducirErrorBase(
        {
          code: '23514',
          message: 'new row for relation "operaciones" violates check constraint "operaciones_forma"',
          details: 'IEB · venta de AL30',
        },
        'confirmar la carga',
      ).message,
    ).toBe('La operación no tiene la forma de su tipo. Una venta lleva cantidad mayor que cero y su precio o su importe (IEB · venta de AL30).')
    expect(
      traducirErrorBase(
        {
          code: '23514',
          message: 'new row for relation "cotizaciones" violates check constraint "cotizaciones_precio_pesos_check"',
          details: 'Failing row contains (2026-11-02, 1, 0, null, 3).',
        },
        'confirmar la carga',
      ).message,
    ).toBe('El precio en pesos tiene que ser mayor que cero.')
    expect(
      traducirErrorBase(
        { code: '23514', message: 'new row for relation "pasivo_cuotas" violates check constraint "pasivo_cuotas_canon_neto_check"' },
        'x',
      ).message,
    ).toBe('El valor de canon_neto no es válido.')
  })

  it('not null → "Falta …"', () => {
    expect(
      traducirErrorBase(
        { code: '23502', message: 'null value in column "fuente" of relation "bienes_valuaciones" violates not-null constraint', details: 'valuación de Casa' },
        'guardar la valuación',
      ).message,
    ).toBe('Falta la fuente de la valuación (valuación de Casa).')
  })

  it('foreign key → qué no existe', () => {
    expect(
      traducirErrorBase(
        {
          code: '23503',
          message: 'insert or update on table "cotizaciones" violates foreign key constraint "cotizaciones_activo_id_fkey"',
          details: 'IEB · cotización de activo #99 (no está en el catálogo)',
        },
        'confirmar la carga',
      ).message,
    ).toBe('El activo no está en el catálogo: dalo de alta antes de grabar su precio (IEB · cotización de activo #99 (no está en el catálogo)).')
  })

  it('red, migración faltante, permisos y desconocidos', () => {
    expect(traducirErrorBase({ code: '', message: 'TypeError: fetch failed' }, 'confirmar la carga').message).toBe(
      'No se pudo conectar con la base para confirmar la carga. Revisá la conexión y probá de nuevo.',
    )
    expect(
      traducirErrorBase(
        { code: 'PGRST202', message: 'Could not find the function public.confirmar_carga(p) in the schema cache' },
        'confirmar la carga',
      ).message,
    ).toMatch(/public\.confirmar_carga: falta aplicar la migración 20261008120000_carga_transaccional/)
    expect(traducirErrorBase({ code: '42501', message: 'permission denied for function confirmar_carga' }, 'confirmar la carga').message).toMatch(
      /no le da permiso/,
    )
    expect(traducirErrorBase({ code: 'XX000', message: 'algo raro' }, 'confirmar la carga').message).toBe(
      'No se pudo confirmar la carga: algo raro.',
    )
  })
})

describe('archivos', () => {
  it('sha256 de los bytes', () => {
    expect(sha256Hex(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('extensión por tipo MIME, si no por nombre', () => {
    expect(extensionArchivo('image/png', 'captura')).toBe('png')
    expect(extensionArchivo('image/jpeg; charset=binary', '')).toBe('jpg')
    expect(extensionArchivo('', 'Portafolio.XLSX')).toBe('xlsx')
    expect(extensionArchivo('application/octet-stream', 'foto.jpeg')).toBe('jpg')
    expect(extensionArchivo('', 'sin-extension')).toBe('bin')
    expect(extensionArchivo('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'x.bin')).toBe('xlsx')
  })

  it('content-type para Storage', () => {
    expect(tipoContenido('image/png', 'png')).toBe('image/png')
    expect(tipoContenido('', 'xlsx')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(tipoContenido('application/octet-stream', 'png')).toBe('image/png')
    expect(tipoContenido('cualquier cosa', 'bin')).toBe('application/octet-stream')
  })

  it('ruta AAAA/MM/<sha256>.<ext>', () => {
    expect(rutaArchivo(SHA, 'png', '2026-10-08')).toBe(`2026/10/${SHA}.png`)
    expect(() => rutaArchivo('abc', 'png', '2026-10-08')).toThrow(ErrorEscritura)
    expect(() => rutaArchivo(SHA, 'p/ng', '2026-10-08')).toThrow(ErrorEscritura)
  })

  it('reconoce el aviso de objeto duplicado de Storage', () => {
    expect(esDuplicado({ statusCode: '409', message: 'The resource already exists' })).toBe(true)
    expect(esDuplicado({ status: 409 })).toBe(true)
    expect(esDuplicado({ code: 'ResourceAlreadyExists' })).toBe(true)
    expect(esDuplicado({ status: 400, statusCode: '404', message: 'Bucket not found' })).toBe(false)
    expect(esDuplicado(null)).toBe(false)
  })
})

describe('catálogo', () => {
  const cedear = {
    ticker: ' spy ',
    nombre: 'CEDEAR SPDR S&P 500',
    tipo: 'cedear' as const,
    moneda_riesgo: 'USD' as const,
    geografia: 'US' as const,
    indexacion: null,
    ticker_subyacente: 'spy',
  }

  it('alta de activo: ticker en mayúsculas y ratio vigente desde hoy', () => {
    const p = normalizarActivoNuevo({ ...cedear, ratio: '20', color: '#123abc' }, '2026-10-08')
    expect(p).toMatchObject({ ticker: 'SPY', ticker_subyacente: 'SPY', ratio: '20', ratio_vigente_desde: '2026-10-08', color: '#123abc' })
    // Sin ratio: "sin dato".
    expect(normalizarActivoNuevo(cedear, '2026-10-08').ratio).toBeNull()
  })

  it('alta de activo: reglas del schema, con mensajes', () => {
    expect(mensaje(() => normalizarActivoNuevo({ ...cedear, ticker_subyacente: null }, '2026-10-08'))).toMatch(/necesita el ticker de su subyacente/)
    const bono = { ...cedear, ticker: 'T30J7', tipo: 'bono' as const, moneda_riesgo: 'ARS' as const, geografia: 'AR' as const, ticker_subyacente: null }
    expect(mensaje(() => normalizarActivoNuevo(bono, '2026-10-08'))).toMatch(/necesita su indexación/)
    expect(mensaje(() => normalizarActivoNuevo({ ...bono, indexacion: 'fija', ratio: '5' }, '2026-10-08'))).toMatch(/solo va en un CEDEAR/)
    expect(mensaje(() => normalizarActivoNuevo({ ...cedear, indexacion: 'fija' }, '2026-10-08'))).toMatch(/Solo un bono o una LECAP/)
    expect(mensaje(() => normalizarActivoNuevo({ ...cedear, ratio: '0' }, '2026-10-08'))).toMatch(/mayor que cero/)
    expect(mensaje(() => normalizarActivoNuevo({ ...cedear, color: 'rojo' }, '2026-10-08'))).toMatch(/#RRGGBB/)
  })

  it('cambios de activo: solo lo presente', () => {
    expect(normalizarCambiosActivo({})).toEqual({})
    expect(normalizarCambiosActivo({ color: undefined, nombre: 'Nuevo' })).toEqual({ nombre: 'Nuevo' })
    expect(normalizarCambiosActivo({ color: null, indexacion: null, ticker_subyacente: ' ' })).toEqual({
      color: null,
      indexacion: null,
      ticker_subyacente: null,
    })
    expect(normalizarCambiosActivo({ ratio: { ratio: '25', vigente_desde: '2026-12-01' } })).toEqual({
      ratio: { ratio: '25', vigente_desde: '2026-12-01' },
    })
    expect(mensaje(() => normalizarCambiosActivo({ nombre: ' ' }))).toMatch(/Falta el nombre/)
    expect(mensaje(() => normalizarCambiosActivo({ activo_bool: 'si' as never }))).toMatch(/sí o no/)
    expect(mensaje(() => normalizarCambiosActivo({ ratio: { ratio: '-1', vigente_desde: '2026-12-01' } }))).toMatch(/mayor que cero/)
  })

  it('bienes y pasivos', () => {
    expect(normalizarBien({ nombre: ' Casa ', tipo: 'inmueble', moneda_valuacion: 'USD' })).toEqual({
      nombre: 'Casa',
      tipo: 'inmueble',
      moneda_valuacion: 'USD',
      geografia: 'AR',
      pasivo_id: null,
    })
    const pasivo = { nombre: 'Leasing', tipo: 'leasing' as const, moneda: 'ARS' as const, fecha_inicio: '2025-06-01', cuotas_totales: 36 }
    expect(normalizarPasivo({ ...pasivo, monto_financiado_neto: '1000000.50', anticipo_neto: '0' })).toMatchObject({
      monto_financiado_neto: '1000000.50',
      anticipo_neto: '0',
      opcion_compra_neto: null,
      valor_bien: null,
    })
    expect(mensaje(() => normalizarPasivo({ ...pasivo, cuotas_totales: 0 }))).toMatch(/entero mayor que cero/)
    expect(mensaje(() => normalizarPasivo({ ...pasivo, cuotas_totales: 1.5 }))).toMatch(/entero mayor que cero/)
    expect(mensaje(() => normalizarPasivo({ ...pasivo, anticipo_neto: '-1' }))).toMatch(/no puede ser negativo/)
  })
})

describe('llamadas a la base (cliente falso)', () => {
  it('confirmarCarga manda la confirmación normalizada a confirmar_carga y valida la respuesta', async () => {
    fake.estado.respuestasRpc.push({
      data: { lote: LOTE, cargas: [{ carga_id: 1, cuenta_id: null }, { carga_id: 2, cuenta_id: 1 }], repetido: false },
      error: null,
    })
    const r = await confirmarCarga(confirmacion())
    expect(r.cargas).toHaveLength(2)
    expect(fake.estado.rpc).toHaveLength(1)
    expect(fake.estado.rpc[0].fn).toBe('confirmar_carga')
    const p = fake.estado.rpc[0].args.p as ConfirmacionCarga
    expect(p.tiempo_activo_ms).toBe(41235)
    expect(p.cuentas[0].cotizaciones[0].precio_pesos).toBe('20000.50')
  })

  it('confirmarCarga reintenta una vez si no hubo respuesta (es idempotente por lote)', async () => {
    fake.estado.respuestasRpc.push({ data: null, error: { code: '', message: 'TypeError: fetch failed' } })
    fake.estado.respuestasRpc.push({ data: { lote: LOTE, cargas: [{ carga_id: 1, cuenta_id: null }], repetido: true }, error: null })
    const r = await confirmarCarga(confirmacion())
    expect(r.repetido).toBe(true)
    expect(fake.estado.rpc).toHaveLength(2)
  })

  it('confirmarCarga no manda nada si la entrada no es válida', async () => {
    expect(await mensajeAsync(() => confirmarCarga(confirmacion({ fecha: '2026-13-01' })))).toMatch(/fecha de la carga/)
    expect(fake.estado.rpc).toHaveLength(0)
  })

  it('confirmarCarga traduce el error de la base', async () => {
    fake.estado.respuestasRpc.push({
      data: null,
      error: { code: 'P0001', message: 'Una cuenta aparece dos veces en la misma carga', details: null, hint: null },
    })
    expect(await mensajeAsync(() => confirmarCarga(confirmacion()))).toBe('Una cuenta aparece dos veces en la misma carga.')
    expect(fake.estado.rpc).toHaveLength(1)
  })

  it('revertirLote exige motivo y no reintenta', async () => {
    expect(await mensajeAsync(() => revertirLote(LOTE, '  '))).toBe('Falta el motivo de la reversión.')
    expect(fake.estado.rpc).toHaveLength(0)
    fake.estado.respuestasRpc.push({ data: null, error: { code: '', message: 'TypeError: fetch failed' } })
    expect(await mensajeAsync(() => revertirLote(LOTE, 'lectura equivocada'))).toMatch(/No se pudo conectar/)
    expect(fake.estado.rpc).toHaveLength(1)
    fake.estado.respuestasRpc.push({ data: { lote: LOTE, cargas: [4, 5], borradas: 1, restauradas: 3 }, error: null })
    expect(await revertirLote(LOTE, ' lectura equivocada ')).toEqual({ lote: LOTE, cargas: [4, 5], borradas: 1, restauradas: 3 })
    expect(fake.estado.rpc[1]).toEqual({ fn: 'revertir_lote', args: { p_lote: LOTE, p_motivo: 'lectura equivocada' } })
  })

  it('guardarValuacionBien y guardarPasivoSaldo usan guardar_manual con un lote nuevo', async () => {
    fake.estado.respuestasRpc.push({ data: 41, error: null }, { data: 42, error: null })
    expect(await guardarValuacionBien({ bien_id: 1, fecha: '2026-11-02', valor: '25000000', fuente: ' tasación ' })).toBe(41)
    expect(await guardarPasivoSaldo({ pasivo_id: 2, fecha: '2026-11-02', capital_pendiente: '900000.50' })).toBe(42)
    const [a, b] = fake.estado.rpc
    expect(a.fn).toBe('guardar_manual')
    expect(a.args.p).toMatchObject({
      fecha: '2026-11-02',
      bienes_valuaciones: [{ bien_id: 1, fecha: '2026-11-02', valor: '25000000', fuente: 'tasación' }],
    })
    expect(b.args.p).toMatchObject({ pasivo_saldos: [{ pasivo_id: 2, fecha: '2026-11-02', capital_pendiente: '900000.50' }] })
    const lotes = [(a.args.p as { lote: string }).lote, (b.args.p as { lote: string }).lote]
    expect(lotes[0]).toMatch(/^[0-9a-f-]{36}$/)
    expect(lotes[0]).not.toBe(lotes[1])
  })

  it('crearActivo usa alta_activo con el ratio desde hoy; actualizarActivo sin cambios no llama', async () => {
    fake.estado.respuestasRpc.push({ data: 12, error: null })
    const id = await crearActivo({
      ticker: 'SPY',
      nombre: 'CEDEAR SPDR',
      tipo: 'cedear',
      moneda_riesgo: 'USD',
      geografia: 'US',
      indexacion: null,
      ticker_subyacente: 'SPY',
      ratio: '20',
    })
    expect(id).toBe(12)
    expect(fake.estado.rpc[0].fn).toBe('alta_activo')
    expect((fake.estado.rpc[0].args.p as { ratio_vigente_desde: string }).ratio_vigente_desde).toBe(hoyCordoba())
    await actualizarActivo(12, {})
    expect(fake.estado.rpc).toHaveLength(1)
    fake.estado.respuestasRpc.push({ data: null, error: null })
    await actualizarActivo(12, { color: '#00aa00' })
    expect(fake.estado.rpc[1]).toEqual({ fn: 'editar_activo', args: { p_id: 12, p: { color: '#00aa00' } } })
  })

  it('crearBien y crearPasivo insertan una fila y devuelven su id', async () => {
    expect(await crearBien({ nombre: 'Casa', tipo: 'inmueble', moneda_valuacion: 'USD' })).toBe(7)
    expect(fake.estado.inserts[0]).toEqual({
      tabla: 'bienes',
      fila: { nombre: 'Casa', tipo: 'inmueble', moneda_valuacion: 'USD', geografia: 'AR', pasivo_id: null },
    })
    fake.estado.respuestaInsert = {
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint "pasivos_nombre_key"', details: 'Key (nombre)=(Leasing) already exists.' },
    }
    expect(
      await mensajeAsync(() =>
        crearPasivo({ nombre: 'Leasing', tipo: 'leasing', moneda: 'ARS', fecha_inicio: '2025-06-01', cuotas_totales: 36, valor_bien: '50000000' }),
      ),
    ).toBe('Ya existe un pasivo con ese nombre: Leasing.')
    expect((fake.estado.inserts[1].fila as { valor_bien: unknown }).valor_bien).toBe('50000000')
  })

  it('subirArchivo nombra el archivo por su sha256 y reusa uno ya subido', async () => {
    const bytes = new TextEncoder().encode('abc')
    const sha = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    const hoy = hoyCordoba()
    const esperado = `${hoy.slice(0, 4)}/${hoy.slice(5, 7)}/${sha}.png`
    expect(await subirArchivo(bytes, 'image/png', 'captura.png')).toEqual({ path: esperado, sha256: sha })
    expect(fake.estado.uploads[0]).toEqual({ bucket: 'cargas', path: esperado, opciones: { contentType: 'image/png', upsert: false } })

    fake.estado.respuestaUpload = { data: null, error: { status: 409, statusCode: '409', message: 'The resource already exists' } }
    expect(await subirArchivo(bytes, 'image/png', 'captura.png')).toEqual({ path: esperado, sha256: sha })

    fake.estado.respuestaUpload = { data: null, error: new Error('Bucket not found') }
    expect(await mensajeAsync(() => subirArchivo(bytes, 'image/png', 'captura.png'))).toBe('No se pudo guardar el archivo: Bucket not found')
    expect(await mensajeAsync(() => subirArchivo(new Uint8Array(), 'image/png', 'vacia.png'))).toBe('El archivo está vacío.')
  })
})
