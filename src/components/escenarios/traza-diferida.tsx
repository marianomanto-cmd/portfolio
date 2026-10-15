'use client'

// Una cifra de la proyección con su traza A PEDIDO (plan §6 D.2: proyectar()
// no arma trazas; trazaMes() la arma al tocar). Es la misma Traza de siempre
// (components/traza.tsx, TrazaBase con `obtener`): la misma placa de vidrio en
// desktop y la misma hoja en el teléfono.

import type { ReactNode } from 'react'
import type { CalcVista } from '@/lib/domain/calc'
import { TrazaBase } from '@/components/traza'

export function TrazaDiferida({
  obtener,
  titulo,
  moneda,
  children,
  className = '',
}: {
  /** Arma la traza (se llama recién al abrir). */
  obtener: () => CalcVista
  titulo: string
  moneda?: 'ARS' | 'USD'
  children: ReactNode
  className?: string
}) {
  return (
    <span data-cifra="" className={`inline-flex max-w-full ${className}`}>
      <TrazaBase obtener={obtener} titulo={titulo} moneda={moneda}>
        {children}
      </TrazaBase>
    </span>
  )
}
