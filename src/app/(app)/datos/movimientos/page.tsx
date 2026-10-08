import type { Metadata } from 'next'
import { hoyCordoba } from '@/lib/domain/fechas'
import { Movimientos } from '../_componentes/movimientos'
import { precargaMovimiento } from '../_lib/calculos'
import { AvisoDatos, datosDe } from '../_lib/pagina'

export const metadata: Metadata = { title: 'Movimientos · Datos' }

export default async function PaginaMovimientos({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const datos = await datosDe('/datos/movimientos')
  const q = await searchParams
  const hoy = hoyCordoba()
  // Viene del "¿Entró o salió plata?" de la bandeja: el movimiento precargado.
  const precarga = q.tipo || q.monto ? precargaMovimiento(q, hoy) : null
  return (
    <div className="space-y-4">
      <AvisoDatos datos={datos} />
      <Movimientos
        movimientos={datos.movimientos}
        cuentas={datos.cuentas.filter((c) => c.activa).map(({ id, nombre }) => ({ id, nombre }))}
        ccls={datos.ccls}
        hoy={hoy}
        precarga={precarga}
      />
    </div>
  )
}
