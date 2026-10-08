import 'server-only'

// Arma lo que muestra cada pantalla: lee los hechos de Supabase y llama a los
// armadores puros de ./armar. En modo demo devuelve datos de ejemplo.

import { hoyCordoba } from '@/lib/domain/fechas'
import { leerHechos } from '@/lib/server/hechos'
import { modoDemo } from '@/lib/server/sesion'
import { leerTodo } from '@/lib/server/supabase'
import { armarCartera, armarExposicion, armarHoy, armarRegistro } from './armar'
import type { VistaCartera, VistaExposicion, VistaHoy, VistaRegistro } from './contratos'
import { ejemploCartera, ejemploExposicion, ejemploHoy, ejemploRegistro } from './ejemplo'

export async function vistaHoy(): Promise<VistaHoy> {
  if (modoDemo()) return ejemploHoy()
  return armarHoy(await leerHechos(), hoyCordoba())
}

export async function vistaCartera(): Promise<VistaCartera> {
  if (modoDemo()) return ejemploCartera()
  return armarCartera(await leerHechos(), hoyCordoba())
}

export async function vistaExposicion(modo: 'financiero' | 'total'): Promise<VistaExposicion> {
  if (modoDemo()) return ejemploExposicion(modo)
  return armarExposicion(await leerHechos(), hoyCordoba(), modo)
}

type Fila = Record<string, string | number | boolean | null>

export async function vistaRegistro(): Promise<VistaRegistro> {
  if (modoDemo()) return ejemploRegistro()
  const [cargas, cuentas, cotizaciones, saldos, operaciones, valuaciones, capitales, movimientos, bienes, pasivos] = await Promise.all([
    leerTodo<Fila>(
      'cargas',
      'id,lote,fecha,cuenta_id,origen,archivo_path,estado,creado_en,lector,tiempo_activo_ms',
      ['id'],
    ),
    leerTodo<Fila>('cuentas', 'id,nombre', ['id']),
    leerTodo<Fila>('cotizaciones', 'carga_id,fecha,activo_id', ['fecha', 'activo_id']),
    leerTodo<Fila>('saldos_liquidez', 'carga_id,fecha,cuenta_id,moneda', ['fecha', 'cuenta_id', 'moneda']),
    leerTodo<Fila>('operaciones', 'carga_id,id', ['id']),
    // Lo que graba un guardado de Datos (D-111, D-04).
    leerTodo<Fila>('bienes_valuaciones', 'carga_id,bien_id,fecha', ['fecha', 'bien_id']),
    leerTodo<Fila>('pasivo_saldos', 'carga_id,pasivo_id,fecha', ['fecha', 'pasivo_id']),
    leerTodo<Fila>('movimientos_capital', 'carga_id,id,tipo,cuenta_origen_id,cuenta_destino_id', ['id']),
    leerTodo<Fila>('bienes', 'id,nombre', ['id']),
    leerTodo<Fila>('pasivos', 'id,nombre', ['id']),
  ])
  return armarRegistro({ cargas, cuentas, cotizaciones, saldos, operaciones, valuaciones, capitales, movimientos, bienes, pasivos })
}
