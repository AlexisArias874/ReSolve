"use client";

import { useMemo } from "react";
import { ListOrdered, Binary } from "lucide-react";

export interface PropositionRow {
  /** Valores de las variables en esta fila, en orden de `variables` */
  values: boolean[];
  /** Resultado de evaluar la fórmula completa */
  result: boolean;
}

export interface PropositionTableProps {
  /** Nombres de las variables atómicas en orden (ej: ["p", "q", "r"]) */
  variables: string[];
  /** Fórmula original en símbolos (ej: "(p → q) ∧ ¬q") */
  formula?: string;
  /** Clasificación ontológica */
  classification?: "Tautología" | "Contradicción" | "Contingencia";
  /** Filas de la tabla de verdad */
  rows: PropositionRow[];
}

const CLASSIFICATION_STYLES: Record<
  NonNullable<PropositionTableProps["classification"]>,
  { text: string; bg: string; border: string }
> = {
  Tautología: {
    text: "text-emerald-400",
    bg: "bg-emerald-950/30",
    border: "border-emerald-900/50",
  },
  Contradicción: {
    text: "text-red-400",
    bg: "bg-red-950/30",
    border: "border-red-900/40",
  },
  Contingencia: {
    text: "text-amber-400",
    bg: "bg-amber-950/20",
    border: "border-amber-900/40",
  },
};

export default function PropositionTable({
  variables,
  formula,
  classification,
  rows,
}: PropositionTableProps) {
  const stats = useMemo(() => {
    const trueCount = rows.filter((r) => r.result).length;
    return { trueCount, total: rows.length };
  }, [rows]);

  if (!variables.length || !rows.length) {
    return (
      <div className="p-6 rounded-2xl bg-zinc-950/60 border border-dashed border-zinc-800 text-center">
        <Binary size={22} className="mx-auto text-zinc-600 mb-2" />
        <p className="text-xs font-mono text-zinc-500">
          Sin tabla de verdad para mostrar.
        </p>
      </div>
    );
  }

  const style = classification ? CLASSIFICATION_STYLES[classification] : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
          <ListOrdered size={12} />
          Tabla de Verdad · {rows.length} estados
        </span>

        {classification && style && (
          <span
            className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg border ${style.text} ${style.bg} ${style.border}`}
          >
            {classification} ({stats.trueCount}/{stats.total} V)
          </span>
        )}
      </div>

      {formula && (
        <div className="px-3 py-2 rounded-xl bg-zinc-950/70 border border-zinc-800/80 font-mono text-xs text-zinc-200 text-center truncate">
          {formula}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-zinc-800/60 max-h-[420px] overflow-y-auto">
        <table className="w-full text-left font-mono text-xs divide-y divide-zinc-800">
          <thead className="bg-zinc-900/80 text-zinc-400 sticky top-0 z-10">
            <tr>
              <th className="p-2.5 w-10 text-center text-[10px] text-zinc-600">
                #
              </th>
              {variables.map((v) => (
                <th key={v} className="p-2.5 text-center">
                  {v}
                </th>
              ))}
              <th className="p-2.5 text-right text-zinc-100 font-bold">
                Resultado
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/40 bg-zinc-900/20 text-zinc-300">
            {rows.map((row, i) => (
              <tr
                key={i}
                className="hover:bg-zinc-900/40 transition-colors"
              >
                <td className="p-2.5 text-center text-zinc-600 text-[10px]">
                  {i + 1}
                </td>
                {variables.map((_, vIdx) => (
                  <td key={vIdx} className="p-2.5 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        row.values[vIdx]
                          ? "text-emerald-400 bg-emerald-950/30"
                          : "text-zinc-500 bg-zinc-950/50"
                      }`}
                    >
                      {row.values[vIdx] ? "V" : "F"}
                    </span>
                  </td>
                ))}
                <td className="p-2.5 text-right">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono ${
                      row.result
                        ? "text-emerald-400 bg-emerald-950/50 border border-emerald-900/50"
                        : "text-red-400 bg-red-950/30 border border-red-900/40"
                    }`}
                  >
                    {row.result ? "V (1)" : "F (0)"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}