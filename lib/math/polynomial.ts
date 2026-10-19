// =============================================================================
// ReSolve · Álgebra de polinomios y funciones racionales
// -----------------------------------------------------------------------------
// Motor determinista y SINCRÓNICO para funciones polinómicas y racionales. Es la
// fuente de verdad compartida por el análisis de funciones, el graficador y el
// control de integrales: dominio, discontinuidades, asíntotas, raíces con
// multiplicidad, monotonía y concavidad se derivan de los MISMOS coeficientes.
//
// Representación: `Poly` = coeficientes de menor a mayor grado, de modo que
// `[2, -1, 3]` representa `3x² - x + 2`.
// =============================================================================

export type Poly = number[];

const EPS = 1e-12;

/** Elimina coeficientes de mayor grado nulos (conserva al menos `[0]`). */
export function trim(p: Poly): Poly {
  let i = p.length - 1;
  while (i > 0 && Math.abs(p[i]) < EPS) i--;
  return p.slice(0, i + 1);
}

export function isZeroPoly(p: Poly): boolean {
  return p.every((c) => Math.abs(c) < EPS);
}

export function polyDeg(p: Poly): number {
  const t = trim(p);
  return isZeroPoly(t) ? -Infinity : t.length - 1;
}

export function polyAdd(a: Poly, b: Poly): Poly {
  const n = Math.max(a.length, b.length);
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) out[i] = (a[i] ?? 0) + (b[i] ?? 0);
  return trim(out);
}

export function polySub(a: Poly, b: Poly): Poly {
  const n = Math.max(a.length, b.length);
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) out[i] = (a[i] ?? 0) - (b[i] ?? 0);
  return trim(out);
}

export function polyScale(a: Poly, k: number): Poly {
  return trim(a.map((c) => c * k));
}

export function polyMul(a: Poly, b: Poly): Poly {
  if (isZeroPoly(a) || isZeroPoly(b)) return [0];
  const out = new Array<number>(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i]) < EPS) continue;
    for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
  }
  return trim(out);
}

/** Derivada formal. */
export function polyDeriv(p: Poly): Poly {
  if (p.length <= 1) return [0];
  const out = new Array<number>(p.length - 1);
  for (let i = 1; i < p.length; i++) out[i - 1] = p[i] * i;
  return trim(out);
}

/** Evalúa con Horner. */
export function polyEval(p: Poly, x: number): number {
  let acc = 0;
  for (let i = p.length - 1; i >= 0; i--) acc = acc * x + p[i];
  return acc;
}

/** Cota superior del valor absoluto en `x` (para tolerancias relativas). */
export function polyEvalBound(p: Poly, x: number): number {
  let acc = 0;
  const ax = Math.abs(x);
  for (let i = p.length - 1; i >= 0; i--) acc = acc * ax + Math.abs(p[i]);
  return acc;
}

/** División euclídea `a = q·b + r`. Devuelve `null` si el divisor es el polinomio nulo. */
export function polyDivMod(a: Poly, b: Poly): { q: Poly; r: Poly } | null {
  const A = trim(a);
  const B = trim(b);
  if (isZeroPoly(B)) return null;
  const da = A.length - 1;
  const db = B.length - 1;
  if (da < db) return { q: [0], r: A.slice() };
  const q = new Array<number>(da - db + 1).fill(0);
  const r = A.slice();
  const lead = B[db];
  for (let k = da - db; k >= 0; k--) {
    const coeff = r[k + db] / lead;
    q[k] = coeff;
    if (Math.abs(coeff) < EPS) continue;
    for (let i = 0; i <= db; i++) r[k + i] -= coeff * B[i];
  }
  return { q: trim(q), r: trim(r.slice(0, db)) };
}

/** Normaliza a mónico (coeficiente principal 1). */
export function polyMonic(p: Poly): Poly {
  const t = trim(p);
  const lead = t[t.length - 1];
  if (Math.abs(lead) < EPS) return [0];
  return polyScale(t, 1 / lead);
}

/** Máximo común divisor mónico de dos polinomios (algoritmo de Euclides). */
export function polyGcd(a: Poly, b: Poly): Poly {
  let A = polyMonic(a);
  let B = polyMonic(b);
  if (isZeroPoly(B)) return A;
  let guard = 0;
  while (!isZeroPoly(B) && guard++ < 200) {
    const res = polyDivMod(A, B);
    if (!res) break;
    A = B;
    B = isZeroPoly(res.r) ? [0] : polyMonic(res.r);
  }
  return isZeroPoly(A) ? [1] : A;
}

export interface PolyRoot {
  /** Aproximación de la raíz real. */
  x: number;
  /** Multiplicidad en el polinomio original. */
  multiplicity: number;
}

