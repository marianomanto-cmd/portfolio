import type { Pantalla } from './tipos'

// Pasivos y Datos › Leasing (entrega 4): cada ruta y cada estado demo de la
// pantalla (src/lib/vistas/ejemplo-pasivos.ts). /datos/leasing sin estado está
// en base.ts; acá va también su estado por defecto (cuadro) para que este
// grupo lo recorra solo. Lo llena el constructor C.
export const PANTALLAS_PASIVOS: Pantalla[] = [
  { ruta: '/pasivos', nombre: 'pasivos' },
  { ruta: '/pasivos?demo=sin-pasivo', nombre: 'pasivos-sin-pasivo' },
  { ruta: '/pasivos?demo=sin-cuadro', nombre: 'pasivos-sin-cuadro' },
  { ruta: '/pasivos?demo=sin-tasa', nombre: 'pasivos-sin-tasa' },
  { ruta: '/pasivos?demo=completo', nombre: 'pasivos-completo' },
  { ruta: '/datos/leasing?demo=cuadro', nombre: 'datos-leasing-cuadro' },
  { ruta: '/datos/leasing?demo=sin-pasivo', nombre: 'datos-leasing-sin-pasivo' },
  { ruta: '/datos/leasing?demo=sin-cuadro', nombre: 'datos-leasing-sin-cuadro' },
  { ruta: '/datos/leasing?demo=revision', nombre: 'datos-leasing-revision' },
  { ruta: '/datos/leasing?demo=completo', nombre: 'datos-leasing-completo' },
]
