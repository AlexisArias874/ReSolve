// Sanitizador universal para que ninguna calculadora falle por caracteres raros
export function cleanMathInput(input: string): string {
  if (!input) return "";
  let s = input.trim();

  // 1. Quitar prefijos comunes de texto
  s = s.replace(/^(?:f\(x\)|y|P\(x\))\s*=\s*/i, "");

  // 2. Convertir fracciones LaTeX: \frac{a}{b} -> ((a)/(b))
  const fracRegex = /\\frac\{([^{}]+)\}\{([^{}]+)\}/g;
  while (fracRegex.test(s)) {
    s = s.replace(fracRegex, "(($1)/($2))");
  }

  // 3. Convertir símbolo de raíz cuadrada tipográfico: √3782 o √(x+2) -> sqrt(...)
  s = s.replace(/√\(([^()]+)\)/g, "sqrt($1)");
  s = s.replace(/√([0-9a-zA-Z]+)/g, "sqrt($1)");

  // 4. Operadores tipográficos comunes
  s = s.replace(/×/g, "*");
  s = s.replace(/÷/g, "/");
  s = s.replace(/·/g, "*");
  s = s.replace(/−/g, "-");

  // 5. Limpieza de comandos LaTeX residuales
  s = s.replace(/\\left|\\right/g, "");
  s = s.replace(/\\cdot/g, "*");
  s = s.replace(/\\times/g, "*");
  s = s.replace(/\\div/g, "/");

  return s.trim();
}