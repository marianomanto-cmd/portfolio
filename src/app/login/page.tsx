import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { COOKIE_SESION, modoDemo, tokenValido } from '@/lib/server/sesion'
import { destinoSeguro } from './_lib/rutas'
import { FormularioEntrada } from './_componentes/formulario-entrada'

export const metadata: Metadata = { title: 'Entrar' }

export default async function PaginaEntrada({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string | string[] }>
}) {
  const parametros = await searchParams
  const desde = destinoSeguro(typeof parametros.desde === 'string' ? parametros.desde : null)
  const demo = modoDemo()
  const falta = !demo && !process.env.APP_PASSWORD

  // Con una sesión válida, la entrada no tiene nada que hacer.
  if (!demo && !falta) {
    const token = (await cookies()).get(COOKIE_SESION)?.value
    if (await tokenValido(token)) redirect(desde)
  }

  return (
    <main className="flex min-h-svh w-full items-center justify-center bg-bg px-4 py-10">
      <div className="w-full sm:w-96">
        <div className="mb-6">
          <p className="text-sm text-muted">Portfolio</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text">Entrar</h1>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow)]">
          {falta ? (
            <div role="alert" className="space-y-2 text-sm">
              <p className="font-medium text-text">Falta configurar APP_PASSWORD en Vercel.</p>
              <p className="text-muted">
                Cargá la variable <span className="num">APP_PASSWORD</span> en el proyecto de Vercel (y, si
                querés, <span className="num">SESSION_SECRET</span> para firmar la sesión) y volvé a desplegar.
              </p>
            </div>
          ) : (
            <>
              {demo ? (
                <p className="mb-4 text-sm text-muted">
                  Modo demo: no hace falta clave y no se guarda nada en la base.
                </p>
              ) : null}
              <FormularioEntrada desde={desde} demo={demo} />
            </>
          )}
        </div>
        {desde !== '/' && !falta ? (
          <p className="mt-3 text-xs text-muted">
            Después de entrar volvés a <span className="num">{desde}</span>.
          </p>
        ) : null}
      </div>
    </main>
  )
}
