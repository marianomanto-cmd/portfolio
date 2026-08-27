import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-panel p-4 ${className}`}>
      {children}
    </section>
  );
}

export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <header className="mb-4">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {sub ? <p className="mt-1 text-sm text-mut">{sub}</p> : null}
    </header>
  );
}

export function Row({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="min-w-0 truncate text-sm text-mut">{label}</span>
      <span className="tnum shrink-0 text-right text-sm">
        {value}
        {hint ? <span className="ml-2 text-xs text-mut">{hint}</span> : null}
      </span>
    </div>
  );
}

/** Aviso de configuración faltante. No es un error de la app: falta una env var. */
export function SetupNotice({ what, children }: { what: string; children?: ReactNode }) {
  return (
    <Card className="border-accent/40">
      <h2 className="text-sm font-semibold text-accent">Falta configurar {what}</h2>
      <div className="mt-2 space-y-2 text-sm text-mut">{children}</div>
    </Card>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-mut">{children}</p>;
}
