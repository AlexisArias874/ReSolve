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
  Scale,
  ShieldCheck,
  AlertTriangle,
  Compass,
  Cpu
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
// CATÁLOGO DE EJEMPLOS DE DETERMINANTES (NIVEL SUPERIOR TS)
// -----------------------------------------------------------------------------
interface ModuleExample {
  category: string;
  matrix: number[][];
  method: DeterminantMethod;
  desc: string;
}

export type DeterminantMethod = "cofactors" | "sarrus" | "triangular";

const MODULE_EXAMPLES: ModuleExample[] = [
  {
    category: "Regla de Sarrus 3×3",
    matrix: [[1, 2, 3], [0, 4, 5], [1, 0, 6]],
    method: "sarrus",
    desc: "Cálculo clásico de diagonales descendentes menos diagonales ascendentes.",
  },
  {
    category: "Matriz Triangular (Diagonal)",
    matrix: [[2, 5, -1], [0, 3, 4], [0, 0, -2]],
    method: "triangular",
    desc: "El determinante es simplemente el producto de la diagonal principal: 2 · 3 · (-2) = -12.",
  },
  {
    category: "Matriz Singular (det = 0)",
    matrix: [[1, 2, 3], [2, 4, 6], [5, 1, 0]],
    method: "cofactors",
    desc: "Fila 2 es el doble de la Fila 1 (dependencia lineal ⟹ det(A) = 0).",
  },
  {
    category: "Matriz 4×4 por Laplace",
    matrix: [[1, 0, 2, 0], [0, 3, 0, 1], [2, 1, 0, 4], [1, 0, 1, 2]],
    method: "cofactors",
    desc: "Expansión recursiva en menores complementarios de cuarto orden.",
  },
  {
    category: "Área de Paralelogramo 2×2",
    matrix: [[3, 1], [2, 4]],
    method: "cofactors",
    desc: "det(A) = 10 ⟹ El área geométrica encerrada por los vectores es exactamente 10 u².",
  },
  {
    category: "Matriz Identidad I₃",
    matrix: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    method: "triangular",
    desc: "Elemento neutro multiplicativo: det(I) = 1 preserva volumen y escala.",
  },
];

// Formateador de matriz a sintaxis LaTeX
function matrixToLaTeX(m: number[][]): string {
  if (!m || m.length === 0 || !m[0]) return "\\begin{bmatrix} 0 \\end{bmatrix}";
  const rows = m.map((row) => row.map((v) => Number(v.toFixed(3)).toString()).join(" & "));
  return `\\begin{bmatrix} ${rows.join(" \\\\ ")} \\end{bmatrix}`;
}

// Extracción de menor complementario M_ij
function getSubmatrix(m: number[][], rowToRemove: number, colToRemove: number): number[][] {
  return m
    .filter((_, r) => r !== rowToRemove)
    .map((row) => row.filter((_, c) => c !== colToRemove));
}

// Determinante recursivo exacto
function calculateDeterminant(m: number[][]): number {
  const n = m.length;
  if (n === 1) return m[0][0];
  if (n === 2) return m[0][0] * m[1][1] - m[0][1] * m[1][0];

  let det = 0;
  for (let c = 0; c < n; c++) {
    const minor = getSubmatrix(m, 0, c);
    const sign = c % 2 === 0 ? 1 : -1;
    det += sign * m[0][c] * calculateDeterminant(minor);
  }
  return det;
}

