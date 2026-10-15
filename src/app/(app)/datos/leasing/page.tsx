import type { Metadata } from 'next'
import { hoyCordoba } from '@/lib/domain/fechas'
import { HOY_PASIVOS } from '@/lib/vistas/ejemplo-pasivos'
import { Aviso } from '../../carga/_componentes/ui'
import { Leasing } from '../_componentes/leasing'
import { AvisoDatos, datosDe } from '../_lib/pagina'
import { leerDatosLeasing, type DatosLeasing } from '../_lib/servidor-leasing'

export const metadata: Metadata = { title: 'Leasing · Datos' }

// Datos › Leasing: el contrato y su deuda (fase 1, D-130, D-154) más lo de la
// entrega 4 (cuadro de marcha, deuda según el cuadro, datos nuevos del
// contrato). En modo demo, el ejemplo inventado de Pasivos y sus estados
// (?demo=sin-pasivo|sin-cuadro|sin-tasa|cuadro|completo|revision), así las dos
// pantallas cuentan lo mismo.

export default async function PaginaLeasing({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [datos, sp] = await Promise.all([datosDe('/datos/leasing'), searchParams])
  let extra: DatosLeasing | null = null
  let error: string | null = null
  // Sin base o con la base caída, Datos ya lo dice arriba: no se suma otro aviso.
  if (datos.modo === 'real' || datos.modo === 'demo') {
    try {
      extra = await leerDatosLeasing(sp.demo)
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
  }
  const demo = extra?.demo ?? null
  return (
    <div className="space-y-4">
      <AvisoDatos datos={datos} />
      {error ? <Aviso tono="error">No pude leer el cuadro de marcha: {error}. El contrato y su deuda se ven igual.</Aviso> : null}
      <Leasing
        pasivos={demo ? demo.pasivos : datos.pasivos}
        saldos={demo ? demo.saldos : datos.saldosPasivo}
        bienes={datos.bienes}
        ccl={demo ? demo.ccl : datos.ccl}
        hoy={demo ? HOY_PASIVOS : hoyCordoba()}
        extra={extra?.porPasivo ?? {}}
        demo={demo ? { variante: demo.variante, csv: demo.csv, revision: demo.revision } : null}
      />
    </div>
  )
}
