import CargarClient from './CargarClient';
import { PageTitle, SetupNotice } from '@/components/ui';
import { hasDb } from '@/lib/db';
import { getMep } from '@/lib/market';
import { getInstruments } from '@/lib/queries';
import { hasXai } from '@/lib/xai';

export const dynamic = 'force-dynamic';

export default async function CargarPage() {
  if (!hasDb()) {
    return (
      <>
        <PageTitle title="Cargar corte" />
        <SetupNotice what="la base">
          <p>Sin <code className="text-white">DATABASE_URL</code> no hay dónde grabar el corte.</p>
        </SetupNotice>
      </>
    );
  }

  const [catalog, mep] = await Promise.all([getInstruments(), getMep()]);
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageTitle title="Cargar corte" sub="Confirmás vos cada fila antes de que se grabe." />
      <CargarClient
        catalog={catalog}
        defaultDate={hoy}
        defaultMep={mep.ok && mep.promedio ? Math.round(mep.promedio) : null}
        photoEnabled={hasXai()}
      />
    </>
  );
}
