"use client";

import { useMemo } from "react";
import { Table as TableIcon } from "lucide-react";

export interface FrequencyRow {
  /** Intervalo inferior */
  lower: number;
  /** Intervalo superior */
  upper: number;
  /** Marca de clase */
  classMark?: number;
  /** Frecuencia absoluta */
  absFreq: number;
  /** Frecuencia relativa (0..1) */
  relFreq?: number;
  /** Frecuencia relativa en % */
  pctFreq?: number;
  /** Frecuencia acumulada ascendente */
  cumAbsAsc?: number;
  /** Frecuencia acumulada en % */
  cumPctAsc?: number;
}

export interface FrequencyTableProps {
  /** Filas de la distribución */
  rows: FrequencyRow[];
  /** Etiqueta de la variable medida (ej: "Tiempo de respuesta (ms)") */
  variableLabel?: string;
  /** Estadísticas agrupadas para el resumen */
  groupedMean?: number;
  groupedMedian?: number;
  groupedMode?: number;
  /** Amplitud de clase */
  classWidth?: number;
  /** Número total de observaciones */
  n?: number;
}

export default function FrequencyTable({
  rows,
  variableLabel,
  groupedMean,
  groupedMedian,
  groupedMode,
  classWidth,
  n,
}: FrequencyTableProps) {
  const hasMetrics =
    groupedMean !== undefined ||
    groupedMedian !== undefined ||
    groupedMode !== undefined;

  const detectedN = useMemo(() => {
    if (n !== undefined) return n;
    return rows.reduce((acc, r) => acc + r.absFreq, 0);
  }, [rows, n]);

  if (!rows.length) {
    return (
      <div className="p-6 rounded-2xl bg-zinc-950/60 border border-dashed border-zinc-800 text-center">
        <TableIcon size={22} className="mx-auto text-zinc-600 mb-2" />
        <p className="text-xs font-mono text-zinc-500">
          Sin tabla de frecuencias para mostrar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
          <TableIcon size={12} />
          Distribución de Frecuencias
          {variableLabel ? ` · ${variableLabel}` : ""}
        </span>
        <span className="text-[10px] font-mono text-zinc-500">
          n = {detectedN}
          {classWidth !== undefined ? ` · c = ${classWidth}` : ""}
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-800/60 max-h-[420px] overflow-y-auto">
        <table className="w-full text-left font-mono text-xs divide-y divide-zinc-800">
          <thead className="bg-zinc-900/80 text-zinc-400 sticky top-0 z-10">
            <tr>
              <th className="p-2.5 text-[10px]">#</th>
              <th className="p-2.5">Intervalo</th>
              {rows[0]?.classMark !== undefined && (
                <th className="p-2.5 text-zinc-300">xᵢ</th>
              )}
              <th className="p-2.5 text-emerald-400">fᵢ</th>
              {rows[0]?.relFreq !== undefined && (
                <th className="p-2.5 text-zinc-400">hᵢ</th>
              )}
              {rows[0]?.pctFreq !== undefined && (
                <th className="p-2.5 text-amber-400">hᵢ %</th>
              )}
              {rows[0]?.cumAbsAsc !== undefined && (
                <th className="p-2.5 text-sky-400">Fᵢ</th>
              )}
              {rows[0]?.cumPctAsc !== undefined && (
                <th className="p-2.5 text-zinc-400">Hᵢ %</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-zinc-900/30">
                <td className="p-2.5 text-zinc-500 text-[10px]">{i + 1}</td>
                <td className="p-2.5 font-bold text-sky-400">
                  [{r.lower}, {r.upper})
                </td>
                {r.classMark !== undefined && (
                  <td className="p-2.5 text-zinc-200">{r.classMark}</td>
                )}
                <td className="p-2.5 text-emerald-400 font-bold">
                  {r.absFreq}
                </td>
                {r.relFreq !== undefined && (
                  <td className="p-2.5 text-zinc-400">
                    {r.relFreq.toFixed(4)}
                  </td>
                )}
                {r.pctFreq !== undefined && (
                  <td className="p-2.5 text-amber-400">{r.pctFreq}%</td>
                )}
                {r.cumAbsAsc !== undefined && (
                  <td className="p-2.5 text-sky-300 font-semibold">
                    {r.cumAbsAsc}
                  </td>
                )}
                {r.cumPctAsc !== undefined && (
                  <td className="p-2.5 text-zinc-400">{r.cumPctAsc}%</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMetrics && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
          {groupedMean !== undefined && (
            <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
              <span className="text-[10px] text-zinc-500 block">
                Media Agrupada (x̄)
              </span>
              <strong className="text-sm text-emerald-400">
                {groupedMean}
              </strong>
            </div>
          )}
          {groupedMedian !== undefined && (
            <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
              <span className="text-[10px] text-zinc-500 block">
                Mediana (Me)
              </span>
              <strong className="text-sm text-amber-400">
                {groupedMedian}
              </strong>
            </div>
          )}
          {groupedMode !== undefined && (
            <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
              <span className="text-[10px] text-zinc-500 block">
                Moda (Mo)
              </span>
              <strong className="text-sm text-purple-400">
                {groupedMode}
              </strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}