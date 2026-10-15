// Nombres y colores de cada clase y geografía: los mismos en todas las
// pantallas y todos los gráficos (plan de la entrega 4, §8). Sin dependencias,
// para que lo usen también los componentes de cliente.

export const NOMBRE_CLASE: Record<string, string> = {
  cedear: 'CEDEARs',
  accion_local: 'Acciones locales',
  bono: 'Bonos',
  lecap: 'Letras',
  fci: 'FCI',
  liquidez: 'Liquidez',
  inmueble: 'Inmuebles',
  vehiculo: 'Vehículos',
  otro: 'Otros bienes',
  deuda: 'Deudas',
}
export const COLOR_CLASE: Record<string, string> = {
  cedear: '#2f5bd3',
  accion_local: '#0f8b8d',
  bono: '#c2621f',
  lecap: '#b8336a',
  fci: '#7a4fc9',
  liquidez: '#6b7a90',
  inmueble: '#8a8f98',
  vehiculo: '#a0a4ab',
  otro: '#b5b8bd',
}
export const NOMBRE_GEO: Record<string, string> = { AR: 'Argentina', US: 'EE.UU.', BR: 'Brasil', GLOBAL: 'Global' }
export const COLOR_GEO: Record<string, string> = { AR: '#4a6fa5', US: '#2f5bd3', BR: '#3b8f3e', GLOBAL: '#7a4fc9' }
