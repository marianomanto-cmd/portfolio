-- Corte — libro líquido personal. App de un solo usuario, auth OFF.
--
-- Este archivo es el bootstrap del schema, no una migración: está escrito con
-- `if not exists`, así que re-correrlo sobre una base que ya existe no aplica
-- cambios. Si agregás una columna, hacelo con su propio `alter table`.
--
-- Vive en el schema `corte`, no en `public`: el proyecto de Supabase donde está
-- aplicado también hospeda otra app, y así los dos no comparten namespace.
--
-- La app se conecta por Postgres directo con el rol owner, que bypassea RLS.
-- RLS está prendido igual y sin políticas a propósito: eso deja las tablas
-- fuera del alcance de PostgREST, que no usamos.

create schema if not exists corte;

-- Catálogo de especies. Única fuente de verdad: un papel nuevo va acá primero,
-- y la FK de positions no deja grabar nada que no esté en esta tabla.
create table if not exists corte.instruments (
  id            text primary key,
  name          text not null,
  kind          text not null check (kind in ('fondo','bono','cedear','usd','ars')),
  platform      text not null check (platform in ('fima','broker')),
  yahoo_symbol  text,
  maturity      date,
  sort_order    int  not null default 100,
  active        boolean not null default true
);

create table if not exists corte.snapshots (
  id          bigint generated always as identity primary key,
  user_id     text not null default 'me',
  source      text not null default 'mixed' check (source in ('fima','broker','mixed')),
  taken_at    date not null default current_date,
  -- Sin default a propósito: mejor que falle el insert a que grabe un MEP inventado.
  mep         numeric not null check (mep > 0),
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists snapshots_taken_idx on corte.snapshots (taken_at desc, created_at desc);

create table if not exists corte.positions (
  id             bigint generated always as identity primary key,
  snapshot_id    bigint not null references corte.snapshots(id) on delete cascade,
  user_id        text not null default 'me',
  instrument_id  text not null references corte.instruments(id),
  kind           text not null check (kind in ('fondo','bono','cedear','usd','ars')),
  platform       text not null check (platform in ('fima','broker')),
  ars_value      numeric not null,
  quantity       numeric,
  -- FIMA y broker pueden tener el mismo papel: la plataforma es parte de la clave.
  unique (snapshot_id, instrument_id, platform)
);
create index if not exists positions_snap_idx on corte.positions (snapshot_id);

create table if not exists corte.settings (
  user_id         text primary key default 'me',
  save_usd        numeric not null default 3000,   -- aporte mensual en USD
  mep             numeric not null default 1540,   -- MEP supuesto para proyectar
  months          int     not null default 16,
  us_ann          numeric not null default 10,     -- retorno anual USA %, escenario base
  ars_ann         numeric not null default 30,     -- tasa anual en pesos %
  rebalance       boolean not null default false,
  target_weights  jsonb   not null default '{}'::jsonb,
  updated_at      timestamptz not null default now()
);

create table if not exists corte.memos (
  id           bigint generated always as identity primary key,
  user_id      text not null default 'me',
  -- Borrar el corte no deja el memo colgado apuntando a un id que ya no existe.
  snapshot_id  bigint references corte.snapshots(id) on delete set null,
  body         text not null,
  created_at   timestamptz not null default now()
);
create index if not exists memos_created_idx on corte.memos (created_at desc);

alter table corte.instruments enable row level security;
alter table corte.snapshots   enable row level security;
alter table corte.positions   enable row level security;
alter table corte.settings    enable row level security;
alter table corte.memos       enable row level security;

insert into corte.instruments (id, name, kind, platform, yahoo_symbol, maturity, sort_order) values
  ('fima_premium',     'FIMA Premium',        'fondo',  'fima',   null,    null,         10),
  ('fima_pb_acciones', 'FIMA PB Acciones',    'fondo',  'fima',   null,    null,         20),
  ('fima_renta_plus',  'FIMA Renta Plus',     'fondo',  'fima',   null,    null,         30),
  ('t30j7',            'T30J7',               'bono',   'broker', null,    '2027-06-30', 40),
  ('mu',               'MU — Micron',         'cedear', 'broker', 'MU',    null,         50),
  ('googl',            'GOOGL — Alphabet',    'cedear', 'broker', 'GOOGL', null,         60),
  ('meli',             'MELI — MercadoLibre', 'cedear', 'broker', 'MELI',  null,         70),
  ('xom',              'XOM — Exxon',         'cedear', 'broker', 'XOM',   null,         80),
  ('anet',             'ANET — Arista',       'cedear', 'broker', 'ANET',  null,         90),
  ('usd',              'Dólares',             'usd',    'broker', null,    null,        100),
  ('ars',              'Pesos en caja',       'ars',    'broker', null,    null,        110)
on conflict (id) do nothing;

insert into corte.settings (user_id) values ('me') on conflict (user_id) do nothing;
