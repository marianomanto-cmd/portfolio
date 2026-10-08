import 'server-only'

import { cache } from 'react'
import { dec, decReq } from '@/lib/domain/dinero'
import type {
  Activo,
  Bien,
  BienValuacion,
  CargaResumen,
  Cotizacion,
  Cuenta,
  Feriado,
  Hechos,
  MovimientoCapital,
  Operacion,
  Pasivo,
  PasivoSaldo,
  Saldo,
  TipoCambio,
} from '@/lib/domain/tipos'
import { leerTodo } from './supabase'

// Lee todos los hechos de la base y los convierte al dominio. Los numeric
// vienen como texto (::text) y pasan a Decimal acá y en ningún otro lado.
//
// Una sola lectura por pedido: el shell (indicador de datos, punto de Cargar)
// y la pantalla piden los hechos por su lado, y React cache() los comparte
// dentro del mismo render del servidor. Fuera de un render (Server Actions,
// Route Handlers, tests) cache() no guarda nada y cada llamada lee la base:
// una acción que escribe y vuelve a leer ve lo que acaba de escribir.
// Quien recibe los hechos no los modifica (los comparten varias pantallas).

type Fila = Record<string, string | number | boolean | null>

const s = (v: Fila[string]) => (v === null ? null : String(v))
const n = (v: Fila[string]) => Number(v)

export const leerHechos: () => Promise<Hechos> = cache(leerHechosDeLaBase)

