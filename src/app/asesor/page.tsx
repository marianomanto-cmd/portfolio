import Link from 'next/link';
import AsesorClient from './AsesorClient';
import { Card, Empty, PageTitle, SetupNotice } from '@/components/ui';
import { hasDb } from '@/lib/db';
import { getLatestBook, listMemos } from '@/lib/queries';
import { hasClaude } from '@/lib/claude';

export const dynamic = 'force-dynamic';

export default async function AsesorPage() {
  if (!hasDb()) {
    return (
      <>
        <PageTitle title="Asesor" />
        <SetupNotice what="la base">
          <p>Sin <code className="text-white">DATABASE_URL</code> no hay libro que mirar.</p>
        </SetupNotice>
      </>
    );
  }

  const [book, memos] = await Promise.all([getLatestBook(), listMemos()]);

  return (
    <>
      <PageTitle title="Asesor" sub="Lee el libro y los números del motor. No ejecuta nada." />

      {!hasClaude() ? (
        <SetupNotice what="Claude">
          <p>
            Falta <code className="text-white">ANTHROPIC_API_KEY</code> en las variables de entorno del
            servidor. Los memos viejos se siguen viendo.
          </p>
        </SetupNotice>
      ) : null}

      {!book ? (
        <Card className="mt-3">
          <Empty>
            No hay corte del que hablar.{' '}
            <Link href="/cargar" className="text-accent underline underline-offset-4">Cargá uno</Link>.
          </Empty>
        </Card>
      ) : null}

      <AsesorClient
        initialMemos={memos}
        canGenerate={hasClaude() && Boolean(book)}
        snapshotDate={book?.snapshot.takenAt ?? null}
      />
    </>
  );
}
