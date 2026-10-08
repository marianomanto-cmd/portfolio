// Qué es cada archivo que soltás o pegás, y de qué día son los datos (D-61 de
// la visión: la fecha la da la fuente, no el reloj).

import { fechaCorta } from '@/lib/domain/fechas'
import type { Fecha } from '@/lib/domain/tipos'
import type { LecturaCuenta, NombreCuenta } from '@/lib/carga/contratos'
import type { ArchivoGuardado } from './confirmacion'

/** Lo que devuelve POST /carga/leer. */
export type RespuestaLectura =
  | { ok: true; lectura: LecturaCuenta; archivo: ArchivoGuardado | null; firma: string; ms: number }
  | { ok: false; error: string }

export type ClaseArchivo = 'excel' | 'imagen'

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Excel de IEB o captura. null: no se sabe leer. */
export function claseDeArchivo(nombre: string, tipo: string): ClaseArchivo | null {
  const ext = nombre.toLowerCase().split('.').at(-1) ?? ''
  if (tipo === MIME_XLSX || ext === 'xlsx') return 'excel'
  if (tipo.startsWith('image/')) return 'imagen'
  if (['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif', 'gif'].includes(ext)) return 'imagen'
  return null
}

/** MIME de una imagen sin tipo (algunos navegadores no lo mandan al pegar). */
export function mimeDeImagen(nombre: string, tipo: string): string {
  if (tipo) return tipo
  const ext = nombre.toLowerCase().split('.').at(-1) ?? ''
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'heic' || ext === 'heif') return 'image/heic'
  if (ext === 'gif') return 'image/gif'
  return 'image/png'
}

/**
 * Mensaje de un archivo que no se pudo leer. Los lectores ya dicen "No pude
 * leer la captura de Galicia: …": no se repite el prefijo.
 */
export function mensajeLectura(clase: ClaseArchivo, pista: NombreCuenta | undefined, motivo: unknown): string {
  const texto = (motivo instanceof Error ? motivo.message : String(motivo)).trim()
  if (/^No pude leer\b/i.test(texto)) return texto
  const que = clase === 'excel' ? 'el Excel' : pista ? `la captura de ${pista}` : 'la captura'
  return `No pude leer ${que}: ${texto}`
}

export interface FechaElegida {
  fecha: Fecha
  /** De dónde salió, para mostrarlo: "tomada del Excel de IEB, celda B1". */
  origen: string
}

/**
 * La fecha de la carga: la del Excel (B1) si hay uno; si no, la que muestre
 * una captura; si ninguna la trae, hoy en Córdoba.
 */
export function fechaDeCarga(lecturas: readonly LecturaCuenta[], hoy: Fecha): FechaElegida {
  const excel = lecturas.find((l) => l.origen === 'excel' && l.fecha_reporte)
  if (excel?.fecha_reporte) {
    return { fecha: excel.fecha_reporte, origen: `tomada del Excel de ${excel.cuenta}, celda B1` }
  }
  const captura = lecturas.find((l) => l.fecha_reporte)
  if (captura?.fecha_reporte) {
    return { fecha: captura.fecha_reporte, origen: `la que muestra la captura de ${captura.cuenta}` }
  }
  return { fecha: hoy, origen: 'hoy' }
}

/** Avisos de fechas que no coinciden entre fuentes (CA-5). */
export function avisosDeFecha(lecturas: readonly LecturaCuenta[], fecha: Fecha, hoy: Fecha): string[] {
  const avisos: string[] = []
  for (const l of lecturas) {
    if (l.fecha_reporte && l.fecha_reporte !== fecha) {
      avisos.push(`${l.cuenta}: la fuente es del ${fechaCorta(l.fecha_reporte)} y la carga es del ${fechaCorta(fecha)}.`)
    }
    if (!l.fecha_reporte && l.origen === 'captura' && fecha !== hoy) {
      avisos.push(
        `La captura de ${l.cuenta} no muestra fecha: la tomo como del ${fechaCorta(fecha)}. Si es de hoy (${fechaCorta(hoy)}), dejala para otra carga.`,
      )
    }
  }
  return avisos
}

export interface FuenteBase {
  id: string
  cuenta: NombreCuenta | null
  /** Momento en que se agregó (para elegir la más nueva por defecto). */
  agregada: number
}

/**
 * Una carga graba una sola fuente por cuenta (volver a cargar el mismo día
 * reemplaza la anterior). Si hay dos de la misma cuenta, vale la elegida; si no
 * elegiste, la más nueva. Devuelve los ids activos y las cuentas repetidas.
 */
export function fuentesActivas<F extends FuenteBase>(
  fuentes: readonly F[],
  elegidas: Readonly<Partial<Record<NombreCuenta, string>>>,
): { activas: Set<string>; repetidas: NombreCuenta[] } {
  const porCuenta = new Map<NombreCuenta, F[]>()
  for (const f of fuentes) {
    if (!f.cuenta) continue
    const lista = porCuenta.get(f.cuenta) ?? []
    lista.push(f)
    porCuenta.set(f.cuenta, lista)
  }
  const activas = new Set<string>()
  const repetidas: NombreCuenta[] = []
  for (const [cuenta, lista] of porCuenta) {
    if (lista.length > 1) repetidas.push(cuenta)
    const elegida = lista.find((f) => f.id === elegidas[cuenta])
    const ganadora = elegida ?? [...lista].sort((a, b) => b.agregada - a.agregada)[0]
    activas.add(ganadora.id)
  }
  return { activas, repetidas }
}
