import type { Metadata } from 'next'
import { hoyCordoba } from '@/lib/domain/fechas'
import { Catalogo } from '../_componentes/catalogo'
import { AvisoDatos, datosDe } from '../_lib/pagina'

export const metadata: Metadata = { title: 'Catálogo · Datos' }

export default async function PaginaCatalogo() {
  const datos = await datosDe('/datos/catalogo')
  return (
    <div className="space-y-4">
      <AvisoDatos datos={datos} />
      <Catalogo activos={datos.activos} ratios={datos.ratios} hoy={hoyCordoba()} />
    </div>
  )
}
