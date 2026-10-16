import type { Metadata } from 'next'
import { vistaFlujo } from '@/lib/vistas/flujo'
import type { VistaFlujo } from '@/lib/vistas/contratos-flujo'
import { ErrorVista } from '@/components/error-vista'
import { Encabezado } from '@/components/pantalla/encabezado'
import { Rotulo, Tarjeta } from '@/components/ui'
import { lecturaFlujo } from './_lib/lectura'
import { CascadaMes } from './_componentes/cascada'
import { Cargados } from './_componentes/cargados'
import { Escenarios, PREGUNTA_FLUJO } from './_componentes/escenarios'
import { PagoVencimiento } from './_componentes/pago-vencimiento'
import { RealContraProyectado } from './_componentes/real'
import { Recurrentes } from './_componentes/recurrentes'
import { AccionesCargar, FaltanDatos, SeccionCalendario, SeccionMes } from './_componentes/secciones'

// Flujo y escenarios (rediseño del 15/10, D-157 y D-164 a D-166; handoff
// "Portfolio UI", captura 10): ¿cuánto me sobra por mes y adónde me lleva?
// Arriba, lo del diseño: la lectura, la cascada del mes (con lo declarado, sin
// supuestos) y el patrimonio en dólares del escenario elegido. Debajo, tus
// supuestos, una barra por variable, todos en Igual al abrir. La proyección
// corre en el navegador sobre la base serializada, con los supuestos en la URL
// (?s=). Nada proyectado se guarda. Abajo, el detalle de siempre: la
// proyección mes a mes, tus escenarios, el mes en curso (con Cargar ingreso y
// Cargar gasto), el calendario, proyectado contra real, lo que cargaste y tus
// ingresos y gastos declarados.

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Flujo y escenarios' }

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

/** El detalle que no depende del escenario: se arma en el servidor. */
function Detalle({ v }: { v: VistaFlujo }) {
  return (
    <>
      {v.mes_actual ? <SeccionMes m={v.mes_actual} pagador={v.pagador_declarado} datos={{ fecha: v.fecha_datos, ccl: v.ccl, cripto: v.cripto }} /> : null}
      {v.calendario.length ? <SeccionCalendario meses={v.calendario} /> : null}
      {v.cerrados.length ? <RealContraProyectado meses={v.cerrados} /> : null}
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-2">
        <Tarjeta className="flex min-w-0 flex-col gap-3 p-5" aria-labelledby="titulo-cargados">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <Rotulo id="titulo-cargados">Lo que cargaste</Rotulo>
            {/* Sin el mes en curso (sin cargas), Cargar ingreso y Cargar gasto van acá. */}
            {v.mes_actual ? null : <AccionesCargar />}
          </div>
          <p className="text-[13px] text-muted">Los ingresos y gastos que cargaste con «Cargar ingreso» y «Cargar gasto».</p>
          <Cargados filas={v.cargados} />
        </Tarjeta>
        <div id="ingresos-y-gastos" className="min-w-0 scroll-mt-24">
          <Tarjeta className="flex min-w-0 flex-col gap-3 p-5" aria-labelledby="titulo-recurrentes">
            <Rotulo id="titulo-recurrentes">Tus ingresos y gastos declarados</Rotulo>
            <p className="text-[13px] text-muted">Lo que entra y sale todos los meses (o cada tanto), con desde cuándo vale. De acá sale lo «declarado» del mes y de la proyección.</p>
            <Recurrentes filas={v.recurrentes} hoy={v.hoy} />
          </Tarjeta>
        </div>
      </div>
      {v.sin_cronograma.length ? (
        <Tarjeta className="flex min-w-0 flex-col gap-3 p-5" aria-labelledby="titulo-pagos">
          <Rotulo id="titulo-pagos">Pagos al vencimiento que faltan</Rotulo>
          <p className="text-[13px] text-muted">Sin el pago por VN, lo que cobrás al vencimiento es sin dato y la proyección no puede seguir tus letras.</p>
          <div className="space-y-3">
            {v.sin_cronograma.map((b) => (
              <PagoVencimiento key={b.activo_id} bono={b} ccl={v.base?.ccl ?? null} />
            ))}
          </div>
        </Tarjeta>
      ) : null}
    </>
  )
}

export default async function PaginaFlujo({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  let v: VistaFlujo
  try {
    v = await vistaFlujo(uno(sp.demo))
  } catch (e) {
    return (
      <>
        <h1 className="sr-only">Flujo y escenarios</h1>
        <ErrorVista error={e} que="tu flujo" />
      </>
    )
  }

  // "Ajustar supuestos" desde Evolución trae el escenario guardado que se mostraba (?e=): se abre como tal.
  const idAbierto = Number(uno(sp.e))
  const guardado = Number.isInteger(idAbierto) && idAbierto > 0 ? v.escenarios.find((x) => x.id === idAbierto && !x.archivado) : undefined
  const abiertoInicial = guardado ? { id: guardado.id, nombre: guardado.nombre } : null
  const faltan = <FaltanDatos items={v.faltan_datos} />

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {v.base ? (
        <Escenarios
          base={v.base}
          inicial={v.supuestos_iniciales}
          sUrl={uno(sp.s) ?? null}
          escenarios={v.escenarios}
          recordados={v.recordados}
          reintegroDeclarado={v.reintegro_declarado}
          pagadorDeclarado={v.pagador_declarado}
          mes={v.mes_actual}
          arriba={faltan}
          detalle={<Detalle v={v} />}
          abiertoInicial={abiertoInicial}
        />
      ) : (
        <>
          {/* Sin cargas no hay de dónde proyectar: la lectura lo dice y los bloques del diseño quedan, con lo que falta. */}
          <Encabezado pregunta={PREGUNTA_FLUJO} lectura={lecturaFlujo({ mes: null, proy: null, escenario: { tipo: 'igual' } })} />
          {faltan}
          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
            <CascadaMes mes={null} />
            <Tarjeta className="flex min-w-0 flex-col gap-3 p-5" aria-labelledby="titulo-patrimonio-usd">
              <Rotulo id="titulo-patrimonio-usd">Patrimonio financiero en dólares</Rotulo>
              <p className="text-[13px] text-muted">
                <span className="italic">sin dato</span> · la proyección arranca de tu última carga, y todavía no hay ninguna.
              </p>
            </Tarjeta>
          </div>
          <h2 className="eyebrow mt-2">El detalle</h2>
          <Detalle v={v} />
        </>
      )}
    </div>
  )
}
