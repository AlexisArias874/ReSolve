"use client";

import { sanitizeMathExpression, evaluateUniversalMath } from "@/lib/math/universal-evaluator";
import { useState, useMemo, useEffect } from "react";
import { useAIContext } from "@/lib/context/ai-context";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  Check,
  ArrowRight,
  History,
  Trash2,
  CornerDownLeft,
  BookOpen,
  ListOrdered,
  Sparkles,
  Calculator,
  RotateCcw,
} from "lucide-react";
import {
  fetchUserHistory,
  saveUserCalculation,
  deleteUserHistory,
  type HistoryItem,
} from "@/lib/supabase/history";

// --- Estructura de Datos ---
export interface StepDetail {
  id: number;
  operation: string;
  before: string;
  after: string;
  explanation: string;
}

// --- Motor de Desglose Paso a Paso (PEMDAS) ---
function solveStepByStep(rawExpr: string): {
  steps: StepDetail[];
  finalResult: string;
  error?: string;
} {
  // 1. Sanitizar la expresión (soporta √, sqrt, abs, etc.) y quitar espacios
  let expr = sanitizeMathExpression(rawExpr).replace(/\s+/g, "");
  if (!expr) return { steps: [], finalResult: "--" };

  const steps: StepDetail[] = [];
  let stepId = 1;

  try {
    // A. Resolución de Raíces Cuadradas: sqrt(...) o √(...)
    const sqrtRegex = /sqrt\(([^()]+)\)/;
    while (sqrtRegex.test(expr)) {
      const match = sqrtRegex.exec(expr);
      if (!match) break;
      const inner = match[1];

      // Evaluar el interior de la raíz con el evaluador universal
      const innerVal = evaluateUniversalMath(inner);
      const sqrtVal = Math.sqrt(innerVal);
      const updated = expr.replace(
        match[0],
        Number(sqrtVal.toFixed(4)).toString()
      );

      steps.push({
        id: stepId++,
        operation: "Extracción de Raíz Cuadrada",
        before: expr,
        after: updated,
        explanation: `Calculamos la raíz cuadrada de (${inner}) = ${Number(
          sqrtVal.toFixed(4)
        )}`,
      });
      expr = updated;
    }

    // B. Resolución de Paréntesis (de dentro hacia fuera)
    const parenRegex = /\(([^()]+)\)/;
    while (parenRegex.test(expr)) {
      const match = parenRegex.exec(expr);
      if (!match) break;
      const innerExpr = match[1];

      const subSolved = evaluateSubExpression(
        innerExpr,
        (op, beforeSub, afterSub, exp) => {
          steps.push({
            id: stepId++,
            operation: op,
            before: expr,
            after: expr.replace(`(${innerExpr})`, `(${afterSub})`),
            explanation: exp,
          });
        }
      );

      const updated = expr.replace(match[0], subSolved);
      steps.push({
        id: stepId++,
        operation: "Eliminación de Paréntesis",
        before: expr,
        after: updated,
        explanation: `Se resuelve el bloque agrupado (${innerExpr}) = ${subSolved}`,
      });
      expr = updated;
    }

    // C. Resolver operaciones restantes (multiplicación, división, suma, resta)
    const finalVal = evaluateSubExpression(
      expr,
      (op, beforeSub, afterSub, exp) => {
        steps.push({
          id: stepId++,
          operation: op,
          before: beforeSub,
          after: afterSub,
          explanation: exp,
        });
      }
    );

    const parsedNum = Number(finalVal);
    if (isNaN(parsedNum) || !isFinite(parsedNum)) {
      throw new Error("Operación no válida o división por cero");
    }

    return {
      steps,
      finalResult: String(Number(parsedNum.toFixed(6))),
    };
  } catch (err: unknown) {
    return {
      steps: [],
      finalResult: "--",
      error: err instanceof Error ? err.message : "Error de sintaxis",
    };
  }
}

