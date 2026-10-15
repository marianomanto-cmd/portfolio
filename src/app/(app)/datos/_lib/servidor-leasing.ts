import 'server-only'

// Lo que Datos › Leasing suma en la entrega 4: el cuadro de marcha de cada
// pasivo, su deuda según el cuadro, la tasa y los datos nuevos del contrato.
// Lee lo mismo que Pasivos (leerHechos + leerPasivos). En modo demo, el ejemplo
// inventado de Pasivos, así las dos pantallas cuentan lo mismo.

import { createHash } from 'node:crypto'
import { leerCuadroMarcha, revisarCuadro, type RevisionCuadro } from '@/lib/carga/cuadro-marcha'
import type { CalcVista } from '@/lib/domain/calc'
import { totalCuota } from '@/lib/domain/pasivos/cuadro'
import type { ContratoPasivo, Cuota, HechosPasivos } from '@/lib/domain/pasivos/tipos'
import { vista } from '@/lib/domain/calc'
import type { Fecha } from '@/lib/domain/tipos'
import { hoyCordoba } from '@/lib/domain/fechas'
import { leerHechos } from '@/lib/server/hechos'
import { leerPasivos } from '@/lib/server/hechos-pasivos'
import { modoDemo } from '@/lib/server/sesion'
import { armarPasivos } from '@/lib/vistas/armar-pasivos'
import type { CargoVista, Par } from '@/lib/vistas/contratos-pasivos'
import { HOY_PASIVOS, csvDeEjemplo, hechosEjemploPasivos, hechosEjemploRevision, variantePasivos } from '@/lib/vistas/ejemplo-pasivos'
import type { CCL, SaldoPasivo } from './calculos'
import type { PasivoFila } from './servidor'

export interface CuotaResumen {
  nro: number
  fecha_vencimiento: Fecha
  estado: 'facturada' | 'proyectada'
  pagada: boolean
  fecha_pago: Fecha | null
  ccl: string | null
  ccl_fuente: string | null
  pagador: 'titular' | 'empresa' | null
  total: CalcVista
}

export interface ExtraPasivo {
  segun_cuadro: Par
  tea: CalcVista
  fecha_desembolso: Fecha | null
  pagador_habitual: 'titular' | 'empresa' | null
  reintegra_iva: boolean | null
  faltan_para_tasa: string[]
  cuotas: CuotaResumen[]
  cargadas: number
  cargos: CargoVista[]
}

/** Una revisión ya hecha (el demo ?demo=revision la muestra abierta). */
export interface RevisionAbierta {
  pasivo_id: number
  nombre: string
  texto: string
  sha256: string
  revision: RevisionCuadro
}

export interface DatosLeasing {
  porPasivo: Record<number, ExtraPasivo>
  /**
   * En demo, el contrato y la deuda del ejemplo de Pasivos (reemplazan a los
   * del ejemplo de Datos), el estado pedido, la planilla de ejemplo para
   * probar la importación y, con ?demo=revision, la revisión abierta.
   */
  demo: { pasivos: PasivoFila[]; saldos: SaldoPasivo[]; ccl: CCL | null; variante: string; csv: string; revision: RevisionAbierta | null } | null
}

/** Los estados demo de Datos › Leasing: los de Pasivos más la revisión abierta. */
export function varianteLeasing(demo: unknown): string {
  return demo === 'revision' ? 'revision' : variantePasivos(demo === undefined ? 'cuadro' : demo)
}

function resumenCuota(c: Cuota): CuotaResumen {
  return {
    nro: c.nro,
    fecha_vencimiento: c.fecha_vencimiento,
    estado: c.estado,
    pagada: c.pagada,
    fecha_pago: c.fecha_pago,
    ccl: c.ccl_del_dia_pago?.toFixed() ?? null,
    ccl_fuente: c.ccl_fuente,
    pagador: c.pagador,
    total: vista(totalCuota(c)),
  }
}

