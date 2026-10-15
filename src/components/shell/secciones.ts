import {
  BriefcaseBusiness,
  CalendarRange,
  ChartLine,
  Database,
  History,
  House,
  Map as MapaIcono,
  ReceiptText,
  Scale,
  Settings,
  Upload,
  type LucideIcon,
} from 'lucide-react'

// La navegación (D-156, rediseño del 15/10): el menú se ordena por la pregunta
// que contesta cada pantalla, no por el tipo de dato. D-69 sigue: lo no
// desplegado no aparece, ni como "próximamente".
//
// - Cargar no es una sección: es la acción fija de la barra superior (atajo C)
//   y el botón del centro en el teléfono (CARGAR, abajo).
// - Balance (/patrimonio) vive dentro de Exposición: /patrimonio redirige a
//   /exposicion (next.config.mjs).
// - Cartera se llama Posiciones en la pantalla; la ruta sigue siendo /cartera.

export type Grupo = 'Diario' | 'Patrimonio' | 'Resultados' | 'Compromisos y futuro' | 'Al pie'

export interface Seccion {
  href: string
  nombre: string
  /** El nombre en la barra inferior del teléfono, si el completo no entra (11 px, un quinto de 360 px). */
  corto?: string
  /** La segunda línea de la barra superior y la línea de la hoja "Más". */
  descripcion: string
  /** La pregunta que contesta (el eyebrow de su encabezado y el Mapa de la app). */
  pregunta?: string
  /** Qué hay adentro, para el Mapa de la app. */
  resumen?: string
  icono: LucideIcon
  grupo: Grupo
}

export const GRUPOS: readonly Grupo[] = ['Diario', 'Patrimonio', 'Resultados', 'Compromisos y futuro', 'Al pie']

export const SECCIONES: Seccion[] = [
  {
    href: '/',
    nombre: 'Hoy',
    descripcion: 'Cuánto tenés y qué pasó',
    pregunta: '¿Cómo estoy hoy?',
    resumen: 'La lectura del día, tu patrimonio en las dos monedas, de dónde vino la variación, lo que vence y el excedente del mes.',
    icono: House,
    grupo: 'Diario',
  },
  {
    href: '/cartera',
    nombre: 'Posiciones',
    descripcion: 'Cada posición en pesos y en dólares',
    pregunta: '¿Cómo le va a cada cosa?',
    resumen: 'La tabla densa, ordenable, con los totales fijos abajo y el desglose entre activo y tipo de cambio.',
    icono: BriefcaseBusiness,
    grupo: 'Patrimonio',
  },
  {
    href: '/exposicion',
    nombre: 'Exposición',
    descripcion: 'Qué tenés, qué debés y cuánto estás jugado al peso',
    pregunta: '¿Cuánto estoy jugado al peso?',
    resumen: 'Activos, pasivos y neto en un solo eje, con el balance: lo que tenés, lo que debés y tu patrimonio neto.',
    icono: Scale,
    grupo: 'Patrimonio',
  },
  {
    href: '/evolucion',
    nombre: 'Evolución y PnL',
    corto: 'Resultados',
    descripcion: 'Cuánto ganaste o perdiste, en qué y por qué',
    pregunta: '¿Gané o perdí, y por qué?',
    resumen: 'Tu patrimonio en el tiempo y el resultado separado en lo que puso cada activo y lo que puso el tipo de cambio.',
    icono: ChartLine,
    grupo: 'Resultados',
  },
  {
    href: '/pasivos',
    nombre: 'Pasivos',
    descripcion: 'El leasing: cuotas pagadas, lo que falta y la deuda',
    pregunta: '¿Cuánto me falta pagar?',
    resumen: 'El leasing cuota por cuota, en pesos y en dólares: lo pagado, lo que falta y la deuda.',
    icono: ReceiptText,
    grupo: 'Compromisos y futuro',
  },
  {
    href: '/flujo',
    nombre: 'Flujo y escenarios',
    descripcion: 'Cuánto te sobra por mes y adónde te lleva',
    pregunta: '¿Adónde me lleva?',
    resumen: 'Del ingreso al excedente de cada mes, y tus escenarios proyectados mes a mes.',
    icono: CalendarRange,
    grupo: 'Compromisos y futuro',
  },
  { href: '/registro', nombre: 'Registro', descripcion: 'Qué entró, de qué archivo, cuánto tardó; revertir', icono: History, grupo: 'Al pie' },
  { href: '/datos', nombre: 'Datos', descripcion: 'Catálogo, cuentas, bienes y leasing', icono: Database, grupo: 'Al pie' },
  { href: '/ajustes', nombre: 'Ajustes', descripcion: 'Tema, paleta, modo privado y sesión', icono: Settings, grupo: 'Al pie' },
  {
    href: '/mapa',
    nombre: 'Mapa de la app',
    corto: 'Mapa',
    descripcion: 'Dónde está cada cosa y cómo se lee cada pantalla',
    pregunta: '¿Dónde está cada cosa?',
    icono: MapaIcono,
    grupo: 'Al pie',
  },
]

/** Cargar: la acción fija (barra superior y centro de la barra inferior), no un ítem del menú. */
export const CARGAR: Seccion = { href: '/carga', nombre: 'Cargar', descripcion: 'Los 60 segundos del día', icono: Upload, grupo: 'Diario' }

/** Lo que tiene título en la barra superior: las secciones del menú y Cargar. */
const CON_TITULO: Seccion[] = [...SECCIONES, CARGAR]

export function seccionActiva(pathname: string): Seccion | null {
  if (pathname === '/') return SECCIONES[0]
  return CON_TITULO.find((s) => s.href !== '/' && (pathname === s.href || pathname.startsWith(`${s.href}/`))) ?? null
}

/** Las pestañas de Patrimonio en el teléfono: Posiciones y Exposición (D-156). */
export const PESTANAS_PATRIMONIO = SECCIONES.filter((s) => s.grupo === 'Patrimonio')

/**
 * La barra inferior del teléfono (D-156, reemplaza a D-151): Hoy · Patrimonio
 * · Cargar · Resultados · Más. Patrimonio abre Posiciones (con la pestaña de
 * Exposición); Más abre la hoja con el resto.
 */
export const BARRA_INFERIOR = {
  hoy: '/',
  patrimonio: '/cartera',
  resultados: '/evolucion',
} as const

/** Lo que va en la hoja "Más" del teléfono: todo lo que no está en la barra inferior. */
export function seccionesDeMas(): Seccion[] {
  const fuera = new Set<string>([BARRA_INFERIOR.hoy, ...PESTANAS_PATRIMONIO.map((s) => s.href), BARRA_INFERIOR.resultados])
  return SECCIONES.filter((s) => !fuera.has(s.href))
}

/** ¿Qué ítem de la barra inferior queda marcado en esta ruta? */
export function itemInferiorActivo(pathname: string): 'hoy' | 'patrimonio' | 'cargar' | 'resultados' | 'mas' | null {
  const s = seccionActiva(pathname)
  if (!s) return null
  if (s.href === CARGAR.href) return 'cargar'
  if (s.href === BARRA_INFERIOR.hoy) return 'hoy'
  if (s.grupo === 'Patrimonio') return 'patrimonio'
  if (s.href === BARRA_INFERIOR.resultados) return 'resultados'
  return 'mas'
}
