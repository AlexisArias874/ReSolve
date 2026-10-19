"use client";

// =============================================================================
// ReSolve · Modal de diagrama (pantalla completa)
// -----------------------------------------------------------------------------
// Se renderiza en un portal sobre document.body para quedar por encima del
// header sticky de la página (evita que el título se recorte por arriba).
// Incluye: volver al panel, navegación anterior/siguiente, descarga PNG y cierre.
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  X,
  Info,
  Loader2,
} from "lucide-react";
import { toPng } from "html-to-image";
import { FlowView, ErView, MindView } from "./flow-viewer";
import { GanttView } from "./gantt-viewer";
import SplitText from "@/components/shared/split-text";
import type { DiagramDef } from "@/lib/documentation/diagrams";

export function DiagramViewer({ def }: { def: DiagramDef }) {
  switch (def.kind) {
    case "er":
      return <ErView key={def.id} def={def} />;
    case "mindmap":
      return <MindView key={def.id} def={def} />;
    case "gantt":
      return <GanttView key={def.id} tasks={def.tasks ?? []} />;
    default:
      return <FlowView key={def.id} def={def} />;
  }
}

function Legend({ items }: { items: { label: string; cls: string }[] }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1">
      {items.map((i) => (
        <span
          key={i.label}
          className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wide text-zinc-500"
        >
          <span className={`h-2 w-2 rounded-full ${i.cls}`} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

function DiagramHint({ def }: { def: DiagramDef }) {
  if (def.kind === "flow") {
    return (
      <Legend
        items={[
          { label: "Inicio / Fin", cls: "bg-emerald-400" },
          { label: "Proceso", cls: "bg-zinc-400" },
          { label: "Decisión", cls: "bg-amber-400" },
          { label: "Datos", cls: "bg-sky-400" },
          { label: "Actor", cls: "bg-violet-400" },
          { label: "IA / nota", cls: "bg-fuchsia-400" },
        ]}
      />
    );
  }
  if (def.kind === "er") {
    return (
      <Legend
        items={[
          { label: "PK · clave primaria", cls: "bg-amber-400" },
          { label: "FK · clave foránea", cls: "bg-sky-400" },
          { label: "UK · valor único", cls: "bg-violet-400" },
          { label: "1 : N · cardinalidad", cls: "bg-zinc-400" },
        ]}
      />
    );
  }
  if (def.kind === "mindmap") {
    return (
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
        Usa el botón ▾ / ▸ de cada rama para colapsarla o expandirla. Arrastra el lienzo y usa la
        rueda para acercar.
      </p>
    );
  }
  if (def.kind === "gantt") {
    return (
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
        En planes cortos puedes alternar entre <strong>Calendario</strong> y <strong>Gantt</strong>. En
        el Gantt cambia la escala (Día · Semana · Mes) y desplázate en horizontal; cada barra muestra
        su duración, el relleno claro indica el avance y la línea roja marca el día de hoy.
      </p>
    );
  }
  return null;
}

interface DiagramModalProps {
  def: DiagramDef;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  index?: number;
  total?: number;
}

export function DiagramModal({ def, onClose, onPrev, onNext, index, total }: DiagramModalProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev?.();
      if (e.key === "ArrowRight") onNext?.();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, onPrev, onNext]);

  const handleDownload = async () => {
    if (!bodyRef.current) return;
    setSaving(true);
    try {
      const url = await toPng(bodyRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#09090b",
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = `resolve-${def.id}.png`;
      a.click();
    } catch {
      /* silencioso: algunos navegadores bloquean la captura */
    } finally {
      setSaving(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col bg-zinc-950/97 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      role="dialog"
      aria-modal="true"
      aria-label={def.title}
    >
      {/* Panel superior */}
      <header className="shrink-0 border-b border-zinc-800/80 bg-zinc-950/90 px-4 pb-4 pt-3 sm:px-5">
        {/* Fila 1: navegación y acciones */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            <ArrowLeft size={14} /> Volver al panel
          </Link>

          <div className="flex items-center gap-1.5">
            {index != null && total != null && (
              <span className="mr-1 font-mono text-[11px] text-zinc-500">
                {index + 1} / {total}
              </span>
            )}
            <button
              type="button"
              onClick={onPrev}
              disabled={!onPrev}
              aria-label="Diagrama anterior"
              className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={!onNext}
              aria-label="Diagrama siguiente"
              className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              PNG
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar diagrama"
              className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-100 transition-colors hover:bg-zinc-700"
            >
              <X size={14} /> Cerrar
            </button>
          </div>
        </div>

        {/* Fila 2: identidad del diagrama */}
        <div className="mt-3 min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700/70 bg-zinc-900/70 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
            {def.category}
          </span>

          {/* overflow-visible (hoverEffect="lift") evita que se recorte el
              ascendente de las letras en el efecto rise. */}
          <div className="mt-1.5">
            <SplitText
              tag="h2"
              text={def.title}
              className="font-serif text-xl font-bold leading-tight text-zinc-100 sm:text-2xl"
              effect="rise"
              splitType="chars"
              delay={38}
              duration={1.15}
              staggerFrom="start"
              trigger="load"
              hoverEffect="lift"
              mask={false}
              textAlign="left"
            />
          </div>

          <p className="mt-1 flex max-w-3xl items-start gap-1.5 text-xs leading-relaxed text-zinc-400">
            <Info size={13} className="mt-0.5 shrink-0 text-zinc-500" />
            {def.description}
          </p>

          <DiagramHint def={def} />
        </div>
      </header>

      {/* Cuerpo */}
      <div className="min-h-0 flex-1 p-3 sm:p-5">
        <div
          ref={bodyRef}
          className="h-full w-full overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-950"
        >
          <DiagramViewer def={def} />
        </div>
      </div>
    </motion.div>,
    document.body,
  );
}
