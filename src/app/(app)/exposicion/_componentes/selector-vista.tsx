import { Segmentado } from '@/components/pantalla/segmentado'
import { rutaExposicion, type ParametrosExposicion } from '../_lib/rutas'

// Qué netea Exposición (D-101): Financiero o Total. Se mantiene del diseño
// anterior, ahora en la pastilla del sistema (D-157), arriba a la derecha. Lo
// que netea cada una va escrito debajo, y en el nombre del link para el lector
// de pantalla. Conserva lo que eligió el balance de abajo (fecha, agrupamiento).

export const VISTAS_EXPOSICION: { modo: 'financiero' | 'total'; nombre: string; netea: string }[] = [
  { modo: 'financiero', nombre: 'Financiero', netea: 'pesos financieros − deuda del leasing' },
  { modo: 'total', nombre: 'Total', netea: 'lo anterior + cada bien en su moneda de riesgo' },
]

export function SelectorVista({ modo, balance }: { modo: 'financiero' | 'total'; balance: Pick<ParametrosExposicion, 'fecha' | 'agrupar' | 'comparar' | 'demo'> }) {
  const actual = VISTAS_EXPOSICION.find((o) => o.modo === modo) ?? VISTAS_EXPOSICION[0]
  return (
    <div className="flex flex-col items-start gap-1.5 md:items-end">
      <Segmentado
        etiqueta="Qué netea la vista"
        opciones={VISTAS_EXPOSICION.map((o) => ({
          href: rutaExposicion({ ...balance, vista: o.modo }),
          nombre: o.nombre,
          actual: o.modo === modo,
          titulo: o.netea,
          oculto: o.netea,
        }))}
      />
      <p className="text-[12px] text-muted">Netea: {actual.netea}</p>
    </div>
  )
}
