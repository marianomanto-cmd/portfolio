// Cliente de Claude. Sólo servidor: la API key nunca sale al browser.

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { Skill } from './skills';
import { renderSkills } from './skills';
import type { Instrument, ParsedRow } from './types';

export type { ParsedRow };

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5';

/**
 * La key vive en ANTHROPIC_API_KEY. Se acepta XAI_API_KEY como alias heredado
 * porque el deploy ya tenía la key de Anthropic cargada con ese nombre, de
 * cuando la app hablaba con xAI. Renombrala en Vercel cuando puedas.
 */
const apiKey = () => process.env.ANTHROPIC_API_KEY || process.env.XAI_API_KEY;

export const hasClaude = () => Boolean(apiKey());

function client(): Anthropic {
  const key = apiKey();
  if (!key) throw new Error('Falta ANTHROPIC_API_KEY en el servidor.');
  return new Anthropic({ apiKey: key });
}

// ---------------------------------------------------------------- parseo foto

const RowSchema = z.object({
  instrument_id: z.string().nullable(),
  raw_label: z.string(),
  platform: z.enum(['fima', 'broker']),
  ars_value: z.number(),
  quantity: z.number().nullable(),
  confidence: z.enum(['alta', 'media', 'baja']),
});

const CorteSchema = z.object({
  mep: z.number().nullable(),
  taken_at: z.string().nullable(),
  rows: z.array(RowSchema),
});

/** Separa un data URL en media type y base64. */
function splitDataUrl(dataUrl: string): { mediaType: string; data: string } {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) throw new Error('La imagen no vino como data URL base64.');
  return { mediaType: match[1], data: match[2] };
}

/**
 * Lee una foto del resumen y devuelve filas candidatas.
 * No graba nada: el dueño confirma antes de que esto toque la DB.
 */
export async function parsePhoto(
  imageDataUrl: string,
  catalog: Instrument[],
): Promise<{ rows: ParsedRow[]; mep: number | null; takenAt: string | null }> {
  const { mediaType, data } = splitDataUrl(imageDataUrl);

  const system = [
    'Sos un extractor de datos. Leés una captura de un resumen de cuenta argentino',
    '(FIMA o broker) y devolvés las tenencias que ves. No estimás, no completás.',
    '',
    'Catálogo de especies válidas (id | nombre | tipo | plataforma):',
    ...catalog.map((i) => `- ${i.id} | ${i.name} | ${i.kind} | ${i.platform}`),
    '',
    'Reglas:',
    '- instrument_id tiene que salir del catálogo. Si no reconocés la fila, poné null y dejá raw_label.',
    '- ars_value es el valor en PESOS de la tenencia. Números argentinos: 1.234.567,89 son 1234567.89.',
    '- Si no ves el valor en pesos de una fila, no la inventes: omitila.',
    '- mep sólo si aparece explícito en la imagen. Si no, null.',
    '- taken_at en formato YYYY-MM-DD sólo si la fecha está en la imagen. Si no, null.',
    '- confidence: "alta" si leíste el número nítido, "media" si dudás, "baja" si adivinaste el mapeo.',
  ].join('\n');

  const response = await client().messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system,
    output_config: { format: zodOutputFormat(CorteSchema) },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/jpeg', data } },
          { type: 'text', text: 'Extraé las tenencias de esta imagen.' },
        ],
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error('El modelo no devolvió la estructura esperada. Probá con el CSV.');

  const valid = new Set(catalog.map((i) => i.id));
  const rows: ParsedRow[] = parsed.rows
    .filter((r) => Number.isFinite(r.ars_value) && r.ars_value > 0)
    .map((r) => ({
      instrumentId: r.instrument_id && valid.has(r.instrument_id) ? r.instrument_id : null,
      rawLabel: r.raw_label || r.instrument_id || '',
      platform: r.platform,
      arsValue: r.ars_value,
      quantity: r.quantity != null && Number.isFinite(r.quantity) ? r.quantity : null,
      confidence: r.confidence,
    }));

  const takenAt = parsed.taken_at && /^\d{4}-\d{2}-\d{2}$/.test(parsed.taken_at)
    ? parsed.taken_at
    : null;

  return { rows, mep: parsed.mep && parsed.mep > 0 ? parsed.mep : null, takenAt };
}

// ----------------------------------------------------------------------- memo

const BASE_SYSTEM = [
  'Sos el asesor del dueño de este libro. Escribís en español rioplatense, tuteo con "vos",',
  'directo y sin floritura. No sos su empleado ni su animador: si algo está mal, lo decís.',
  '',
  'Trabajás SOLO con los datos del contexto. Reglas duras:',
  '- Los números del motor ya están calculados. Los citás tal cual. NO los recalculás.',
  '- No inventás RSI, EPS, P/E, targets de analistas, ni ninguna métrica que no esté en el contexto.',
  '- Si un dato que necesitás no está, lo decís ("no tengo X acá") en vez de estimarlo.',
  '- No recomendás ejecutar nada automático. Las órdenes las pone él en la plataforma.',
  '',
  'Plantilla fija, en este orden, con estos títulos exactos en markdown (##):',
  '## Supuestos',
  '## Tesis',
  '## Escenarios',
  '## Qué la invalida',
  '## Acción humana',
  '',
  'Acción humana: qué haría él esta semana, o "nada" si corresponde. Nunca más de tres puntos.',
].join('\n');

/** Memo del asesor. Narra los números del motor; no los recalcula. */
export async function writeMemo(contextJson: string, skills: Skill[]): Promise<string> {
  const rendered = renderSkills(skills);
  const system = rendered
    ? `${BASE_SYSTEM}\n\nAplicás estos criterios de análisis:\n\n${rendered}`
    : BASE_SYSTEM;

  const response = await client().beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    betas: ['server-side-fallback-2026-06-01'],
    fallbacks: [{ model: 'claude-opus-4-8' }],
    system,
    messages: [
      { role: 'user', content: `Contexto del libro y del motor:\n\n${contextJson}` },
    ],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('El modelo declinó la solicitud.');
  }

  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  if (!text) throw new Error('El modelo devolvió una respuesta vacía.');
  return text;
}
