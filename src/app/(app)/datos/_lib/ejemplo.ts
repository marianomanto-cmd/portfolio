// Datos de ejemplo INVENTADOS (Apéndice B de docs/vision.md) para el modo demo
// y para cuando falta la base. Nunca datos reales del dueño (D-24).

import type { DatosPantalla } from './servidor'

export function ejemploDatos(): Omit<DatosPantalla, 'modo' | 'aviso'> {
  return {
    activos: [
      { id: 1, ticker: 'SPY', nombre: 'SPDR S&P 500 (CEDEAR)', tipo: 'cedear', moneda_riesgo: 'USD', geografia: 'US', indexacion: null, ticker_subyacente: 'SPY', fecha_vencimiento: null, color: '#2f5bd3', activo_bool: true },
      { id: 2, ticker: 'YPFD', nombre: 'YPF S.A. clase D', tipo: 'accion_local', moneda_riesgo: 'ARS', geografia: 'AR', indexacion: null, ticker_subyacente: null, fecha_vencimiento: null, color: '#c8650a', activo_bool: true },
      { id: 3, ticker: 'T30J7', nombre: 'BONCAP T30J7', tipo: 'bono', moneda_riesgo: 'ARS', geografia: 'AR', indexacion: 'fija', ticker_subyacente: null, fecha_vencimiento: '2027-06-30', color: '#0f7a43', activo_bool: true },
      { id: 4, ticker: 'TXMJ0', nombre: 'BONTE dual TXMJ0', tipo: 'bono', moneda_riesgo: 'ARS', geografia: 'AR', indexacion: 'dual_cer_tamar', ticker_subyacente: null, fecha_vencimiento: null, color: null, activo_bool: true },
      { id: 5, ticker: 'S13N6', nombre: 'LECAP S13N6', tipo: 'lecap', moneda_riesgo: 'ARS', geografia: 'AR', indexacion: 'fija', ticker_subyacente: null, fecha_vencimiento: '2026-11-13', color: '#8a5a00', activo_bool: true },
      { id: 6, ticker: 'FIMA', nombre: 'FIMA Premium clase A', tipo: 'fci', moneda_riesgo: 'ARS', geografia: 'AR', indexacion: null, ticker_subyacente: null, fecha_vencimiento: null, color: null, activo_bool: true },
    ],
    ratios: [
      { activo_id: 1, vigente_desde: '2024-01-01', ratio: '10' },
      { activo_id: 1, vigente_desde: '2026-05-01', ratio: '20' },
    ],
    cuentas: [
      { id: 1, nombre: 'IEB', tipo: 'broker', formato_carga: 'excel_ieb', activa: true },
      { id: 2, nombre: 'Galicia', tipo: 'banco', formato_carga: 'captura', activa: true },
      { id: 3, nombre: 'Mercado Pago', tipo: 'billetera', formato_carga: 'captura', activa: true },
    ],
    bienes: [
      { id: 1, nombre: 'Casa', tipo: 'inmueble', moneda_valuacion: 'USD', geografia: 'AR', pasivo_id: null, activo_bool: true },
      { id: 2, nombre: 'Camioneta', tipo: 'vehiculo', moneda_valuacion: 'ARS', geografia: 'AR', pasivo_id: 1, activo_bool: true },
    ],
    valuaciones: [
      { bien_id: 1, fecha: '2025-09-15', valor: '200000', fuente: 'Tasación de una inmobiliaria', carga_id: null },
      { bien_id: 2, fecha: '2026-03-10', valor: '38000000', fuente: 'Guía de precios', carga_id: null },
    ],
    pasivos: [
      {
        id: 1,
        nombre: 'Leasing camioneta',
        tipo: 'leasing',
        moneda: 'ARS',
        fecha_inicio: '2025-08-17',
        cuotas_totales: 48,
        monto_financiado_neto: '42000000',
        anticipo_neto: '8000000',
        opcion_compra_neto: '1500000',
        opcion_compra_fecha: '2029-08-17',
        valor_bien: '50000000',
        notas: null,
      },
    ],
    saldosPasivo: [{ pasivo_id: 1, fecha: '2026-09-30', capital_pendiente: '21400000', carga_id: null }],
    ccl: { fecha: '2026-10-14', valor: '1548.2' },
    movimientos: [
      {
        id: 2,
        fecha: '2026-10-13',
        fecha_acreditacion: '2026-10-14',
        tipo: 'transferencia',
        cuenta_origen_id: 3,
        cuenta_destino_id: 1,
        moneda_origen: 'ARS',
        monto_origen: '1000000',
        moneda_destino: 'ARS',
        monto_destino: '1000000',
        tc_aplicado: null,
        impuesto: '0',
        carga_id: null,
        notas: 'A IEB para comprar LECAP',
      },
      {
        id: 1,
        fecha: '2026-10-05',
        fecha_acreditacion: null,
        tipo: 'aporte',
        cuenta_origen_id: null,
        cuenta_destino_id: 3,
        moneda_origen: 'USD',
        monto_origen: '1000',
        moneda_destino: 'ARS',
        monto_destino: '1480000',
        tc_aplicado: '1480',
        impuesto: '0',
        carga_id: null,
        notas: 'USD del sueldo vendidos a cripto',
      },
    ],
    ccls: [
      { fecha: '2026-10-05', valor: '1525.5' },
      { fecha: '2026-10-13', valor: '1541' },
      { fecha: '2026-10-14', valor: '1548.2' },
    ],
  }
}
