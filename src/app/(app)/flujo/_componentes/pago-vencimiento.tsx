'use client'

// "Cargar el pago al vencimiento de S13N6" (plan §6 D.1 bloque 4, D.7): el pago
// por VN del aviso de licitación, con su fuente, y la vista previa de lo que
// cobrarías por tu tenencia (vistaPreviaPago, pura y con test).

import { useId, useState } from 'react'
import { leerNumeroAR } from '@/lib/domain/dinero'
import { fechaCorta } from '@/lib/domain/fechas'
import { vistaPreviaPago } from '@/lib/domain/flujo/pago'
import type { BonoSinCronograma } from '@/lib/vistas/contratos-flujo'
import { ParMonto } from '@/components/ui'
import { guardarPagoAccion } from '../acciones'
import { CAMPO, Campo, FormAccion } from './form-accion'

export function PagoVencimiento({ bono, ccl }: { bono: BonoSinCronograma; ccl: string | null }) {
  const id = useId()
  const [pago, setPago] = useState('')
  const [fecha, setFecha] = useState(bono.fecha_vencimiento ?? '')
  const previa = vistaPreviaPago(pago.trim() ? leerNumeroAR(pago) : null, bono.vn, bono.ticker, fecha || null, ccl)
  return (
    <div id={`pago-${bono.ticker}`} className="scroll-mt-4 rounded-lg border border-border p-3">
      <h3 className="text-sm font-medium text-text">Cargar el pago al vencimiento de {bono.ticker}</h3>
      <p className="mt-0.5 text-xs text-muted">
        {bono.nombre}
        {bono.fecha_vencimiento ? ` · vence el ${fechaCorta(bono.fecha_vencimiento)}` : ''}. Sale del aviso de licitación: cuánto paga por cada VN al vencimiento.
      </p>
      <FormAccion accion={guardarPagoAccion} boton="Guardar el pago" ocultos={{ activo_id: String(bono.activo_id) }} className="mt-3">
        {(e) => (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etiqueta="Fecha del pago" htmlFor={`${id}-fecha`} error={e.fecha}>
                <input id={`${id}-fecha`} name="fecha" type="date" value={fecha} onChange={(ev) => setFecha(ev.target.value)} className={CAMPO} />
              </Campo>
              <Campo etiqueta="Pago por VN (en pesos)" htmlFor={`${id}-pago`} error={e.pago_por_vn}>
                <input id={`${id}-pago`} name="pago_por_vn" inputMode="decimal" autoComplete="off" placeholder="Ej.: 1,1046" value={pago} onChange={(ev) => setPago(ev.target.value)} className={CAMPO} />
              </Campo>
            </div>
            <Campo etiqueta="Fuente" htmlFor={`${id}-fuente`} error={e.fuente}>
              <input id={`${id}-fuente`} name="fuente" maxLength={200} autoComplete="off" placeholder="Ej.: aviso de licitación del Tesoro" className={CAMPO} />
            </Campo>
            <p className="text-sm text-muted">
              {previa.ars.valor === null ? (
                <>Escribí el pago por VN para ver cuánto cobrarías.</>
              ) : (
                <span className="inline-flex flex-wrap items-baseline gap-x-2">
                  Cobrarías <ParMonto par={previa} titulo={`Lo que cobrarías de ${bono.ticker}`} /> por tus VN de hoy.
                </span>
              )}
            </p>
          </>
        )}
      </FormAccion>
    </div>
  )
}
