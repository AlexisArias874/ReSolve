// =============================================================================
// ReSolve · Análisis unificado de funciones
// -----------------------------------------------------------------------------
// Una única representación matemática alimenta el resumen analítico, el
// graficador, la detección de raíces y el control de integrales. Para funciones
// polinómicas y racionales el análisis es exacto (coeficientes + álgebra de
// polinomios); para el resto se usa un análisis numérico con salvaguardas.
//
// Principios:
//   * Se conserva SIEMPRE el dominio de la expresión original.
//   * Se distingue la expresión original de la simplificada.
//   * Los huecos (discontinuidades removibles) NO son asíntotas verticales.
//   * Nunca se declara una propiedad como inexistente sin comprobarla.
// =============================================================================

import { evaluateUniversalMath, sanitizeMathExpression } from "./universal-evaluator";
import {
  type Poly,
  isZeroPoly,
  polyAbsDefiniteIntegral,
  polyDefiniteIntegral,
  polyDeg,
  polyDeriv,
  polyDivMod,
  polyEval,
  polyGcd,
  polyMul,
  polyRealRoots,
  polyScale,
  polySub,
  polyToString,
  trim,
} from "./polynomial";

export interface AnalysisPoint {
  x: number;
  y: number;
}

export interface CriticalPoint {
  x: number;
  y: number;
  type: "Máximo" | "Mínimo" | "No concluyente";
}

export interface Interval {
  from: number;
  to: number;
}

export interface MonotonicInterval extends Interval {
  behavior: "crece" | "decrece";
}

export interface ConcavityInterval extends Interval {
  behavior: "cóncava" | "convexa";
}

export interface FunctionAnalysis {
  /** `true` si la expresión es polinómica/racional y el análisis es exacto. */
  exact: boolean;
  variable: string;
  sanitized: string;
  simplifiedExpression: string | null;
  domainText: string;
  domainExcluded: number[];
  holes: AnalysisPoint[];
  verticalAsymptotes: number[];
  horizontalAsymptote: number | null;
  obliqueAsymptote: { m: number; b: number } | null;
  yIntercept: number | null;
  roots: Array<{ x: number; multiplicity: number }>;
  criticalPoints: CriticalPoint[];
  monotonic: MonotonicInterval[];
  concavity: ConcavityInterval[];
  inflectionPoints: AnalysisPoint[];
  symmetry: string;
  warnings: string[];
}

// -----------------------------------------------------------------------------
// Aritmética racional (cociente de polinomios)
// -----------------------------------------------------------------------------

interface Rational {
  n: Poly;
  d: Poly;
}

const rConst = (c: number): Rational => ({ n: [c], d: [1] });

function rIsZero(r: Rational): boolean {
  return isZeroPoly(trim(r.n));
}

function rAdd(a: Rational, b: Rational): Rational {
  return { n: polyAddSafe(polyMul(a.n, b.d), polyMul(b.n, a.d)), d: polyMul(a.d, b.d) };
}
function rSub(a: Rational, b: Rational): Rational {
  return { n: polySub(polyMul(a.n, b.d), polyMul(b.n, a.d)), d: polyMul(a.d, b.d) };
}
function rMul(a: Rational, b: Rational): Rational {
  return { n: polyMul(a.n, b.n), d: polyMul(a.d, b.d) };
}
function rDiv(a: Rational, b: Rational): Rational | null {
  if (rIsZero(b)) return null;
  return { n: polyMul(a.n, b.d), d: polyMul(a.d, b.n) };
}
function rNeg(a: Rational): Rational {
  return { n: polyScale(a.n, -1), d: a.d };
}
function rPow(a: Rational, k: number): Rational {
  let result = rConst(1);
  let base = a;
  let e = k;
  while (e > 0) {
    if (e & 1) result = rMul(result, base);
    base = rMul(base, base);
    e >>= 1;
  }
  return result;
}

function polyAddSafe(a: Poly, b: Poly): Poly {
  const n = Math.max(a.length, b.length);
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) out[i] = (a[i] ?? 0) + (b[i] ?? 0);
  return trim(out);
}

