create table if not exists public.study_review_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.study_review_snapshots enable row level security;

grant select, insert, update, delete on public.study_review_snapshots to authenticated;

drop policy if exists "Users can read own study snapshot" on public.study_review_snapshots;
drop policy if exists "Users can insert own study snapshot" on public.study_review_snapshots;
drop policy if exists "Users can update own study snapshot" on public.study_review_snapshots;
drop policy if exists "Users can delete own study snapshot" on public.study_review_snapshots;

create policy "Users can read own study snapshot"
  on public.study_review_snapshots
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own study snapshot"
  on public.study_review_snapshots
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own study snapshot"
  on public.study_review_snapshots
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own study snapshot"
  on public.study_review_snapshots
  for delete
  using (auth.uid() = user_id);
