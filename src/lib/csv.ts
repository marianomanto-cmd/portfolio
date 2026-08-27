// Parseo de CSV local: sin modelo y sin red. Un CSV es tabular, no hace falta
// un LLM para leerlo — y así el resultado es reproducible.

import type { Instrument, Platform } from './types';
import type { ParsedRow } from './types';

/** Split de CSV que respeta comillas y detecta ; o , como separador. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const head = clean.slice(0, clean.indexOf('\n') === -1 ? clean.length : clean.indexOf('\n'));
  const sep = (head.match(/;/g)?.length ?? 0) > (head.match(/,/g)?.length ?? 0) ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; }
      } else cell += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === sep) { row.push(cell.trim()); cell = ''; continue; }
    if (ch === '\n') { row.push(cell.trim()); rows.push(row); row = []; cell = ''; continue; }
    cell += ch;
  }
  if (cell.length || row.length) { row.push(cell.trim()); rows.push(row); }

  return rows.filter((r) => r.some((c) => c !== ''));
}

/**
 * "$ 1.234.567,89" -> 1234567.89. Devuelve null si no hay número.
 *
 * El punto es ambiguo: en "980.000" separa miles, en "12.5" es decimal.
 * Regla para importes argentinos: un único punto con exactamente 3 dígitos
 * detrás es separador de miles; cualquier otra cantidad de dígitos es decimal.
 */
export function parseArsNumber(raw: string): number | null {
  if (!raw) return null;
  const negative = /-/.test(raw);
  let s = raw.replace(/[^\d.,]/g, '').trim();
  if (!s) return null;

  const dots = (s.match(/\./g) ?? []).length;
  const commas = (s.match(/,/g) ?? []).length;

  if (dots > 0 && commas > 0) {
    // Con ambos, el decimal es el que está más a la derecha.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (commas > 0) {
    s = commas > 1 ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (dots > 0) {
    const tail = s.length - s.lastIndexOf('.') - 1;
    if (dots > 1 || tail === 3) s = s.replace(/\./g, '');
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Match por solapamiento de tokens contra id y nombre del catálogo. */
export function matchInstrument(label: string, catalog: Instrument[]): Instrument | null {
  const target = norm(label);
  if (!target) return null;
  const tokens = target.split(' ').filter((t) => t.length > 1);

  let best: { inst: Instrument; score: number } | null = null;
  for (const inst of catalog) {
    const hay = `${norm(inst.id)} ${norm(inst.name)}`;
    let score = 0;
    if (hay.includes(target) || target.includes(norm(inst.id))) score += 10;
    for (const t of tokens) if (hay.includes(t)) score += 2;
    if (score > 0 && (!best || score > best.score)) best = { inst, score };
  }
  return best && best.score >= 2 ? best.inst : null;
}

const LABEL_HINTS = ['especie', 'descripcion', 'denominacion', 'activo', 'instrumento', 'ticker', 'simbolo', 'fondo'];
const VALUE_HINTS = ['valorizado', 'valuacion', 'valor', 'importe', 'saldo', 'monto', 'tenencia', 'total'];
const QTY_HINTS = ['cantidad', 'nominal', 'cuotapartes', 'cuotaparte', 'qty'];

function pickColumn(header: string[], hints: string[]): number {
  for (const hint of hints) {
    const idx = header.findIndex((h) => norm(h).includes(hint));
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * CSV -> filas candidatas. Igual que la foto, esto no graba:
 * lo que sale de acá lo confirma el dueño.
 */
export function rowsFromCsv(
  text: string,
  catalog: Instrument[],
  defaultPlatform: Platform = 'broker',
): ParsedRow[] {
  const table = parseCsv(text);
  if (table.length === 0) return [];

  const header = table[0];
  let labelCol = pickColumn(header, LABEL_HINTS);
  let valueCol = pickColumn(header, VALUE_HINTS);
  const qtyCol = pickColumn(header, QTY_HINTS);
  const platCol = pickColumn(header, ['plataforma', 'cuenta', 'broker']);

  // Sin encabezado reconocible: primera columna de texto, última numérica.
  const hasHeader = labelCol !== -1 && valueCol !== -1;
  if (!hasHeader) {
    labelCol = 0;
    valueCol = header.length - 1;
  }

  const body = hasHeader ? table.slice(1) : table;
  const out: ParsedRow[] = [];

  for (const row of body) {
    const label = (row[labelCol] ?? '').trim();
    const value = parseArsNumber(row[valueCol] ?? '');
    if (!label || value == null || value <= 0) continue;

    const inst = matchInstrument(label, catalog);
    const platRaw = platCol !== -1 ? norm(row[platCol] ?? '') : '';
    const platform: Platform = platRaw.includes('fima')
      ? 'fima'
      : platRaw.includes('broker')
        ? 'broker'
        : (inst?.platform ?? defaultPlatform);

    out.push({
      instrumentId: inst?.id ?? null,
      rawLabel: label,
      platform,
      arsValue: value,
      quantity: qtyCol !== -1 ? parseArsNumber(row[qtyCol] ?? '') : null,
      confidence: inst ? 'alta' : 'baja',
    });
  }

  return out;
}
