// El estado de situación patrimonial como filas de la Grilla (D-157): ACTIVO
// (lo financiero agrupado y los bienes), PASIVO (cada deuda con su origen y, si
// financia un bien, lo que falta pagar según contrato) y PATRIMONIO NETO, en el
// orden en que lo lee un contador. Función pura, con test: solo ordena lo que
// la vista ya trae calculado y trazado; la tabla impresa y las tarjetas del
// teléfono siguen el mismo orden.

import type { CalcVista } from '@/lib/domain/calc'
import type { Par } from '@/lib/vistas/contratos'
import type { Accion, FilaBalance, FilaPasivo, VistaBalance } from '@/lib/vistas/contratos-balance'

export type SeccionEstado = 'activo' | 'pasivo' | 'neto'

interface Base {
  clave: string
  seccion: SeccionEstado
}

export type FilaEstado =
  | (Base & { tipo: 'seccion'; nombre: string })
  | (Base & { tipo: 'total'; nombre: string; detalle: string | null; valor: Par; peso: CalcVista; pct: string | null; nivel: 0 | 1; fuerte: boolean })
  | (Base & { tipo: 'partida'; fila: FilaBalance; nivel: 1 | 2; conCuenta: boolean })
  | (Base & { tipo: 'deuda'; fila: FilaPasivo })
  | (Base & { tipo: 'referencia'; fila: FilaPasivo })
  | (Base & { tipo: 'nota'; texto: string; accion: Accion | null })

export const POR: Record<VistaBalance['agrupar'], string> = { cuenta: 'por cuenta', instrumento: 'por instrumento', clase: 'por clase' }

export function filasEstado(v: Pick<VistaBalance, 'activo' | 'pasivo' | 'neto' | 'agrupar'>): FilaEstado[] {
  const a = v.activo
  const out: FilaEstado[] = []
  const conCuenta = v.agrupar !== 'cuenta'

  out.push({ tipo: 'seccion', clave: 's:activo', seccion: 'activo', nombre: 'Activo' })
  out.push({
    tipo: 'total',
    clave: 't:financiero',
    seccion: 'activo',
    nombre: 'Financiero',
    detalle: `títulos y liquidez de tus cuentas, ${POR[v.agrupar]}`,
    valor: a.financiero,
    peso: a.financiero_peso,
    pct: a.financiero_pct,
    nivel: 0,
    fuerte: true,
  })
  for (const g of a.grupos) {
    // Por instrumento o por clase, un grupo de una sola partida va directo (sin subtotal que repita lo mismo).
    if (g.filas.length === 1 && v.agrupar !== 'cuenta') {
      out.push({ tipo: 'partida', clave: `p:${g.clave}:${g.filas[0].clave}`, seccion: 'activo', fila: g.filas[0], nivel: 1, conCuenta })
      continue
    }
    out.push({ tipo: 'total', clave: `g:${g.clave}`, seccion: 'activo', nombre: g.nombre, detalle: null, valor: g.total, peso: g.peso, pct: g.pct, nivel: 1, fuerte: false })
    for (const f of g.filas) out.push({ tipo: 'partida', clave: `p:${g.clave}:${f.clave}`, seccion: 'activo', fila: f, nivel: 2, conCuenta })
  }
  if (a.bienes.length) {
    out.push({ tipo: 'total', clave: 't:bienes', seccion: 'activo', nombre: 'Bienes', detalle: 'cada uno a su última valuación, con su fuente', valor: a.bienes_total, peso: a.bienes_peso, pct: a.bienes_pct, nivel: 0, fuerte: true })
    for (const b of a.bienes) out.push({ tipo: 'partida', clave: `b:${b.clave}`, seccion: 'activo', fila: b, nivel: 1, conCuenta: false })
  } else {
    out.push({ tipo: 'nota', clave: 'n:bienes', seccion: 'activo', texto: 'Bienes: todavía no cargaste la casa ni el auto.', accion: { etiqueta: 'Cargar tus bienes', href: '/datos/bienes' } })
  }
  out.push({ tipo: 'total', clave: 't:activo', seccion: 'activo', nombre: 'Total del activo', detalle: null, valor: a.total, peso: a.total_peso, pct: a.total_pct, nivel: 0, fuerte: true })

  out.push({ tipo: 'seccion', clave: 's:pasivo', seccion: 'pasivo', nombre: 'Pasivo' })
  if (v.pasivo.filas.length === 0) out.push({ tipo: 'nota', clave: 'n:pasivo', seccion: 'pasivo', texto: 'Sin deudas cargadas.', accion: null })
  for (const f of v.pasivo.filas) {
    out.push({ tipo: 'deuda', clave: `d:${f.clave}`, seccion: 'pasivo', fila: f })
    if (f.bien) out.push({ tipo: 'referencia', clave: `r:${f.clave}`, seccion: 'pasivo', fila: f })
  }
  out.push({ tipo: 'total', clave: 't:pasivo', seccion: 'pasivo', nombre: 'Total del pasivo', detalle: null, valor: v.pasivo.total, peso: v.pasivo.peso, pct: v.pasivo.pct, nivel: 0, fuerte: true })

  out.push({ tipo: 'seccion', clave: 's:neto', seccion: 'neto', nombre: 'Patrimonio neto' })
  for (const l of v.neto.lineas) {
    out.push({ tipo: 'total', clave: `l:${l.clave}`, seccion: 'neto', nombre: l.nombre, detalle: l.detalle, valor: l.valor, peso: l.peso, pct: l.pct, nivel: l.principal ? 0 : 1, fuerte: l.principal })
  }
  return out
}

/** El nombre de una fila (el botón de la ficha y su título). */
export function nombreFilaEstado(f: FilaEstado): string {
  switch (f.tipo) {
    case 'seccion':
    case 'total':
      return f.nombre
    case 'partida':
    case 'deuda':
      return f.fila.nombre
    case 'referencia':
      return 'Lo que falta pagar según contrato'
    case 'nota':
      return f.texto
  }
}
