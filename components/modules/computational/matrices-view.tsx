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
  Binary,
  Terminal,
  Code2,
  ChevronRight,
  Info,
  Layers,
  Repeat,
  Grid,
  Zap,
  ArrowRightLeft,
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
// CATÁLOGO DE EJEMPLOS DE INFORMÁTICA Y GRÁFICOS (1 CLIC)
// -----------------------------------------------------------------------------
interface ModuleExample {
  category: string;
  op: MatrixOp;
  matrixA: number[][];
  matrixB?: number[][];
  scalar?: number;
  desc: string;
}

export type MatrixOp = "inv" | "mul" | "add" | "sub" | "transpose" | "trace" | "scalar" | "power2";

const MODULE_EXAMPLES: ModuleExample[] = [
  {
    category: "Matriz Invertible 2×2",
    op: "inv",
    matrixA: [[2, 1], [5, 3]],
    desc: "Cálculo de matriz inversa regular con determinante unitario det(A) = 1.",
  },
  {
    category: "Matriz de Rotación 2D (Gráficos 3D / Shaders)",
    op: "mul",
    matrixA: [[0, -1], [1, 0]], // Rotación de 90°
    matrixB: [[2], [3]],        // Vector columna (2, 3)
    desc: "Transformación lineal de rotación ortogonal de 90° sobre un vector.",
  },
  {
    category: "Multiplicación de Matrices 2×3 y 3×2",
    op: "mul",
    matrixA: [[1, 2, 3], [4, 5, 6]],
    matrixB: [[7, 8], [9, 1], [2, 3]],
    desc: "Producto matricial dimensionalmente compatible (2×3 por 3×2 ⟹ 2×2).",
  },
  {
    category: "Matriz Singular (Sin Inversa det=0)",
    op: "inv",
    matrixA: [[1, 2], [2, 4]],
    desc: "Filas linealmente dependientes con determinante nulo (sin inversa).",
  },
  {
    category: "Matriz de Adyacencia (Teoría de Grafos)",
    op: "power2",
    matrixA: [[0, 1, 1], [1, 0, 0], [1, 0, 0]],
    desc: "A² calcula el número de caminos de longitud 2 entre nodos de una red.",
  },
  {
    category: "Matriz Invertible 3×3",
    op: "inv",
    matrixA: [[1, 2, 3], [0, 1, 4], [5, 6, 0]],
    desc: "Inversión tridimensional por algoritmo de Gauss-Jordan.",
  },
];

// Formateador de matriz para KaTeX
function matrixToLaTeX(m: number[][]): string {
  if (!m || m.length === 0 || !m[0]) return "\\begin{bmatrix} 0 \\end{bmatrix}";
  const rows = m.map((row) => row.map((v) => Number(v.toFixed(3)).toString()).join(" & "));
  return `\\begin{bmatrix} ${rows.join(" \\\\ ")} \\end{bmatrix}`;
}

