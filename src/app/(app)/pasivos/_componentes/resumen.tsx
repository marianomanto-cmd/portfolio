import Link from 'next/link'
import type { VistaLeasing } from '@/lib/vistas/contratos-pasivos'
import { MontoTrazado } from '@/components/monto'
import { Aviso, ChipEtiqueta, Rotulo, Tarjeta } from '@/components/ui'
import { cifrasPasivo, tiraCuotas, vencidasSinPagar, type EstadoCelda } from '../_lib/pantalla'

// La tarjeta de arriba de Pasivos (handoff, captura 08): la tira de cuotas
// (una celda por cuota del contrato: pagadas en tinta, la próxima en sangría
// con su brillo, las que faltan en hueco) y, debajo, las cuatro cifras con un
// divisor arriba: el saldo de capital, lo pagado, lo que falta y la opción de
// compra, cada una en pesos y en dólares con su traza. Sin estado: sirve en el
// servidor. Las cuentas están en _lib/pantalla.ts.

const CELDA: Record<EstadoCelda, string> = {
  pagada: 'bg-text',
  proxima: 'bg-accent shadow-[var(--glow-accent)]',
  pendiente: 'border border-border-strong',
  // Venció y la planilla no la marca pagada: no se dibuja como pagada ni como una más.
  vencida: 'border border-border-accent bg-accent-soft',
  // El cuadro no la trae: punteada, sin relleno.
  sin_dato: 'border border-dashed border-border',
}

export function Resumen({ l }: { l: VistaLeasing }) {
  const tira = tiraCuotas(l)
  const cifras = cifrasPasivo(l)
  const vencidas = vencidasSinPagar(l)
  const id = `tira-${l.contrato.id}`
  return (
    <Tarjeta className="flex min-w-0 flex-col gap-[14px] p-5" aria-labelledby={id}>
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Rotulo id={id}>{tira.rotulo}</Rotulo>
        {tira.proxima ? <span className="text-[12px] text-muted">{tira.proxima}</span> : null}
      </div>
      <div
        role="img"
        aria-label={tira.resumen}
        className="grid gap-[2px] sm:gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${tira.celdas.length}, minmax(0, 1fr))` }}
        data-tira={l.contrato.id}
      >
        {tira.celdas.map((c) => (
          <span key={c.nro} title={c.titulo} data-estado={c.estado} className={`h-[26px] min-w-0 rounded-[3px] ${CELDA[c.estado]}`} />
        ))}
      </div>
      {tira.nota ? <p className="text-[12px] text-muted">{tira.nota}</p> : null}
      {vencidas.length ? (
        <Aviso>
          {vencidas.length === 1
            ? `La cuota ${vencidas[0].nro} venció y tu planilla no la marca pagada.`
            : `Las cuotas ${vencidas.map((c) => c.nro).join(', ')} vencieron y tu planilla no las marca pagadas.`}{' '}
          Si ya se debitó, importá la planilla actualizada en{' '}
          <Link href="/datos/leasing#cuadro-de-marcha" className="tocable font-medium text-text underline-offset-2 hover:underline">
            Datos › Leasing
          </Link>
          .
        </Aviso>
      ) : null}
      <dl className="mt-1.5 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        {cifras.map((c) => (
          <div key={c.clave} className="flex min-w-0 flex-col gap-1.5 border-t border-border pt-3" data-cifra-pasivo={c.clave}>
            <dt className="flex min-h-5 min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <span className="rotulo text-[10px]">{c.rotulo}</span>
              {c.par.ars.valor !== null ? <ChipEtiqueta calc={c.par.ars} omitir={['proyectado']} /> : null}
            </dt>
            <dd className="flex min-w-0 flex-col items-start gap-1.5">
              <span className="cifra text-[18px] leading-tight">
                <MontoTrazado calc={c.par.ars} moneda="ARS" titulo={`${c.rotulo} · en pesos`} className={c.deuda ? 'text-accent-glow' : ''} />
              </span>
              <span className="num text-[12px]">
                <MontoTrazado calc={c.par.usd} moneda="USD" titulo={`${c.rotulo} · en dólares`} decimales={0} />
              </span>
              <span className="text-[11px] leading-snug text-muted">{c.par.ars.valor === null && c.par.ars.motivo ? c.par.ars.motivo : c.nota}</span>
            </dd>
          </div>
        ))}
      </dl>
    </Tarjeta>
  )
}
