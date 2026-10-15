import type { Pantalla } from './tipos'

// Las pantallas de la fase 1a. Cada pantalla nueva tiene su propio archivo en
// esta carpeta, que toca solo quien la construye (entrega 4: plan §2, §9).
export const PANTALLAS_BASE: Pantalla[] = [
  { ruta: '/', nombre: 'hoy' },
  { ruta: '/?demo=vacio', nombre: 'hoy-dia-cero' },
  { ruta: '/?demo=express', nombre: 'hoy-carga-express' },
  { ruta: '/?demo=viejo', nombre: 'hoy-datos-viejos' },
  { ruta: '/cartera', nombre: 'cartera' },
  { ruta: '/cartera?demo=viejo', nombre: 'cartera-precios-viejos' },
  { ruta: '/exposicion', nombre: 'exposicion' },
  { ruta: '/exposicion?vista=total', nombre: 'exposicion-total' },
  { ruta: '/registro', nombre: 'registro' },
  { ruta: '/ajustes', nombre: 'ajustes' },
  { ruta: '/carga', nombre: 'carga' },
  { ruta: '/datos/catalogo', nombre: 'datos-catalogo' },
  { ruta: '/datos/cuentas', nombre: 'datos-cuentas' },
  { ruta: '/datos/bienes', nombre: 'datos-bienes' },
  { ruta: '/datos/leasing', nombre: 'datos-leasing' },
  { ruta: '/datos/movimientos', nombre: 'datos-movimientos' },
  { ruta: '/no-existe', nombre: 'no-encontrada', estado: 404 },
]
