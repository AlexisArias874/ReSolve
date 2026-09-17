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
  Terminal,
  ChevronRight,
  Info,
  TrendingUp,
  Cpu,
  Target,
  Layers,
  Activity,
  Zap,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import MathGrapher from "@/components/shared/math-grapher";
import { useAIContext } from "@/lib/context/ai-context";
import {
  fetchUserHistory,
  saveUserCalculation,
  deleteUserHistory,
  type HistoryItem,
} from "@/lib/supabase/history";

export type RootMethod = "bisection" | "newton" | "secant" | "fixed_point";

interface ModuleExample {
  category: string;
  method: RootMethod;
  func: string;
  p1: string;
  p2: string;
  tol: string;
  desc: string;
}

const MODULE_EXAMPLES: ModuleExample[] = [
  {
    category: "Bisección (Cálculo de √5)",
    method: "bisection",
    func: "x^2 - 5",
    p1: "2",
    p2: "3",
    tol: "0.0001",
    desc: "Búsqueda en [2, 3] para aproximar √5 ≈ 2.236068 garantizada por Bolzano.",
  },
  {
    category: "Newton-Raphson (Cúbica)",
    method: "newton",
    func: "x^3 - 2*x - 5",
    p1: "2",
    p2: "",
    tol: "0.000001",
    desc: "Convergencia cuadrática ultra-rápida partiendo del punto semilla x₀ = 2.",
  },
  {
    category: "Trascendente (Coseno vs Recta)",
    method: "newton",
    func: "cos(x) - x",
    p1: "0.5",
    p2: "",
    tol: "0.0001",
    desc: "Intersección de f(x) = cos(x) y y = x (solución x ≈ 0.739085).",
  },
  {
    category: "Método de la Secante (Exponencial)",
    method: "secant",
    func: "exp(-x) - x",
    p1: "0",
    p2: "1",
    tol: "0.0001",
    desc: "Sin derivadas analíticas: aproxima la raíz partiendo de x₀ = 0 y x₁ = 1.",
  },
  {
    category: "Punto Fijo g(x)",
    method: "fixed_point",
    func: "sqrt(2*x + 3)",
    p1: "1",
    p2: "",
    tol: "0.0001",
    desc: "Iteración x = √(2x + 3) que converge al valor x = 3 con |g'(x)| < 1.",
  },
  {
    category: "Polinomio de Grado 4",
    method: "bisection",
    func: "x^4 - x - 10",
    p1: "1",
    p2: "2",
    tol: "0.0001",
    desc: "Raíz real en el intervalo [1, 2] con f(1)=-10 y f(2)=4.",
  },
];

// Evaluador matemático seguro
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

// Derivada numérica para Newton-Raphson
function numDerivative(expr: string, x: number): number {
  const h = 0.00001;
  return (evaluateMath(expr, x + h) - evaluateMath(expr, x - h)) / (2 * h);
}

