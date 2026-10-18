-- Δημιουργεί αυτόματα υπενθυμίσεις 60/30/7 μέρες πριν τη λήξη, για κάθε έγγραφο (upload ή χειροκίνητο).
-- Αν αλλάξει η ημερομηνία ή αρχειοθετηθεί, οι απλήρωτες (μη σταλμένες) ξαναγίνονται από την αρχή.
create or replace function public.sync_reminders() returns trigger as $$
declare
  d int;
begin
  delete from public.reminders where document_id = new.id and sent_at is null;

  if new.expires_on is not null and new.status <> 'archived' then
    foreach d in array array[60, 30, 7] loop
      if new.expires_on - d >= current_date then
        insert into public.reminders (document_id, user_id, remind_on, days_before, channel)
        values (new.id, new.user_id, new.expires_on - d, d, 'email')
        on conflict (document_id, days_before, channel) do nothing;
      end if;
    end loop;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger documents_sync_reminders
  after insert or update of expires_on, status on public.documents
  for each row execute function public.sync_reminders();
