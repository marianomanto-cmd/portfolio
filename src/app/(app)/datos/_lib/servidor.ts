import 'server-only'

// Lecturas de Datos. Los montos vienen como texto (::text, D-32). Sin base o en
// modo demo, devuelve el ejemplo inventado con un aviso: la pantalla nunca se
// cae por falta de configuración.

import type { Activo, Cuenta, Fecha, Geografia, Moneda } from '@/lib/domain/tipos'
import { modoDemo } from '@/lib/server/sesion'
import { FaltaConfiguracion, leerTodo, supabase } from '@/lib/server/supabase'
import type { CCL, Ratio, SaldoPasivo, Valuacion } from './calculos'
import { ejemploDatos } from './ejemplo'

export type ModoDatos = 'real' | 'demo' | 'sin_base' | 'error'

export interface BienFila {
  id: number
  nombre: string
  tipo: 'inmueble' | 'vehiculo' | 'otro'
  moneda_valuacion: Moneda
  geografia: Geografia
  pasivo_id: number | null
  activo_bool: boolean
}

export interface PasivoFila {
  id: number
  nombre: string
  tipo: 'leasing' | 'tarjeta' | 'prestamo'
  moneda: Moneda
  fecha_inicio: Fecha
  cuotas_totales: number
  monto_financiado_neto: string | null
  anticipo_neto: string | null
  opcion_compra_neto: string | null
  opcion_compra_fecha: Fecha | null
  valor_bien: string | null
  notas: string | null
}

/** Un aporte, retiro o transferencia (D-06), con sus montos como texto (D-32). */
export interface MovimientoFila {
  id: number
  fecha: Fecha
  fecha_acreditacion: Fecha | null
  tipo: 'aporte' | 'retiro' | 'transferencia'
  cuenta_origen_id: number | null
  cuenta_destino_id: number | null
  moneda_origen: Moneda | null
  monto_origen: string | null
  moneda_destino: Moneda | null
  monto_destino: string | null
  tc_aplicado: string | null
  impuesto: string
  carga_id: number | null
  notas: string | null
}

export interface DatosPantalla {
  modo: ModoDatos
  aviso: string | null
  activos: Activo[]
  ratios: Ratio[]
  cuentas: Cuenta[]
  bienes: BienFila[]
  valuaciones: Valuacion[]
  pasivos: PasivoFila[]
  saldosPasivo: SaldoPasivo[]
  ccl: CCL | null
  /** Movimientos de capital, del más nuevo al más viejo. */
  movimientos: MovimientoFila[]
  /** CCL de cada día cargado (para pasar un movimiento a la otra moneda al CCL de su fecha). */
  ccls: CCL[]
}

type Fila = Record<string, string | number | boolean | null>
const s = (v: Fila[string]) => (v === null || v === undefined ? null : String(v))
const n = (v: Fila[string]) => Number(v)

async function ultimoCcl(): Promise<CCL | null> {
  const { data, error } = await supabase()
    .from('tipo_cambio')
    .select('fecha, ccl::text')
    .not('ccl', 'is', null)
    .order('fecha', { ascending: false })
    .limit(1)
  if (error) throw new Error(`Leyendo tipo_cambio: ${error.message}`)
  const fila = (data?.[0] ?? null) as unknown as { fecha: string; ccl: string | null } | null
  return fila && fila.ccl ? { fecha: fila.fecha, valor: fila.ccl } : null
}

