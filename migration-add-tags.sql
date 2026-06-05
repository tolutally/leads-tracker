create extension if not exists "pgcrypto";

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('angle','problem')),
  label text not null,
  created_at timestamptz not null default now(),
  unique (kind, label)
);
