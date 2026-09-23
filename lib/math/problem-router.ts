// =============================================================================
// ReSolve · Problem Router
// -----------------------------------------------------------------------------
// Mapa canónico: (targetModule + targetSubtopic) -> ruta navegable del dashboard
// El dashboard usa query params: /dashboard?module=mat4&subtopic=matrices&expr=...
// Verificado contra app/dashboard/page.tsx (handleNavigateFromOmni).
// =============================================================================

// Tipo local para evitar acoplamiento con app/dashboard/page.tsx (que es "use client").
// Si en el futuro necesitas el tipo oficial, impórtalo como `import type` desde un
// archivo de tipos puro, no desde una página cliente.
export type ModuleKey = "mat1" | "mat2" | "mat3" | "mat4" | "mat5" | "mat6";

export interface RouteResolution {
  /** Si la vista existe y es navegable */
  available: boolean;
  /** Ruta completa lista para router.push, o null si no está disponible */
  route: string | null;
  /** Etiqueta legible para el botón (ej: "Ver en Matrices") */
  label: string;
  /** Descripción corta para el badge de "Próximamente" */
  reason?: string;
}

interface RouteEntry {
  module: ModuleKey;
  subtopic: string;
  label: string;
}

// -----------------------------------------------------------------------------
// MAPA CANÓNICO: cubre todos los subtemas reales definidos en SUBTOPICS_BY_MODULE
// (app/dashboard/page.tsx). Los subtemas comentados en el dashboard (predicados,
// traductor, transporte) NO están aquí porque no tienen vista activa.
// -----------------------------------------------------------------------------
const ROUTE_MAP: Record<string, RouteEntry> = {
  // ===== MAT1 · Básicas y Cálculo =====
  "mat1.aritmetica": { module: "mat1", subtopic: "aritmetica", label: "Aritmética" },
  "mat1.algebra":    { module: "mat1", subtopic: "algebra",    label: "Álgebra" },
  "mat1.geometria":  { module: "mat1", subtopic: "geometria",  label: "Geometría" },
  "mat1.funciones":  { module: "mat1", subtopic: "funciones",  label: "Funciones" },
  "mat1.limites":    { module: "mat1", subtopic: "limites",    label: "Límites" },
  "mat1.derivadas":  { module: "mat1", subtopic: "derivadas",  label: "Derivadas" },
  "mat1.integrales": { module: "mat1", subtopic: "integrales", label: "Integrales" },

  // ===== MAT2 · Lógica =====
  "mat2.proposiciones": { module: "mat2", subtopic: "proposiciones", label: "Proposiciones" },
  "mat2.equivalencias": { module: "mat2", subtopic: "equivalencias", label: "Equivalencias" },
  "mat2.inferencias":   { module: "mat2", subtopic: "inferencias",   label: "Inferencias" },

  // ===== MAT3 · Financieras =====
  "mat3.interes-simple":    { module: "mat3", subtopic: "interes-simple",    label: "Interés Simple" },
  "mat3.interes-compuesto": { module: "mat3", subtopic: "interes-compuesto", label: "Interés Compuesto" },
  "mat3.anualidades":       { module: "mat3", subtopic: "anualidades",       label: "Anualidades" },
  "mat3.amortizacion":      { module: "mat3", subtopic: "amortizacion",      label: "Amortización" },

  // ===== MAT4 · Computacionales =====
  "mat4.matrices":        { module: "mat4", subtopic: "matrices",        label: "Matrices" },
  "mat4.determinantes":   { module: "mat4", subtopic: "determinantes",   label: "Determinantes" },
  "mat4.sistemas-gauss":  { module: "mat4", subtopic: "sistemas-gauss",  label: "Sistemas Lineales" },
  "mat4.raices-metodos":  { module: "mat4", subtopic: "raices-metodos",  label: "Raíces Numéricas" },
  "mat4.interpolacion":   { module: "mat4", subtopic: "interpolacion",   label: "Interpolación" },
  "mat4.errores":         { module: "mat4", subtopic: "errores",         label: "Teoría de Errores" },

  // ===== MAT5 · Estadística =====
  "mat5.descriptiva":       { module: "mat5", subtopic: "descriptiva",       label: "Estadística Descriptiva" },
  "mat5.tablas-frecuencia": { module: "mat5", subtopic: "tablas-frecuencia", label: "Tablas de Frecuencia" },
  "mat5.probabilidad":      { module: "mat5", subtopic: "probabilidad",      label: "Probabilidad" },
  "mat5.distribuciones":    { module: "mat5", subtopic: "distribuciones",    label: "Distribuciones" },
  "mat5.regresion":         { module: "mat5", subtopic: "regresion",         label: "Regresión Lineal" },

  // ===== MAT6 · Optimización =====
  "mat6.prog-lineal":  { module: "mat6", subtopic: "prog-lineal",  label: "Programación Lineal" },
  "mat6.simplex":      { module: "mat6", subtopic: "simplex",      label: "Método Simplex" },
  "mat6.asignacion":   { module: "mat6", subtopic: "asignacion",   label: "Asignación" },
  "mat6.teoria-colas": { module: "mat6", subtopic: "teoria-colas", label: "Teoría de Colas" },
};

