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
  Grid,
  ShieldCheck,
  AlertTriangle,
  Cpu,
  Layers,
  Zap,
  ArrowDownRight
} from "lucide-react";
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
// CATÁLOGO DE EJEMPLOS DE SISTEMAS LINEALES (NIVEL SUPERIOR TS)
// -----------------------------------------------------------------------------
interface ModuleExample {
  category: string;
  n: number;
  matrix: number[][];
  method: "gauss_jordan" | "gaussian_elim";
  desc: string;
}

const MODULE_EXAMPLES: ModuleExample[] = [
  {
    category: "Sistema 3×3 Solución Única (SCD)",
    n: 3,
    matrix: [
      [2, -1, 3, 9],
      [1, 1, 1, 6],
      [1, -1, 1, 2],
    ],
    method: "gauss_jordan",
    desc: "Sistema lineal clásico con solución única entera x = 1, y = 2, z = 3.",
  },
  {
    category: "Análisis de Circuitos Eléctricos (Kirchhoff)",
    n: 3,
    matrix: [
      [1, -1, -1, 0],      // Ley de corrientes nodo
      [10, 20, 0, 12],     // Malla 1
      [0, -20, 30, 0],     // Malla 2
    ],
    method: "gauss_jordan",
    desc: "Cálculo de corrientes de malla i₁, i₂, i₃ en una red de resistores.",
  },
  {
    category: "Sistema 2×2 Básico",
    n: 2,
    matrix: [
      [3, 2, 13],
      [1, -1, 1],
    ],
    method: "gauss_jordan",
    desc: "Intersección ortogonal de dos rectas en ℝ²: x = 3, y = 2.",
  },
  {
    category: "Sistema Incompatible (Sin Solución - SI)",
    n: 3,
    matrix: [
      [1, 2, -1, 4],
      [2, 4, -2, 10], // Filas paralelas contradictorias
      [1, 1, 1, 6],
    ],
    method: "gauss_jordan",
    desc: "Fila de contradicción 0 = 2 ⟹ Planos paralelos que no se intersecan.",
  },
  {
    category: "Infinitas Soluciones (Indeterminado - SCI)",
    n: 3,
    matrix: [
      [1, 1, 1, 6],
      [2, 2, 2, 12], // Fila dependiente redundante
      [1, -1, 0, 1],
    ],
    method: "gauss_jordan",
    desc: "Planos que se intersecan en una recta infinita de soluciones paramétricas.",
  },
  {
    category: "Sistema 4×4 Avanzado",
    n: 4,
    matrix: [
      [1, 1, 1, 1, 10],
      [2, -1, 1, 3, 19],
      [1, 2, -1, -1, -1],
      [3, 1, 2, 1, 17],
    ],
    method: "gauss_jordan",
    desc: "Resolución de 4 incógnitas en física computacional y balanceo térmico.",
  },
];

// Formateador de Matriz Aumentada [A | B] a sintaxis LaTeX
function augmentedMatrixToLaTeX(m: number[][]): string {
  if (!m || m.length === 0 || !m[0]) return "\\begin{bmatrix} 0 \\end{bmatrix}";
  const nCols = m[0].length - 1; // Última columna es B
  const colAlignment = "c".repeat(nCols) + "|c";

  const rows = m.map((row) => {
    const left = row.slice(0, nCols).map((v) => Number(v.toFixed(3)).toString()).join(" & ");
    const right = Number(row[nCols].toFixed(3)).toString();
    return `${left} & ${right}`;
  });

  return `\\left[\\begin{array}{${colAlignment}} ${rows.join(" \\\\ ")} \\end{array}\\right]`;
}

