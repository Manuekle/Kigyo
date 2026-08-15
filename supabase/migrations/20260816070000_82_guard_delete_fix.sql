-- ═══════════════════════════════════════════════════════════════════════════
-- 82 — Los guards de asientos devuelven `old` en DELETE
--
-- La 79 tenía un bug silencioso: ambos triggers son BEFORE INSERT/UPDATE/
-- DELETE y devolvían `new`, que en un DELETE es NULL — y devolver NULL en un
-- trigger BEFORE DELETE cancela el borrado sin error. Resultado: un borrador
-- nunca se podía eliminar, ni por la UI ni por service role, y el cascade de
-- líneas quedaba huérfano de camino.
--
-- Corrección: en DELETE el guard devuelve `old` (borrado permitido) o levanta
-- (asiento publicado). Patrón 57/58: create or replace sobre la ya aplicada.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function app.guard_journal_entry_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'Publicado' then
    raise exception 'un asiento publicado es inmutable; registra un asiento reverso'
      using errcode = 'check_violation';
  end if;
  -- BEFORE DELETE no tiene `new`: devolver NULL cancelaría el borrado en
  -- silencio, así que el borrado permitido devuelve `old`.
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function app.guard_journal_line()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
begin
  select status into v_status
  from public.journal_entries
  where id = coalesce(new.entry_id, old.entry_id);

  if v_status = 'Publicado' then
    raise exception 'las líneas de un asiento publicado no se tocan'
      using errcode = 'check_violation';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback: no aplica — es corrección de funciones existentes.
-- ═══════════════════════════════════════════════════════════════════════════
