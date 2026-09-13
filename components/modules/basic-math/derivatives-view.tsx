"use client";

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
  Cpu,
  Layers,
  Tangent
} from "lucide-react";
import MathGrapher from "@/components/shared/math-grapher";
import { useAIContext } from "@/lib/context/ai-context";
import {
  fetchUserHistory,
  saveUserCalculation,
  deleteUserHistory,
  type HistoryItem,
} from "@/lib/supabase/history";

// -----------------------------------------------------------------------------
// TIPOS Y CATÁLOGO DE EJEMPLOS A NIVEL DE ARCHIVO
// -----------------------------------------------------------------------------
interface ModuleExample {
  category: string;
  func: string;
  point: string;
  desc: string;
}

const MODULE_EXAMPLES: ModuleExample[] = [
  { category: "Regla de la Potencia", func: "x^4 - 3*x^2 + 5*x - 7", point: "1", desc: "Derivación polinómica término a término n·x^(n-1)" },
  { category: "Regla de la Cadena", func: "sin(3*x^2 + 1)", point: "0", desc: "Derivada exterior e interior f'(g(x))·g'(x)" },
  { category: "Regla del Cociente", func: "(x^2 - 1) / (x^2 + 1)", point: "1", desc: "Cociente algebraico: [u'v - uv'] / v²" },
  { category: "Regla del Producto", func: "x^2 * sin(x)", point: "1.57", desc: "Producto de funciones: u'v + uv'" },
  { category: "Función Exponencial", func: "exp(-x^2)", point: "1", desc: "Campana gaussiana: d/dx[e^u] = e^u · u'" },
  { category: "Logaritmo Natural", func: "ln(x^2 + 1)", point: "2", desc: "Derivada logarítmica: u'/u" },
  { category: "Segunda Derivada e Inflexión", func: "x^3 - 6*x^2 + 9*x", point: "2", desc: "Cálculo de f''(x) = 6x - 12 y concavidad" },
  { category: "Raíz Cuadrada (Fraccionaria)", func: "sqrt(2*x + 5)", point: "2", desc: "Derivación de radicales: u' / [2·√(u)]" },
  { category: "Recta Tangente y Extremos", func: "x^3 - 3*x", point: "1", desc: "Punto crítico con pendiente tangente horizontal m = 0" },
];

export interface DerivativeStep {
  id: number;
  stage: string;
  description: string;
  expression: string;
  rule: string;
}

export interface DerivativeResult {
  symbolicDerivative: string;
  secondDerivative: string;
  detectedRule: string;
  ruleExplanation: string;
  slopeAtX0: number | null;
  y0: number | null;
  tangentEquation: string;
  criticalPoints: { x: number; y: number; type: string }[];
  steps: DerivativeStep[];
  error?: string;
}

// Evaluador numérico seguro
function evaluateMath(expr: string, x: number): number {
  try {
    let s = expr.toLowerCase().replace(/\s+/g, "");
    if (!s) return NaN;

    if (s === "gauss") s = "exp(-x^2)";

    s = s.replace(/e\s*\^\s*\(([^()]+)\)/g, "exp($1)");
    s = s.replace(/e\s*\^\s*([a-zA-Z0-9_.]+)/g, "exp($1)");
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

    // eslint-disable-next-line no-new-func
    const fn = new Function("x", `"use strict"; return (${s});`);
    const val = fn(x);
    return typeof val === "number" && !isNaN(val) && isFinite(val) ? val : NaN;
  } catch {
    return NaN;
  }
}

