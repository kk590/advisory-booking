-- Run in Supabase SQL Editor
create table if not exists public.bookings (
  id bigint generated always as identity primary key,
  txn_id text unique not null,
  booking_id text,
  name text,
  email text,
  phone text,
  duration int,
  date text,
  time text,
  amount numeric,
  status text default 'PENDING',
  upi_note text,
  meet_link text,
  created_at timestamptz default now()
);

alter table public.bookings enable row level security;

-- Beginner-friendly policies (tighten later)
do $$ begin
  create policy "anon insert bookings" on public.bookings for insert to anon with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "anon select bookings" on public.bookings for select to anon using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "anon update bookings" on public.bookings for update to anon using (true) with check (true);
exception when duplicate_object then null; end $$;
