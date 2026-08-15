-- ═══════════════════════════════════════════════════════════════════════════
-- 58 — Las funciones de avance de obra viven en `public`
--
-- La migración 57 las creó en `app`, que es el esquema de los helpers que
-- solo se llaman desde SQL. PostgREST solo expone funciones de esquemas
-- expuestos (public, storage, graphql_public), así que `supabase.rpc()` no
-- podía verlas: el registro de avance desde la pantalla fallaba con
-- «function not found».
--
-- Se recrean en `public` (security invoker, RLS intacta) y se botan las
-- versiones de `app`. `create or replace` hace la migración idempotente,
-- de modo que en una base fresca (donde la 57 ya las creó en public) esto
-- es un no-op limpio.
-- ═══════════════════════════════════════════════════════════════════════════

drop function if exists app.obra_register_avance(uuid, date, numeric, numeric, text);
drop function if exists app.obra_delete_avance(uuid);
drop function if exists app.obra_resync_presupuesto(uuid);

create or replace function public.obra_register_avance(
  p_capitulo_id uuid,
  p_fecha date,
  p_avance numeric,
  p_valor numeric,
  p_notas text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org uuid;
  v_presupuesto uuid;
  v_id uuid;
begin
  select org_id, presupuesto_id into v_org, v_presupuesto
  from public.obra_capitulos where id = p_capitulo_id;

  if not found then
    raise exception 'capitulo no encontrado';
  end if;

  insert into public.obra_avances (org_id, capitulo_id, fecha, avance, valor, notas)
  values (v_org, p_capitulo_id, p_fecha, p_avance, p_valor, p_notas)
  returning id into v_id;

  update public.obra_capitulos set valor_ejecutado = p_valor
  where id = p_capitulo_id;

  update public.obra_presupuestos
  set valor_ejecutado = (
    select coalesce(sum(valor_ejecutado), 0)
    from public.obra_capitulos
    where presupuesto_id = v_presupuesto
  )
  where id = v_presupuesto;

  return v_id;
end;
$$;

create or replace function public.obra_delete_avance(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_capitulo uuid;
  v_presupuesto uuid;
begin
  select c.id, c.presupuesto_id into v_capitulo, v_presupuesto
  from public.obra_avances a
  join public.obra_capitulos c on c.id = a.capitulo_id
  where a.id = p_id;

  if not found then
    return;
  end if;

  delete from public.obra_avances where id = p_id;

  update public.obra_capitulos
  set valor_ejecutado = coalesce((
    select a.valor
    from public.obra_avances a
    where a.capitulo_id = v_capitulo
    order by a.fecha desc, a.created_at desc
    limit 1
  ), 0)
  where id = v_capitulo;

  update public.obra_presupuestos
  set valor_ejecutado = (
    select coalesce(sum(valor_ejecutado), 0)
    from public.obra_capitulos
    where presupuesto_id = v_presupuesto
  )
  where id = v_presupuesto;
end;
$$;

create or replace function public.obra_resync_presupuesto(p_presupuesto_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.obra_presupuestos
  set valor_ejecutado = (
    select coalesce(sum(valor_ejecutado), 0)
    from public.obra_capitulos
    where presupuesto_id = p_presupuesto_id
  )
  where id = p_presupuesto_id;
end;
$$;

revoke all on function public.obra_register_avance(uuid, date, numeric, numeric, text) from public, anon;
grant execute on function public.obra_register_avance(uuid, date, numeric, numeric, text) to authenticated;
revoke all on function public.obra_delete_avance(uuid) from public, anon;
grant execute on function public.obra_delete_avance(uuid) to authenticated;
revoke all on function public.obra_resync_presupuesto(uuid) from public, anon;
grant execute on function public.obra_resync_presupuesto(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   -- (las funciones volverían a app, si hiciera falta)
-- ═══════════════════════════════════════════════════════════════════════════
