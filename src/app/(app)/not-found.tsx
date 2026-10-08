import Link from 'next/link'

export default function NoEncontrado() {
  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow)] md:p-8">
      <h1 className="text-lg font-semibold">No encontré esa página</h1>
      <p className="mt-1 text-sm text-muted">Puede que la dirección esté mal escrita o que esa sección todavía no exista en esta fase.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/" className="inline-flex min-h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-strong">
          Ir a Hoy
        </Link>
        <Link href="/cartera" className="inline-flex min-h-10 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-2">
          Ver la cartera
        </Link>
      </div>
    </section>
  )
}
