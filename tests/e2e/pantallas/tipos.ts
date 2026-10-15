/** Una pantalla del test de layout (D-30): su ruta (con el estado demo, si hace falta) y su nombre para las capturas. */
export interface Pantalla {
  ruta: string
  nombre: string
  /** El código que tiene que responder, si no es 200 (la página de "no encontrada"). */
  estado?: number
}
