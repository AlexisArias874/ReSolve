// =============================================================================
// ReSolve · Modelo de pasos estructurado
// -----------------------------------------------------------------------------
// Define la forma canónica de un paso de resolución. Los campos históricos
// (`stage`, `description`, `math`) se conservan para no romper las vistas ya
// existentes; los campos opcionales describen cada transformación con
// información explícita (objetivo, entrada, transformación, resultado,
// restricciones, justificación, verificación y advertencias).
//
// El motor produce estos datos; la interfaz solo los presenta. No debe
// reconstruir operaciones matemáticas a partir de textos explicativos.
// =============================================================================

/** Fiabilidad de la comprobación de un paso. */
export type StepVerification =
  /** Sin comprobación automática. */
  | "none"
  /** Comprobado numéricamente (sustitución / aproximación). */
  | "numeric"
  /** Comprobado simbólicamente (equivalencia algebraica). */
  | "symbolic"
  /** La comprobación falló: el paso no es fiable. */
  | "failed";

export interface EngineStep {
  /** Título descriptivo del paso (campo histórico). */
  stage: string;
  /** Explicación del procedimiento (campo histórico). */
  description: string;
  /** Expresión LaTeX principal a renderizar (campo histórico). */
  math: string;

  /** Orden del paso dentro de la secuencia. */
  id?: number;
  /** Objetivo matemático del paso. */
  objective?: string;
  /** Expresión de entrada (LaTeX). */
  input?: string;
  /** Transformación aplicada (LaTeX). */
  transformation?: string;
  /** Expresión resultante (LaTeX). */
  result?: string;
  /** Restricciones o condiciones que se conservan. */
  conditions?: string;
  /** Justificación matemática. */
  justification?: string;
  /** Estado de verificación del paso. */
  verification?: StepVerification;
  /** Advertencias o limitaciones del paso. */
  warnings?: string[];
}
