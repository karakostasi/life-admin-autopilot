-- Οχήματα: τα έγγραφα οχήματος (ασφάλεια, ΚΤΕΟ, τέλη) συνδέονται με ένα όχημα αντί για ελεύθερο κείμενο πινακίδας.

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'car' check (kind in ('car','motorcycle')),
  plate text not null,
  plate_key text not null,          -- κανονικοποιημένη πινακίδα (ίδια λογική με το plateKey στο src/lib/vehicles.ts)
  model text,                       -- π.χ. "Yamaha Tracer 700"
  created_at timestamptz not null default now(),
  unique (user_id, plate_key)
);

alter table public.vehicles enable row level security;
create policy "own vehicles" on public.vehicles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.documents add column vehicle_id uuid references public.vehicles(id) on delete set null;
create index documents_vehicle_idx on public.documents (vehicle_id);

-- ---------- Backfill από τα υπάρχοντα έγγραφα (μόνο τύποι οχήματος, όχι διαβατήρια/ταυτότητες) ----------
create function pg_temp.plate_key(p text) returns text language sql immutable as $$
  select regexp_replace(
    translate(upper(regexp_replace(coalesce(p, ''), '[\s-]+', '', 'g')), 'ΑΒΕΖΗΙΚΜΝΟΡΤΥΧ', 'ABEZHIKMNOPTYX'),
    '(^|[^0-9])0+([0-9])', '\1\2', 'g')
$$;

insert into public.vehicles (user_id, kind, plate, plate_key)
select user_id,
       case when bool_or(type = 'motorcycle_insurance') then 'motorcycle' else 'car' end,
       (array_agg(trim(identifier) order by created_at desc))[1],
       pg_temp.plate_key(identifier)
from public.documents
where type in ('car_insurance','motorcycle_insurance','ktel_ktheo','road_tax')
  and nullif(trim(identifier), '') is not null
  and pg_temp.plate_key(identifier) <> ''
group by user_id, pg_temp.plate_key(identifier)
on conflict (user_id, plate_key) do nothing;

update public.documents d
set vehicle_id = v.id
from public.vehicles v
where v.user_id = d.user_id
  and d.type in ('car_insurance','motorcycle_insurance','ktel_ktheo','road_tax')
  and nullif(trim(d.identifier), '') is not null
  and v.plate_key = pg_temp.plate_key(d.identifier);
