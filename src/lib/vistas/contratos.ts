// Lo que recibe cada pantalla. Son modelos serializables (sin Decimal): los
// montos van como texto decimal dentro de CalcVista, con su traza completa.
// Se arman en el servidor (src/lib/vistas/*.ts) a partir de los Hechos y del
// motor de cálculo; las pantallas solo los muestran.

import type { CalcVista } from '@/lib/domain/calc'
import type { Fecha, Geografia, Moneda, TipoActivo } from '@/lib/domain/tipos'

/** Toda cifra existe en las dos monedas. */
export interface Par {
  ars: CalcVista
  usd: CalcVista
}

export type EstadoFuente = 'ok' | 'diferencia' | 'tipeado' | 'viejo' | 'sin_carga'

export interface Fuente {
  nombre: 'IEB' | 'Galicia' | 'Mercado Pago' | 'CCL' | 'Cripto'
  estado: EstadoFuente
  fecha: Fecha | null
  carga_id: number | null
  detalle: string | null
}

export interface Pendiente {
  /** Estable entre días, para poder darlo por visto. */
  id: string
  gravedad: 'alta' | 'media' | 'baja'
  titulo: string
  detalle: string
  accion: { etiqueta: string; href: string } | null
}

/** Una parte de la frase del día, con su traza. */
export interface ParteFrase {
  texto: string
  calc: CalcVista | null
}

export interface FraseDelDia {
  desde: Fecha
  hasta: Fecha
  /** Días hábiles entre cargas (para "volviste después de un hueco"). */
  dias_habiles: number
  /** La frase en partes: el texto plano se lee de corrido y cada calc es tocable. */
  partes: ParteFrase[]
  variacion: Par
  activos: Par
  tc: Par
  /** Lo que no se puede atribuir porque no hubo precio o saldo nuevo. */
  sin_atribuir: Par | null
}

export interface TarjetaPatrimonio {
  titulo: string
  valor: Par
  variacion: Par | null
  variacion_pct: { ars: CalcVista; usd: CalcVista } | null
  desglose: { activos: Par; tc: Par } | null
  notas: string[]
}

export interface ExposicionResumen {
  pesos_financieros: CalcVista
  deuda_pesos: CalcVista
  neto_ars: CalcVista
  neto_usd: CalcVista
  /** Cuánto cambia el neto en USD si el CCL sube 1%. */
  sensibilidad_usd_1pct: CalcVista
}

export interface VistaHoy {
  hoy: Fecha
  hay_datos: boolean
  fecha_datos: Fecha | null
  ccl: CalcVista
  frase: FraseDelDia | null
  financiero: TarjetaPatrimonio
  total: TarjetaPatrimonio
  exposicion: ExposicionResumen
  atencion: Pendiente[]
  fuentes: Fuente[]
  cargo_hoy: boolean
  es_habil_hoy: boolean
  /** En diciembre: recordatorio de la foto al 31/12 (D-76 de la visión). */
  aviso_fin_de_anio: string | null
  /** Quién movió la variación del día, ordenado por aporte absoluto. */
  movimientos: MovimientoActivo[]
  cuadre: { ars_ok: boolean | null; usd_ok: boolean | null; detalle: string }
}

export interface MovimientoActivo {
  clave: string
  nombre: string
  aporte: Par
  sin_precio_nuevo: boolean
}

export interface FilaCartera {
  clave: string // `${cuenta_id}:${activo_id}` o `saldo:${cuenta_id}:${moneda}`
  ticker: string
  nombre: string
  cuenta: string
  tipo: TipoActivo | 'liquidez'
  moneda_riesgo: Moneda
  geografia: Geografia
  color: string
  cantidad: CalcVista
  precio: CalcVista
  fecha_precio: Fecha | null
  precio_viejo: boolean
  ppc: Par
  valor: Par
  resultado: Par
  resultado_pct: Par
  /** Desglose del resultado en la moneda en que NO arriesga: activo y TC. */
  desglose: { moneda: Moneda; activo: CalcVista; tc: CalcVista } | null
  peso: CalcVista
  dias_en_posicion: number | null
  /** Badge único cuando los signos de ARS y USD difieren. */
  ganas_pesos_perdes_dolares: boolean
  pendiente: string | null
}

export interface VistaCartera {
  fecha_datos: Fecha | null
  ccl: CalcVista
  filas: FilaCartera[]
  totales: {
    valor: Par
    resultado: Par
    costo: Par
  }
}

export interface Segmento {
  clave: string
  nombre: string
  color: string
  valor: Par
  peso: CalcVista
}

export interface PuntoExposicion {
  fecha: Fecha
  activos_ars: string | null
  activos_usd: string | null
  deuda_ars: string | null
  neto_ars: string | null
  neto_pct: string | null
}

export interface VistaExposicion {
  fecha_datos: Fecha | null
  vista: 'financiero' | 'total'
  resumen: ExposicionResumen
  activos_en_pesos: CalcVista
  activos_en_dolares: Par
  pasivos_en_pesos: CalcVista
  neto_pct: CalcVista
  por_clase: Segmento[]
  por_moneda: Segmento[]
  por_geografia: Segmento[]
  concentracion: { top1: CalcVista; top1_nombre: string | null; top3: CalcVista }
  serie: PuntoExposicion[]
}

export interface FilaRegistro {
  carga_id: number
  lote: string | null
  fecha: Fecha
  creado_en: string
  cuenta: string
  origen: 'excel' | 'captura' | 'manual'
  estado: 'vigente' | 'reemplazada' | 'revertida'
  archivo_path: string | null
  lector: string | null
  cotizaciones: number
  saldos: number
  operaciones: number
  tiempo_activo_ms: number | null
}

export interface VistaRegistro {
  filas: FilaRegistro[]
}