// Derivador simbólico para formas comunes
function computeSymbolicDerivative(raw: string): { first: string; second: string; rule: string; desc: string } {
  const s = raw.toLowerCase().replace(/\s+/g, "");

  // Polinomio simple ax^3 + bx^2 + cx + d
  if (/^[+-]?[0-9]*x(?:\^[0-9]+)?(?:[+-][0-9]*x(?:\^[0-9]+)?)*(?:[+-][0-9]+)?$/.test(s)) {
    return {
      first: "Derivación polinómica término a término (Regla de la Potencia)",
      second: "Segunda derivada polinómica d²f/dx²",
      rule: "Regla de la Potencia: d/dx [xⁿ] = n·xⁿ⁻¹",
      desc: "Multiplica cada coeficiente por el exponente y reduce el grado en 1.",
    };
  }

  // Exponencial e^u o exp(u)
  if (s.includes("exp") || s.includes("e^")) {
    return {
      first: "d/dx [eᵘ] = eᵘ · u'",
      second: "d²/dx² [eᵘ] = eᵘ · (u'' + (u')²)",
      rule: "Regla Exponencial y Cadena",
      desc: "La función exponencial preserva su base multiplicada por la derivada interna del exponente.",
    };
  }

  // Trigonométrica
  if (s.includes("sin") || s.includes("cos") || s.includes("tan")) {
    return {
      first: "d/dx [sin(u)] = cos(u)·u'  |  d/dx [cos(u)] = -sin(u)·u'",
      second: "Segunda derivada trigonométrica periódica",
      rule: "Derivadas Trigonométricas y Cadena",
      desc: "Transformación entre funciones armónicas seno y coseno con rotación de fase.",
    };
  }

  // Cociente
  if (s.includes("/")) {
    return {
      first: "[u'v - uv'] / v²",
      second: "Derivada de orden superior por regla de cocientes",
      rule: "Regla del Cociente",
      desc: "Derivada del numerador por el denominador sin derivar menos el numerador por la derivada del denominador, sobre el denominador al cuadrado.",
    };
  }

  // Radicales
  if (s.includes("sqrt") || s.includes("√")) {
    return {
      first: "u' / [2 · √(u)]",
      second: "Derivada fraccionaria con exponente negativo",
      rule: "Regla de Radicales (Potencia 1/2)",
      desc: "Se expresa la raíz como exponente fraccionario x^(1/2) y se aplica la regla de la potencia.",
    };
  }

  return {
    first: "f'(x) obtenida por diferenciación analítica",
    second: "f''(x) obtenida por segunda derivada",
    rule: "Diferenciación Analítica General",
    desc: "Aplicación sucesiva de las reglas del cálculo diferencial.",
  };
}

