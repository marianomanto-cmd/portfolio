// Las piezas de la pantalla Pasivos que no son gráficos (rediseño del 15/10,
// D-157 y D-162; handoff "Portfolio UI", capturas 08 y 09): la lectura, la
// tira de cuotas, las cuatro cifras y las próximas cuotas. Funciones puras
// sobre la vista, con test (pantalla.test.ts): las páginas solo dibujan. Lo
// que falta se dice con palabras, nunca con un cero, y ninguna cifra se arma
// acá: todas vienen de la vista con su traza.

import { sinDato, vista, type CalcVista } from '@/lib/domain/calc'
import { Decimal } from '@/lib/domain/dinero'
import { fechaLarga } from '@/lib/domain/fechas'
import type { Fecha } from '@/lib/domain/tipos'
import type { FilaCuota, Par, VistaLeasing, VistaPasivos } from '@/lib/vistas/contratos-pasivos'
import { enfasis, texto, type ParteLectura } from '@/components/pantalla/lectura'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "1 de noviembre"; con otro año que el de `hoy`, "1 de julio de 2028". */
export function fechaEnPalabras(f: Fecha, hoy?: Fecha): string {
  const [a, m, d] = f.split('-')
  const base = `${Number(d)} de ${MESES[Number(m) - 1]}`
  return hoy && hoy.slice(0, 4) === a ? base : `${base} de ${a}`
}

/** "15", "15 y 16", "15, 16 y 17". */
function enLista(xs: readonly (string | number)[]): string {
  const t = xs.map(String)
  return t.length <= 1 ? (t[0] ?? '') : `${t.slice(0, -1).join(', ')} y ${t[t.length - 1]}`
}

/** Las cuotas que ya vencieron y la planilla no marca pagadas (pueden estar pagadas y la planilla no estar al día). */
export function vencidasSinPagar(l: Pick<VistaLeasing, 'cuotas' | 'hoy'>): FilaCuota[] {
  return l.cuotas.filter((c) => !c.pagada && c.fecha_vencimiento < l.hoy)
}

/**
 * Cómo cambió la cuota en dólares entre las pagadas que tienen el CCL de su
 * pago (las demás no se cuentan: sin ese CCL, en dólares es sin dato).
 * - 'cada_vez_menos': cada una costó menos (o igual) que la anterior, y alguna menos;
 * - 'menos' / 'mas' / 'igual': la última contra la primera;
 * - null: menos de dos cuotas con su CCL.
 */
export function tendenciaUsd(cuotas: readonly FilaCuota[]): { tipo: 'cada_vez_menos' | 'menos' | 'mas' | 'igual'; cuotas: number } | null {
  const con = cuotas
    .filter((c) => c.pagada && c.total_usd.valor !== null)
    .sort((a, b) => a.nro - b.nro)
    .map((c) => new Decimal(c.total_usd.valor as string))
  if (con.length < 2) return null
  let siempreBaja = true
  let algunaBaja = false
  for (let i = 1; i < con.length; i++) {
    if (con[i].gt(con[i - 1])) siempreBaja = false
    if (con[i].lt(con[i - 1])) algunaBaja = true
  }
  const primera = con[0]
  const ultima = con[con.length - 1]
  if (siempreBaja && algunaBaja) return { tipo: 'cada_vez_menos', cuotas: con.length }
  return { tipo: ultima.lt(primera) ? 'menos' : ultima.gt(primera) ? 'mas' : 'igual', cuotas: con.length }
}

/**
 * La lectura de Pasivos (anatomía 2): cuántas cuotas pagaste y, en el orden
 * en que importa, una cuota vencida sin pagar, cómo cambió la cuota en dólares
 * (solo con el CCL de cada pago) o cuántas faltan. Un solo énfasis.
 *   "Pagaste 14 de 35 cuotas. Cada una te costó *menos* dólares que la anterior."
 */
