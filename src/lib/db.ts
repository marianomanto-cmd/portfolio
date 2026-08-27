import { Pool } from 'pg';

// Serverless: cada instancia mantiene a lo sumo una conexión y la reusa entre
// invocaciones. La URL tiene que apuntar al Transaction pooler de Supabase
// (6543), no al 5432 directo, o el proyecto se queda sin conexiones.
//
// `pg` sólo usa prepared statements con nombre si se los pedís explícitamente,
// así que el pooler en modo transacción funciona sin configuración extra.

declare global {
  var __cortePool: Pool | undefined;
}

function makePool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Falta DATABASE_URL. Cargala en las env vars de Vercel.');
  }
  return new Pool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: { rejectUnauthorized: false },
  });
}

export function pool(): Pool {
  if (!globalThis.__cortePool) globalThis.__cortePool = makePool();
  return globalThis.__cortePool;
}

export async function q<T extends Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool().query(text, params);
  return res.rows as T[];
}

export async function q1<T extends Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

/** Corre varias queries en una transacción sobre la misma conexión. */
export async function tx<T>(fn: (run: typeof q) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  const run = async <R extends Record<string, unknown>>(text: string, params: unknown[] = []) => {
    const res = await client.query(text, params);
    return res.rows as R[];
  };
  try {
    await client.query('begin');
    const out = await fn(run as typeof q);
    await client.query('commit');
    return out;
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** true si hay DB configurada. Las pantallas degradan en vez de romper. */
export const hasDb = () => Boolean(process.env.DATABASE_URL);