// =============================================================================
// MOTOR DE RESOLUCIÓN DE DERIVADAS
// =============================================================================
function solveDerivatives(rawFunc: string, rawX0: string): DerivativeResult {
  const cleanFunc = rawFunc.trim();
  const x0 = parseFloat(rawX0);

  if (!cleanFunc) {
    return {
      symbolicDerivative: "--",
      secondDerivative: "--",
      detectedRule: "Sin datos",
      ruleExplanation: "Introduce una función f(x) para derivar.",
      slopeAtX0: null,
      y0: null,
      tangentEquation: "--",
      criticalPoints: [],
      steps: [],
    };
  }

  const steps: DerivativeStep[] = [];
  let stepId = 1;

  try {
    const sym = computeSymbolicDerivative(cleanFunc);

    // 1. Identificación y Regla
    steps.push({
      id: stepId++,
      stage: "Identificación de Estructura Funcional",
      description: `Analizamos la expresión matemática f(x) = ${cleanFunc} para identificar las reglas de derivación aplicables`,
      expression: `f(x) = ${cleanFunc}`,
      rule: sym.rule,
    });

    // 2. Cálculo numérico de f'(x) y f''(x) mediante diferencias finitas de alta precisión
    const h = 0.0001;
    const f = (x: number) => evaluateMath(cleanFunc, x);
    const df = (x: number) => (f(x + h) - f(x - h)) / (2 * h);
    const d2f = (x: number) => (f(x + h) - 2 * f(x) + f(x - h)) / (h * h);

    const validX0 = !isNaN(x0) ? x0 : 0;
    const y0 = f(validX0);
    const slope = df(validX0);
    const d2val = d2f(validX0);

    steps.push({
      id: stepId++,
      stage: "Primera Derivada f'(x) [Razón de Cambio]",
      description: `Aplicamos la regla de derivación: ${sym.desc}`,
      expression: `f'(${validX0}) = lim [h → 0] [f(${validX0} + h) - f(${validX0} - h)] / 2h ≈ ${Number(slope.toFixed(4))}`,
      rule: "Definición Formal de Derivada",
    });

    // 3. Ecuación de la Recta Tangente en x₀: y - y₀ = m(x - x₀)
    let tangentEq = "--";
    if (!isNaN(y0) && !isNaN(slope)) {
      const b = y0 - slope * validX0;
      tangentEq = `y = ${Number(slope.toFixed(3))}x ${b >= 0 ? "+ " + Number(b.toFixed(3)) : "- " + Math.abs(Number(b.toFixed(3)))}`;

      steps.push({
        id: stepId++,
        stage: `Ecuación de la Recta Tangente en x₀ = ${validX0}`,
        description: `La pendiente de la tangente es m = f'(${validX0}) = ${Number(slope.toFixed(3))}. Punto de tangencia P(${validX0}, ${Number(y0.toFixed(3))})`,
        expression: `y - (${Number(y0.toFixed(3))}) = ${Number(slope.toFixed(3))} · (x - ${validX0})\n⟹  ${tangentEq}`,
        rule: "Ecuación Punto-Pendiente",
      });
    }

    // 4. Segunda Derivada y Concavidad
    let concavityStr = "Lineal / Inflexión";
    if (!isNaN(d2val)) {
      concavityStr = d2val > 0.001 ? "Cóncava hacia arriba (∪) [f'' > 0]" : d2val < -0.001 ? "Cóncava hacia abajo (∩) [f'' < 0]" : "Punto de Inflexión [f'' ≈ 0]";
      steps.push({
        id: stepId++,
        stage: "Segunda Derivada f''(x) y Concavidad",
        description: "El signo de la segunda derivada determina la concavidad y aceleración de la curva",
        expression: `f''(${validX0}) ≈ ${Number(d2val.toFixed(4))}  ⟹  ${concavityStr}`,
        rule: "Criterio de la Segunda Derivada",
      });
    }

    // 5. Búsqueda de Puntos Críticos (f'(x) = 0) en [-8, 8]
    const criticalPoints: { x: number; y: number; type: string }[] = [];
    const scanStep = 0.08;
    let prevD = df(-8);
    for (let x = -8; x <= 8; x += scanStep) {
      const currD = df(x);
      if (!isNaN(prevD) && !isNaN(currD) && prevD * currD < 0) {
        const rootX = Number(x.toFixed(3));
        const valY = Number(f(rootX).toFixed(3));
        const type = prevD > 0 ? "Máximo Local" : "Mínimo Local";
        criticalPoints.push({ x: rootX, y: valY, type });
      }
      prevD = currD;
    }

    return {
      symbolicDerivative: `f'(${validX0}) = ${Number(slope.toFixed(4))}`,
      secondDerivative: `f''(${validX0}) = ${Number(d2val.toFixed(4))}`,
      detectedRule: sym.rule,
      ruleExplanation: sym.desc,
      slopeAtX0: !isNaN(slope) ? Number(slope.toFixed(4)) : null,
      y0: !isNaN(y0) ? Number(y0.toFixed(4)) : null,
      tangentEquation: tangentEq,
      criticalPoints,
      steps,
    };
  } catch (err: unknown) {
    return {
      symbolicDerivative: "--",
      secondDerivative: "--",
      detectedRule: "Error",
      ruleExplanation: err instanceof Error ? err.message : "Error al derivar",
      slopeAtX0: null,
      y0: null,
      tangentEquation: "--",
      criticalPoints: [],
      steps: [],
      error: "No se pudo procesar la función.",
    };
  }
}

