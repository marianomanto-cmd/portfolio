// Lo que recibe la pantalla Pasivos (y Datos › Leasing). Serializable: los
// montos van como texto dentro de CalcVista, con su traza (como contratos.ts).

import type { CalcVista, Etiqueta } from '@/lib/domain/calc'
import type { FuenteCuota } from '@/lib/domain/pasivos/tipos'
import type { Fecha, Moneda } from '@/lib/domain/tipos'
import type { Par, ParteFrase } from './contratos'

export type { Par, ParteFrase }

/** Una cuota del cuadro de marcha, para la tabla y las tarjetas. */
export interface FilaCuota {
  nro: number
  fecha_vencimiento: Fecha
  periodo: Fecha | null
  estado: 'facturada' | 'proyectada'
  pagada: boolean
  fecha_pago: Fecha | null
  /** "pagada el 01/09", "pagada · fecha sin dato", "pendiente", "vencida, sin pagar". */
  estado_texto: string
  canon: CalcVista
  seguro: CalcVista
  subtotal: CalcVista
  iva: CalcVista
  percepcion: CalcVista
  total: CalcVista
  ccl_pago: CalcVista
  /** Al CCL del pago (pagadas) o al CCL de hoy (pendientes, rotulado). */
  total_usd: CalcVista
  usd_rotulo: 'al CCL del pago' | 'al CCL de hoy'
  fuentes: { canon: FuenteCuota; seguro: FuenteCuota; percepcion: FuenteCuota }
  /** La fuente en una palabra: comprobante, contrato, supuesto o a confirmar (la más incierta). */
  fuente_texto: string
  apertura: { amortizacion: Par; interes: Par; iva: Par; seguro: Par; percepcion: Par; cargos: Par; gasto: Par; total: Par }
  pagador: 'titular' | 'empresa' | null
  etiquetas: Etiqueta[]
  /** Si la cuota trajo cargos extra (si no, su renglón de cargos no se muestra: es un cero real, no un dato). */
  hay_cargos: boolean
}

export interface TotalesApertura {
  amortizacion: Par
  interes: Par
  iva: Par
  seguro: Par
  percepcion: Par
  cargos: Par
  gasto: Par
  total: Par
}

export interface DeudaConOrigen {
  par: Par
  fecha: Fecha
  fuente: string | null
}

export interface CargoVista {
  id: number
  fecha: Fecha
  concepto: string
  detalle: string | null
  importe: Par
  cuota_nro: number | null
  fuente: string
}

export interface VistaLeasing {
  contrato: {
    id: number
    nombre: string
    tipo: 'leasing' | 'tarjeta' | 'prestamo'
    moneda: Moneda
    fecha_inicio: Fecha
    fecha_desembolso: Fecha | null
    cuotas_totales: number
    monto_financiado_neto: string | null
    anticipo_neto: string | null
    valor_bien: string | null
    opcion_compra_neto: string | null
    opcion_compra_fecha: Fecha | null
    pagador_habitual: 'titular' | 'empresa' | null
    reintegra_iva: boolean | null
    /** Lo que falta del contrato para la tasa ("el monto financiado neto"…); vacío si está completo. */
    faltan_para_tasa: string[]
  }
  bien: { nombre: string; valuacion: Par | null; fecha: Fecha | null; fuente: string | null } | null
  /** La frase de arriba, en partes con su traza. */
  frase: ParteFrase[]
  /** Cada cifra de la frase en pesos y en dólares, con su traza: el detalle que se abre con el dedo. */
  frase_detalle: { etiqueta: string; ars: CalcVista; usd: CalcVista }[]
  /** La fecha de la vista (la línea "hoy" del gráfico). */
  hoy: Fecha
  tarjetas: {
    /** Las cuotas que ya vencieron y la planilla no marca pagadas (puede que no esté al día): se dicen, no se saltean. */
    vencidas: { nro: number; fecha: Fecha }[]
    pagadas: number
    cargadas: number
    total: number
    /** El ancho de la barra de progreso: pagadas ÷ total, en % entero (solo para dibujar). */
    progreso: number
    proxima: { nro: number; fecha: Fecha; total: Par; etiquetas: Etiqueta[] } | null
    falta: { cuotas: number; total: Par; canon: Par; resto: Par }
    costo: { total: Par; vs_valor: CalcVista; vs_valuacion: CalcVista | null }
  }
  cuotas: FilaCuota[]
  totales: {
    pagado: Par
    falta: Par
    /** Lo que falta, por de dónde sale cada monto; en dólares al CCL de hoy. */
    falta_por_fuente: { comprobante: Par; contrato: Par; supuesto: Par; a_confirmar: Par }
    iva_percepcion_pagado: Par
    iva_percepcion_por_pagar: Par
    cargos: Par
    /** Si hay algún cargo extra que cuenta. */
    hay_cargos: boolean
    apertura_pagadas: TotalesApertura
    apertura_pendientes: TotalesApertura
  }
  opcion: { neto: Par; iva: Par; total: Par; fecha: Fecha | null; alicuota: CalcVista }
  tea: CalcVista
  tem: CalcVista
  /** La deuda, en tres valores con su origen, y lo que falta pagar al lado (nunca se resta). */
  deuda: {
    /** La fecha de la deuda: la de tu última carga, la misma del Balance, Hoy y Flujo. */
    al: Fecha
    informada: DeudaConOrigen | null
    segun_cuadro: Par
    estimada: DeudaConOrigen | null
    falta_pagar: Par
    /** La que cuenta, en el orden de D-131 (informada › según cuadro › estimada); null si no hay ninguna. */
    vigente: 'informada' | 'segun_cuadro' | 'estimada' | null
    /** Una deuda cargada con fecha posterior a tu última carga: se muestra, y cuenta desde la próxima carga. */
    posterior: (DeudaConOrigen & { naturaleza: 'informado' | 'estimado' }) | null
  }
  recupero: { iva: Par; ganancias: Par }
  licuacion_pagadas: Par
  /** Licuación de la deuda (visión 4.11): cuántos dólares bajó solo por la suba del CCL, tramo a tramo entre cargas. */
  licuacion_deuda: Par
  /** La tercera lente de lo que falta: en pesos de hoy (sin IPC cargado, sin dato). */
  falta_pesos_hoy: CalcVista
  cargos: CargoVista[]
  /** Pesos contra dólares (spec §5): índice 100 en la primera cuota con CCL del pago. */
  indexado: { nro: number; fecha: Fecha; ars: string; usd: string }[]
  /** Por qué todavía no hay gráfico indexado (menos de dos cuotas con CCL del pago). */
  indexado_motivo: string | null
}

export interface VistaPasivos {
  hoy: Fecha
  ccl: CalcVista
  /** De qué día es ese CCL (el último cargado hasta hoy): no siempre es de hoy. */
  ccl_fecha: Fecha | null
  leasings: VistaLeasing[]
  /** Mensaje para el estado vacío o el modo demo. */
  aviso: string | null
}