/** Parte libre de cuadrados: `p / gcd(p, p')`, con cada raíz distinta una vez. */
function squareFreePart(p: Poly): Poly {
  const t = trim(p);
  if (polyDeg(t) <= 0) return t;
  const g = polyGcd(t, polyDeriv(t));
  const res = polyDivMod(t, g);
  return res ? trim(res.q) : t;
}

/** Cota de Cauchy para el módulo de las raíces reales/complejas. */
function cauchyBound(p: Poly): number {
  const t = trim(p);
  const lead = Math.abs(t[t.length - 1]);
  if (lead < EPS) return 1;
  const maxOther = Math.max(...t.slice(0, -1).map(Math.abs), 0);
  return 1 + maxOther / lead;
}

function bisect(p: Poly, a: number, b: number): number {
  let lo = a;
  let hi = b;
  let fLo = polyEval(p, lo);
  for (let k = 0; k < 100; k++) {
    const mid = (lo + hi) / 2;
    const fMid = polyEval(p, mid);
    if (fMid === 0) return mid;
    if (fLo * fMid < 0) hi = mid;
    else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

/** Raíces reales de una parte libre de cuadrados (todas simples). */
function realRootsSimple(p: Poly): number[] {
  const t = trim(p);
  if (polyDeg(t) <= 0) return [];
  const bound = cauchyBound(t);
  const N = 2000;
  const roots: number[] = [];
  let prevX = -bound;
  let prevY = polyEval(t, prevX);
  for (let i = 1; i <= N; i++) {
    const x = -bound + (2 * bound * i) / N;
    const y = polyEval(t, x);
    if (prevY === 0) roots.push(prevX);
    if (prevY * y < 0) roots.push(bisect(t, prevX, x));
    prevX = x;
    prevY = y;
  }
  if (prevY === 0) roots.push(prevX);
  return dedupe(roots);
}

function dedupe(values: number[], tol = 1e-6): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) {
    if (out.length === 0 || Math.abs(v - out[out.length - 1]) > tol) out.push(v);
  }
  return out;
}

/** Multiplicidad de la raíz `r` en `p` por evaluación de derivadas sucesivas. */
function multiplicityOf(p: Poly, r: number): number {
  let d = trim(p);
  let k = 0;
  const bound = polyEvalBound(p, r);
  while (polyDeg(d) >= 0) {
    const val = polyEval(d, r);
    const tol = 1e-7 * Math.max(1, bound);
    if (Math.abs(val) > tol) return k;
    k++;
    d = polyDeriv(d);
  }
  return k;
}

/** Raíces reales (distintas) con su multiplicidad en `p`. */
export function polyRealRoots(p: Poly): PolyRoot[] {
  const t = trim(p);
  if (polyDeg(t) <= 0) return [];
  const sf = squareFreePart(t);
  const xs = realRootsSimple(sf);
  return xs.map((x) => ({ x: Number(x.toFixed(9)), multiplicity: multiplicityOf(t, x) }));
}

/** Integral definida exacta de un polinomio. */
export function polyDefiniteIntegral(p: Poly, a: number, b: number): number {
  const anti = new Array<number>(p.length + 1).fill(0);
  for (let i = 0; i < p.length; i++) anti[i + 1] = p[i] / (i + 1);
  return polyEval(anti, b) - polyEval(anti, a);
}

/** Área absoluta exacta `∫|p|` troceando por las raíces reales del intervalo. */
export function polyAbsDefiniteIntegral(p: Poly, a: number, b: number): number {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const inner = polyRealRoots(p)
    .map((r) => r.x)
    .filter((x) => x > lo + 1e-9 && x < hi - 1e-9)
    .sort((x, y) => x - y);
  const pts = [lo, ...inner, hi];
  let area = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const x0 = pts[i];
    const x1 = pts[i + 1];
    const mid = (x0 + x1) / 2;
    const sign = polyEval(p, mid) >= 0 ? 1 : -1;
    area += sign * polyDefiniteIntegral(p, x0, x1);
  }
  return area;
}

// -----------------------------------------------------------------------------
// Presentación
// -----------------------------------------------------------------------------

function numToStr(n: number): string {
  const rounded = Number(n.toFixed(6));
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded);
}

/** Cadena legible de un polinomio ordenado por grado descendente. */
export function polyToString(p: Poly, variable = "x"): string {
  const t = trim(p);
  if (isZeroPoly(t)) return "0";
  const terms: string[] = [];
  for (let deg = t.length - 1; deg >= 0; deg--) {
    const c = t[deg];
    if (Math.abs(c) < EPS) continue;
    const sign = c < 0 ? "-" : "+";
    const abs = Math.abs(c);
    let body: string;
    if (deg === 0) body = numToStr(abs);
    else {
      const coefPart = Math.abs(abs - 1) < EPS ? "" : numToStr(abs);
      body = deg === 1 ? `${coefPart}${variable}` : `${coefPart}${variable}^${deg}`;
    }
    terms.push(`${sign} ${body}`);
  }
  return terms.join(" ").replace(/^\+ /, "").trim();
}
