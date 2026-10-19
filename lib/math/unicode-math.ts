// -----------------------------------------------------------------------------
// Utilidades de notación matemática en texto plano
// Convierten dígitos ASCII a subíndices/superíndices Unicode para los campos de
// texto (descripciones, etiquetas) que NO se renderizan con KaTeX.
// Además, traducen funciones escritas de forma textual (`sqrt`, `pow`, `cbrt`,
// `abs`, `pi`...) a símbolos matemáticos legibles, tanto para texto plano como
// para expresiones LaTeX renderizadas con KaTeX.
// -----------------------------------------------------------------------------

const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";
const SUPERSCRIPT_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/** Convierte cada dígito de `value` a su equivalente subíndice Unicode. */
export const toSubscript = (value: string | number): string =>
  String(value).replace(/\d/g, (digit) => SUBSCRIPT_DIGITS[+digit]);

/** Convierte cada dígito de `value` a su equivalente superíndice Unicode. */
export const toSuperscript = (value: string | number): string =>
  String(value).replace(/\d/g, (digit) => SUPERSCRIPT_DIGITS[+digit]);

// -----------------------------------------------------------------------------
// Traducción de funciones textuales -> símbolos matemáticos
// -----------------------------------------------------------------------------

/** Índice del paréntesis de cierre equilibrado, o -1 si no hay cierre. */
function findClosingParen(text: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    const c = text[i];
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Reescribe llamadas unarias `name(...)` aplicando `render` al contenido. */
function rewriteUnaryCalls(
  text: string,
  name: string,
  render: (inner: string) => string
): string {
  const re = new RegExp(`\\b${name}\\s*\\(`, "gi");
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const openIndex = m.index + m[0].length - 1;
    const close = findClosingParen(text, openIndex);
    if (close === -1) break;
    const inner = text.slice(openIndex + 1, close);
    out += text.slice(last, m.index) + render(inner);
    last = close + 1;
    re.lastIndex = last;
  }
  return out + text.slice(last);
}

/** Reescribe llamadas binarias `pow(base, exp)` -> `render(base, exp)`. */
function rewritePowCalls(
  text: string,
  render: (base: string, exp: string) => string
): string {
  const re = /\bpow\s*\(/gi;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const openIndex = m.index + m[0].length - 1;
    let depth = 0;
    let comma = -1;
    let close = -1;
    for (let i = openIndex; i < text.length; i++) {
      const c = text[i];
      if (c === "(") depth++;
      else if (c === ")") {
        depth--;
        if (depth === 0) {
          close = i;
          break;
        }
      } else if (c === "," && depth === 1) {
        comma = i;
      }
    }
    if (close === -1 || comma === -1) break;
    const base = text.slice(openIndex + 1, comma).trim();
    const exp = text.slice(comma + 1, close).trim();
    out += text.slice(last, m.index) + render(base, exp);
    last = close + 1;
    re.lastIndex = last;
  }
  return out + text.slice(last);
}

/** Envuelve en paréntesis solo cuando la sub-expresión no es un token simple. */
function wrapCompound(expr: string): string {
  const trimmed = expr.trim();
  return /^[a-zA-Z0-9_.]+$/.test(trimmed) ? trimmed : `(${trimmed})`;
}

/**
 * Convierte funciones textuales a símbolos matemáticos legibles en texto plano:
 *   `sqrt(2)` -> `√2`, `sqrt(x + 1)` -> `√(x + 1)`, `cbrt(8)` -> `∛8`,
 *   `pow(2, 3)` -> `2^3`, `abs(x)` -> `|x|`, `pi` -> `π`, `inf` -> `∞`.
 */
export function toMathSymbols(input: string): string {
  if (!input) return input;
  let s = input;
  for (let i = 0; i < 4; i++) {
    const before = s;
    s = rewritePowCalls(s, (base, exp) => `${wrapCompound(base)}^${wrapCompound(exp)}`);
    s = rewriteUnaryCalls(s, "sqrt", (x) => `√${wrapCompound(x)}`);
    s = rewriteUnaryCalls(s, "cbrt", (x) => `∛${wrapCompound(x)}`);
    s = rewriteUnaryCalls(s, "abs", (x) => `|${x}|`);
    if (s === before) break;
  }
  s = s.replace(/(^|[^\\])\bpi\b/gi, "$1π");
  s = s.replace(/(^|[^\\])\b(?:infinity|inf)\b/gi, "$1∞");

  // Restos de LaTeX frecuentes en resultados simbólicos → símbolos Unicode.
  s = s
    .replace(/\\infty\b/g, "∞")
    .replace(/\\to\b/g, "→")
    .replace(/\\pm\b/g, "±")
    .replace(/\\mp\b/g, "∓")
    .replace(/\\times\b/g, "×")
    .replace(/\\cdot\b/g, "·")
    .replace(/\\div\b/g, "÷")
    .replace(/\\le(?:q)?\b/g, "≤")
    .replace(/\\ge(?:q)?\b/g, "≥")
    .replace(/\\neq\b|\\ne\b/g, "≠")
    .replace(/\\approx\b/g, "≈")
    .replace(/\\pi\b/g, "π");

  return s;
}