function evaluateSubExpression(
  sub: string,
  onStep: (op: string, before: string, after: string, exp: string) => void
): string {
  let current = sub;

  // A. Potencias (^)
  const powRegex = /(-?\d+(?:\.\d+)?)\^(\d+(?:\.\d+)?)/;
  while (powRegex.test(current)) {
    const match = powRegex.exec(current);
    if (!match) break;
    const [full, base, exp] = match;
    const val = Math.pow(Number(base), Number(exp));
    const next = current.replace(full, String(val));
    onStep("Potenciación", current, next, `Calcular potencia: ${base}^${exp} = ${val}`);
    current = next;
  }

  // B. Multiplicación y División (*, /)
  const mdRegex = /(-?\d+(?:\.\d+)?)([\*\/])(-?\d+(?:\.\d+)?)/;
  while (mdRegex.test(current)) {
    const match = mdRegex.exec(current);
    if (!match) break;
    const [full, n1, op, n2] = match;
    const num1 = Number(n1);
    const num2 = Number(n2);
    if (op === "/" && num2 === 0) throw new Error("División por cero");
    const val = op === "*" ? num1 * num2 : num1 / num2;
    const next = current.replace(full, String(val));
    const opName = op === "*" ? "Multiplicación" : "División";
    onStep(opName, current, next, `Resolver ${opName.toLowerCase()}: ${n1} ${op} ${n2} = ${val}`);
    current = next;
  }

  // C. Suma y Resta (+, -)
  const asRegex = /(-?\d+(?:\.\d+)?)([+\-])(-?\d+(?:\.\d+)?)/;
  while (asRegex.test(current) && !/^-?\d+(?:\.\d+)?$/.test(current)) {
    const match = asRegex.exec(current);
    if (!match) break;
    const [full, n1, op, n2] = match;
    const num1 = Number(n1);
    const num2 = Number(n2);
    const val = op === "+" ? num1 + num2 : num1 - num2;
    const next = current.replace(full, String(val));
    const opName = op === "+" ? "Suma" : "Resta";
    onStep(opName, current, next, `Resolver ${opName.toLowerCase()}: ${n1} ${op} ${n2} = ${val}`);
    current = next;
  }

  return current;
}

// --- Mapa tipográfico del teclado de operadores (se inserta el símbolo crudo,
//     se muestra el glifo matemático) ---
const ARITHMETIC_KEYS = [
  { insert: "+", glyph: "+", label: "Sumar" },
  { insert: "-", glyph: "−", label: "Restar" },
  { insert: "*", glyph: "×", label: "Multiplicar" },
  { insert: "/", glyph: "÷", label: "Dividir" },
  { insert: "^", glyph: "^", label: "Potencia" },
  { insert: "(", glyph: "(", label: "Abrir paréntesis" },
  { insert: ")", glyph: ")", label: "Cerrar paréntesis" },
  { insert: ".", glyph: ".", label: "Punto decimal" },
] as const;

