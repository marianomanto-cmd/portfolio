// Freno a los intentos de clave (D-21). Cada clave equivocada ya tarda
// DEMORA_FALLO_MS en contestar; desde el tercer error seguido del mismo origen
// (la IP que informa Vercel), además, la entrada queda trabada un rato que se
// duplica con cada error: 1 s, 2 s, 4 s… hasta 5 minutos. Mientras está
// trabada, la clave ni se mira. Equivocarte una o dos veces no te frena.
//
// Mandar muchos intentos en paralelo tampoco sirve: reservarIntento mira la
// traba y anota el intento como error en un solo paso, antes de comparar la
// clave (D-112). Sin un await en el medio, cada pedido ya ve los anteriores,
// y una ráfaga prueba como mucho 3 claves, lo mismo que en serie.
//
// Vive en la memoria de cada instancia del servidor: no es un candado
// perfecto (otra instancia arranca de cero), es un freno barato. Funciones
// puras sobre un registro explícito, para poder probarlas.

export const DEMORA_FALLO_MS = 800
export const ERRORES_LIBRES = 2
export const TRABA_MAXIMA_MS = 5 * 60 * 1000
/** Pasado este rato sin errores, el contador vuelve a cero. */
export const OLVIDO_MS = 15 * 60 * 1000
/** Tope de orígenes recordados (para que llenar el registro no cueste memoria). */
export const MAXIMO_ORIGENES = 1000

export interface Intentos {
  errores: number
  ultimo: number
  trabadoHasta: number
}

export type Registro = Map<string, Intentos>

/** Cuánto queda trabado el origen después de `errores` errores seguidos. */
export function trabaTrasErrores(errores: number): number {
  if (errores <= ERRORES_LIBRES) return 0
  return Math.min(1000 * 2 ** (errores - ERRORES_LIBRES - 1), TRABA_MAXIMA_MS)
}

function vigente(r: Registro, origen: string, ahora: number): Intentos | null {
  const i = r.get(origen)
  if (!i) return null
  if (ahora - i.ultimo > OLVIDO_MS && ahora >= i.trabadoHasta) {
    r.delete(origen)
    return null
  }
  return i
}

/** Milisegundos que faltan para poder probar otra vez (0: puede probar ya). */
export function esperaPendiente(r: Registro, origen: string, ahora: number): number {
  const i = vigente(r, origen, ahora)
  return i ? Math.max(0, i.trabadoHasta - ahora) : 0
}

/** Anota una clave equivocada y devuelve cuánto queda trabado el origen. */
export function anotarError(r: Registro, origen: string, ahora: number): number {
  const previo = vigente(r, origen, ahora)
  const errores = (previo?.errores ?? 0) + 1
  const traba = trabaTrasErrores(errores)
  r.delete(origen) // reinsertar: el Map queda ordenado del más viejo al más nuevo
  r.set(origen, { errores, ultimo: ahora, trabadoHasta: ahora + traba })
  while (r.size > MAXIMO_ORIGENES) {
    const masViejo = r.keys().next().value
    if (masViejo === undefined) break
    r.delete(masViejo)
  }
  return traba
}

export type Reserva = { trabado: true; espera: number } | { trabado: false; traba: number }

/**
 * Mira la traba y, si no hay, anota el intento como error por adelantado, en
 * un solo paso: así ningún pedido en paralelo se saltea el freno. Trabado,
 * devuelve cuánto falta; si no, cuánto queda trabado el origen si la clave
 * está mal. Si está bien, anotarExito borra la anotación.
 */
export function reservarIntento(r: Registro, origen: string, ahora: number): Reserva {
  const espera = esperaPendiente(r, origen, ahora)
  if (espera > 0) return { trabado: true, espera }
  return { trabado: false, traba: anotarError(r, origen, ahora) }
}

/** Entró: el origen queda limpio. */
export function anotarExito(r: Registro, origen: string): void {
  r.delete(origen)
}

/** "Esperá 5 segundos" / "Esperá 2 minutos". */
export function textoEspera(ms: number): string {
  const s = Math.ceil(ms / 1000)
  if (s < 60) return `Esperá ${s} ${s === 1 ? 'segundo' : 'segundos'}`
  const m = Math.ceil(s / 60)
  return `Esperá ${m} ${m === 1 ? 'minuto' : 'minutos'}`
}

/** El origen de un pedido: la IP del cliente que informa Vercel (o "local"). */
export function origenDelPedido(h: { get(nombre: string): string | null }): string {
  const ip = h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]
  return ip?.trim() || 'local'
}
