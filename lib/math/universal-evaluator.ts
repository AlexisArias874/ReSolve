// =============================================================================
// MOTOR EVALUADOR MATEMÁTICO UNIVERSAL DE RESOLVE
// =============================================================================

// -----------------------------------------------------------------------------
// Parseo de LaTeX -> sintaxis plana evaluable
// -----------------------------------------------------------------------------

/** Extrae el contenido de un grupo `{...}` balanceado que empieza en `start`. */
function extractBraced(s: string, start: number): { content: string; end: number } | null {
  if (s[start] !== "{") return null;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return { content: s.slice(start + 1, i), end: i };
    }
  }
  return null;
}

/**
 * Convierte `\frac{a}{b}` → `((a)/(b))` soportando llaves anidadas
 * (p. ej. `\frac{3x^{3}-7}{x^{2}+1}`), reemplazando de dentro hacia fuera.
 */
function replaceLatexFrac(input: string): string {
  let s = input;
  let guard = 0;
  while (guard++ < 200) {
    const idx = s.indexOf("\\frac");
    if (idx === -1) break;
    let p = idx + 5;
    while (s[p] === " ") p++;
    const num = extractBraced(s, p);
    if (!num) break;
    let q = num.end + 1;
    while (s[q] === " ") q++;
    const den = extractBraced(s, q);
    if (!den) break;
    s = s.slice(0, idx) + `((${num.content})/(${den.content}))` + s.slice(den.end + 1);
  }
  return s;
}

/**
 * Convierte `\sqrt{a}` → `sqrt(a)` y `\sqrt[n]{a}` → `((a)^(1/(n)))`
 * soportando llaves anidadas.
 */
function replaceLatexRoot(input: string): string {
  let s = input;
  let guard = 0;
  while (guard++ < 200) {
    const idx = s.indexOf("\\sqrt");
    if (idx === -1) break;
    let p = idx + 5;
    let degree: string | null = null;
    while (s[p] === " ") p++;
    if (s[p] === "[") {
      const close = s.indexOf("]", p);
      if (close === -1) break;
      degree = s.slice(p + 1, close).trim();
      p = close + 1;
    }
    while (s[p] === " ") p++;
    const arg = extractBraced(s, p);
    if (!arg) break;
    const inner = degree ? `((${arg.content})^(1/(${degree})))` : `sqrt(${arg.content})`;
    s = s.slice(0, idx) + inner + s.slice(arg.end + 1);
  }
  return s;
}

/** Extrae el contenido de un grupo `(...)` balanceado que empieza en `start`. */
function extractBalancedParen(s: string, start: number): { content: string; end: number } | null {
  if (s[start] !== "(") return null;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return { content: s.slice(start + 1, i), end: i };
    }
  }
  return null;
}

/**
 * Convierte el símbolo tipográfico de raíz `√x` / `√(x+2)` → `sqrt(...)` y
 * `∛x` / `∛(x)` → `cbrt(...)`, soportando paréntesis anidados.
 */
function replaceRadicalSymbols(input: string): string {
  let s = input;
  let guard = 0;
  while (guard++ < 200) {
    const idx = s.search(/[√∛]/);
    if (idx === -1) break;
    const fn = s[idx] === "√" ? "sqrt" : "cbrt";
    let p = idx + 1;
    while (s[p] === " ") p++;
    if (s[p] === "(") {
      const arg = extractBalancedParen(s, p);
      if (!arg) break;
      s = s.slice(0, idx) + `${fn}(${arg.content})` + s.slice(arg.end + 1);
    } else {
      const m = /^[0-9a-zA-Z_.]+/.exec(s.slice(p));
      if (!m) {
        s = s.slice(0, idx) + fn + s.slice(idx + 1);
        continue;
      }
      s = s.slice(0, idx) + `${fn}(${m[0]})` + s.slice(p + m[0].length);
    }
  }
  return s;
}

/**
 * Normaliza una expresión escrita en lenguaje natural o LaTeX a la sintaxis plana
 * evaluable por los motores (`^`, `*`, `/`, `sqrt()`, `^`, `pi`, …). Acepta
 * fracciones anidadas, potencias/subíndices con llaves, raíces con índice,
 * comandos de función LaTeX y delimitadores de modo matemático.
 */