function aFila(c: ContratoPasivo): PasivoFila {
  return {
    id: c.id,
    nombre: c.nombre,
    tipo: c.tipo,
    moneda: c.moneda,
    fecha_inicio: c.fecha_inicio,
    cuotas_totales: c.cuotas_totales,
    monto_financiado_neto: c.monto_financiado_neto?.toFixed() ?? null,
    anticipo_neto: c.anticipo_neto?.toFixed() ?? null,
    opcion_compra_neto: c.opcion_compra_neto?.toFixed() ?? null,
    opcion_compra_fecha: c.opcion_compra_fecha,
    valor_bien: c.valor_bien?.toFixed() ?? null,
    notas: c.notas,
  }
}

/** El último CCL de los hechos (el del ejemplo, en demo), como lo muestra Datos. */
function ultimoCcl(h: Awaited<ReturnType<typeof leerHechos>>): CCL | null {
  const t = [...h.tipos_cambio].filter((x) => x.ccl !== null).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0]
  return t?.ccl ? { fecha: t.fecha, valor: t.ccl.toFixed() } : null
}

/** Los hechos de Pasivos del demo (el estado pedido) o de la base. */
export async function hechosLeasing(demo?: unknown): Promise<{ hp: HechosPasivos; h: Awaited<ReturnType<typeof leerHechos>>; hoy: Fecha; esDemo: boolean }> {
  if (modoDemo()) {
    if (varianteLeasing(demo) === 'revision') {
      const { h, hp } = hechosEjemploRevision()
      return { h, hp, hoy: HOY_PASIVOS, esDemo: true }
    }
    const { h, hp } = hechosEjemploPasivos(variantePasivos(demo === undefined ? 'cuadro' : demo))
    return { h, hp, hoy: HOY_PASIVOS, esDemo: true }
  }
  const [h, hp] = await Promise.all([leerHechos(), leerPasivos()])
  return { h, hp, hoy: hoyCordoba(), esDemo: false }
}

export async function leerDatosLeasing(demo?: unknown): Promise<DatosLeasing> {
  const { h, hp, hoy, esDemo } = await hechosLeasing(demo)
  const v = armarPasivos(h, hp, hoy)
  const porPasivo: Record<number, ExtraPasivo> = {}
  for (const l of v.leasings) {
    const c = hp.contratos.find((x) => x.id === l.contrato.id) as ContratoPasivo
    const cuotas = hp.cuotas.filter((x) => x.pasivo_id === c.id).sort((a, b) => a.nro - b.nro)
    porPasivo[c.id] = {
      segun_cuadro: l.deuda.segun_cuadro,
      tea: l.tea,
      fecha_desembolso: c.fecha_desembolso,
      pagador_habitual: c.pagador_habitual,
      reintegra_iva: c.reintegra_iva,
      faltan_para_tasa: l.contrato.faltan_para_tasa,
      cuotas: cuotas.map(resumenCuota),
      cargadas: cuotas.length,
      cargos: l.cargos,
    }
  }
  const variante = varianteLeasing(demo)
  let revision: RevisionAbierta | null = null
  if (esDemo && variante === 'revision' && hp.contratos.length) {
    const { csv } = hechosEjemploRevision()
    const c = hp.contratos[0]
    const lectura = leerCuadroMarcha(csv, { cuotasTotales: c.cuotas_totales })
    revision = {
      pasivo_id: c.id,
      nombre: 'cuadro de marcha actualizado (ejemplo).csv',
      texto: csv,
      sha256: createHash('sha256').update(csv, 'utf8').digest('hex'),
      revision: revisarCuadro(lectura, c, hp.cuotas.filter((x) => x.pasivo_id === c.id)),
    }
  }
  return {
    porPasivo,
    demo: esDemo
      ? {
          variante,
          csv: csvDeEjemplo(),
          ccl: ultimoCcl(h),
          revision,
          pasivos: hp.contratos.map(aFila),
          saldos: h.pasivo_saldos.map((s) => ({
            pasivo_id: s.pasivo_id,
            fecha: s.fecha,
            capital_pendiente: s.capital_pendiente.toFixed(),
            naturaleza: s.naturaleza,
            fuente: s.fuente,
            carga_id: s.carga_id,
          })),
        }
      : null,
  }
}