export function lecturaPasivos(v: Pick<VistaPasivos, 'leasings'>): ParteLectura[] {
  const l = v.leasings[0]
  if (!l) return [texto('Todavía no cargaste ningún '), enfasis('pasivo'), texto(': el leasing se carga en Datos › Leasing.')]
  const otros = v.leasings.length > 1 ? `Tenés ${v.leasings.length} pasivos; el primero, ${l.contrato.nombre}. ` : ''
  if (!l.cuotas.length) return [texto(`${otros}Del leasing todavía no importaste el `), enfasis('cuadro de marcha'), texto(': con la planilla de cuotas ves cuánto pagaste y cuánto falta.')]
  const total = Math.max(l.contrato.cuotas_totales, l.cuotas.length)
  const pagadas = l.tarjetas.pagadas
  const impagas = l.cuotas.filter((c) => !c.pagada)
  if (pagadas >= total && !impagas.length) {
    return l.opcion.fecha
      ? [texto(`${otros}Pagaste las ${total} cuotas: queda la `), enfasis('opción de compra'), texto(`, el ${fechaEnPalabras(l.opcion.fecha, l.hoy)}.`)]
      : [texto(`${otros}Pagaste las ${total} cuotas: no falta `), enfasis('ninguna'), texto('.')]
  }
  const inicio = texto(`${otros}Pagaste ${pagadas} de ${total} cuotas. `)
  const vencidas = vencidasSinPagar(l)
  if (vencidas.length === 1) return [inicio, texto(`La ${vencidas[0].nro} `), enfasis('venció'), texto(' y tu planilla no la marca pagada.')]
  if (vencidas.length > 1) return [inicio, texto(`Las ${enLista(vencidas.map((c) => c.nro))} `), enfasis('vencieron'), texto(' y tu planilla no las marca pagadas.')]
  const t = tendenciaUsd(l.cuotas)
  if (t?.tipo === 'cada_vez_menos') return [inicio, texto('Cada una te costó '), enfasis('menos'), texto(' dólares que la anterior.')]
  if (t) {
    const palabra = t.tipo === 'menos' ? 'menos' : t.tipo === 'mas' ? 'más' : 'lo mismo'
    return [inicio, texto('En dólares, la última te costó '), enfasis(palabra), texto(' que la primera.')]
  }
  const ultima = impagas[impagas.length - 1]
  return [inicio, texto('Te faltan '), enfasis(String(impagas.length)), texto(`, hasta el ${fechaEnPalabras(ultima.fecha_vencimiento, l.hoy)}.`)]
}

export type EstadoCelda = 'pagada' | 'proxima' | 'pendiente' | 'vencida' | 'sin_dato'

export interface CeldaTira {
  nro: number
  estado: EstadoCelda
  /** El tooltip y el nombre accesible: "Cuota 15 · vence el 01/11/2026 · la próxima". */
  titulo: string
}

export interface Tira {
  /** "Leasing de la camioneta · 35 cuotas". */
  rotulo: string
  /** "Próxima: cuota 15 · 1 de noviembre"; null si no queda ninguna. */
  proxima: string | null
  celdas: CeldaTira[]
  /** Lo mismo en una frase, para el lector de pantalla. */
  resumen: string
  /** Lo que la tira no dice sola, a la vista: las cuotas que el cuadro no trae. null si las trae todas. */
  nota: string | null
}

const ESTADO_TEXTO: Record<EstadoCelda, string> = {
  pagada: 'pagada',
  proxima: 'la próxima',
  pendiente: 'por pagar',
  vencida: 'vencida y tu planilla no la marca pagada',
  sin_dato: 'no está en el cuadro de marcha',
}

/**
 * La tira de cuotas (handoff, captura 08): una celda por cuota del contrato,
 * con la cantidad que dice el contrato (o las del cuadro, si trae más). Las
 * pagadas en tinta, la próxima en sangría, las que faltan en hueco; una que
 * venció sin pagar y una que el cuadro no trae se distinguen (nunca se
 * dibujan como pagadas).
 */
