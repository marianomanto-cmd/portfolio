import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Reglas de las migraciones nuevas (entrega 4, plan §1 y §7; D-116, D-20, D-33).
// Valen desde la primera posterior a los feriados: las anteriores ya están
// aplicadas en producción y no se tocan.
//
// - Ninguna contiene la palabra "delete", en ninguna caja, ni en comentarios: el
//   conector de Supabase pide una confirmación que no llega (D-116). Los errores
//   se anulan o se archivan; una tabla nueva no da permiso de borrar ni su
//   trigger de auditoría escucha borrados.
// - Toda tabla nueva: RLS, sin permisos para public/anon/authenticated, permisos
//   para service_role, comentario de la tabla y de cada columna, y su trigger
//   "auditar".
// - Toda función nueva: revoke a public/anon/authenticated y grant a service_role.

const DIR = path.join(process.cwd(), 'supabase', 'migrations')
const DESDE = '20261014203031'
const NUEVAS = readdirSync(DIR)
  .filter((f) => /^\d{14}_[a-z0-9_]+\.sql$/.test(f) && f.slice(0, 14) > DESDE)
  .sort()

/** El SQL sin comentarios ni cuerpos entre dólares: lo que queda son las sentencias de DDL. */
function esqueleto(sql: string): string {
  return sql
    .replace(/\$([a-z_]*)\$[\s\S]*?\$\1\$/gi, '$$ $$')
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
}

const TIPOS = '(?:text|bigint|smallint|integer|int|numeric|date|timestamptz|timestamp|boolean|jsonb|json|uuid|char|varchar)'

export interface TablaNueva {
  nombre: string
  columnas: string[]
}

/** Las tablas que crea el SQL, con sus columnas (una por renglón: "nombre tipo …"). */
export function tablasNuevas(sql: string): TablaNueva[] {
  const out: TablaNueva[] = []
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\n\s*\)\s*;/gi
  for (const m of esqueleto(sql).matchAll(re)) {
    const columnas = m[2]
      .split('\n')
      .map((l) => l.trim())
      .map((l) => new RegExp(`^([a-z_][a-z0-9_]*)\\s+${TIPOS}\\b`, 'i').exec(l)?.[1])
      .filter((c): c is string => Boolean(c) && !/^(constraint|primary|unique|check|foreign|exclude)$/i.test(c!))
    out.push({ nombre: m[1].toLowerCase(), columnas: columnas.map((c) => c.toLowerCase()) })
  }
  return out
}

/** Las funciones que crea (o reemplaza) el SQL. */
export function funcionesNuevas(sql: string): string[] {
  const re = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_][a-z0-9_]*)\s*\(/gi
  return [...new Set([...esqueleto(sql).matchAll(re)].map((m) => m[1].toLowerCase()))]
}

function sentencias(sql: string): string[] {
  return esqueleto(sql)
    .split(';')
    .map((s) => s.replace(/\s+/g, ' ').trim().toLowerCase())
    .filter(Boolean)
}

/** Lo que le falta a una migración para cumplir las reglas (vacío si cumple). */
export function faltas(sql: string): string[] {
  const f: string[] = []
  if (/delete/i.test(sql)) f.push('contiene "delete" (también cuenta en un comentario): el conector no la aplica sin confirmación (D-116)')
  const ss = sentencias(sql)
  const hay = (re: RegExp) => ss.some((s) => re.test(s))
  for (const t of tablasNuevas(sql)) {
    const n = t.nombre
    if (!hay(new RegExp(`^alter table (public\\.)?${n} enable row level security$`))) f.push(`${n}: falta enable row level security`)
    if (!hay(new RegExp(`^revoke all on (table )?(public\\.)?${n} from public, ?anon, ?authenticated$`)))
      f.push(`${n}: falta revoke all … from public, anon, authenticated`)
    if (!hay(new RegExp(`^grant [a-z, ]+ on (table )?(public\\.)?${n} to service_role$`))) f.push(`${n}: falta el grant a service_role`)
    if (!hay(new RegExp(`^comment on table (public\\.)?${n} is `))) f.push(`${n}: falta comment on table`)
    for (const c of t.columnas)
      if (!hay(new RegExp(`^comment on column (public\\.)?${n}\\.${c} is `))) f.push(`${n}.${c}: falta comment on column`)
    if (!hay(new RegExp(`^create trigger auditar .* on (public\\.)?${n} for each row execute function registrar_auditoria\\(\\)$`)))
      f.push(`${n}: falta el trigger "auditar" (after insert or update, sin borrados)`)
  }
  for (const fn of funcionesNuevas(sql)) {
    if (!hay(new RegExp(`^revoke all on function .*\\b${fn}\\(.* from public, ?anon, ?authenticated$`)))
      f.push(`${fn}(): falta revoke all on function … from public, anon, authenticated`)
    if (!hay(new RegExp(`^grant execute on function .*\\b${fn}\\(.* to service_role$`))) f.push(`${fn}(): falta grant execute … to service_role`)
  }
  return f
}

describe('reglas de las migraciones nuevas', () => {
  it('hay al menos una migración posterior a los feriados (si no, este test no prueba nada)', () => {
    expect(NUEVAS.length).toBeGreaterThan(0)
  })

  it.each(NUEVAS)('%s cumple las reglas', (archivo) => {
    expect(faltas(readFileSync(path.join(DIR, archivo), 'utf8'))).toEqual([])
  })
})

describe('el control mismo', () => {
  const tabla = `create table cosas (
  id bigint generated always as identity primary key,
  nombre text not null check (char_length(nombre) > 0),
  monto numeric not null,
  constraint cosas_x check (monto > 0)
);
alter table cosas enable row level security;
revoke all on table cosas from public, anon, authenticated;
grant select, insert, update on table cosas to service_role;
comment on table cosas is 'x';
comment on column cosas.id is 'x';
comment on column cosas.nombre is 'x';
comment on column cosas.monto is 'x';
create trigger auditar after insert or update on cosas for each row execute function registrar_auditoria();
create function hacer(p jsonb) returns bigint language plpgsql as $$ begin return 1; end $$;
revoke all on function hacer(jsonb) from public, anon, authenticated;
grant execute on function hacer(jsonb) to service_role;`

  it('una migración completa no tiene faltas', () => {
    expect(tablasNuevas(tabla)).toEqual([{ nombre: 'cosas', columnas: ['id', 'nombre', 'monto'] }])
    expect(faltas(tabla)).toEqual([])
  })

  it('caza un "delete" aunque esté en un comentario o en mayúsculas', () => {
    expect(faltas(`${tabla}\n-- no DELETE nada`)).toEqual([expect.stringContaining('contiene "delete"')])
    expect(faltas(tabla.replace('monto numeric not null,', 'monto numeric not null references x(id) on Delete cascade,'))).toContainEqual(
      expect.stringContaining('contiene "delete"'),
    )
  })

  it('caza lo que le falta a una tabla y a una función', () => {
    const sin = tabla
      .replace("comment on column cosas.monto is 'x';", '')
      .replace('alter table cosas enable row level security;', '')
      .replace('grant execute on function hacer(jsonb) to service_role;', '')
    expect(faltas(sin)).toEqual([
      'cosas: falta enable row level security',
      'cosas.monto: falta comment on column',
      'hacer(): falta grant execute … to service_role',
    ])
  })

  it('el cuerpo de una función no confunde al control', () => {
    const conCuerpo = tabla.replace('begin return 1; end', "begin insert into cosas (nombre, monto) values ('a; b', 1); return 1; end")
    expect(faltas(conCuerpo)).toEqual([])
  })
})
