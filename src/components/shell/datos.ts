import 'server-only'

import { cache } from 'react'
import { vistaHoy } from '@/lib/vistas'

/**
 * La vista de Hoy, una sola vez por pedido: la usan el indicador de datos de la
 * barra superior, el punto de Cargar y las pantallas que necesitan el CCL o las
 * fuentes. React deduplica las llamadas dentro del mismo render del servidor.
 */
export const hoyDelPedido = cache(() => vistaHoy())
