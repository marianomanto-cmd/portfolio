/**
 * Render mínimo del memo. El modelo devuelve la plantilla fija en markdown
 * simple (## títulos, viñetas, párrafos); no vale la pena una dependencia.
 */
export default function Memo({ body }: { body: string }) {
  const blocks = body.split('\n').filter((l) => l.trim() !== '');

  return (
    <div className="space-y-2">
      {blocks.map((line, i) => {
        const t = line.trim();

        if (t.startsWith('###')) {
          return <h4 key={i} className="pt-1 text-sm font-semibold">{t.replace(/^#+\s*/, '')}</h4>;
        }
        if (t.startsWith('##')) {
          return (
            <h3 key={i} className="pt-2 text-xs font-semibold uppercase tracking-wide text-accent">
              {t.replace(/^#+\s*/, '')}
            </h3>
          );
        }
        if (/^[-*]\s+/.test(t)) {
          return (
            <p key={i} className="flex gap-2 text-sm leading-relaxed">
              <span className="text-mut" aria-hidden="true">·</span>
              <span>{strip(t.replace(/^[-*]\s+/, ''))}</span>
            </p>
          );
        }
        if (/^\d+\.\s+/.test(t)) {
          return <p key={i} className="text-sm leading-relaxed">{strip(t)}</p>;
        }
        return <p key={i} className="text-sm leading-relaxed">{strip(t)}</p>;
      })}
    </div>
  );
}

/** Saca los ** de negrita: el memo se lee mejor plano. */
const strip = (s: string) => s.replace(/\*\*/g, '');
