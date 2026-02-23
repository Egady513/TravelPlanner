-- Scout Intelligence: Supabase Schema v2
-- ⚠️ Manual step: run this SQL in Supabase Dashboard > SQL Editor before deploying.

-- 1. Chat message history per trip
create table if not exists scout_messages (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null references trips(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);
create index if not exists idx_scout_messages_trip on scout_messages(trip_id, created_at asc);

-- 2. Applied route changes and other Scout actions
create table if not exists scout_actions (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null references trips(id) on delete cascade,
  action_type text not null,
  description text not null,
  before_snapshot jsonb not null default '{}'::jsonb,
  after_snapshot jsonb not null default '{}'::jsonb,
  applied_at timestamptz default now()
);
create index if not exists idx_scout_actions_trip on scout_actions(trip_id, applied_at asc);

-- 3. Proactive tips per trip (replaces localStorage)
create table if not exists scout_tips (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null references trips(id) on delete cascade,
  tip_key text not null,
  message text not null,
  type text not null check (type in ('warning', 'info', 'suggestion')),
  dismissed boolean default false,
  created_at timestamptz default now(),
  dismissed_at timestamptz,
  unique(trip_id, tip_key)
);
create index if not exists idx_scout_tips_trip on scout_tips(trip_id);

-- 4. Deletion log so Scout never re-recommends removed items
create table if not exists scout_removed_items (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null references trips(id) on delete cascade,
  item_type text not null check (item_type in ('activity', 'day', 'lodging')),
  name text not null,
  reason text,
  removed_at timestamptz default now()
);
create index if not exists idx_scout_removed_trip on scout_removed_items(trip_id);

-- RLS: allow public access (same as trips table — replace with auth policies when ready)
alter table scout_messages enable row level security;
alter table scout_actions enable row level security;
alter table scout_tips enable row level security;
alter table scout_removed_items enable row level security;

create policy "Allow public read" on scout_messages for select using (true);
create policy "Allow public insert" on scout_messages for insert with check (true);
create policy "Allow public update" on scout_messages for update using (true);
create policy "Allow public delete" on scout_messages for delete using (true);

create policy "Allow public read" on scout_actions for select using (true);
create policy "Allow public insert" on scout_actions for insert with check (true);
create policy "Allow public update" on scout_actions for update using (true);
create policy "Allow public delete" on scout_actions for delete using (true);

create policy "Allow public read" on scout_tips for select using (true);
create policy "Allow public insert" on scout_tips for insert with check (true);
create policy "Allow public update" on scout_tips for update using (true);
create policy "Allow public delete" on scout_tips for delete using (true);

create policy "Allow public read" on scout_removed_items for select using (true);
create policy "Allow public insert" on scout_removed_items for insert with check (true);
create policy "Allow public update" on scout_removed_items for update using (true);
create policy "Allow public delete" on scout_removed_items for delete using (true);
