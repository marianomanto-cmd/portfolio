import {
  BriefcaseBusiness,
  Database,
  History,
  House,
  Scale,
  Settings,
  Upload,
  type LucideIcon,
} from 'lucide-react'

// Secciones desplegadas en la fase 1a (D-69: lo no desplegado no aparece, ni
// como "próximamente"). La barra crece con cada despliegue.

export interface Seccion {
  href: string
  nombre: string
  /** Una línea para la hoja "Más" del teléfono. */
  descripcion: string
  icono: LucideIcon
  grupo: 'Diario' | 'Patrimonio' | 'Al pie'
}

export const SECCIONES: Seccion[] = [
  { href: '/', nombre: 'Hoy', descripcion: 'Cuánto tenés y qué pasó', icono: House, grupo: 'Diario' },
  { href: '/carga', nombre: 'Cargar', descripcion: 'Los 60 segundos del día', icono: Upload, grupo: 'Diario' },
  { href: '/cartera', nombre: 'Cartera', descripcion: 'Cada posición en pesos y en dólares', icono: BriefcaseBusiness, grupo: 'Patrimonio' },
  { href: '/exposicion', nombre: 'Exposición', descripcion: 'Largo, corto y neto en pesos', icono: Scale, grupo: 'Patrimonio' },
  { href: '/registro', nombre: 'Registro', descripcion: 'Qué entró, de qué archivo, cuánto tardó; revertir', icono: History, grupo: 'Al pie' },
  { href: '/datos', nombre: 'Datos', descripcion: 'Catálogo, cuentas, bienes y leasing', icono: Database, grupo: 'Al pie' },
  { href: '/ajustes', nombre: 'Ajustes', descripcion: 'Tema, paleta, modo privado y sesión', icono: Settings, grupo: 'Al pie' },
]

export function seccionActiva(pathname: string): Seccion | null {
  if (pathname === '/') return SECCIONES[0]
  return SECCIONES.find((s) => s.href !== '/' && (pathname === s.href || pathname.startsWith(`${s.href}/`))) ?? null
}
