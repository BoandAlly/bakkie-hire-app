-- Bakkie Hire — test backend schema
-- ---------------------------------------------------------------------------
-- Run this once in the Supabase SQL editor (SQL Editor -> New query -> Run).
--
-- SHAPE. The app's data is already JSON-shaped in localStorage, so listings,
-- drivers and customers keep their whole object in a `data` column. That means
-- adding a field to a listing needs no migration here.
--
-- Messages are the exception: they get one ROW each, not an array on the
-- thread. Two phones messaging at the same time would otherwise overwrite each
-- other's array — the exact thing this backend exists to test.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists listings (
  id         text primary key,
  data       jsonb       not null,
  updated_at timestamptz not null default now()
);

create table if not exists drivers (
  email      text primary key,
  data       jsonb       not null,
  updated_at timestamptz not null default now()
);

create table if not exists customers (
  email      text primary key,
  data       jsonb       not null,
  updated_at timestamptz not null default now()
);

create table if not exists threads (
  id             text primary key,
  listing_id     text not null,
  customer_name  text,
  customer_email text,
  created_at     text,                    -- the app's own ISO string, kept verbatim
  updated_at     timestamptz not null default now()
);

-- `sender` rather than `from`: `from` is a reserved word in SQL and would need
-- quoting in every query. The app's own field is still called `from`; the
-- mapping happens in src/lib/sync.js.
--
-- Timestamps the APP generates (sent_at, created_at) are stored as text, not
-- timestamptz. Postgres hands back "+00:00" where the app wrote "Z", and a
-- message's identity is derived from that exact string — the round-trip would
-- mint a duplicate of every message.
create table if not exists messages (
  id         text primary key,
  thread_id  text not null references threads(id) on delete cascade,
  sender     text not null,          -- 'customer' | 'owner'
  body       text,
  sent_at    text not null,          -- ISO string from the app, kept verbatim
  kind       text,                   -- null for a plain line, 'booking' otherwise
  booking    jsonb,                  -- date/time/pickup/dropoff/status/ratings
  updated_at timestamptz not null default now()
);

create index if not exists messages_thread_idx on messages (thread_id, sent_at);
create index if not exists threads_listing_idx on threads (listing_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- TEST SETUP — WIDE OPEN ON PURPOSE.
--
-- Anyone holding the anon key can read and write every row. That is what makes
-- two phones work with no sign-in, and it is fine while the only people with
-- the key are you and your friend.
--
-- It is NOT safe for real users: real auth (Supabase Auth) and per-user
-- policies must replace these before anyone else touches the app.

alter table listings  enable row level security;
alter table drivers   enable row level security;
alter table customers enable row level security;
alter table threads   enable row level security;
alter table messages  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['listings','drivers','customers','threads','messages']
  loop
    execute format('drop policy if exists anon_all on %I', t);
    execute format(
      'create policy anon_all on %I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Realtime — this is what makes the other phone update without a refresh
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['listings','drivers','customers','threads','messages']
  loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then
      null;  -- already published, nothing to do
    end;
  end loop;
end $$;
