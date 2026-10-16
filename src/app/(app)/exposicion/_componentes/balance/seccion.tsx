import Link from 'next/link'
import { numero } from '@/lib/domain/dinero'
import { fechaCorta, fechaLarga } from '@/lib/domain/fechas'
import type { VistaBalance } from '@/lib/vistas/contratos-balance'
import { SinDato, TextoConMontos } from '@/components/monto'
import { Traza } from '@/components/traza'
import { Aviso, Boton, Tarjeta } from '@/components/ui'
import { detalleFrase, partesMostradas } from '../../_lib/balance/frase'
import { rutaExposicion } from '../../_lib/rutas'
import { Comparativo } from './comparativo'
import { Composicion } from './composicion'
import { Controles } from './controles'
import { EstadoSituacion } from './estado'
import { Evolucion } from './evolucion'
import { FraseBalance } from './frase-balance'
import { Indicadores } from './indicadores'
import { TarjetaActivo, TarjetaPasivo, Titular } from './tarjetas'

// "El detalle: tu balance" (D-156): el estado de situación patrimonial que
// pediste el 14/10, dentro de Exposición. Todo lo que tenía la pantalla
// Balance: la fecha (cualquier fecha de carga), cómo ver lo financiero, la
// cifra grande con el origen de la deuda, el activo y el pasivo, el estado de
// situación (en la Grilla), los indicadores, el comparativo, la composición, la
// evolución y la impresión en A4. Al imprimir sale solo esto (impresion.css).

const fechaConAnio = (f: string) => `${fechaCorta(f)}/${f.slice(0, 4)}`

export function SeccionBalance({ v, demo, vista }: { v: VistaBalance; demo: string | null; vista: string | null }) {
  if (v.estado === 'sin_cargas' || !v.fecha) return <SinCargas />
  const firme = v.neto.lineas.find((l) => l.clave === 'sin_financiados')?.nombre ?? null
  return (
    <section data-imprimible="balance" aria-labelledby="detalle-balance" className="flex min-w-0 flex-col gap-3 md:gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-t border-border pt-5 print:border-0 print:pt-0">
        <div className="min-w-0">
          <h2 id="detalle-balance" className="text-[15px] font-medium print:text-lg">
            El detalle: tu balance
          </h2>
          <p className="mt-0.5 text-[13px] leading-5 text-muted" data-fecha-balance>
            <span className="text-text">Balance al {fechaConAnio(v.fecha)}</span> · estado de situación patrimonial · CCL{' '}
            <Traza calc={v.ccl} titulo="CCL del balance">
              {v.ccl.valor === null ? <SinDato motivo={v.ccl.motivo} /> : <span className="num">{numero(v.ccl.valor, 2)}</span>}
            </Traza>{' '}
            {v.ccl_fuente}
            <span className="print:hidden"> · tocá una cifra para ver de dónde sale</span>
          </p>
        </div>
        <Controles
          fechas={v.fechas}
          fecha={v.fecha}
          agrupar={v.agrupar}
          comparar={v.comparativo && v.comparativo.fecha !== v.comparativo.por_defecto ? v.comparativo.fecha : null}
          demo={demo}
          vista={vista}
        />
      </div>

      {!v.ultima ? (
        <Aviso className="print:hidden">
          Es el balance al {fechaCorta(v.fecha)}, con los datos que tenías ese día; lo de arriba es de hoy.{' '}
          <Link href={rutaExposicion({ vista, agrupar: v.agrupar, demo })} scroll={false} className="tocable inline-flex items-center font-medium text-accent hover:underline">
            Ver el último
          </Link>
        </Aviso>
      ) : null}

      <Tarjeta className="p-4 md:p-5" aria-label="El balance en una frase">
        <FraseBalance partes={partesMostradas(v.frase)} detalle={detalleFrase(v.frase)} />
      </Tarjeta>

      {/* Al imprimir, las tarjetas no van: lo mismo está en el estado de situación, que es lo que lee el contador. */}
      <div className="grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3 print:hidden">
        <div className="md:col-span-2 xl:col-span-1">
          <Titular v={v} />
        </div>
        <TarjetaActivo v={v} />
        <TarjetaPasivo v={v} />
      </div>

      <EstadoSituacion v={v} />

      <Indicadores xs={v.indicadores} />

      <Comparativo c={v.comparativo} fecha={v.fecha} demo={demo} ruta={{ fecha: v.ultima ? null : v.fecha, agrupar: v.agrupar, vista }} />

      <Composicion comp={v.composicion} hayBienes={v.activo.bienes.length > 0} />
      <Evolucion serie={v.serie} rotuloFirme={firme} />

      <PieImpresion v={v} />
    </section>
  )
}

function SinCargas() {
  return (
    <section aria-labelledby="detalle-balance" className="flex flex-col gap-3 border-t border-border pt-5">
      <h2 id="detalle-balance" className="text-[15px] font-medium">
        El detalle: tu balance
      </h2>
      <Tarjeta className="p-4 md:p-5">
        <p className="text-[15px] leading-6">Todavía no hay cargas: el balance se arma con tu primera carga y tus bienes.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Boton href="/carga" tam="sm">
            Hacer la primera carga
          </Boton>
          <Boton href="/datos/bienes" variante="contorno" tam="sm">
            Cargar tus bienes en Datos
          </Boton>
        </div>
      </Tarjeta>
    </section>
  )
}

/** Solo al imprimir: de dónde sale cada cosa, para el contador. */
function PieImpresion({ v }: { v: VistaBalance }) {
  const deuda = v.pasivo.filas.find((f) => f.bien)
  return (
    <div className="hidden text-[10px] leading-4 text-muted print:block">
      <p>
        Estado de situación patrimonial al {v.fecha ? fechaLarga(v.fecha) : '—'}. Montos en pesos y en dólares, pasados al CCL{' '}
        {v.ccl.valor === null ? 'sin dato' : numero(v.ccl.valor, 2)} ({v.ccl_fuente}). Hecho con tu app el {fechaLarga(v.hoy)}.
      </p>
      {deuda ? (
        <p>
          {deuda.nombre}: <TextoConMontos texto={`${deuda.detalle}${deuda.fuente ? ` (${deuda.fuente})` : ''}`} />. Lo que falta pagar según contrato no es la deuda: incluye intereses, IVA y seguro, y no se resta.
        </p>
      ) : null}
      <p>
        Etiquetas: «estimado», un cálculo y no un dato del acreedor; «parcial», falta una parte; «viejo», un dato de más de 2 días hábiles; «provisoria», la deuda estimada que aprobaste. Un bien
        financiado y su deuda entran juntos; nunca se suma el bien sin su deuda.
      </p>
    </div>
  )
}
