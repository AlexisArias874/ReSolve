"use client";

// =============================================================================
// ReSolve · Nodos personalizados para React Flow
// -----------------------------------------------------------------------------
// Tres tipos de nodo: "doc" (flujo/proceso), "entity" (modelo E-R) y "mind"
// (mapa mental del Ishikawa, con colapso de ramas). Todos dibujan 4 handles
// (t,b,l,r) para que el layout TB/LR pueda conectar por el lado correcto.
// =============================================================================

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ChevronDown, ChevronRight, KeyRound } from "lucide-react";
import type { Tone, ErField } from "@/lib/documentation/diagrams";

const TONES: Record<Tone, string> = {
  actor: "border-violet-400/50 bg-violet-500/10",
  start: "border-emerald-400/50 bg-emerald-500/10",
  end: "border-rose-400/50 bg-rose-500/10",
  process: "border-zinc-600/70 bg-zinc-800/70",
  decision: "border-amber-400/50 bg-amber-500/10",
  data: "border-sky-400/50 bg-sky-500/10",
  note: "border-fuchsia-400/40 bg-fuchsia-500/10",
};

const ACCENT: Record<Tone, string> = {
  actor: "text-violet-200",
  start: "text-emerald-200",
  end: "text-rose-200",
  process: "text-zinc-100",
  decision: "text-amber-200",
  data: "text-sky-200",
  note: "text-fuchsia-200",
};

const HANDLE = "!h-1.5 !w-1.5 !bg-zinc-400 !border-0";

function Ports() {
  return (
    <>
      <Handle id="t" type="target" position={Position.Top} className={HANDLE} />
      <Handle id="b" type="source" position={Position.Bottom} className={HANDLE} />
      <Handle id="l" type="target" position={Position.Left} className={HANDLE} />
      <Handle id="r" type="source" position={Position.Right} className={HANDLE} />
    </>
  );
}

interface DocData extends Record<string, unknown> {
  label: string;
  sub?: string;
  tone?: Tone;
}

export function DocNodeView({ data }: NodeProps) {
  const { label, sub, tone = "process" } = data as DocData;
  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center rounded-xl border px-3 py-1.5 text-center shadow-sm backdrop-blur-sm ${TONES[tone]}`}
    >
      <Ports />
      <span className={`text-[12.5px] font-semibold leading-tight ${ACCENT[tone]}`}>{label}</span>
      {sub ? <span className="mt-0.5 text-[10.5px] leading-tight text-zinc-400">{sub}</span> : null}
    </div>
  );
}

interface EntityData extends Record<string, unknown> {
  name: string;
  fields: ErField[];
  tone?: Tone;
}

export function EntityNodeView({ data }: NodeProps) {
  const { name, fields, tone = "process" } = data as EntityData;
  return (
    <div
      className={`h-full w-full overflow-hidden rounded-xl border bg-zinc-900/85 shadow-lg backdrop-blur-sm ${TONES[tone]}`}
    >
      <Ports />
      <div
        className={`border-b border-white/10 bg-white/5 px-3 py-1.5 text-[11.5px] font-bold uppercase tracking-wide ${ACCENT[tone]}`}
      >
        {name}
      </div>
      <ul className="p-1.5">
        {fields.map((f) => (
          <li
            key={f.name}
            className="flex items-center justify-between gap-2 rounded px-1.5 py-0.5 text-[11.5px] leading-tight"
          >
            <span className="flex items-center gap-1 font-mono text-zinc-200">
              {f.key ? <KeyRound size={10} className="text-amber-400" /> : null}
              {f.name}
            </span>
            <span className="font-mono text-[10.5px] text-zinc-500">
              {f.key ? <span className="mr-1 text-amber-300">{f.key}</span> : null}
              {f.type}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface MindData extends Record<string, unknown> {
  label: string;
  depth: number;
  hasChildren: boolean;
  collapsed: boolean;
  onToggle?: (id: string) => void;
  nodeId: string;
}

export function MindNodeView({ id, data }: NodeProps) {
  const { label, depth, hasChildren, collapsed, onToggle } = data as MindData;
  const isRoot = depth === 0;
  const isBranch = depth === 1;

  const styles = isRoot
    ? "border-amber-400/60 bg-amber-500/15 text-amber-100"
    : isBranch
      ? "border-violet-400/50 bg-violet-500/12 text-violet-100"
      : "border-zinc-600/70 bg-zinc-800/70 text-zinc-200";

  return (
    <div className={`flex h-full w-full items-center gap-2 rounded-xl border px-3 py-2 shadow-sm ${styles}`}>
      <Ports />
      {hasChildren ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.(id);
          }}
          aria-label={collapsed ? "Expandir rama" : "Colapsar rama"}
          className="shrink-0 rounded-md border border-white/10 bg-white/5 p-0.5 text-zinc-300 hover:bg-white/10"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        </button>
      ) : null}
      <span className={`text-left leading-tight ${isRoot ? "text-[13px] font-bold" : isBranch ? "text-[12.5px] font-semibold" : "text-[11.5px]"}`}>
        {label}
      </span>
    </div>
  );
}
