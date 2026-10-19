-- =============================================================================
-- ReSolve · Documentación interactiva — fechas editables por administradores
-- -----------------------------------------------------------------------------
-- Ejecuta este archivo en el SQL Editor de Supabase.
--   1. Crea la tabla `public.diagram_overrides`.
--   2. Define RLS: lectura pública y escritura solo para `role = "admin"`.
--   3. Convierte una cuenta en administradora (cambia el correo del final).
-- =============================================================================

-- 1) Tabla de fechas editables -------------------------------------------------
create table if not exists public.diagram_overrides (
  diagram_id  text not null,
  task_id     text not null,
  start_date  date not null,
  end_date    date not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null,
  primary key (diagram_id, task_id)
);

alter table public.diagram_overrides enable row level security;

grant select on public.diagram_overrides to anon, authenticated;
grant insert, update, delete on public.diagram_overrides to authenticated;

-- 2) Políticas RLS -------------------------------------------------------------
drop policy if exists "diagram_overrides_read" on public.diagram_overrides;
create policy "diagram_overrides_read"
  on public.diagram_overrides for select
  using (true);

drop policy if exists "diagram_overrides_insert" on public.diagram_overrides;
create policy "diagram_overrides_insert"
  on public.diagram_overrides for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "diagram_overrides_update" on public.diagram_overrides;
create policy "diagram_overrides_update"
  on public.diagram_overrides for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "diagram_overrides_delete" on public.diagram_overrides;
create policy "diagram_overrides_delete"
  on public.diagram_overrides for delete to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 3) Conceder el rol de administrador -----------------------------------------
-- Cambia el correo por el de la cuenta que administrará la documentación.
-- Después de ejecutarlo, cierra sesión y vuelve a entrar (o recarga la página).
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) ||
  jsonb_build_object('role', 'admin')
where email = 'tu-correo@ejemplo.com';
