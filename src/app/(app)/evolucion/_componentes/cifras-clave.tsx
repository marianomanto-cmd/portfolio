import type { VistaEvolucion } from '@/lib/vistas/contratos-evolucion'
import { MontoTrazado } from '@/components/monto'
import { CifraClave, CifrasClave } from '@/components/pantalla/cifra-clave'
import { cifrasEvolucion } from '../_lib/cifras'
import { NotaCifras } from './nota'

// Las cuatro cifras clave (handoff, captura 07): el resultado del período en
// pesos y en dólares, lo que pusieron tus activos y lo que puso el tipo de
// cambio (en oro), cada una con su nota. Cada cifra abre su traza.

export function CifrasEvolucion({ v }: { v: VistaEvolucion }) {
  return (
    <CifrasClave aria-label="Cifras clave del período">
      {cifrasEvolucion(v).map((c) => (
        <CifraClave
          key={c.clave}
          rotulo={c.rotulo}
          principal={
            <MontoTrazado
              calc={c.principal.calc}
              moneda={c.principal.moneda}
              titulo={c.principal.titulo}
              signo
              color={c.tono === 'resultado'}
              decimales={c.principal.moneda === 'USD' ? 0 : undefined}
              className={c.tono === 'oro' ? 'text-viz-strong' : ''}
            />
          }
          secundaria={c.secundaria ? <MontoTrazado calc={c.secundaria.calc} moneda={c.secundaria.moneda} titulo={c.secundaria.titulo} signo decimales={0} /> : undefined}
          nota={<NotaCifras partes={c.nota} />}
        />
      ))}
    </CifrasClave>
  )
}
