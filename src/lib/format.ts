const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

const usd = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const plain = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

const int0 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

export const fmtArs = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? 'n/d' : ars.format(n);

export const fmtUsd = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? 'n/d' : usd.format(n);

export const fmtNum = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? 'n/d' : plain.format(n);

/** Entero sin símbolo: para cifras en espacios angostos, con la unidad aparte. */
export const fmtInt = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? 'n/d' : int0.format(n);

export const fmtPct = (n: number | null | undefined, digits = 1) =>
  n == null || !Number.isFinite(n) ? 'n/d' : `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;

export function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return 'n/d';
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return 'n/d';
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}
