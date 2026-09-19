"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  HelpCircle,
  X,
  ChevronRight,
  Sliders,
  Table as TableIcon,
  RotateCcw,
  Sparkles,
  FunctionSquare,
  Terminal,
  Activity,
  Maximize2,
  Layers,
  CircleDot
} from "lucide-react";
import { useAIContext } from "@/lib/context/ai-context";
import {
  fetchUserHistory,
  saveUserCalculation,
  deleteUserHistory,
  type HistoryItem,
} from "@/lib/supabase/history";
import MathGrapher, {
  type GraphPoint,
  type GuideLine,
  type LegendItem,
} from "@/components/shared/math-grapher";

// --- Evaluador Matemático Robusto con Soporte de Parámetros y Operaciones Compuestas ---
function evaluateMath(expr: string, x: number, a = 1, b = 1, c = 0): number {
  try {
    let s = expr.toLowerCase().replace(/\s+/g, "");
    if (!s) return NaN;

    if (s === "gauss" || s.includes("campana")) {
      s = "exp(-x^2)";
    }

    // Separación de multiplicaciones implícitas
    s = s.replace(/([0-9])([xabc(]|sin|cos|tan|exp|ln|sqrt|abs)/g, "$1*$2");
    s = s.replace(/([abc])([x(]|sin|cos|tan|exp|ln|sqrt|abs)/g, "$1*$2");
    s = s.replace(/([x])([abc(]|sin|cos|tan|exp|ln|sqrt|abs)/g, "$1*$2");
    s = s.replace(/\)([\d\w(]|sin|cos|tan|exp|ln|sqrt|abs)/g, ")*$1");
    s = s.replace(/e\s*\^\s*\(([^()]+)\)/g, "exp($1)");
    s = s.replace(/e\s*\^\s*([a-zA-Z0-9_.]+)/g, "exp($1)");
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
    s = s.replace(/log10/g, "Math.log10");
    s = s.replace(/exp/g, "Math.exp");
    s = s.replace(/pi/g, "Math.PI");
    s = s.replace(/e\b/g, "Math.E");

    // eslint-disable-next-line no-new-func
    const fn = new Function("x", "a", "b", "c", `"use strict"; return (${s});`);
    const val = fn(x, a, b, c);
    return typeof val === "number" && !isNaN(val) && isFinite(val) ? val : NaN;
  } catch {
    return NaN;
  }
}

// Inyector numérico para MathGrapher (reemplaza variables a, b, c por constantes)
function prepareExpressionForGrapher(expr: string, a: number, b: number, c: number): string {
  if (!expr.trim()) return "";
  let s = expr.replace(/([0-9])([abc])/g, "$1*$2");
  s = s.replace(/([abc])([x])/g, "$1*$2");
  s = s.replace(/\ba\b/g, `(${a})`);
  s = s.replace(/\bb\b/g, `(${b})`);
  s = s.replace(/\bc\b/g, `(${c})`);
  return s;
}

interface ModuleExample {
  category: string;
  eq: string;
  desc: string;
}

const MODULE_EXAMPLES: ModuleExample[] = [
  { category: "Campana de Gauss", eq: "exp(-x^2)", desc: "Distribución normal estándar simétrica par" },
  { category: "Cúbica con Extremos", eq: "x^3 - 3*x", desc: "Máximo y mínimo local con puntos de inflexión" },
  { category: "Parábola Parametrizada", eq: "a*x^2 + b*x + c", desc: "Usa los deslizadores a, b, c para variar su apertura y vértice" },
  { category: "Trigonométrica Senoidal", eq: "a * sin(b * x)", desc: "Ajusta amplitud (a) y frecuencia angular (b)" },
  { category: "Racional con Asíntota", eq: "1 / (x - 2)", desc: "Discontinuidad y asíntota vertical en x = 2" },
  { category: "Amortiguación Física", eq: "exp(-0.2*x) * cos(2*x)", desc: "Oscilador armónico amortiguado en ingeniería" },
  { category: "Logaritmo Natural", eq: "ln(x)", desc: "Dominio restringido x > 0 y crecimiento monotónico" },
  { category: "Raíz Cuadrada", eq: "sqrt(x + 4)", desc: "Dominio x ≥ -4 con rama real principal" },
];

export default function FunctionsView({
  viewMode,
  initialExpression = "",
}: {
  viewMode: "calc" | "steps" | "theory";
  initialExpression?: string;
}) {
  // Estado de las funciones
  const [funcInput, setFuncInput] = useState<string>(initialExpression || "exp(-x^2)");
  const [compareFunc, setCompareFunc] = useState<string>("");
  const [showCompare, setShowCompare] = useState<boolean>(false);

  // Moduladores de Parámetros (a, b, c)
  const [paramA, setParamA] = useState<number>(1);
  const [paramB, setParamB] = useState<number>(1);
  const [paramC, setParamC] = useState<number>(0);
  const [showSliders, setShowSliders] = useState<boolean>(false);

  // Moduladores de Tangente e Integración
  const [tangentX, setTangentX] = useState<number>(0);
  const [showTangent, setShowTangent] = useState<boolean>(true);
  const [integralA, setIntegralA] = useState<number>(-1.5);
  const [integralB, setIntegralB] = useState<number>(1.5);
  const [showIntegral, setShowIntegral] = useState<boolean>(true);

  // Moduladores de Visibilidad de Puntos
  const [showRoots, setShowRoots] = useState<boolean>(true);
  const [showExtremes, setShowExtremes] = useState<boolean>(true);

  // Moduladores de Tabla
  const [activeTab, setActiveTab] = useState<"graph" | "table">("graph");
  const [tableMin, setTableMin] = useState<number>(-3);
  const [tableMax, setTableMax] = useState<number>(3);
  const [tableStep, setTableStep] = useState<number>(0.5);

  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [, setHistory] = useState<HistoryItem[]>([]);

  const { setAIContext, injectedExpression, clearInjectedExpression } = useAIContext();

  // ---------------------------------------------------------------------------
  // ANÁLISIS NUMÉRICO DE ALTA RESOLUCIÓN
  // ---------------------------------------------------------------------------
  const analysis = useMemo(() => {
    const f = (x: number) => evaluateMath(funcInput, x, paramA, paramB, paramC);

    const yIntercept = f(0);
    const yAtTangent = f(tangentX);

    // Detección de raíces por bisección
    const roots: number[] = [];
    const step = 0.08;
    let prev = f(-15);
    for (let x = -15; x <= 15; x += step) {
      const curr = f(x);
      if (!isNaN(prev) && !isNaN(curr)) {
        if (prev * curr <= 0) {
          let left = x - step;
          let right = x;
          for (let k = 0; k < 12; k++) {
            const mid = (left + right) / 2;
            if (f(left) * f(mid) <= 0) right = mid;
            else left = mid;
          }
          const rootVal = Number(((left + right) / 2).toFixed(3));
          if (!roots.some((r) => Math.abs(r - rootVal) < 0.05)) {
            roots.push(rootVal);
          }
        }
      }
      prev = curr;
    }

    // Detección de máximos y mínimos (cambio de signo en derivada numérica)
    const extremes: { x: number; y: number; type: "Máximo" | "Mínimo" }[] = [];
    const h = 0.001;
    const df = (x: number) => (f(x + h) - f(x - h)) / (2 * h);

    let prevD = df(-10);
    for (let x = -10; x <= 10; x += 0.08) {
      const currD = df(x);
      if (!isNaN(prevD) && !isNaN(currD) && prevD * currD < 0) {
        const rootX = Number(x.toFixed(3));
        const valY = Number(f(rootX).toFixed(3));
        const type = prevD > 0 ? "Máximo" : "Mínimo";
        extremes.push({ x: rootX, y: valY, type });
      }
      prevD = currD;
    }

    // Análisis de simetría
    const t1 = f(2);
    const t2 = f(-2);
    let symmetry = "Sin simetría";
    if (!isNaN(t1) && !isNaN(t2)) {
      if (Math.abs(t1 - t2) < 1e-4) symmetry = "Par: f(-x) = f(x) (Simetría Eje Y)";
      else if (Math.abs(t1 + t2) < 1e-4) symmetry = "Impar: f(-x) = -f(x) (Simetría Origen)";
    }

    const slopeAtX0 = df(tangentX);

    // Integración numérica mediante regla del trapecio
    let integralVal = 0;
    const nTraps = 150;
    const lowLim = Math.min(integralA, integralB);
    const highLim = Math.max(integralA, integralB);
    const dInt = (highLim - lowLim) / nTraps;

    for (let i = 0; i < nTraps; i++) {
      const xA = lowLim + i * dInt;
      const xB = xA + dInt;
      const yA = f(xA);
      const yB = f(xB);
      if (!isNaN(yA) && !isNaN(yB)) {
        integralVal += ((yA + yB) / 2) * dInt;
      }
    }

    if (integralA > integralB) integralVal = -integralVal;

    return {
      yIntercept: !isNaN(yIntercept) ? Number(yIntercept.toFixed(3)) : null,
      yAtTangent: !isNaN(yAtTangent) ? Number(yAtTangent.toFixed(3)) : null,
      roots,
      extremes,
      symmetry,
      slopeAtX0: !isNaN(slopeAtX0) ? Number(slopeAtX0.toFixed(3)) : null,
      integralVal: Number(integralVal.toFixed(3)),
    };
  }, [funcInput, paramA, paramB, paramC, tangentX, integralA, integralB]);

  // ---------------------------------------------------------------------------
  // ELEMENTOS PINTADOS EN MathGrapher (PUNTOS, GUÍAS Y LEYENDA)
  // ---------------------------------------------------------------------------
  const grapherPoints = useMemo<GraphPoint[]>(() => {
    const pts: GraphPoint[] = [];

    // 1. Raíces
    if (showRoots) {
      analysis.roots.forEach((r) => {
        pts.push({
          x: r,
          y: 0,
          label: `Raíz (${r}, 0)`,
          color: "#10b981",
          type: "solid",
        });
      });
    }

    // 2. Extremos Relativos
    if (showExtremes) {
      analysis.extremes.forEach((e) => {
        pts.push({
          x: e.x,
          y: e.y,
          label: `${e.type} (${e.x}, ${e.y})`,
          color: "#06b6d4",
          type: "solid",
        });
      });
    }

    // 3. Punto de Tangencia P0(x0, y0)
    if (showTangent && analysis.yAtTangent !== null) {
      pts.push({
        x: tangentX,
        y: analysis.yAtTangent,
        label: `P₀ (${tangentX}, ${analysis.yAtTangent})`,
        color: "#f59e0b",
        type: "solid",
      });
    }

    return pts;
  }, [analysis, showRoots, showExtremes, showTangent, tangentX]);

  // Líneas Guía Verticales en el Canvas
  const grapherGuideLines = useMemo<GuideLine[]>(() => {
    const lines: GuideLine[] = [];

    // Guía del punto de tangencia
    if (showTangent) {
      lines.push({
        type: "vertical",
        value: tangentX,
        color: "rgba(245, 158, 11, 0.45)",
      });
    }

    // Guías de los límites de integración
    if (showIntegral) {
      lines.push(
        {
          type: "vertical",
          value: integralA,
          color: "rgba(16, 185, 129, 0.4)",
        },
        {
          type: "vertical",
          value: integralB,
          color: "rgba(16, 185, 129, 0.4)",
        }
      );
    }

    return lines;
  }, [showTangent, tangentX, showIntegral, integralA, integralB]);

  const grapherLegend = useMemo<LegendItem[]>(() => {
    const items: LegendItem[] = [
      { label: `f(x) = ${funcInput}`, color: "#38bdf8", shape: "line" },
    ];
    if (showCompare && compareFunc.trim()) {
      items.push({ label: `g(x) = ${compareFunc}`, color: "#f43f5e", shape: "line" });
    }
    if (showTangent && analysis.slopeAtX0 !== null) {
      items.push({ label: `Tangente (m = ${analysis.slopeAtX0})`, color: "#f59e0b", shape: "line" });
    }
    if (showIntegral) {
      items.push({ label: `Área [${integralA}, ${integralB}] = ${analysis.integralVal} u²`, color: "#34d399", shape: "area" });
    }
    if (showRoots && analysis.roots.length > 0) {
      items.push({ label: `Raíces (${analysis.roots.length})`, color: "#10b981", shape: "dot" });
    }
    if (showExtremes && analysis.extremes.length > 0) {
      items.push({ label: `Extremos (${analysis.extremes.length})`, color: "#06b6d4", shape: "dot" });
    }
    return items;
  }, [funcInput, compareFunc, showCompare, showTangent, analysis, showIntegral, integralA, integralB, showRoots, showExtremes]);

  // Expresiones evaluadas con parámetros resueltos
  const grapherMainExpression = useMemo(() => {
    return prepareExpressionForGrapher(funcInput, paramA, paramB, paramC);
  }, [funcInput, paramA, paramB, paramC]);

  const grapherCompareExpression = useMemo(() => {
    return prepareExpressionForGrapher(compareFunc, paramA, paramB, paramC);
  }, [compareFunc, paramA, paramB, paramC]);

  // Sincronización con el canal global ReSolve AI
  useEffect(() => {
    setAIContext({
      module: "Matemáticas I",
      subtopic: "Graficador y Funciones",
      expression: `f(x) = ${funcInput}`,
      result: `f(0) = ${analysis.yIntercept}, Simetría: ${analysis.symmetry}, Extremos: ${analysis.extremes.length}`,
      details: `Pendiente en x₀=${tangentX}: m=${analysis.slopeAtX0}. Integral [${integralA}, ${integralB}] = ${analysis.integralVal} u²`,
    });
  }, [funcInput, analysis, tangentX, integralA, integralB, setAIContext]);

  useEffect(() => {
    if (injectedExpression) {
      setFuncInput(injectedExpression);
      clearInjectedExpression();
    }
  }, [injectedExpression, clearInjectedExpression]);

  useEffect(() => {
    fetchUserHistory("mat1", "funciones").then((data) => setHistory(data));
  }, []);

  const saveCalculation = async () => {
    if (!funcInput.trim()) return;
    const summary = `f(0)=${analysis.yIntercept} | Simetría: ${analysis.symmetry} | Extremos: ${analysis.extremes.length}`;
    await saveUserCalculation("mat1", "funciones", `f(x) = ${funcInput}`, summary);
    const refreshed = await fetchUserHistory("mat1", "funciones");
    setHistory(refreshed);
  };

  return (
    <div className="h-full flex flex-col gap-6 min-h-0 relative">
      {viewMode === "calc" && (
        <div className="flex-1 flex flex-col gap-6 min-h-0">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-1 min-h-0">
            {/* CANVAS GRAFICADOR CENTRAL */}
            <div className="xl:col-span-7 min-h-[460px] flex flex-col">
              <MathGrapher
                expression={grapherMainExpression}
                secondaryExpression={showCompare && compareFunc.trim() ? grapherCompareExpression : undefined}
                points={grapherPoints}
                guideLines={grapherGuideLines}
                shadedArea={
                  showIntegral
                    ? {
                        from: Math.min(integralA, integralB),
                        to: Math.max(integralA, integralB),
                        color: "rgba(16, 185, 129, 0.22)",
                      }
                    : undefined
                }
                tangent={
                  showTangent && analysis.slopeAtX0 !== null && analysis.yAtTangent !== null
                    ? {
                        x0: tangentX,
                        slope: analysis.slopeAtX0,
                      }
                    : undefined
                }
                legend={grapherLegend}
                initialScale={65}
                height="h-full"
              />
            </div>

            {/* CONSOLA DE MODULADORES */}
            <div className="xl:col-span-5 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 flex flex-col justify-between min-h-0 shadow-2xl overflow-y-auto custom-scrollbar space-y-5">
              <div className="space-y-4">
                {/* Cabecera */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-1.5">
                    <FunctionSquare size={14} className="text-zinc-500" />
                    Moduladores de Función
                  </span>

                  <button
                    type="button"
                    onClick={() => setIsHelpOpen(true)}
                    className="px-2.5 py-1 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-800 text-[11px] font-mono text-zinc-300 transition-colors flex items-center gap-1"
                  >
                    <HelpCircle size={13} className="text-amber-400" /> Catálogo
                  </button>
                </div>

                {/* Entrada Principal f(x) */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                    <span>Función Principal f(x):</span>
                    <span className="text-[10px] text-sky-400 font-bold">Trazo Azul</span>
                  </label>
                  <input
                    type="text"
                    value={funcInput}
                    onChange={(e) => setFuncInput(e.target.value)}
                    placeholder="Ej: exp(-x^2),  x^3 - 3*x,  a*x^2 + b*x + c"
                    className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-2xl px-4 py-2.5 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-sky-500/60 transition-all shadow-inner"
                  />
                </div>

                {/* Entrada Comparativa g(x) */}
                {showCompare && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                      <span>Función Comparativa g(x):</span>
                      <span className="text-[10px] text-rose-400 font-bold">Trazo Rojo</span>
                    </label>
                    <input
                      type="text"
                      value={compareFunc}
                      onChange={(e) => setCompareFunc(e.target.value)}
                      placeholder="Ej: 2*x - 1,  cos(x)"
                      className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-2xl px-4 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-rose-500/60 transition-all shadow-inner"
                    />
                  </div>
                )}

                {/* Barra de Activadores / Moduladores Principales */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowSliders(!showSliders)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-mono transition-colors flex items-center gap-1.5 ${
                      showSliders
                        ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                        : "bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                    }`}
                  >
                    <Sliders size={13} /> Parámetros ({paramA}, {paramB}, {paramC})
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCompare(!showCompare)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-mono transition-colors flex items-center gap-1.5 ${
                      showCompare
                        ? "bg-rose-500/20 border-rose-500/50 text-rose-300"
                        : "bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                    }`}
                  >
                    <Layers size={13} /> Comparar g(x)
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowRoots(!showRoots)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-mono transition-colors flex items-center gap-1.5 ${
                      showRoots
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                        : "bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                    }`}
                  >
                    <CircleDot size={13} /> Raíces
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowExtremes(!showExtremes)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-mono transition-colors flex items-center gap-1.5 ${
                      showExtremes
                        ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300"
                        : "bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                    }`}
                  >
                    <Activity size={13} /> Extremos
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab(activeTab === "graph" ? "table" : "graph")}
                    className="px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 text-xs font-mono transition-colors flex items-center gap-1.5 ml-auto"
                  >
                    <TableIcon size={13} /> {activeTab === "graph" ? "Tabla" : "Análisis"}
                  </button>
                </div>

                {/* MODULADOR: Parámetros Dinámicos (a, b, c) */}
                {showSliders && (
                  <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 space-y-3 shadow-inner">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                      <span className="text-[11px] font-mono text-amber-400 font-semibold uppercase tracking-wider">
                        Controles Paramétricos
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setParamA(1);
                          setParamB(1);
                          setParamC(0);
                        }}
                        className="text-[10px] font-mono text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
                      >
                        <RotateCcw size={11} /> Reiniciar
                      </button>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                        <span>Parámetro a (Escala/Apertura):</span>
                        <strong className="text-amber-400">{paramA}</strong>
                      </div>
                      <input
                        type="range"
                        min="-5"
                        max="5"
                        step="0.1"
                        value={paramA}
                        onChange={(e) => setParamA(parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                        <span>Parámetro b (Frecuencia/Inclinación):</span>
                        <strong className="text-amber-400">{paramB}</strong>
                      </div>
                      <input
                        type="range"
                        min="-5"
                        max="5"
                        step="0.1"
                        value={paramB}
                        onChange={(e) => setParamB(parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                        <span>Parámetro c (Desplazamiento Vertical):</span>
                        <strong className="text-amber-400">{paramC}</strong>
                      </div>
                      <input
                        type="range"
                        min="-10"
                        max="10"
                        step="0.5"
                        value={paramC}
                        onChange={(e) => setParamC(parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                )}

                {/* MODULADORES: Tangente e Integral */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {/* Modulador Tangente */}
                  <div className="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setShowTangent(!showTangent)}
                        className={`text-[11px] font-mono flex items-center gap-1.5 font-semibold ${
                          showTangent ? "text-amber-400" : "text-zinc-500"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${showTangent ? "bg-amber-400" : "bg-zinc-600"}`} />
                        Tangente en x₀
                      </button>
                      <strong className="text-[11px] font-mono text-amber-300">{tangentX}</strong>
                    </div>
                    <input
                      type="range"
                      min="-5"
                      max="5"
                      step="0.1"
                      value={tangentX}
                      disabled={!showTangent}
                      onChange={(e) => setTangentX(parseFloat(e.target.value))}
                      className="w-full disabled:opacity-40"
                    />
                    <div className="text-[10px] font-mono text-zinc-500 truncate flex justify-between">
                      <span>m = f'({tangentX})</span>
                      <strong className="text-zinc-200">{analysis.slopeAtX0 ?? "Indef."}</strong>
                    </div>
                  </div>

                  {/* Modulador Integral */}
                  <div className="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setShowIntegral(!showIntegral)}
                        className={`text-[11px] font-mono flex items-center gap-1.5 font-semibold ${
                          showIntegral ? "text-emerald-400" : "text-zinc-500"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${showIntegral ? "bg-emerald-400" : "bg-zinc-600"}`} />
                        Integral [a, b]
                      </button>
                      <span className="text-[10px] font-mono text-emerald-300 font-bold">
                        {analysis.integralVal} u²
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-1/2">
                        <label className="text-[9px] font-mono text-zinc-500 block mb-0.5">Límite a:</label>
                        <input
                          type="number"
                          step="0.5"
                          value={integralA}
                          onChange={(e) => setIntegralA(parseFloat(e.target.value) || 0)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-center font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="w-1/2">
                        <label className="text-[9px] font-mono text-zinc-500 block mb-0.5">Límite b:</label>
                        <input
                          type="number"
                          step="0.5"
                          value={integralB}
                          onChange={(e) => setIntegralB(parseFloat(e.target.value) || 0)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-center font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* VISTA SECUNDARIA: ANÁLISIS CUALITATIVO O TABLA DINÁMICA */}
                {activeTab === "graph" ? (
                  <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 space-y-2.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block font-semibold">
                      Resumen del Comportamiento Analítico
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800/60">
                        <span className="text-[10px] text-zinc-500 block">Corte Eje Y (f(0))</span>
                        <strong className="text-zinc-200">
                          {analysis.yIntercept !== null ? analysis.yIntercept : "Indefinido"}
                        </strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800/60">
                        <span className="text-[10px] text-zinc-500 block">Simetría Funcional</span>
                        <strong className="text-zinc-200 truncate block">{analysis.symmetry}</strong>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800/60 text-xs font-mono">
                      <span className="text-[10px] text-zinc-500 block">
                        Puntos Críticos Detectados ({analysis.extremes.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {analysis.extremes.length > 0 ? (
                          analysis.extremes.map((ext, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 bg-cyan-950/40 border border-cyan-800/60 text-cyan-300 rounded text-[11px]"
                            >
                              {ext.type}: ({ext.x}, {ext.y})
                            </span>
                          ))
                        ) : (
                          <span className="text-zinc-500 text-[11px]">
                            Curva monótona sin puntos críticos locales
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 space-y-3">
                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 border-b border-zinc-800 pb-2">
                      <div className="flex gap-2">
                        <label className="flex items-center gap-1">
                          <span>Min:</span>
                          <input
                            type="number"
                            value={tableMin}
                            onChange={(e) => setTableMin(parseFloat(e.target.value) || 0)}
                            className="w-14 bg-zinc-900 border border-zinc-800 rounded px-1 text-center text-zinc-200"
                          />
                        </label>
                        <label className="flex items-center gap-1">
                          <span>Max:</span>
                          <input
                            type="number"
                            value={tableMax}
                            onChange={(e) => setTableMax(parseFloat(e.target.value) || 0)}
                            className="w-14 bg-zinc-900 border border-zinc-800 rounded px-1 text-center text-zinc-200"
                          />
                        </label>
                      </div>
                      <label className="flex items-center gap-1">
                        <span>Paso:</span>
                        <input
                          type="number"
                          step="0.1"
                          value={tableStep}
                          onChange={(e) => setTableStep(Math.max(0.05, parseFloat(e.target.value) || 0.5))}
                          className="w-14 bg-zinc-900 border border-zinc-800 rounded px-1 text-center text-zinc-200"
                        />
                      </label>
                    </div>

                    <div className="max-h-48 overflow-y-auto custom-scrollbar border border-zinc-800/60 rounded-xl">
                      <table className="w-full text-left font-mono text-xs divide-y divide-zinc-800">
                        <thead className="bg-zinc-900/80 text-zinc-400 sticky top-0">
                          <tr>
                            <th className="p-2">x</th>
                            <th className="p-2">f(x)</th>
                            <th className="p-2">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                          {Array.from({
                            length: Math.min(60, Math.floor((tableMax - tableMin) / tableStep) + 1),
                          }).map((_, i) => {
                            const xVal = Number((tableMin + i * tableStep).toFixed(2));
                            const yVal = evaluateMath(funcInput, xVal, paramA, paramB, paramC);
                            const isRoot = !isNaN(yVal) && Math.abs(yVal) < 0.05;
                            return (
                              <tr key={i} className="hover:bg-zinc-900/30">
                                <td className="p-2 text-zinc-400">{xVal}</td>
                                <td className="p-2 font-bold text-sky-400">
                                  {!isNaN(yVal) ? Number(yVal.toFixed(4)) : "Indefinido"}
                                </td>
                                <td className="p-2 text-[10px]">
                                  {isRoot ? (
                                    <span className="text-emerald-400 font-bold">Raíz aprox</span>
                                  ) : (
                                    <span className="text-zinc-600">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Botón de Guardado */}
              <div className="pt-4 border-t border-zinc-800/60 flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-500">Persistencia ReSolve</span>
                <button
                  type="button"
                  onClick={saveCalculation}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-semibold text-xs rounded-xl shadow-md transition-all active:scale-95"
                >
                  Guardar Función
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VISTA DE PROCEDIMIENTO PASO A PASO */}
      {viewMode === "steps" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-5 shrink-0">
            <div>
              <h3 className="text-xl font-serif font-bold text-zinc-100">
                Procedimiento y Deducción Analítica
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                f(x) = <span className="text-zinc-200 font-semibold">{funcInput}</span>
              </p>
            </div>
            <div className="text-xs font-mono px-4 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-zinc-300">
              Simetría: <strong className="text-emerald-400">{analysis.symmetry}</strong>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 flex flex-col gap-2">
              <span className="text-xs font-mono font-semibold text-zinc-200">
                1. Intersección con el Eje Vertical (Ordenada al Origen)
              </span>
              <p className="text-xs text-zinc-400">
                Evaluamos la función en el punto neutro $x = 0$ para encontrar el cruce con el eje $Y$:
              </p>
              <div className="p-3 rounded-xl bg-zinc-950 font-mono text-xs text-emerald-400 text-center font-bold">
                f(0) = {analysis.yIntercept !== null ? analysis.yIntercept : "No definido en el dominio real"}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 flex flex-col gap-2">
              <span className="text-xs font-mono font-semibold text-zinc-200">
                2. Detección de Raíces y Ceros de la Función
              </span>
              <p className="text-xs text-zinc-400">
                Soluciones de la ecuación $f(x) = 0$ aproximadas mediante métodos numéricos de bisección:
              </p>
              <div className="p-3 rounded-xl bg-zinc-950 font-mono text-xs text-emerald-400 text-center font-bold">
                {analysis.roots.length > 0
                  ? analysis.roots.map((r) => `x = ${r}`).join("  |  ")
                  : "No se identificaron cruces por cero en el rango [-15, 15]"}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 flex flex-col gap-2">
              <span className="text-xs font-mono font-semibold text-zinc-200">
                3. Puntos Críticos y Extremos Relativos
              </span>
              <p className="text-xs text-zinc-400">
                Ubicaciones donde la primera derivada se anula ($f'(x) = 0$):
              </p>
              <div className="p-3 rounded-xl bg-zinc-950 font-mono text-xs text-cyan-400 text-center font-bold">
                {analysis.extremes.length > 0
                  ? analysis.extremes.map((e) => `${e.type} en (${e.x}, ${e.y})`).join("  |  ")
                  : "Curva monótona sin extremos relativos"}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 flex flex-col gap-2">
              <span className="text-xs font-mono font-semibold text-zinc-200">
                4. Ecuación de la Recta Tangente en x₀ = {tangentX}
              </span>
              <p className="text-xs text-zinc-400">
                Pendiente instantánea $m = f'(x_0)$ y modelo punto-pendiente $y - y_0 = m(x - x_0)$:
              </p>
              <div className="p-3 rounded-xl bg-zinc-950 font-mono text-xs text-amber-400 text-center font-bold">
                m = {analysis.slopeAtX0}  ⇒  y = {analysis.slopeAtX0}·(x - {tangentX}) + {analysis.yAtTangent}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 flex flex-col gap-2">
              <span className="text-xs font-mono font-semibold text-zinc-200">
                5. Integración Definida y Área de Riemann
              </span>
              <p className="text-xs text-zinc-400">
                Aproximación de la integral definida en el intervalo [{integralA}, {integralB}]:
              </p>
              <div className="p-3 rounded-xl bg-zinc-950 font-mono text-xs text-emerald-400 text-center font-bold">
                ∫ f(x) dx ≈ {analysis.integralVal} u²
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VISTA DE TEORÍA Y FUNDAMENTOS */}
      {viewMode === "theory" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto shadow-xl shadow-black/20 custom-scrollbar">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800/80 bg-zinc-900/60 text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 mb-3">
              Fundamentos de Análisis Funcional
            </div>
            <h3 className="text-2xl font-serif font-bold text-zinc-100">
              Mapeos, Derivadas y Comportamiento de Funciones
            </h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-3xl">
              Una función f: X → Y define una correspondencia unívoca entre variables. Las propiedades geométricas como las asíntotas, la concavidad y la tasa instantánea de cambio son indispensables para optimizar modelos de redes neuronales y simulaciones físicas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 space-y-2">
              <strong className="text-xs text-zinc-200 block font-mono uppercase tracking-wider">
                1. Derivada y Pendiente Tangente
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                La derivada f'(x₀) representa el límite del cociente incremental. Geométricamente, describe la pendiente de la recta que roza la curva en dicho punto.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 space-y-2">
              <strong className="text-xs text-zinc-200 block font-mono uppercase tracking-wider">
                2. Integral de Riemann
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                La integral definida representa la acumulación continua de un área neta bajo la curva. Si f(x) ≥ 0, la integral cuantifica exactamente la superficie acotada entre los límites [a, b].
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GUÍA / CATÁLOGO DE FUNCIONES */}
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
              <div className="pointer-events-none absolute -top-20 -right-20 w-60 h-60 bg-sky-500/10 rounded-full blur-3xl" />

              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 relative z-10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                    <FunctionSquare size={16} />
                  </div>
                  <div>
                    <h3 className="text-base font-serif font-bold text-zinc-100">
                      Catálogo y Operadores Matemáticos
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Haz clic en cualquier función modelo para cargarla en el graficador
                    </p>
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
                    <Terminal size={13} className="text-zinc-400" /> Sintaxis Dinámica
                  </h4>
                  <p className="text-zinc-400 leading-relaxed">
                    Puedes ingresar expresiones como <code className="text-zinc-200">exp(-x^2)</code>, <code className="text-zinc-200">a*x^2 + b*x + c</code>, <code className="text-zinc-200">sin(b*x)</code>, <code className="text-zinc-200">sqrt(x)</code> o <code className="text-zinc-200">1/(x-2)</code>. Los parámetros <code className="text-amber-400 font-bold">a, b, c</code> reaccionan a los deslizadores.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
                  <h4 className="font-mono uppercase tracking-wider text-zinc-300 font-semibold mb-2 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-sky-400" /> Ejemplos de Estudio Universitario
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {MODULE_EXAMPLES.map((ex) => (
                      <button
                        key={ex.eq}
                        onClick={() => {
                          setFuncInput(ex.eq);
                          setIsHelpOpen(false);
                        }}
                        className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-left transition-all flex items-center justify-between group shadow-sm"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="text-[10px] font-mono text-sky-400 block font-semibold">
                            {ex.category}
                          </span>
                          <span className="font-mono text-zinc-200 text-[11px] block truncate">
                            {ex.eq}
                          </span>
                          <span className="text-[10px] text-zinc-500 block truncate">
                            {ex.desc}
                          </span>
                        </div>
                        <ChevronRight size={13} className="text-zinc-600 group-hover:text-zinc-200 shrink-0 transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}