import type { Metadata } from 'next'
import { vistaRegistro } from '@/lib/vistas'
import type { VistaRegistro } from '@/lib/vistas/contratos'
import { ErrorVista } from '@/components/error-vista'
import { Tarjeta } from '@/components/ui'
import { revertirLoteAccion } from './acciones'
import { TablaRegistro } from './_componentes/tabla-registro'
import { agrupar } from './_lib/lotes'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Registro' }

// Registro (visión §4.3): el log de cargas por lote (un Enter puede crear varias
// cargas), con el archivo, lo que entró, cuánto tardó y la opción de revertir.
// Es una tabla (Grilla, D-157): una fila por lote; en el teléfono, una tarjeta.

export default async function PaginaRegistro() {
  let v: VistaRegistro
  try {
    v = await vistaRegistro()
  } catch (e) {
    return (
      <>
        <h1 className="sr-only">Registro</h1>
        <ErrorVista error={e} que="el registro de cargas" />
      </>
    )
  }
  const lotes = agrupar(v.filas)
  const vigentes = v.filas.filter((f) => f.estado === 'vigente').length
  return (
    <div className="flex flex-col gap-4">
      <h1 className="sr-only">Registro de cargas</h1>
      <p className="text-sm text-muted">
        {lotes.length} lote{lotes.length === 1 ? '' : 's'} · {v.filas.length} carga{v.filas.length === 1 ? '' : 's'} ({vigentes} vigente{vigentes === 1 ? '' : 's'}). Un lote es todo lo que guardó un Enter. Revertir no borra el registro: la carga queda marcada como revertida.
      </p>
      {lotes.length === 0 ? (
        <Tarjeta className="p-5 text-sm text-muted">Todavía no hay cargas. La primera aparece acá apenas guardes.</Tarjeta>
      ) : (
        <TablaRegistro lotes={lotes} accion={revertirLoteAccion} />
      )}
    </div>
  )
}