export default function ArithmeticView({
  viewMode,
  initialExpression = "",
}: {
  viewMode: "calc" | "steps" | "theory";
  initialExpression?: string;
}) {
  const [expression, setExpression] = useState<string>(
    initialExpression || "((3 + 5) * 2) + 12 / 4"
  );
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);
  
  const calculation = useMemo(() => solveStepByStep(expression), [expression]);

  // Sincroniza si el usuario llega con ?expr=... después del primer render
  useEffect(() => {
    if (initialExpression) {
      setExpression(initialExpression);
    }
  }, [initialExpression]);

  // Carga automática desde Supabase o localStorage
  useEffect(() => {
    fetchUserHistory("mat1", "aritmetica").then((data) => setHistory(data));
  }, []);

  const saveCalculation = async (exprToSave: string, result: string) => {
    if (!exprToSave.trim() || result === "--") return;
    await saveUserCalculation("mat1", "aritmetica", exprToSave.trim(), result);
    const refreshed = await fetchUserHistory("mat1", "aritmetica");
    setHistory(refreshed);
  };

  const clearHistory = async () => {
    await deleteUserHistory("aritmetica");
    setHistory([]);
  };

  const { setAIContext, injectedExpression, clearInjectedExpression } = useAIContext();

  // Escuchar inyecciones desde la IA
  useEffect(() => {
    if (injectedExpression) {
      setExpression(injectedExpression);
      clearInjectedExpression();
    }
  }, [injectedExpression, clearInjectedExpression]);

  // Sincronizar en tiempo real el contexto matemático con el Asistente IA
  useEffect(() => {
    setAIContext({
      module: "Matemáticas I",
      subtopic: "Aritmética",
      expression: expression.trim(),
      result: calculation.finalResult,
      details: calculation.steps.length > 0
        ? `${calculation.steps.length} pasos resueltos: ` +
          calculation.steps.map((s) => `${s.operation} (${s.after})`).join(" -> ")
        : undefined,
    });
  }, [expression, calculation, setAIContext]);

  const handleCopy = () => {
    if (calculation.finalResult === "--") return;
    navigator.clipboard.writeText(calculation.finalResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="h-full flex flex-col gap-6 min-h-0">

      {/* =========================================================
          MODO 1: CALCULAR (BENTO PREMIUM · REFERENCIA DE ESTILO)
      ========================================================== */}
      {viewMode === "calc" && (
        <div className="flex-1 flex flex-col gap-6 min-h-0">

          {/* FILA SUPERIOR: CONSOLA + RESULTADO */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 shrink-0">

            {/* Caja Izquierda: Entrada y Teclado */}
            <div className="lg:col-span-8 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col shadow-xl shadow-black/20 overflow-hidden">
              <div className="pointer-events-none absolute -top-20 -left-20 w-56 h-56 bg-zinc-700/10 rounded-full blur-3xl" />

              <div className="relative z-10 flex flex-1 flex-col">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-2">
                    <Calculator size={13} className="text-zinc-500" />
                    Expresión Matemática
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-zinc-500 bg-zinc-950/60 border border-zinc-800/60 px-2.5 py-1 rounded-lg">
                    Jerarquía PEMDAS
                  </span>
                </div>

                <label htmlFor="expresion-matematica" className="sr-only">
                  Expresión matemática
                </label>
                <input
                  id="expresion-matematica"
                  type="text"
                  value={expression}
                  onChange={(e) => setExpression(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void saveCalculation(expression, calculation.finalResult);
                  }}
                  placeholder="Ingresa una expresión, ej: ((3 + 5) * 2) + 12 / 4"
                  className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-2xl px-5 py-4 font-mono text-lg lg:text-2xl text-zinc-100 placeholder:text-zinc-600 placeholder:text-sm lg:placeholder:text-base focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/20 transition-all shadow-inner selection:bg-emerald-500/30"
                />

                {/* Teclado de operadores */}
                <div className="mt-5">
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600 mb-2 block">
                    Insertar Operadores
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {ARITHMETIC_KEYS.map((sym) => (
                      <button
                        key={sym.insert}
                        type="button"
                        onClick={() => setExpression((prev) => prev + sym.insert)}
                        aria-label={sym.label}
                        title={sym.label}
                        className="h-10 min-w-[46px] px-3.5 bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-600 hover:bg-zinc-800/60 text-zinc-200 rounded-xl font-mono text-base font-medium transition-all active:scale-95 flex items-center justify-center"
                      >
                        {sym.glyph}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Acciones */}
                <div className="mt-auto pt-5 border-t border-zinc-800/60 flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setExpression("")}
                    className="h-11 px-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 text-zinc-400 hover:text-red-400 hover:border-red-900/40 text-xs font-medium transition-colors flex items-center gap-2 active:scale-95"
                  >
                    <RotateCcw size={14} /> Limpiar
                  </button>

                  <button
                    type="button"
                    onClick={() => void saveCalculation(expression, calculation.finalResult)}
                    className="h-11 px-6 ml-auto bg-zinc-100 text-zinc-950 rounded-xl text-xs font-semibold hover:bg-zinc-200 hover:scale-[1.02] transition-all flex items-center gap-2 shadow-lg shadow-zinc-100/5 active:scale-95"
                  >
                    <CornerDownLeft size={14} /> Calcular
                    <span className="ml-1 hidden sm:inline-flex items-center rounded-md border border-zinc-950/20 px-1.5 py-0.5 font-mono text-[9px] tracking-wider opacity-70">
                      ENTER
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Caja Derecha: Resultado */}
            <div className="lg:col-span-4 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col shadow-xl shadow-black/20 overflow-hidden">
              <div className="pointer-events-none absolute -bottom-20 -right-20 w-56 h-56 bg-zinc-700/10 rounded-full blur-3xl" />

              <div className="relative z-10 flex flex-1 flex-col">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold">
                    Resultado
                  </span>
                  {calculation.finalResult !== "--" && (
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="text-[11px] font-mono text-zinc-400 hover:text-zinc-100 flex items-center gap-1.5 transition-colors py-1 px-2.5 rounded-lg border border-zinc-800/60 bg-zinc-950/60 hover:bg-zinc-800/60"
                    >
                      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      {copied ? "Copiado" : "Copiar"}
                    </button>
                  )}
                </div>

                {/* Número Destacado */}
                <div className="flex-1 flex flex-col items-center justify-center gap-4 py-6 text-center">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={calculation.finalResult}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      transition={{ duration: 0.2 }}
                      className={`text-5xl lg:text-7xl font-serif font-bold tracking-tight transition-colors ${
                        calculation.finalResult === "--" ? "text-zinc-600" : "text-zinc-100"
                      }`}
                    >
                      {calculation.finalResult}
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="relative z-10 text-[11px] font-mono text-zinc-400 text-center border-t border-zinc-800/60 pt-3.5 flex items-center justify-center gap-2">
                  {calculation.error ? (
                    <span className="text-red-400 font-sans">{calculation.error}</span>
                  ) : (
                    <>
                      <Sparkles size={13} className="text-amber-400" />
                      <span>
                        {calculation.steps.length}{" "}
                        {calculation.steps.length === 1 ? "operación intermedia" : "operaciones intermedias"}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* FILA INFERIOR: DESGLOSE EN VIVO + HISTORIAL */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">

            {/* Panel Izquierdo: Línea de Tiempo de Pasos */}
            <div className="lg:col-span-8 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20 overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <ListOrdered size={15} className="text-zinc-400" /> Desglose Paso a Paso
                </span>
                <span className="text-[10px] font-mono text-zinc-500 bg-zinc-950/60 border border-zinc-800/60 px-2.5 py-1 rounded-full">
                  {calculation.steps.length} pasos
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto pt-5 pr-2">
                {calculation.steps.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-6">
                    <span className="w-11 h-11 rounded-xl bg-zinc-900/50 border border-zinc-800/60 flex items-center justify-center">
                      <Calculator size={20} className="text-zinc-600" />
                    </span>
                    <p className="text-sm text-zinc-300 font-medium">
                      Ingresa una operación para ver el desglose
                    </p>
                    <p className="text-[11px] text-zinc-500 font-mono">
                      Cada operación se resuelve en orden PEMDAS
                    </p>
                  </div>
                ) : (
                  <div>
                    {calculation.steps.map((step, index) => (
                      <div key={step.id} className="relative pl-11 pb-4 last:pb-0">
                        {/* Nodo + raíl de la línea de tiempo */}
                        <span
                          className="absolute left-0 top-0 w-7 h-7 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300 flex items-center justify-center text-xs font-mono font-bold shadow-inner"
                          aria-hidden="true"
                        >
                          {step.id}
                        </span>
                        {index < calculation.steps.length - 1 && (
                          <span
                            className="absolute left-[13px] top-9 bottom-0 w-px bg-zinc-800/70"
                            aria-hidden="true"
                          />
                        )}

                        <div className="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700/80 transition-colors">
                          <p className="text-sm text-zinc-200 font-medium truncate">
                            {step.explanation}
                          </p>
                          <div className="mt-2.5 flex items-center gap-2 font-mono text-xs min-w-0">
                            <span className="text-zinc-500 truncate">{step.before}</span>
                            <ArrowRight size={12} className="text-zinc-600 shrink-0" />
                            <span className="text-zinc-100 font-semibold bg-zinc-900/80 border border-zinc-800/80 px-2.5 py-1 rounded-lg truncate">
                              {step.after}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Panel Derecho: Historial */}
            <div className="lg:col-span-4 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20 overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <History size={15} className="text-zinc-400" /> Historial
                </span>
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void clearHistory()}
                    title="Vaciar historial"
                    className="text-[11px] text-zinc-500 hover:text-red-400 flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 size={13} /> Limpiar
                  </button>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto pt-5 pr-1 space-y-2">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-6">
                    <span className="w-11 h-11 rounded-xl bg-zinc-900/50 border border-zinc-800/60 flex items-center justify-center">
                      <RotateCcw size={18} className="text-zinc-600" />
                    </span>
                    <p className="text-sm text-zinc-300 font-medium">Sin operaciones guardadas</p>
                    <p className="text-[11px] text-zinc-500">
                      Presiona <span className="font-mono">Enter</span> o Calcular para registrar
                    </p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpression(item.expression)}
                      title={`Recargar: ${item.expression}`}
                      className="group p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700 hover:bg-zinc-800/60 cursor-pointer transition-all flex items-center justify-between gap-3 text-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500/40"
                    >
                      <span className="truncate pr-2 font-mono text-[13px] text-zinc-300 group-hover:text-zinc-100 transition-colors">
                        {item.expression}
                      </span>
                      <span className="font-mono font-bold text-emerald-400 shrink-0">
                        = {item.result}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* =========================================================
          MODO 2: PASO A PASO EXPANDIDO (DESDE CABECERA)
      ========================================================== */}
      {viewMode === "steps" && (
        <div className="relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col min-h-0 shadow-xl shadow-black/20 overflow-hidden">
          <div className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 bg-zinc-700/10 rounded-full blur-3xl" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-800/60 shrink-0">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800/80 bg-zinc-900/60 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 mb-2.5">
                <ListOrdered size={12} /> Procedimiento
              </div>
              <h3 className="text-xl lg:text-2xl font-serif font-bold text-zinc-100">
                Procedimiento Detallado de Resolución
              </h3>
              <p className="text-xs text-zinc-400 mt-1.5 font-mono truncate">
                Expresión evaluada:{" "}
                <span className="text-zinc-200 font-semibold">{expression || "--"}</span>
                {calculation.error && (
                  <span className="ml-2 text-red-400">· {calculation.error}</span>
                )}
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 shadow-inner">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Resultado
              </span>
              <span className="text-sm font-serif font-bold text-zinc-100">
                {calculation.finalResult}
              </span>
            </div>
          </div>

          <div className="relative z-10 flex-1 min-h-0 overflow-y-auto pt-6 pr-2">
            {calculation.steps.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-6">
                <span className="w-11 h-11 rounded-xl bg-zinc-900/50 border border-zinc-800/60 flex items-center justify-center">
                  <Calculator size={20} className="text-zinc-600" />
                </span>
                <p className="text-sm text-zinc-300 font-medium">
                  Sin procedimiento disponible
                </p>
                <p className="text-[11px] text-zinc-500">
                  Ingresa una expresión en la pestaña Calcular para consultar el procedimiento
                </p>
              </div>
            ) : (
              <div>
                {calculation.steps.map((step, index) => (
                  <div key={step.id} className="relative pl-13 pb-5 last:pb-0">
                    <span
                      className="absolute left-0 top-0 w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300 flex items-center justify-center text-xs font-mono font-bold shadow-inner"
                      aria-hidden="true"
                    >
                      {step.id}
                    </span>
                    {index < calculation.steps.length - 1 && (
                      <span
                        className="absolute left-[15px] top-10 bottom-0 w-px bg-zinc-800/70"
                        aria-hidden="true"
                      />
                    )}

                    <div className="p-4 lg:p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700/80 transition-colors">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-zinc-100">
                          {step.operation}
                        </span>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 shrink-0">
                          Paso {step.id}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-300 leading-relaxed mt-1.5">
                        {step.explanation}
                      </p>

                      <div className="flex items-center gap-3 pt-3 mt-3 border-t border-zinc-800/60 font-mono text-xs min-w-0">
                        <span className="text-zinc-500 line-through truncate">{step.before}</span>
                        <ArrowRight size={13} className="text-zinc-600 shrink-0" />
                        <span className="text-emerald-400 font-bold bg-zinc-900/60 border border-zinc-800 px-2 py-0.5 rounded-lg truncate">
                          {step.after}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          MODO 3: TEORÍA Y FUNDAMENTOS
      ========================================================== */}
      {viewMode === "theory" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col min-h-0 overflow-y-auto shadow-xl shadow-black/20">
          <div className="pb-5 border-b border-zinc-800/60">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800/80 bg-zinc-900/60 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 mb-3">
              <BookOpen size={12} /> Fundamentos Aritméticos
            </div>
            <h3 className="text-2xl lg:text-3xl font-serif font-bold text-zinc-100">
              Jerarquía de Operaciones (PEMDAS)
            </h3>
            <p className="text-xs text-zinc-400 mt-2.5 leading-relaxed max-w-3xl">
              Establece el orden determinista en el que deben resolverse los operadores matemáticos
              para evitar ambigüedades en compiladores y motores algebraicos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
            {[
              {
                priority: "1",
                title: "Paréntesis ( )",
                rationale:
                  "Poseen la máxima prioridad de cálculo. Se resuelven de los más anidados internamente hacia afuera.",
                example: "((3 + 5) * 2) → 16",
              },
              {
                priority: "2",
                title: "Exponentes y Raíces ( ^ )",
                rationale:
                  "Potencias y radicales se computan antes que cualquier multiplicación o división.",
                example: "2^3 → 8 · √25 → 5",
              },
              {
                priority: "3",
                title: "Multiplicación y División (×, ÷)",
                rationale:
                  "Mismo nivel de precedencia. Se resuelven estrictamente de izquierda a derecha.",
                example: "12 / 4 * 2 → 6",
              },
              {
                priority: "4",
                title: "Suma y Resta (+, −)",
                rationale:
                  "Nivel final de reducción una vez que los términos previos han sido simplificados.",
                example: "12 + 4 − 2 → 14",
              },
            ].map((rule) => (
              <div
                key={rule.priority}
                className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700/80 transition-colors"
              >
                <div className="flex items-start gap-3.5">
                  <span
                    className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center font-mono text-xs font-bold shrink-0 shadow-inner"
                    aria-hidden="true"
                  >
                    {rule.priority}
                  </span>
                  <div className="min-w-0">
                    <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                      {rule.title}
                    </strong>
                    <p className="text-xs text-zinc-400 leading-relaxed">{rule.rationale}</p>
                    <span className="flex items-center gap-1.5 mt-2.5 font-mono text-[10px] text-zinc-500">
                      <ArrowRight size={11} className="text-zinc-600 shrink-0" />
                      {rule.example}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
