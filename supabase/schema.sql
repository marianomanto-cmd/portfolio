-- Corte — book tables (run in Supabase SQL editor)
-- Auth tables are managed by Better Auth on the Grok deploy.

create table if not exists snapshots (
  id serial primary key,
  user_id text not null,
  source text not null default 'mixed',
  taken_at date not null default current_date,
  mep numeric not null default 1540,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists snapshots_user_idx on snapshots (user_id, created_at desc);

create table if not exists positions (
  id serial primary key,
  snapshot_id int not null references snapshots(id) on delete cascade,
  user_id text not null,
  instrument_id text not null,
  name text not null,
  kind text not null,
  platform text not null,
  ars_value numeric not null,
  quantity numeric
);
create index if not exists positions_snap_idx on positions (snapshot_id);
create index if not exists positions_user_idx on positions (user_id);

create table if not exists settings (
  user_id text primary key,
  save_usd numeric not null default 3000,
  mep numeric not null default 1540,
  months int not null default 16,
  us_ann numeric not null default 10,
  rebalance boolean not null default false,
  target_weights jsonb not null default '{}'::jsonb
);

create table if not exists memos (
  id serial primary key,
  user_id text not null,
  snapshot_id int,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists memos_user_idx on memos (user_id, created_at desc);
