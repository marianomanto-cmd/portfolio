import Link from 'next/link';
import EscenariosClient from './EscenariosClient';
import { Card, Empty, PageTitle, SetupNotice } from '@/components/ui';
import { hasDb } from '@/lib/db';
import { getInstruments, getLatestBook, getSettings } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function EscenariosPage() {
  if (!hasDb()) {
    return (
      <>
        <PageTitle title="Escenarios" />
        <SetupNotice what="la base">
          <p>Sin <code className="text-white">DATABASE_URL</code> no hay corte del que partir.</p>
        </SetupNotice>
      </>
    );
  }

  const [book, settings, catalog] = await Promise.all([
    getLatestBook(),
    getSettings(),
    getInstruments(),
  ]);

  if (!book) {
    return (
      <>
        <PageTitle title="Escenarios" />
        <Card>
          <Empty>
            El motor parte del último corte y no hay ninguno.{' '}
            <Link href="/cargar" className="text-accent underline underline-offset-4">Cargá uno</Link>.
          </Empty>
        </Card>
      </>
    );
  }

  // El bono que vence primero marca cuándo esa clase pasa a liquidez.
  const bondMaturity =
    book.positions
      .map((p) => catalog.find((i) => i.id === p.instrumentId)?.maturity)
      .filter((m): m is string => Boolean(m))
      .sort()[0] ?? null;

  return (
    <>
      <PageTitle title="Escenarios" sub={`Desde el corte del ${book.snapshot.takenAt}`} />
      <EscenariosClient
        positions={book.positions}
        startMep={book.snapshot.mep}
        startDate={book.snapshot.takenAt}
        initialSettings={settings}
        bondMaturity={bondMaturity}
      />
    </>
  );
}
