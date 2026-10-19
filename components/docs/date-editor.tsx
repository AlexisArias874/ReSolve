"use client";

// =============================================================================
// ReSolve · Editor de fechas de los calendarios (solo administradores)
// -----------------------------------------------------------------------------
// Permite ajustar inicio/fin de cada tarea de los diagramas Gantt. Guarda en
// Supabase y, si la nube no está disponible, en localStorage como respaldo.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import type { User } from "@supabase/supabase-js";
import {
  CalendarCog,
  Check,
  Cloud,
  HardDrive,
  Loader2,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import { DIAGRAMS, type DiagramDef, type GanttTask } from "@/lib/documentation/diagrams";
import {
  overrideKey,
  resetAllOverrides,
  resetOverride,
  saveOverrides,
  type OverrideSource,
  type SaveRow,
} from "@/lib/documentation/overrides";

interface DateEditorProps {
  diagrams: DiagramDef[];
  user: User | null;
  source: OverrideSource;
  onSaved: () => Promise<void> | void;
  onClose: () => void;
  onOpenAccess: () => void;
}

type Draft = { start: string; end: string };
type Message = { tone: "ok" | "warn" | "error"; text: string } | null;

function initialDrafts(diagrams: DiagramDef[]): Record<string, Draft> {
  const drafts: Record<string, Draft> = {};
  for (const diagram of diagrams) {
    if (diagram.kind !== "gantt" || !diagram.tasks) continue;
    for (const task of diagram.tasks) {
      drafts[overrideKey(diagram.id, task.id)] = { start: task.start, end: task.end };
    }
  }
  return drafts;
}

function defaultValue(diagramId: string, taskId: string): Draft | null {
  const diagram = DIAGRAMS.find((d) => d.id === diagramId);
  const task = diagram?.tasks?.find((t) => t.id === taskId);
  return task ? { start: task.start, end: task.end } : null;
}

function groupBySection(tasks: GanttTask[]): { section: string; tasks: GanttTask[] }[] {
  const order: string[] = [];
  for (const t of tasks) if (!order.includes(t.section)) order.push(t.section);
  return order.map((section) => ({
    section,
    tasks: tasks.filter((t) => t.section === section),
  }));
}

export function DateEditor({
  diagrams,
  user,
  source,
  onSaved,
  onClose,
  onOpenAccess,
}: DateEditorProps) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => initialDrafts(diagrams));
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, saving]);

  const ganttDiagrams = useMemo(
    () => diagrams.filter((d) => d.kind === "gantt" && d.tasks && d.tasks.length > 0),
    [diagrams],
  );

  const invalidKeys = useMemo(() => {
    const bad = new Set<string>();
    for (const diagram of ganttDiagrams) {
      for (const task of diagram.tasks ?? []) {
        const draft = drafts[overrideKey(diagram.id, task.id)];
        if (!draft || !draft.start || !draft.end || draft.start > draft.end) {
          bad.add(overrideKey(diagram.id, task.id));
        }
      }
    }
    return bad;
  }, [ganttDiagrams, drafts]);

  const update = (key: string, field: keyof Draft, value: string) => {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
    setMessage(null);
  };

  const handleSave = async () => {
    if (invalidKeys.size > 0 || saving) return;
    setSaving(true);
    setMessage(null);

    const rows: SaveRow[] = [];
    for (const diagram of ganttDiagrams) {
      for (const task of diagram.tasks ?? []) {
        const draft = drafts[overrideKey(diagram.id, task.id)];
        if (!draft) continue;
        rows.push({
          diagramId: diagram.id,
          taskId: task.id,
          start: draft.start,
          end: draft.end,
        });
      }
    }

    const result = await saveOverrides(rows, user?.id ?? null);
    await onSaved();
    setSaving(false);

    if (result.source === "remote") {
      setMessage({ tone: "ok", text: "Fechas guardadas. Ya son visibles para todos los visitantes." });
    } else {
      setMessage({
        tone: "warn",
        text: "Guardado solo en este navegador. Crea la tabla en Supabase para compartirlo.",
      });
    }
  };

  const handleResetRow = async (diagramId: string, taskId: string) => {
    const key = overrideKey(diagramId, taskId);
    const base = defaultValue(diagramId, taskId);
    await resetOverride(diagramId, taskId);
    if (base) setDrafts((prev) => ({ ...prev, [key]: base }));
    await onSaved();
    setMessage({ tone: "ok", text: "Fecha restablecida al valor original." });
  };

  const handleResetAll = async () => {
    if (!window.confirm("¿Restablecer todas las fechas a los valores originales?")) return;
    setResetting(true);
    await resetAllOverrides();
    setDrafts(initialDrafts(DIAGRAMS));
    await onSaved();
    setResetting(false);
    setMessage({ tone: "ok", text: "Todas las fechas volvieron a los valores originales." });
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-zinc-950/85 p-3 backdrop-blur-md sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Editar fechas de los calendarios"
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-zinc-800/80 px-5 py-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-serif text-xl text-zinc-100">
              <CalendarCog size={19} className="text-amber-400" /> Editar fechas
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-emerald-300">
                <ShieldCheck size={11} /> admin
              </span>
              {user?.email ? <span className="font-mono text-[11px]">{user.email}</span> : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar editor"
            className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {source === "local" && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
              <span className="flex items-center gap-1.5">
                <HardDrive size={13} /> Modo local: los cambios se guardan solo en este navegador.
              </span>
              <button
                type="button"
                onClick={onOpenAccess}
                className="rounded-md border border-amber-400/40 px-2 py-1 font-medium text-amber-100 hover:bg-amber-500/20"
              >
                Configurar Supabase
              </button>
            </div>
          )}

          {source === "remote" && (
            <div className="flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-300/90">
              <Cloud size={13} /> Conectado a Supabase: los cambios serán visibles para todos.
            </div>
          )}

          {ganttDiagrams.map((diagram) => (
            <section key={diagram.id} className="space-y-2">
              <div>
                <h3 className="font-serif text-base text-zinc-100">{diagram.title}</h3>
                <p className="text-[11px] text-zinc-500">{diagram.description}</p>
              </div>

              {groupBySection(diagram.tasks ?? []).map((group) => (
                <div key={group.section} className="space-y-1.5">
                  <p className="pt-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                    {group.section}
                  </p>
                  {group.tasks.map((task) => {
                    const key = overrideKey(diagram.id, task.id);
                    const draft = drafts[key] ?? { start: task.start, end: task.end };
                    const bad = invalidKeys.has(key);
                    const diff = Date.parse(draft.end) - Date.parse(draft.start);
                    const days = Number.isFinite(diff) ? Math.round(diff / 86_400_000) + 1 : null;
                    return (
                      <div
                        key={task.id}
                        className={`grid grid-cols-1 gap-2 rounded-xl border p-2.5 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center ${
                          bad
                            ? "border-rose-500/50 bg-rose-500/5"
                            : "border-zinc-800/70 bg-zinc-900/40"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[12px] text-zinc-200" title={task.name}>
                            {task.name}
                          </p>
                          <p className="mt-0.5 truncate font-mono text-[9.5px] text-zinc-500">
                            {task.detail ??
                              (days && days > 0
                                ? `${days} ${days === 1 ? "día" : "días"}`
                                : "Fecha incompleta")}
                            {bad ? " · la fecha final debe ser igual o posterior" : ""}
                          </p>
                        </div>

                        <input
                          type="date"
                          value={draft.start}
                          onChange={(e) => update(key, "start", e.target.value)}
                          aria-label={`Inicio de ${task.name}`}
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[11px] text-zinc-200 [color-scheme:dark] focus:border-zinc-600 focus:outline-none sm:w-36"
                        />
                        <input
                          type="date"
                          value={draft.end}
                          onChange={(e) => update(key, "end", e.target.value)}
                          aria-label={`Fin de ${task.name}`}
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[11px] text-zinc-200 [color-scheme:dark] focus:border-zinc-600 focus:outline-none sm:w-36"
                        />

                        <button
                          type="button"
                          onClick={() => handleResetRow(diagram.id, task.id)}
                          disabled={resetting || saving}
                          aria-label={`Restablecer ${task.name}`}
                          title="Restablecer fecha original"
                          className="justify-self-start rounded-lg border border-zinc-800 p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50 sm:justify-self-auto"
                        >
                          <RotateCcw size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </section>
          ))}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/80 px-5 py-3">
          <button
            type="button"
            onClick={handleResetAll}
            disabled={saving || resetting}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
          >
            {resetting ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
            Restablecer todo
          </button>

          <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
            {message && (
              <span
                className={`flex items-center gap-1.5 text-[11px] ${
                  message.tone === "ok"
                    ? "text-emerald-300"
                    : message.tone === "warn"
                      ? "text-amber-300"
                      : "text-rose-300"
                }`}
              >
                {message.tone === "ok" ? (
                  <Check size={13} />
                ) : message.tone === "warn" ? (
                  <TriangleAlert size={13} />
                ) : (
                  <X size={13} />
                )}
                {message.text}
              </span>
            )}

            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-2 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || invalidKeys.size > 0}
              className="flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-xs font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              Guardar cambios
            </button>
          </div>
        </footer>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
