// =============================================================================
// ReSolve · Modelo de contenido de los manuales
// -----------------------------------------------------------------------------
// Los tres manuales se construyen con los mismos bloques. Así el texto, las
// tablas, los diagramas y el código se escriben una vez y se presentan en la
// página y en el PDF sin duplicar la estructura.
// =============================================================================

export type ManualId = "tecnico" | "administrativo" | "usuario";

export type ManualBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "table"; headers: string[]; rows: string[][]; caption?: string }
  | { type: "code"; title: string; language: string; code: string; note?: string }
  | { type: "callout"; title: string; text: string; tone?: "note" | "important" }
  | { type: "steps"; items: { title: string; text: string }[] }
  | { type: "diagram"; diagramId: string; caption?: string }
  | { type: "interfaceMap" }
  | { type: "moduleCatalog" }
  | { type: "roleMatrix" }
  | { type: "trainingCalendar" };

export interface ManualSection {
  id: string;
  title: string;
  blocks: ManualBlock[];
}

export interface ManualDefinition {
  id: ManualId;
  title: string;
  shortTitle: string;
  audience: string;
  description: string;
  version: string;
  updatedAt: string;
  sections: ManualSection[];
}

export const MANUAL_IDS: ManualId[] = ["tecnico", "administrativo", "usuario"];
