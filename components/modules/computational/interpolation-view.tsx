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
  Plus,
  Table as TableIcon,
  Layers,
  Activity,
  Zap,
  Target
} from "lucide-react";
import MathGrapher from "@/components/shared/math-grapher";
import { useAIContext } from "@/lib/context/ai-context";
import {
  fetchUserHistory,
  saveUserCalculation,
  deleteUserHistory,
  type HistoryItem,
} from "@/lib/supabase/history";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

// -----------------------------------------------------------------------------
// TIPOS Y CATÁLOGO DE EJEMPLOS A NIVEL SUPERIOR TS
// -----------------------------------------------------------------------------
export type InterpolationMethod = "lagrange" | "newton";

export interface DataPoint {
  id: string;
  x: number;
  y: number;
}

interface ModuleExample {
  category: string;
  method: InterpolationMethod;
  points: { x: number; y: number }[];
  targetX: string;
  desc: string;
}

const MODULE_EXAMPLES: ModuleExample[] = [
  {
    category: "Lagrange Cuadrático (3 Puntos)",
    method: "lagrange",
    points: [{ x: 1, y: 2 }, { x: 2, y: 3 }, { x: 4, y: 11 }],
    targetX: "3",
    desc: "Ajuste polinómico exacto de grado 2 pasando por tres puntos dados.",
  },
  {
    category: "Diferencias Divididas de Newton (Cúbica)",
    method: "newton",
    points: [{ x: 1, y: 1 }, { x: 2, y: 8 }, { x: 3, y: 27 }, { x: 4, y: 64 }],
    targetX: "2.5",
    desc: "Reconstrucción exacta de la función cúbica y = x³ mediante tabla de diferencias.",
  },
  {
    category: "Sensores IoT de Temperatura",
    method: "lagrange",
    points: [{ x: 0, y: 18 }, { x: 4, y: 22 }, { x: 8, y: 29 }, { x: 12, y: 25 }],
    targetX: "6",
    desc: "Estimación térmica intermedia en el tiempo t = 6 horas.",
  },
  {
    category: "Trayectoria Física en Balística",
    method: "newton",
    points: [{ x: 0, y: 0 }, { x: 10, y: 40 }, { x: 20, y: 60 }, { x: 30, y: 60 }],
    targetX: "15",
    desc: "Interpolación de altura de un proyectil a partir de telemetría de radar.",
  },
  {
    category: "Fenómeno de Runge (Demostración)",
    method: "lagrange",
    points: [{ x: -2, y: 0.05 }, { x: -1, y: 0.5 }, { x: 0, y: 1 }, { x: 1, y: 0.5 }, { x: 2, y: 0.05 }],
    targetX: "1.5",
    desc: "Aproximación de 1/(1+25x²) que muestra oscilaciones espurias en los extremos.",
  },
];

// Algoritmo para multiplicar polinomios P(x) * Q(x)
function polyMultiply(p1: number[], p2: number[]): number[] {
  const result = new Array(p1.length + p2.length - 1).fill(0);
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      result[i + j] += p1[i] * p2[j];
    }
  }
  return result;
}

// Formateador de coeficientes a string f(x)
function formatExpandedPoly(coeffs: number[]): string {
  // coeffs[0] es término independiente, coeffs[k] es x^k
  const terms: string[] = [];
  const degree = coeffs.length - 1;

  for (let i = degree; i >= 0; i--) {
    const c = Number(coeffs[i].toFixed(4));
    if (Math.abs(c) < 1e-5) continue;

    const sign = c > 0 ? (terms.length > 0 ? "+ " : "") : "- ";
    const absVal = Math.abs(c);
    const coeffStr = absVal === 1 && i > 0 ? "" : absVal.toString();

    if (i === 0) terms.push(`${sign}${absVal}`);
    else if (i === 1) terms.push(`${sign}${coeffStr}x`);
    else terms.push(`${sign}${coeffStr}x^${i}`);
  }

  return terms.length > 0 ? terms.join(" ") : "0";
}

