export { default as MatrixTable } from "./matrix-table";
export type { MatrixBlock, MatrixTableProps } from "./matrix-table";

export { default as PropositionTable } from "./proposition-table";
export type {
  PropositionRow,
  PropositionTableProps,
} from "./proposition-table";

export { default as FrequencyTable } from "./frequency-table";
export type {
  FrequencyRow,
  FrequencyTableProps,
} from "./frequency-table";

export { default as AmortizationTable } from "./amortization-table";
export type {
  AmortizationRow,
  AmortizationTableProps,
} from "./amortization-table";

export type BlockKind =
  | "result"
  | "steps"
  | "graph"
  | "matrix-table"
  | "frequency-table"
  | "proposition-table"
  | "amortization-table"
  | "explanation";