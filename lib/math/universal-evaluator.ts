// =============================================================================
// MOTOR EVALUADOR MATEMÁTICO UNIVERSAL DE RESOLVE
// =============================================================================

export function sanitizeMathExpression(raw: string): string {
  if (!raw) return "";
  let s = raw.trim();

  // 1. Limpieza de prefijos comunes
  s = s.replace(/^(?:f\(x\)|y|P\(x\)|resultado)\s*=\s*/i, "");

  // 2. Fracciones LaTeX: \frac{a}{b} -> ((a)/(b))
  const fracRegex = /\\frac\{([^{}]+)\}\{([^{}]+)\}/g;
  while (fracRegex.test(s)) {
    s = s.replace(fracRegex, "(($1)/($2))");
  }

  // 3. Símbolo de raíz cuadrada tipográfico: √3782 o √(x+2) -> sqrt(...)
  s = s.replace(/√\(([^()]+)\)/g, "sqrt($1)");
  s = s.replace(/√([0-9a-zA-Z_.]+)/g, "sqrt($1)");

  // 4. Valor absoluto: |x - 2| -> abs(x - 2)
  s = s.replace(/\|([^|]+)\|/g, "abs($1)");

  // 5. Operadores tipográficos
  s = s.replace(/×/g, "*");
  s = s.replace(/÷/g, "/");
  s = s.replace(/·/g, "*");
  s = s.replace(/−/g, "-");
  s = s.replace(/\\cdot/g, "*");
  s = s.replace(/\\times/g, "*");
  s = s.replace(/\\div/g, "/");
  s = s.replace(/\\left|\\right/g, "");

  // 6. Constantes matemáticas
  s = s.replace(/π/g, "pi");

  return s.trim();
}

// Evaluación numérica segura con soporte para variables y parámetros
export function evaluateUniversalMath(
  expr: string,
  vars: Record<string, number> = {}
): number {
  try {
    let s = sanitizeMathExpression(expr).toLowerCase().replace(/\s+/g, "");
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
    s = s.replace(/ln/g, "Math.log");
    s = s.replace(/log10/g, "Math.log10");
    s = s.replace(/exp/g, "Math.exp");
    s = s.replace(/\bpi\b/g, "Math.PI");
    s = s.replace(/\be\b/g, "Math.E");

    // Variables dinámicas (x, y, z, t, a, b, c...)
    const varKeys = Object.keys(vars);
    const varValues = Object.values(vars);

    // eslint-disable-next-line no-new-func
    const fn = new Function(...varKeys, `"use strict"; return (${s});`);
    const val = fn(...varValues);
    return typeof val === "number" && !isNaN(val) && isFinite(val) ? val : NaN;
  } catch {
    return NaN;
  }
}