import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Los skills son markdown con frontmatter, no código: se pueden editar sin
// tocar la app, y se puede pegar uno traído de afuera en src/skills/ y listo.
//
// Cada uno declara qué datos necesita. El route del memo pasa qué tiene
// disponible y acá se eligen los que aplican — un skill que pide datos que no
// están no se inyecta, así el modelo nunca recibe instrucciones para las que
// no tiene insumos.

export type Capability = 'book' | 'engine' | 'fundamentals' | 'thesis';

export interface Skill {
  name: string;
  description: string;
  requires: Capability[];
  body: string;
}

const SKILLS_DIR = join(process.cwd(), 'src', 'skills');

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
  if (!match) return { meta: {}, body: raw.trim() };

  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { meta, body: match[2].trim() };
}

const parseList = (v: string | undefined): Capability[] =>
  (v ?? '')
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as Capability[];

let cache: Skill[] | undefined;

export function loadSkills(): Skill[] {
  if (cache) return cache;
  let files: string[];
  try {
    files = readdirSync(SKILLS_DIR).filter((f) => f.endsWith('.md'));
  } catch {
    // Sin carpeta de skills la app sigue andando con el prompt base.
    return (cache = []);
  }

  cache = files
    .sort()
    .map((file) => {
      const { meta, body } = parseFrontmatter(readFileSync(join(SKILLS_DIR, file), 'utf8'));
      return {
        name: meta.name ?? file.replace(/\.md$/, ''),
        description: meta.description ?? '',
        requires: parseList(meta.requires),
        body,
      };
    })
    .filter((s) => s.body.length > 0);

  return cache;
}

/** Un skill entra sólo si TODO lo que pide está disponible. */
export function selectSkills(available: Capability[]): Skill[] {
  const have = new Set(available);
  return loadSkills().filter((s) => s.requires.every((r) => have.has(r)));
}

export function renderSkills(skills: Skill[]): string {
  if (skills.length === 0) return '';
  return skills
    .map((s) => `<skill name="${s.name}">\n${s.body}\n</skill>`)
    .join('\n\n');
}