export default function NumericalRootsView({
  viewMode,
  initialExpression = "",
}: {
  viewMode: "calc" | "steps" | "theory";
  initialExpression?: string;
}) {
  const [method, setMethod] = useState<RootMethod>("bisection");
  const [funcInput, setFuncInput] = useState<string>(initialExpression || "x^2 - 5");

  // Parámetros de aproximación
  const [param1, setParam1] = useState<string>("2"); // 'a' o 'x0'
  const [param2, setParam2] = useState<string>("3"); // 'b' o 'x1'
  const [tolerance, setTolerance] = useState<string>("0.0001");
  const [maxIterations, setMaxIterations] = useState<number>(20);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMethodInfoOpen, setIsMethodInfoOpen] = useState(false);

  const { setAIContext, injectedExpression, clearInjectedExpression } = useAIContext();

  // ---------------------------------------------------------------------------
  // MOTOR DE RESOLUCIÓN NUMÉRICA ITERATIVA
  // ---------------------------------------------------------------------------
  const calculation = useMemo(() => {
    const clean = funcInput.trim();
    const tol = parseFloat(tolerance) || 0.0001;
    const maxN = maxIterations || 20;

    if (!clean) {
      return {
        root: null,
        fRoot: null,
        iterations: 0,
        finalError: null,
        converged: false,
        methodName: "Sin datos",
        tableRows: [],
        steps: [],
      };
    }

    const tableRows: {
      iter: number;
      colA: number;
      colB?: number;
      approxX: number;
      fVal: number;
      errorRel: number | null;
    }[] = [];

    const steps: { stage: string; desc: string; math: string }[] = [];
    let stepId = 1;
    let root: number | null = null;
    let converged = false;
    let finalError: number | null = null;
    let methodName = "";

    // =========================================================================
    // 1. MÉTODO DE BISECCIÓN
    // =========================================================================
    if (method === "bisection") {
      methodName = "Método de Bisección (Bolzano)";
      let a = parseFloat(param1);
      let b = parseFloat(param2);

      const fa = evaluateMath(clean, a);
      const fb = evaluateMath(clean, b);

      steps.push({
        stage: `${stepId++}. Validación del Teorema de Bolzano en [a, b]`,
        desc: `Verificamos cambio de signo f(a) · f(b) < 0 en el intervalo [${a}, ${b}]`,
        math: `f(${a}) = ${Number(fa.toFixed(4))} ,  f(${b}) = ${Number(fb.toFixed(4))}\n⟹ f(a) · f(b) = ${Number((fa * fb).toFixed(4))} ${fa * fb < 0 ? "< 0  (¡Raíz garantizada en el intervalo!)" : "≥ 0  (No se garantiza cambio de signo)"}`,
      });

      if (fa * fb >= 0) {
        return {
          root: null,
          fRoot: null,
          iterations: 0,
          finalError: null,
          converged: false,
          methodName,
          tableRows: [],
          steps,
          error: `No hay cambio de signo en [${a}, ${b}]. El Teorema de Bolzano no se cumple.`,
        };
      }

      let prevC: number | null = null;
      for (let i = 1; i <= maxN; i++) {
        const c = (a + b) / 2;
        const fc = evaluateMath(clean, c);
        let ea: number | null = null;

        if (prevC !== null && Math.abs(c) > 1e-9) {
          ea = Math.abs((c - prevC) / c) * 100;
        }

        tableRows.push({
          iter: i,
          colA: Number(a.toFixed(5)),
          colB: Number(b.toFixed(5)),
          approxX: Number(c.toFixed(6)),
          fVal: Number(fc.toFixed(5)),
          errorRel: ea !== null ? Number(ea.toFixed(4)) : null,
        });

        if (Math.abs(fc) < 1e-12 || (ea !== null && ea < tol * 100)) {
          root = c;
          converged = true;
          finalError = ea;
          break;
        }

        if (evaluateMath(clean, a) * fc < 0) {
          b = c;
        } else {
          a = c;
        }
        prevC = c;
        root = c;
      }

      steps.push({
        stage: `${stepId++}. Convergencia Alcanzada por Bisección`,
        desc: `El punto medio convergió a la raíz con una tolerancia de ${tol}`,
        math: `x^* \\approx ${Number(root?.toFixed(6))} \\quad\\text{con}\\quad f(x^*) = ${Number(evaluateMath(clean, root || 0).toFixed(6))}`,
      });
    }

    // =========================================================================
    // 2. MÉTODO DE NEWTON-RAPHSON
    // =========================================================================
    else if (method === "newton") {
      methodName = "Método de Newton-Raphson (Tangentes)";
      let x = parseFloat(param1);

      steps.push({
        stage: `${stepId++}. Fórmula de Recurrencia Cuadrática`,
        desc: "x_{i+1} = x_i - f(x_i) / f'(x_i)",
        math: `x_{i+1} = x_i - \\frac{f(x_i)}{f'(x_i)} \\quad\\text{con punto semilla } x_0 = ${x}`,
      });

      for (let i = 1; i <= maxN; i++) {
        const fx = evaluateMath(clean, x);
        const dfx = numDerivative(clean, x);

        if (Math.abs(dfx) < 1e-12) {
          return {
            root: null,
            fRoot: null,
            iterations: i,
            finalError: null,
            converged: false,
            methodName,
            tableRows,
            steps,
            error: `Derivada nula f'(${x}) = 0. División por cero en la iteración ${i}.`,
          };
        }

        const nextX = x - fx / dfx;
        const ea = Math.abs(nextX) > 1e-9 ? Math.abs((nextX - x) / nextX) * 100 : 0;

        tableRows.push({
          iter: i,
          colA: Number(x.toFixed(6)),
          approxX: Number(nextX.toFixed(6)),
          fVal: Number(fx.toFixed(5)),
          errorRel: Number(ea.toFixed(4)),
        });

        if (ea < tol * 100 || Math.abs(fx) < 1e-10) {
          root = nextX;
          converged = true;
          finalError = ea;
          break;
        }

        x = nextX;
        root = nextX;
      }

      steps.push({
        stage: `${stepId++}. Convergencia de Newton-Raphson`,
        desc: `Raíz calculada en ${tableRows.length} iteraciones con precisión cuadrática`,
        math: `x^* \\approx ${Number(root?.toFixed(6))} \\quad\\text{con error } \\varepsilon_a = ${Number(finalError?.toFixed(4))}\\%`,
      });
    }

    // =========================================================================
    // 3. MÉTODO DE LA SECANTE
    // =========================================================================
    else if (method === "secant") {
      methodName = "Método de la Secante (Diferencias Finitas)";
      let x0 = parseFloat(param1);
      let x1 = parseFloat(param2);

      steps.push({
        stage: `${stepId++}. Fórmula de la Secante`,
        desc: "x_{i+1} = x_i - f(x_i) · (x_i - x_{i-1}) / [f(x_i) - f(x_{i-1})]",
        math: `x_{i+1} = x_i - \\frac{f(x_i)(x_i - x_{i-1})}{f(x_i) - f(x_{i-1})}`,
      });

      for (let i = 1; i <= maxN; i++) {
        const fx0 = evaluateMath(clean, x0);
        const fx1 = evaluateMath(clean, x1);

        if (Math.abs(fx1 - fx0) < 1e-12) break;

        const nextX = x1 - (fx1 * (x1 - x0)) / (fx1 - fx0);
        const ea = Math.abs(nextX) > 1e-9 ? Math.abs((nextX - x1) / nextX) * 100 : 0;

        tableRows.push({
          iter: i,
          colA: Number(x0.toFixed(5)),
          colB: Number(x1.toFixed(5)),
          approxX: Number(nextX.toFixed(6)),
          fVal: Number(fx1.toFixed(5)),
          errorRel: Number(ea.toFixed(4)),
        });

        if (ea < tol * 100) {
          root = nextX;
          converged = true;
          finalError = ea;
          break;
        }

        x0 = x1;
        x1 = nextX;
        root = nextX;
      }

      steps.push({
        stage: `${stepId++}. Solución por Secante`,
        desc: "Aproximación completada sin evaluar derivadas analíticas",
        math: `x^* \\approx ${Number(root?.toFixed(6))}`,
      });
    }

    // =========================================================================
    // 4. MÉTODO DE PUNTO FIJO
    // =========================================================================
    else if (method === "fixed_point") {
      methodName = "Iteración de Punto Fijo: x = g(x)";
      let x = parseFloat(param1);

      steps.push({
        stage: `${stepId++}. Ecuación Despejada x = g(x)`,
        desc: `Iteramos x_{i+1} = g(x_i) a partir de x₀ = ${x}`,
        math: `x_{i+1} = g(x_i) = ${clean}`,
      });

      for (let i = 1; i <= maxN; i++) {
        const nextX = evaluateMath(clean, x);
        if (isNaN(nextX) || Math.abs(nextX) > 1e7) {
          return {
            root: null,
            fRoot: null,
            iterations: i,
            finalError: null,
            converged: false,
            methodName,
            tableRows,
            steps,
            error: "El método divergió. No se cumple el criterio de convergencia |g'(x)| < 1.",
          };
        }

        const ea = Math.abs(nextX) > 1e-9 ? Math.abs((nextX - x) / nextX) * 100 : 0;

        tableRows.push({
          iter: i,
          colA: Number(x.toFixed(6)),
          approxX: Number(nextX.toFixed(6)),
          fVal: Number((nextX - x).toFixed(5)),
          errorRel: Number(ea.toFixed(4)),
        });

        if (ea < tol * 100) {
          root = nextX;
          converged = true;
          finalError = ea;
          break;
        }

        x = nextX;
        root = nextX;
      }

      steps.push({
        stage: `${stepId++}. Punto Fijo Alcanzado`,
        desc: "Se cumplió la igualdad x* = g(x*) dentro del umbral de tolerancia",
        math: `x^* = g(x^*) = ${Number(root?.toFixed(6))}`,
      });
    }

    return {
      root: root !== null ? Number(root.toFixed(6)) : null,
      fRoot: root !== null ? Number(evaluateMath(clean, root).toFixed(6)) : null,
      iterations: tableRows.length,
      finalError: finalError !== null ? Number(finalError.toFixed(4)) : null,
      converged,
      methodName,
      tableRows,
      steps,
    };
  }, [funcInput, method, param1, param2, tolerance, maxIterations]);

  // Sincronización con ReSolve AI
  useEffect(() => {
    const summary = `${calculation.methodName} | Raíz x* ≈ ${calculation.root} | f(x*) = ${calculation.fRoot} | Iteraciones: ${calculation.iterations} | Error εa = ${calculation.finalError}%`;
    setAIContext({
      module: "Matemáticas IV",
      subtopic: "Raíces Numéricas",
      expression: `${method === "fixed_point" ? "g(x)" : "f(x)"} = ${funcInput}`,
      result: `x* = ${calculation.root}`,
      details: summary,
    });
  }, [calculation, funcInput, method, setAIContext]);

  // Inyecciones inversas del chat
  useEffect(() => {
    if (injectedExpression) {
      setFuncInput(injectedExpression);
      clearInjectedExpression();
    }
  }, [injectedExpression, clearInjectedExpression]);

  // Carga de historial de Supabase
  useEffect(() => {
    fetchUserHistory("mat4", "raices-metodos").then((data) => setHistory(data));
  }, []);

  const saveCalculation = async () => {
    if (calculation.root === null) return;
    const title = `Raíz ${method.toUpperCase()}: ${funcInput}`;
    const resSummary = `x* = ${calculation.root} (Iter: ${calculation.iterations}, εa=${calculation.finalError}%)`;
    await saveUserCalculation("mat4", "raices-metodos", title, resSummary);
    const refreshed = await fetchUserHistory("mat4", "raices-metodos");
    setHistory(refreshed);
  };

  const clearHistory = async () => {
    await deleteUserHistory("raices-metodos");
    setHistory([]);
  };

  const handleCopy = () => {
    if (calculation.root === null) return;
    navigator.clipboard.writeText(calculation.root.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const ROOT_KEYS = [
    { label: "x", val: "x" },
    { label: "^2", val: "^2" },
    { label: "^3", val: "^3" },
    { label: "√x", val: "sqrt(x)" },
    { label: "exp", val: "exp(x)" },
    { label: "ln", val: "ln(x)" },
    { label: "cos", val: "cos(x)" },
    { label: "sin", val: "sin(x)" },
    { label: "/", val: " / " },
    { label: "+", val: " + " },
    { label: "-", val: " - " },
    { label: "*", val: " * " },
  ];

  return (
    <div className="h-full flex flex-col gap-6 min-h-0 relative select-none">
      {viewMode === "calc" && (
        <div className="flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto custom-scrollbar pr-1">
          
          {/* FILA SUPERIOR: CONSOLA Y RESULTADOS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 shrink-0">
            
            {/* Consola de Entrada del Método */}
            <div className="lg:col-span-8 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-2">
                    <Target size={14} className="text-zinc-500" />
                    Consola de Aproximación de Raíces Numéricas
                  </span>

                  <button
                    type="button"
                    onClick={() => setIsHelpOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-800 text-[11px] font-mono text-zinc-300 transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <HelpCircle size={13} className="text-amber-400" />
                    <span>Casos de Estudio</span>
                  </button>
                </div>

                {/* Selector de Algoritmo Numérico */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-zinc-950/80 border border-zinc-800/80 p-1.5 rounded-2xl text-xs font-mono">
                  {[
                    { id: "bisection", label: "Bisección" },
                    { id: "newton", label: "Newton-Raphson" },
                    { id: "secant", label: "Secante" },
                    { id: "fixed_point", label: "Punto Fijo" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMethod(m.id as RootMethod)}
                      className={`py-1.5 px-2 rounded-xl transition-all text-center ${
                        method === m.id
                          ? "bg-amber-400 text-zinc-950 font-bold shadow-md"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* Input de la Función */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                    <span>{method === "fixed_point" ? "Función Despejada g(x):" : "Función f(x) = 0:"}</span>
                    <span className="text-[10px] text-amber-400 font-mono">
                      {method === "fixed_point" ? "x = g(x)" : "f(x) = 0"}
                    </span>
                  </label>
                  <input
                    type="text"
                    value={funcInput}
                    onChange={(e) => setFuncInput(e.target.value)}
                    placeholder="Ej: x^2 - 5   o   x^3 - 2*x - 5   o   cos(x) - x"
                    className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-2xl px-5 py-3.5 font-mono text-base lg:text-lg text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-all shadow-inner"
                  />
                </div>

                {/* Parámetros de Intervalo, Semilla y Tolerancia */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {/* Parámetro 1 */}
                  <div className="p-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/80">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                      {method === "bisection" ? "Límite Inferior (a):" : "Punto Semilla (x₀):"}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={param1}
                      onChange={(e) => setParam1(e.target.value)}
                      className="w-full bg-transparent font-mono text-sm text-zinc-100 outline-none"
                    />
                  </div>

                  {/* Parámetro 2 (solo en Bisección y Secante) */}
                  {method === "bisection" || method === "secant" ? (
                    <div className="p-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/80">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                        {method === "bisection" ? "Límite Superior (b):" : "Segundo Punto (x₁):"}
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={param2}
                        onChange={(e) => setParam2(e.target.value)}
                        className="w-full bg-transparent font-mono text-sm text-zinc-100 outline-none"
                      />
                    </div>
                  ) : (
                    <div className="p-3 rounded-2xl border border-zinc-800/40 bg-zinc-950/30 flex items-center justify-center text-[11px] font-mono text-zinc-600">
                      Método Unipuntual
                    </div>
                  )}

                  {/* Tolerancia y Max Iteraciones */}
                  <div className="p-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/80">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                      Tolerancia (εs):
                    </label>
                    <select
                      value={tolerance}
                      onChange={(e) => setTolerance(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs font-mono text-zinc-300 outline-none cursor-pointer"
                    >
                      <option value="0.01">1% (0.01)</option>
                      <option value="0.0001">0.01% (10⁻⁴)</option>
                      <option value="0.000001">0.0001% (10⁻⁶)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Botones de Teclado Rápido */}
              <div className="relative z-10 flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-zinc-800/60">
                {ROOT_KEYS.map((k) => (
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
                  <CornerDownLeft size={14} /> Calcular Raíz
                </button>

                <button
                  onClick={() => setFuncInput("")}
                  className="h-10 px-3.5 bg-zinc-900/50 border border-zinc-800/80 text-zinc-400 hover:text-red-400 hover:border-red-900/40 rounded-xl text-xs font-medium transition-colors"
                >
                  Limpiar
                </button>
              </div>
            </div>

            {/* Caja Derecha: Raíz Calculada y Convergencia */}
            <div className="lg:col-span-4 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden">
              <div className="pointer-events-none absolute -bottom-16 -right-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl" />

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold">
                    Raíz Aproximada (x*)
                  </span>
                  {calculation.root !== null && (
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
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-1">
                    Valor de Convergencia
                  </span>
                  <div className="text-4xl lg:text-5xl font-serif font-bold text-emerald-400 tracking-tight">
                    {calculation.root !== null ? calculation.root : "--"}
                  </div>
                  <span className="text-[11px] font-mono text-zinc-400 mt-2 block">
                    {calculation.converged
                      ? `✓ Convergencia en ${calculation.iterations} iteraciones`
                      : calculation.error || "Aproximando solución..."}
                  </span>
                </div>

                {/* Métricas de Error y Función */}
                <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 block">Evaluación f(x*)</span>
                    <strong className="text-zinc-200">{calculation.fRoot !== null ? calculation.fRoot : "--"}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 block">Error Final (εa)</span>
                    <strong className="text-amber-400">{calculation.finalError !== null ? `${calculation.finalError}%` : "--"}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 block">Iteraciones Realizadas</span>
                    <strong className="text-zinc-200">{calculation.iterations}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 block">Tolerancia Pedida</span>
                    <strong className="text-zinc-400">{tolerance}</strong>
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
                    <span>Orden de Convergencia</span>
                  </div>
                  <ChevronRight size={12} className="text-zinc-600 group-hover:text-zinc-300 shrink-0" />
                </button>
              </div>
            </div>
          </div>

          {/* FILA INFERIOR: TABLA ITERATIVA / GRÁFICA + HISTORIAL */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
            
            {/* Panel Izquierdo: Tabla de Iteraciones y Graficador */}
            <div className="lg:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <ListOrdered size={15} className="text-zinc-400" /> Tabla de Convergencia Iterativa ({calculation.methodName})
                </span>
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900/80 border border-zinc-800/80 px-2.5 py-1 rounded-full">
                  {calculation.tableRows.length} Pasos Iterados
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto mt-4 custom-scrollbar border border-zinc-800/60 rounded-2xl">
                <table className="w-full text-left font-mono text-xs divide-y divide-zinc-800">
                  <thead className="bg-zinc-950 text-zinc-400 sticky top-0 z-10 text-[11px]">
                    <tr>
                      <th className="p-3">i</th>
                      {method === "bisection" && (
                        <>
                          <th className="p-3">a (Inf)</th>
                          <th className="p-3">b (Sup)</th>
                        </>
                      )}
                      {method === "secant" && (
                        <>
                          <th className="p-3">x_{"{i-1}"}</th>
                          <th className="p-3">x_i</th>
                        </>
                      )}
                      <th className="p-3 text-sky-400 font-bold">x* (Aprox)</th>
                      <th className="p-3">f(x*)</th>
                      <th className="p-3 text-right text-amber-400 font-bold">Error εa (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40 bg-zinc-900/20 text-zinc-300 text-[11px]">
                    {calculation.tableRows.map((row) => (
                      <tr key={row.iter} className="hover:bg-zinc-900/40 transition-colors">
                        <td className="p-3 text-zinc-500 font-bold">#{row.iter}</td>
                        {method === "bisection" && (
                          <>
                            <td className="p-3 text-zinc-400">{row.colA}</td>
                            <td className="p-3 text-zinc-400">{row.colB}</td>
                          </>
                        )}
                        {method === "secant" && (
                          <>
                            <td className="p-3 text-zinc-400">{row.colA}</td>
                            <td className="p-3 text-zinc-400">{row.colB}</td>
                          </>
                        )}
                        <td className="p-3 font-mono font-bold text-emerald-400">{row.approxX}</td>
                        <td className="p-3 font-mono text-zinc-300">{row.fVal}</td>
                        <td className="p-3 text-right font-mono text-amber-400">
                          {row.errorRel !== null ? `${row.errorRel}%` : "--"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Panel Derecho: Historial */}
            <div className="lg:col-span-4 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <History size={15} className="text-zinc-400" /> Historial de Raíces
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
                    <p>Sin aproximaciones guardadas.</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Guarda raíces para auditar iteraciones.</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700 transition-all flex items-center justify-between text-xs"
                    >
                      <div className="truncate pr-2 font-mono text-zinc-300">
                        {item.expression}
                      </div>
                      <div className="font-mono font-bold text-emerald-400 shrink-0 text-[11px]">
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
                Procedimiento y Criterios de Convergencia
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                Función: {funcInput} | Método: {calculation.methodName}
              </p>
            </div>
            <div className="text-xs font-mono px-4 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-zinc-300 shadow-inner">
              Raíz: <strong className="text-emerald-400 text-sm font-serif">{calculation.root}</strong>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {calculation.steps.map((st, i) => (
              <div
                key={i}
                className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700/80 transition-all flex flex-col gap-2.5"
              >
                <span className="text-sm font-semibold text-zinc-200 font-mono">{st.stage}</span>
                <p className="text-xs text-zinc-300 font-sans leading-relaxed">{st.desc}</p>
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 font-mono text-xs text-emerald-400 text-center font-bold whitespace-pre-line">
                  {st.math}
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
              <BookOpen size={12} /> Análisis Numérico y Convergencia Algorítmica
            </div>
            <h3 className="text-2xl font-serif font-bold text-zinc-100">
              Métodos de Aproximación de Raíces de Ecuaciones No Lineales
            </h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-3xl">
              Dado que la mayoría de ecuaciones trascendentes y no lineales no admiten solución analítica cerrada (Teorema de Abel-Ruffini), los métodos numéricos aproximan la raíz mediante secuencias de iteración controladas por error relativo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                1. Bisección y Teorema de Bolzano
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Si f es continua y f(a)·f(b) &lt; 0, existe al menos una raíz en (a, b). Su convergencia es estrictamente lineal (gana 1 bit de precisión binaria por cada iteración: error se divide entre 2).
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                2. Newton-Raphson y Orden Cuadrático
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Convergencia de orden 2: el número de cifras decimales exactas se duplica en cada iteración: |e_{"{i+1}"}| ≈ C · |e_i|². Puede divergir si f'(x₀) ≈ 0 o en puntos de inflexión.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                3. Método de la Secante y Razón Áurea
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Aproxima la derivada mediante rectas secantes. Su orden de convergencia es la razón áurea φ ≈ 1.618, requiriendo solo una evaluación de función por ciclo.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                4. Criterio de Lipschitz en Punto Fijo
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Para que x = g(x) converja, la derivada de la función contractiva debe satisfacer estrictamente |g'(x)| &lt; 1 en el entorno de la raíz buscada.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE INFORMACIÓN */}
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
                  <Cpu size={15} className="text-amber-400" /> Órdenes de Convergencia
                </h4>
                <button onClick={() => setIsMethodInfoOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-100">
                  <X size={16} />
                </button>
              </div>
              <div className="text-xs text-zinc-400 mt-3 space-y-2 leading-relaxed font-sans">
                <p>• <strong>Bisección:</strong> Orden 1 (Lineal). Siempre converge si hay cambio de signo.</p>
                <p>• <strong>Newton-Raphson:</strong> Orden 2 (Cuadrático). El más veloz cerca de la raíz.</p>
                <p>• <strong>Secante:</strong> Orden 1.618 (Superlineal). No requiere calcular derivadas.</p>
                <p>• <strong>Punto Fijo:</strong> Orden 1 (Lineal). Requiere |g'(x)| &lt; 1.</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE AYUDA CON EJEMPLOS DE UN CLIC */}
      <AnimatePresence>
        {isHelpOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-3xl border border-zinc-800/80 bg-zinc-950/95 backdrop-blur-2xl rounded-3xl p-6 lg:p-8 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
                <div className="flex items-center gap-2">
                  <Target size={16} className="text-amber-400" />
                  <h3 className="text-base font-serif font-bold text-zinc-100">Catálogo de Raíces Numéricas</h3>
                </div>
                <button onClick={() => setIsHelpOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-100">
                  <X size={16} />
                </button>
              </div>

              <div className="mt-5 space-y-4 max-h-[65vh] overflow-y-auto pr-1.5 text-xs custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {MODULE_EXAMPLES.map((ex) => (
                    <button
                      key={ex.category}
                      onClick={() => {
                        setMethod(ex.method);
                        setFuncInput(ex.func);
                        setParam1(ex.p1);
                        if (ex.p2) setParam2(ex.p2);
                        setTolerance(ex.tol);
                        setIsHelpOpen(false);
                      }}
                      className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-left transition-all flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-[10px] font-mono text-amber-400/90 block font-semibold">{ex.category}</span>
                        <span className="font-mono text-zinc-200 text-xs block font-bold truncate">
                          {ex.func} ({ex.method.toUpperCase()})
                        </span>
                        <span className="text-[10px] text-zinc-500 block truncate">{ex.desc}</span>
                      </div>
                      <ChevronRight size={13} className="text-zinc-600 group-hover:text-zinc-200 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}