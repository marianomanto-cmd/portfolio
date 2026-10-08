import type { Metadata } from 'next'
import { hoyCordoba } from '@/lib/domain/fechas'
import { Leasing } from '../_componentes/leasing'
import { AvisoDatos, datosDe } from '../_lib/pagina'

export const metadata: Metadata = { title: 'Leasing · Datos' }

export default async function PaginaLeasing() {
  const datos = await datosDe('/datos/leasing')
  return (
    <div className="space-y-4">
      <AvisoDatos datos={datos} />
      <Leasing pasivos={datos.pasivos} saldos={datos.saldosPasivo} bienes={datos.bienes} ccl={datos.ccl} hoy={hoyCordoba()} />
    </div>
  )
}
