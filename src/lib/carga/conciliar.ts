// STUB — lo implementa el motor (conciliación D-14, D-15, D-19).
import type { Decimal } from '@/lib/domain/dinero'
import type { Fecha, Hechos } from '@/lib/domain/tipos'
import type { LecturaCuenta, PropuestaCarga } from './contratos'

export function proponerCarga(
  _lecturas: LecturaCuenta[],
  _hechos: Hechos,
  _fecha: Fecha,
  _tc: { ccl: Decimal | null },
): PropuestaCarga {
  throw new Error('proponerCarga: no implementado')
}