export default function DeterminantsView({
  viewMode,
  initialExpression = "",
}: {
  viewMode: "calc" | "steps" | "theory";
  initialExpression?: string;
}) {
  const [matrixSize, setMatrixSize] = useState<number>(3);
  const [matrix, setMatrix] = useState<number[][]>([
    [1, 2, 3],
    [0, 4, 5],
    [1, 0, 6],
  ]);
  const [method, setMethod] = useState<DeterminantMethod>("sarrus");

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMethodInfoOpen, setIsMethodInfoOpen] = useState(false);

  const { setAIContext, injectedExpression, clearInjectedExpression } = useAIContext();

  // Redimensionar matriz dinámicamente preservando celdas
  const handleSetSize = (newSize: number) => {
    setMatrixSize(newSize);
    setMatrix((prev) => {
      const next: number[][] = [];
      for (let r = 0; r < newSize; r++) {
        const row: number[] = [];
        for (let c = 0; c < newSize; c++) {
          row.push(prev[r]?.[c] !== undefined ? prev[r][c] : r === c ? 1 : 0);
        }
        next.push(row);
      }
      return next;
    });

    // Si es distinto de 3x3, Sarrus no aplica
    if (newSize !== 3 && method === "sarrus") {
      setMethod("cofactors");
    }
  };

  const updateCell = (r: number, c: number, val: number) => {
    setMatrix((prev) => {
      const next = prev.map((row) => [...row]);
      next[r][c] = isNaN(val) ? 0 : val;
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // MOTOR ANALÍTICO DE DETERMINANTES
  // ---------------------------------------------------------------------------
  const calculation = useMemo(() => {
    const n = matrix.length;
    const detValue = calculateDeterminant(matrix);
    const roundedDet = Number(detValue.toFixed(4));
    const isSingular = Math.abs(detValue) < 1e-9;

    const steps: { stage: string; desc: string; math: string }[] = [];
    let stepId = 1;

    steps.push({
      stage: `${stepId++}. Planteamiento del Determinante |A|`,
      desc: `Definimos la matriz cuadrada de orden ${n}×${n}`,
      math: `|A| = \\det${matrixToLaTeX(matrix)}`,
    });

    // =========================================================================
    // MÉTODO 1: REGLA DE SARRUS (Solo para 3×3)
    // =========================================================================
    if (method === "sarrus" && n === 3) {
      const a = matrix;
      const d1 = a[0][0] * a[1][1] * a[2][2];
      const d2 = a[0][1] * a[1][2] * a[2][0];
      const d3 = a[0][2] * a[1][0] * a[2][1];
      const sumDesc = d1 + d2 + d3;

      const u1 = a[0][2] * a[1][1] * a[2][0];
      const u2 = a[0][0] * a[1][2] * a[2][1];
      const u3 = a[0][1] * a[1][0] * a[2][2];
      const sumAsc = u1 + u2 + u3;

      steps.push({
        stage: `${stepId++}. Diagonales Descendentes (Signo +)`,
        desc: "Multiplicamos las 3 diagonales principales hacia abajo",
        math: `(+): (${a[0][0]}·${a[1][1]}·${a[2][2]}) + (${a[0][1]}·${a[1][2]}·${a[2][0]}) + (${a[0][2]}·${a[1][0]}·${a[2][1]})\n= (${d1}) + (${d2}) + (${d3}) = ${sumDesc}`,
      });

      steps.push({
        stage: `${stepId++}. Diagonales Ascendentes (Signo -)`,
        desc: "Multiplicamos las 3 diagonales secundarias hacia arriba",
        math: `(-): (${a[0][2]}·${a[1][1]}·${a[2][0]}) + (${a[0][0]}·${a[1][2]}·${a[2][1]}) + (${a[0][1]}·${a[1][0]}·${a[2][2]})\n= (${u1}) + (${u2}) + (${u3}) = ${sumAsc}`,
      });

      steps.push({
        stage: `${stepId++}. Sustracción de Sarrus`,
        desc: "Determinante = (Suma Diagonales +) - (Suma Diagonales -)",
        math: `\\det(A) = (${sumDesc}) - (${sumAsc}) = ${roundedDet}`,
      });
    }

    // =========================================================================
    // MÉTODO 2: EXPANSIÓN POR COFACTORES (LAPLACE)
    // =========================================================================
    else if (method === "cofactors" || (method === "sarrus" && n !== 3)) {
      if (n === 2) {
        const d = matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
        steps.push({
          stage: `${stepId++}. Fórmula Directa 2×2`,
          desc: "Diagonal principal menos diagonal secundaria: a₁₁·a₂₂ - a₁₂·a₂₁",
          math: `\\det(A) = (${matrix[0][0]})(${matrix[1][1]}) - (${matrix[0][1]})(${matrix[1][0]})\n= ${matrix[0][0] * matrix[1][1]} - ${matrix[0][1] * matrix[1][0]} = ${roundedDet}`,
        });
      } else {
        const terms: string[] = [];
        steps.push({
          stage: `${stepId}. Expansión a lo largo de la Fila 1`,
          desc: "Aplicamos det(A) = ∑ a₁ⱼ · (-1)¹⁺ʲ · det(M₁ⱼ) extrayendo los menores de cada elemento",
          math: `\\det(A) = ${matrix[0]
            .map((val, j) => {
              const sign = j % 2 === 0 ? "+" : "-";
              return `${sign} (${val}) \\cdot \\det(M_{1${j + 1}})`;
            })
            .join(" ")}`,
        });

        for (let j = 0; j < n; j++) {
          const val = matrix[0][j];
          const minor = getSubmatrix(matrix, 0, j);
          const minorDet = calculateDeterminant(minor);
          const sign = j % 2 === 0 ? 1 : -1;
          const termVal = sign * val * minorDet;
          terms.push(`(${termVal})`);

          if (steps.length < 7) {
            steps.push({
              stage: `${stepId++}. Menor y Cofactor C_{1${j + 1}}`,
              desc: `Elemento a_{1${j + 1}} = ${val}. Signo de posición: (-1)¹⁺${j + 1} = ${sign}`,
              math: `C_{1${j + 1}} = (${sign}) \\cdot \\det${matrixToLaTeX(minor)} = (${sign})(${Number(minorDet.toFixed(3))}) = ${Number((sign * minorDet).toFixed(3))}`,
            });
          }
        }

        steps.push({
          stage: `${stepId++}. Suma Ponderada de Cofactores`,
          desc: "Multiplicamos cada elemento por su respectivo cofactor algebraico",
          math: `\\det(A) = ${terms.join(" + ")} = ${roundedDet}`,
        });
      }
    }

    // =========================================================================
    // MÉTODO 3: TRIANGULACIÓN GAUSSIANA (DIAGONAL)
    // =========================================================================
    else if (method === "triangular") {
      let isUpper = true;
      let isLower = true;
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (r > c && Math.abs(matrix[r][c]) > 1e-9) isUpper = false;
          if (r < c && Math.abs(matrix[r][c]) > 1e-9) isLower = false;
        }
      }

      if (isUpper || isLower) {
        const diagTerms: number[] = [];
        let prod = 1;
        for (let i = 0; i < n; i++) {
          diagTerms.push(matrix[i][i]);
          prod *= matrix[i][i];
        }

        steps.push({
          stage: `${stepId++}. Matriz Triangular Detectada`,
          desc: "Al ser una matriz triangular, todos los elementos debajo (o encima) de la diagonal principal son cero",
          math: `\\det(A) = a_{11} \\cdot a_{22} \\dots a_{nn} = ${diagTerms.join(" \\cdot ")} = ${Number(prod.toFixed(4))}`,
        });
      } else {
        steps.push({
          stage: `${stepId++}. Reducción Escalonada de Gauss`,
          desc: "Mediante operaciones elementales de fila eliminamos los elementos inferiores sin alterar el valor del determinante",
          math: `A \\longrightarrow U \\quad\\text{tal que}\\quad \\det(A) = \\prod u_{ii} = ${roundedDet}`,
        });
      }
    }

    // Matriz Adjunta (Transpuesta de la matriz de cofactores) para matrices 2x2 y 3x3
    let adjugateMatrix: number[][] | null = null;
    if (n <= 3) {
      const cofactors: number[][] = [];
      for (let r = 0; r < n; r++) {
        const row: number[] = [];
        for (let c = 0; c < n; c++) {
          const minor = getSubmatrix(matrix, r, c);
          const sign = (r + c) % 2 === 0 ? 1 : -1;
          row.push(sign * calculateDeterminant(minor));
        }
        cofactors.push(row);
      }
      // Transponer cofactores para obtener la adjunta
      adjugateMatrix = cofactors[0].map((_, c) => cofactors.map((r) => r[c]));
    }

    return {
      detValue: roundedDet,
      isSingular,
      steps,
      adjugateMatrix,
      geometricInterpretation:
        n === 2
          ? `Área del paralelogramo 2D = ${Math.abs(roundedDet)} u²`
          : n === 3
          ? `Volumen del paralelepípedo 3D = ${Math.abs(roundedDet)} u³`
          : `Hipervolumen 4D = ${Math.abs(roundedDet)} u⁴`,
      orientation:
        detValue > 0
          ? "Orientación positiva (Mano Derecha / Winding CW)"
          : detValue < 0
          ? "Orientación negativa / Invertida (Winding CCW)"
          : "Degenerada / Coplanar (Volumen nulo)",
    };
  }, [matrix, method]);

  // Sincronización con ReSolve AI
  useEffect(() => {
    const summary = `det(A) = ${calculation.detValue} | Orden: ${matrixSize}×${matrixSize} | Estado: ${calculation.isSingular ? "Singular (No invertible)" : "Regular (Invertible)"} | ${calculation.geometricInterpretation}`;
    setAIContext({
      module: "Matemáticas IV",
      subtopic: "Determinantes",
      expression: `det(A_${matrixSize}x${matrixSize}) = ${calculation.detValue}`,
      result: `|A| = ${calculation.detValue}`,
      details: summary,
    });
  }, [calculation, matrixSize, setAIContext]);

  // Inyección inversa del chat o el Omni-Solver
  useEffect(() => {
    if (injectedExpression) {
      try {
        const parsed = JSON.parse(injectedExpression);
        if (Array.isArray(parsed) && Array.isArray(parsed[0])) {
          setMatrixSize(parsed.length);
          setMatrix(parsed);
        }
      } catch {
        // Silencioso
      }
      clearInjectedExpression();
    }
  }, [injectedExpression, clearInjectedExpression]);

  // Carga de historial de Supabase
  useEffect(() => {
    fetchUserHistory("mat4", "determinantes").then((data) => setHistory(data));
  }, []);

  const saveCalculation = async () => {
    const title = `det(A [${matrixSize}×${matrixSize}]) por ${method.toUpperCase()}`;
    const resSummary = `|A| = ${calculation.detValue} (${calculation.isSingular ? "det=0" : "Invertible"})`;
    await saveUserCalculation("mat4", "determinantes", title, resSummary);
    const refreshed = await fetchUserHistory("mat4", "determinantes");
    setHistory(refreshed);
  };

  const clearHistory = async () => {
    await deleteUserHistory("determinantes");
    setHistory([]);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(calculation.detValue.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="h-full flex flex-col gap-6 min-h-0 relative select-none">
      {viewMode === "calc" && (
        <div className="flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto custom-scrollbar pr-1">
          
          {/* FILA SUPERIOR: MATRIZ Y VALOR DEL DETERMINANTE */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 shrink-0">
            
            {/* Caja Izquierda: Editor de la Matriz Cuadrada */}
            <div className="lg:col-span-8 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20">
              <div className="space-y-5">
                
                {/* Cabecera */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-2">
                    <Grid size={14} className="text-zinc-500" />
                    Matriz Cuadrada de Entrada (|A|)
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

                {/* Selectores de Dimensión y Método */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500 text-[10px] uppercase px-1">Orden:</span>
                    {[2, 3, 4].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => handleSetSize(size)}
                        className={`px-3 py-1 rounded-xl transition-all ${
                          matrixSize === size
                            ? "bg-zinc-100 text-zinc-950 font-bold shadow-md"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {size}×{size}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500 text-[10px] uppercase px-1">Método:</span>
                    {matrixSize === 3 && (
                      <button
                        type="button"
                        onClick={() => setMethod("sarrus")}
                        className={`px-3 py-1 rounded-xl transition-all ${
                          method === "sarrus"
                            ? "bg-amber-400 text-zinc-950 font-bold"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        Sarrus
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setMethod("cofactors")}
                      className={`px-3 py-1 rounded-xl transition-all ${
                        method === "cofactors"
                          ? "bg-amber-400 text-zinc-950 font-bold"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Cofactores (Laplace)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMethod("triangular")}
                      className={`px-3 py-1 rounded-xl transition-all ${
                        method === "triangular"
                          ? "bg-amber-400 text-zinc-950 font-bold"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Triangulación
                    </button>
                  </div>
                </div>

                {/* Cuadrícula Visual con Corchetes de Determinante */}
                <div className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 flex flex-col items-center justify-center">
                  <div className="relative py-2 flex items-center justify-center">
                    {/* Barra vertical de determinante | ... | */}
                    <div className="border-l-2 border-zinc-500 w-2 self-stretch" />
                    <div
                      className="grid gap-2.5 p-2 max-w-full overflow-x-auto"
                      style={{ gridTemplateColumns: `repeat(${matrixSize}, minmax(48px, 64px))` }}
                    >
                      {matrix.map((row, rIdx) =>
                        row.map((val, cIdx) => (
                          <input
                            key={`${rIdx}-${cIdx}`}
                            type="number"
                            value={val}
                            onChange={(e) => updateCell(rIdx, cIdx, parseFloat(e.target.value))}
                            className="h-12 bg-zinc-900 border border-zinc-800 rounded-xl font-mono text-sm text-center text-zinc-100 focus:outline-none focus:border-amber-400/80 transition-colors"
                          />
                        ))
                      )}
                    </div>
                    <div className="border-r-2 border-zinc-500 w-2 self-stretch" />
                  </div>

                  {/* Acciones de Presets Rápidos */}
                  <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-500 pt-3 border-t border-zinc-800/60 w-full justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMatrix(matrix.map((row, r) => row.map((_, c) => (r === c ? 1 : 0))))}
                        className="hover:text-zinc-300"
                      >
                        Identidad
                      </button>
                      <button
                        type="button"
                        onClick={() => setMatrix(matrix.map((row) => row.map(() => 0)))}
                        className="hover:text-zinc-300"
                      >
                        Ceros
                      </button>
                      <button
                        type="button"
                        onClick={() => setMatrix(matrix.map((row, r) => row.map((_, c) => (r >= c ? Math.floor(Math.random() * 5) + 1 : 0))))}
                        className="hover:text-zinc-300"
                      >
                        Triangular Inf.
                      </button>
                    </div>

                    <span className="text-zinc-600">Matriz A ({matrixSize}×{matrixSize})</span>
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

            {/* Caja Derecha: Resultado del Determinante */}
            <div className="lg:col-span-4 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden">
              <div className="pointer-events-none absolute -bottom-16 -right-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl" />

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold">
                    Determinante det(A)
                  </span>
                  <button
                    onClick={handleCopy}
                    className="text-xs text-zinc-400 hover:text-zinc-100 flex items-center gap-1.5 transition-colors py-1 px-2.5 rounded-lg border border-zinc-800/60 bg-zinc-900/50"
                  >
                    {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                </div>

                <div className="py-4 text-center">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-1">
                    Valor Escalar |A|
                  </span>
                  <div className={`text-5xl font-serif font-bold tracking-tight ${calculation.isSingular ? "text-red-400" : "text-emerald-400"}`}>
                    {calculation.detValue}
                  </div>
                  <span className="text-[11px] font-mono text-zinc-400 mt-2 block">
                    {calculation.isSingular
                      ? "⚠️ Matriz Singular (det = 0, Sin Inversa)"
                      : "✓ Matriz Regular (Invertible / No Singular)"}
                  </span>
                </div>

                {/* Interpretación Geométrica y Orientación */}
                <div className="space-y-2 mt-2 font-mono text-xs">
                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 block">Significado Geométrico:</span>
                    <strong className="text-amber-400 text-[11px] block">{calculation.geometricInterpretation}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 block">Orientación de Espacio:</span>
                    <strong className="text-zinc-300 text-[11px] block">{calculation.orientation}</strong>
                  </div>
                </div>
              </div>

              {/* Insignia de Propiedades */}
              <div className="relative z-10 border-t border-zinc-800/60 pt-3.5">
                <button
                  type="button"
                  onClick={() => setIsMethodInfoOpen(!isMethodInfoOpen)}
                  className="w-full p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/70 hover:border-zinc-700 flex items-center justify-between text-[11px] font-mono transition-colors group"
                >
                  <div className="flex items-center gap-1.5 text-zinc-400 group-hover:text-zinc-200 truncate">
                    <Info size={12} className="text-amber-400 shrink-0" />
                    <span>Propiedades y Matriz Adjunta</span>
                  </div>
                  <ChevronRight size={12} className="text-zinc-600 group-hover:text-zinc-300 shrink-0" />
                </button>
              </div>
            </div>
          </div>

          {/* FILA INFERIOR: DESGLOSE PASO A PASO + HISTORIAL */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
            
            {/* Panel Izquierdo: Pasos del Método Seleccionado */}
            <div className="lg:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <ListOrdered size={15} className="text-zinc-400" /> Deducción por Método: {method.toUpperCase()}
                </span>
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900/80 border border-zinc-800/80 px-2.5 py-1 rounded-full">
                  {calculation.steps.length} Pasos
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-2 mt-4 custom-scrollbar">
                {calculation.steps.map((st, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700/80 transition-all flex flex-col gap-1.5"
                  >
                    <span className="text-xs font-mono font-semibold text-zinc-200">{st.stage}</span>
                    <p className="text-[11px] text-zinc-400 font-sans">{st.desc}</p>
                    <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 font-mono text-xs text-emerald-400 text-center font-bold overflow-x-auto whitespace-pre-line">
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
                  <History size={15} className="text-zinc-400" /> Historial de Determinantes
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
                    <p>Sin determinantes guardados.</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Guarda operaciones para auditar.</p>
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
                Procedimiento Detallado del Determinante
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                Orden: {matrixSize}×{matrixSize} | Método: {method.toUpperCase()}
              </p>
            </div>
            <div className="text-xs font-mono px-4 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-zinc-300 shadow-inner">
              |A| = <strong className="text-emerald-400 text-sm font-serif">{calculation.detValue}</strong>
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
              <BookOpen size={12} /> Álgebra Lineal y Computación Gráfica
            </div>
            <h3 className="text-2xl font-serif font-bold text-zinc-100">
              El Determinante como Factor de Escala y Orientación
            </h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-3xl">
              Algebraicamente, el determinante mide si un sistema lineal tiene solución única; geométricamente, cuantifica cuánto se dilata o comprime el espacio tras una transformación lineal.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                1. Factor de Dilatación de Área y Volumen
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                El valor absoluto |det(A)| indica cuánto se multiplica el área o volumen original. Si det(A) = 3, cualquier figura geométrica transformada triplica su área.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                2. Backface Culling en Motores 3D (OpenGL/DirectX)
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                El signo del determinante determina el orden de los vértices (Winding Order). Si un polígono se proyecta con det &lt; 0, el motor gráfico descarta el triángulo porque está de espaldas a la cámara.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                3. Matriz de Transformación Jacobiana
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                En cálculo multivariable y robótica, el determinante jacobiano det(J) mide el cambio local de coordenadas espaciales entre las articulaciones de un robot y el espacio cartesiano.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                4. Criterio de Regularidad
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                det(A) ≠ 0 garantiza que las columnas son linealmente independientes, el rango es completo y la matriz inversa existe de forma única.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE INFORMACIÓN Y MATRIZ ADJUNTA */}
      <AnimatePresence>
        {isMethodInfoOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg border border-zinc-800 bg-zinc-950 rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <h4 className="text-sm font-serif font-bold text-zinc-100 flex items-center gap-2">
                  <Cpu size={15} className="text-amber-400" /> Matriz Adjunta y Propiedades
                </h4>
                <button onClick={() => setIsMethodInfoOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-100">
                  <X size={16} />
                </button>
              </div>

              <div className="text-xs text-zinc-300 mt-4 space-y-3 font-sans">
                {calculation.adjugateMatrix && (
                  <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-1 text-center">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
                      Matriz Adjunta Adj(A) = (Cofactores)ᵀ
                    </span>
                    <div className="py-2 text-emerald-400 text-sm">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {`$$\\text{Adj}(A) = ${matrixToLaTeX(calculation.adjugateMatrix)}$$`}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}

                <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-[11px] font-mono text-zinc-400 space-y-1">
                  <p>• det(A · B) = det(A) · det(B)</p>
                  <p>• det(Aᵀ) = det(A)</p>
                  <p>• det(A⁻¹) = 1 / det(A) (si det(A) ≠ 0)</p>
                  <p>• det(k · A) = kⁿ · det(A) para orden n</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE AYUDA CON EJEMPLOS DE 1 CLIC */}
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
                  <Scale size={16} className="text-amber-400" />
                  <h3 className="text-base font-serif font-bold text-zinc-100">Casos Notables de Determinantes</h3>
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
                        setMatrixSize(ex.matrix.length);
                        setMatrix(ex.matrix);
                        setMethod(ex.method);
                        setIsHelpOpen(false);
                      }}
                      className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-left transition-all flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-[10px] font-mono text-amber-400/90 block font-semibold">{ex.category}</span>
                        <span className="font-mono text-zinc-200 text-xs block font-bold truncate">
                          Orden {ex.matrix.length}×{ex.matrix.length} · {ex.method.toUpperCase()}
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