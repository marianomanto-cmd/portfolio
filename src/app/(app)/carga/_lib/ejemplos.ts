// Lecturas de ejemplo con números INVENTADOS (Apéndice B de docs/vision.md):
// sirven para los tests y para el botón "Probar con un ejemplo" del modo demo.
// Nunca datos reales del dueño (D-24).

import { Decimal } from '@/lib/domain/dinero'
import type { FilaLeida, LecturaCuenta, SaldoLeido } from '@/lib/carga/contratos'
import type { Fecha } from '@/lib/domain/tipos'
import type { ActivoLocal } from './demo'

function fila(p: Partial<FilaLeida> & Pick<FilaLeida, 'clave' | 'ticker' | 'cantidad' | 'precio_unitario' | 'valorizado'>): FilaLeida {
  const calculado = p.cantidad && p.precio_unitario ? new Decimal(p.cantidad).times(p.precio_unitario).toFixed() : null
  return {
    nombre: null,
    seccion: null,
    tipo_sugerido: null,
    moneda_emision: 'ARS',
    precio_mostrado: p.precio_unitario,
    escala: '1',
    ppc_mostrado: null,
    ppc_unitario: null,
    costo_total: null,
    liquidacion: 'disponible',
    estado: 'verificada',
    motivos: [],
    chequeo:
      p.valorizado && calculado
        ? { regla: 'cantidad × precio × escala ≈ valorizado', esperado: p.valorizado, calculado, tolerancia: '0.01', ok: true }
        : null,
    lugar: null,
    ...p,
  }
}

function saldo(p: Partial<SaldoLeido> & Pick<SaldoLeido, 'moneda' | 'monto'>): SaldoLeido {
  return { partes: [], tna: null, estado: 'verificada', motivos: [], lugar: null, ...p }
}

export function lecturaIEBEjemplo(fecha: Fecha): LecturaCuenta {
  return {
    cuenta: 'IEB',
    origen: 'excel',
    fecha_reporte: fecha,
    filas: [
      fila({ clave: 'IEB:SPY', ticker: 'SPY', nombre: 'SPDR S&P 500 (CEDEAR)', seccion: 'cedears', tipo_sugerido: 'cedear', cantidad: '1240', precio_unitario: '35150', valorizado: '43586000', ppc_mostrado: '30145.16', ppc_unitario: '30145.16', lugar: 'hoja Patrimonio, fila 18' }),
      fila({ clave: 'IEB:YPFD', ticker: 'YPFD', nombre: 'YPF S.A. clase D', seccion: 'acciones', tipo_sugerido: 'accion_local', cantidad: '300', precio_unitario: '52300', valorizado: '15690000', ppc_mostrado: '48200', ppc_unitario: '48200', lugar: 'hoja Patrimonio, fila 7' }),
      fila({ clave: 'IEB:T30J7', ticker: 'T30J7', nombre: 'BONCAP T30J7', seccion: 'bonos', tipo_sugerido: 'bono', cantidad: '9000000', precio_mostrado: '112.40', escala: '0.01', precio_unitario: '1.124', valorizado: '10116000', ppc_mostrado: '109.76', ppc_unitario: '1.0976', lugar: 'hoja Patrimonio, fila 12' }),
      fila({ clave: 'IEB:TXMJ0', ticker: 'TXMJ0', nombre: 'BONTE dual TXMJ0', seccion: 'bonos', tipo_sugerido: 'bono', cantidad: '5000000', precio_mostrado: '103.10', escala: '0.01', precio_unitario: '1.031', valorizado: '5155000', ppc_mostrado: '100.50', ppc_unitario: '1.005', lugar: 'hoja Patrimonio, fila 14' }),
    ],
    saldos: [
      saldo({ moneda: 'ARS', monto: '-185000', lugar: 'hoja Saldos, ARS, Total' }),
      saldo({ moneda: 'USD', monto: '4200', partes: [{ concepto: 'Total de la hoja Saldos', monto: '1200' }, { concepto: 'DOLARUSA (dólares en especie)', monto: '3000' }], lugar: 'hoja Saldos, USD, Total + DOLARUSA' }),
    ],
    controles: [
      { tipo: 'ieb_b2', seccion: null, informado: '80830000', calculado: '80830000', ok: true, detalle: 'DOLARUSA al dólar de IEB (1.540,00)' },
      { tipo: 'ieb_subtotal', seccion: 'Cedears', informado: '43586000', calculado: '43586000', ok: true, detalle: null },
    ],
    advertencias: [],
    tipo_cambio_fuente: { dolar_ieb: '1540' },
    lector: 'ejemplo@1',
    cruda: { ejemplo: true },
  }
}