// -----------------------------------------------------------------------------
// NORMALIZACIÓN DE SUBTOPICS
// El LLM devuelve variantes con guiones bajos, mayúsculas, o nombres alternos.
// Este diccionario mapea esos alias al subtopic canónico del dashboard.
// -----------------------------------------------------------------------------
const SUBTOPIC_ALIASES: Record<string, string> = {
  // MAT1
  "aritmetica": "aritmetica", "arithmetic": "aritmetica", "aritmética": "aritmetica",
  "algebra": "algebra", "álgebra": "algebra",
  "geometria": "geometria", "geometría": "geometria", "geometry": "geometria",
  "funciones": "funciones", "functions": "funciones",
  "limites": "limites", "límites": "limites", "limits": "limites",
  "derivadas": "derivadas", "derivatives": "derivadas",
  "integrales": "integrales", "integrals": "integrales",

  // MAT2
  "proposiciones": "proposiciones", "propositions": "proposiciones",
  "equivalencias": "equivalencias", "equivalences": "equivalencias",
  "inferencias": "inferencias", "inferences": "inferencias",

  // MAT3
  "interes-simple": "interes-simple", "interes_simple": "interes-simple", "simple-interest": "interes-simple",
  "interes-compuesto": "interes-compuesto", "interes_compuesto": "interes-compuesto", "compound-interest": "interes-compuesto",
  "anualidades": "anualidades", "annuities": "anualidades",
  "amortizacion": "amortizacion", "amortización": "amortizacion", "amortization": "amortizacion",

  // MAT4
  "matrices": "matrices", "matrix": "matrices",
  "determinantes": "determinantes", "determinants": "determinantes",
  "sistemas-gauss": "sistemas-gauss", "sistemas_gauss": "sistemas-gauss",
  "gauss": "sistemas-gauss", "gauss-jordan": "sistemas-gauss", "sistemas": "sistemas-gauss",
  "raices-metodos": "raices-metodos", "raices_metodos": "raices-metodos",
  "raices": "raices-metodos", "numerical-roots": "raices-metodos",
  "interpolacion": "interpolacion", "interpolación": "interpolacion", "interpolation": "interpolacion",
  "errores": "errores", "error-theory": "errores", "teoria-errores": "errores",

  // MAT5
  "descriptiva": "descriptiva", "estadistica-descriptiva": "descriptiva", "descriptive-stats": "descriptiva",
  "tablas-frecuencia": "tablas-frecuencia", "tablas_frecuencia": "tablas-frecuencia",
  "frecuencias": "tablas-frecuencia", "frequency-table": "tablas-frecuencia",
  "probabilidad": "probabilidad", "probability": "probabilidad",
  "distribuciones": "distribuciones", "distributions": "distribuciones",
  "regresion": "regresion", "regresión": "regresion", "regression": "regresion",

  // MAT6
  "prog-lineal": "prog-lineal", "prog_lineal": "prog-lineal",
  "programacion-lineal": "prog-lineal", "linear-programming": "prog-lineal",
  "simplex": "simplex", "metodo-simplex": "simplex",
  "asignacion": "asignacion", "asignación": "asignacion", "assignment": "asignacion",
  "teoria-colas": "teoria-colas", "teoria_colas": "teoria-colas", "queueing": "teoria-colas",
};

function normalizeSubtopic(raw: string): string {
  if (!raw) return "";
  const key = raw.trim().toLowerCase();
  return SUBTOPIC_ALIASES[key] || key;
}

// -----------------------------------------------------------------------------
// API PÚBLICA
// -----------------------------------------------------------------------------

/**
 * Resuelve la ruta navegable para un problema ya clasificado por el LLM.
 *
 * @param targetModule  "mat1".."mat6" (viene de omni-solve/route.ts)
 * @param targetSubtopic subtopic crudo del LLM (ej: "matrices", "tablas_frecuencia")
 * @param expression    expresión adaptada a inyectar como ?expr=
 * @param extraParams   point/side para límites
 */
export function resolveProblemRoute(
  targetModule: string,
  targetSubtopic: string,
  expression: string,
  extraParams?: { point?: string; side?: string }
): RouteResolution {
  const moduleKey = (targetModule || "").toLowerCase() as ModuleKey;
  const normalizedSub = normalizeSubtopic(targetSubtopic);
  const mapKey = `${moduleKey}.${normalizedSub}`;
  const entry = ROUTE_MAP[mapKey];

  // Caso 1: ruta conocida → navegable
  if (entry) {
    const query = new URLSearchParams();
    query.set("module", entry.module);
    query.set("subtopic", entry.subtopic);
    if (expression) query.set("expr", expression);
    if (extraParams?.point) query.set("point", extraParams.point);
    if (extraParams?.side) query.set("side", extraParams.side);

    return {
      available: true,
      route: `/dashboard?${query.toString()}`,
      label: `Ver en ${entry.label}`,
    };
  }

  // Caso 2: módulo existe pero subtopic no tiene vista → fallback
  if (moduleKey && /^mat[1-6]$/.test(moduleKey)) {
    return {
      available: false,
      route: null,
      label: "Sección no disponible",
      reason: `La vista de "${targetSubtopic}" aún no está implementada. Puedes seguir viendo la solución completa aquí abajo.`,
    };
  }

  // Caso 3: módulo desconocido → fallback total
  return {
    available: false,
    route: null,
    label: "Sección no disponible",
    reason: "No pudimos determinar el módulo de destino para este problema.",
  };
}

/**
 * Devuelve la etiqueta del módulo para mostrar en el badge (ej: "Matemáticas IV").
 */
export function getModuleLabel(targetModule: string): string {
  const labels: Record<string, string> = {
    mat1: "Matemáticas I",
    mat2: "Matemáticas II",
    mat3: "Matemáticas III",
    mat4: "Matemáticas IV",
    mat5: "Matemáticas V",
    mat6: "Matemáticas VI",
  };
  return labels[targetModule?.toLowerCase()] || "Módulo desconocido";
}