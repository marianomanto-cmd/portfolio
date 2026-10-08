import type { Metadata } from 'next'
import { AvisoDatos, datosDe } from '../_lib/pagina'

export const metadata: Metadata = { title: 'Cuentas · Datos' }

const TIPO = { broker: 'Bróker', banco: 'Banco', billetera: 'Billetera' } as const
const FORMATO = {
  excel_ieb: 'Excel "Portafolio" (lo lee la app, sin IA)',
  captura: 'Captura de pantalla (la lee Claude y la aritmética verifica)',
  manual: 'A mano',
} as const

export default async function PaginaCuentas() {
  const datos = await datosDe('/datos/cuentas')
  return (
    <div className="space-y-4">
      <AvisoDatos datos={datos} />
      <p className="text-sm text-muted">Las cuentas de donde salen los datos de cada día y cómo llegan a Cargar.</p>
      {datos.cuentas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-strong p-4 text-sm text-muted">No hay cuentas cargadas.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {datos.cuentas.map((c) => (
            <li key={c.id} className="min-w-0 rounded-2xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-text">{c.nombre}</h2>
                <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-xs font-medium text-muted">{TIPO[c.tipo]}</span>
                {c.activa ? null : <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-xs font-medium text-muted">inactiva</span>}
              </div>
              <p className="mt-2 text-sm text-muted">{FORMATO[c.formato_carga]}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