/** Todo lo que muestran las subpantallas de Datos. */
export async function leerDatos(): Promise<DatosPantalla> {
  if (modoDemo()) return { ...ejemploDatos(), modo: 'demo', aviso: 'Modo demo: datos de ejemplo inventados; los cambios no se guardan.' }
  try {
    const [activos, ratios, cuentas, bienes, valuaciones, pasivos, saldos, ccl, movimientos, ccls] = await Promise.all([
      leerTodo<Fila>('activos', 'id,ticker,nombre,tipo,moneda_riesgo,geografia,indexacion,ticker_subyacente,fecha_vencimiento,color,activo_bool', ['ticker']),
      leerTodo<Fila>('ratios_cedear', 'activo_id,vigente_desde,ratio::text', ['activo_id', 'vigente_desde']),
      leerTodo<Fila>('cuentas', 'id,nombre,tipo,formato_carga,activa', ['id']),
      leerTodo<Fila>('bienes', 'id,nombre,tipo,moneda_valuacion,geografia,pasivo_id,activo_bool', ['id']),
      leerTodo<Fila>('bienes_valuaciones', 'bien_id,fecha,valor::text,fuente,carga_id', ['bien_id', 'fecha']),
      leerTodo<Fila>(
        'pasivos',
        'id,nombre,tipo,moneda,fecha_inicio,cuotas_totales,monto_financiado_neto::text,anticipo_neto::text,opcion_compra_neto::text,opcion_compra_fecha,valor_bien::text,notas',
        ['id'],
      ),
      leerTodo<Fila>('pasivo_saldos', 'pasivo_id,fecha,capital_pendiente::text,carga_id', ['pasivo_id', 'fecha']),
      ultimoCcl(),
      leerTodo<Fila>(
        'movimientos_capital',
        'id,fecha,fecha_acreditacion,tipo,cuenta_origen_id,cuenta_destino_id,moneda_origen,monto_origen::text,moneda_destino,monto_destino::text,tc_aplicado::text,impuesto::text,carga_id,notas',
        ['fecha', 'id'],
      ),
      leerTodo<Fila>('tipo_cambio', 'fecha,ccl::text', ['fecha'], (q) => q.not('ccl', 'is', null)),
    ])
    return {
      modo: 'real',
      aviso: null,
      activos: activos.map((r) => ({
        id: n(r.id),
        ticker: String(r.ticker),
        nombre: String(r.nombre),
        tipo: r.tipo as Activo['tipo'],
        moneda_riesgo: r.moneda_riesgo as Moneda,
        geografia: r.geografia as Geografia,
        indexacion: (r.indexacion as Activo['indexacion']) ?? null,
        ticker_subyacente: s(r.ticker_subyacente),
        fecha_vencimiento: s(r.fecha_vencimiento),
        color: s(r.color),
        activo_bool: Boolean(r.activo_bool),
      })),
      ratios: ratios.map((r) => ({ activo_id: n(r.activo_id), vigente_desde: String(r.vigente_desde), ratio: String(r.ratio) })),
      cuentas: cuentas.map((r) => ({
        id: n(r.id),
        nombre: String(r.nombre),
        tipo: r.tipo as Cuenta['tipo'],
        formato_carga: r.formato_carga as Cuenta['formato_carga'],
        activa: Boolean(r.activa),
      })),
      bienes: bienes.map((r) => ({
        id: n(r.id),
        nombre: String(r.nombre),
        tipo: r.tipo as BienFila['tipo'],
        moneda_valuacion: r.moneda_valuacion as Moneda,
        geografia: r.geografia as Geografia,
        pasivo_id: r.pasivo_id === null ? null : n(r.pasivo_id),
        activo_bool: Boolean(r.activo_bool),
      })),
      valuaciones: valuaciones.map((r) => ({ bien_id: n(r.bien_id), fecha: String(r.fecha), valor: String(r.valor), fuente: String(r.fuente), carga_id: n(r.carga_id) })),
      pasivos: pasivos.map((r) => ({
        id: n(r.id),
        nombre: String(r.nombre),
        tipo: r.tipo as PasivoFila['tipo'],
        moneda: r.moneda as Moneda,
        fecha_inicio: String(r.fecha_inicio),
        cuotas_totales: n(r.cuotas_totales),
        monto_financiado_neto: s(r.monto_financiado_neto),
        anticipo_neto: s(r.anticipo_neto),
        opcion_compra_neto: s(r.opcion_compra_neto),
        opcion_compra_fecha: s(r.opcion_compra_fecha),
        valor_bien: s(r.valor_bien),
        notas: s(r.notas),
      })),
      saldosPasivo: saldos.map((r) => ({ pasivo_id: n(r.pasivo_id), fecha: String(r.fecha), capital_pendiente: String(r.capital_pendiente), carga_id: n(r.carga_id) })),
      ccl,
      movimientos: movimientos
        .map((r) => ({
          id: n(r.id),
          fecha: String(r.fecha),
          fecha_acreditacion: s(r.fecha_acreditacion),
          tipo: r.tipo as MovimientoFila['tipo'],
          cuenta_origen_id: r.cuenta_origen_id === null ? null : n(r.cuenta_origen_id),
          cuenta_destino_id: r.cuenta_destino_id === null ? null : n(r.cuenta_destino_id),
          moneda_origen: (r.moneda_origen as Moneda | null) ?? null,
          monto_origen: s(r.monto_origen),
          moneda_destino: (r.moneda_destino as Moneda | null) ?? null,
          monto_destino: s(r.monto_destino),
          tc_aplicado: s(r.tc_aplicado),
          impuesto: s(r.impuesto) ?? '0',
          carga_id: r.carga_id === null ? null : n(r.carga_id),
          notas: s(r.notas),
        }))
        .reverse(),
      ccls: ccls.filter((r) => r.ccl !== null).map((r) => ({ fecha: String(r.fecha), valor: String(r.ccl) })),
    }
  } catch (e) {
    if (e instanceof FaltaConfiguracion) {
      return {
        ...ejemploDatos(),
        modo: 'sin_base',
        aviso: 'Falta configurar la base (SUPABASE_SECRET_KEY): te muestro un ejemplo inventado y los cambios no se guardan.',
      }
    }
    return {
      modo: 'error',
      aviso: `No pude leer la base: ${e instanceof Error ? e.message : String(e)}. Probá recargar.`,
      activos: [],
      ratios: [],
      cuentas: [],
      bienes: [],
      valuaciones: [],
      pasivos: [],
      saldosPasivo: [],
      ccl: null,
      movimientos: [],
      ccls: [],
    }
  }
}
