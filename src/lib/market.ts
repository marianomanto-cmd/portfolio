// Datos de mercado. Si una fuente falla, la pantalla muestra n/d.
// Nunca tira: un dolarapi caído no puede voltear el libro.

export interface MepQuote {
  compra: number | null;
  venta: number | null;
  promedio: number | null;
  fecha: string | null;
  ok: boolean;
}

export interface UnderlyingQuote {
  symbol: string;
  price: number | null;
  changePct: number | null;
  ok: boolean;
}

const TIMEOUT_MS = 6000;

async function getJson(url: string, revalidate: number): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'user-agent': 'corte/1.0 (+libro personal)' },
      next: { revalidate },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getMep(): Promise<MepQuote> {
  const data = (await getJson('https://dolarapi.com/v1/dolares/bolsa', 300)) as
    | { compra?: number; venta?: number; fechaActualizacion?: string }
    | null;

  if (!data || typeof data.venta !== 'number') {
    return { compra: null, venta: null, promedio: null, fecha: null, ok: false };
  }
  const compra = typeof data.compra === 'number' ? data.compra : null;
  const promedio = compra != null ? (compra + data.venta) / 2 : data.venta;
  return {
    compra,
    venta: data.venta,
    promedio,
    fecha: data.fechaActualizacion ?? null,
    ok: true,
  };
}

export async function getUnderlying(symbol: string): Promise<UnderlyingQuote> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=5d&interval=1d`;
  const data = (await getJson(url, 900)) as
    | { chart?: { result?: Array<{ meta?: Record<string, unknown> }> } }
    | null;

  const meta = data?.chart?.result?.[0]?.meta;
  const price = typeof meta?.regularMarketPrice === 'number' ? meta.regularMarketPrice : null;
  const prev = typeof meta?.chartPreviousClose === 'number'
    ? meta.chartPreviousClose
    : typeof meta?.previousClose === 'number'
      ? meta.previousClose
      : null;

  if (price == null) return { symbol, price: null, changePct: null, ok: false };
  return {
    symbol,
    price,
    changePct: prev && prev > 0 ? ((price - prev) / prev) * 100 : null,
    ok: true,
  };
}

export async function getUnderlyings(symbols: string[]): Promise<UnderlyingQuote[]> {
  return Promise.all(symbols.map(getUnderlying));
}