/**
 * Envuelve una expresión con marcadores de alineación (`&` o `\\`) en un entorno
 * `aligned`, de modo que KaTeX pueda renderizarla (p. ej. sistemas de ecuaciones:
 * `x + y &= 5 \\ x - y &= 1`). Si ya contiene un entorno `\begin{...}` o no hay
 * alineación, se devuelve tal cual.
 */
export function wrapAlignedLatex(math: string): string {
  let trimmed = math.trim();
  if (!trimmed) return trimmed;

  const begins = (trimmed.match(/\\begin\{/g) || []).length;
  const ends = (trimmed.match(/\\end\{/g) || []).length;

  // Entorno ya balanceado: respetar tal cual.
  if (begins > 0 && begins === ends) return trimmed;

  // LaTeX malformado de la IA (p. ej. `&a=b \\ c=d \end{aligned}` sin `\begin`):
  // se quitan los entornos sueltos y se re-envuelve una sola vez.
  if (begins !== ends) {
    trimmed = trimmed.replace(/\\begin\{[^}]+\}|\\end\{[^}]+\}/g, "").trim();
  }

  if (!/&|\\\\/.test(trimmed)) return trimmed;
  return `\\begin{aligned}${trimmed}\\end{aligned}`;
}

/**
 * ¿El texto contiene notación matemática "rica" que KaTeX puede renderizar
 * (`\[ … \]`, `\( … \)`, entornos `\begin{…}` o comandos como `\frac`, `\sqrt`)?
 */
