-- Landing page waitlist: anon μπορεί μόνο να κάνει insert (καμία ανάγνωση).
create table public.waitlist (
  id bigint generated always as identity primary key,
  email text not null check (length(email) <= 254),
  answer text check (length(answer) <= 500),
  created_at timestamptz not null default now()
);

create unique index waitlist_email_idx on public.waitlist (lower(email));

alter table public.waitlist enable row level security;

create policy "anyone can join waitlist" on public.waitlist
  for insert to anon, authenticated with check (true);
