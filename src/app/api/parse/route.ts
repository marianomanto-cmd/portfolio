import { NextResponse } from 'next/server';
import { getInstruments } from '@/lib/queries';
import { hasXai, parsePhoto } from '@/lib/xai';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Foto -> filas candidatas. No graba: el dueño confirma antes. */
export async function POST(req: Request) {
  if (!hasXai()) {
    return NextResponse.json(
      { error: 'Falta XAI_API_KEY en el servidor. Cargá el CSV o las filas a mano.' },
      { status: 503 },
    );
  }

  let body: { image?: unknown };
  try {
    body = (await req.json()) as { image?: unknown };
  } catch {
    return NextResponse.json({ error: 'Body inválido.' }, { status: 400 });
  }

  const image = body.image;
  if (typeof image !== 'string' || !image.startsWith('data:image/')) {
    return NextResponse.json({ error: 'Mandá una imagen como data URL.' }, { status: 400 });
  }
  if (image.length > 8_000_000) {
    return NextResponse.json({ error: 'La imagen es muy pesada. Sacá una más chica.' }, { status: 413 });
  }

  try {
    const catalog = await getInstruments();
    return NextResponse.json(await parsePhoto(image, catalog));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Falló el parseo.';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
