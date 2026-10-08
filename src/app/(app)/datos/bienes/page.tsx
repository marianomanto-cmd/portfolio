import type { Metadata } from 'next'
import { hoyCordoba } from '@/lib/domain/fechas'
import { Bienes } from '../_componentes/bienes'
import { AvisoDatos, datosDe } from '../_lib/pagina'

export const metadata: Metadata = { title: 'Bienes · Datos' }

export default async function PaginaBienes() {
  const datos = await datosDe('/datos/bienes')
  return (
    <div className="space-y-4">
      <AvisoDatos datos={datos} />
      <Bienes bienes={datos.bienes} valuaciones={datos.valuaciones} pasivos={datos.pasivos} ccl={datos.ccl} hoy={hoyCordoba()} />
    </div>
  )
}
