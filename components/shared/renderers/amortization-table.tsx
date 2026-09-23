"use client";

import { useMemo } from "react";
import { Wallet, TrendingDown } from "lucide-react";

export interface AmortizationRow {
  /** Número de periodo (mes/cuota) */
  period: number;
  /** Saldo inicial del periodo */
  initialBalance: number;
  /** Cuota o pago del periodo */
  payment: number;
  /** Interés del periodo */
  interest: number;
  /** Amortización a capital */
  principal: number;
  /** Saldo final del periodo */
  finalBalance: number;
}

export interface AmortizationTableProps {
  rows: AmortizationRow[];
  /** Moneda (ej: "MXN", "USD", "$") */
  currency?: string;
  /** Tasa de interés aplicada (ej: "18% anual") */
  rateLabel?: string;
  /** Número total de periodos */
  totalPeriods?: number;
}

function fmt(n: number, currency?: string): string {
  const abs = Math.abs(n).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${currency} ${abs}` : abs;
}

export default function AmortizationTable({
  rows,
  currency = "$",
  rateLabel,
  totalPeriods,
}: AmortizationTableProps) {
  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        payment: acc.payment + r.payment,
        interest: acc.interest + r.interest,
        principal: acc.principal + r.principal,
      }),
      { payment: 0, interest: 0, principal: 0 }
    );
  }, [rows]);

  if (!rows.length) {
    return (
      <div className="p-6 rounded-2xl bg-zinc-950/60 border border-dashed border-zinc-800 text-center">
        <Wallet size={22} className="mx-auto text-zinc-600 mb-2" />
        <p className="text-xs font-mono text-zinc-500">
          Sin tabla de amortización para mostrar.
        </p>
      </div>
    );
  }

  const n = totalPeriods ?? rows.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
          <Wallet size={12} />
          Tabla de Amortización
        </span>
        <span className="text-[10px] font-mono text-zinc-500">
          {n} periodos
          {rateLabel ? ` · ${rateLabel}` : ""}
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-800/60 max-h-[420px] overflow-y-auto">
        <table className="w-full text-left font-mono text-xs divide-y divide-zinc-800">
          <thead className="bg-zinc-900/80 text-zinc-400 sticky top-0 z-10">
            <tr>
              <th className="p-2.5 text-[10px]">#</th>
              <th className="p-2.5 text-zinc-300">Saldo Inicial</th>
              <th className="p-2.5 text-emerald-400">Cuota</th>
              <th className="p-2.5 text-amber-400">Interés</th>
              <th className="p-2.5 text-sky-400">Capital</th>
              <th className="p-2.5 text-zinc-300">Saldo Final</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-zinc-900/30">
                <td className="p-2.5 text-zinc-500">{r.period}</td>
                <td className="p-2.5 text-zinc-200">
                  {fmt(r.initialBalance, currency)}
                </td>
                <td className="p-2.5 text-emerald-400 font-bold">
                  {fmt(r.payment, currency)}
                </td>
                <td className="p-2.5 text-amber-400">
                  {fmt(r.interest, currency)}
                </td>
                <td className="p-2.5 text-sky-400">
                  {fmt(r.principal, currency)}
                </td>
                <td className="p-2.5 text-zinc-200">
                  {fmt(r.finalBalance, currency)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-zinc-900/60 text-zinc-200 font-bold sticky bottom-0">
            <tr>
              <td className="p-2.5 text-[10px]" colSpan={2}>
                TOTALES
              </td>
              <td className="p-2.5 text-emerald-300">
                {fmt(totals.payment, currency)}
              </td>
              <td className="p-2.5 text-amber-300">
                {fmt(totals.interest, currency)}
              </td>
              <td className="p-2.5 text-sky-300">
                {fmt(totals.principal, currency)}
              </td>
              <td className="p-2.5"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-950/50 border border-zinc-800/60">
        <TrendingDown size={12} className="text-amber-400 shrink-0" />
        <p className="text-[11px] text-zinc-400 font-sans">
          Interés total pagado:{" "}
          <strong className="text-amber-400 font-mono">
            {fmt(totals.interest, currency)}
          </strong>
          {" · "}
          Capital total amortizado:{" "}
          <strong className="text-sky-400 font-mono">
            {fmt(totals.principal, currency)}
          </strong>
        </p>
      </div>
    </div>
  );
}