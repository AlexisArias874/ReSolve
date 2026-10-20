"use client";

// =============================================================================
// ReSolve · Vista de Documentación
// -----------------------------------------------------------------------------
// Cuadrícula de tarjetas (una por diagrama) con filtro por categoría, buscador
// y apertura del visor interactivo en pantalla completa.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Workflow,
  Database,
  GitBranch,
  GanttChartSquare,
  Search,
  Maximize2,
  CalendarCog,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { DiagramModal } from "./diagram-modal";
import { AdminAccessDialog } from "./admin-access";
import { DateEditor } from "./date-editor";
import GlowWrap from "@/components/effects/glow-wrap";
import { useDocumentationAdmin } from "@/lib/documentation/admin";
import {
  applyOverrides,
  loadOverrides,
  type OverrideSource,
} from "@/lib/documentation/overrides";
import { DIAGRAMS, CATEGORIES, type DiagramDef, type DiagramKind } from "@/lib/documentation/diagrams";

const KIND_ICON: Record<DiagramKind, LucideIcon> = {
  flow: Workflow,
  er: Database,
  mindmap: GitBranch,
  gantt: GanttChartSquare,
};

const KIND_LABEL: Record<DiagramKind, string> = {
  flow: "Flujo",
  er: "Entidad-Relación",
  mindmap: "Mapa mental",
  gantt: "Gantt",
};

const CATEGORY_STYLE: Record<string, string> = {
  Organización: "border-violet-400/40 text-violet-200 bg-violet-500/10",
  Planificación: "border-emerald-400/40 text-emerald-200 bg-emerald-500/10",
  Arquitectura: "border-sky-400/40 text-sky-200 bg-sky-500/10",
  "Base de datos": "border-amber-400/40 text-amber-200 bg-amber-500/10",
  UML: "border-fuchsia-400/40 text-fuchsia-200 bg-fuchsia-500/10",
  Calidad: "border-rose-400/40 text-rose-200 bg-rose-500/10",
};

