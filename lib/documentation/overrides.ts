"use client";

// =============================================================================
// ReSolve · Fechas editables de los diagramas
// -----------------------------------------------------------------------------
// Las fechas se guardan en `public.diagram_overrides` (una fila por tarea).
// Si la tabla aún no existe o RLS rechaza la escritura, se usa localStorage
// como respaldo para no perder la edición en ese navegador.
// =============================================================================

import { createClient } from "@/lib/supabase/client";
import type { DiagramDef } from "@/lib/documentation/diagrams";

export interface DateOverride {
  start: string;
  end: string;
}

export type OverrideMap = Record<string, DateOverride>;
export type OverrideSource = "remote" | "local";

const LOCAL_KEY = "resolve_docs_date_overrides";

export function overrideKey(diagramId: string, taskId: string): string {
  return `${diagramId}::${taskId}`;
}

function readLocal(): OverrideMap {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as OverrideMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocal(map: OverrideMap): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
  } catch {
    /* sin almacenamiento disponible */
  }
}

function mergeLocal(entries: OverrideMap): void {
  writeLocal({ ...readLocal(), ...entries });
}

/**
 * Lee las fechas efectivas. La nube manda; si falla, se usa el respaldo local.
 */
export async function loadOverrides(): Promise<{
  overrides: OverrideMap;
  source: OverrideSource;
}> {
  const local = readLocal();

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("diagram_overrides")
      .select("diagram_id, task_id, start_date, end_date");

    if (error) return { overrides: local, source: "local" };

    const remote: OverrideMap = {};
    for (const row of data ?? []) {
      remote[overrideKey(row.diagram_id, row.task_id)] = {
        start: row.start_date,
        end: row.end_date,
      };
    }

    // Conserva ediciones locales que todavía no se hayan sincronizado.
    const merged = { ...local, ...remote };
    writeLocal(merged);
    return { overrides: merged, source: "remote" };
  } catch {
    return { overrides: local, source: "local" };
  }
}

export interface SaveRow {
  diagramId: string;
  taskId: string;
  start: string;
  end: string;
}

/**
 * Guarda (upsert) un conjunto de fechas. Devuelve `source` para indicar si
 * quedaron en la nube o solo en el navegador.
 */
export async function saveOverrides(
  rows: SaveRow[],
  userId: string | null,
): Promise<{ ok: boolean; source: OverrideSource; message?: string }> {
  if (!rows.length) return { ok: true, source: "remote" };

  const entries: OverrideMap = {};
  for (const r of rows) {
    entries[overrideKey(r.diagramId, r.taskId)] = { start: r.start, end: r.end };
  }
  mergeLocal(entries);

  try {
    const supabase = createClient();
    // Refresca el token para que RLS reciba el app_metadata.role actualizado.
    await supabase.auth.refreshSession();

    const payload = rows.map((r) => ({
      diagram_id: r.diagramId,
      task_id: r.taskId,
      start_date: r.start,
      end_date: r.end,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    }));

    const { error } = await supabase
      .from("diagram_overrides")
      .upsert(payload, { onConflict: "diagram_id,task_id" });

    if (!error) return { ok: true, source: "remote" };
    return { ok: true, source: "local", message: error.message };
  } catch (e) {
    return {
      ok: true,
      source: "local",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Elimina la fecha personalizada de una tarea (vuelve a la fecha base).
 */
export async function resetOverride(diagramId: string, taskId: string): Promise<void> {
  const key = overrideKey(diagramId, taskId);
  const local = readLocal();
  delete local[key];
  writeLocal(local);

  try {
    const supabase = createClient();
    await supabase
      .from("diagram_overrides")
      .delete()
      .eq("diagram_id", diagramId)
      .eq("task_id", taskId);
  } catch {
    /* el respaldo local ya quedó limpio */
  }
}

/**
 * Elimina todas las fechas personalizadas.
 */
export async function resetAllOverrides(): Promise<void> {
  writeLocal({});
  try {
    const supabase = createClient();
    await supabase.from("diagram_overrides").delete().neq("diagram_id", "");
  } catch {
    /* sin conexión: el respaldo local ya quedó limpio */
  }
}

/**
 * Devuelve una copia de los diagramas con las fechas efectivas aplicadas.
 */
export function applyOverrides(diagrams: DiagramDef[], overrides: OverrideMap): DiagramDef[] {
  return diagrams.map((diagram) => {
    if (diagram.kind !== "gantt" || !diagram.tasks) return diagram;
    return {
      ...diagram,
      tasks: diagram.tasks.map((task) => {
        const override = overrides[overrideKey(diagram.id, task.id)];
        return override ? { ...task, start: override.start, end: override.end } : task;
      }),
    };
  });
}
