"use client";

// =============================================================================
// ReSolve · Rol de administrador de la documentación
// -----------------------------------------------------------------------------
// El rol se guarda en `app_metadata.role = "admin"` del usuario de Supabase.
// `app_metadata` solo puede modificarlo el servidor (SQL editor / service role),
// por lo que un usuario no puede autoconcederse el rol desde el navegador.
//
// Para habilitar a una cuenta, ejecuta el SQL de ADMIN_SETUP_SQL en Supabase.
// =============================================================================

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export function isAdminUser(user: User | null): boolean {
  if (!user) return false;
  const meta = user.app_metadata as Record<string, unknown> | undefined;
  return meta?.role === "admin";
}

export interface DocsAdminState {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
}

/**
 * Observa la sesión de Supabase y expone si la cuenta tiene rol de admin.
 */
export function useDocumentationAdmin(): DocsAdminState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      setUser(data.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  return { user, isAdmin: isAdminUser(user), loading };
}

// -----------------------------------------------------------------------------
// SQL de configuración (se muestra en el diálogo de acceso y en la migración)
// -----------------------------------------------------------------------------
export const SCHEMA_SQL = `-- 1) Tabla de fechas editables (lectura pública, escritura admin)
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
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');`;

export const ROLE_SQL = `-- 2) Convertir una cuenta en administradora (cambia el correo)
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) ||
  jsonb_build_object('role', 'admin')
where email = 'tu-correo@ejemplo.com';`;

export const ADMIN_SETUP_SQL = `${SCHEMA_SQL}\n\n${ROLE_SQL}`;