export function lecturaGaliciaEjemplo(): LecturaCuenta {
  return {
    cuenta: 'Galicia',
    origen: 'captura',
    fecha_reporte: null,
    filas: [
      fila({ clave: 'Galicia:S13N6', ticker: 'S13N6', nombre: 'LECAP S13N6', tipo_sugerido: 'lecap', cantidad: '11500000', precio_unitario: '1.0852', valorizado: '12479800', ppc_mostrado: '1.04', ppc_unitario: '1.0426', costo_total: '11989900' }),
      fila({ clave: 'Galicia:FIMA', ticker: 'FIMA', nombre: 'FIMA Premium clase A', tipo_sugerido: 'fci', cantidad: '1250000', precio_unitario: '4.812', valorizado: '6015000', ppc_mostrado: '4.62', ppc_unitario: '4.62', costo_total: '5775000' }),
    ],
    saldos: [],
    controles: [{ tipo: 'galicia_total', seccion: null, informado: '18494800', calculado: '18494800', ok: true, detalle: null }],
    advertencias: [],
    lector: 'ejemplo@1',
    cruda: { ejemplo: true },
  }
}

/**
 * Galicia con una fila en la que las dos lecturas de la captura no coinciden
 * (la cantidad): para ver en el modo demo cómo se elige una con un toque.
 */
export function lecturaGaliciaDosLecturasEjemplo(): LecturaCuenta {
  const l = lecturaGaliciaEjemplo()
  l.filas[0] = {
    ...l.filas[0],
    estado: 'advertencia',
    motivos: ['Cantidad — Lectura A: 11.500.000 · Lectura B: 11.300.000 (se propone la A, que cierra cantidad × precio ≈ valorizado).'],
    alternativas: [{ campo: 'cantidad', a: '11500000', b: '11300000', propuesta: 'A' }],
  }
  return l
}

export function lecturaMPEjemplo(): LecturaCuenta {
  return {
    cuenta: 'Mercado Pago',
    origen: 'captura',
    fecha_reporte: null,
    filas: [],
    saldos: [
      saldo({
        moneda: 'ARS',
        monto: '4912300',
        tna: '27.5',
        estado: 'advertencia',
        motivos: ['Saldo — Lectura A: $ 4.912.300 · Lectura B: $ 4.912.800 (se propone la A).'],
        alternativas: [{ campo: 'monto', a: '4912300', b: '4912800', propuesta: 'A' }],
      }),
    ],
    controles: [],
    advertencias: [],
    lector: 'ejemplo@1',
    cruda: { ejemplo: true },
  }
}

/** Catálogo del ejemplo: todo menos FIMA, para mostrar el alta en la misma pantalla. */
export function catalogoEjemplo(): ActivoLocal[] {
  return [
    { id: -1, ticker: 'SPY', nombre: 'SPDR S&P 500 (CEDEAR)', tipo: 'cedear', moneda_riesgo: 'USD', geografia: 'US', indexacion: null, ticker_subyacente: 'SPY' },
    { id: -2, ticker: 'YPFD', nombre: 'YPF S.A. clase D', tipo: 'accion_local', moneda_riesgo: 'ARS', geografia: 'AR', indexacion: null, ticker_subyacente: null },
    { id: -3, ticker: 'T30J7', nombre: 'BONCAP T30J7', tipo: 'bono', moneda_riesgo: 'ARS', geografia: 'AR', indexacion: 'fija', ticker_subyacente: null },
    { id: -4, ticker: 'TXMJ0', nombre: 'BONTE dual TXMJ0', tipo: 'bono', moneda_riesgo: 'ARS', geografia: 'AR', indexacion: 'dual_cer_tamar', ticker_subyacente: null },
    { id: -5, ticker: 'S13N6', nombre: 'LECAP S13N6', tipo: 'lecap', moneda_riesgo: 'ARS', geografia: 'AR', indexacion: 'fija', ticker_subyacente: null },
  ]
}
