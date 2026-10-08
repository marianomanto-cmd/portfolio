import { redirect } from 'next/navigation'
import { rutaDeSeccion } from './_lib/catalogo'

// /datos?seccion=catalogo|cuentas|bienes|leasing|movimientos va a su subpantalla
// (con el resto de la consulta); sin sección, al catálogo.
export default async function PaginaDatos({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(rutaDeSeccion(await searchParams))
}
