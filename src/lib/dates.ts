// `pg` parsea las columnas `date` y `timestamptz` a objetos Date de JS.
// Hacerles String() y cortar 10 caracteres da "Wed Jun 30", no "2027-06-30",
// y eso despues explota como Invalid Date. La conversion va acá, una sola vez.

/** Columna `date` -> "YYYY-MM-DD". */
export function toIsoDate(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    // Componentes locales, no toISOString(): `pg` construye la fecha a
    // medianoche local, y en un server al oeste de UTC el ISO retrocede un día.
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** Columna `timestamptz` -> ISO completo. */
export function toIsoTimestamp(v: unknown): string {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : v.toISOString();
  return v == null ? '' : String(v);
}