/** Reduce `n/d` cancelando el máximo común divisor y normalizando el signo. */
function simplifyRational(r: Rational): Rational {
  let n = trim(r.n);
  let d = trim(r.d);
  if (isZeroPoly(n)) return { n: [0], d: [1] };
  const g = polyGcd(n, d);
  const nq = polyDivMod(n, g);
  const dq = polyDivMod(d, g);
  if (nq && dq && isZeroPoly(nq.r) && isZeroPoly(dq.r)) {
    n = trim(nq.q);
    d = trim(dq.q);
  }
  const leadD = d[d.length - 1];
  if (leadD < 0) {
    n = polyScale(n, -1);
    d = polyScale(d, -1);
  }
  return { n, d };
}

function rDeriv(r: Rational): Rational {
  const n = polySub(polyMul(polyDeriv(r.n), r.d), polyMul(r.n, polyDeriv(r.d)));
  const d = polyMul(r.d, r.d);
  return simplifyRational({ n, d });
}

function rEval(r: Rational, x: number): number {
  const d = polyEval(r.d, x);
  if (Math.abs(d) < 1e-12) return NaN;
  return polyEval(r.n, x) / d;
}

// -----------------------------------------------------------------------------
// Parser de expresiones racionales
// -----------------------------------------------------------------------------

type Tok = { t: "num"; v: number } | { t: "var" } | { t: "op"; v: string };

function tokenize(s: string, variable: string): Tok[] | null {
  const toks: Tok[] = [];
  const vName = variable.toLowerCase();
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const num = parseFloat(s.slice(i, j));
      if (isNaN(num)) return null;
      toks.push({ t: "num", v: num });
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
      const name = s.slice(i, j).toLowerCase();
      if (name !== vName) return null; // función o constante no polinómica
      toks.push({ t: "var" });
      i = j;
      continue;
    }
    if ("+-*/^()".includes(c)) {
      toks.push({ t: "op", v: c });
      i++;
      continue;
    }
    return null;
  }
  return toks;
}

function startsFactor(t: Tok | undefined): boolean {
  if (!t) return false;
  return t.t === "num" || t.t === "var" || (t.t === "op" && t.v === "(");
}

function parseRational(input: string, variable: string): Rational | null {
  const toks = tokenize(input, variable);
  if (!toks || toks.length === 0) return null;
  let pos = 0;

  const peek = (): Tok | undefined => toks[pos];
  const next = (): Tok | undefined => toks[pos++];

  const parseExpr = (): Rational | null => {
    let left = parseTerm();
    if (!left) return null;
    for (;;) {
      const tk = peek();
      if (tk && tk.t === "op" && (tk.v === "+" || tk.v === "-")) {
        next();
        const right = parseTerm();
        if (!right) return null;
        left = tk.v === "+" ? rAdd(left, right) : rSub(left, right);
      } else break;
    }
    return left;
  };

  const parseTerm = (): Rational | null => {
    let left = parsePower();
    if (!left) return null;
    for (;;) {
      const tk = peek();
      if (tk && tk.t === "op" && (tk.v === "*" || tk.v === "/")) {
        next();
        const right = parsePower();
        if (!right) return null;
        if (tk.v === "*") left = rMul(left, right);
        else {
          const q = rDiv(left, right);
          if (!q) return null;
          left = q;
        }
      } else if (startsFactor(tk)) {
        // Multiplicación implícita: 2x, x(x+1), 2(x-1)…
        const right = parsePower();
        if (!right) return null;
        left = rMul(left, right);
      } else break;
    }
    return left;
  };

  const parsePower = (): Rational | null => {
    const base = parsePrimary();
    if (!base) return null;
    const tk = peek();
    if (tk && tk.t === "op" && tk.v === "^") {
      next();
      const exp = parseUnary();
      if (!exp) return null;
      const k = rationalConst(exp);
      if (k === null || k < 0 || !Number.isInteger(k)) return null;
      return rPow(base, k);
    }
    return base;
  };

  const parseUnary = (): Rational | null => {
    const tk = peek();
    if (tk && tk.t === "op" && (tk.v === "+" || tk.v === "-")) {
      next();
      const operand = parseUnary();
      if (!operand) return null;
      return tk.v === "-" ? rNeg(operand) : operand;
    }
    return parsePower();
  };

  const parsePrimary = (): Rational | null => {
    const tk = next();
    if (!tk) return null;
    if (tk.t === "num") return rConst(tk.v);
    if (tk.t === "var") return { n: [0, 1], d: [1] };
    if (tk.t === "op" && tk.v === "(") {
      const inner = parseExpr();
      if (!inner) return null;
      const close = next();
      if (!close || close.t !== "op" || close.v !== ")") return null;
      return inner;
    }
    return null;
  };

  const result = parseExpr();
  if (!result || pos !== toks.length) return null;
  return result;
}