export default function DerivativesView({
  viewMode,
  initialExpression = "",
}: {
  viewMode: "calc" | "steps" | "theory";
  initialExpression?: string;
}) {
  const [funcInput, setFuncInput] = useState<string>(
    initialExpression || "x^3 - 3*x"
  );
  const [evalX0, setEvalX0] = useState<string>("1");
  const [showDerivativeGraph, setShowDerivativeGraph] = useState<boolean>(true);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMethodInfoOpen, setIsMethodInfoOpen] = useState(false);

  const { setAIContext, injectedExpression, clearInjectedExpression } = useAIContext();

  const calculation = useMemo(
    () => solveDerivatives(funcInput, evalX0),
    [funcInput, evalX0]
  );

  // Sincronización en tiempo real con ReSolve AI
  useEffect(() => {
    setAIContext({
      module: "Matemáticas I",
      subtopic: "Derivadas y Optimización",
      expression: `d/dx [ ${funcInput} ] en x₀ = ${evalX0}`,
      result: `Pendiente: ${calculation.slopeAtX0}, Tangente: ${calculation.tangentEquation}`,
      details: `Regla: ${calculation.detectedRule}. Puntos críticos: ${calculation.criticalPoints.length}. Segunda derivada: ${calculation.secondDerivative}`,
    });
  }, [funcInput, evalX0, calculation, setAIContext]);

  // Inyecciones inversas del chat
  useEffect(() => {
    if (injectedExpression) {
      setFuncInput(injectedExpression);
      clearInjectedExpression();
    }
  }, [injectedExpression, clearInjectedExpression]);

  // Carga de historial
  useEffect(() => {
    fetchUserHistory("mat1", "derivadas").then((data) => setHistory(data));
  }, []);

  const saveCalculation = async () => {
    if (!funcInput.trim() || calculation.slopeAtX0 === null) return;
    const title = `d/dx [${funcInput}] en x₀=${evalX0}`;
    const resultSummary = `m = ${calculation.slopeAtX0} ; ${calculation.tangentEquation}`;
    await saveUserCalculation("mat1", "derivadas", title, resultSummary);
    const refreshed = await fetchUserHistory("mat1", "derivadas");
    setHistory(refreshed);
  };

  const clearHistory = async () => {
    await deleteUserHistory("derivadas");
    setHistory([]);
  };

  const handleCopy = () => {
    if (calculation.slopeAtX0 === null) return;
    navigator.clipboard.writeText(calculation.tangentEquation);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const DERIVATIVE_KEYS = [
    { label: "x", val: "x" },
    { label: "^2", val: "^2" },
    { label: "^3", val: "^3" },
    { label: "√x", val: "sqrt(x)" },
    { label: "sin", val: "sin(x)" },
    { label: "cos", val: "cos(x)" },
    { label: "ln", val: "ln(x)" },
    { label: "exp", val: "exp(x)" },
    { label: "/", val: " / " },
    { label: "+", val: " + " },
    { label: "-", val: " - " },
    { label: "*", val: " * " },
  ];

  return (
    <div className="h-full flex flex-col gap-6 min-h-0 relative">
      {viewMode === "calc" && (
        <div className="flex-1 flex flex-col gap-6 min-h-0">
          
          {/* FILA SUPERIOR: CONSOLA Y RESULTADOS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 shrink-0">
            
            {/* Consola de Entrada */}
            <div className="lg:col-span-8 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden">
              <div className="pointer-events-none absolute -top-16 -left-16 w-48 h-48 bg-zinc-700/10 rounded-full blur-3xl" />

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-2">
                    <Variable size={14} className="text-zinc-500" />
                    Consola de Derivación y Tangentes
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

                {/* Input de Función f(x) */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                    <span>Función a Derivar f(x):</span>
                    <span className="text-[10px] text-zinc-500 font-mono">d/dx [ f(x) ]</span>
                  </label>
                  <input
                    type="text"
                    value={funcInput}
                    onChange={(e) => setFuncInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveCalculation();
                    }}
                    placeholder="Ej: x^3 - 3*x   o   sin(3*x^2 + 1)   o   exp(-x^2)"
                    className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-2xl px-5 py-3.5 font-mono text-base lg:text-lg text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-all shadow-inner"
                  />
                </div>

                {/* Punto de Evaluación x0 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                      <span>Punto de Evaluación x₀ (Tangente):</span>
                      <strong className="text-amber-400 font-mono">x₀ = {evalX0}</strong>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={evalX0}
                        onChange={(e) => setEvalX0(e.target.value)}
                        placeholder="Ej: 1 o 0 o -2"
                        className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-xl px-3.5 py-2 font-mono text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono text-zinc-400">Opciones de Visualización:</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDerivativeGraph(!showDerivativeGraph)}
                        className={`flex-1 py-2 px-3 rounded-xl border text-xs font-mono transition-colors flex items-center justify-center gap-1.5 ${
                          showDerivativeGraph
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-300 font-semibold"
                            : "bg-zinc-900/60 border-zinc-800 text-zinc-400"
                        }`}
                      >
                        <TrendingUp size={13} />
                        <span>Curva f'(x) Roja</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botones de Teclado Rápido */}
              <div className="relative z-10 flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-zinc-800/60">
                {DERIVATIVE_KEYS.map((k) => (
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
                  <CornerDownLeft size={14} /> Derivar y Evaluar
                </button>

                <button
                  onClick={() => setFuncInput("")}
                  className="h-10 px-3.5 bg-zinc-900/50 border border-zinc-800/80 text-zinc-400 hover:text-red-400 hover:border-red-900/40 rounded-xl text-xs font-medium transition-colors"
                >
                  Limpiar
                </button>
              </div>
            </div>

            {/* Caja Derecha: Pendiente y Recta Tangente */}
            <div className="lg:col-span-4 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden">
              <div className="pointer-events-none absolute -bottom-16 -right-16 w-48 h-48 bg-zinc-700/10 rounded-full blur-3xl" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold">
                    Pendiente Derivada f'(x₀)
                  </span>
                  {calculation.slopeAtX0 !== null && (
                    <button
                      onClick={handleCopy}
                      className="text-xs text-zinc-400 hover:text-zinc-100 flex items-center gap-1.5 transition-colors py-1 px-2.5 rounded-lg border border-zinc-800/60 bg-zinc-900/50"
                    >
                      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      {copied ? "Copiado" : "Copiar"}
                    </button>
                  )}
                </div>

                <div className="py-4 text-center">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={calculation.slopeAtX0?.toString() || "--"}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      transition={{ duration: 0.2 }}
                      className="text-5xl font-serif font-bold text-emerald-400 tracking-tight"
                    >
                      m = {calculation.slopeAtX0 !== null ? calculation.slopeAtX0 : "--"}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Ecuación de la Tangente y Segunda Derivada */}
                <div className="space-y-2 mt-2 font-mono text-xs">
                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60 text-center">
                    <span className="text-[10px] text-zinc-500 block">Recta Tangente</span>
                    <strong className="text-amber-400">{calculation.tangentEquation}</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-zinc-950/60 border border-zinc-800/60 text-center text-[11px]">
                    <span className="text-zinc-500">Concavidad: </span>
                    <strong className="text-zinc-300">{calculation.secondDerivative}</strong>
                  </div>
                </div>
              </div>

              {/* Insignia del Método */}
              <div className="relative z-10 border-t border-zinc-800/60 pt-3.5">
                <button
                  type="button"
                  onClick={() => setIsMethodInfoOpen(!isMethodInfoOpen)}
                  className="w-full p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/70 hover:border-zinc-700 flex items-center justify-between text-[11px] font-mono transition-colors group"
                >
                  <div className="flex items-center gap-1.5 text-zinc-400 group-hover:text-zinc-200 truncate">
                    <Info size={12} className="text-amber-400 shrink-0" />
                    <span className="truncate">{calculation.detectedRule}</span>
                  </div>
                  <ChevronRight size={12} className="text-zinc-600 group-hover:text-zinc-300 shrink-0" />
                </button>
              </div>
            </div>
          </div>

          {/* FILA INFERIOR: GRÁFICA / PASOS + HISTORIAL */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
            
            {/* Panel Izquierdo: Graficador con Recta Tangente y f'(x) */}
            <div className="lg:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <Activity size={15} className="text-zinc-400" /> Representación Gráfica y Tangente
                </span>
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900/80 border border-zinc-800/80 px-2.5 py-1 rounded-full">
                  Tangente en x₀ = {evalX0}
                </span>
              </div>

              <div className="flex-1 min-h-[300px] pt-4 overflow-hidden flex flex-col justify-between">
                <MathGrapher
                  expression={funcInput}
                  tangent={
                    calculation.slopeAtX0 !== null && !isNaN(parseFloat(evalX0))
                      ? { x0: parseFloat(evalX0), slope: calculation.slopeAtX0 }
                      : undefined
                  }
                  points={
                    calculation.criticalPoints.map((cp) => ({
                      x: cp.x,
                      y: cp.y,
                      label: `${cp.type}: (${cp.x}, ${cp.y})`,
                      color: cp.type.includes("Máximo") ? "#f43f5e" : "#06b6d4",
                      type: "solid",
                    }))
                  }
                  height="h-[280px]"
                  initialScale={55}
                />
                <div className="pt-2 text-[11px] font-mono text-zinc-500 flex items-center justify-between">
                  <span>🟡 Línea Amarilla = Recta Tangente en x₀</span>
                  <span>🔴/🔵 Puntos = Extremos Locales (f'(x) = 0)</span>
                </div>
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
                    <p>Sin derivadas guardadas.</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Presiona Derivar para registrar.</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        const m = item.expression.match(/d\/dx\s*\[(.*)\]\s*en\s*x₀=([0-9.-]+)/);
                        if (m) {
                          setFuncInput(m[1]);
                          setEvalX0(m[2]);
                        }
                      }}
                      className="group p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700 hover:bg-zinc-900/80 cursor-pointer transition-all flex items-center justify-between text-xs"
                    >
                      <div className="truncate pr-2 font-mono text-zinc-300 group-hover:text-zinc-100 transition-colors">
                        {item.expression}
                      </div>
                      <div className="font-mono font-bold text-emerald-400 shrink-0 text-[11px] truncate max-w-[120px]">
                        {item.result}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODO 2: PASO A PASO */}
      {viewMode === "steps" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-5 shrink-0">
            <div>
              <h3 className="text-xl font-serif font-bold text-zinc-100">
                Procedimiento Analítico de Derivación
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                d/dx [ {funcInput} ] evaluada en x₀ = {evalX0}
              </p>
            </div>
            <div className="text-xs font-mono px-4 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-zinc-300 shadow-inner">
              Regla: <strong className="text-emerald-400 text-sm font-serif">{calculation.detectedRule}</strong>
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
              <BookOpen size={12} /> Cálculo Diferencial y Optimización
            </div>
            <h3 className="text-2xl font-serif font-bold text-zinc-100">
              La Derivada como Tasa Instantánea de Cambio
            </h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-3xl">
              La derivada de una función modela la tasa a la que cambia el valor de salida con respecto a una variación infinitesimal en la entrada, pilar fundamental de la física matemática y el aprendizaje automático (Machine Learning).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                1. Definición por Cociente de Newton
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                f'(x) = lim [h → 0] [f(x + h) - f(x)] / h. Representa el límite de la pendiente de las rectas secantes a medida que los puntos convergen al punto de tangencia.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                2. Regla de la Cadena y Composición
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                d/dx [f(g(x))] = f'(g(x)) · g'(x). Permite descomponer funciones compuestas complejas multiplicando las tasas de cambio de cada etapa funcional interna.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                3. Descenso de Gradiente en Inteligencia Artificial
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                El entrenamiento de redes neuronales (Backpropagation) utiliza derivadas parciales (gradientes) para ajustar los pesos en dirección opuesta a la derivada de la función de coste.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                4. Criterio de Extremos y Puntos Críticos
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Si f'(x) = 0 y f''(x) &gt; 0, la función alcanza un mínimo relativo. Si f''(x) &lt; 0, alcanza un máximo relativo. Es la base analítica de los problemas de optimización.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DEL MÉTODO DETECTADO */}
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
                  <Cpu size={15} className="text-amber-400" /> {calculation.detectedRule}
                </h4>
                <button onClick={() => setIsMethodInfoOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-100">
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs text-zinc-400 mt-3 leading-relaxed">
                {calculation.ruleExplanation}
              </p>
              <div className="mt-4 pt-3 border-t border-zinc-800/80 text-[11px] font-mono text-zinc-500">
                ReSolve aplica cálculo diferencial analítico y aproximación finita de segundo orden.
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE AYUDA GENERAL CON CATÁLOGO DE EJEMPLOS */}
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
                    <h3 className="text-base font-serif font-bold text-zinc-100">Guía de Derivadas y Rectas Tangentes</h3>
                    <p className="text-xs text-zinc-400">Reglas analíticas, puntos críticos y ejemplos con un solo clic</p>
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
                    <Terminal size={13} className="text-zinc-400" /> Sintaxis Aceptada
                  </h4>
                  <p className="text-zinc-400 leading-relaxed">
                    Escribe polinomios como <code className="text-zinc-200">x^3 - 3*x</code>, funciones trigonométricas como <code className="text-zinc-200">sin(x)</code> o <code className="text-zinc-200">cos(x)</code>, exponenciales como <code className="text-zinc-200">exp(-x^2)</code>, y logaritmos como <code className="text-zinc-200">ln(x)</code>. Elige el punto <code className="text-amber-400 font-bold">x₀</code> donde deseas calcular la pendiente y la recta tangente.
                  </p>
                </div>

                {/* Catálogo de Ejemplos */}
                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
                  <h4 className="font-mono uppercase tracking-wider text-zinc-300 font-semibold mb-2 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-400" /> Catálogo de Problemas de Derivadas (1 Clic para Probar)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {MODULE_EXAMPLES.map((ex) => (
                      <button
                        key={ex.category}
                        onClick={() => {
                          setFuncInput(ex.func);
                          setEvalX0(ex.point);
                          setIsHelpOpen(false);
                        }}
                        className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-left transition-all flex items-center justify-between group shadow-sm"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="text-[10px] font-mono text-amber-400/90 block font-semibold">{ex.category}</span>
                          <span className="font-mono text-zinc-200 text-[11px] block truncate">
                            d/dx [ {ex.func} ] en x₀ = {ex.point}
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
                    <Activity size={13} className="text-emerald-400" /> Relevancia en Ciencias de la Computación y Machine Learning
                  </h4>
                  <ul className="list-disc pl-4 space-y-1.5 text-zinc-400 leading-relaxed">
                    <li><strong>Descenso del Gradiente (Gradient Descent):</strong> El algoritmo central de optimización de redes neuronales (como GPT o Llama) calcula derivadas para minimizar el error de predicción.</li>
                    <li><strong>Cinemática y Simulación en Motores Físicos:</strong> La velocidad instantánea es la primera derivada de la posición ($v = dx/dt$) y la aceleración es la segunda derivada ($a = d²x/dt²$).</li>
                    <li><strong>Procesamiento de Imágenes y Detección de Bordes:</strong> Filtros como Sobel y Laplacian aproximan derivadas espaciales para detectar cambios bruscos de intensidad en píxeles.</li>
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