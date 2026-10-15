// Nombres y colores de cada clase y geografía: los mismos en todas las
// pantallas y todos los gráficos (plan de la entrega 4, §8; sistema visual
// D-157). Sin dependencias de React, para que lo usen también los componentes
// de cliente. El color de cada activo está en src/lib/domain/colores.ts.
//
// Las familias siguen la regla de color: lo dolarizado en oro, lo que está en
// pesos en piedra (tinta cálida), la liquidez en gris lavanda y los bienes en
// un lila apagado. Verde y sangría quedan para resultados y deuda.

import { COLOR_BIEN, COLOR_LIQUIDEZ_ARS, COLOR_PASIVO, PALETA_DOLAR, PALETA_PESOS } from '@/lib/domain/colores'

export { COLOR_MONEDA, COLOR_SIN_ELEGIR, coloresDeActivos, colorDeFamilia, familiaDe, PALETA_DOLAR, PALETA_PESOS, TINTA_SOBRE_SEGMENTO } from '@/lib/domain/colores'

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
  cedear: PALETA_DOLAR[1],
  accion_local: PALETA_PESOS[1],
  bono: PALETA_PESOS[0],
  lecap: PALETA_PESOS[2],
  fci: '#B4AEBF',
  liquidez: COLOR_LIQUIDEZ_ARS,
  inmueble: COLOR_BIEN,
  vehiculo: '#7F7194',
  otro: '#B9AFC8',
  deuda: COLOR_PASIVO,
}
export const NOMBRE_GEO: Record<string, string> = { AR: 'Argentina', US: 'EE.UU.', BR: 'Brasil', GLOBAL: 'Global' }
export const COLOR_GEO: Record<string, string> = { AR: PALETA_PESOS[0], US: PALETA_DOLAR[1], BR: PALETA_DOLAR[2], GLOBAL: PALETA_DOLAR[3] }
