// Cliente xAI. Sólo servidor: XAI_API_KEY nunca sale al browser.

import type { Instrument, Platform } from './types';

const ENDPOINT = 'https://api.x.ai/v1/chat/completions';
const MODEL = process.env.XAI_MODEL ?? 'grok-4.5';

export const hasXai = () => Boolean(process.env.XAI_API_KEY);

type Content = string | Array<Record<string, unknown>>;
interface Message { role: 'system' | 'user'; content: Content }

async function chat(
  messages: Message[],
  opts: { json?: boolean; maxTokens?: number } = {},
): Promise<string> {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error('Falta XAI_API_KEY en el servidor.');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90_000);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0,
        max_tokens: opts.maxTokens ?? 2000,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`xAI ${res.status}: ${detail.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const out = data.choices?.[0]?.message?.content;
    if (!out) throw new Error('xAI devolvió una respuesta vacía.');
    return out;
  } finally {
    clearTimeout(timer);
  }
}

export interface ParsedRow {
  instrumentId: string | null;
  rawLabel: string;
  platform: Platform;
  arsValue: number;
  quantity: number | null;
  confidence: 'alta' | 'media' | 'baja';
}

/**
 * Lee una foto del resumen y devuelve filas candidatas.
 * No graba nada: el dueño confirma antes de que esto toque la DB.
 */
export async function parsePhoto(
  imageDataUrl: string,
  catalog: Instrument[],
): Promise<{ rows: ParsedRow[]; mep: number | null; takenAt: string | null }> {
  const catalogLines = catalog
    .map((i) => `- ${i.id} | ${i.name} | ${i.kind} | ${i.platform}`)
    .join('\n');

  const system = [
    'Sos un extractor de datos. Leés una captura de un resumen de cuenta argentino',
    '(FIMA o broker) y devolvés las tenencias que ves. No estimás, no completás.',
    '',
    'Catálogo de especies válidas (id | nombre | tipo | plataforma):',
    catalogLines,
    '',
    'Reglas:',
    '- instrument_id tiene que salir del catálogo. Si no reconocés la fila, poné null y dejá rawLabel.',
    '- ars_value es el valor en PESOS de la tenencia. Números argentinos: 1.234.567,89 son 1234567.89.',
    '- Si no ves el valor en pesos de una fila, no la inventes: omitila.',
    '- mep sólo si aparece explícito en la imagen. Si no, null.',
    '- taken_at en formato YYYY-MM-DD sólo si la fecha está en la imagen. Si no, null.',
    '- confidence: "alta" si leíste el número nítido, "media" si dudás, "baja" si adivinaste el mapeo.',
    '',
    'Devolvé JSON: {"mep": number|null, "taken_at": string|null, "rows": [',
    '{"instrument_id": string|null, "raw_label": string, "platform": "fima"|"broker",',
    '"ars_value": number, "quantity": number|null, "confidence": "alta"|"media"|"baja"}]}',
  ].join('\n');

  const raw = await chat(
    [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extraé las tenencias de esta imagen.' },
          { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } },
        ],
      },
    ],
    { json: true, maxTokens: 3000 },
  );

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error('El modelo no devolvió JSON válido. Probá con otra foto o cargá por CSV.');
  }

  const valid = new Set(catalog.map((i) => i.id));
  const rowsIn = Array.isArray(parsed.rows) ? (parsed.rows as Record<string, unknown>[]) : [];

  const rows: ParsedRow[] = rowsIn
    .map((r) => {
      const id = typeof r.instrument_id === 'string' && valid.has(r.instrument_id)
        ? r.instrument_id
        : null;
      const ars = Number(r.ars_value);
      return {
        instrumentId: id,
        rawLabel: String(r.raw_label ?? id ?? ''),
        platform: (r.platform === 'fima' ? 'fima' : 'broker') as Platform,
        arsValue: Number.isFinite(ars) ? ars : 0,
        quantity: r.quantity == null || !Number.isFinite(Number(r.quantity))
          ? null
          : Number(r.quantity),
        confidence: (['alta', 'media', 'baja'] as const).includes(r.confidence as 'alta')
          ? (r.confidence as ParsedRow['confidence'])
          : 'baja',
      };
    })
    .filter((r) => r.arsValue > 0);

  const mepRaw = Number(parsed.mep);
  const takenAt = typeof parsed.taken_at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.taken_at)
    ? parsed.taken_at
    : null;

  return { rows, mep: Number.isFinite(mepRaw) && mepRaw > 0 ? mepRaw : null, takenAt };
}

/** Memo del asesor. Narra los números del motor; no los recalcula. */
export async function writeMemo(contextJson: string): Promise<string> {
  const system = [
    'Sos el asesor del dueño de este libro. Escribís en español rioplatense, tuteo con "vos",',
    'directo y sin floritura. No sos su empleado ni su animador: si algo está mal, lo decís.',
    '',
    'Trabajás SOLO con los datos del contexto. Reglas duras:',
    '- Los números del motor (USD finales, escenarios, pesos por clase) ya están calculados.',
    '  Los citás tal cual. NO los recalculás, no los redondeás a otra cosa, no los promediás.',
    '- No inventás RSI, EPS, P/E, targets de analistas, ni ninguna métrica que no esté en el contexto.',
    '- Si un dato que necesitás para una afirmación no está en el contexto, lo decís explícitamente',
    '  ("no tengo X acá") en vez de estimarlo.',
    '- No recomendás ejecutar nada automático. Las órdenes las pone él en la plataforma.',
    '',
    'Plantilla fija, en este orden, con estos títulos exactos en markdown (##):',
    '## Supuestos',
    '## Tesis',
    '## Escenarios',
    '## Qué la invalida',
    '## Acción humana',
    '',
    'Supuestos: qué asumió el motor (MEP, retorno USA, tasa en pesos, horizonte, aporte).',
    'Tesis: qué dice la composición actual del libro. Concreto, sin generalidades.',
    'Escenarios: oso/base/toro con los USD finales del motor.',
    'Qué la invalida: condiciones observables y falsables que romperían la tesis.',
    'Acción humana: qué haría él esta semana, o "nada" si corresponde. Nunca más de tres puntos.',
  ].join('\n');

  return chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: `Contexto del libro y del motor:\n\n${contextJson}` },
    ],
    { maxTokens: 2500 },
  );
}
