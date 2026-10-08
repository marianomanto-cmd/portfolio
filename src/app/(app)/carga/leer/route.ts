// Lee un archivo de la carga diaria: el Excel de IEB (parser determinístico) o
// una captura (Claude visión). Es un Route Handler y no una Server Action
// porque las Server Actions se despachan de a una: así el Excel y las dos
// capturas se leen a la vez. Cada archivo viaja solo (Vercel corta los pedidos
// de más de 4,5 MB) y, con base, se guarda en el bucket privado mientras se
// lee: al confirmar no hace falta volver a subirlo.

import { leerCaptura } from '@/lib/carga/captura'
import type { NombreCuenta } from '@/lib/carga/contratos'
import { leerExcelIEB } from '@/lib/carga/ieb'
import { subirArchivo } from '@/lib/server/escritura'
import { exigirSesion } from '@/lib/server/sesion'
import { claseDeArchivo, mensajeLectura, mimeDeImagen, type RespuestaLectura } from '../_lib/fuentes'
import { firmarLectura, modoCarga } from '../_lib/servidor'

export const maxDuration = 60

const CUENTAS: NombreCuenta[] = ['IEB', 'Galicia', 'Mercado Pago']
const MAX_BYTES = 4 * 1024 * 1024

function error(mensaje: string, status: number) {
  return Response.json({ ok: false, error: mensaje } satisfies RespuestaLectura, { status })
}

const texto = (e: unknown) => (e instanceof Error ? e.message : String(e))

export async function POST(request: Request) {
  try {
    await exigirSesion()
  } catch {
    return error('Sesión vencida: volvé a entrar.', 401)
  }
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return error('No llegó el archivo.', 400)
  }
  const archivo = form.get('archivo')
  if (!(archivo instanceof File)) return error('No llegó el archivo.', 400)
  const clase = claseDeArchivo(archivo.name, archivo.type)
  if (!clase) return error(`No sé leer «${archivo.name}»: solo el Excel de IEB (.xlsx) o capturas (imágenes).`, 415)
  if (archivo.size > MAX_BYTES) return error(`«${archivo.name}» pesa más de 4 MB. Probá con una captura más chica.`, 413)
  const pistaCruda = form.get('pista')
  const pista = CUENTAS.find((c) => c === pistaCruda)

  const bytes = new Uint8Array(await archivo.arrayBuffer())
  const tipo = clase === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : mimeDeImagen(archivo.name, archivo.type)
  const inicio = performance.now()
  const guardar = modoCarga() === 'real'

  const [lectura, guardado] = await Promise.allSettled([
    clase === 'excel' ? leerExcelIEB(bytes) : leerCaptura({ bytes, tipo }, { pista }),
    guardar ? subirArchivo(bytes, tipo, archivo.name || (clase === 'excel' ? 'portafolio.xlsx' : 'captura.png')) : Promise.resolve(null),
  ])
  const ms = Math.round(performance.now() - inicio)

  if (lectura.status === 'rejected') {
    return error(mensajeLectura(clase, pista, lectura.reason), 422)
  }
  if (guardado.status === 'rejected') {
    return error(`Leí ${lectura.value.cuenta}, pero no pude guardar el archivo: ${texto(guardado.reason)}`, 502)
  }
  const archivoGuardado = guardado.value
  return Response.json({
    ok: true,
    lectura: lectura.value,
    archivo: archivoGuardado,
    firma: firmarLectura(lectura.value, archivoGuardado),
    ms,
  } satisfies RespuestaLectura)
}
