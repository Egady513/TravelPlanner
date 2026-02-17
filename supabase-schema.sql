-- Road Trip Planner: Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Trips table: stores the full trip as a document with JSONB for nested data
create table if not exists trips (
  id text primary key,
  name text not null,
  start_date timestamptz not null,
  end_date timestamptz not null,

  -- Wizard preferences (flat columns for easy querying)
  is_loop_trip boolean default false,
  people_count integer default 1,
  has_dog boolean default false,
  trip_pace text default 'balanced',
  max_driving_hours integer default 6,
  driving_preference text default 'flexible',
  planning_style text default 'help',
  budget_style text default 'budget',
  splurge_nights integer default 0,
  is_new_camper boolean default false,
  total_distance real,
  thumbnail_url text,

  -- Nested data as JSONB (days, activities, locations, must-haves, lodging prefs)
  starting_location jsonb,
  ending_location jsonb,
  lodging_preferences jsonb default '[]'::jsonb,
  must_haves jsonb default '[]'::jsonb,
  days jsonb default '[]'::jsonb,

  -- Metadata
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable Row Level Security (required for Supabase)
alter table trips enable row level security;

-- For now, allow all operations without auth (public access via anon key)
-- Replace with proper auth policies when you add user accounts
create policy "Allow public read" on trips for select using (true);
create policy "Allow public insert" on trips for insert with check (true);
create policy "Allow public update" on trips for update using (true);
create policy "Allow public delete" on trips for delete using (true);

-- Index for faster lookups
create index if not exists idx_trips_updated_at on trips (updated_at desc);

-- Auto-update updated_at on row changes
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trips_updated_at
  before update on trips
  for each row
  execute function update_updated_at();
