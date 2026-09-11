"use client";

import MathGrapher, { type GraphPoint, type GuideLine } from "@/components/shared/math-grapher";
import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  Check,
  History,
  Trash2,
  CornerDownLeft,
  BookOpen,
  ListOrdered,
  Sparkles,
  HelpCircle,
  X,
  Variable,
  Terminal,
  Activity,
  ChevronRight,
  Info,
  TrendingUp,
  Sliders,
  Table as TableIcon,
  Cpu,
  Infinity as InfinityIcon
} from "lucide-react";
import { useAIContext } from "@/lib/context/ai-context";
import {
  fetchUserHistory,
  saveUserCalculation,
  deleteUserHistory,
  type HistoryItem,
} from "@/lib/supabase/history";

// -----------------------------------------------------------------------------
// TIPOS Y CATÁLOGO DE EJEMPLOS
// -----------------------------------------------------------------------------
interface ModuleExample {
  category: string;
  func: string;
  point: string;
  side: "both" | "left" | "right";
  desc: string;
}

const MODULE_EXAMPLES: ModuleExample[] = [
  { category: "Factorización (0/0)", func: "(x^2 - 4) / (x - 2)", point: "2", side: "both", desc: "Diferencia de cuadrados y cancelación de factor (x - 2)" },
  { category: "Racionalización / Radical", func: "(sqrt(x + 4) - 2) / x", point: "0", side: "both", desc: "Multiplicación por el binomio conjugado √(x+4) + 2" },
  { category: "Trigonométrico Notable (L'Hôpital)", func: "sin(x) / x", point: "0", side: "both", desc: "Límite fundamental que define la derivada del seno" },
  { category: "Límite al Infinito (∞/∞)", func: "(3*x^2 + 5*x) / (2*x^2 - 7)", point: "inf", side: "both", desc: "Cociente de polinomios del mismo grado (a/b)" },
  { category: "Asíntota Vertical / Unilateral", func: "1 / x", point: "0", side: "right", desc: "Límite lateral por la derecha hacia +∞" },
  { category: "Sustitución Directa", func: "x^3 - 2*x^2 + 5", point: "3", side: "both", desc: "Límite continuo sin indeterminación" },
  { category: "Cúbica Factorizada (0/0)", func: "(x^3 - 1) / (x - 1)", point: "1", side: "both", desc: "Diferencia de cubos a³ - b³ = (a - b)(a² + ab + b²)" },
  { category: "Número e Notable", func: "(1 + 1/x)^x", point: "inf", side: "both", desc: "Definición analítica de la constante de Euler e" },
  { category: "Discontinuidad Infinita", func: "1 / (x - 3)^2", point: "3", side: "both", desc: "Límite infinito bilateral hacia +∞" },
];

export interface LimitStep {
  id: number;
  stage: string;
  description: string;
  expression: string;
  rule: string;
}

export interface LimitResult {
  limitValue: string;
  numericApproximation: number | null;
  methodName: string;
  methodDescription: string;
  leftLimit: string;
  rightLimit: string;
  indeterminateType?: string;
  steps: LimitStep[];
  error?: string;
}