async function leerHechosDeLaBase(): Promise<Hechos> {
  const [
    cuentas,
    activos,
    operaciones,
    cotizaciones,
    tipos,
    saldos,
    movimientos,
    pasivos,
    pasivoSaldos,
    bienes,
    valuaciones,
    feriados,
    cargas,
  ] = await Promise.all([
    leerTodo<Fila>('cuentas', 'id,nombre,tipo,formato_carga,activa', ['id']),
    leerTodo<Fila>(
      'activos',
      'id,ticker,nombre,tipo,moneda_riesgo,geografia,indexacion,ticker_subyacente,fecha_vencimiento,color,activo_bool',
      ['id'],
    ),
    leerTodo<Fila>(
      'operaciones',
      'id,fecha,fecha_origen,cuenta_id,activo_id,tipo,cantidad::text,moneda,precio::text,importe::text,comisiones::text,ccl_del_dia::text,carga_id,notas',
      ['fecha', 'id'],
    ),
    leerTodo<Fila>(
      'cotizaciones',
      'fecha,activo_id,precio_pesos::text,precio_usd_subyacente::text,carga_id',
      ['fecha', 'activo_id'],
    ),
    leerTodo<Fila>(
      'tipo_cambio',
      'fecha,ccl::text,mep::text,cripto_venta::text,oficial::text,carga_id',
      ['fecha'],
    ),
    leerTodo<Fila>(
      'saldos_liquidez',
      'fecha,cuenta_id,moneda,monto::text,carga_id',
      ['fecha', 'cuenta_id', 'moneda'],
    ),
    leerTodo<Fila>(
      'movimientos_capital',
      'id,fecha,fecha_acreditacion,tipo,cuenta_origen_id,cuenta_destino_id,moneda_origen,monto_origen::text,moneda_destino,monto_destino::text,tc_aplicado::text,impuesto::text,carga_id,notas',
      ['fecha', 'id'],
    ),
    leerTodo<Fila>(
      'pasivos',
      'id,nombre,tipo,moneda,fecha_inicio,cuotas_totales,opcion_compra_fecha',
      ['id'],
    ),
    leerTodo<Fila>(
      'pasivo_saldos',
      'pasivo_id,fecha,capital_pendiente::text,carga_id',
      ['fecha', 'pasivo_id'],
    ),
    leerTodo<Fila>(
      'bienes',
      'id,nombre,tipo,moneda_valuacion,geografia,pasivo_id,activo_bool',
      ['id'],
    ),
    leerTodo<Fila>(
      'bienes_valuaciones',
      'bien_id,fecha,valor::text,fuente,carga_id',
      ['fecha', 'bien_id'],
    ),
    leerTodo<Fila>('feriados', 'mercado,fecha,descripcion', ['fecha', 'mercado']),
    leerTodo<Fila>(
      'cargas',
      'id,lote,fecha,cuenta_id,origen,archivo_path,estado,creado_en,reemplaza_a,lector,tiempo_activo_ms',
      ['id'],
    ),
  ])

  return {
    cuentas: cuentas.map(
      (r): Cuenta => ({
        id: n(r.id),
        nombre: String(r.nombre),
        tipo: r.tipo as Cuenta['tipo'],
        formato_carga: r.formato_carga as Cuenta['formato_carga'],
        activa: Boolean(r.activa),
      }),
    ),
    activos: activos.map(
      (r): Activo => ({
        id: n(r.id),
        ticker: String(r.ticker),
        nombre: String(r.nombre),
        tipo: r.tipo as Activo['tipo'],
        moneda_riesgo: r.moneda_riesgo as Activo['moneda_riesgo'],
        geografia: r.geografia as Activo['geografia'],
        indexacion: (r.indexacion as Activo['indexacion']) ?? null,
        ticker_subyacente: s(r.ticker_subyacente),
        fecha_vencimiento: s(r.fecha_vencimiento),
        color: s(r.color),
        activo_bool: Boolean(r.activo_bool),
      }),
    ),
    operaciones: operaciones.map(
      (r): Operacion => ({
        id: n(r.id),
        fecha: String(r.fecha),
        fecha_origen: s(r.fecha_origen),
        cuenta_id: n(r.cuenta_id),
        activo_id: n(r.activo_id),
        tipo: r.tipo as Operacion['tipo'],
        cantidad: decReq(s(r.cantidad), 'cantidad'),
        moneda: r.moneda as Operacion['moneda'],
        precio: dec(s(r.precio)),
        importe: dec(s(r.importe)),
        comisiones: decReq(s(r.comisiones), 'comisiones'),
        ccl_del_dia: dec(s(r.ccl_del_dia)),
        carga_id: n(r.carga_id),
        notas: s(r.notas),
      }),
    ),
    cotizaciones: cotizaciones.map(
      (r): Cotizacion => ({
        fecha: String(r.fecha),
        activo_id: n(r.activo_id),
        precio_pesos: decReq(s(r.precio_pesos), 'precio_pesos'),
        precio_usd_subyacente: dec(s(r.precio_usd_subyacente)),
        carga_id: n(r.carga_id),
      }),
    ),
    tipos_cambio: tipos.map(
      (r): TipoCambio => ({
        fecha: String(r.fecha),
        ccl: dec(s(r.ccl)),
        mep: dec(s(r.mep)),
        cripto_venta: dec(s(r.cripto_venta)),
        oficial: dec(s(r.oficial)),
        carga_id: n(r.carga_id),
      }),
    ),
    saldos: saldos.map(
      (r): Saldo => ({
        fecha: String(r.fecha),
        cuenta_id: n(r.cuenta_id),
        moneda: r.moneda as Saldo['moneda'],
        monto: decReq(s(r.monto), 'monto'),
        carga_id: n(r.carga_id),
      }),
    ),
    movimientos: movimientos.map(
      (r): MovimientoCapital => ({
        id: n(r.id),
        fecha: String(r.fecha),
        fecha_acreditacion: s(r.fecha_acreditacion),
        tipo: r.tipo as MovimientoCapital['tipo'],
        cuenta_origen_id: r.cuenta_origen_id === null ? null : n(r.cuenta_origen_id),
        cuenta_destino_id: r.cuenta_destino_id === null ? null : n(r.cuenta_destino_id),
        moneda_origen: (r.moneda_origen as MovimientoCapital['moneda_origen']) ?? null,
        monto_origen: dec(s(r.monto_origen)),
        moneda_destino: (r.moneda_destino as MovimientoCapital['moneda_destino']) ?? null,
        monto_destino: dec(s(r.monto_destino)),
        tc_aplicado: dec(s(r.tc_aplicado)),
        impuesto: decReq(s(r.impuesto), 'impuesto'),
        carga_id: n(r.carga_id),
        notas: s(r.notas),
      }),
    ),
    pasivos: pasivos.map(
      (r): Pasivo => ({
        id: n(r.id),
        nombre: String(r.nombre),
        tipo: r.tipo as Pasivo['tipo'],
        moneda: r.moneda as Pasivo['moneda'],
        fecha_inicio: String(r.fecha_inicio),
        cuotas_totales: n(r.cuotas_totales),
        opcion_compra_fecha: s(r.opcion_compra_fecha),
      }),
    ),
    pasivo_saldos: pasivoSaldos.map(
      (r): PasivoSaldo => ({
        pasivo_id: n(r.pasivo_id),
        fecha: String(r.fecha),
        capital_pendiente: decReq(s(r.capital_pendiente), 'capital_pendiente'),
        carga_id: n(r.carga_id),
      }),
    ),
    bienes: bienes.map(
      (r): Bien => ({
        id: n(r.id),
        nombre: String(r.nombre),
        tipo: r.tipo as Bien['tipo'],
        moneda_valuacion: r.moneda_valuacion as Bien['moneda_valuacion'],
        geografia: r.geografia as Bien['geografia'],
        pasivo_id: r.pasivo_id === null ? null : n(r.pasivo_id),
        activo_bool: Boolean(r.activo_bool),
      }),
    ),
    valuaciones: valuaciones.map(
      (r): BienValuacion => ({
        bien_id: n(r.bien_id),
        fecha: String(r.fecha),
        valor: decReq(s(r.valor), 'valor'),
        fuente: String(r.fuente),
        carga_id: n(r.carga_id),
      }),
    ),
    feriados: feriados.map(
      (r): Feriado => ({
        mercado: r.mercado as Feriado['mercado'],
        fecha: String(r.fecha),
        descripcion: String(r.descripcion),
      }),
    ),
    cargas: cargas
      .map(
        (r): CargaResumen => ({
          id: n(r.id),
          lote: s(r.lote),
          fecha: String(r.fecha),
          cuenta_id: r.cuenta_id === null ? null : n(r.cuenta_id),
          origen: r.origen as CargaResumen['origen'],
          archivo_path: s(r.archivo_path),
          estado: r.estado as CargaResumen['estado'],
          creado_en: String(r.creado_en),
          reemplaza_a: r.reemplaza_a === null ? null : n(r.reemplaza_a),
          lector: s(r.lector),
          tiempo_activo_ms: r.tiempo_activo_ms === null ? null : n(r.tiempo_activo_ms),
        }),
      )
      .filter((c) => c.estado !== 'revertida'),
  }
}
