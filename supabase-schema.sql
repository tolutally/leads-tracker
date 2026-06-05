-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create extension if not exists "pgcrypto";

create table if not exists accounts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Untitled',
  deal_type   text not null default 'Buyer',
  stage       text not null default 'New',
  next_action text default '',
  contacts    jsonb not null default '[]'::jsonb,
  timeline    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists accounts_updated_idx on accounts (updated_at desc);

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('angle','problem')),
  label text not null,
  created_at timestamptz not null default now(),
  unique (kind, label)
);

-- Row Level Security is intentionally left OFF: this app never exposes the
-- Supabase anon key to the browser. All reads/writes go through Next.js server
-- routes using the service-role key, and the whole app sits behind a password
-- gate. If you later add multi-user Supabase Auth, turn RLS on and add policies.
