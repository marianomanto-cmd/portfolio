import type { Pantalla } from './tipos'

// Evolución y PnL (entrega 4): cada ruta y cada estado demo de la pantalla (plan §4 B.8).
export const PANTALLAS_EVOLUCION: Pantalla[] = [
  { ruta: '/evolucion', nombre: 'evolucion' },
  { ruta: '/evolucion?demo=vacio', nombre: 'evolucion-sin-cargas' },
  { ruta: '/evolucion?demo=un-dia', nombre: 'evolucion-un-dia' },
  // Lo primero que ve el dueño en la vista Total: un solo día, con la casa, la camioneta y la deuda estimada.
  { ruta: '/evolucion?demo=un-dia&vista=total', nombre: 'evolucion-un-dia-total' },
  { ruta: '/evolucion?demo=semana', nombre: 'evolucion-semana' },
  { ruta: '/evolucion?demo=mes', nombre: 'evolucion-mes' },
  { ruta: '/evolucion?moneda=usd&vista=total', nombre: 'evolucion-total-usd' },
  { ruta: '/evolucion?demo=mes&periodo=elegir&desde=2026-10-07&hasta=2026-11-06&moneda=ars', nombre: 'evolucion-elegir-fechas' },
]
