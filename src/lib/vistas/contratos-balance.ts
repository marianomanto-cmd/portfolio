// Lo que recibe la pantalla Balance (/patrimonio): el estado de situación
// patrimonial a una fecha de carga. Serializable (sin Decimal): toda cifra es
// un Par (pesos y dólares), cada uno con su traza completa (CalcVista).

import type { CalcVista } from '@/lib/domain/calc'
import type { Agrupar, Liquidez, OrigenDeuda } from '@/lib/domain/balance'
import type { Fecha } from '@/lib/domain/tipos'
import type { Par, ParteFrase, Segmento } from './contratos'

export type { Agrupar, Liquidez, OrigenDeuda }

export interface Accion {
  etiqueta: string
  href: string
}

/** Una partida del activo: una posición, un saldo o un bien. */
export interface FilaBalance {
  clave: string
  nombre: string
  /** Una línea: "CEDEAR · 1.240 × $ 35.150", "saldo del mié 14/10", "US$ 180.000 · tasación del jue 08/10". */
  detalle: string
  cuenta: string | null
  /** Tipo de partida (cedear, liquidez, inmueble…): da la clase y el color. */
  clase: string
  color: string
  liquidez: Liquidez
  regla_liquidez: string
  valor: Par
  /** Parte del activo total (fracción), con su traza. */
  peso: CalcVista
  /** El mismo peso en %, con un decimal, redondeado junto con todo el activo (resto mayor): "10,6". */
  pct: string | null
  viejo: boolean
  /** Chips de la fila, ya en palabras ("viejo · hace 4 d háb.", "financiada por el leasing"). */
  chips: string[]
  /** Lo que resuelve un "sin dato" de la fila. */
  accion: Accion | null
}

export interface GrupoVista {
  clave: string
  nombre: string
  filas: FilaBalance[]
  total: Par
  peso: CalcVista
  /** Suma de los porcentajes redondeados de sus filas. */
  pct: string | null
}

/** Lo que falta pagar según el contrato (nominal: cánones con IVA, seguro y percepción). Referencia: nunca se resta. */
export interface ReferenciaContrato {
  valor: Par
  /** Cuotas que faltan, si se sabe. */
  cuotas: number | null
  /** "21 cuotas; la opción de compra, aparte". */
  nota: string
}

/** Una deuda del pasivo, con su origen escrito (D-134). */
export interface FilaPasivo {
  clave: string
  nombre: string
  /** El bien que financia ("Camioneta"), si financia uno. */
  bien: string | null
  origen: OrigenDeuda | null
  /** "estimada por vos el mié 08/10 · provisoria", "valor de cancelación informado el mar 13/10". */
  detalle: string
  /** Quién la informó o cómo se estimó, si se sabe. */
  fuente: string | null
  valor: Par
  peso: CalcVista
  pct: string | null
  chips: string[]
  accion: Accion | null
  /** Lo que falta pagar según el contrato: la llena la integración con Pasivos; null = todavía no hay cuadro de marcha. */
  referencia: ReferenciaContrato | null
}

/** Un renglón del patrimonio neto. */
export interface LineaNeto {
  clave: string
  nombre: string
  detalle: string
  valor: Par
  /** Parte del activo total. */
  peso: CalcVista
  pct: string | null
  /** Destacado (el patrimonio neto) o secundario. */
  principal: boolean
}

/** Un tramo de una barra de composición: el segmento, su porcentaje redondeado (resto mayor) y su ancho. */
export interface SegmentoBalance extends Segmento {
  /** "25,5": el peso en %, con un decimal, redondeado para que la barra sume 100,0. null = sin dato. */
  pct: string | null
  /** Ancho CSS del tramo ("25.5474%"); null si no se dibuja. */
  ancho: string | null
  regla: string | null
}

export type EjeComposicion = 'moneda' | 'clase' | 'liquidez'
export type PerimetroComposicion = 'financiero' | 'total'

export interface PuntoBalance {
  fecha: Fecha
  por_clase: Record<string, { ars: string | null; usd: string | null }>
  /** Saldos, títulos y bienes: la tabla del gráfico (entra en el ancho de una tarjeta). */
  por_rubro: Record<'liquidez' | 'titulos' | 'bienes', { ars: string | null; usd: string | null }>
  /** Lo firme (sin los bienes financiados). */
  neto: { ars: string | null; usd: string | null }
  /** Con cada bien financiado neto de su deuda. */
  completo: { ars: string | null; usd: string | null }
  completo_estimado: boolean
}

