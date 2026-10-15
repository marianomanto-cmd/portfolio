import {
  BriefcaseBusiness,
  CalendarRange,
  ChartLine,
  Database,
  History,
  House,
  Landmark,
  ReceiptText,
  Scale,
  Settings,
  Upload,
  type LucideIcon,
} from 'lucide-react'

// Secciones desplegadas (D-69: lo no desplegado no aparece, ni como
// "próximamente"). La barra crece con cada despliegue: la entrega 4 suma
// Balance y Evolución y PnL a Patrimonio, y el grupo Contexto (Pasivos, Flujo).

export interface Seccion {
  href: string
  nombre: string
  /** El nombre en la barra inferior del teléfono, si el completo no entra (11 px, un quinto de 360 px). */
  corto?: string
  /** Una línea para la hoja "Más" del teléfono. */
  descripcion: string
  icono: LucideIcon
  grupo: 'Diario' | 'Patrimonio' | 'Contexto' | 'Al pie'
}

export const SECCIONES: Seccion[] = [
  { href: '/', nombre: 'Hoy', descripcion: 'Cuánto tenés y qué pasó', icono: House, grupo: 'Diario' },
  { href: '/carga', nombre: 'Cargar', descripcion: 'Los 60 segundos del día', icono: Upload, grupo: 'Diario' },
  { href: '/patrimonio', nombre: 'Balance', descripcion: 'Qué tenés, qué debés y cuánto vale todo', icono: Landmark, grupo: 'Patrimonio' },
  { href: '/cartera', nombre: 'Cartera', descripcion: 'Cada posición en pesos y en dólares', icono: BriefcaseBusiness, grupo: 'Patrimonio' },
  { href: '/exposicion', nombre: 'Exposición', descripcion: 'Largo, corto y neto en pesos', icono: Scale, grupo: 'Patrimonio' },
  { href: '/evolucion', nombre: 'Evolución y PnL', corto: 'Evolución', descripcion: 'Cuánto ganaste o perdiste, en qué y por qué', icono: ChartLine, grupo: 'Patrimonio' },
  { href: '/pasivos', nombre: 'Pasivos', descripcion: 'El leasing: cuotas pagadas, lo que falta y la deuda', icono: ReceiptText, grupo: 'Contexto' },
  { href: '/flujo', nombre: 'Flujo y escenarios', descripcion: 'Cuánto te sobra por mes y adónde te lleva', icono: CalendarRange, grupo: 'Contexto' },
  { href: '/registro', nombre: 'Registro', descripcion: 'Qué entró, de qué archivo, cuánto tardó; revertir', icono: History, grupo: 'Al pie' },
  { href: '/datos', nombre: 'Datos', descripcion: 'Catálogo, cuentas, bienes y leasing', icono: Database, grupo: 'Al pie' },
  { href: '/ajustes', nombre: 'Ajustes', descripcion: 'Tema, paleta, modo privado y sesión', icono: Settings, grupo: 'Al pie' },
]

export function seccionActiva(pathname: string): Seccion | null {
  if (pathname === '/') return SECCIONES[0]
  return SECCIONES.find((s) => s.href !== '/' && (pathname === s.href || pathname.startsWith(`${s.href}/`))) ?? null
}