export default function MatricesView({
  viewMode,
  initialExpression = "",
}: {
  viewMode: "calc" | "steps" | "theory";
  initialExpression?: string;
}) {
  // Dimensiones Matriz A y B
  const [rowsA, setRowsA] = useState<number>(2);
  const [colsA, setColsA] = useState<number>(2);
  const [matrixA, setMatrixA] = useState<number[][]>([[2, 1], [5, 3]]);

  const [rowsB, setRowsB] = useState<number>(2);
  const [colsB, setColsB] = useState<number>(2);
  const [matrixB, setMatrixB] = useState<number[][]>([[1, 0], [0, 1]]);

  // Operación seleccionada
  const [selectedOp, setSelectedOp] = useState<MatrixOp>("inv");
  const [scalarK, setScalarK] = useState<number>(2);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMethodInfoOpen, setIsMethodInfoOpen] = useState(false);

  const { setAIContext, injectedExpression, clearInjectedExpression } = useAIContext();

  // Ajustar dimensiones de matriz A dinámicamente preservando valores existentes
  const resizeMatrix = (curr: number[][], newR: number, newC: number): number[][] => {
    const res: number[][] = [];
    for (let r = 0; r < newR; r++) {
      const row: number[] = [];
      for (let c = 0; c < newC; c++) {
        row.push(curr[r]?.[c] !== undefined ? curr[r][c] : r === c ? 1 : 0);
      }
      res.push(row);
    }
    return res;
  };

  const handleSetDimA = (r: number, c: number) => {
    setRowsA(r);
    setColsA(c);
    setMatrixA((prev) => resizeMatrix(prev, r, c));
  };

  const handleSetDimB = (r: number, c: number) => {
    setRowsB(r);
    setColsB(c);
    setMatrixB((prev) => resizeMatrix(prev, r, c));
  };

  const updateCellA = (r: number, c: number, val: number) => {
    setMatrixA((prev) => {
      const next = prev.map((row) => [...row]);
      next[r][c] = isNaN(val) ? 0 : val;
      return next;
    });
  };

  const updateCellB = (r: number, c: number, val: number) => {
    setMatrixB((prev) => {
      const next = prev.map((row) => [...row]);
      next[r][c] = isNaN(val) ? 0 : val;
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // MOTOR ALGEBRAICO DE OPERACIONES MATRICIALES
  // ---------------------------------------------------------------------------
  const calculation = useMemo(() => {
    const steps: { stage: string; desc: string; math: string }[] = [];
    let stepId = 1;

    // 1. INVERSA POR GAUSS-JORDAN (A^-1)
    if (selectedOp === "inv") {
      if (rowsA !== colsA) {
        return {
          resultMatrix: null,
          scalarResult: null,
          title: "Matriz No Cuadrada",
          statusDesc: "Solo las matrices cuadradas (n × n) pueden poseer matriz inversa.",
          error: "La matriz A no es cuadrada.",
          steps: [],
        };
      }

      const n = rowsA;
      // Crear matriz aumentada [A | I]
      const aug: number[][] = [];
      for (let i = 0; i < n; i++) {
        const row = [...matrixA[i]];
        for (let j = 0; j < n; j++) {
          row.push(i === j ? 1 : 0);
        }
        aug.push(row);
      }

      steps.push({
        stage: `${stepId++}. Construcción de la Matriz Aumentada [A | I]`,
        desc: "Colocamos la matriz A a la izquierda y la matriz identidad I de orden n a la derecha",
        math: `[ A \\mid I ] = ${matrixToLaTeX(matrixA)} \\quad\\text{aumentada con}\\quad I_{${n}}`,
      });

      // Eliminación Gauss-Jordan con pivoteo parcial
      for (let col = 0; col < n; col++) {
        // Encontrar fila con mayor pivote
        let maxRow = col;
        for (let r = col + 1; r < n; r++) {
          if (Math.abs(aug[r][col]) > Math.abs(aug[maxRow][col])) {
            maxRow = r;
          }
        }

        // Intercambio de filas si aplica
        if (maxRow !== col) {
          const temp = aug[col];
          aug[col] = aug[maxRow];
          aug[maxRow] = temp;
          steps.push({
            stage: `${stepId++}. Intercambio de Filas (Pivoteo)`,
            desc: `Intercambiamos R_{${col + 1}} ↔ R_{${maxRow + 1}} para maximizar estabilidad numérica`,
            math: `R_{${col + 1}} \\longleftrightarrow R_{${maxRow + 1}}`,
          });
        }

        const pivot = aug[col][col];
        if (Math.abs(pivot) < 1e-9) {
          return {
            resultMatrix: null,
            scalarResult: null,
            title: "Matriz Singular (det = 0)",
            statusDesc: "El pivote en la diagonal se anuló. La matriz no tiene inversa.",
            error: "La matriz es singular y no posee inversa.",
            steps,
          };
        }

        // Normalizar fila pivote para que el pivote sea 1
        for (let j = 0; j < 2 * n; j++) {
          aug[col][j] /= pivot;
        }

        // Hacer ceros en las demás filas de esta columna
        for (let r = 0; r < n; r++) {
          if (r !== col) {
            const factor = aug[r][col];
            for (let j = 0; j < 2 * n; j++) {
              aug[r][j] -= factor * aug[col][j];
            }
          }
        }
      }

      // Extraer mitad derecha [I | A^-1]
      const inv: number[][] = [];
      for (let i = 0; i < n; i++) {
        inv.push(aug[i].slice(n, 2 * n));
      }

      steps.push({
        stage: `${stepId++}. Matriz Reducida a la Identidad [I | A⁻¹]`,
        desc: "Las operaciones de fila transformaron el lado izquierdo en I y el lado derecho en A⁻¹",
        math: `A^{-1} = ${matrixToLaTeX(inv)}`,
      });

      return {
        resultMatrix: inv,
        scalarResult: null,
        title: `Inversa A⁻¹ (${n}×${n})`,
        statusDesc: "Matriz regular invertible calculada mediante el algoritmo de Gauss-Jordan.",
        steps,
      };
    }

    // 2. MULTIPLICACIÓN MATRICIAL (A × B)
    if (selectedOp === "mul") {
      if (colsA !== rowsB) {
        return {
          resultMatrix: null,
          scalarResult: null,
          title: "Dimensiones Incompatibles",
          statusDesc: `Para multiplicar A × B, las columnas de A (${colsA}) deben coincidir con las filas de B (${rowsB}).`,
          error: "Columnas de A ≠ Filas de B",
          steps: [],
        };
      }

      const resR = rowsA;
      const resC = colsB;
      const C: number[][] = [];

      steps.push({
        stage: `${stepId++}. Verificación de Compatibilidad Dimensional`,
        desc: `Matriz A (${rowsA}×${colsA}) multiplicada por Matriz B (${rowsB}×${colsB}) genera una matriz C de orden (${resR}×${resC})`,
        math: `(${rowsA}\\times${colsA}) \\cdot (${rowsB}\\times${colsB}) \\Longrightarrow (${resR}\\times${resC})`,
      });

      for (let i = 0; i < resR; i++) {
        const row: number[] = [];
        for (let j = 0; j < resC; j++) {
          let sum = 0;
          const terms: string[] = [];
          for (let k = 0; k < colsA; k++) {
            const prod = matrixA[i][k] * matrixB[k][j];
            sum += prod;
            terms.push(`(${matrixA[i][k]} \\cdot ${matrixB[k][j]})`);
          }
          row.push(sum);

          if (steps.length < 8) {
            steps.push({
              stage: `${stepId++}. Producto Punto Celda c_{${i + 1}${j + 1}}`,
              desc: `Fila ${i + 1} de A con Columna ${j + 1} de B`,
              math: `c_{${i + 1}${j + 1}} = ${terms.join(" + ")} = ${Number(sum.toFixed(3))}`,
            });
          }
        }
        C.push(row);
      }

      return {
        resultMatrix: C,
        scalarResult: null,
        title: `Producto A × B (${resR}×${resC})`,
        statusDesc: `Multiplicación matricial completada celda por celda.`,
        steps,
      };
    }

    // 3. SUMA (A + B) O RESTA (A - B)
    if (selectedOp === "add" || selectedOp === "sub") {
      if (rowsA !== rowsB || colsA !== colsB) {
        return {
          resultMatrix: null,
          scalarResult: null,
          title: "Dimensiones Distintas",
          statusDesc: `Para sumar o restar, ambas matrices deben tener el mismo orden (${rowsA}×${colsA} vs ${rowsB}×${colsB}).`,
          error: "Orden no coincidente",
          steps: [],
        };
      }

      const sign = selectedOp === "add" ? 1 : -1;
      const R: number[][] = [];
      for (let i = 0; i < rowsA; i++) {
        const row: number[] = [];
        for (let j = 0; j < colsA; j++) {
          row.push(matrixA[i][j] + sign * matrixB[i][j]);
        }
        R.push(row);
      }

      steps.push({
        stage: `${stepId++}. Operación Término a Término`,
        desc: `Sumamos o restamos cada elemento en su posición correspondiente c_{ij} = a_{ij} ${selectedOp === "add" ? "+" : "-"} b_{ij}`,
        math: `A ${selectedOp === "add" ? "+" : "-"} B = ${matrixToLaTeX(R)}`,
      });

      return {
        resultMatrix: R,
        scalarResult: null,
        title: `Matriz ${selectedOp === "add" ? "Suma A + B" : "Resta A - B"} (${rowsA}×${colsA})`,
        statusDesc: "Operación de álgebra lineal aditiva componente a componente.",
        steps,
      };
    }

    // 4. TRANSPUESTA (A^T)
    if (selectedOp === "transpose") {
      const T: number[][] = [];
      for (let j = 0; j < colsA; j++) {
        const row: number[] = [];
        for (let i = 0; i < rowsA; i++) {
          row.push(matrixA[i][j]);
        }
        T.push(row);
      }

      steps.push({
        stage: `${stepId++}. Intercambio de Filas por Columnas`,
        desc: `Los renglones de la matriz original A se convierten en las columnas de Aᵀ`,
        math: `A^T = ${matrixToLaTeX(T)}`,
      });

      return {
        resultMatrix: T,
        scalarResult: null,
        title: `Transpuesta Aᵀ (${colsA}×${rowsA})`,
        statusDesc: "Operador de transposición matricial canónico.",
        steps,
      };
    }

    // 5. TRAZA tr(A)
    if (selectedOp === "trace") {
      if (rowsA !== colsA) {
        return {
          resultMatrix: null,
          scalarResult: null,
          title: "Requiere Matriz Cuadrada",
          statusDesc: "La traza solo está definida para matrices cuadradas con diagonal principal.",
          error: "Matriz no cuadrada",
          steps: [],
        };
      }

      let tr = 0;
      const terms: string[] = [];
      for (let i = 0; i < rowsA; i++) {
        tr += matrixA[i][i];
        terms.push(`a_{${i + 1}${i + 1}}(${matrixA[i][i]})`);
      }

      steps.push({
        stage: `${stepId++}. Suma de la Diagonal Principal`,
        desc: "La traza es el invariante algebraico formado por la suma de los elementos a_{ii}",
        math: `\\text{tr}(A) = ${terms.join(" + ")} = ${tr}`,
      });

      return {
        resultMatrix: null,
        scalarResult: tr,
        title: `Traza tr(A) = ${tr}`,
        statusDesc: "Suma escalar de los elementos de la diagonal principal.",
        steps,
      };
    }

    // 6. MULTIPLICACIÓN POR ESCALAR (k · A)
    if (selectedOp === "scalar") {
      const S: number[][] = [];
      for (let i = 0; i < rowsA; i++) {
        const row: number[] = [];
        for (let j = 0; j < colsA; j++) {
          row.push(matrixA[i][j] * scalarK);
        }
        S.push(row);
      }

      steps.push({
        stage: `${stepId++}. Multiplicación Escalar por Componente`,
        desc: `Multiplicamos cada entrada a_{ij} por el escalar k = ${scalarK}`,
        math: `${scalarK} \\cdot A = ${matrixToLaTeX(S)}`,
      });

      return {
        resultMatrix: S,
        scalarResult: null,
        title: `Escalar ${scalarK} · A (${rowsA}×${colsA})`,
        statusDesc: "Multiplicación de vector/matriz por escalar de campo.",
        steps,
      };
    }

    // 7. POTENCIA AL CUADRADO (A^2 = A * A)
    if (selectedOp === "power2") {
      if (rowsA !== colsA) {
        return {
          resultMatrix: null,
          scalarResult: null,
          title: "Requiere Matriz Cuadrada",
          statusDesc: "Para elevar al cuadrado, la matriz debe poder multiplicarse por sí misma (n × n).",
          error: "Matriz no cuadrada",
          steps: [],
        };
      }

      const n = rowsA;
      const P: number[][] = [];
      for (let i = 0; i < n; i++) {
        const row: number[] = [];
        for (let j = 0; j < n; j++) {
          let sum = 0;
          for (let k = 0; k < n; k++) {
            sum += matrixA[i][k] * matrixA[k][j];
          }
          row.push(sum);
        }
        P.push(row);
      }

      steps.push({
        stage: `${stepId++}. Multiplicación A × A`,
        desc: "Calculamos el cuadrado matricial multiplicando A por sí misma",
        math: `A^2 = ${matrixToLaTeX(P)}`,
      });

      return {
        resultMatrix: P,
        scalarResult: null,
        title: `Potencia A² (${n}×${n})`,
        statusDesc: "Producto matricial de automultiplicación.",
        steps,
      };
    }

    return {
      resultMatrix: null,
      scalarResult: null,
      title: "--",
      statusDesc: "Selecciona una operación.",
      steps: [],
    };
  }, [matrixA, matrixB, rowsA, colsA, rowsB, colsB, selectedOp, scalarK]);

  // Sincronización con ReSolve AI
  useEffect(() => {
    const exprTitle = `Operación [${selectedOp.toUpperCase()}] sobre Matriz A (${rowsA}×${colsA})`;
    const resSummary = calculation.resultMatrix
      ? `Matriz (${calculation.resultMatrix.length}×${calculation.resultMatrix[0]?.length})`
      : calculation.scalarResult !== null
      ? `Escalar: ${calculation.scalarResult}`
      : "Error / Incompatible";

    setAIContext({
      module: "Matemáticas IV",
      subtopic: "Álgebra Matricial",
      expression: exprTitle,
      result: resSummary,
      details: `${calculation.title}. Matriz A = ${JSON.stringify(matrixA)}`,
    });
  }, [selectedOp, calculation, rowsA, colsA, matrixA, setAIContext]);

  // Inyecciones inversas del chat
  useEffect(() => {
    if (injectedExpression) {
      try {
        const parsed = JSON.parse(injectedExpression);
        if (Array.isArray(parsed) && Array.isArray(parsed[0])) {
          setRowsA(parsed.length);
          setColsA(parsed[0].length);
          setMatrixA(parsed);
        }
      } catch {
        // Silencioso
      }
      clearInjectedExpression();
    }
  }, [injectedExpression, clearInjectedExpression]);

  // Historial de Supabase
  useEffect(() => {
    fetchUserHistory("mat4", "matrices").then((data) => setHistory(data));
  }, []);

  const saveCalculation = async () => {
    if (calculation.error) return;
    const title = `Matriz ${selectedOp.toUpperCase()} [${rowsA}×${colsA}]`;
    const resSummary = calculation.resultMatrix
      ? JSON.stringify(calculation.resultMatrix)
      : String(calculation.scalarResult);

    await saveUserCalculation("mat4", "matrices", title, resSummary);
    const refreshed = await fetchUserHistory("mat4", "matrices");
    setHistory(refreshed);
  };

  const clearHistory = async () => {
    await deleteUserHistory("matrices");
    setHistory([]);
  };

  const handleCopy = () => {
    if (calculation.resultMatrix) {
      navigator.clipboard.writeText(JSON.stringify(calculation.resultMatrix));
    } else if (calculation.scalarResult !== null) {
      navigator.clipboard.writeText(String(calculation.scalarResult));
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isBinaryOp = selectedOp === "mul" || selectedOp === "add" || selectedOp === "sub";

  return (
    <div className="h-full flex flex-col gap-6 min-h-0 relative select-none">
      {viewMode === "calc" && (
        <div className="flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto custom-scrollbar pr-1">
          
          {/* FILA SUPERIOR: CONSOLA DE MATRICES Y RESULTADO */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 shrink-0">
            
            {/* Caja Izquierda: Editor de Celdas y Dimensiones */}
            <div className="lg:col-span-8 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20">
              <div className="space-y-5">
                
                {/* Cabecera con Botón de Guía */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-2">
                    <Grid size={14} className="text-zinc-500" />
                    Editor Matricial y Transformaciones Lineales
                  </span>

                  <button
                    type="button"
                    onClick={() => setIsHelpOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-800 text-[11px] font-mono text-zinc-300 transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <HelpCircle size={13} className="text-amber-400" />
                    <span>Ejemplos 3D y Grafos</span>
                  </button>
                </div>

                {/* Barra de Operaciones */}
                <div className="flex flex-wrap gap-1.5 p-1.5 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl text-xs font-mono">
                  {[
                    { id: "inv", label: "Inversa (A⁻¹)" },
                    { id: "mul", label: "Multiplicación (A × B)" },
                    { id: "add", label: "Suma (A + B)" },
                    { id: "sub", label: "Resta (A - B)" },
                    { id: "transpose", label: "Transpuesta (Aᵀ)" },
                    { id: "trace", label: "Traza (tr)" },
                    { id: "power2", label: "Potencia (A²)" },
                    { id: "scalar", label: "Escalar (k·A)" },
                  ].map((op) => (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => setSelectedOp(op.id as MatrixOp)}
                      className={`py-1.5 px-3 rounded-xl transition-all ${
                        selectedOp === op.id
                          ? "bg-zinc-100 text-zinc-950 font-bold shadow-md"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>

                {/* Matriz A y Matriz B en Paralelo */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  
                  {/* MATRIZ A */}
                  <div className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-zinc-200 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-sky-400" /> Matriz A ({rowsA}×{colsA})
                      </span>
                      
                      {/* Dimensiones rápidas A */}
                      <div className="flex items-center gap-1 text-[10px] font-mono">
                        <button
                          type="button"
                          onClick={() => handleSetDimA(2, 2)}
                          className={`px-2 py-0.5 rounded ${rowsA === 2 && colsA === 2 ? "bg-zinc-800 text-zinc-100" : "text-zinc-500"}`}
                        >
                          2×2
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetDimA(3, 3)}
                          className={`px-2 py-0.5 rounded ${rowsA === 3 && colsA === 3 ? "bg-zinc-800 text-zinc-100" : "text-zinc-500"}`}
                        >
                          3×3
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetDimA(4, 4)}
                          className={`px-2 py-0.5 rounded ${rowsA === 4 && colsA === 4 ? "bg-zinc-800 text-zinc-100" : "text-zinc-500"}`}
                        >
                          4×4
                        </button>
                      </div>
                    </div>

                    {/* Celdas Visuales con Corchetes */}
                    <div className="relative py-1 flex items-center justify-center">
                      <div className="border-l-2 border-t-2 border-b-2 border-zinc-600 rounded-l-md w-3 self-stretch" />
                      <div
                        className="grid gap-2 p-2 max-w-full overflow-x-auto"
                        style={{ gridTemplateColumns: `repeat(${colsA}, minmax(44px, 58px))` }}
                      >
                        {matrixA.map((row, rIdx) =>
                          row.map((val, cIdx) => (
                            <input
                              key={`${rIdx}-${cIdx}`}
                              type="number"
                              value={val}
                              onChange={(e) => updateCellA(rIdx, cIdx, parseFloat(e.target.value))}
                              className="h-11 bg-zinc-900 border border-zinc-800 rounded-xl font-mono text-sm text-center text-zinc-100 focus:outline-none focus:border-sky-400/80 transition-colors"
                            />
                          ))
                        )}
                      </div>
                      <div className="border-r-2 border-t-2 border-b-2 border-zinc-600 rounded-r-md w-3 self-stretch" />
                    </div>

                    {/* Acciones Rápidas A */}
                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-1 border-t border-zinc-800/60">
                      <button
                        type="button"
                        onClick={() => setMatrixA(matrixA.map((row, r) => row.map((_, c) => (r === c ? 1 : 0))))}
                        className="hover:text-zinc-300"
                      >
                        Identidad
                      </button>
                      <button
                        type="button"
                        onClick={() => setMatrixA(matrixA.map((row) => row.map(() => 0)))}
                        className="hover:text-zinc-300"
                      >
                        Ceros
                      </button>
                    </div>
                  </div>

                  {/* MATRIZ B (Solo visible si es operación binaria) */}
                  {isBinaryOp ? (
                    <div className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-zinc-200 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-400" /> Matriz B ({rowsB}×{colsB})
                        </span>

                        {/* Dimensiones rápidas B */}
                        <div className="flex items-center gap-1 text-[10px] font-mono">
                          <button
                            type="button"
                            onClick={() => handleSetDimB(2, 2)}
                            className={`px-2 py-0.5 rounded ${rowsB === 2 && colsB === 2 ? "bg-zinc-800 text-zinc-100" : "text-zinc-500"}`}
                          >
                            2×2
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetDimB(3, 3)}
                            className={`px-2 py-0.5 rounded ${rowsB === 3 && colsB === 3 ? "bg-zinc-800 text-zinc-100" : "text-zinc-500"}`}
                          >
                            3×3
                          </button>
                          {selectedOp === "mul" && (
                            <button
                              type="button"
                              onClick={() => handleSetDimB(colsA, 1)}
                              className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300"
                              title="Vector columna compatible con A"
                            >
                              {colsA}×1
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="relative py-1 flex items-center justify-center">
                        <div className="border-l-2 border-t-2 border-b-2 border-zinc-600 rounded-l-md w-3 self-stretch" />
                        <div
                          className="grid gap-2 p-2 max-w-full overflow-x-auto"
                          style={{ gridTemplateColumns: `repeat(${colsB}, minmax(44px, 58px))` }}
                        >
                          {matrixB.map((row, rIdx) =>
                            row.map((val, cIdx) => (
                              <input
                                key={`${rIdx}-${cIdx}`}
                                type="number"
                                value={val}
                                onChange={(e) => updateCellB(rIdx, cIdx, parseFloat(e.target.value))}
                                className="h-11 bg-zinc-900 border border-zinc-800 rounded-xl font-mono text-sm text-center text-zinc-100 focus:outline-none focus:border-rose-400/80 transition-colors"
                              />
                            ))
                          )}
                        </div>
                        <div className="border-r-2 border-t-2 border-b-2 border-zinc-600 rounded-r-md w-3 self-stretch" />
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-1 border-t border-zinc-800/60">
                        <button
                          type="button"
                          onClick={() => setMatrixB(matrixB.map((row, r) => row.map((_, c) => (r === c ? 1 : 0))))}
                          className="hover:text-zinc-300"
                        >
                          Identidad
                        </button>
                        <button
                          type="button"
                          onClick={() => setMatrixB(matrixB.map((row) => row.map(() => 0)))}
                          className="hover:text-zinc-300"
                        >
                          Ceros
                        </button>
                      </div>
                    </div>
                  ) : selectedOp === "scalar" ? (
                    /* Configuración de Escalar k */
                    <div className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 space-y-3 flex flex-col justify-center">
                      <span className="text-xs font-mono font-bold text-zinc-200 block">
                        Valor del Escalar (k):
                      </span>
                      <input
                        type="number"
                        value={scalarK}
                        onChange={(e) => setScalarK(parseFloat(e.target.value) || 0)}
                        className="h-12 bg-zinc-900 border border-zinc-800 rounded-xl font-mono text-base text-center text-amber-400 font-bold focus:outline-none focus:border-amber-400/80"
                      />
                      <p className="text-[11px] text-zinc-500 font-mono text-center">
                        Cada elemento a_{"ij"} se multiplicará por {scalarK}.
                      </p>
                    </div>
                  ) : (
                    /* Espacio Informativo Unario */
                    <div className="p-4 rounded-2xl bg-zinc-950/40 border border-zinc-800/60 flex flex-col justify-center text-center text-xs space-y-1">
                      <span className="font-mono text-zinc-400 font-semibold">{calculation.title}</span>
                      <p className="text-[11px] text-zinc-500">{calculation.statusDesc}</p>
                    </div>
                  )}

                </div>
              </div>

              {/* Botón de Guardado */}
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

            {/* Caja Derecha: Resultado Matricial */}
            <div className="lg:col-span-4 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden">
              <div className="pointer-events-none absolute -bottom-16 -right-16 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl" />

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold">
                    Resultado
                  </span>
                  {(calculation.resultMatrix || calculation.scalarResult !== null) && (
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
                    {calculation.title}
                  </span>

                  {/* Renderizado de la Matriz Resultante con KaTeX */}
                  {calculation.resultMatrix ? (
                    <div className="py-2 flex items-center justify-center font-mono text-emerald-400 overflow-x-auto text-sm">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {`$$${matrixToLaTeX(calculation.resultMatrix)}$$`}
                      </ReactMarkdown>
                    </div>
                  ) : calculation.scalarResult !== null ? (
                    <div className="text-4xl font-serif font-bold text-emerald-400">
                      {calculation.scalarResult}
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-red-950/20 border border-red-900/40 text-xs text-red-300 text-center font-mono">
                      {calculation.error || "Operación Incompatible"}
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 text-xs text-zinc-400 leading-relaxed font-sans">
                  {calculation.statusDesc}
                </div>
              </div>

              {/* Insignia de Algoritmo */}
              <div className="relative z-10 border-t border-zinc-800/60 pt-3.5">
                <button
                  type="button"
                  onClick={() => setIsMethodInfoOpen(!isMethodInfoOpen)}
                  className="w-full p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/70 hover:border-zinc-700 flex items-center justify-between text-[11px] font-mono transition-colors group"
                >
                  <div className="flex items-center gap-1.5 text-zinc-400 group-hover:text-zinc-200 truncate">
                    <Info size={12} className="text-amber-400 shrink-0" />
                    <span>Propiedades y Complejidad O(n³)</span>
                  </div>
                  <ChevronRight size={12} className="text-zinc-600 group-hover:text-zinc-300 shrink-0" />
                </button>
              </div>
            </div>
          </div>

          {/* FILA INFERIOR: PASO A PASO + HISTORIAL */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
            
            {/* Panel Izquierdo: Desglose Algorítmico */}
            <div className="lg:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <ListOrdered size={15} className="text-zinc-400" /> Desglose Celda por Celda / Operaciones de Fila
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
                    <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 font-mono text-xs text-emerald-400 text-center font-bold overflow-x-auto">
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
                  <History size={15} className="text-zinc-400" /> Historial Matricial
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
                    <p>Sin matrices guardadas.</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Guarda transformaciones para auditar.</p>
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
                Procedimiento Matricial Detallado
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                Operación: {calculation.title}
              </p>
            </div>
            <div className="text-xs font-mono px-4 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-zinc-300 shadow-inner">
              Algoritmo: <strong className="text-emerald-400 text-sm font-serif">{selectedOp.toUpperCase()}</strong>
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
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 font-mono text-xs text-emerald-400 text-center font-bold overflow-x-auto">
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
              <BookOpen size={12} /> Álgebra Lineal y Computación
            </div>
            <h3 className="text-2xl font-serif font-bold text-zinc-100">
              Matrices como Operadores de Transformación Espacial
            </h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-3xl">
              En ciencias de la computación, una matriz no es solo una tabla: representa una transformación lineal del espacio geométrico y la estructura fundamental del procesamiento paralelo en GPUs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                1. Gráficos 3D y Shaders (Pipelines)
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Toda rotación, traslación y proyección en videojuegos 3D (OpenGL, DirectX) se calcula multiplicando matrices 4×4 por vectores de vértices en los Vertex Shaders.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                2. Redes Neuronales y Tensores (IA)
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Una capa densa en Deep Learning calcula y = σ(W · x + b), donde W es una matriz de pesos sinápticos que transforma el vector de entrada x mediante multiplicación de matrices.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                3. Algoritmo PageRank de Google
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Google modela la web completa como una matriz estocástica gigante de adyacencia y calcula su vector propio principal (Eigenvector) para ordenar las páginas por relevancia.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                4. No Conmutatividad (A × B ≠ B × A)
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                El orden de las transformaciones altera el resultado final: rotar un objeto 3D y luego moverlo produce una posición completamente diferente a moverlo y luego rotarlo.
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
                  <Cpu size={15} className="text-amber-400" /> Complejidad Algorítmica de Matrices
                </h4>
                <button onClick={() => setIsMethodInfoOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-100">
                  <X size={16} />
                </button>
              </div>
              <div className="text-xs text-zinc-400 mt-3 space-y-2 leading-relaxed font-sans">
                <p>
                  • <strong>Multiplicación Estándar:</strong> Complejidad O(n³). Algoritmos como Strassen la reducen a O(n^{2.807}) para matrices gigantes en supercomputadoras.
                </p>
                <p>
                  • <strong>Inversión por Gauss-Jordan:</strong> Complejidad O(n³). Requiere pivoteo numérico para evitar errores de coma flotante IEEE-754.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE AYUDA CON EJEMPLOS DE INFORMÁTICA */}
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
                  <Terminal size={16} className="text-amber-400" />
                  <h3 className="text-base font-serif font-bold text-zinc-100">Casos Prácticos de Matrices en Computación</h3>
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
                        setSelectedOp(ex.op);
                        setRowsA(ex.matrixA.length);
                        setColsA(ex.matrixA[0].length);
                        setMatrixA(ex.matrixA);
                        if (ex.matrixB) {
                          setRowsB(ex.matrixB.length);
                          setColsB(ex.matrixB[0].length);
                          setMatrixB(ex.matrixB);
                        }
                        if (ex.scalar) setScalarK(ex.scalar);
                        setIsHelpOpen(false);
                      }}
                      className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-left transition-all flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-[10px] font-mono text-amber-400/90 block font-semibold">{ex.category}</span>
                        <span className="font-mono text-zinc-200 text-xs block font-bold truncate">
                          Operación: {ex.op.toUpperCase()}
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