// Formateador para MathGrapher (sintaxis JS con *)
function formatGraphablePoly(coeffs: number[]): string {
  const terms: string[] = [];
  const degree = coeffs.length - 1;

  for (let i = degree; i >= 0; i--) {
    const c = Number(coeffs[i].toFixed(4));
    if (Math.abs(c) < 1e-5) continue;

    const sign = c > 0 ? (terms.length > 0 ? "+ " : "") : "- ";
    const absVal = Math.abs(c);

    if (i === 0) terms.push(`${sign}${absVal}`);
    else if (i === 1) terms.push(`${sign}${absVal}*x`);
    else terms.push(`${sign}${absVal}*x^${i}`);
  }

  return terms.length > 0 ? terms.join(" ") : "0";
}

export default function InterpolationView({
  viewMode,
  initialExpression = "",
}: {
  viewMode: "calc" | "steps" | "theory";
  initialExpression?: string;
}) {
  const [method, setMethod] = useState<InterpolationMethod>("lagrange");
  const [points, setPoints] = useState<DataPoint[]>([
    { id: "1", x: 1, y: 2 },
    { id: "2", x: 2, y: 3 },
    { id: "3", x: 4, y: 11 },
  ]);
  const [targetX, setTargetX] = useState<string>("3");

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMethodInfoOpen, setIsMethodInfoOpen] = useState(false);

  const { setAIContext, injectedExpression, clearInjectedExpression } = useAIContext();

  const handleAddPoint = () => {
    const lastX = points.length > 0 ? points[points.length - 1].x + 1 : 1;
    setPoints([...points, { id: String(Date.now()), x: lastX, y: 0 }]);
  };

  const handleRemovePoint = (id: string) => {
    if (points.length <= 2) return; // Mínimo 2 puntos para interpolar
    setPoints(points.filter((p) => p.id !== id));
  };

  const handleUpdatePoint = (id: string, field: "x" | "y", val: number) => {
    setPoints(
      points.map((p) => (p.id === id ? { ...p, [field]: isNaN(val) ? 0 : val } : p))
    );
  };

  // ---------------------------------------------------------------------------
  // MOTOR MATEMÁTICO DE INTERPOLACIÓN (LAGRANGE Y NEWTON)
  // ---------------------------------------------------------------------------
  const calculation = useMemo(() => {
    const pts = [...points].sort((a, b) => a.x - b.x);
    const n = pts.length;
    const xEval = parseFloat(targetX);

    // 1. Validar unicidad de nodos x_i
    const xVals = pts.map((p) => p.x);
    const hasDuplicates = new Set(xVals).size !== n;

    if (hasDuplicates) {
      return {
        degree: 0,
        expandedPoly: "--",
        graphExpression: "0",
        evaluatedY: null,
        methodName: "Error de Nodos",
        error: "Existen valores de x repetidos. Los nodos de interpolación deben ser estrictamente distintos (xᵢ ≠ xⱼ).",
        steps: [],
        dividedDiffTable: [],
      };
    }

    const steps: { stage: string; desc: string; math: string }[] = [];
    let stepId = 1;

    // A. EXPANSIÓN POR LAGRANGE
    let expandedCoeffs = new Array(n).fill(0);
    const lagrangeBases: string[] = [];

    for (let i = 0; i < n; i++) {
      let basisCoeffs = [1]; // Polinomio unitario
      let denominator = 1;

      for (let j = 0; j < n; j++) {
        if (i !== j) {
          basisCoeffs = polyMultiply(basisCoeffs, [-pts[j].x, 1]); // (x - x_j)
          denominator *= (pts[i].x - pts[j].x);
        }
      }

      const scalar = pts[i].y / denominator;
      for (let k = 0; k < basisCoeffs.length; k++) {
        expandedCoeffs[k] += basisCoeffs[k] * scalar;
      }

      const numTerms = pts.filter((_, j) => j !== i).map((p) => `(x - ${p.x})`).join("·");
      lagrangeBases.push(`L_{${i}}(x) = \\frac{${numTerms}}{${Number(denominator.toFixed(3))}}`);
    }

    // B. TABLA DE DIFERENCIAS DIVIDIDAS DE NEWTON
    const diffTable: number[][] = [];
    for (let i = 0; i < n; i++) {
      const row = new Array(n).fill(0);
      row[0] = pts[i].y;
      diffTable.push(row);
    }

    for (let col = 1; col < n; col++) {
      for (let row = 0; row < n - col; row++) {
        const num = diffTable[row + 1][col - 1] - diffTable[row][col - 1];
        const den = pts[row + col].x - pts[row].x;
        diffTable[row][col] = num / den;
      }
    }

    // Construcción del Polinomio de Newton en formato de texto
    const newtonTerms: string[] = [];
    for (let j = 0; j < n; j++) {
      const coeff = diffTable[0][j];
      if (Math.abs(coeff) < 1e-6) continue;

      if (j === 0) {
        newtonTerms.push(Number(coeff.toFixed(3)).toString());
      } else {
        const factorStr = pts.slice(0, j).map((p) => `(x - ${p.x})`).join("");
        const sign = coeff > 0 ? (newtonTerms.length > 0 ? "+ " : "") : "- ";
        newtonTerms.push(`${sign}${Math.abs(Number(coeff.toFixed(3)))}${factorStr}`);
      }
    }

    // Evaluación en x*
    let yEvaluated: number | null = null;
    if (!isNaN(xEval)) {
      let sum = 0;
      for (let k = 0; k < expandedCoeffs.length; k++) {
        sum += expandedCoeffs[k] * Math.pow(xEval, k);
      }
      yEvaluated = Number(sum.toFixed(4));
    }

    const expandedStr = formatExpandedPoly(expandedCoeffs);
    const graphStr = formatGraphablePoly(expandedCoeffs);

    // Pasos según el método
    if (method === "lagrange") {
      steps.push({
        stage: `${stepId++}. Construcción de Polinomios Base de Lagrange Lᵢ(x)`,
        desc: "Cada función base Li(x) vale 1 en el nodo x_i y 0 en todos los demás nodos",
        math: lagrangeBases.join(" \\\\[4pt] "),
      });

      steps.push({
        stage: `${stepId++}. Combinación Lineal P(x) = ∑ yᵢ · Lᵢ(x)`,
        desc: "Ponderamos cada base de Lagrange por su respectiva ordenada y_i",
        math: `P(x) = ${pts.map((p, i) => `(${p.y}) \\cdot L_{${i}}(x)`).join(" + ")}`,
      });
    } else {
      steps.push({
        stage: `${stepId++}. Coeficientes de Newton (Diagonal de Diferencias Divididas)`,
        desc: "Los coeficientes corresponden a la primera fila de la tabla triangular de diferencias divididas",
        math: `c_0 = ${Number(diffTable[0][0].toFixed(3))} ,  c_1 = ${Number(diffTable[0][1]?.toFixed(3) || 0)} ,  c_2 = ${Number(diffTable[0][2]?.toFixed(3) || 0)}`,
      });

      steps.push({
        stage: `${stepId++}. Polinomio de Newton en Forma Progresiva`,
        desc: "P(x) = f[x₀] + f[x₀,x₁](x - x₀) + f[x₀,x₁,x₂](x - x₀)(x - x₁) + ...",
        math: `P(x) = ${newtonTerms.join(" ")}`,
      });
    }

    steps.push({
      stage: `${stepId++}. Polinomio Canónico Simplificado`,
      desc: "Desarrollamos los productos y agrupamos términos semejantes por potencias de x",
      math: `P_{${n - 1}}(x) = ${expandedStr}`,
    });

    if (yEvaluated !== null) {
      steps.push({
        stage: `${stepId++}. Estimación e Interpolación en x* = ${xEval}`,
        desc: `Sustituimos el valor en el polinomio interpolador: P(${xEval})`,
        math: `P(${xEval}) = ${yEvaluated}`,
      });
    }

    return {
      degree: n - 1,
      expandedPoly: expandedStr,
      graphExpression: graphStr,
      evaluatedY: yEvaluated,
      methodName: method === "lagrange" ? "Polinomio de Lagrange" : "Diferencias Divididas de Newton",
      steps,
      dividedDiffTable: diffTable,
    };
  }, [points, targetX, method]);

  // Sincronización con ReSolve AI
  useEffect(() => {
    const summary = `${calculation.methodName} | P(x) = ${calculation.expandedPoly} | Grado: ${calculation.degree} | P(${targetX}) = ${calculation.evaluatedY}`;
    setAIContext({
      module: "Matemáticas IV",
      subtopic: "Interpolación Numérica",
      expression: `Interpolación (${points.length} puntos): P(x) = ${calculation.expandedPoly}`,
      result: calculation.evaluatedY !== null ? `P(${targetX}) = ${calculation.evaluatedY}` : calculation.expandedPoly,
      details: summary,
    });
  }, [calculation, points, targetX, setAIContext]);

  // Inyección inversa del chat o el Omni-Solver
  useEffect(() => {
    if (injectedExpression) {
      try {
        const parsed = JSON.parse(injectedExpression);
        if (Array.isArray(parsed) && parsed.length >= 2 && parsed[0].x !== undefined) {
          setPoints(parsed);
        }
      } catch {
        // Silencioso
      }
      clearInjectedExpression();
    }
  }, [injectedExpression, clearInjectedExpression]);

  // Carga de historial de Supabase
  useEffect(() => {
    fetchUserHistory("mat4", "interpolacion").then((data) => setHistory(data));
  }, []);

  const saveCalculation = async () => {
    if (calculation.error || calculation.expandedPoly === "--") return;
    const title = `Interpolación (${points.length} pts, Grado ${calculation.degree})`;
    const resSummary = `P(x) = ${calculation.expandedPoly} | P(${targetX}) = ${calculation.evaluatedY}`;
    await saveUserCalculation("mat4", "interpolacion", title, resSummary);
    const refreshed = await fetchUserHistory("mat4", "interpolacion");
    setHistory(refreshed);
  };

  const clearHistory = async () => {
    await deleteUserHistory("interpolacion");
    setHistory([]);
  };

  const handleCopy = () => {
    if (calculation.expandedPoly === "--") return;
    navigator.clipboard.writeText(calculation.expandedPoly);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="h-full flex flex-col gap-6 min-h-0 relative select-none">
      {viewMode === "calc" && (
        <div className="flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto custom-scrollbar pr-1">
          
          {/* FILA SUPERIOR: TABLA DE PUNTOS Y RESULTADO ESTIMADO */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 shrink-0">
            
            {/* Consola de Nodos (Puntos x, y) */}
            <div className="lg:col-span-8 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20">
              <div className="space-y-4">
                
                {/* Cabecera */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-2">
                    <Target size={14} className="text-zinc-500" />
                    Editor de Nodos e Interpolación
                  </span>

                  <button
                    type="button"
                    onClick={() => setIsHelpOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-800 text-[11px] font-mono text-zinc-300 transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <HelpCircle size={13} className="text-amber-400" />
                    <span>Casos Prácticos</span>
                  </button>
                </div>

                {/* Selector de Método y Estimador x* */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500 text-[10px] uppercase px-1">Método:</span>
                    <button
                      type="button"
                      onClick={() => setMethod("lagrange")}
                      className={`px-3 py-1.5 rounded-xl transition-all ${
                        method === "lagrange"
                          ? "bg-amber-400 text-zinc-950 font-bold shadow-md"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Lagrange
                    </button>
                    <button
                      type="button"
                      onClick={() => setMethod("newton")}
                      className={`px-3 py-1.5 rounded-xl transition-all ${
                        method === "newton"
                          ? "bg-amber-400 text-zinc-950 font-bold shadow-md"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Diferencias de Newton
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 text-[11px]">Estimar P(x*):</span>
                    <input
                      type="number"
                      step="any"
                      value={targetX}
                      onChange={(e) => setTargetX(e.target.value)}
                      placeholder="x*"
                      className="w-20 bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1 text-center font-mono text-xs text-amber-400 font-bold outline-none"
                    />
                  </div>
                </div>

                {/* Tabla de Puntos (x, y) */}
                <div className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                    <span>Nodos de Muestreo ({points.length} puntos)</span>
                    <button
                      type="button"
                      onClick={handleAddPoint}
                      className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-[11px] flex items-center gap-1 transition-colors"
                    >
                      <Plus size={12} /> Agregar Punto
                    </button>
                  </div>

                  <div className="max-h-44 overflow-y-auto custom-scrollbar border border-zinc-800/60 rounded-xl">
                    <table className="w-full text-left font-mono text-xs divide-y divide-zinc-800">
                      <thead className="bg-zinc-900/80 text-zinc-400 sticky top-0 text-[11px]">
                        <tr>
                          <th className="p-2.5 w-12 text-center text-zinc-600">i</th>
                          <th className="p-2.5">xᵢ (Abscisa)</th>
                          <th className="p-2.5">yᵢ = f(xᵢ)</th>
                          <th className="p-2.5 w-12 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                        {points.map((pt, idx) => (
                          <tr key={pt.id} className="hover:bg-zinc-900/30">
                            <td className="p-2 text-center text-zinc-600 font-bold text-[10px]">#{idx}</td>
                            <td className="p-1.5">
                              <input
                                type="number"
                                step="any"
                                value={pt.x}
                                onChange={(e) => handleUpdatePoint(pt.id, "x", parseFloat(e.target.value))}
                                className="w-24 bg-zinc-900/80 border border-zinc-800 rounded-lg px-2 py-1 text-zinc-100 outline-none"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="number"
                                step="any"
                                value={pt.y}
                                onChange={(e) => handleUpdatePoint(pt.id, "y", parseFloat(e.target.value))}
                                className="w-24 bg-zinc-900/80 border border-zinc-800 rounded-lg px-2 py-1 text-zinc-100 outline-none"
                              />
                            </td>
                            <td className="p-1.5 text-center">
                              {points.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemovePoint(pt.id)}
                                  className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Botón Guardar */}
              <div className="mt-5 pt-4 border-t border-zinc-800/60 flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-500">
                  Respaldo automático en Supabase
                </span>
                <button
                  type="button"
                  onClick={saveCalculation}
                  className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-semibold text-xs rounded-xl shadow-md transition-all active:scale-95"
                >
                  Guardar Polinomio
                </button>
              </div>
            </div>

            {/* Caja Derecha: Polinomio Expandido y Estimación P(x*) */}
            <div className="lg:col-span-4 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden">
              <div className="pointer-events-none absolute -bottom-16 -right-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl" />

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold">
                    Pronóstico P(x*)
                  </span>
                  {calculation.expandedPoly !== "--" && (
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
                    Valor Estimado en x* = {targetX}
                  </span>
                  <div className="text-4xl lg:text-5xl font-serif font-bold text-emerald-400 tracking-tight">
                    {calculation.evaluatedY !== null ? calculation.evaluatedY : "--"}
                  </div>
                  <span className="text-[11px] font-mono text-zinc-400 mt-2 block">
                    Grado del Polinomio: <strong className="text-zinc-200">{calculation.degree}°</strong>
                  </span>
                </div>

                {/* Polinomio Expandido Canónico */}
                <div className="space-y-2 mt-2 font-mono text-xs">
                  <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800/70 space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">
                      Polinomio Canónico P(x):
                    </span>
                    <div className="text-amber-400 text-xs font-bold truncate">
                      {calculation.expandedPoly}
                    </div>
                  </div>
                </div>
              </div>

              {/* Insignia de Método */}
              <div className="relative z-10 border-t border-zinc-800/60 pt-3.5">
                <button
                  type="button"
                  onClick={() => setIsMethodInfoOpen(!isMethodInfoOpen)}
                  className="w-full p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/70 hover:border-zinc-700 flex items-center justify-between text-[11px] font-mono transition-colors group"
                >
                  <div className="flex items-center gap-1.5 text-zinc-400 group-hover:text-zinc-200 truncate">
                    <Info size={12} className="text-amber-400 shrink-0" />
                    <span>Teorema de Unicidad de Weierstrass</span>
                  </div>
                  <ChevronRight size={12} className="text-zinc-600 group-hover:text-zinc-300 shrink-0" />
                </button>
              </div>
            </div>
          </div>

          {/* FILA INFERIOR: GRÁFICA DE LA CURVA / PASOS + HISTORIAL */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
            
            {/* Panel Izquierdo: Curva Interpoladora y Nodos */}
            <div className="lg:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <Activity size={15} className="text-zinc-400" /> Curva Interpolada y Nodos ({calculation.methodName})
                </span>
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900/80 border border-zinc-800/80 px-2.5 py-1 rounded-full">
                  {points.length} Nodos Conectados
                </span>
              </div>

              <div className="flex-1 min-h-[300px] pt-4 overflow-hidden flex flex-col justify-between">
                <MathGrapher
                  expression={calculation.graphExpression}
                  points={[
                    ...points.map((p) => ({
                      x: p.x,
                      y: p.y,
                      label: `(${p.x}, ${p.y})`,
                      color: "#10b981",
                      type: "solid" as const,
                    })),
                    ...(calculation.evaluatedY !== null && !isNaN(parseFloat(targetX))
                      ? [
                          {
                            x: parseFloat(targetX),
                            y: calculation.evaluatedY,
                            label: `P(${targetX})=${calculation.evaluatedY}`,
                            color: "#f59e0b",
                            type: "solid" as const,
                          },
                        ]
                      : []),
                  ]}
                  height="h-[280px]"
                  initialScale={40}
                />
                <div className="pt-2 text-[11px] font-mono text-zinc-500 flex items-center justify-between">
                  <span>🟢 Puntos Verdes = Nodos originales dados</span>
                  <span>🟠 Punto Ámbar = Valor interpolado P(x*)</span>
                </div>
              </div>
            </div>

            {/* Panel Derecho: Historial */}
            <div className="lg:col-span-4 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <History size={15} className="text-zinc-400" /> Historial de Curvas
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
                    <p>Sin polinomios guardados.</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Guarda interpolaciones para auditar curvas.</p>
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
                      <div className="font-mono font-bold text-emerald-400 shrink-0 text-[11px] truncate max-w-[110px]">
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
                Procedimiento Analítico de Interpolación
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                Método: {calculation.methodName} | Grado Polinomial: {calculation.degree}°
              </p>
            </div>
            <div className="text-xs font-mono px-4 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-zinc-300 shadow-inner">
              P({targetX}) = <strong className="text-emerald-400 text-sm font-serif">{calculation.evaluatedY}</strong>
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
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 font-mono text-xs text-emerald-400 text-center font-bold overflow-x-auto whitespace-pre-line">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {`$$${st.math}$$`}
                  </ReactMarkdown>
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
              <BookOpen size={12} /> Análisis Numérico y Aproximación Funcional
            </div>
            <h3 className="text-2xl font-serif font-bold text-zinc-100">
              Interpolación Polinómica y Reconstrucción de Datos
            </h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-3xl">
              La interpolación permite reconstruir una función continua desconocida a partir de un conjunto finito de puntos de muestreo discretos, fundamental en procesamiento de señales, gráficos computacionales y aprendizaje automático.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                1. Teorema de Existencia y Unicidad
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Dados n+1 puntos con abscisas distintas, existe un ÚNICO polinomio de grado menor o igual a n que pasa exactamente por todos ellos. Tanto Lagrange como Newton generan la misma curva.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                2. Diferencias Divididas vs. Lagrange
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                La forma de Newton es computacionalmente superior en software: si se añade un nuevo punto de medición, solo se calcula una fila adicional sin recalcular toda la base.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                3. El Fenómeno de Runge
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Aumentar el grado del polinomio con nodos equiespaciados provoca oscilaciones descontroladas en los bordes del intervalo. Para solucionarlo en computación se usan Splines cúbicos o nodos de Chebyshev.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                4. Curvas de Bézier y Shaders (GPU)
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Las fuentes tipográficas (TrueType) y los modelos 3D en Blender o Unreal Engine usan polinomios de interpolación paramétricos para renderizar superficies suaves en hardware gráfico.
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
                  <Cpu size={15} className="text-amber-400" /> Unicidad y Matriz de Vandermonde
                </h4>
                <button onClick={() => setIsMethodInfoOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-100">
                  <X size={16} />
                </button>
              </div>
              <div className="text-xs text-zinc-400 mt-3 space-y-2 leading-relaxed font-sans">
                <p>
                  • <strong>Matriz de Vandermonde:</strong> Resolver el sistema de interpolación directamente tiene complejidad O(n³). Lagrange y Newton lo reducen a O(n²).
                </p>
                <p>
                  • <strong>Estabilidad Numérica:</strong> Nodos muy cercanos pueden inducir mal condicionamiento numérico en aritmética flotante.
                </p>
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
                  <h3 className="text-base font-serif font-bold text-zinc-100">Casos Notables de Interpolación</h3>
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
                        setPoints(ex.points.map((p, idx) => ({ id: String(idx + 1), x: p.x, y: p.y })));
                        setTargetX(ex.targetX);
                        setIsHelpOpen(false);
                      }}
                      className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-left transition-all flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-[10px] font-mono text-amber-400/90 block font-semibold">{ex.category}</span>
                        <span className="font-mono text-zinc-200 text-xs block font-bold truncate">
                          {ex.points.length} puntos · x*={ex.targetX}
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