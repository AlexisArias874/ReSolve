"use client";

import { useMemo } from "react";
import { Grid3X3, Info } from "lucide-react";

export interface MatrixBlock {
  /** Etiqueta de la matriz (ej: "A", "b", "A⁻¹") */
  label: string;
  /** Datos en formato array de arrays */
  data: (number | string)[][];
  /** Tipo visual para colorear */
  kind?: "matrix" | "vector" | "result";
}

export interface MatrixTableProps {
  /** Lista de matrices a mostrar en secuencia */
  matrices: MatrixBlock[];
  /** Operación o método (ej: "Gauss-Jordan", "Cramer") */
  operation?: string;
  /** Notas al pie */
  footnote?: string;
}

export default function MatrixTable({
  matrices,
  operation,
  footnote,
}: MatrixTableProps) {
  const normalized = useMemo(
    () =>
      matrices
        .filter((m) => m.data && m.data.length > 0)
        .map((m) => ({
          ...m,
          rows: m.data.length,
          cols: Math.max(...m.data.map((r) => r.length)),
        })),
    [matrices]
  );

  if (normalized.length === 0) {
    return (
      <div className="p-6 rounded-2xl bg-zinc-950/60 border border-dashed border-zinc-800 text-center">
        <Grid3X3 size={22} className="mx-auto text-zinc-600 mb-2" />
        <p className="text-xs font-mono text-zinc-500">
          No hay matrices para mostrar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {operation && (
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400">
          <Grid3X3 size={12} />
          <span>{operation}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {normalized.map((m, idx) => (
          <div
            key={`${m.label}-${idx}`}
            className={`relative p-3 rounded-2xl bg-zinc-950/70 border ${
              m.kind === "result"
                ? "border-emerald-900/60 bg-emerald-950/10"
                : "border-zinc-800/80"
            }`}
          >
            <span
              className={`absolute -top-2.5 left-3 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-wider ${
                m.kind === "result"
                  ? "bg-emerald-950 text-emerald-300 border border-emerald-900/60"
                  : "bg-zinc-900 text-zinc-300 border border-zinc-800"
              }`}
            >
              {m.label}
            </span>

            <table className="font-mono text-xs border-collapse">
              <tbody>
                {m.data.map((row, r) => (
                  <tr key={r}>
                    {Array.from({ length: m.cols }).map((_, c) => (
                      <td
                        key={c}
                        className="px-3 py-1.5 text-center text-zinc-200 border-r border-zinc-800/60 last:border-r-0"
                      >
                        {row[c] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {footnote && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-zinc-950/50 border border-zinc-800/60">
          <Info size={12} className="text-zinc-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
            {footnote}
          </p>
        </div>
      )}
    </div>
  );
}