export function hasRichMath(content: string): boolean {
  if (!content) return false;
  return /\\\[|\\\(|\\begin\{|\$\$|\\[a-zA-Z]+/.test(content);
}

/**
 * ¿El texto es prosa con matemáticas incrustadas (p. ej. "x = 2, x = -1 (las
 * demás raíces son complejas…)")? Sirve para decidir entre renderizado KaTeX
 * (fórmula pura) o texto plano legible (prosa mixta).
 */
export function containsProse(text: string): boolean {
  if (!text) return false;
  const cleaned = text
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/\b(sin|cos|tan|cot|sec|csc|log|ln|exp|abs|sqrt|cbrt|max|min|lim|mod|gcd|mathbb|setminus)\b/gi, " ");
  return /[a-záéíóúñü]{4,}/i.test(cleaned);
}

/**
 * Repara malformaciones LaTeX frecuentes que devuelve la IA: comandos de conjunto
 * sin llaves (`\mathbbR` → `\mathbb{R}`), raíces de un token (`\sqrt3` → `\sqrt{3}`)
 * y `\left`/`\right` sueltos. No puede reparar todo (p. ej. `\frac3pmsqrt3 2`).
 */
export function repairLatex(math: string): string {
  if (!math) return math;
  let s = math;
  s = s.replace(/\\(mathbb|mathcal|mathbf|mathrm|operatorname)\s*([A-Za-z])(?![a-zA-Z{])/g, "\\$1{$2}");
  s = s.replace(/\\sqrt\s*([0-9A-Za-z])(?![a-zA-Z{])/g, "\\sqrt{$1}");
  s = s.replace(/\\frac\s*([0-9A-Za-z])\s*([0-9A-Za-z])(?![a-zA-Z0-9{])/g, "\\frac{$1}{$2}");
  s = s.replace(/\\(left|right)\b/g, "");
  return s;
}

/**
 * Traduce LaTeX a texto plano legible (Unicode) para contextos de prosa donde no
 * conviene KaTeX: `\frac{a}{b}` → `(a)/(b)`, `\sqrt{x}` → `√(x)`, `\mathbb{R}` → `ℝ`,
 * `\pm` → `±`, `\setminus` → `\`, etc.
 */
export function latexToPlainText(input: string): string {
  if (!input) return input;
  let s = input;
  s = s.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "($1)/($2)");
  s = s.replace(/\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}/g, "($2)^(1/$1)");
  s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, "√($1)");
  s = s.replace(/\\sqrt\s*([0-9A-Za-z])/g, "√$1");
  s = s
    .replace(/\\mathbb\s*\{\s*R\s*\}/g, "ℝ")
    .replace(/\\mathbb\s*\{\s*N\s*\}/g, "ℕ")
    .replace(/\\mathbb\s*\{\s*Z\s*\}/g, "ℤ")
    .replace(/\\mathbb\s*\{\s*Q\s*\}/g, "ℚ")
    .replace(/\\mathbb\s*\{\s*C\s*\}/g, "ℂ");
  const map: Record<string, string> = {
    pm: "±", mp: "∓", times: "×", cdot: "·", div: "÷", ast: "∗",
    pi: "π", infty: "∞", infinity: "∞", setminus: "\\",
    Rightarrow: "⇒", rightarrow: "→", to: "→", implies: "⇒", iff: "⇔",
    le: "≤", leq: "≤", ge: "≥", geq: "≥", neq: "≠", ne: "≠", approx: "≈", equiv: "≡",
    in: "∈", notin: "∉", subset: "⊂", subseteq: "⊆", cup: "∪", cap: "∩", emptyset: "∅",
    forall: "∀", exists: "∃", sum: "Σ", prod: "Π", int: "∫",
    alpha: "α", beta: "β", gamma: "γ", delta: "δ", theta: "θ", lambda: "λ", mu: "μ", sigma: "σ", omega: "ω",
  };
  s = s.replace(/\\([a-zA-Z]+)/g, (_full, name: string) => map[name] ?? name);
  s = s.replace(/\\[,;:!]/g, " ").replace(/\\quad|\\qquad/g, " ");
  s = s.replace(/\\[{}%$&]/g, "");
  s = s.replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
  return s;
}

/**
 * Convierte los delimitadores `\[ … \]` y `\( … \)` a `$$ … $$` / `$ … $` para que
 * `remark-math` los renderice, preservando el texto en prosa que los rodea.
 */
export function toKatexText(content: string): string {
  let text = toLatexSymbols(content)
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, eq) => `\n\n$$\n${eq.trim()}\n$$\n\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, eq) => ` $${eq.trim()}$ `);
  // Comandos LaTeX sueltos sin delimitadores de matemáticas (p. ej. `\approx`):
  // se envuelve todo el contenido para poder renderizarlo con KaTeX.
  if (/\\[a-zA-Z]/.test(text) && !text.includes("$")) {
    text = `\n\n$$\n${text.trim()}\n$$\n\n`;
  }
  return text;
}

/**
 * Prepara una fórmula canónica para su renderizado con KaTeX: traduce funciones
 * textuales a símbolos y devuelve un bloque de matemáticas en display (`$$…$$`).
 * Si la fórmula es un sistema separado por `;` (`a = b ; c = d`), lo reparte en
 * líneas alineadas para mostrarlo como sistema.
 */
export function toKatexDisplay(formula: string): string {
  let latex = toLatexSymbols(formula.trim());
  // Quita delimitadores matemáticos externos (`\[ … \]`, `\( … \)`, `$$ … $$`,
  // `$ … $`) para no anidar entornos al envolver el resultado en `$$ … $$`.
  latex = latex.replace(/\\\[|\\\]|\\\(|\\\)/g, " ");
  if ((latex.match(/\$/g) || []).length >= 2) {
    latex = latex.replace(/\$/g, " ");
  }
  latex = latex.replace(/[ \t]+/g, " ").trim();
  // Sintaxis plana (forzada por el prompt) -> notación tipográfica para KaTeX.
  latex = latex.replace(/\s*\*\s*/g, " \\cdot ");
  if (/\s;\s/.test(latex)) {
    latex = latex
      .split(/\s*;\s*/)
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" \\\\ ");
  }
  latex = wrapAlignedLatex(latex);
  return `\n\n$$\n${latex}\n$$\n\n`;
}

/**
 * Convierte funciones textuales a LaTeX para su renderizado con KaTeX:
 *   `sqrt(2)` -> `\sqrt{2}`, `cbrt(8)` -> `\sqrt[3]{8}`, `pow(2, 3)` -> `{2}^{3}`,
 *   `abs(x)` -> `\left|x\right|`, `pi` -> `\pi`, `inf` -> `\infty`.
 * No altera expresiones LaTeX existentes (p. ej. `\sqrt{}` o `\pi`).
 */
export function toLatexSymbols(input: string): string {
  if (!input) return input;
  let s = input;
  for (let i = 0; i < 4; i++) {
    const before = s;
    s = rewritePowCalls(s, (base, exp) => `{${base}}^{${exp}}`);
    s = rewriteUnaryCalls(s, "sqrt", (x) => `\\sqrt{${x}}`);
    s = rewriteUnaryCalls(s, "cbrt", (x) => `\\sqrt[3]{${x}}`);
    s = rewriteUnaryCalls(s, "abs", (x) => `\\left|${x}\\right|`);
    if (s === before) break;
  }
  s = s.replace(/(^|[^\\])\bpi\b/gi, "$1\\pi");
  s = s.replace(/(^|[^\\])\b(?:infinity|inf)\b/gi, "$1\\infty");
  return s;
}
