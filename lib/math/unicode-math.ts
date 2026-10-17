// -----------------------------------------------------------------------------
// Utilidades de notación matemática en texto plano
// Convierten dígitos ASCII a subíndices/superíndices Unicode para los campos de
// texto (descripciones, etiquetas) que NO se renderizan con KaTeX.
// -----------------------------------------------------------------------------

const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";
const SUPERSCRIPT_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/** Convierte cada dígito de `value` a su equivalente subíndice Unicode. */
export const toSubscript = (value: string | number): string =>
  String(value).replace(/\d/g, (digit) => SUBSCRIPT_DIGITS[+digit]);

/** Convierte cada dígito de `value` a su equivalente superíndice Unicode. */
export const toSuperscript = (value: string | number): string =>
  String(value).replace(/\d/g, (digit) => SUPERSCRIPT_DIGITS[+digit]);
