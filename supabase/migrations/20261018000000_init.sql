-- Life Admin Autopilot: MVP schema (Supabase / Postgres)
-- Εφάρμοσέ το σε Supabase project με region EU.

create extension if not exists "pgcrypto";

-- ---------- Enums ----------
create type document_type as enum (
  'car_insurance','ktel_ktheo','road_tax','passport','id_card','driving_license',
  'home_insurance','health_insurance','warranty','contract','other'
);

create type recurrence as enum ('none','monthly','yearly');
create type document_status as enum ('needs_review','confirmed','archived');
create type lead_status as enum ('new','sent','converted','rejected');

-- ---------- Profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  locale text not null default 'el',
  inbound_token text unique not null default encode(gen_random_bytes(8), 'hex'),
  created_at timestamptz not null default now()
);

-- ---------- Documents (λήξεις) ----------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type document_type not null default 'other',
  title text not null,
  provider text,
  identifier text,                 -- π.χ. πινακίδα οχήματος
  expires_on date,
  amount numeric(10,2),
  currency text not null default 'EUR',
  recurrence recurrence not null default 'none',
  status document_status not null default 'needs_review',
  source text not null check (source in ('upload','email','manual','statement')),
  file_path text,                  -- path στο private storage bucket
  extraction jsonb,                -- ωμή έξοδος AI + confidence (για debugging/βελτίωση)
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_user_expires_idx on public.documents (user_id, expires_on);

-- ---------- Reminders ----------
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  remind_on date not null,
  days_before int not null,
  channel text not null default 'email' check (channel in ('email','push')),
  sent_at timestamptz,
  opened_at timestamptz,
  unique (document_id, days_before, channel)
);

create index reminders_due_idx on public.reminders (remind_on) where sent_at is null;

-- ---------- Subscriptions (από statements) ----------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant text not null,
  amount numeric(10,2) not null,
  currency text not null default 'EUR',
  period recurrence not null default 'monthly',
  last_charged_on date,
  status text not null default 'active' check (status in ('active','cancelled','ignored')),
  created_at timestamptz not null default now()
);

-- ---------- Leads (προσφορές με συναίνεση) ----------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  kind text not null,                       -- π.χ. 'car_insurance'
  payload jsonb not null,                   -- στοιχεία που συμφώνησε να μοιραστεί
  partner text,                             -- σε ποιον στάλθηκε
  consent_at timestamptz not null,          -- ΥΠΟΧΡΕΩΤΙΚΟ: πότε συναίνεσε
  consent_text text not null,               -- το ακριβές κείμενο που είδε
  status lead_status not null default 'new',
  created_at timestamptz not null default now()
);

-- ---------- Events (μετρικές) ----------
create table public.events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,                       -- document_added | reminder_opened | lead_clicked ...
  props jsonb,
  created_at timestamptz not null default now()
);

-- ---------- Row Level Security ----------
alter table public.profiles       enable row level security;
alter table public.documents      enable row level security;
alter table public.reminders      enable row level security;
alter table public.subscriptions  enable row level security;
alter table public.leads          enable row level security;
alter table public.events         enable row level security;

create policy "own profile"       on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "own documents"     on public.documents
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own reminders"     on public.reminders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own subscriptions" on public.subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Τα leads: ο χρήστης μπορεί να τα βλέπει και να τα δημιουργεί, όχι να αλλάζει status
create policy "read own leads"    on public.leads
  for select using (user_id = auth.uid());
create policy "create own leads"  on public.leads
  for insert with check (user_id = auth.uid());

create policy "insert own events" on public.events
  for insert with check (user_id = auth.uid());

-- ---------- Triggers ----------
create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger documents_touch before update on public.documents
  for each row execute function public.touch_updated_at();

-- Αυτόματη δημιουργία profile κατά το signup
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Storage ----------
-- Φτιάξε από το dashboard ένα PRIVATE bucket 'documents' και πρόσθεσε policy ώστε
-- κάθε χρήστης να έχει πρόσβαση μόνο στον φάκελο <user_id>/...
