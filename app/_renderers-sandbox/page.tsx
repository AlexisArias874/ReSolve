"use client";

import {
  MatrixTable,
  PropositionTable,
  FrequencyTable,
  AmortizationTable,
} from "@/components/shared/renderers";

export default function RenderersSandbox() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 space-y-8">
      <h1 className="text-2xl font-serif font-bold">
        Renderers Sandbox · Checkpoint 3
      </h1>

      <section className="border border-zinc-800 rounded-3xl p-6 bg-zinc-900/30">
        <h2 className="text-sm font-mono text-amber-400 uppercase tracking-wider mb-4">
          1. MatrixTable
        </h2>
        <MatrixTable
          operation="Gauss-Jordan · Matriz Aumentada"
          matrices={[
            {
              label: "A",
              kind: "matrix",
              data: [
                [2, 1, -1],
                [-3, -1, 2],
                [-2, 1, 2],
              ],
            },
            {
              label: "b",
              kind: "vector",
              data: [[8], [-11], [-3]],
            },
            {
              label: "A⁻¹",
              kind: "result",
              data: [
                [-4, -3, 1],
                [2, 2, -1],
                [-5, -4, 1],
              ],
            },
          ]}
          footnote="Sistema resuelto por eliminación Gauss-Jordan."
        />
      </section>

      <section className="border border-zinc-800 rounded-3xl p-6 bg-zinc-900/30">
        <h2 className="text-sm font-mono text-amber-400 uppercase tracking-wider mb-4">
          2. PropositionTable
        </h2>
        <PropositionTable
          variables={["p", "q"]}
          formula="(p → q) ∧ (¬p → ¬q)"
          classification="Tautología"
          rows={[
            { values: [true, true], result: true },
            { values: [true, false], result: false },
            { values: [false, true], result: false },
            { values: [false, false], result: true },
          ]}
        />
      </section>

      <section className="border border-zinc-800 rounded-3xl p-6 bg-zinc-900/30">
        <h2 className="text-sm font-mono text-amber-400 uppercase tracking-wider mb-4">
          3. FrequencyTable
        </h2>
        <FrequencyTable
          variableLabel="Tiempo de respuesta (ms)"
          classWidth={18.4}
          groupedMean={141.2}
          groupedMedian={139.5}
          groupedMode={137.8}
          rows={[
            { lower: 112, upper: 130, classMark: 121, absFreq: 6, relFreq: 0.25, pctFreq: 25, cumAbsAsc: 6, cumPctAsc: 25 },
            { lower: 130, upper: 148, classMark: 139, absFreq: 8, relFreq: 0.333, pctFreq: 33.3, cumAbsAsc: 14, cumPctAsc: 58.3 },
            { lower: 148, upper: 166, classMark: 157, absFreq: 6, relFreq: 0.25, pctFreq: 25, cumAbsAsc: 20, cumPctAsc: 83.3 },
            { lower: 166, upper: 184, classMark: 175, absFreq: 3, relFreq: 0.125, pctFreq: 12.5, cumAbsAsc: 23, cumPctAsc: 95.8 },
            { lower: 184, upper: 202, classMark: 193, absFreq: 1, relFreq: 0.042, pctFreq: 4.2, cumAbsAsc: 24, cumPctAsc: 100 },
          ]}
        />
      </section>

      <section className="border border-zinc-800 rounded-3xl p-6 bg-zinc-900/30">
        <h2 className="text-sm font-mono text-amber-400 uppercase tracking-wider mb-4">
          4. AmortizationTable
        </h2>
        <AmortizationTable
          currency="$"
          rateLabel="18% anual"
          totalPeriods={6}
          rows={[
            { period: 1, initialBalance: 10000, payment: 1755, interest: 150, principal: 1605, finalBalance: 8395 },
            { period: 2, initialBalance: 8395, payment: 1755, interest: 126, principal: 1629, finalBalance: 6766 },
            { period: 3, initialBalance: 6766, payment: 1755, interest: 101, principal: 1654, finalBalance: 5112 },
            { period: 4, initialBalance: 5112, payment: 1755, interest: 77, principal: 1678, finalBalance: 3434 },
            { period: 5, initialBalance: 3434, payment: 1755, interest: 52, principal: 1703, finalBalance: 1731 },
            { period: 6, initialBalance: 1731, payment: 1755, interest: 26, principal: 1729, finalBalance: 2 },
          ]}
        />
      </section>
    </div>
  );
}