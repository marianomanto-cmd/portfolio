import type { Pantalla } from './tipos'

// Evolución y PnL: cada ruta y cada estado demo de la pantalla (plan §4 B.8),
// con los períodos del rediseño (15/10, D-159: 1M · 3M · YTD · 12M · INICIO,
// y la semana y "Elegir fechas" en "Otro período").
export const PANTALLAS_EVOLUCION: Pantalla[] = [
  { ruta: '/evolucion', nombre: 'evolucion' },
  { ruta: '/evolucion?demo=vacio', nombre: 'evolucion-sin-cargas' },
  { ruta: '/evolucion?demo=un-dia', nombre: 'evolucion-un-dia' },
  // Lo primero que ve el dueño en la vista Total: un solo día, con la casa, la camioneta y la deuda estimada.
  { ruta: '/evolucion?demo=un-dia&vista=total', nombre: 'evolucion-un-dia-total' },
  { ruta: '/evolucion?demo=semana', nombre: 'evolucion-semana' },
  { ruta: '/evolucion?demo=mes', nombre: 'evolucion-mes' },
  { ruta: '/evolucion?moneda=usd&vista=total', nombre: 'evolucion-total-usd' },
  { ruta: '/evolucion?periodo=12m&moneda=ars', nombre: 'evolucion-12m-pesos' },
  { ruta: '/evolucion?periodo=ytd&vista=total', nombre: 'evolucion-ytd-total' },
  { ruta: '/evolucion?demo=mes&periodo=elegir&desde=2026-10-07&hasta=2026-11-06&moneda=ars', nombre: 'evolucion-elegir-fechas' },
]
