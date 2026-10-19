// =============================================================================
// ReSolve · Capa simbólica compartida (nerdamer)
// -----------------------------------------------------------------------------
// Envoltorio determinista sobre nerdamer más utilidades de conversión a LaTeX y
// manipulación de expresiones algebraicas. Lo usan el motor local
// (`universal-engine`) y los generadores de pasos (`step-generators`) para que
// AMBOS compartan exactamente la misma resolución: los pasos muestran los
// cálculos que produce el motor, no plantillas paralelas.
// =============================================================================

import { toLatexSymbols } from "./unicode-math";

export interface SymbolicResult {
  toString(): string;
}

export interface Symbolic {
  (expr: string, ...args: (string | number)[]): SymbolicResult;
  solveEquations?: (eqs: string[], vars: string[]) => Array<[string, string | number]>;
}

let symbolicPromise: Promise<Symbolic> | null = null;

/** Acceso perezoso a nerdamer (evita cargarlo en el bundle inicial / SSR). */
export async function getSymbolic(): Promise<Symbolic> {
  if (!symbolicPromise) {
    symbolicPromise = import("nerdamer/all.min").then(
      (mod) =>
        (mod as unknown as { default?: Symbolic }).default ??
        (mod as unknown as Symbolic)
    );
  }
  return symbolicPromise;
}

/** Normaliza nombres de funciones en español al dialecto de nerdamer. */
export function normalizeFunctionNames(text: string): string {
  return text
    .replace(/\bsen\b/gi, "sin")
    .replace(/\btg\b/gi, "tan")
    .replace(/\bcotg\b/gi, "cot")
    .replace(/\barcsen\b/gi, "asin")
    .replace(/\barctg\b/gi, "atan");
}

/** Adapta una expresión al dialecto de nerdamer (log natural = `log`). */
export function toNerdamerExpr(expr: string): string {
  return normalizeFunctionNames(expr).replace(/\bln\b/gi, "log");
}

/** Ejecuta una operación nerdamer y devuelve el resultado, o `null` si falla. */
export async function symbolicOp(op: string, ...args: string[]): Promise<string | null> {
  try {
    const n = await getSymbolic();
    const out = n(`${op}(${args.join(",")})`).toString();
    return out || null;
  } catch {
    return null;
  }
}

export const factorExpr = (e: string) => symbolicOp("factor", toNerdamerExpr(e));
export const simplifyExpr = (e: string) => symbolicOp("simplify", toNerdamerExpr(e));
export const expandExpr = (e: string) => symbolicOp("expand", toNerdamerExpr(e));
export const diffExpr = (e: string, variable: string) =>
  symbolicOp("diff", toNerdamerExpr(e), variable);
export const integrateExpr = (e: string, variable: string) =>
  symbolicOp("integrate", toNerdamerExpr(e), variable);
export const defintExpr = (e: string, a: string | number, b: string | number, variable: string) =>
  symbolicOp("defint", toNerdamerExpr(e), String(a), String(b), variable);
export const limitExpr = (e: string, variable: string, point: string | number) =>
  symbolicOp("limit", toNerdamerExpr(e), variable, String(point));
export const rootsExpr = (e: string) => symbolicOp("roots", toNerdamerExpr(e));

/** Resuelve `expr = 0` para `variable` y devuelve las raíces como lista. */
export async function solveExpr(expr: string, variable: string): Promise<string[] | null> {
  const raw = await symbolicOp("solve", `${toNerdamerExpr(expr)}=0`, variable);
  if (raw === null) return null;
  const cleaned = raw.replace(/^\[|\]$/g, "").trim();
  if (!cleaned) return [];
  return cleaned
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// -----------------------------------------------------------------------------
// Conversión a LaTeX
// -----------------------------------------------------------------------------

/**
 * Convierte la salida plana de nerdamer a LaTeX para KaTeX:
 * `(-1+x)^(-1)*(2+3*x^4)` → `(-1+x)^{-1} \cdot (2+3 \cdot x^{4})`.
 */
export function symToLatex(expr: string): string {
  if (!expr) return expr;
  let s = toLatexSymbols(expr);
  s = s.replace(/\^\(([^()]*)\)/g, "^{$1}");
  s = s.replace(/\s*\*\s*/g, " \\cdot ");
  return s;
}

// -----------------------------------------------------------------------------
// Manipulación de expresiones
// -----------------------------------------------------------------------------

/** ¿Los paréntesis/corchetes de `s` están balanceados? */
function isBalanced(s: string): boolean {
  let depth = 0;
  for (const c of s) {
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") {
      depth--;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

/** Elimina paréntesis externos redundantes: `(x+1)` → `x+1`. */
export function stripOuterParens(input: string): string {
  let s = input.trim();
  while (
    s.length > 1 &&
    ((s.startsWith("(") && s.endsWith(")")) || (s.startsWith("[") && s.endsWith("]"))) &&
    isBalanced(s.slice(1, -1))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/**
 * Si `expr` es un cociente puro `A / B` (una sola división de nivel superior y
 * sin sumas/restas de nivel superior), devuelve numerador y denominador.
 */
export function splitQuotient(expr: string): { num: string; den: string } | null {
  const s = expr.trim();
  let depth = 0;
  const cuts: number[] = [];
  let hasTopBinary = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (depth === 0) {
      if (c === "/") cuts.push(i);
      else if ((c === "+" || c === "-") && i > 0 && !/[eE^]/.test(s[i - 1])) hasTopBinary = true;
    }
  }

  if (cuts.length !== 1 || hasTopBinary) return null;
  const num = stripOuterParens(s.slice(0, cuts[0]));
  const den = stripOuterParens(s.slice(cuts[0] + 1));
  if (!num || !den) return null;
  return { num, den };
}

/** Sustituye textualmente la variable por un valor: `x^2-1`, x=1 → `(1)^2-1`. */
export function substituteVar(
  expr: string,
  variable: string,
  value: number | string
): string {
  const v = variable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^A-Za-z])${v}(?![A-Za-z])`, "g");
  const val = typeof value === "number" ? String(value) : value;
  return expr.replace(re, (_m, pre: string) => `${pre}(${val})`);
}

/**
 * Ordena los términos de un polinomio por grado descendente para su presentación:
 * `2+3*x^4+4*x+7*x^2` → `3*x^4+7*x^2+4*x+2`. Solo se usa para mostrar.
 */
export function sortPolyTerms(expr: string, variable = "x"): string {
  const s = expr.replace(/\s+/g, "");
  if (/[/A-Za-z^(]/.test(s.replace(new RegExp(variable, "g"), ""))) return expr; // no es polinomio simple

  const terms: string[] = [];
  let depth = 0;
  let current = "";
  let sign = "+";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    if (depth === 0 && i > 0 && (c === "+" || c === "-") && !/[eE^]/.test(s[i - 1])) {
      terms.push(sign + current);
      sign = c;
      current = "";
      continue;
    }
    current += c;
  }
  terms.push(sign + current);

  const degree = (term: string): number => {
    const t = term.replace(/^[+-]/, "");
    const m = t.match(new RegExp(`${variable}\\^?(\\d*)`, "i"));
    if (!m) return /[0-9]/.test(t) ? 0 : -1;
    return m[1] === "" ? 1 : parseInt(m[1], 10);
  };

  return terms
    .filter((t) => t.replace(/^[+-]/, "").trim() !== "")
    .sort((a, b) => degree(b) - degree(a))
    .join("")
    .replace(/^\+/, "");
}