export default function GaussJordanView({
  viewMode,
  initialExpression = "",
}: {
  viewMode: "calc" | "steps" | "theory";
  initialExpression?: string;
}) {
  const [numVars, setNumVars] = useState<number>(3);
  const [method, setMethod] = useState<"gauss_jordan" | "gaussian_elim">("gauss_jordan");

  // Matriz aumentada n × (n+1)
  const [matrix, setMatrix] = useState<number[][]>([
    [2, -1, 3, 9],
    [1, 1, 1, 6],
    [1, -1, 1, 2],
  ]);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMethodInfoOpen, setIsMethodInfoOpen] = useState(false);

  const { setAIContext, injectedExpression, clearInjectedExpression } = useAIContext();

  const varNames = useMemo(() => {
    if (numVars === 2) return ["x", "y"];
    if (numVars === 3) return ["x", "y", "z"];
    return ["x₁", "x₂", "x₃", "x₄"];
  }, [numVars]);

  // Cambiar orden del sistema redimensionando la matriz
  const handleSetNumVars = (newN: number) => {
    setNumVars(newN);
    setMatrix((prev) => {
      const next: number[][] = [];
      for (let r = 0; r < newN; r++) {
        const row: number[] = [];
        for (let c = 0; c <= newN; c++) {
          if (prev[r]?.[c] !== undefined) {
            row.push(prev[r][c]);
          } else {
            // Diagonal principal = 1, término independiente = 1, resto = 0
            row.push(r === c ? 1 : c === newN ? (r + 1) * 2 : 0);
          }
        }
        next.push(row);
      }
      return next;
    });
  };

  const updateCell = (r: number, c: number, val: number) => {
    setMatrix((prev) => {
      const next = prev.map((row) => [...row]);
      next[r][c] = isNaN(val) ? 0 : val;
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // MOTOR DE ELIMINACIÓN GAUSSIANA Y GAUSS-JORDAN
  // ---------------------------------------------------------------------------
  const calculation = useMemo(() => {
    const n = numVars;
    const steps: { stage: string; desc: string; math: string }[] = [];
    let stepId = 1;

    // Clonar matriz aumentada para trabajar
    const mat: number[][] = matrix.map((row) => [...row]);

    steps.push({
      stage: `${stepId++}. Matriz Aumentada Inicial [A | B]`,
      desc: "Representamos el sistema de ecuaciones lineales en su forma matricial aumentada canónica",
      math: augmentedMatrixToLaTeX(mat),
    });

    let isContradiction = false;
    let isIndeterminate = false;

    // FASE DE ELIMINACIÓN (Hacia adelante con pivoteo parcial)
    for (let col = 0; col < n; col++) {
      // 1. Pivoteo parcial: encontrar la fila con el valor absoluto máximo en esta columna
      let maxRow = col;
      for (let r = col + 1; r < n; r++) {
        if (Math.abs(mat[r][col]) > Math.abs(mat[maxRow][col])) {
          maxRow = r;
        }
      }

      // Si el máximo pivote es 0, la columna no tiene pivote (posible SCI o SI)
      if (Math.abs(mat[maxRow][col]) < 1e-9) {
        continue;
      }

      // Intercambio de filas
      if (maxRow !== col) {
        const temp = mat[col];
        mat[col] = mat[maxRow];
        mat[maxRow] = temp;

        steps.push({
          stage: `${stepId++}. Intercambio de Filas (Pivoteo Parcial)`,
          desc: `Intercambiamos R_{${col + 1}} ↔ R_{${maxRow + 1}} para situar el mayor coeficiente en la diagonal`,
          math: `R_{${col + 1}} \\longleftrightarrow R_{${maxRow + 1}}\n\\Longrightarrow ${augmentedMatrixToLaTeX(mat)}`,
        });
      }

      const pivot = mat[col][col];

      // Normalizar fila pivote (hacer el pivote = 1)
      if (Math.abs(pivot - 1) > 1e-9 && Math.abs(pivot) > 1e-9) {
        for (let j = 0; j <= n; j++) {
          mat[col][j] /= pivot;
        }
        steps.push({
          stage: `${stepId++}. Normalización del Pivote a la Unidad`,
          desc: `Dividimos la fila R_{${col + 1}} entre el pivote (${Number(pivot.toFixed(3))})`,
          math: `R_{${col + 1}} \\leftarrow \\frac{1}{${Number(pivot.toFixed(3))}} \\cdot R_{${col + 1}}\n\\Longrightarrow ${augmentedMatrixToLaTeX(mat)}`,
        });
      }

      // Eliminación en las demás filas
      const startRow = method === "gauss_jordan" ? 0 : col + 1;
      for (let r = startRow; r < n; r++) {
        if (r !== col && Math.abs(mat[r][col]) > 1e-9) {
          const factor = mat[r][col];
          for (let j = 0; j <= n; j++) {
            mat[r][j] -= factor * mat[col][j];
          }

          if (steps.length < 12) {
            steps.push({
              stage: `${stepId++}. Eliminación en Fila R_{${r + 1}}`,
              desc: `Hacemos cero el coeficiente en la columna ${col + 1} mediante R_{${r + 1}} - (${Number(factor.toFixed(3))})·R_{${col + 1}}`,
              math: `R_{${r + 1}} \\leftarrow R_{${r + 1}} - (${Number(factor.toFixed(3))}) R_{${col + 1}}\n\\Longrightarrow ${augmentedMatrixToLaTeX(mat)}`,
            });
          }
        }
      }
    }

    // FASE DE SUSTITUCIÓN HACIA ATRÁS (Solo si el usuario seleccionó Eliminación Gaussiana)
    if (method === "gaussian_elim") {
      steps.push({
        stage: `${stepId++}. Matriz Triangular Superior Escalonada (REF)`,
        desc: "Hemos reducido la matriz a su forma escalonada. Ahora resolvemos por sustitución regresiva hacia atrás",
        math: augmentedMatrixToLaTeX(mat),
      });

      for (let r = n - 1; r >= 0; r--) {
        for (let up = r - 1; up >= 0; up--) {
          const factor = mat[up][r];
          if (Math.abs(factor) > 1e-9) {
            mat[up][r] -= factor * mat[r][r];
            mat[up][n] -= factor * mat[r][n];
          }
        }
      }
    }

    // CLASIFICACIÓN DEL SISTEMA (ROUCHÉ-FROBENIUS)
    let rankA = 0;
    let rankAug = 0;
    const solutions: { varName: string; value: string }[] = [];

    for (let r = 0; r < n; r++) {
      const isRowZeroA = mat[r].slice(0, n).every((val) => Math.abs(val) < 1e-5);
      const isConstZero = Math.abs(mat[r][n]) < 1e-5;

      if (!isRowZeroA) rankA++;
      if (!isRowZeroA || !isConstZero) rankAug++;

      if (isRowZeroA && !isConstZero) {
        isContradiction = true;
      }
    }

    if (rankA < rankAug || isContradiction) {
      steps.push({
        stage: `${stepId++}. Inconsistencia Detectada (Rango A < Rango A|B)`,
        desc: "Se obtuvo una fila de la forma [0 0 ... 0 | k] con k ≠ 0, lo cual representa una igualdad matemáticamente imposible (0 = k)",
        math: `0 = k \\quad(k \\neq 0) \\Longrightarrow \\text{Sistema Incompatible (Sin Solución)}`,
      });

      return {
        systemType: "incompatible",
        systemTypeLabel: "Sistema Incompatible (Sin Solución)",
        solutions: [{ varName: "Estado", value: "Sin solución (Contradicción)" }],
        rankA,
        rankAug,
        steps,
      };
    }

    if (rankA < n) {
      isIndeterminate = true;
      steps.push({
        stage: `${stepId++}. Grados de Libertad (Rango A = Rango A|B < n)`,
        desc: `El rango (${rankA}) es menor que el número de incógnitas (${n}). El sistema admite infinitas soluciones dependientes de ${n - rankA} variable(s) libre(s)`,
        math: `\\text{Grados de Libertad: } g = ${n - rankA} \\Longrightarrow \\text{Sistema Compatible Indeterminado (SCI)}`,
      });

      return {
        systemType: "indeterminate",
        systemTypeLabel: "Compatible Indeterminado (Infinitas Soluciones)",
        solutions: [{ varName: "Solución", value: "Infinitas en función de parámetros libres" }],
        rankA,
        rankAug,
        steps,
      };
    }

    // Sistema Compatible Determinado: Solución única
    for (let r = 0; r < n; r++) {
      const val = Number(mat[r][n].toFixed(4));
      solutions.push({
        varName: varNames[r],
        value: Number.isInteger(val) ? val.toString() : val.toFixed(3),
      });
    }

    steps.push({
      stage: `${stepId++}. Vector Solución Único Hallado`,
      desc: "Todas las incógnitas se han despejado directamente en la matriz identidad reducida",
      math: `X = \\begin{bmatrix} ${solutions.map((s) => s.varName).join(" \\\\ ")} \\end{bmatrix} = \\begin{bmatrix} ${solutions.map((s) => s.value).join(" \\\\ ")} \\end{bmatrix}`,
    });

    return {
      systemType: "unique",
      systemTypeLabel: "Sistema Compatible Determinado (Solución Única)",
      solutions,
      rankA,
      rankAug,
      steps,
    };
  }, [matrix, numVars, method, varNames]);

  // Sincronización con ReSolve AI
  useEffect(() => {
    const solStr = calculation.solutions.map((s) => `${s.varName} = ${s.value}`).join(", ");
    setAIContext({
      module: "Matemáticas IV",
      subtopic: "Sistemas Lineales (Gauss-Jordan)",
      expression: `Sistema ${numVars}×${numVars} [${method === "gauss_jordan" ? "Gauss-Jordan RREF" : "Eliminación Gaussiana"}]`,
      result: `${calculation.systemTypeLabel}: ${solStr}`,
      details: `Rango A: ${calculation.rankA}, Rango Aumentada: ${calculation.rankAug}. Pasos: ${calculation.steps.length}`,
    });
  }, [calculation, numVars, method, setAIContext]);

  // Inyección inversa del chat o el Omni-Solver
  useEffect(() => {
    if (injectedExpression) {
      try {
        const parsed = JSON.parse(injectedExpression);
        if (Array.isArray(parsed) && Array.isArray(parsed[0])) {
          setNumVars(parsed.length);
          setMatrix(parsed);
        }
      } catch {
        // Silencioso
      }
      clearInjectedExpression();
    }
  }, [injectedExpression, clearInjectedExpression]);

  // Historial de Supabase
  useEffect(() => {
    fetchUserHistory("mat4", "sistemas-gauss").then((data) => setHistory(data));
  }, []);

  const saveCalculation = async () => {
    const title = `Sistema ${numVars}×${numVars} por ${method === "gauss_jordan" ? "Gauss-Jordan" : "Gauss"}`;
    const resSummary = calculation.solutions.map((s) => `${s.varName}=${s.value}`).join(", ");
    await saveUserCalculation("mat4", "sistemas-gauss", title, resSummary);
    const refreshed = await fetchUserHistory("mat4", "sistemas-gauss");
    setHistory(refreshed);
  };

  const clearHistory = async () => {
    await deleteUserHistory("sistemas-gauss");
    setHistory([]);
  };

  const handleCopy = () => {
    const text = calculation.solutions.map((s) => `${s.varName} = ${s.value}`).join(", ");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="h-full flex flex-col gap-6 min-h-0 relative select-none">
      {viewMode === "calc" && (
        <div className="flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto custom-scrollbar pr-1">
          
          {/* FILA SUPERIOR: MATRIZ AUMENTADA Y VECTOR SOLUCIÓN */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 shrink-0">
            
            {/* Consola de la Matriz Aumentada */}
            <div className="lg:col-span-8 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20">
              <div className="space-y-5">
                
                {/* Cabecera */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-2">
                    <Grid size={14} className="text-zinc-500" />
                    Editor de Matriz Aumentada [A | B]
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

                {/* Controles: Orden del Sistema y Método */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500 text-[10px] uppercase px-1">Variables:</span>
                    {[2, 3, 4].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => handleSetNumVars(n)}
                        className={`px-3 py-1 rounded-xl transition-all ${
                          numVars === n
                            ? "bg-zinc-100 text-zinc-950 font-bold shadow-md"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {n}×{n}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500 text-[10px] uppercase px-1">Algoritmo:</span>
                    <button
                      type="button"
                      onClick={() => setMethod("gauss_jordan")}
                      className={`px-3 py-1 rounded-xl transition-all ${
                        method === "gauss_jordan"
                          ? "bg-amber-400 text-zinc-950 font-bold"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Gauss-Jordan (RREF)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMethod("gaussian_elim")}
                      className={`px-3 py-1 rounded-xl transition-all ${
                        method === "gaussian_elim"
                          ? "bg-amber-400 text-zinc-950 font-bold"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Gauss Clásico (REF)
                    </button>
                  </div>
                </div>

                {/* Celdas de la Matriz Aumentada con Divisor de Términos Independientes */}
                <div className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 flex flex-col items-center justify-center">
                  <div className="relative py-2 flex items-center justify-center">
                    {/* Corchete izquierdo */}
                    <div className="border-l-2 border-t-2 border-b-2 border-zinc-600 rounded-l-md w-2.5 self-stretch" />

                    {/* Bloque de Coeficientes A */}
                    <div
                      className="grid gap-2 p-2 max-w-full overflow-x-auto"
                      style={{ gridTemplateColumns: `repeat(${numVars}, minmax(44px, 58px))` }}
                    >
                      {matrix.map((row, rIdx) =>
                        row.slice(0, numVars).map((val, cIdx) => (
                          <input
                            key={`a-${rIdx}-${cIdx}`}
                            type="number"
                            value={val}
                            onChange={(e) => updateCell(rIdx, cIdx, parseFloat(e.target.value))}
                            className="h-11 bg-zinc-900 border border-zinc-800 rounded-xl font-mono text-sm text-center text-zinc-100 focus:outline-none focus:border-amber-400/80 transition-colors"
                          />
                        ))
                      )}
                    </div>

                    {/* Línea divisoria vertical de la aumentación [A | B] */}
                    <div className="w-[2px] bg-amber-400/60 self-stretch my-2 mx-1 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.3)]" />

                    {/* Bloque de Términos Independientes B */}
                    <div className="grid gap-2 p-2" style={{ gridTemplateColumns: "minmax(48px, 64px)" }}>
                      {matrix.map((row, rIdx) => (
                        <input
                          key={`b-${rIdx}`}
                          type="number"
                          value={row[numVars]}
                          onChange={(e) => updateCell(rIdx, numVars, parseFloat(e.target.value))}
                          className="h-11 bg-amber-950/20 border border-amber-500/40 rounded-xl font-mono text-sm text-center text-amber-300 font-bold focus:outline-none focus:border-amber-400 transition-colors"
                        />
                      ))}
                    </div>

                    {/* Corchete derecho */}
                    <div className="border-r-2 border-t-2 border-b-2 border-zinc-600 rounded-r-md w-2.5 self-stretch" />
                  </div>

                  {/* Leyenda de Incógnitas */}
                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-3 border-t border-zinc-800/60 w-full">
                    <span>Incógnitas: {varNames.join(", ")}</span>
                    <span className="text-amber-400/90 font-semibold">Columna derecha: Términos B</span>
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
                  Guardar en Historial
                </button>
              </div>
            </div>

            {/* Caja Derecha: Solución del Sistema */}
            <div className="lg:col-span-4 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden">
              <div className="pointer-events-none absolute -bottom-16 -right-16 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" />

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold">
                    Vector Solución
                  </span>
                  {calculation.systemType === "unique" && (
                    <button
                      onClick={handleCopy}
                      className="text-xs text-zinc-400 hover:text-zinc-100 flex items-center gap-1.5 transition-colors py-1 px-2.5 rounded-lg border border-zinc-800/60 bg-zinc-900/50"
                    >
                      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      {copied ? "Copiado" : "Copiar"}
                    </button>
                  )}
                </div>

                {/* Display del Resultado */}
                <div className="py-4 text-center">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-2">
                    Clasificación Rouché-Frobenius
                  </span>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={calculation.systemType}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-2"
                    >
                      <div
                        className={`text-sm font-mono font-bold px-3 py-1.5 rounded-xl border inline-block ${
                          calculation.systemType === "unique"
                            ? "bg-emerald-950/30 border-emerald-900/50 text-emerald-400"
                            : calculation.systemType === "indeterminate"
                            ? "bg-amber-950/30 border-amber-900/50 text-amber-400"
                            : "bg-red-950/30 border-red-900/50 text-red-400"
                        }`}
                      >
                        {calculation.systemTypeLabel}
                      </div>

                      {/* Valores numéricos de cada variable */}
                      {calculation.systemType === "unique" && (
                        <div className="grid grid-cols-2 gap-2 pt-2">
                          {calculation.solutions.map((sol) => (
                            <div key={sol.varName} className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-center">
                              <span className="text-[11px] font-mono text-zinc-500 block">{sol.varName} =</span>
                              <strong className="text-emerald-400 text-lg font-mono">{sol.value}</strong>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Rangos Matriciales */}
                <div className="space-y-2 mt-2 font-mono text-xs">
                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60 flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500">Rango Matriz A:</span>
                    <strong className="text-zinc-200">{calculation.rankA}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60 flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500">Rango Matriz Aumentada [A|B]:</span>
                    <strong className="text-zinc-200">{calculation.rankAug}</strong>
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
                    <span>Teorema de Rouché-Frobenius</span>
                  </div>
                  <ChevronRight size={12} className="text-zinc-600 group-hover:text-zinc-300 shrink-0" />
                </button>
              </div>
            </div>
          </div>

          {/* FILA INFERIOR: OPERACIONES ELEMENTALES PASO A PASO + HISTORIAL */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
            
            {/* Panel Izquierdo: Pasos de Eliminación */}
            <div className="lg:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <ListOrdered size={15} className="text-zinc-400" /> Operaciones Elementales de Fila ({method === "gauss_jordan" ? "Gauss-Jordan" : "Gauss"})
                </span>
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900/80 border border-zinc-800/80 px-2.5 py-1 rounded-full">
                  {calculation.steps.length} Matrices Intermedias
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto space-y-3.5 pr-2 mt-4 custom-scrollbar">
                {calculation.steps.map((st, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700/80 transition-all flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-zinc-200">{st.stage}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 font-sans">{st.desc}</p>
                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 font-mono text-xs text-emerald-400 text-center font-bold overflow-x-auto whitespace-pre-line">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {`$$${st.math}$$`}
                      </ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Panel Derecho: Historial */}
            <div className="lg:col-span-4 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <History size={15} className="text-zinc-400" /> Historial de Sistemas
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
                    <p>Sin sistemas resueltos guardados.</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Guarda matrices aumentadas para auditar.</p>
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

      {/* MODO 2: PASO A PASO EXPANDIDO */}
      {viewMode === "steps" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-5 shrink-0">
            <div>
              <h3 className="text-xl font-serif font-bold text-zinc-100">
                Demostración de Reducción Escalonada
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                Orden: {numVars}×{numVars + 1} | Algoritmo: {method === "gauss_jordan" ? "Gauss-Jordan" : "Eliminación Gaussiana"}
              </p>
            </div>
            <div className="text-xs font-mono px-4 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-zinc-300 shadow-inner">
              Veredicto: <strong className="text-emerald-400 text-sm font-serif">{calculation.systemTypeLabel}</strong>
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
              <BookOpen size={12} /> Métodos Numéricos y Computacionales
            </div>
            <h3 className="text-2xl font-serif font-bold text-zinc-100">
              Sistemas de Ecuaciones Lineales y Estabilidad de Algoritmos
            </h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-3xl">
              La resolución de sistemas Ax = B es el problema computacional más recurrente en ingeniería: análisis estructural, simulación de fluidos, optimización logística y renderizado gráfico.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                1. Teorema de Rouché-Frobenius
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Un sistema es compatible si y solo si el rango de la matriz de coeficientes coincide con el de la matriz aumentada: rango(A) = rango(A|B). Si es igual al número de incógnitas n, la solución es única.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                2. Pivoteo Parcial y Error de Redondeo
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                En hardware digital (estándar IEEE-754), dividir entre números cercanos a cero genera desbordamiento numérico. El pivoteo parcial intercambia filas para colocar el elemento mayor en valor absoluto en la diagonal.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                3. Complejidad Computacional O(n³)
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                La eliminación gaussiana requiere ~2n³/3 operaciones de punto flotante (FLOPs). Para sistemas con millones de variables se emplean métodos iterativos como Jacobi o Gauss-Seidel.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                4. Matrices Dispersas (Sparse Matrices)
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                En gráficos 3D y simulaciones de elementos finitos (FEM), la mayoría de coeficientes son cero. Algoritmos especiales almacenan solo los valores no nulos para ahorrar gigabytes de memoria RAM.
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
                  <Info size={15} className="text-amber-400" /> Clasificación de Sistemas
                </h4>
                <button onClick={() => setIsMethodInfoOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-100">
                  <X size={16} />
                </button>
              </div>
              <div className="text-xs text-zinc-400 mt-3 space-y-2 leading-relaxed font-sans">
                <p>
                  • <strong>Compatible Determinado (SCD):</strong> Rango(A) = Rango(A|B) = n. Planos que se cortan en un punto único.
                </p>
                <p>
                  • <strong>Compatible Indeterminado (SCI):</strong> Rango(A) = Rango(A|B) &lt; n. Existen variables libres y grados de libertad.
                </p>
                <p>
                  • <strong>Incompatible (SI):</strong> Rango(A) &lt; Rango(A|B). Fila contradictoria [0 ... 0 | k].
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
                  <Zap size={16} className="text-amber-400" />
                  <h3 className="text-base font-serif font-bold text-zinc-100">Casos de Sistemas Lineales</h3>
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
                        setNumVars(ex.n);
                        setMatrix(ex.matrix);
                        setMethod(ex.method);
                        setIsHelpOpen(false);
                      }}
                      className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-left transition-all flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-[10px] font-mono text-amber-400/90 block font-semibold">{ex.category}</span>
                        <span className="font-mono text-zinc-200 text-xs block font-bold truncate">
                          Sistema {ex.n}×{ex.n} · {ex.method === "gauss_jordan" ? "Gauss-Jordan" : "Gauss"}
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