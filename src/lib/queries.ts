import { toIsoDate, toIsoTimestamp } from './dates';
import { q, q1, tx } from './db';
import { OWNER } from './owner';
import type {
  Book, Instrument, Kind, Memo, Platform, Position, Settings, Snapshot, Source,
} from './types';

// pg devuelve numeric como string para no perder precisión. Lo pasamos a number
// en el borde, una sola vez, en vez de esparcir Number() por toda la app.
const num = (v: unknown): number => (v == null ? 0 : Number(v));
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));

export async function getInstruments(): Promise<Instrument[]> {
  const rows = await q<Record<string, unknown>>(
    `select id, name, kind, platform, yahoo_symbol, maturity, sort_order, active
       from corte.instruments
      where active
      order by sort_order, name`,
  );
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    kind: r.kind as Kind,
    platform: r.platform as Platform,
    yahooSymbol: r.yahoo_symbol == null ? null : String(r.yahoo_symbol),
    maturity: toIsoDate(r.maturity),
    sortOrder: num(r.sort_order),
    active: Boolean(r.active),
  }));
}

export async function getLatestBook(): Promise<Book | null> {
  const snap = await q1<Record<string, unknown>>(
    `select id, source, taken_at, mep, notes, created_at
       from corte.snapshots
      where user_id = $1
      order by taken_at desc, created_at desc
      limit 1`,
    [OWNER],
  );
  if (!snap) return null;

  const snapshot: Snapshot = {
    id: num(snap.id),
    source: snap.source as Source,
    takenAt: toIsoDate(snap.taken_at) ?? '',
    mep: num(snap.mep),
    notes: snap.notes == null ? null : String(snap.notes),
    createdAt: toIsoTimestamp(snap.created_at),
  };

  return { snapshot, positions: await getPositions(snapshot.id) };
}

export async function getPositions(snapshotId: number): Promise<Position[]> {
  const rows = await q<Record<string, unknown>>(
    `select p.instrument_id, i.name, p.kind, p.platform, p.ars_value, p.quantity
       from corte.positions p
       join corte.instruments i on i.id = p.instrument_id
      where p.snapshot_id = $1
      order by i.sort_order, i.name`,
    [snapshotId],
  );
  return rows.map((r) => ({
    instrumentId: String(r.instrument_id),
    name: String(r.name),
    kind: r.kind as Kind,
    platform: r.platform as Platform,
    arsValue: num(r.ars_value),
    quantity: numOrNull(r.quantity),
  }));
}

export async function listSnapshots(limit = 30): Promise<Snapshot[]> {
  const rows = await q<Record<string, unknown>>(
    `select s.id, s.source, s.taken_at, s.mep, s.notes, s.created_at,
            coalesce(sum(p.ars_value), 0) as total_ars
       from corte.snapshots s
       left join corte.positions p on p.snapshot_id = s.id
      where s.user_id = $1
      group by s.id
      order by s.taken_at desc, s.created_at desc
      limit $2`,
    [OWNER, limit],
  );
  return rows.map((r) => ({
    id: num(r.id),
    source: r.source as Source,
    takenAt: toIsoDate(r.taken_at) ?? '',
    mep: num(r.mep),
    notes: r.notes == null ? null : String(r.notes),
    createdAt: toIsoTimestamp(r.created_at),
  }));
}

export interface NewPosition {
  instrumentId: string;
  platform: Platform;
  arsValue: number;
  quantity?: number | null;
}

/** Graba un corte completo. Todo o nada. */
export async function createSnapshot(input: {
  takenAt: string;
  mep: number;
  source: Source;
  notes?: string | null;
  positions: NewPosition[];
}): Promise<number> {
  const catalog = await getInstruments();
  const byId = new Map(catalog.map((i) => [i.id, i]));

  for (const p of input.positions) {
    if (!byId.has(p.instrumentId)) {
      throw new Error(
        `"${p.instrumentId}" no está en el catálogo. Agregalo primero en corte.instruments.`,
      );
    }
  }

  return tx(async (run) => {
    const snap = await run<Record<string, unknown>>(
      `insert into corte.snapshots (user_id, source, taken_at, mep, notes)
       values ($1, $2, $3, $4, $5)
       returning id`,
      [OWNER, input.source, input.takenAt, input.mep, input.notes ?? null],
    );
    const snapshotId = num(snap[0]?.id);

    for (const p of input.positions) {
      const inst = byId.get(p.instrumentId)!;
      await run(
        `insert into corte.positions
           (snapshot_id, user_id, instrument_id, kind, platform, ars_value, quantity)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (snapshot_id, instrument_id, platform)
         do update set ars_value = excluded.ars_value, quantity = excluded.quantity`,
        [snapshotId, OWNER, p.instrumentId, inst.kind, p.platform, p.arsValue, p.quantity ?? null],
      );
    }

    return snapshotId;
  });
}

export const DEFAULT_SETTINGS: Settings = {
  saveUsd: 3000,
  mep: 1540,
  months: 16,
  usAnn: 10,
  arsAnn: 30,
  rebalance: false,
  targetWeights: {},
};

export async function getSettings(): Promise<Settings> {
  const row = await q1<Record<string, unknown>>(
    `select save_usd, mep, months, us_ann, ars_ann, rebalance, target_weights
       from corte.settings where user_id = $1`,
    [OWNER],
  );
  if (!row) return DEFAULT_SETTINGS;
  return {
    saveUsd: num(row.save_usd),
    mep: num(row.mep),
    months: num(row.months),
    usAnn: num(row.us_ann),
    arsAnn: num(row.ars_ann),
    rebalance: Boolean(row.rebalance),
    targetWeights: (row.target_weights as Partial<Record<Kind, number>>) ?? {},
  };
}

export async function saveSettings(s: Settings): Promise<void> {
  await q(
    `insert into corte.settings
       (user_id, save_usd, mep, months, us_ann, ars_ann, rebalance, target_weights, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, now())
     on conflict (user_id) do update set
       save_usd = excluded.save_usd,
       mep = excluded.mep,
       months = excluded.months,
       us_ann = excluded.us_ann,
       ars_ann = excluded.ars_ann,
       rebalance = excluded.rebalance,
       target_weights = excluded.target_weights,
       updated_at = now()`,
    [OWNER, s.saveUsd, s.mep, s.months, s.usAnn, s.arsAnn, s.rebalance,
     JSON.stringify(s.targetWeights)],
  );
}

export async function listMemos(limit = 20): Promise<Memo[]> {
  const rows = await q<Record<string, unknown>>(
    `select id, snapshot_id, body, created_at
       from corte.memos where user_id = $1
      order by created_at desc limit $2`,
    [OWNER, limit],
  );
  return rows.map((r) => ({
    id: num(r.id),
    snapshotId: numOrNull(r.snapshot_id),
    body: String(r.body),
    createdAt: toIsoTimestamp(r.created_at),
  }));
}

export async function saveMemo(body: string, snapshotId: number | null): Promise<Memo> {
  const row = await q1<Record<string, unknown>>(
    `insert into corte.memos (user_id, snapshot_id, body)
     values ($1, $2, $3)
     returning id, snapshot_id, body, created_at`,
    [OWNER, snapshotId, body],
  );
  return {
    id: num(row?.id),
    snapshotId: numOrNull(row?.snapshot_id),
    body: String(row?.body ?? ''),
    createdAt: toIsoTimestamp(row?.created_at),
  };
}