function DiagramCard({ def, index, onOpen }: { def: DiagramDef; index: number; onOpen: () => void }) {
  const Icon = KIND_ICON[def.kind];
  return (
    <GlowWrap radius={16} className="overflow-hidden">
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.35) }}
      className="group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/75 p-5 text-left backdrop-blur-sm transition-colors hover:border-zinc-600/80 hover:bg-zinc-900/90 sm:p-6"
    >
      <div className="mb-5 flex items-start justify-between">
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-700/60 bg-gradient-to-br from-zinc-800/80 to-zinc-900/40 sm:h-16 sm:w-16">
          <Icon size={24} className="text-zinc-300" />
        </div>
        <span className="font-mono text-xs text-zinc-600">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${
            CATEGORY_STYLE[def.category] ?? "border-zinc-700 text-zinc-300 bg-zinc-800/40"
          }`}
        >
          {def.category}
        </span>
        <span className="rounded-full border border-zinc-800 px-2 py-0.5 text-[10px] font-mono text-zinc-500">
          {KIND_LABEL[def.kind]}
        </span>
      </div>

      <h3 className="font-serif text-lg leading-snug text-zinc-100 sm:text-xl">{def.title}</h3>
      <p className="mt-2 flex-1 text-xs leading-relaxed text-zinc-400 sm:text-sm">{def.description}</p>

      <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-300 opacity-70 transition-opacity group-hover:opacity-100 sm:text-sm">
        <Maximize2 size={13} /> Ver diagrama interactivo
      </span>
    </motion.button>
    </GlowWrap>
  );
}

export default function DocsView() {
  const [category, setCategory] = useState<string>("Todos");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<DiagramDef | null>(null);
  const [diagrams, setDiagrams] = useState<DiagramDef[]>(DIAGRAMS);
  const [overrideSource, setOverrideSource] = useState<OverrideSource>("local");
  const [editorOpen, setEditorOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const { user, isAdmin } = useDocumentationAdmin();

  const reloadOverrides = useCallback(async () => {
    const { overrides, source } = await loadOverrides();
    setDiagrams(applyOverrides(DIAGRAMS, overrides));
    setOverrideSource(source);
  }, []);

  useEffect(() => {
    let alive = true;
    loadOverrides().then(({ overrides, source }) => {
      if (!alive) return;
      setDiagrams(applyOverrides(DIAGRAMS, overrides));
      setOverrideSource(source);
    });
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return diagrams.filter((d) => {
      const matchCat = category === "Todos" || d.category === category;
      const matchQ =
        !q ||
        d.title.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        d.id.includes(q);
      return matchCat && matchQ;
    });
  }, [category, query, diagrams]);

  // Navegación circular entre los diagramas visibles (respeta el filtro).
  const activeIndex = active ? filtered.findIndex((d) => d.id === active.id) : -1;
  const step = (delta: number) => {
    if (!filtered.length) return;
    if (activeIndex === -1) {
      setActive(filtered[0]);
      return;
    }
    const next = (activeIndex + delta + filtered.length) % filtered.length;
    setActive(filtered[next]);
  };

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-10 sm:px-6">
      {/* Hero */}
      <div className="mb-8">
        <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-amber-400/90">
          ReSolve · Documentación
        </span>
        <h1 className="mt-3 font-serif text-4xl leading-tight text-zinc-100 sm:text-5xl">
          Diagramas del proyecto
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Explora de forma interactiva la arquitectura, el modelo de datos, los diagramas UML y la
          planificación de ReSolve. Acerca, arrastra y abre cada diagrama a pantalla completa.
        </p>

        {isAdmin && (
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-emerald-300">
              <ShieldCheck size={12} /> Administrador
            </span>
            <GlowWrap radius={8}>
            <button
              type="button"
              onClick={() => setEditorOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-800"
            >
              <CalendarCog size={14} className="text-amber-400" /> Editar fechas
            </button>
            </GlowWrap>
          </div>
        )}
      </div>

      {/* Controles */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {["Todos", ...CATEGORIES].map((c) => {
            const isActive = category === c;
            const count = c === "Todos" ? diagrams.length : diagrams.filter((d) => d.category === c).length;
            return (
              <GlowWrap key={c} radius={9999}>
              <button
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={isActive}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  isActive
                    ? "border-zinc-100 bg-zinc-100 text-zinc-950 font-medium"
                    : "border-zinc-800 bg-zinc-900/70 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                {c}
                <span className={`text-[10px] ${isActive ? "text-zinc-600" : "text-zinc-600"}`}>{count}</span>
              </button>
              </GlowWrap>
            );
          })}
        </div>

        <GlowWrap radius={12}>
        <div className="relative w-full lg:w-72">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar diagrama..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 py-2 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-500 backdrop-blur-sm focus:border-zinc-600 focus:outline-none sm:text-base"
          />
        </div>
        </GlowWrap>
      </div>

      {/* Cuadrícula */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-16 text-center text-sm text-zinc-500">
          No hay diagramas que coincidan con el filtro.
        </div>
      ) : (
        <div className="grid auto-rows-fr gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {filtered.map((def, i) => (
            <DiagramCard key={def.id} def={def} index={i} onOpen={() => setActive(def)} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {active && (
          <DiagramModal
            def={active}
            onClose={() => setActive(null)}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
            index={activeIndex}
            total={filtered.length}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editorOpen && isAdmin && (
          <DateEditor
            diagrams={diagrams}
            user={user}
            source={overrideSource}
            onSaved={reloadOverrides}
            onClose={() => setEditorOpen(false)}
            onOpenAccess={() => {
              setEditorOpen(false);
              setAccessOpen(true);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {accessOpen && <AdminAccessDialog onClose={() => setAccessOpen(false)} />}
      </AnimatePresence>
    </main>
  );
}