export function sanitizeMathExpression(raw: string): string {
  if (!raw) return "";
  let s = raw.trim();

  // 0. Delimitadores de modo matemático LaTeX ($…$, $$…$$, \[…\], \(…\))
  s = s.replace(/\$\$?/g, " ");
  s = s.replace(/\\[\[\]()]/g, " ");

  // 1. Limpieza de prefijos comunes
  s = s.replace(/^(?:f\(x\)|y|P\(x\)|resultado)\s*=\s*/i, "");

  // 2. Fracciones LaTeX con llaves anidadas: \frac{a}{b} -> ((a)/(b))
  s = replaceLatexFrac(s);

  // 3. Raíces LaTeX: \sqrt{a} -> sqrt(a) ; \sqrt[n]{a} -> ((a)^(1/(n)))
  s = replaceLatexRoot(s);

  // 4. Símbolo de raíz tipográfico: √3782 o √(x+2) -> sqrt(...) (paréntesis anidados)
  s = replaceRadicalSymbols(s);

  // 5. Potencias y subíndices LaTeX: x^{2} -> x^(2) ; x_{1} -> x_1
  s = s.replace(/\^\s*\{([^{}]*)\}/g, "^($1)");
  s = s.replace(/_\s*\{([^{}]*)\}/g, "_$1");

  // 6. Comandos de función LaTeX -> texto plano
  s = s.replace(
    /\\(arcsin|arccos|arctan|sinh|cosh|tanh|sin|cos|tan|cot|sec|csc|ln|log|exp|abs|min|max)\b/g,
    "$1"
  );
  s = s.replace(/\\pi\b/g, "pi");
  s = s.replace(/\\infty\b/g, "Infinity");

  // 7. Potencia textual: pow(base, exp) -> ((base)^(exp))
  s = s.replace(/\bpow\s*\(\s*([^,()]+)\s*,\s*([^()]+?)\s*\)/gi, "(($1)^($2))");

  // 8. Valor absoluto: |x - 2| -> abs(x - 2)
  s = s.replace(/\|([^|]+)\|/g, "abs($1)");

  // 9. Operadores tipográficos y LaTeX
  s = s.replace(/×/g, "*");
  s = s.replace(/÷/g, "/");
  s = s.replace(/·/g, "*");
  s = s.replace(/−/g, "-");
  s = s.replace(/\\cdot/g, "*");
  s = s.replace(/\\times/g, "*");
  s = s.replace(/\\div/g, "/");
  s = s.replace(/\\(?:left|right|,|;|!|:|quad|qquad)/g, " ");

  // 10. Constantes matemáticas
  s = s.replace(/π/g, "pi");

  // 11. Restos de LaTeX: llaves sueltas y comandos desconocidos
  s = s.replace(/[{}]/g, "");
  s = s.replace(/\\([a-zA-Z]+)/g, "$1");

  return s.trim();
}

/**
 * Expande factoriales numéricos a su valor: `5!` -> `(120)`. Los factoriales
 * simbólicos (p. ej. `n!`) se dejan intactos. Así los módulos pueden resolver
 * expresiones con `!` aunque no implementen factorial de forma nativa.
 */
export function expandNumericFactorials(expr: string): string {
  if (!expr || !expr.includes("!")) return expr;
  return expr.replace(/(\d+)\s*!/g, (_, n: string) => {
    const k = parseInt(n, 10);
    if (k > 170) return "Infinity";
    let acc = 1;
    for (let i = 2; i <= k; i++) acc *= i;
    return `(${acc})`;
  });
}

// Evaluación numérica segura con soporte para variables y parámetros.
// `evaluateUniversalMath` descarta valores no finitos (NaN/±∞), mientras que
// `evaluateUniversalMathRaw` conserva ±∞ para analizar límites y divergencias.
export function evaluateUniversalMathRaw(
  expr: string,
  vars: Record<string, number> = {}
): number {
  try {
    let s = expandNumericFactorials(sanitizeMathExpression(expr))
      .toLowerCase()
      .replace(/\s+/g, "");
    if (!s) return NaN;

    if (s === "gauss" || s.includes("campana")) s = "exp(-x^2)";

    // Alias e^... a exp(...)
    s = s.replace(/e\s*\^\s*\(([^()]+)\)/g, "exp($1)");
    s = s.replace(/e\s*\^\s*([a-zA-Z0-9_.]+)/g, "exp($1)");

    // Multiplicación implícita
    s = s.replace(/([0-9])([a-zA-Z(]|sqrt|abs|sin|cos|tan|ln|log|exp)/g, "$1*$2");
    s = s.replace(/\)([\d\w(]|sqrt|abs|sin|cos|tan|exp)/g, ")*$1");

    // Corrección crítica: signo negativo antes de potencias (-x^2 -> -(x^2))
    s = s.replace(
      /(^|[+\-*/,(])\s*-\s*([a-zA-Z0-9_.]+|\([^()]+\))\s*\^\s*([+-]?[a-zA-Z0-9_.]+|\([^()]+\))/g,
      "$1-(($2)^($3))"
    );
    s = s.replace(/\^\s*-\s*([a-zA-Z0-9_.]+|\([^()]+\))/g, "^(-($1))");
    s = s.replace(/\^/g, "**");

    // Mapeo a funciones de Math de JavaScript
    s = s.replace(/sqrt/g, "Math.sqrt");
    s = s.replace(/cbrt/g, "Math.cbrt");
    s = s.replace(/abs/g, "Math.abs");
    s = s.replace(/sin/g, "Math.sin");
    s = s.replace(/cos/g, "Math.cos");
    s = s.replace(/tan/g, "Math.tan");
    s = s.replace(/log10/g, "Math.log10");
    // `log(...)` sin base = logaritmo decimal (convención universitaria)
    s = s.replace(/\blog\b/g, "Math.log10");
    s = s.replace(/ln/g, "Math.log");
    s = s.replace(/exp/g, "Math.exp");
    s = s.replace(/\bpi\b/g, "Math.PI");
    s = s.replace(/\be\b/g, "Math.E");

    // Variables dinámicas (x, y, z, t, a, b, c...)
    const varKeys = Object.keys(vars);
    const varValues = Object.values(vars);

    // eslint-disable-next-line no-new-func
    const fn = new Function(...varKeys, `"use strict"; return (${s});`);
    const val = fn(...varValues);
    return typeof val === "number" && !isNaN(val) ? val : NaN;
  } catch {
    return NaN;
  }
}

/** Igual que `evaluateUniversalMathRaw`, pero solo devuelve valores finitos. */
export function evaluateUniversalMath(
  expr: string,
  vars: Record<string, number> = {}
): number {
  const value = evaluateUniversalMathRaw(expr, vars);
  return isFinite(value) ? value : NaN;
}