function rationalConst(r: Rational): number | null {
  if (polyDeg(r.n) <= 0 && polyDeg(r.d) === 0) {
    const d = r.d[0] ?? 1;
    if (Math.abs(d) < 1e-12) return null;
    return (r.n[0] ?? 0) / d;
  }
  return null;
}

// -----------------------------------------------------------------------------
// Utilidades numéricas
// -----------------------------------------------------------------------------

function fmt(n: number): string {
  const r = Number(n.toFixed(4));
  return String(r);
}

function uniqueSorted(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) {
    if (out.length === 0 || Math.abs(v - out[out.length - 1]) > 1e-6) out.push(v);
  }
  return out;
}

function interiorRoots(poly: Poly, lo: number, hi: number): number[] {
  return polyRealRoots(poly)
    .map((r) => r.x)
    .filter((x) => x > lo + 1e-9 && x < hi - 1e-9);
}

// -----------------------------------------------------------------------------
// Análisis principal
// -----------------------------------------------------------------------------

/** Sustituye parámetros (a, b, c…) por su valor numérico conservando la variable. */
function substituteParams(
  expr: string,
  params: Record<string, number>,
  variable: string
): string {
  let s = expr;
  for (const [name, value] of Object.entries(params)) {
    if (name === variable) continue;
    const safe = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[^A-Za-z])${safe}(?![A-Za-z])`, "g");
    const val = Number.isFinite(value) ? String(value) : "0";
    s = s.replace(re, (_m, pre: string) => `${pre}(${val})`);
  }
  return s;
}

export function analyzeFunction(
  expression: string,
  variable = "x",
  params: Record<string, number> = {}
): FunctionAnalysis {
  const sanitized = substituteParams(sanitizeMathExpression(expression), params, variable);
  const base: FunctionAnalysis = {
    exact: false,
    variable,
    sanitized,
    simplifiedExpression: null,
    domainText: "No determinable con el motor de funciones",
    domainExcluded: [],
    holes: [],
    verticalAsymptotes: [],
    horizontalAsymptote: null,
    obliqueAsymptote: null,
    yIntercept: null,
    roots: [],
    criticalPoints: [],
    monotonic: [],
    concavity: [],
    inflectionPoints: [],
    symmetry: "Sin simetría",
    warnings: [],
  };

  const parsed = parseRational(sanitized, variable);

  // Validación temprana: una entrada vacía o no evaluable no debe producir un
  // análisis silencioso con todos los campos vacíos.
  if (!sanitized.trim()) {
    base.domainText = "Expresión vacía";
    base.warnings.push("Ingresa una función de la variable indicada, por ejemplo x^3 - 3x.");
    return base;
  }

  if (!parsed) {
    const probes = [0.37, 1.23, 2.71, -0.73];
    const evaluated = probes.map((value) =>
      evaluateUniversalMath(sanitized, { [variable]: value })
    );
    if (evaluated.every((value) => !Number.isFinite(value))) {
      base.domainText = "Expresión no evaluable";
      base.warnings.push(
        "La expresión no pudo evaluarse. Revisa la sintaxis (por ejemplo: sin(x), sqrt(x), 1/x, x^2)."
      );
      return base;
    }
  }

  if (!parsed) return numericFallback(sanitized, variable, base);

  const original: Rational = { n: trim(parsed.n), d: trim(parsed.d) };
  const simplified = simplifyRational(original);
  const warnings: string[] = [];

  // Dominio: raíces reales del denominador ORIGINAL.
  const denRoots = polyRealRoots(original.d).map((r) => r.x);
  const domainExcluded = uniqueSorted(denRoots);

  // Factor común cancelado → discontinuidades removibles (huecos).
  const common = polyGcd(original.n, original.d);
  const commonRoots = polyDeg(common) > 0 ? polyRealRoots(common).map((r) => r.x) : [];
  const holes: AnalysisPoint[] = [];
  for (const r of commonRoots) {
    const y = rEval(simplified, r);
    if (isFinite(y)) holes.push({ x: Number(r.toFixed(6)), y: Number(y.toFixed(6)) });
  }

  // Asíntotas verticales: raíces reales del denominador YA simplificado.
  const verticalAsymptotes = uniqueSorted(polyRealRoots(simplified.d).map((r) => r.x));

  // Asíntotas horizontales / oblicuas.
  const degN = polyDeg(simplified.n);
  const degD = polyDeg(simplified.d);
  let horizontalAsymptote: number | null = null;
  let obliqueAsymptote: { m: number; b: number } | null = null;
  if (degD === 0) {
    // Función polinómica: sin asíntotas.
  } else if (degN < degD) {
    horizontalAsymptote = 0;
  } else if (degN === degD) {
    horizontalAsymptote =
      simplified.n[degN] / simplified.d[degD];
  } else if (degN === degD + 1) {
    const q = polyDivMod(simplified.n, simplified.d);
    if (q && polyDeg(q.q) === 1) obliqueAsymptote = { m: q.q[1], b: q.q[0] };
  }

  // Corte con el eje Y.
  let yIntercept: number | null = null;
  if (!domainExcluded.some((e) => Math.abs(e) < 1e-9)) {
    const y = rEval(original, 0);
    if (isFinite(y)) yIntercept = Number(y.toFixed(6));
  }

  // Raíces reales de f (numerador simplificado), excluyendo puntos fuera del dominio.
  const roots = polyRealRoots(simplified.n)
    .filter((r) => !domainExcluded.some((e) => Math.abs(e - r.x) < 1e-6))
    .map((r) => ({ x: Number(r.x.toFixed(6)), multiplicity: r.multiplicity }));

  // Derivadas de la función simplificada.
  const f1 = rDeriv(simplified);
  const f2 = rDeriv(f1);

  // Puntos críticos.
  const critRaw = polyRealRoots(f1.n)
    .map((r) => r.x)
    .filter((x) => !domainExcluded.some((e) => Math.abs(e - x) < 1e-6));
  const criticalPoints: CriticalPoint[] = [];
  for (const x of uniqueSorted(critRaw)) {
    const y = rEval(simplified, x);
    if (!isFinite(y)) continue;
    criticalPoints.push({ x: Number(x.toFixed(6)), y: Number(y.toFixed(6)), type: classifyCritical(f1, f2, x) });
  }

  // Monotonía: se trocea por puntos críticos y asíntotas verticales.
  const monotonic = monotonicIntervals(f1, uniqueSorted([...critRaw, ...verticalAsymptotes]));

  // Concavidad e inflexión.
  const inflRaw = uniqueSorted(
    polyRealRoots(f2.n)
      .map((r) => r.x)
      .filter((x) => !domainExcluded.some((e) => Math.abs(e - x) < 1e-6))
  );
  const concavity = concavityIntervals(f2, uniqueSorted([...inflRaw, ...verticalAsymptotes]));
  const inflectionPoints: AnalysisPoint[] = [];
  for (const x of inflRaw) {
    const before = rEval(f2, x - 1e-3);
    const after = rEval(f2, x + 1e-3);
    const y = rEval(simplified, x);
    if (isFinite(before) && isFinite(after) && before * after < 0 && isFinite(y)) {
      inflectionPoints.push({ x: Number(x.toFixed(6)), y: Number(y.toFixed(6)) });
    }
  }

  const domainText =
    domainExcluded.length === 0
      ? "ℝ (todos los reales)"
      : `ℝ \\ {${domainExcluded.map(fmt).join(", ")}}`;

  return {
    ...base,
    exact: true,
    simplifiedExpression: rationalToString(simplified, variable),
    domainText,
    domainExcluded,
    holes,
    verticalAsymptotes,
    horizontalAsymptote: horizontalAsymptote === null ? null : Number(horizontalAsymptote.toFixed(6)),
    obliqueAsymptote,
    yIntercept,
    roots,
    criticalPoints,
    monotonic,
    concavity,
    inflectionPoints,
    symmetry: detectSymmetry((x) => rEval(simplified, x)),
    warnings,
  };
}

function classifyCritical(f1: Rational, f2: Rational, x: number): CriticalPoint["type"] {
  const second = rEval(f2, x);
  if (isFinite(second) && Math.abs(second) > 1e-6) return second > 0 ? "Mínimo" : "Máximo";
  const before = rEval(f1, x - 1e-3);
  const after = rEval(f1, x + 1e-3);
  if (!isFinite(before) || !isFinite(after)) return "No concluyente";
  if (before > 0 && after < 0) return "Máximo";
  if (before < 0 && after > 0) return "Mínimo";
  return "No concluyente";
}

function monotonicIntervals(f1: Rational, breaks: number[]): MonotonicInterval[] {
  const out: MonotonicInterval[] = [];
  const pts = uniqueSorted(breaks);
  const ranges: Array<[number, number]> = [];
  if (pts.length === 0) {
    ranges.push([-6, 6]);
  } else {
    ranges.push([pts[0] - 2, pts[0]]);
    for (let i = 0; i < pts.length - 1; i++) ranges.push([pts[i], pts[i + 1]]);
    ranges.push([pts[pts.length - 1], pts[pts.length - 1] + 2]);
  }
  for (const [a, b] of ranges) {
    const mid = (a + b) / 2;
    const sign = rEval(f1, mid);
    if (!isFinite(sign) || Math.abs(sign) < 1e-9) continue;
    out.push({ from: Number(a.toFixed(4)), to: Number(b.toFixed(4)), behavior: sign > 0 ? "crece" : "decrece" });
  }
  return out;
}

function concavityIntervals(f2: Rational, breaks: number[]): ConcavityInterval[] {
  const out: ConcavityInterval[] = [];
  const pts = uniqueSorted(breaks);
  const ranges: Array<[number, number]> = [];
  if (pts.length === 0) {
    ranges.push([-6, 6]);
  } else {
    ranges.push([pts[0] - 2, pts[0]]);
    for (let i = 0; i < pts.length - 1; i++) ranges.push([pts[i], pts[i + 1]]);
    ranges.push([pts[pts.length - 1], pts[pts.length - 1] + 2]);
  }
  for (const [a, b] of ranges) {
    const mid = (a + b) / 2;
    const sign = rEval(f2, mid);
    if (!isFinite(sign) || Math.abs(sign) < 1e-9) continue;
    out.push({ from: Number(a.toFixed(4)), to: Number(b.toFixed(4)), behavior: sign > 0 ? "cóncava" : "convexa" });
  }
  return out;
}

function rationalToString(r: Rational, variable: string): string {
  const n = polyToString(r.n, variable);
  if (polyDeg(r.d) === 0) {
    const k = r.d[0];
    if (Math.abs(k - 1) < 1e-12) return n;
    return `(${n}) / ${fmt(k)}`;
  }
  return `(${n}) / (${polyToString(r.d, variable)})`;
}

function detectSymmetry(f: (x: number) => number): string {
  const samples = [0.7, 1.3, 2.1, 3.4];
  let even = true;
  let odd = true;
  for (const s of samples) {
    const fp = f(s);
    const fn = f(-s);
    if (!isFinite(fp) || !isFinite(fn)) {
      even = false;
      odd = false;
      break;
    }
    if (Math.abs(fp - fn) > 1e-6) even = false;
    if (Math.abs(fp + fn) > 1e-6) odd = false;
  }
  if (even) return "Par: f(-x) = f(x) (simetría respecto al eje Y)";
  if (odd) return "Impar: f(-x) = -f(x) (simetría respecto al origen)";
  return "Sin simetría";
}

// -----------------------------------------------------------------------------
// Análisis numérico de respaldo (funciones no racionales)
// -----------------------------------------------------------------------------

function numericFallback(sanitized: string, variable: string, base: FunctionAnalysis): FunctionAnalysis {
  const warnings: string[] = [
    "Análisis aproximado: la expresión no es polinómica ni racional; dominio y asíntotas se estiman numéricamente.",
  ];
  const f = (x: number) => {
    try {
      return evaluateUniversalMath(sanitized, { [variable]: x });
    } catch {
      return NaN;
    }
  };

  // Raíces por cambio de signo, evitando saltos de polo.
  const roots: Array<{ x: number; multiplicity: number }> = [];
  const step = 0.02;
  let prevX = -15;
  let prevY = f(prevX);
  for (let x = -15 + step; x <= 15; x += step) {
    const y = f(x);
    const midY = f((x + prevX) / 2);
    const pole =
      !isFinite(midY) || Math.abs(midY) > Math.max(Math.abs(y), Math.abs(prevY)) * 20 + 500;
    if (isFinite(prevY) && isFinite(y) && !pole && prevY * y < 0) {
      let lo = prevX;
      let hi = x;
      for (let k = 0; k < 50; k++) {
        const mid = (lo + hi) / 2;
        if (f(lo) * f(mid) <= 0) hi = mid;
        else lo = mid;
      }
      roots.push({ x: Number(((lo + hi) / 2).toFixed(4)), multiplicity: 1 });
    }
    prevX = x;
    prevY = y;
  }

  // Extremos por cambio de signo de la derivada numérica (con refinamiento).
  const h = 1e-4;
  const df = (x: number) => (f(x + h) - f(x - h)) / (2 * h);
  const criticalPoints: CriticalPoint[] = [];
  let prevD = df(-10);
  let prevScanX = -10;
  for (let x = -10 + step; x <= 10; x += step) {
    const d = df(x);
    if (isFinite(prevD) && isFinite(d) && prevD * d < 0) {
      let lo = prevScanX;
      let hi = x;
      let loSign = Math.sign(prevD);
      for (let k = 0; k < 60; k += 1) {
        const mid = (lo + hi) / 2;
        const midSign = Math.sign(df(mid));
        if (midSign === 0) {
          lo = mid;
          hi = mid;
          break;
        }
        if (midSign === loSign) lo = mid;
        else hi = mid;
      }
      const cx = Number(((lo + hi) / 2).toFixed(6));
      const cy = f(cx);
      if (isFinite(cy)) {
        const second = (df(cx + h) - df(cx - h)) / (2 * h);
        const type: CriticalPoint["type"] = isFinite(second) && Math.abs(second) > 1e-7
          ? second > 0
            ? "Mínimo"
            : "Máximo"
          : prevD > 0
            ? "Máximo"
            : "Mínimo";
        criticalPoints.push({ x: cx, y: Number(cy.toFixed(4)), type });
      }
    }
    prevD = d;
    prevScanX = x;
  }

  // Segunda derivada numérica: concavidad e inflexión.
  const h2 = 1e-3;
  const d2f = (x: number) => (f(x + h2) - 2 * f(x) + f(x - h2)) / (h2 * h2);
  const inflectionCandidates: number[] = [];
  let prevSecond = d2f(-10);
  for (let x = -10 + step; x <= 10; x += step) {
    const second = d2f(x);
    if (isFinite(prevSecond) && isFinite(second) && prevSecond * second < 0) {
      inflectionCandidates.push(x);
    }
    prevSecond = second;
  }

  const concavity: ConcavityInterval[] = [];
  const inflectionPoints: AnalysisPoint[] = [];
  const breakpoints = uniqueSorted(inflectionCandidates);
  const intervals: Array<[number, number]> = [];
  if (breakpoints.length === 0) {
    intervals.push([-10, 10]);
  } else {
    intervals.push([-10, breakpoints[0]]);
    for (let i = 0; i < breakpoints.length - 1; i += 1) {
      intervals.push([breakpoints[i], breakpoints[i + 1]]);
    }
    intervals.push([breakpoints[breakpoints.length - 1], 10]);
  }
  for (const [start, end] of intervals) {
    const mid = (start + end) / 2;
    const second = d2f(mid);
    if (isFinite(second) && Math.abs(second) > 1e-7) {
      concavity.push({
        from: Number(start.toFixed(4)),
        to: Number(end.toFixed(4)),
        behavior: second > 0 ? "cóncava" : "convexa",
      });
    }
  }
  for (const candidate of breakpoints) {
    const x = Number(candidate.toFixed(4));
    const y = f(x);
    if (isFinite(y)) {
      inflectionPoints.push({ x, y: Number(y.toFixed(4)) });
    }
  }

  // Asíntotas verticales aproximadas: |f| explota y es finita a ambos lados.
  const verticalAsymptotes: number[] = [];
  for (let x = -14.98; x <= 15; x += 0.02) {
    const value = f(x);
    if (!isFinite(value) || Math.abs(value) < 1e6) continue;
    const left = f(x - 0.005);
    const right = f(x + 0.005);
    if (
      isFinite(left) &&
      isFinite(right) &&
      Math.abs(left) > 1e5 &&
      Math.abs(right) > 1e5
    ) {
      const rounded = Number(x.toFixed(3));
      if (!verticalAsymptotes.some((existing) => Math.abs(existing - rounded) < 0.1)) {
        verticalAsymptotes.push(rounded);
      }
    }
  }

  // Dominio aproximado a partir de sondas puntuales.
  let domainText = "No determinable simbólicamente (análisis numérico)";
  const samples = [-3, -1, 0, 1, 2, 3, 5];
  const defined = samples.map((value) => isFinite(f(value)));
  if (defined.every(Boolean)) {
    domainText = "ℝ (verificado numéricamente en las muestras)";
  } else if (defined.every((value) => !value)) {
    domainText = "Sin valores reales en las muestras analizadas";
  } else {
    const excluded = samples.filter((_, index) => !defined[index]);
    domainText = `Aproximado: no definida en x ≈ ${excluded.join(", ")} (muestreo numérico)`;
  }

  const y0 = f(0);
  return {
    ...base,
    exact: false,
    simplifiedExpression: null,
    domainText,
    verticalAsymptotes,
    yIntercept: isFinite(y0) ? Number(y0.toFixed(4)) : null,
    roots,
    criticalPoints,
    concavity,
    inflectionPoints,
    symmetry: detectSymmetry(f),
    warnings,
  };
}

// -----------------------------------------------------------------------------
// Integral definida
// -----------------------------------------------------------------------------

export type IntegralKind =
  | "propia"
  | "impropia-convergente"
  | "impropia-divergente"
  | "no-analizable";

export interface IntegralAnalysis {
  /** Integral con signo (área neta). */
  netArea: number | null;
  /** Área geométrica absoluta ∫|f|. */
  absoluteArea: number | null;
  /** `true` si el valor es exacto (polinómico/simbólico), `false` si es numérico. */
  exact: boolean;
  improper: boolean;
  divergent: boolean;
  kind: IntegralKind;
  /** Puntos singulares interiores detectados. */
  singularities: number[];
  message: string;
}

function compositeSimpson(fn: (x: number) => number, a: number, b: number, n = 4000): number {
  const steps = n % 2 === 0 ? n : n + 1;
  const h = (b - a) / steps;
  let sum = fn(a) + fn(b);
  for (let i = 1; i < steps; i++) {
    const v = fn(a + i * h);
    if (!isFinite(v)) return NaN;
    sum += v * (i % 2 === 0 ? 2 : 4);
  }
  return (sum * h) / 3;
}

export function analyzeDefiniteIntegral(
  expression: string,
  a: number,
  b: number,
  variable = "x",
  params: Record<string, number> = {}
): IntegralAnalysis {
  const sanitized = substituteParams(sanitizeMathExpression(expression), params, variable);
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const sign = a <= b ? 1 : -1;

  const parsed = parseRational(sanitized, variable);
  if (parsed) {
    const original: Rational = { n: trim(parsed.n), d: trim(parsed.d) };
    const simplified = simplifyRational(original);

    // Asíntotas verticales (denominador simplificado): si caen en el intervalo
    // cerrado, la integral impropia diverge.
    const poles = polyRealRoots(simplified.d)
      .map((r) => r.x)
      .filter((x) => x >= lo - 1e-9 && x <= hi + 1e-9);
    if (poles.length > 0) {
      return {
        netArea: null,
        absoluteArea: null,
        exact: false,
        improper: true,
        divergent: true,
        kind: "impropia-divergente",
        singularities: uniqueSorted(poles),
        message: `Integral impropia divergente: asíntota vertical en ${uniqueSorted(poles)
          .map(fmt)
          .join(", ")} dentro de [${fmt(lo)}, ${fmt(hi)}].`,
      };
    }

    // Huecos (factores cancelados): discontinuidades removibles → convergente.
    const holes = interiorRoots(polyGcd(original.n, original.d), lo, hi);
    const improper = holes.length > 0;

    if (polyDeg(simplified.d) === 0) {
      const poly = polyScale(simplified.n, 1 / simplified.d[0]);
      const netArea = sign * polyDefiniteIntegral(poly, lo, hi);
      const absoluteArea = polyAbsDefiniteIntegral(poly, lo, hi);
      return {
        netArea: Number(netArea.toFixed(9)),
        absoluteArea: Number(absoluteArea.toFixed(9)),
        exact: true,
        improper,
        divergent: false,
        kind: improper ? "impropia-convergente" : "propia",
        singularities: holes,
        message: improper
          ? "Integral impropia convergente: las discontinuidades interiores son removibles (huecos)."
          : "Integral definida propia (resultado exacto).",
      };
    }

    const netArea = sign * compositeSimpson((x) => rEval(simplified, x), lo, hi);
    const absoluteArea = compositeSimpson((x) => Math.abs(rEval(simplified, x)), lo, hi);
    return {
      netArea: isFinite(netArea) ? Number(netArea.toFixed(6)) : null,
      absoluteArea: isFinite(absoluteArea) ? Number(absoluteArea.toFixed(6)) : null,
      exact: false,
      improper,
      divergent: false,
      kind: improper ? "impropia-convergente" : "propia",
      singularities: holes,
      message: improper
        ? "Integral impropia convergente (resultado numérico; las singularidades interiores son removibles)."
        : "Integral definida propia (resultado numérico).",
    };
  }

  // Respaldo numérico sobre la expresión original.
  const f = (x: number) => evaluateUniversalMath(sanitized, { [variable]: x });
  const singularities: number[] = [];
  const probes = 400;
  for (let i = 1; i < probes; i++) {
    const x = lo + ((hi - lo) * i) / probes;
    const v = f(x);
    if (!isFinite(v)) singularities.push(Number(x.toFixed(4)));
  }
  if (singularities.length > 0) {
    return {
      netArea: null,
      absoluteArea: null,
      exact: false,
      improper: true,
      divergent: true,
      kind: "impropia-divergente",
      singularities: uniqueSorted(singularities).slice(0, 8),
      message: "Integral impropia: se detectaron puntos no definidos en el interior del intervalo.",
    };
  }
  const netArea = sign * compositeSimpson(f, lo, hi);
  const absoluteArea = compositeSimpson((x) => Math.abs(f(x)), lo, hi);
  return {
    netArea: isFinite(netArea) ? Number(netArea.toFixed(6)) : null,
    absoluteArea: isFinite(absoluteArea) ? Number(absoluteArea.toFixed(6)) : null,
    exact: false,
    improper: false,
    divergent: false,
    kind: "propia",
    singularities: [],
    message: "Integral definida propia (resultado numérico).",
  };
}
