"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Network } from "lucide-react";
import { DiagramModal } from "@/components/docs/diagram-modal";
import { DIAGRAMS } from "@/lib/documentation/diagrams";

interface ManualDiagramProps {
  diagramId: string;
  caption?: string;
  print?: boolean;
}

export default function ManualDiagram({ diagramId, caption, print = false }: ManualDiagramProps) {
  const [open, setOpen] = useState(false);
  const diagram = useMemo(() => DIAGRAMS.find((item) => item.id === diagramId), [diagramId]);

  if (!diagram) return null;

  if (print) {
    return (
      <figure
        style={{
          margin: "18px 0",
          border: "1px solid #c9c5be",
          borderRadius: "4px",
          padding: "14px 16px",
          background: "#faf9f7",
          breakInside: "avoid",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "10px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#57534e",
          }}
        >
          <Network size={13} /> Diagrama
        </div>
        <div style={{ marginTop: "5px", fontFamily: "Georgia, serif", fontSize: "15px", fontWeight: 700, color: "#1c1917" }}>
          {diagram.title}
        </div>
        <p style={{ margin: "4px 0 0", fontSize: "11px", lineHeight: 1.55, color: "#44403c" }}>
          {diagram.description}
        </p>
        <p style={{ margin: "6px 0 0", fontSize: "10px", color: "#78716c" }}>
          El diagrama interactivo se consulta en la sección de Documentación de la plataforma.
        </p>
        {caption && (
          <figcaption style={{ marginTop: "6px", fontSize: "10px", color: "#78716c" }}>
            {caption}
          </figcaption>
        )}
      </figure>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group my-6 flex w-full items-start gap-4 rounded-lg border border-stone-300 bg-white/60 p-5 text-left transition-colors hover:border-stone-500 hover:bg-white"
      >
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-stone-300 bg-stone-100 text-stone-600">
          <Network size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-mono uppercase tracking-[0.16em] text-stone-500">
            Diagrama interactivo
          </span>
          <span className="mt-1 block font-serif text-lg font-semibold text-stone-900">
            {diagram.title}
          </span>
          <span className="mt-1 block text-sm leading-6 text-stone-600">
            {diagram.description}
          </span>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-stone-700">
            Abrir diagrama <ArrowUpRight size={13} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </span>
          {caption && <span className="mt-2 block text-[11px] text-stone-500">{caption}</span>}
        </span>
      </button>

      {open && <DiagramModal def={diagram} onClose={() => setOpen(false)} />}
    </>
  );
}