/** Un indicador del balance (D-133): un cociente sin unidad monetaria, igual en pesos y en dólares. */
export interface IndicadorVista {
  clave: 'solvencia' | 'endeudamiento' | 'inmovilizacion'
  nombre: string
  unidad: 'veces' | 'fraccion'
  valor: CalcVista
  /** Ya redondeado para la vista ("21,1 veces", "4,7%"); null = sin dato. */
  texto: string | null
  /** Qué mide, sin juicio. */
  lectura: string
  chips: string[]
}

/** Un renglón del comparativo: el mismo renglón a dos fechas de carga y lo que cambió. */
export interface LineaComparativa {
  clave: 'financiero' | 'bienes' | 'activo' | 'pasivo' | 'completo' | 'sin_financiados'
  nombre: string
  actual: Par
  anterior: Par
  /** actual − anterior: no es una ganancia (incluye lo que pusiste o sacaste). */
  diferencia: Par
  /** La diferencia es exactamente cero: se dice "sin cambios" (un cero de verdad, no un "sin dato"). */
  sin_cambios: { ars: boolean; usd: boolean }
  principal: boolean
  /**
   * El chip del renglón, en palabras: la etiqueta más grave de las dos fechas
   * (un estimado en la anterior hace estimada la diferencia). El "parcial" de
   * la anterior no cuenta: su celda ya dice "sin dato".
   */
  chip: string | null
}

/** El balance comparado con otra fecha de carga anterior (D-133). */
export interface ComparativoVista {
  /** La fecha contra la que se compara. */
  fecha: Fecha
  /** La que se usa si no elegís otra: tu primera carga. */
  por_defecto: Fecha
  /** Las fechas de carga anteriores a la del balance, para elegir. */
  opciones: Fecha[]
  lineas: LineaComparativa[]
}

export type EstadoBalance = 'sin_cargas' | 'con_datos'

/** Una parte de la frase de arriba; las cifras traen su título (el de su traza y el de su fila en la hoja del teléfono). */
export interface ParteFraseBalance extends ParteFrase {
  titulo?: string
}

export interface VistaBalance {
  estado: EstadoBalance
  hoy: Fecha
  /** La fecha del balance (una fecha de carga). */
  fecha: Fecha | null
  /** Todas las fechas de carga, para elegir. */
  fechas: Fecha[]
  ultima: boolean
  ccl: CalcVista
  fecha_ccl: Fecha | null
  /** De dónde sale el CCL ("tipeado el mié 14/10 (carga #33)"): va en la impresión. */
  ccl_fuente: string
  agrupar: Agrupar
  /** "sin la camioneta", "sin la casa, que no tiene valuación": el perímetro de lo firme, en palabras. */
  sin_texto: string | null
  /** La cifra grande. */
  titular: {
    rotulo: string
    valor: Par
    /** La cifra deja afuera algo que no tiene dato (la camioneta sin su deuda): chip "parcial". */
    parcial: boolean
    /** La cifra usa una deuda que no informó el acreedor: chip "estimado". */
    estimado: boolean
    /** Los chips de la cifra, en palabras y sin repetir: "estimado", "parcial", "viejo"… */
    chips: string[]
    nota: string | null
    /** Debajo, firme: "sin la camioneta: financiero + casa", con sus chips (nunca "estimado"). */
    firme: { rotulo: string; valor: Par; chips: string[] } | null
    accion: Accion | null
  }
  /** "Tenés $ 375 M (US$ 250.000) sin contar la camioneta. La casa es el 72% de eso; lo invertible, el 28%." */
  frase: ParteFraseBalance[]
  activo: {
    financiero: Par
    financiero_peso: CalcVista
    financiero_pct: string | null
    grupos: GrupoVista[]
    bienes: FilaBalance[]
    bienes_total: Par
    bienes_peso: CalcVista
    bienes_pct: string | null
    total: Par
    total_peso: CalcVista
    /** "100.0" si todos los porcentajes existen. */
    total_pct: string | null
    /** Chips del activo total ("viejo" si alguna partida tiene el dato atrasado). */
    total_chips: string[]
    /** Financiero, cada bien: la barra de la tarjeta del activo. */
    tramos: SegmentoBalance[]
  }
  pasivo: {
    filas: FilaPasivo[]
    total: Par
    peso: CalcVista
    pct: string | null
  }
  neto: {
    completo: Par
    sin_financiados: Par
    origen_deuda: OrigenDeuda | null
    excluidos: { nombre: string; motivo: string }[]
    lineas: LineaNeto[]
  }
  /** Solvencia, endeudamiento e inmovilización, con su fórmula; vacío si no aplican. */
  indicadores: IndicadorVista[]
  /** El balance comparado con una fecha anterior; null con una sola fecha de carga hasta la del balance. */
  comparativo: ComparativoVista | null
  composicion: Record<PerimetroComposicion, Record<EjeComposicion, SegmentoBalance[]>>
  serie: PuntoBalance[]
}