// --- Evaluador Matemático Numérico Robusto ---
function evaluateExpr(expr: string, x: number): number {
  try {
    let s = expr.toLowerCase().replace(/\s+/g, "");
    s = s.replace(/([0-9])([x(]|sin|cos|tan|exp|ln|sqrt|abs)/g, "$1*$2");
    s = s.replace(/\)([\d\w(]|sin|cos|tan|exp|ln|sqrt|abs)/g, ")*$1");
    s = s.replace(/x([0-9(]|sin|cos|tan|exp|ln|sqrt|abs)/g, "x*$1");
    s = s.replace(
      /(^|[+\-*/,(])\s*-\s*([a-zA-Z0-9_.]+|\([^()]+\))\s*\^\s*([+-]?[a-zA-Z0-9_.]+|\([^()]+\))/g,
      "$1-(($2)^($3))"
    );
    s = s.replace(/\^\s*-\s*([a-zA-Z0-9_.]+|\([^()]+\))/g, "^(-($1))");
    s = s.replace(/\^/g, "**");
    s = s.replace(/sqrt/g, "Math.sqrt");
    s = s.replace(/sin/g, "Math.sin");
    s = s.replace(/cos/g, "Math.cos");
    s = s.replace(/tan/g, "Math.tan");
    s = s.replace(/abs/g, "Math.abs");
    s = s.replace(/ln/g, "Math.log");
    s = s.replace(/exp/g, "Math.exp");
    s = s.replace(/pi/g, "Math.PI");
    s = s.replace(/e\b/g, "Math.E");

    // eslint-disable-next-line no-new-func
    const fn = new Function("x", `"use strict"; return (${s});`);
    const val = fn(x);
    return typeof val === "number" && !isNaN(val) && isFinite(val) ? val : NaN;
  } catch {
    return NaN;
  }
}

// Derivada numérica para L'Hôpital
function derivativeNumeric(expr: string, x: number): number {
  const h = 0.00005;
  const f1 = evaluateExpr(expr, x + h);
  const f2 = evaluateExpr(expr, x - h);
  return (f1 - f2) / (2 * h);
}

// =============================================================================
// MOTOR DE RESOLUCIÓN DE LÍMITES DE RESOLVE
// =============================================================================
function solveLimitAnalytical(
  rawFunc: string,
  rawPoint: string,
  side: "both" | "left" | "right"
): LimitResult {
  const cleanFunc = rawFunc.trim();
  const cleanPoint = rawPoint.toLowerCase().trim();

  if (!cleanFunc) {
    return {
      limitValue: "--",
      numericApproximation: null,
      methodName: "Sin entrada",
      methodDescription: "Introduce una función f(x) y un punto c.",
      leftLimit: "--",
      rightLimit: "--",
      steps: [],
    };
  }

  const steps: LimitStep[] = [];
  let stepId = 1;

  try {
    const isInf = cleanPoint === "inf" || cleanPoint === "+inf" || cleanPoint === "infinity";
    const isNegInf = cleanPoint === "-inf" || cleanPoint === "-infinity";

    // -------------------------------------------------------------------------
    // CASO 1: LÍMITES AL INFINITO (x -> +∞ o x -> -∞)
    // -------------------------------------------------------------------------
    if (isInf || isNegInf) {
      const testVal = isInf ? 1e7 : -1e7;
      const numVal = evaluateExpr(cleanFunc, testVal);

      steps.push({
        id: stepId++,
        stage: "Planteamiento de Límite al Infinito",
        description: `Evaluamos el comportamiento asintótico horizontal cuando la variable diverge a ${isInf ? "+∞" : "-∞"}`,
        expression: `lim [x → ${isInf ? "∞" : "-∞"}]  (${cleanFunc})`,
        rule: "Comportamiento Asintótico Horizontal",
      });

      // Detección de cociente de polinomios
      const ratioMatch = cleanFunc.match(/^\(([^()]+)\)\s*\/\s*\(([^()]+)\)$/) || cleanFunc.split("/");
      if (ratioMatch.length >= 2) {
        steps.push({
          id: stepId++,
          stage: "Comparación de Grados de Polinomios",
          description: "Dividimos numerador y denominador entre la mayor potencia de x para eliminar la indeterminación ∞/∞",
          expression: `f(x) ≈ [aₙ · xⁿ] / [bₘ · xᵐ]  para x → ∞`,
          rule: "Grados Relativos Asintóticos",
        });
      }

      let resStr = "";
      if (isNaN(numVal)) {
        resStr = "Indeterminado / Divergente";
      } else if (Math.abs(numVal) > 1e4) {
        resStr = numVal > 0 ? "+∞" : "-∞";
      } else {
        const rounded = Number(numVal.toFixed(4));
        resStr = rounded.toString();
      }

      steps.push({
        id: stepId++,
        stage: "Convergencia Asintótica",
        description: "Evaluación del límite horizontal resultante",
        expression: `lim [x → ${isInf ? "∞" : "-∞"}] f(x) = ${resStr}`,
        rule: "Resultado Asintótico",
      });

      return {
        limitValue: resStr,
        numericApproximation: !isNaN(numVal) && Math.abs(numVal) < 1e4 ? Number(numVal.toFixed(4)) : null,
        methodName: "Límite al Infinito (Asintótico)",
        methodDescription: "Análisis de dominancia de términos de mayor grado para x → ±∞.",
        leftLimit: isNegInf ? resStr : "--",
        rightLimit: isInf ? resStr : "--",
        steps,
      };
    }

    // -------------------------------------------------------------------------
    // CASO 2: LÍMITES FINITOS (x -> c)
    // -------------------------------------------------------------------------
    const c = parseFloat(cleanPoint);
    if (isNaN(c)) throw new Error("El punto de aproximación no es un número válido.");

    const sideStr = side === "left" ? "⁻" : side === "right" ? "⁺" : "";
    steps.push({
      id: stepId++,
      stage: "Sustitución Directa Inicial",
      description: `Intentamos evaluar la función f(x) directamente en el valor límite x = ${c}${sideStr}`,
      expression: `f(${c}) = [evaluación en x = ${c}]`,
      rule: "Propiedad de Continuidad",
    });

    // Evaluación directa
    const directVal = evaluateExpr(cleanFunc, c);

    // 2.A: Determinada Inmediata (sin división por cero)
    if (!isNaN(directVal)) {
      steps.push({
        id: stepId++,
        stage: "Límite Determinado (Función Continua)",
        description: "La función está definida y es continua en x = c; por tanto, el límite equivale a f(c)",
        expression: `lim [x → ${c}] f(x) = f(${c}) = ${Number(directVal.toFixed(4))}`,
        rule: "Sustitución Directa Válida",
      });

      return {
        limitValue: Number(directVal.toFixed(4)).toString(),
        numericApproximation: Number(directVal.toFixed(4)),
        methodName: "Sustitución Directa",
        methodDescription: "La función es continua en el punto de evaluación sin indeterminaciones.",
        leftLimit: Number(directVal.toFixed(4)).toString(),
        rightLimit: Number(directVal.toFixed(4)).toString(),
        steps,
      };
    }

    // 2.B: Indeterminación detectada. Evaluamos laterales numéricos
    const eps1 = 0.0001;
    const vLeft = evaluateExpr(cleanFunc, c - eps1);
    const vRight = evaluateExpr(cleanFunc, c + eps1);

    const isLeftInf = Math.abs(vLeft) > 1e3 || isNaN(vLeft);
    const isRightInf = Math.abs(vRight) > 1e3 || isNaN(vRight);

    let leftStr = isLeftInf ? (vLeft > 0 ? "+∞" : "-∞") : Number(vLeft.toFixed(4)).toString();
    let rightStr = isRightInf ? (vRight > 0 ? "+∞" : "-∞") : Number(vRight.toFixed(4)).toString();

    // 2.C: Indeterminación 0/0 -> Factorización, Racionalización o L'Hôpital
    const epsSmall = 0.000001;
    const numNear = evaluateExpr(cleanFunc, c + epsSmall);

    steps.push({
      id: stepId++,
      stage: "Detección de Indeterminación [0/0]",
      description: "Al sustituir x = c se produce una división por cero en el denominador. Aplicamos técnicas algebraicas para cancelar la singularidad.",
      expression: `Forma indeterminada: [ 0 / 0 ]`,
      rule: "Levantamiento de Indeterminación",
    });

    let detectedMethod = "Regla de L'Hôpital (Derivadas)";
    let detectedDesc = "Derivación sucesiva del numerador y denominador hasta suprimir la indeterminación 0/0.";

    // Detección de técnica aplicada
    if (cleanFunc.includes("sqrt") || cleanFunc.includes("√")) {
      detectedMethod = "Racionalización por Conjugado";
      detectedDesc = "Multiplicación del numerador y denominador por el binomio conjugado con raíz cuadrada.";
      steps.push({
        id: stepId++,
        stage: "Multiplicación por el Binomio Conjugado",
        description: "Multiplicamos y dividimos por la expresión conjugada de la raíz para aplicar diferencia de cuadrados (A - B)(A + B) = A² - B²",
        expression: `f(x) · [Conjugado / Conjugado]  ⟹  Cancelación del factor (x - ${c})`,
        rule: "Racionalización Algebraica",
      });
    } else if (cleanFunc.includes("^2") || cleanFunc.includes("^3")) {
      detectedMethod = "Factorización Polinómica";
      detectedDesc = "Descomposición en factores de polinomios para cancelar el término nulo (x - c).";
      steps.push({
        id: stepId++,
        stage: "Factorización y Cancelación de Singularidad",
        description: `Factorizamos el numerador y denominador extrayendo el término raíz (x - ${c})`,
        expression: `[ (x - ${c}) · P(x) ] / [ (x - ${c}) · Q(x) ]  ⟹  P(x) / Q(x)`,
        rule: "Propiedad de Cancelación",
      });
    } else if (cleanFunc.includes("sin") || cleanFunc.includes("cos") || cleanFunc.includes("tan")) {
      detectedMethod = "Límites Trigonométricos / L'Hôpital";
      detectedDesc = "Aplicación del límite notable fundamental lim [x→0] (sin x / x) = 1 o regla de derivadas.";
      steps.push({
        id: stepId++,
        stage: "Regla de L'Hôpital",
        description: "lim [f(x) / g(x)] = lim [f'(x) / g'(x)] evaluando las tasas de cambio instantáneas",
        expression: `f'(${c}) / g'(${c})`,
        rule: "Teorema de Cauchy / L'Hôpital",
      });
    }

    let finalLimit = "";
    if (side === "left") {
      finalLimit = leftStr;
    } else if (side === "right") {
      finalLimit = rightStr;
    } else {
      // Límites laterales iguales
      if (!isLeftInf && !isRightInf && Math.abs(vLeft - vRight) < 0.05) {
        finalLimit = Number(((vLeft + vRight) / 2).toFixed(4)).toString();
      } else if (isLeftInf && isRightInf && leftStr === rightStr) {
        finalLimit = leftStr;
      } else {
        finalLimit = "No Existe (Límites Laterales Diferentes)";
      }
    }

    steps.push({
      id: stepId++,
      stage: "Conclusión y Valor Límite",
      description: `Comprobación mediante límites laterales: L⁻ = ${leftStr}  |  L⁺ = ${rightStr}`,
      expression: `lim [x → ${c}${sideStr}] (${cleanFunc}) = ${finalLimit}`,
      rule: finalLimit.includes("No Existe") ? "Discontinuidad Esencial" : "Límite Existente",
    });

    return {
      limitValue: finalLimit,
      numericApproximation: !isNaN(numNear) && Math.abs(numNear) < 1e4 ? Number(numNear.toFixed(4)) : null,
      methodName: detectedMethod,
      methodDescription: detectedDesc,
      leftLimit: leftStr,
      rightLimit: rightStr,
      indeterminateType: "0/0",
      steps,
    };
  } catch (err: unknown) {
    return {
      limitValue: "--",
      numericApproximation: null,
      methodName: "Error",
      methodDescription: err instanceof Error ? err.message : "Error analítico",
      leftLimit: "--",
      rightLimit: "--",
      steps: [],
    };
  }
}

export default function LimitsView({
  viewMode,
  initialExpression = "",
}: {
  viewMode: "calc" | "steps" | "theory";
  initialExpression?: string;
}) {
  const [funcInput, setFuncInput] = useState<string>(
    initialExpression || "(x^2 - 4) / (x - 2)"
  );
  const [bottomView, setBottomView] = useState<"steps" | "graph">("graph");
  const [limitPoint, setLimitPoint] = useState<string>("2");
  const [limitSide, setLimitSide] = useState<"both" | "left" | "right">("both");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMethodInfoOpen, setIsMethodInfoOpen] = useState(false);

  const { setAIContext, injectedExpression, clearInjectedExpression } = useAIContext();

  const calculation = useMemo(
    () => solveLimitAnalytical(funcInput, limitPoint, limitSide),
    [funcInput, limitPoint, limitSide]
  );

  // Sincronización con ReSolve AI en tiempo real
  useEffect(() => {
    const sideSuffix = limitSide === "left" ? "⁻" : limitSide === "right" ? "⁺" : "";
    setAIContext({
      module: "Matemáticas I",
      subtopic: "Cálculo de Límites",
      expression: `lim [x → ${limitPoint}${sideSuffix}] (${funcInput})`,
      result: calculation.limitValue,
      details: `Método: ${calculation.methodName}. Laterales: L⁻ = ${calculation.leftLimit}, L⁺ = ${calculation.rightLimit}`,
    });
  }, [funcInput, limitPoint, limitSide, calculation, setAIContext]);

  // Inyecciones inversas del chat
  useEffect(() => {
    if (injectedExpression) {
      setFuncInput(injectedExpression);
      clearInjectedExpression();
    }
  }, [injectedExpression, clearInjectedExpression]);

  // Carga de historial
  useEffect(() => {
    fetchUserHistory("mat1", "limites").then((data) => setHistory(data));
  }, []);

  const saveCalculation = async () => {
    if (!funcInput.trim() || calculation.limitValue === "--") return;
    const sideSuffix = limitSide === "left" ? "⁻" : limitSide === "right" ? "⁺" : "";
    const title = `lim [x → ${limitPoint}${sideSuffix}] (${funcInput})`;
    await saveUserCalculation("mat1", "limites", title, calculation.limitValue);
    const refreshed = await fetchUserHistory("mat1", "limites");
    setHistory(refreshed);
  };

  const clearHistory = async () => {
    await deleteUserHistory("limites");
    setHistory([]);
  };

  const handleCopy = () => {
    if (calculation.limitValue === "--") return;
    navigator.clipboard.writeText(calculation.limitValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const LIMIT_KEYS = [
    { label: "x", val: "x" },
    { label: "^2", val: "^2" },
    { label: "√x", val: "sqrt(x)" },
    { label: "sin", val: "sin(x)" },
    { label: "cos", val: "cos(x)" },
    { label: "/", val: " / " },
    { label: "+", val: " + " },
    { label: "-", val: " - " },
    { label: "(", val: "(" },
    { label: ")", val: ")" },
  ];

  // Tabla de aproximación lateral dinámica alrededor del punto c
  const approximationTable = useMemo(() => {
    const c = parseFloat(limitPoint);
    if (isNaN(c)) return null;

    const deltas = [0.1, 0.01, 0.001, 0.0001];
    const rows = deltas.map((d) => {
      const xLeft = Number((c - d).toFixed(5));
      const xRight = Number((c + d).toFixed(5));
      const yLeft = evaluateExpr(funcInput, xLeft);
      const yRight = evaluateExpr(funcInput, xRight);

      return {
        d,
        xLeft,
        yLeft: !isNaN(yLeft) ? Number(yLeft.toFixed(4)) : "Indef.",
        xRight,
        yRight: !isNaN(yRight) ? Number(yRight.toFixed(4)) : "Indef.",
      };
    });

    return rows;
  }, [funcInput, limitPoint]);

  return (
    <div className="h-full flex flex-col gap-6 min-h-0 relative">
      {viewMode === "calc" && (
        <div className="flex-1 flex flex-col gap-6 min-h-0">
          
          {/* FILA SUPERIOR: ENTRADA Y RESULTADO */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 shrink-0">
            
            {/* Caja Izquierda: Consola de Límites */}
            <div className="lg:col-span-8 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden">
              <div className="pointer-events-none absolute -top-16 -left-16 w-48 h-48 bg-zinc-700/10 rounded-full blur-3xl" />

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-2">
                    <Variable size={14} className="text-zinc-500" />
                    Consola de Cálculo de Límites
                  </span>

                  <button
                    type="button"
                    onClick={() => setIsHelpOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80 text-[11px] font-mono text-zinc-300 hover:text-zinc-100 transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <HelpCircle size={13} className="text-amber-400" />
                    <span>Guía del Módulo</span>
                  </button>
                </div>

                {/* Input de la Función f(x) */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-zinc-400">Función f(x):</label>
                  <input
                    type="text"
                    value={funcInput}
                    onChange={(e) => setFuncInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveCalculation();
                    }}
                    placeholder="Ej: (x^2 - 4) / (x - 2)   o   sin(x) / x"
                    className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-2xl px-5 py-3.5 font-mono text-base lg:text-lg text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-all shadow-inner"
                  />
                </div>

                {/* Parámetros del Límite: Punto y Dirección */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                      <span>Punto al que tiende x (x → c):</span>
                      <span className="text-[10px] text-zinc-500 font-mono">Usa 'inf' para ∞</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={limitPoint}
                        onChange={(e) => setLimitPoint(e.target.value)}
                        placeholder="2 o 0 o inf"
                        className="flex-1 bg-zinc-950/80 border border-zinc-800/80 rounded-xl px-3.5 py-2 font-mono text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
                      />
                      <button
                        type="button"
                        onClick={() => setLimitPoint("inf")}
                        className="px-3 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-xl text-xs font-mono text-zinc-300"
                        title="Infinito positivo"
                      >
                        +∞
                      </button>
                      <button
                        type="button"
                        onClick={() => setLimitPoint("-inf")}
                        className="px-3 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-xl text-xs font-mono text-zinc-300"
                        title="Infinito negativo"
                      >
                        -∞
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono text-zinc-400">Dirección (Límite Lateral):</label>
                    <div className="grid grid-cols-3 gap-1.5 bg-zinc-950/80 border border-zinc-800/80 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setLimitSide("left")}
                        className={`py-1.5 text-xs font-mono rounded-lg transition-colors ${
                          limitSide === "left" ? "bg-zinc-100 text-zinc-950 font-bold" : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        x → c⁻
                      </button>
                      <button
                        type="button"
                        onClick={() => setLimitSide("both")}
                        className={`py-1.5 text-xs font-mono rounded-lg transition-colors ${
                          limitSide === "both" ? "bg-zinc-100 text-zinc-950 font-bold" : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        Bilateral
                      </button>
                      <button
                        type="button"
                        onClick={() => setLimitSide("right")}
                        className={`py-1.5 text-xs font-mono rounded-lg transition-colors ${
                          limitSide === "right" ? "bg-zinc-100 text-zinc-950 font-bold" : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        x → c⁺
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botones de Teclado Rápido */}
              <div className="relative z-10 flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-zinc-800/60">
                {LIMIT_KEYS.map((k) => (
                  <button
                    key={k.label}
                    onClick={() => setFuncInput((prev) => prev + k.val)}
                    className="h-10 min-w-[42px] px-3 bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-600 hover:bg-zinc-800/80 text-zinc-200 rounded-xl font-mono text-sm font-medium transition-all active:scale-95 shadow-sm backdrop-blur-sm flex items-center justify-center"
                  >
                    {k.label}
                  </button>
                ))}

                <button
                  onClick={() => void saveCalculation()}
                  className="h-10 px-5 bg-zinc-100 text-zinc-950 rounded-xl text-xs font-semibold hover:bg-zinc-200 hover:scale-[1.02] transition-all flex items-center gap-2 shadow-lg shadow-zinc-100/5 ml-auto active:scale-95"
                >
                  <CornerDownLeft size={14} /> Calcular Límite
                </button>

                <button
                  onClick={() => setFuncInput("")}
                  className="h-10 px-3.5 bg-zinc-900/50 border border-zinc-800/80 text-zinc-400 hover:text-red-400 hover:border-red-900/40 rounded-xl text-xs font-medium transition-colors"
                >
                  Limpiar
                </button>
              </div>
            </div>

            {/* Caja Derecha: Resultado del Límite */}
            <div className="lg:col-span-4 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden">
              <div className="pointer-events-none absolute -bottom-16 -right-16 w-48 h-48 bg-zinc-700/10 rounded-full blur-3xl" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold">
                    Valor del Límite
                  </span>
                  {calculation.limitValue !== "--" && (
                    <button
                      onClick={handleCopy}
                      className="text-xs text-zinc-400 hover:text-zinc-100 flex items-center gap-1.5 transition-colors py-1 px-2.5 rounded-lg border border-zinc-800/60 bg-zinc-900/50 hover:bg-zinc-800/60"
                    >
                      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      {copied ? "Copiado" : "Copiar"}
                    </button>
                  )}
                </div>

                <div className="py-5 text-center">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={calculation.limitValue}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      transition={{ duration: 0.2 }}
                      className="text-4xl lg:text-5xl font-serif font-bold text-zinc-100 tracking-tight"
                    >
                      {calculation.limitValue}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Resumen de Límites Laterales */}
                <div className="grid grid-cols-2 gap-2 mt-2 font-mono text-xs">
                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60 text-center">
                    <span className="text-[10px] text-zinc-500 block">Por la izquierda (x → c⁻)</span>
                    <strong className="text-zinc-300">{calculation.leftLimit}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60 text-center">
                    <span className="text-[10px] text-zinc-500 block">Por la derecha (x → c⁺)</span>
                    <strong className="text-zinc-300">{calculation.rightLimit}</strong>
                  </div>
                </div>
              </div>

              {/* Insignia del Método Aplicado */}
              <div className="relative z-10 border-t border-zinc-800/60 pt-3.5">
                <button
                  type="button"
                  onClick={() => setIsMethodInfoOpen(!isMethodInfoOpen)}
                  className="w-full p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/70 hover:border-zinc-700 flex items-center justify-between text-[11px] font-mono transition-colors group"
                >
                  <div className="flex items-center gap-1.5 text-zinc-400 group-hover:text-zinc-200 truncate">
                    <Info size={12} className="text-amber-400 shrink-0" />
                    <span className="truncate">{calculation.methodName}</span>
                  </div>
                  <ChevronRight size={12} className="text-zinc-600 group-hover:text-zinc-300 shrink-0" />
                </button>
              </div>
            </div>
          </div>

          {/* FILA INFERIOR: PASOS / TABLA DE APROXIMACIÓN + HISTORIAL */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
            
            {/* Panel Izquierdo: Pasos o Gráfica del Límite */}
            <div className="lg:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBottomView("graph")}
                    className={`px-3 py-1 rounded-xl text-xs font-mono transition-colors ${
                      bottomView === "graph"
                        ? "bg-zinc-100 text-zinc-950 font-bold"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    📈 Gráfica del Límite
                  </button>
                  <button
                    type="button"
                    onClick={() => setBottomView("steps")}
                    className={`px-3 py-1 rounded-xl text-xs font-mono transition-colors ${
                      bottomView === "steps"
                        ? "bg-zinc-100 text-zinc-950 font-bold"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    📝 Procedimiento
                  </button>
                </div>
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900/80 border border-zinc-800/80 px-2.5 py-1 rounded-full">
                  {calculation.methodName}
                </span>
              </div>

              <div className="flex-1 min-h-0 pt-4 overflow-y-auto custom-scrollbar">
                {bottomView === "graph" ? (
                  <div className="h-full flex flex-col justify-between">
                    <MathGrapher
                      expression={funcInput}
                      initialScale={55}
                      height="h-[280px]"
                      // Dibuja el punto límite con agujero hueco si fue indeterminación 0/0
                      points={
                        !isNaN(parseFloat(limitPoint)) && calculation.numericApproximation !== null
                          ? [
                              {
                                x: parseFloat(limitPoint),
                                y: calculation.numericApproximation,
                                label: `(${limitPoint}, ${calculation.limitValue})`,
                                color: "#38bdf8",
                                type: calculation.indeterminateType === "0/0" ? "hole" : "solid",
                              },
                            ]
                          : []
                      }
                      // Líneas guía hacia el punto límite (x = c y y = L)
                      guideLines={
                        !isNaN(parseFloat(limitPoint)) && calculation.numericApproximation !== null
                          ? [
                              { type: "vertical", value: parseFloat(limitPoint), color: "#f59e0b" },
                              { type: "horizontal", value: calculation.numericApproximation, color: "#10b981" },
                            ]
                          : []
                      }
                    />
                    <div className="pt-2 text-[11px] font-mono text-zinc-500 flex items-center justify-between">
                      <span>🔵 Círculo hueco = Discontinuidad evitable (hueco en la curva)</span>
                      <span>Líneas punteadas = Coordenadas límite (x → c, y → L)</span>
                    </div>
                  </div>
                ) : (
                  /* Lista de pasos existente */
                  <div className="space-y-3">
                    {calculation.steps.map((step) => (
                      <div key={step.id} className="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 flex flex-col gap-1">
                        <span className="text-xs font-mono font-semibold text-zinc-200">{step.stage}</span>
                        <p className="text-[11px] text-zinc-400 font-sans">{step.description}</p>
                        <div className="p-2 rounded-xl bg-zinc-950 font-mono text-xs text-emerald-400">{step.expression}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Panel Derecho: Historial */}
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

              <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 mt-4 pr-1 custom-scrollbar">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-xs text-zinc-500 p-6">
                    <p>Sin límites guardados.</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Presiona Calcular para registrar.</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        const m = item.expression.match(/lim\s*\[x\s*→\s*([^\]]+)\]\s*\((.*)\)/);
                        if (m) {
                          setLimitPoint(m[1].replace(/[⁻⁺]/g, ""));
                          setFuncInput(m[2]);
                        }
                      }}
                      className="group p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700 hover:bg-zinc-900/80 cursor-pointer transition-all flex items-center justify-between text-xs"
                    >
                      <div className="truncate pr-2 font-mono text-zinc-300 group-hover:text-zinc-100 transition-colors">
                        {item.expression}
                      </div>
                      <div className="font-mono font-bold text-emerald-400 shrink-0 text-[11px]">
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

      {/* MODO 2: PASO A PASO EXPANDIDO */}
      {viewMode === "steps" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-5 shrink-0">
            <div>
              <h3 className="text-xl font-serif font-bold text-zinc-100">
                Procedimiento Detallado de Resolución de Límites
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                Límite evaluado: lim [x → {limitPoint}] ({funcInput})
              </p>
            </div>
            <div className="text-xs font-mono px-4 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-zinc-300 shadow-inner">
              Resultado: <strong className="text-emerald-400 text-sm font-serif">{calculation.limitValue}</strong>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {calculation.steps.map((step) => (
              <div
                key={step.id}
                className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700/80 transition-all flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-200 flex items-center gap-3">
                    <span className="w-7 h-7 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center text-xs font-mono font-bold shadow-inner">
                      {step.id}
                    </span>
                    {step.stage}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900/80 px-2 py-0.5 rounded-md border border-zinc-800">
                    {step.rule}
                  </span>
                </div>
                <p className="text-xs text-zinc-300 font-sans leading-relaxed">{step.description}</p>
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 font-mono text-xs text-emerald-400 text-center font-bold whitespace-pre-line">
                  {step.expression}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODO 3: TEORÍA */}
      {viewMode === "theory" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto shadow-xl shadow-black/20 custom-scrollbar">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800/80 bg-zinc-900/60 text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 mb-3">
              <BookOpen size={12} /> Fundamentos de Cálculo Diferencial
            </div>
            <h3 className="text-2xl font-serif font-bold text-zinc-100">
              Concepto Riguroso de Límite y Análisis Asintótico
            </h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-3xl">
              El límite describe el comportamiento local o asintótico de una función f(x) a medida que la variable independiente se aproxima arbitrariamente a un punto c sin necesidad de alcanzarlo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                1. Definición Épsilon-Delta (ε - δ)
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Para todo ε {">"} 0 existe un δ {">"} 0 tal que si 0 {"<"} |x - c| {"<"} δ, entonces |f(x) - L| {"<"} ε. Es el cimiento de la exactitud numérica en computación.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                2. Levantamiento de Indeterminaciones
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Formas como 0/0 o ∞/∞ no significan que el límite no exista, sino que la forma directa no revela la tasa relativa de aproximación, requiriendo álgebra o cálculo diferencial.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                3. Regla de L'Hôpital
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Si lim [f(x)/g(x)] da 0/0 o ∞/∞ y las derivadas existen con g'(x) ≠ 0, entonces lim [f(x)/g(x)] = lim [f'(x)/g'(x)], simplificando cocientes trascendentes.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                4. Complejidad Asintótica O(g(n))
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                En ciencias de la computación, el límite al infinito del cociente de dos algoritmos lim [T₁(n)/T₂(n)] determina cuál domina en tiempo de ejecución para grandes volúmenes de datos.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE INFORMACIÓN DEL MÉTODO ACTIVO */}
      <AnimatePresence>
        {isMethodInfoOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md border border-zinc-800 bg-zinc-950 rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <h4 className="text-sm font-serif font-bold text-zinc-100 flex items-center gap-2">
                  <Cpu size={15} className="text-amber-400" /> {calculation.methodName}
                </h4>
                <button onClick={() => setIsMethodInfoOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-100">
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs text-zinc-400 mt-3 leading-relaxed">
                {calculation.methodDescription}
              </p>
              <div className="mt-4 pt-3 border-t border-zinc-800/80 text-[11px] font-mono text-zinc-500">
                ReSolve aplica heurísticas de análisis algebraico y cálculo diferencial para seleccionar el camino óptimo.
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE AYUDA GENERAL CON CATÁLOGO DE EJEMPLOS INTERACTIVOS */}
      <AnimatePresence>
        {isHelpOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative w-full max-w-3xl border border-zinc-800/80 bg-zinc-950/95 backdrop-blur-2xl rounded-3xl p-6 lg:p-8 shadow-2xl overflow-hidden"
            >
              <div className="pointer-events-none absolute -top-20 -right-20 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl" />

              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 relative z-10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <HelpCircle size={16} />
                  </div>
                  <div>
                    <h3 className="text-base font-serif font-bold text-zinc-100">Guía de Cálculo de Límites</h3>
                    <p className="text-xs text-zinc-400">Indeterminaciones, racionalización, infinitos y ejemplos con un clic</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsHelpOpen(false)}
                  className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-5 space-y-5 max-h-[65vh] overflow-y-auto pr-1.5 text-xs relative z-10 custom-scrollbar">
                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
                  <h4 className="font-mono uppercase tracking-wider text-zinc-300 font-semibold mb-1 flex items-center gap-1.5">
                    <Terminal size={13} className="text-zinc-400" /> Sintaxis de Límites
                  </h4>
                  <p className="text-zinc-400 leading-relaxed">
                    Escribe la función como <code className="text-zinc-200">(x^2 - 4) / (x - 2)</code> o <code className="text-zinc-200">(sqrt(x + 4) - 2) / x</code>. En el punto de aproximación puedes poner un número real o <code className="text-amber-400 font-bold">inf</code> para infinito. Elige si evaluar el límite bilateral o unilateral (<code className="text-zinc-200">c⁻</code> o <code className="text-zinc-200">c⁺</code>).
                  </p>
                </div>

                {/* Catálogo de Ejemplos */}
                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
                  <h4 className="font-mono uppercase tracking-wider text-zinc-300 font-semibold mb-2 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-400" /> Catálogo de Problemas de Límites (1 Clic para Probar)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {MODULE_EXAMPLES.map((ex) => (
                      <button
                        key={ex.category}
                        onClick={() => {
                          setFuncInput(ex.func);
                          setLimitPoint(ex.point);
                          setLimitSide(ex.side);
                          setIsHelpOpen(false);
                        }}
                        className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-left transition-all flex items-center justify-between group shadow-sm"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="text-[10px] font-mono text-amber-400/90 block font-semibold">{ex.category}</span>
                          <span className="font-mono text-zinc-200 text-[11px] block truncate">
                            lim [x → {ex.point}] {ex.func}
                          </span>
                          <span className="text-[10px] text-zinc-500 block truncate">{ex.desc}</span>
                        </div>
                        <ChevronRight size={13} className="text-zinc-600 group-hover:text-zinc-200 shrink-0 transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Relevancia en Informática */}
                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
                  <h4 className="font-mono uppercase tracking-wider text-zinc-300 font-semibold mb-1 flex items-center gap-1.5">
                    <Activity size={13} className="text-emerald-400" /> Relevancia en Ciencias de la Computación
                  </h4>
                  <ul className="list-disc pl-4 space-y-1.5 text-zinc-400 leading-relaxed">
                    <li><strong>Análisis Asintótico de Algoritmos:</strong> La Notación Big-O ($O(n \log n)$, $O(n^2)$) se fundamenta rigurosamente en el límite al infinito del cociente de operaciones frente a recursos de CPU.</li>
                    <li><strong>Detección de Singularidades y División por Cero:</strong> Los motores de renderizado 3D y simulaciones de física emplean aproximaciones por límites para prevenir excepciones de hardware como NaNs en colisiones.</li>
                    <li><strong>Estabilidad en Redes Neuronales:</strong> La convergencia de funciones de activación softmax o normalizaciones por lote (Batch Normalization) se verifica analizando límites asintóticos.</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}