export function tiraCuotas(l: Pick<VistaLeasing, 'contrato' | 'cuotas' | 'tarjetas' | 'hoy'>): Tira {
  const total = Math.max(l.contrato.cuotas_totales, l.cuotas.reduce((a, c) => Math.max(a, c.nro), 0))
  const porNro = new Map(l.cuotas.map((c) => [c.nro, c]))
  const proxima = l.tarjetas.proxima?.nro ?? null
  const celdas: CeldaTira[] = []
  for (let nro = 1; nro <= total; nro++) {
    const c = porNro.get(nro)
    const estado: EstadoCelda = !c ? 'sin_dato' : c.pagada ? 'pagada' : nro === proxima ? 'proxima' : c.fecha_vencimiento < l.hoy ? 'vencida' : 'pendiente'
    celdas.push({ nro, estado, titulo: `Cuota ${nro}${c ? ` · vence el ${fechaLarga(c.fecha_vencimiento)}` : ''} · ${ESTADO_TEXTO[estado]}` })
  }
  const p = l.tarjetas.proxima
  const vencidas = celdas.filter((c) => c.estado === 'vencida').length
  const faltan = celdas.filter((c) => c.estado === 'sin_dato').length
  return {
    rotulo: `${l.contrato.nombre} · ${total} cuotas`,
    proxima: p ? `Próxima: cuota ${p.nro} · ${fechaEnPalabras(p.fecha, l.hoy)}` : null,
    celdas,
    resumen: [
      `${l.tarjetas.pagadas} de ${total} cuotas pagadas`,
      p ? `la próxima, la ${p.nro}, el ${fechaLarga(p.fecha)}` : 'no queda ninguna por pagar',
      vencidas ? `${vencidas} vencida${vencidas > 1 ? 's' : ''} sin pagar según tu planilla` : null,
      faltan ? `${faltan} que el cuadro de marcha no trae` : null,
    ]
      .filter(Boolean)
      .join('; '),
    nota: !faltan
      ? null
      : faltan === total
        ? `Todavía no importaste el cuadro de marcha: las ${total} cuotas van punteadas hasta que lo importes en Datos › Leasing.`
        : `El cuadro de marcha trae ${total - faltan} de ${total} cuotas: ${faltan === 1 ? 'la que falta va punteada' : `las ${faltan} que faltan van punteadas`}. Importá la planilla completa en Datos › Leasing.`,
  }
}

export interface CifraPasivo {
  clave: 'saldo' | 'pagado' | 'falta' | 'opcion'
  rotulo: string
  par: Par
  nota: string
  /** El saldo de capital va en sangría clara (deuda, handoff). */
  deuda?: boolean
}

const sinDatoPar = (motivo: string): Par => {
  const c: CalcVista = vista(sinDato(motivo))
  return { ars: c, usd: c }
}

/**
 * Las cuatro cifras de debajo de la tira (handoff): el saldo de capital (la
 * deuda que cuenta, en el orden de D-131: la informada › la según el cuadro ›
 * la estimada), lo pagado (en dólares, al CCL de cada pago), lo que falta
 * (nominal; en dólares, al CCL de hoy, D-163) y la opción de compra. La nota
 * de cada una es corta, como en el diseño ("Al CCL de hoy", "Al CCL de cada
 * pago", "Al final del contrato"), y dice de dónde sale el saldo: el detalle
 * de la deuda está abajo, en "La deuda, con su origen".
 */
