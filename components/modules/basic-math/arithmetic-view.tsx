"use client";

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
function solveStepByStep(rawExpr: string): { steps: StepDetail[]; finalResult: string; error?: string } {
  let expr = rawExpr.replace(/\s+/g, "");
  if (!expr) return { steps: [], finalResult: "--" };

  const steps: StepDetail[] = [];
  let stepId = 1;

  try {
    // 1. Resolver Paréntesis
    const parenRegex = /\(([^()]+)\)/;
    while (parenRegex.test(expr)) {
      const match = parenRegex.exec(expr);
      if (!match) break;
      const innerExpr = match[1];

      const subSolved = evaluateSubExpression(innerExpr, (op, beforeSub, afterSub, exp) => {
        steps.push({
          id: stepId++,
          operation: op,
          before: expr,
          after: expr.replace(`(${innerExpr})`, `(${afterSub})`),
          explanation: exp,
        });
      });

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

    // 2. Resolver operaciones restantes
    const finalVal = evaluateSubExpression(expr, (op, beforeSub, afterSub, exp) => {
      steps.push({
        id: stepId++,
        operation: op,
        before: beforeSub,
        after: afterSub,
        explanation: exp,
      });
    });

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
          MODO 1: CALCULAR (BENTO ESTILO LANDING)
      ========================================================== */}
      {viewMode === "calc" && (
        <div className="flex-1 flex flex-col gap-6 min-h-0">
          
          {/* FILA SUPERIOR: CONSOLA Y RESULTADO */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 shrink-0">
            
            {/* Caja Izquierda: Entrada y Teclado */}
            <div className="lg:col-span-8 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden">
              <div className="pointer-events-none absolute -top-16 -left-16 w-48 h-48 bg-zinc-700/10 rounded-full blur-3xl" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-2">
                    <Calculator size={13} className="text-zinc-500" />
                    Expresión Matemática
                  </span>
                  <span className="text-[11px] text-zinc-500 font-mono">Modo Aritmético</span>
                </div>

                {/* Input Grande y Nítido */}
                <div className="relative group">
                  <input
                    type="text"
                    value={expression}
                    onChange={(e) => setExpression(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveCalculation(expression, calculation.finalResult);
                    }}
                    placeholder="Ingresa una expresión, ej: ((3 + 5) * 2) + 12 / 4"
                    className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-2xl px-5 py-4 font-mono text-base lg:text-lg text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/20 transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* Botones de Operadores */}
              <div className="relative z-10 flex flex-wrap items-center gap-2.5 mt-6 pt-5 border-t border-zinc-800/60">
                {["+", "-", "*", "/", "^", "(", ")", "."].map((sym) => (
                  <button
                    key={sym}
                    onClick={() => setExpression((prev) => prev + sym)}
                    className="h-11 min-w-[48px] px-3.5 bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-600 hover:bg-zinc-800/80 text-zinc-200 rounded-xl font-mono text-base font-medium transition-all active:scale-95 shadow-sm backdrop-blur-sm flex items-center justify-center"
                  >
                    {sym}
                  </button>
                ))}

                <button
                  onClick={() => void saveCalculation(expression, calculation.finalResult)}
                  className="h-11 px-5 bg-zinc-100 text-zinc-950 rounded-xl text-xs font-semibold hover:bg-zinc-200 hover:scale-[1.02] transition-all flex items-center gap-2 shadow-lg shadow-zinc-100/5 ml-auto active:scale-95"
                >
                  <CornerDownLeft size={14} /> Calcular
                </button>

                <button
                  onClick={() => setExpression("")}
                  className="h-11 px-4 bg-zinc-900/50 border border-zinc-800/80 text-zinc-400 hover:text-red-400 hover:border-red-900/40 rounded-xl text-xs font-medium transition-colors"
                >
                  Limpiar
                </button>
              </div>
            </div>

            {/* Caja Derecha: Resultado */}
            <div className="lg:col-span-4 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden">
              <div className="pointer-events-none absolute -bottom-16 -right-16 w-48 h-48 bg-zinc-700/10 rounded-full blur-3xl" />

              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold">
                    Resultado
                  </span>
                  {calculation.finalResult !== "--" && (
                    <button
                      onClick={handleCopy}
                      className="text-xs text-zinc-400 hover:text-zinc-100 flex items-center gap-1.5 transition-colors py-1 px-2.5 rounded-lg border border-zinc-800/60 bg-zinc-900/50 hover:bg-zinc-800/60"
                    >
                      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      {copied ? "Copiado" : "Copiar"}
                    </button>
                  )}
                </div>

                {/* Número Destacado con Animación */}
                <div className="py-7 text-center">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={calculation.finalResult}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      transition={{ duration: 0.2 }}
                      className="text-5xl lg:text-6xl font-serif font-bold text-zinc-100 tracking-tight"
                    >
                      {calculation.finalResult}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              <div className="relative z-10 text-[11px] text-zinc-400 font-mono text-center border-t border-zinc-800/60 pt-3.5 flex items-center justify-center gap-2">
                {calculation.error ? (
                  <span className="text-red-400 font-sans">{calculation.error}</span>
                ) : (
                  <>
                    <Sparkles size={13} className="text-amber-400" />
                    <span>{calculation.steps.length} operaciones intermedias</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* FILA INFERIOR: PASO A PASO EN VIVO + HISTORIAL */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
            
            {/* Panel Izquierdo: Desglose de Pasos (8 Cols) */}
            <div className="lg:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <ListOrdered size={15} className="text-zinc-400" /> Desglose Paso a Paso
                </span>
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900/80 border border-zinc-800/80 px-2.5 py-1 rounded-full">
                  Jerarquía PEMDAS
                </span>
              </div>

              {/* Lista Scrollable */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-2 mt-4">
                {calculation.steps.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-xs text-zinc-500 text-center p-6">
                    <Calculator size={24} className="text-zinc-600 mb-2" />
                    Ingresa una operación para ver el desglose secuencial.
                  </div>
                ) : (
                  calculation.steps.map((step) => (
                    <div
                      key={step.id}
                      className="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700/80 transition-all flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span className="w-7 h-7 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center text-xs font-mono font-bold shrink-0 shadow-inner">
                          {step.id}
                        </span>
                        <span className="text-sm text-zinc-200 font-medium truncate">
                          {step.explanation}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 text-zinc-400 shrink-0 font-mono text-sm">
                        <ArrowRight size={13} className="text-zinc-600" />
                        <span className="text-zinc-100 font-semibold bg-zinc-900/80 px-3 py-1 rounded-xl border border-zinc-800/80 shadow-sm">
                          {step.after}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Panel Derecho: Historial de Usuario (4 Cols) */}
            <div className="lg:col-span-4 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <History size={15} className="text-zinc-400" /> Historial
                </span>
                {history.length > 0 && (
                  <button
                    onClick={() => void clearHistory()}
                    className="text-xs text-zinc-500 hover:text-red-400 flex items-center gap-1 transition-colors"
                  >
                    <Trash2 size={13} /> Limpiar
                  </button>
                )}
              </div>

              {/* Lista de Cálculos */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 mt-4 pr-1">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-xs text-zinc-500 p-6">
                    <RotateCcw size={20} className="text-zinc-600 mb-2" />
                    <p>Sin operaciones guardadas.</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Presiona Enter o Calcular para registrar.</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setExpression(item.expression)}
                      className="group p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700 hover:bg-zinc-900/80 cursor-pointer transition-all flex items-center justify-between text-sm"
                    >
                      <div className="truncate pr-2 font-mono text-zinc-300 group-hover:text-zinc-100 transition-colors">
                        {item.expression}
                      </div>
                      <div className="font-mono font-bold text-emerald-400 shrink-0">
                        = {item.result}
                      </div>
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
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-5 shrink-0">
            <div>
              <h3 className="text-xl font-serif font-bold text-zinc-100">
                Procedimiento Detallado de Resolución
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                Expresión evaluada: <span className="text-zinc-200 font-semibold">{expression || "--"}</span>
              </p>
            </div>
            <div className="text-xs font-mono px-4 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-zinc-300 shadow-inner">
              Resultado final: <strong className="text-emerald-400 text-sm font-serif">{calculation.finalResult}</strong>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-2">
            {calculation.steps.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-zinc-500">
                Ingresa una expresión en la pestaña "Calcular" para consultar el procedimiento detallado.
              </div>
            ) : (
              calculation.steps.map((step) => (
                <div
                  key={step.id}
                  className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700/80 transition-all flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-zinc-200 flex items-center gap-3">
                      <span className="w-7 h-7 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center text-xs font-mono font-bold shadow-inner">
                        {step.id}
                      </span>
                      {step.operation}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-300 font-sans leading-relaxed">{step.explanation}</p>

                  <div className="flex items-center gap-3 pt-3 border-t border-zinc-800/60 font-mono text-xs">
                    <span className="text-zinc-500 line-through">{step.before}</span>
                    <ArrowRight size={13} className="text-zinc-600" />
                    <span className="text-emerald-400 font-bold bg-zinc-900/60 border border-zinc-800 px-2 py-0.5 rounded-lg">
                      {step.after}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          MODO 3: TEORÍA Y FUNDAMENTOS
      ========================================================== */}
      {viewMode === "theory" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto shadow-xl shadow-black/20">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800/80 bg-zinc-900/60 text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 mb-3">
              <BookOpen size={12} /> Fundamentos Aritméticos
            </div>
            <h3 className="text-2xl font-serif font-bold text-zinc-100">
              Jerarquía de Operaciones (PEMDAS)
            </h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-3xl">
              Establece el orden determinista en el que deben resolverse los operadores matemáticos para evitar ambigüedades en compiladores y motores algebraicos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                1. Paréntesis ( )
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Poseen la máxima prioridad de cálculo. Se resuelven de los más anidados internamente hacia afuera.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                2. Exponentes y Raíces ( ^ )
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Potencias y radicales se computan antes que cualquier multiplicación o división.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                3. Multiplicación y División (*, /)
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Mismo nivel de precedencia. Se resuelven estrictamente de izquierda a derecha.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                4. Suma y Resta (+, -)
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Nivel final de reducción una vez que los términos previos han sido simplificados.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}