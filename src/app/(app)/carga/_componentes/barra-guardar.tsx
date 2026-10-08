'use client'

// La barra de Guardar: dice qué va a hacer el Enter, con números. En el
// teléfono queda arriba de la barra inferior, y con el teclado abierto, arriba
// del teclado (medido con visualViewport): nunca tapa un campo.

import { useEffect, useState, type ReactNode } from 'react'
import { CornerDownLeft } from 'lucide-react'
import { Boton } from './ui'

function useAlturaTeclado(): number {
  const [alto, setAlto] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const medir = () => {
      const tapado = window.innerHeight - vv.height - vv.offsetTop
      setAlto(tapado > 80 ? Math.round(tapado) : 0)
    }
    medir()
    vv.addEventListener('resize', medir)
    vv.addEventListener('scroll', medir)
    return () => {
      vv.removeEventListener('resize', medir)
      vv.removeEventListener('scroll', medir)
    }
  }, [])
  return alto
}

export function BarraGuardar({
  texto,
  habilitado,
  motivo,
  estado,
  secundario,
  onGuardar,
}: {
  texto: string
  habilitado: boolean
  motivo: string | null
  /** Línea chica a la izquierda: tiempo activo. */
  estado: ReactNode
  secundario?: { texto: string; onClick: () => void } | null
  onGuardar: () => void
}) {
  const teclado = useAlturaTeclado()
  return (
    <div
      className="fixed right-0 left-[var(--nav-w)] z-30 border-t border-border bg-bg/95 px-4 py-2 backdrop-blur-md md:px-6"
      style={{ bottom: teclado ? `${teclado}px` : 'calc(var(--barra-inf) + env(safe-area-inset-bottom))' }}
    >
      <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-center">
        <div className="min-w-0 text-sm text-muted max-md:hidden">{estado}</div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row md:ml-auto">
          {secundario ? (
            <Boton variante="secundario" onClick={secundario.onClick} className="max-sm:w-full">
              {secundario.texto}
            </Boton>
          ) : null}
          <Boton
            variante="primario"
            onClick={onGuardar}
            aria-disabled={!habilitado}
            title={motivo ?? 'Guardar (Enter)'}
            className={`min-h-11 max-sm:w-full sm:min-w-64 ${habilitado ? '' : 'cursor-not-allowed opacity-60'}`}
          >
            <span>{texto}</span>
            {habilitado ? <CornerDownLeft aria-hidden className="size-4 max-md:hidden" /> : null}
          </Boton>
        </div>
        <div className="min-w-0 text-xs text-muted md:hidden">{estado}</div>
      </div>
    </div>
  )
}
