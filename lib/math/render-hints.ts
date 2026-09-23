// =============================================================================
// ReSolve · Render Hints
// -----------------------------------------------------------------------------
// Decide qué bloques visuales renderizar para una solución del omni-solve.
// Estrategia:
//   1. Si el LLM devolvió `renderHints` explícitos → se respetan.
//   2. Si no → inferencia por (module, subtopic, graphableExpression).
//   3. Nunca falla: siempre incluye "result" y "steps".
// =============================================================================

export type BlockKind =
  | "result"           // Siempre presente: resultado principal + fórmula
  | "steps"            // Siempre presente: pasos de resolución
  | "graph"            // MathGrapher (curvas, distribuciones, regresión)
  | "matrix-table"     // Tabla de matrices / Gauss-Jordan
  | "frequency-table"  // Tabla de frecuencias / descriptiva
  | "proposition-table"// Tabla de verdad proposicional
  | "amortization-table"// Tabla de amortización financiera
  | "explanation";     // Texto explicativo largo (opcional)

export type PrimaryVisual =
  | "graph"
  | "matrix-table"
  | "frequency-table"
  | "proposition-table"
  | "amortization-table"
  | "none";

export interface RenderPlan {
  blocks: BlockKind[];
  primaryVisual: PrimaryVisual;
  hasGraph: boolean;
  hasTable: boolean;
}

/**
 * Estructura de la solución tal como la devuelve /api/ai/omni-solve.
 * Repetimos aquí para no acoplar a omni-solver-view.tsx.
 */
export interface OmniSolveLike {
  targetModule?: string;
  targetSubtopic?: string;
  categoryName?: string;
  extractedFormula?: string;
  primaryResult?: string;
  graphableExpression?: string | null;
  steps?: Array<{ stage: string; description: string; math: string }>;
  explanation?: string;
  // Opcionales que el LLM podría devolver si ampliamos el prompt:
  renderHints?: {
    graphType?: "function" | "distribution" | "regression" | "geometry" | null;
    tableType?: "matrix" | "system" | "frequency" | "amortization" | "truth" | null;
  };
}

// -----------------------------------------------------------------------------
// TABLAS DE INFERENCIA
// -----------------------------------------------------------------------------

/** Subtemas que SIEMPRE merecen una gráfica (aunque graphableExpression venga null,
 *  se puede intentar extraer del extractedFormula). */
const GRAPH_SUBTOPICS = new Set([
  // MAT1
  "funciones", "derivadas", "integrales", "limites",
  // MAT5
  "distribuciones", "regresion", "descriptiva",
]);

/** Subtemas que SIEMPRE merecen una tabla específica. */
const TABLE_BY_SUBTOPIC: Record<string, PrimaryVisual> = {
  // MAT2
  "proposiciones": "proposition-table",
  // MAT3
  "amortizacion": "amortization-table",
  // MAT4
  "matrices": "matrix-table",
  "determinantes": "matrix-table",
  "sistemas-gauss": "matrix-table",
  "raices-metodos": "matrix-table",   // iteraciones tabuladas
  "interpolacion": "matrix-table",    // diferencias divididas
  // MAT5
  "tablas-frecuencia": "frequency-table",
  "descriptiva": "frequency-table",   // tabla + gráfica secundaria
   "regresion": "frequency-table",   // ← AÑADIDO: tabla de pares (x, y, xy, x², y²)
};

/** Subtemas donde la gráfica es solo un complemento (no primario). */
const SECONDARY_GRAPH_SUBTOPICS = new Set([
  "descriptiva",         // gráfica después de la tabla
  "regresion",           // gráfica de dispersión + recta
  "distribuciones",      // curva de densidad
  "interpolacion",       // curva polinómica después de la tabla
]);

// -----------------------------------------------------------------------------
// API PÚBLICA
// -----------------------------------------------------------------------------

export function planRender(solution: OmniSolveLike): RenderPlan {
  const blocks: BlockKind[] = ["result", "steps"];

  const moduleKey = (solution.targetModule || "").toLowerCase();
  const subtopic = (solution.targetSubtopic || "").trim().toLowerCase();
  const hasExplicitGraphExpr = typeof solution.graphableExpression === "string"
    && solution.graphableExpression.trim().length > 0;

  // ---------- 1. Respetar renderHints explícitos del LLM ----------
  const explicitTable = solution.renderHints?.tableType ?? null;
  const explicitGraph = solution.renderHints?.graphType ?? null;

  let primaryVisual: PrimaryVisual = "none";

  if (explicitTable === "matrix") primaryVisual = "matrix-table";
  else if (explicitTable === "frequency") primaryVisual = "frequency-table";
  else if (explicitTable === "amortization") primaryVisual = "amortization-table";
  else if (explicitTable === "truth") primaryVisual = "proposition-table";
  else if (explicitTable === "system") primaryVisual = "matrix-table";

  if (!primaryVisual && explicitGraph) {
    primaryVisual = "graph";
  }

  // ---------- 2. Inferencia por subtopic si no hubo hints ----------
  if (primaryVisual === "none") {
    const inferredTable = TABLE_BY_SUBTOPIC[subtopic];
    if (inferredTable) {
      primaryVisual = inferredTable;
    } else if (hasExplicitGraphExpr || GRAPH_SUBTOPICS.has(subtopic)) {
      primaryVisual = "graph";
    }
  }
  // ---------- 3. Empujar bloques según el plan ----------
  if (primaryVisual === "graph") {
    blocks.push("graph");
  } else if (primaryVisual !== "none") {
    // Tenemos una tabla como visual primario. ¿Merece gráfica secundaria?
    blocks.push(primaryVisual as BlockKind);

    const wantsSecondaryGraph =
      SECONDARY_GRAPH_SUBTOPICS.has(subtopic) || hasExplicitGraphExpr;

    if (wantsSecondaryGraph) {
      blocks.push("graph");
    }
  } else {
    // No hay visual primario detectado. Si hay expresión graficable, la usamos.
    if (hasExplicitGraphExpr) {
      blocks.push("graph");
    }
  }

  // ---------- 4. Explicación al final si existe ----------
  if (solution.explanation && solution.explanation.trim().length > 0) {
    blocks.push("explanation");
  }

  // ---------- 5. Deduplicar manteniendo orden ----------
  const dedupedBlocks = Array.from(new Set(blocks));

  const hasTable = dedupedBlocks.some((b) =>
    b === "matrix-table" ||
    b === "frequency-table" ||
    b === "proposition-table" ||
    b === "amortization-table"
  );
  const hasGraph = dedupedBlocks.includes("graph");

  return {
    blocks: dedupedBlocks,
    primaryVisual: hasGraph && primaryVisual === "none" ? "graph" : primaryVisual,
    hasGraph,
    hasTable,
  };
}

/**
 * Helper para debug: describe el plan en texto legible.
 */
export function describePlan(plan: RenderPlan): string {
  return `[blocks: ${plan.blocks.join(", ")}] primary=${plan.primaryVisual} graph=${plan.hasGraph} table=${plan.hasTable}`;
}