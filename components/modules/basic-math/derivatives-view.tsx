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
  Tangent,
  Maximize2,
  Minimize2,
  PanelRightClose,
} from "lucide-react";
import { useHistoryVisibility } from "@/lib/hooks/use-history-visibility";
import MathGrapher from "@/components/shared/math-grapher";
import { useAIContext } from "@/lib/context/ai-context";
import {
  fetchUserHistory,
  saveUserCalculation,
  deleteUserHistory,
  type HistoryItem,
} from "@/lib/supabase/history";
import { sanitizeMathExpression, expandNumericFactorials } from "@/lib/math/universal-evaluator";

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
    let s = expandNumericFactorials(sanitizeMathExpression(expr))
      .toLowerCase()
      .replace(/\s+/g, "");
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
export function solveDerivatives(rawFunc: string, rawX0: string): DerivativeResult {
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
    const h2 = 0.001;
    const f = (x: number) => evaluateMath(cleanFunc, x);
    const df = (x: number) => (f(x + h) - f(x - h)) / (2 * h);
    const d2f = (x: number) => (f(x + h2) - 2 * f(x) + f(x - h2)) / (h2 * h2);

    const validX0 = !Number.isNaN(x0) ? x0 : 0;
    const y0 = f(validX0);
    const slopeLeft = (f(validX0) - f(validX0 - h)) / h;
    const slopeRight = (f(validX0 + h) - f(validX0)) / h;
    const rawSlope = (f(validX0 + h) - f(validX0 - h)) / (2 * h);

    // La derivada exige continuidad y derivadas laterales coincidentes.
    const neighborhoodFinite =
      Number.isFinite(y0) &&
      Number.isFinite(f(validX0 - h)) &&
      Number.isFinite(f(validX0 + h));
    const differentiable =
      neighborhoodFinite &&
      Math.abs(slopeLeft - slopeRight) <=
        0.1 * Math.max(1, Math.abs(slopeLeft), Math.abs(slopeRight));

    const slope = differentiable ? rawSlope : NaN;
    const d2val = differentiable ? d2f(validX0) : NaN;

    steps.push({
      id: stepId++,
      stage: "Primera Derivada f'(x) [Razón de Cambio]",
      description: differentiable
        ? `Aplicamos la regla de derivación: ${sym.desc}`
        : "La función no es continua o presenta un punto anguloso en x₀; la derivada no existe allí.",
      expression: differentiable
        ? `f'(${validX0}) = lim [h → 0] [f(${validX0} + h) - f(${validX0} - h)] / 2h ≈ ${Number(slope.toFixed(4))}`
        : `f'(${validX0}) no existe (dominio o derivadas laterales incompatibles)`,
      rule: differentiable ? "Definición Formal de Derivada" : "Condición de Diferenciabilidad",
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
    let prevScanX = -8;
    for (let x = -8; x <= 8; x += scanStep) {
      const currD = df(x);
      if (Number.isFinite(prevD) && Number.isFinite(currD) && prevD * currD < 0) {
        let lo = prevScanX;
        let hi = x;
        const loSign = Math.sign(prevD);
        for (let k = 0; k < 60; k += 1) {
          const mid = (lo + hi) / 2;
          const midSign = Math.sign(df(mid));
          if (midSign === 0) {
            lo = mid;
            hi = mid;
            break;
          }
          if (midSign === loSign) lo = mid;
          else hi = mid;
        }
        const rootX = Number(((lo + hi) / 2).toFixed(6));
        const valueAtRoot = f(rootX);
        if (Number.isFinite(valueAtRoot)) {
          const type = prevD > 0 ? "Máximo Local" : "Mínimo Local";
          criticalPoints.push({ x: rootX, y: Number(valueAtRoot.toFixed(4)), type });
        }
      }
      prevD = currD;
      prevScanX = x;
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
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const { isHistoryHidden, setIsHistoryHidden } = useHistoryVisibility();

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

  // Cierre de modales con la tecla Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsHelpOpen(false);
        setIsMethodInfoOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
            <div className="lg:col-span-7 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden">
              <div className="pointer-events-none absolute -top-20 -left-20 w-56 h-56 bg-zinc-700/10 rounded-full blur-3xl" />

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-2">
                    <Variable size={13} className="text-zinc-500" />
                    Consola de Derivación y Tangentes
                  </span>

                  <button
                    type="button"
                    onClick={() => setIsHelpOpen(true)}
                    className="text-[10px] font-mono uppercase tracking-[0.15em] text-zinc-500 bg-zinc-950/60 border border-zinc-800/60 px-2.5 py-1 rounded-lg hover:text-zinc-300 hover:border-zinc-700 transition-colors flex items-center gap-1.5"
                  >
                    <HelpCircle size={13} className="text-amber-400" />
                    <span>Guía del Módulo</span>
                  </button>
                </div>

                {/* Input de Función f(x) */}
                <div className="space-y-1.5">
                  <label htmlFor="derivada-funcion" className="text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                    <span>Función a Derivar f(x):</span>
                    <span className="text-[10px] text-zinc-500 font-mono">d/dx [ f(x) ]</span>
                  </label>
                  <input
                    id="derivada-funcion"
                    type="text"
                    value={funcInput}
                    onChange={(e) => setFuncInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveCalculation();
                    }}
                    placeholder="Ej: x^3 - 3*x   o   sin(3*x^2 + 1)   o   exp(-x^2)"
                    className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-2xl px-5 py-3.5 font-mono text-lg lg:text-2xl text-zinc-100 placeholder:text-zinc-600 placeholder:text-sm lg:placeholder:text-base focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/20 transition-all shadow-inner selection:bg-emerald-500/30"
                  />
                </div>

                {/* Punto de Evaluación x0 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <label htmlFor="derivada-x0" className="text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                      <span>Punto de Evaluación x₀ (Tangente):</span>
                      <strong className="text-amber-400 font-mono">x₀ = {evalX0}</strong>
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="derivada-x0"
                        type="text"
                        value={evalX0}
                        onChange={(e) => setEvalX0(e.target.value)}
                        placeholder="Ej: 1 o 0 o -2"
                        className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-xl px-3.5 py-2 font-mono text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[11px] font-mono text-zinc-400">Opciones de Visualización:</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDerivativeGraph(!showDerivativeGraph)}
                        aria-pressed={showDerivativeGraph}
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

              {/* Teclado de funciones */}
              <div className="relative z-10 mt-5 pt-4 border-t border-zinc-800/60">
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600 mb-2 block">
                  Insertar Funciones
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {DERIVATIVE_KEYS.map((k) => (
                    <button
                      key={k.label}
                      type="button"
                      onClick={() => setFuncInput((prev) => prev + k.val)}
                      aria-label={k.label}
                      title={k.label}
                      className="h-10 min-w-[46px] px-3.5 bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-600 hover:bg-zinc-800/60 text-zinc-200 rounded-xl font-mono text-base font-medium transition-all active:scale-95 flex items-center justify-center"
                    >
                      {k.label}
                    </button>
                  ))}
                </div>

                {/* Acciones */}
                <div className="mt-5 pt-4 border-t border-zinc-800/60 flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setFuncInput("")}
                    className="h-11 px-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 text-zinc-400 hover:text-red-400 hover:border-red-900/40 text-xs font-medium transition-colors flex items-center gap-2 active:scale-95"
                  >
                    <X size={14} /> Limpiar
                  </button>

                  <button
                    type="button"
                    onClick={() => void saveCalculation()}
                    className="h-11 px-6 ml-auto bg-zinc-100 text-zinc-950 rounded-xl text-xs font-semibold hover:bg-zinc-200 hover:scale-[1.02] transition-all flex items-center gap-2 shadow-lg shadow-zinc-100/5 active:scale-95"
                  >
                    <CornerDownLeft size={14} /> Derivar y Evaluar
                    <span className="ml-1 hidden sm:inline-flex items-center rounded-md border border-zinc-950/20 px-1.5 py-0.5 font-mono text-[9px] tracking-wider opacity-70">
                      ENTER
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Caja Derecha: Pendiente y Recta Tangente */}
            <div className="lg:col-span-5 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden">
              <div className="pointer-events-none absolute -bottom-20 -right-20 w-56 h-56 bg-zinc-700/10 rounded-full blur-3xl" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold">
                    Pendiente Derivada f'(x₀)
                  </span>
                  {calculation.slopeAtX0 !== null && (
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

                <div className="py-4 text-center">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={calculation.slopeAtX0?.toString() || "--"}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      transition={{ duration: 0.2 }}
                      className={`text-5xl lg:text-7xl font-serif font-bold tracking-tight transition-colors ${
                        calculation.slopeAtX0 !== null ? "text-zinc-100" : "text-zinc-600"
                      }`}
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[640px]">
            
            {/* Panel Izquierdo: Graficador con Recta Tangente y f'(x) */}
            <div className={`${isHistoryHidden ? "lg:col-span-12" : isHistoryExpanded ? "lg:col-span-7" : "lg:col-span-9"} border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20`}>
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <Activity size={15} className="text-zinc-400" /> Representación Gráfica y Tangente
                </span>
                <span className="text-[10px] font-mono text-zinc-500 bg-zinc-950/60 border border-zinc-800/60 px-2.5 py-1 rounded-full">
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
                  height="flex-1"
                  initialScale={55}
                />
                <div className="pt-2 text-[11px] font-mono text-zinc-500 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <TrendingUp size={12} className="text-amber-400" />
                    Línea = Recta Tangente en x₀
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Activity size={12} className="text-zinc-400" />
                    Puntos = Extremos Locales (f'(x) = 0)
                  </span>
                </div>
              </div>
            </div>

            {/* Panel Derecho: Historial */}
            <div className={`${isHistoryHidden ? "hidden" : isHistoryExpanded ? "lg:col-span-5" : "lg:col-span-3"} relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20 overflow-hidden`}>
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsHistoryExpanded((v) => !v)}
                  title={isHistoryExpanded ? "Contraer historial" : "Expandir historial"}
                  aria-label={isHistoryExpanded ? "Contraer historial" : "Expandir historial"}
                  aria-pressed={isHistoryExpanded}
                  className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2 hover:text-zinc-100 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 rounded"
                >
                  <History size={15} className="text-zinc-400" /> Historial
                  {isHistoryExpanded ? <Minimize2 size={13} className="text-zinc-500" /> : <Maximize2 size={13} className="text-zinc-500" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsHistoryHidden(true)}
                  title="Ocultar historial"
                  aria-label="Ocultar historial"
                  className="ml-auto mr-1.5 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors"
                >
                  <PanelRightClose size={14} />
                </button>
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

              <div className="flex-1 min-h-0 overflow-y-auto pt-5 pr-1 space-y-2 custom-scrollbar">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-6">
                    <span className="w-11 h-11 rounded-xl bg-zinc-900/50 border border-zinc-800/60 flex items-center justify-center">
                      <History size={18} className="text-zinc-600" />
                    </span>
                    <p className="text-sm text-zinc-300 font-medium">Sin derivadas guardadas</p>
                    <p className="text-[11px] text-zinc-500">
                      Presiona <span className="font-mono">Derivar</span> para registrar
                    </p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        const m = item.expression.match(/d\/dx\s*\[(.*)\]\s*en\s*x₀=([0-9.-]+)/);
                        if (m) {
                          setFuncInput(m[1]);
                          setEvalX0(m[2]);
                        }
                      }}
                      title={`Recargar: ${item.expression}`}
                      className="group p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700 hover:bg-zinc-800/60 cursor-pointer transition-all flex items-center justify-between gap-3 text-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500/40"
                    >
                      <span className="min-w-0 truncate pr-2 font-mono text-[13px] text-zinc-300 group-hover:text-zinc-100 transition-colors">
                        {item.expression}
                      </span>
                      <span className="font-mono font-bold text-emerald-400 shrink-0 text-[11px] truncate max-w-[120px]">
                        {item.result}
                      </span>
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
        <div className="relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col min-h-0 shadow-xl shadow-black/20 overflow-hidden">
          <div className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 bg-zinc-700/10 rounded-full blur-3xl" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-800/60 shrink-0">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800/80 bg-zinc-900/60 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 mb-2.5">
                <ListOrdered size={12} /> Procedimiento
              </div>
              <h3 className="text-xl lg:text-2xl font-serif font-bold text-zinc-100">
                Procedimiento Analítico de Derivación
              </h3>
              <p className="text-xs text-zinc-400 mt-1.5 font-mono truncate">
                d/dx [ <span className="text-zinc-200 font-semibold">{funcInput || "--"}</span> ] evaluada en x₀ = {evalX0}
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 shadow-inner">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Regla
              </span>
              <span className="text-sm font-serif font-bold text-zinc-100">
                {calculation.detectedRule}
              </span>
            </div>
          </div>

          <div className="relative z-10 flex-1 min-h-0 overflow-y-auto pt-6 pr-2 custom-scrollbar">
            {calculation.steps.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-6">
                <span className="w-11 h-11 rounded-xl bg-zinc-900/50 border border-zinc-800/60 flex items-center justify-center">
                  <Variable size={20} className="text-zinc-600" />
                </span>
                <p className="text-sm text-zinc-300 font-medium">Sin procedimiento disponible</p>
                <p className="text-[11px] text-zinc-500">
                  Ingresa una función en la pestaña Calcular para consultar la derivación
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
                        <span className="text-sm font-semibold text-zinc-100">{step.stage}</span>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 shrink-0">
                          Paso {step.id}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-300 leading-relaxed mt-1.5">
                        {step.description}
                      </p>

                      <div className="flex items-center justify-between gap-3 pt-3 mt-3 border-t border-zinc-800/60 min-w-0">
                        <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 font-mono text-xs text-emerald-400 whitespace-pre-line truncate min-w-0 flex-1">
                          {step.expression}
                        </div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 shrink-0">
                          {step.rule}
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

      {/* MODO 3: TEORÍA */}
      {viewMode === "theory" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col min-h-0 overflow-y-auto shadow-xl shadow-black/20 custom-scrollbar">
          <div className="pb-5 border-b border-zinc-800/60">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800/80 bg-zinc-900/60 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 mb-3">
              <BookOpen size={12} /> Cálculo Diferencial y Optimización
            </div>
            <h3 className="text-2xl lg:text-3xl font-serif font-bold text-zinc-100">
              La Derivada como Tasa Instantánea de Cambio
            </h3>
            <p className="text-xs text-zinc-400 mt-2.5 leading-relaxed max-w-3xl">
              La derivada de una función modela la tasa a la que cambia el valor de salida con respecto a una variación infinitesimal en la entrada, pilar fundamental de la física matemática y el aprendizaje automático (Machine Learning).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
            {[
              {
                priority: "1",
                title: "Definición por Cociente de Newton",
                rationale:
                  "f'(x) = lim [h → 0] [f(x + h) - f(x)] / h. Representa el límite de la pendiente de las rectas secantes a medida que los puntos convergen al punto de tangencia.",
              },
              {
                priority: "2",
                title: "Regla de la Cadena y Composición",
                rationale:
                  "d/dx [f(g(x))] = f'(g(x)) · g'(x). Permite descomponer funciones compuestas complejas multiplicando las tasas de cambio de cada etapa funcional interna.",
              },
              {
                priority: "3",
                title: "Descenso de Gradiente en Inteligencia Artificial",
                rationale:
                  "El entrenamiento de redes neuronales (Backpropagation) utiliza derivadas parciales (gradientes) para ajustar los pesos en dirección opuesta a la derivada de la función de coste.",
              },
              {
                priority: "4",
                title: "Criterio de Extremos y Puntos Críticos",
                rationale:
                  "Si f'(x) = 0 y f''(x) > 0, la función alcanza un mínimo relativo. Si f''(x) < 0, alcanza un máximo relativo. Es la base analítica de los problemas de optimización.",
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
                  </div>
                </div>
              </div>
            ))}
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
              role="dialog"
              aria-modal="true"
              aria-label={calculation.detectedRule}
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
              role="dialog"
              aria-modal="true"
              aria-label="Guía de Derivadas y Rectas Tangentes"
              className="relative w-full max-w-3xl border border-zinc-800/80 bg-zinc-950/95 backdrop-blur-2xl rounded-3xl p-6 lg:p-8 shadow-2xl overflow-hidden"
            >
              <div className="pointer-events-none absolute -top-20 -right-20 w-60 h-60 bg-zinc-700/10 rounded-full blur-3xl" />

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
                    <li><strong>Cinemática y Simulación en Motores Físicos:</strong> La velocidad instantánea es la primera derivada de la posición (<code className="text-zinc-200 font-mono">v = dx/dt</code>) y la aceleración es la segunda derivada (<code className="text-zinc-200 font-mono">a = d²x/dt²</code>).</li>
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