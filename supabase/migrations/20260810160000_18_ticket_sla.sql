-- ═══════════════════════════════════════════════════════════════════════════
-- 18 — SLA deadlines for tickets
--
-- Tickets already carry `priority` ('Alta'/'Media'/'Baja'). This migration
-- adds the deadline the sector needs: `sla_due_at`, re-based whenever the
-- priority changes, so re-prioritising a stuck incident restarts its clock
-- instead of keeping a deadline the team can no longer meet.
--
-- The deadline is derived, never typed by hand: a trigger owns it, so a
-- ticket cannot be created or re-prioritised through any path (UI, API,
-- import) without a coherent due date. Resolved and closed tickets keep the
-- column (it is the record of the promise), but the outage clock stops being
-- displayed once there is nothing left to resolve.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.tickets
  add column sla_due_at timestamptz;

-- Backfill existing tickets from their own creation time, so history is not
-- rewritten with today's deadlines.
update public.tickets
  set sla_due_at = created_at + case priority
    when 'Alta'  then interval '4 hours'
    when 'Media' then interval '24 hours'
    else              interval '72 hours'
  end
  where sla_due_at is null;

create or replace function app.set_ticket_sla() returns trigger
  language plpgsql
  as $$
  begin
    NEW.sla_due_at := now() + case NEW.priority
      when 'Alta'  then interval '4 hours'
      when 'Media' then interval '24 hours'
      else              interval '72 hours'
    end;
    return NEW;
  end;
$$;

drop trigger if exists tickets_sla on public.tickets;

create trigger tickets_sla
  before insert or update of priority
  on public.tickets
  for each row execute function app.set_ticket_sla();