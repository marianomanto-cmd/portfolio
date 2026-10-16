import type { Pantalla } from './tipos'

// Exposición con el balance adentro (rediseño 15/10, D-156): cada estado demo
// del balance, que ahora vive en /exposicion (/patrimonio redirige acá). La
// Exposición por defecto y la vista Total están en base.ts. El estado por
// defecto es el de hoy en producción: la deuda del leasing estimada.
export const PANTALLAS_PATRIMONIO: Pantalla[] = [
  { ruta: '/exposicion?demo=un-dia', nombre: 'exposicion-balance-un-dia' },
  { ruta: '/exposicion?demo=completo', nombre: 'exposicion-balance-cancelacion-informada' },
  { ruta: '/exposicion?demo=segun-cuadro', nombre: 'exposicion-balance-segun-cuadro' },
  { ruta: '/exposicion?demo=sin-deuda', nombre: 'exposicion-balance-sin-deuda' },
  { ruta: '/exposicion?demo=sin-valuacion', nombre: 'exposicion-balance-casa-sin-valuacion' },
  { ruta: '/exposicion?demo=sin-bienes', nombre: 'exposicion-balance-sin-bienes' },
  { ruta: '/exposicion?demo=viejo', nombre: 'exposicion-balance-precios-viejos' },
  { ruta: '/exposicion?demo=vacio', nombre: 'exposicion-sin-cargas' },
  { ruta: '/exposicion?agrupar=instrumento', nombre: 'exposicion-balance-por-instrumento' },
  { ruta: '/exposicion?agrupar=clase&fecha=2026-10-01', nombre: 'exposicion-balance-primera-fecha-por-clase' },
  { ruta: '/exposicion?comparar=2026-10-08&demo=segun-cuadro', nombre: 'exposicion-balance-comparativo' },
  { ruta: '/exposicion?vista=total&demo=sin-deuda', nombre: 'exposicion-total-sin-deuda' },
]
