import type { Pantalla } from './tipos'

// Balance (entrega 4): cada ruta y cada estado demo de la pantalla (plan §3 A.8).
// El estado por defecto es el de hoy en producción: la deuda del leasing estimada.
export const PANTALLAS_PATRIMONIO: Pantalla[] = [
  { ruta: '/patrimonio', nombre: 'balance' },
  { ruta: '/patrimonio?demo=un-dia', nombre: 'balance-un-dia' },
  { ruta: '/patrimonio?demo=completo', nombre: 'balance-cancelacion-informada' },
  { ruta: '/patrimonio?demo=segun-cuadro', nombre: 'balance-segun-cuadro' },
  { ruta: '/patrimonio?demo=sin-deuda', nombre: 'balance-sin-deuda' },
  { ruta: '/patrimonio?demo=sin-valuacion', nombre: 'balance-casa-sin-valuacion' },
  { ruta: '/patrimonio?demo=sin-bienes', nombre: 'balance-sin-bienes' },
  { ruta: '/patrimonio?demo=viejo', nombre: 'balance-precios-viejos' },
  { ruta: '/patrimonio?demo=vacio', nombre: 'balance-sin-cargas' },
  { ruta: '/patrimonio?agrupar=instrumento', nombre: 'balance-por-instrumento' },
  { ruta: '/patrimonio?agrupar=clase&fecha=2026-10-01', nombre: 'balance-primera-fecha-por-clase' },
  { ruta: '/patrimonio?comparar=2026-10-08&demo=segun-cuadro', nombre: 'balance-comparativo' },
]