export function cifrasPasivo(l: VistaLeasing): CifraPasivo[] {
  const d = l.deuda
  let saldo: Par
  let notaSaldo: string
  if (d.vigente === 'informada' && d.informada) {
    saldo = d.informada.par
    notaSaldo = `La informó la leasera, al ${fechaLarga(d.informada.fecha)}. Al CCL de hoy.`
  } else if (d.vigente === 'segun_cuadro') {
    saldo = d.segun_cuadro
    notaSaldo = `Según el cuadro de marcha, al ${fechaLarga(d.al)}. Al CCL de hoy.`
  } else if (d.vigente === 'estimada' && d.estimada) {
    saldo = d.estimada.par
    notaSaldo = `La estimada que aprobaste, al ${fechaLarga(d.estimada.fecha)}. Al CCL de hoy.`
  } else {
    saldo = sinDatoPar('No hay valor de cancelación informado, ni cuadro de marcha con la tasa del contrato, ni un estimado: pedíselo a la leasera y cargalo en Datos › Leasing.')
    notaSaldo = 'Sin el valor de la leasera, sin cuadro con tasa y sin estimado.'
  }
  const t = l.tarjetas
  const pagadoSinUsd = l.totales.pagado.usd.valor === null
  // Sin cuadro de marcha no se sabe qué pagaste: sin dato, nunca una suma vacía que da cero.
  const sinCuadro = l.cuotas.length === 0
  return [
    { clave: 'saldo', rotulo: 'Saldo de capital', par: saldo, nota: notaSaldo, deuda: true },
    sinCuadro
      ? { clave: 'pagado', rotulo: 'Pagado', par: sinDatoPar('Sin el cuadro de marcha no se sabe cuánto pagaste: importalo en Datos › Leasing.'), nota: 'Sale del cuadro de marcha.' }
      : {
          clave: 'pagado',
          rotulo: `Pagado · ${t.pagadas} ${t.pagadas === 1 ? 'cuota' : 'cuotas'}`,
          par: l.totales.pagado,
          nota: pagadoSinUsd && t.pagadas > 0 ? 'Al CCL de cada pago: cargalos en Datos › Leasing.' : 'Al CCL de cada pago.',
        },
    {
      clave: 'falta',
      rotulo: `Falta · ${t.falta.cuotas} ${t.falta.cuotas === 1 ? 'cuota' : 'cuotas'}`,
      par: t.falta.total,
      nota: 'Nominal, sin la opción. Al CCL de hoy: una referencia.',
    },
    {
      clave: 'opcion',
      rotulo: 'Opción de compra',
      par: l.opcion.total,
      nota: l.opcion.fecha ? `Al final del contrato, el ${fechaLarga(l.opcion.fecha)}. Con IVA.` : 'Al final del contrato. Con IVA.',
    },
  ]
}

/**
 * ¿Alguna de estas cuotas trae un monto supuesto o a confirmar (sin factura
 * todavía, D-139)? Las próximas lo dicen una vez, abajo; cada cifra lo dice
 * en su traza.
 */
export function hayInciertas(cuotas: readonly Pick<FilaCuota, 'etiquetas'>[]): boolean {
  return cuotas.some((c) => c.etiquetas.includes('supuesto') || c.etiquetas.includes('a_confirmar'))
}

/**
 * La nota de debajo del gráfico de la cuota (handoff: "Punteado: …"): qué es
 * lo punteado y, si a alguna pagada le falta el CCL de su pago, que en
 * dólares es un hueco hasta que lo cargues (nunca un cero ni un CCL supuesto).
 */
export function notaCuota(cuotas: readonly Pick<FilaCuota, 'pagada' | 'total_usd'>[]): string {
  const pagadas = cuotas.filter((c) => c.pagada)
  const sinCcl = pagadas.filter((c) => c.total_usd.valor === null).length
  const punteado = 'Punteado: las que faltan, al CCL de hoy (una referencia, no una proyección del dólar).'
  if (!sinCcl) return pagadas.length ? `Sólido: las pagadas, al CCL de cada pago. ${punteado}` : punteado
  return sinCcl === pagadas.length
    ? `${punteado} Las pagadas, en dólares, sin dato hasta que cargues el CCL de cada pago en Datos › Leasing.`
    : `Sólido: las pagadas, al CCL de cada pago (${sinCcl === 1 ? 'a una le falta' : `a ${sinCcl} les falta`} y queda un hueco). ${punteado}`
}

/** Las próximas cuotas por pagar (el cuadro de marcha de la derecha, handoff): las primeras `n` impagas, en orden. */
export function proximasCuotas(cuotas: readonly FilaCuota[], n = 6): FilaCuota[] {
  return cuotas
    .filter((c) => !c.pagada)
    .sort((a, b) => a.nro - b.nro)
    .slice(0, n)
}

export type FiltroCuadro = 'por_pagar' | 'pagadas' | 'todas'

/** Las cuotas del cuadro de marcha completo según el filtro (por pagar, pagadas o todas), en orden. */
export function filtrarCuadro(cuotas: readonly FilaCuota[], filtro: FiltroCuadro): FilaCuota[] {
  const out = filtro === 'todas' ? [...cuotas] : cuotas.filter((c) => (filtro === 'pagadas' ? c.pagada : !c.pagada))
  return out.sort((a, b) => a.nro - b.nro)
}
