import type { ParteLectura } from '@/components/pantalla/lectura'
import { TextoConMontos } from '@/components/monto'
import { Traza } from '@/components/traza'

// Una nota con cifras (la de una cifra clave): el texto se lee de corrido y
// cada cifra abre su traza. Un monto se tapa con el modo privado; un
// porcentaje o un tipo de cambio, no (manual §10). Un monto dentro del texto
// (un motivo) también se tapa.

export function NotaCifras({ partes }: { partes: readonly ParteLectura[] }) {
  return (
    <>
      {partes.map((p, i) =>
        p.calc ? (
          <Traza key={i} calc={p.calc} titulo={p.titulo ?? p.texto} moneda={p.moneda}>
            <span className={`num ${p.texto.includes('$') ? 'monto' : ''}`}>{p.texto}</span>
          </Traza>
        ) : (
          <TextoConMontos key={i} texto={p.texto} />
        ),
      )}
    </>
  )
}
