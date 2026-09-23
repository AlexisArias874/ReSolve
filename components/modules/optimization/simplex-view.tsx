"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  Check,
  History,
  Trash2,
  BookOpen,
  Sparkles,
  HelpCircle,
  X,
  Plus,
  Minus,
  Maximize2,
  Minimize2,
  ChevronRight,
  RotateCcw,
  Sliders,
  Table as TableIcon,
  Scale,
  ArrowRight,
  ArrowLeft,
  Activity,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Compass,
  Cpu,
  Binary,
  Terminal
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
// TIPOS Y MODELOS DEL MÉTODO SIMPLEX
// -----------------------------------------------------------------------------
export type SimplexMethodType = "primal" | "two_phase" | "big_m";
export type ObjectiveSense = "max" | "min";
export type ConstraintOperator = "<=" | ">=" | "=";

export interface SimplexConstraint {
  id: string;
  coefficients: number[];
  operator: ConstraintOperator;
  rhs: number;
}

export interface DetailedTableau {
  iteration: number;
  stageName: string;
  headers: string[];
  basicVars: string[];
  matrix: number[][]; // [Fila Z/W, ...Filas Restricciones]
  ratios: (number | null)[]; // Columna theta = b_i / a_ik
  pivotRow: number | null;
  pivotCol: number | null;
  pivotElement: number | null;
  rowOperations: string[];
}

export interface SimplexResult {
  status: "optimal" | "unbounded" | "infeasible" | "degeneracy";
  optimalZ: number;
  solution: Record<string, number>;
  tableaus: DetailedTableau[];
  iterationsCount: number;
  enteringVars: string[];
  leavingVars: string[];
}

interface ModuleExample {
  title: string;
  category: string;
  desc: string;
  method: SimplexMethodType;
  sense: ObjectiveSense;
  objective: number[];
  varNames: string[];
  constraints: { coeffs: number[]; op: ConstraintOperator; rhs: number }[];
}

const MODULE_EXAMPLES: ModuleExample[] = [
  {
    title: "Maximización Estándar (3 Variables, 3 Recursos)",
    category: "Investigación Operativa Clásica",
    desc: "Problema de asignación industrial donde todas las restricciones son de holgura (≤).",
    method: "primal",
    sense: "max",
    objective: [3, 2, 5],
    varNames: ["x₁", "x₂", "x₃"],
    constraints: [
      { coeffs: [1, 2, 1], op: "<=", rhs: 430 },
      { coeffs: [3, 0, 2], op: "<=", rhs: 460 },
      { coeffs: [1, 4, 0], op: "<=", rhs: 420 },
    ],
  },
  {
    title: "Minimización con Método de Dos Fases",
    category: "Variables Artificiales",
    desc: "Modelo de costos con requerimientos mínimos (≥) que exige variables artificiales.",
    method: "two_phase",
    sense: "min",
    objective: [4, 1],
    varNames: ["x₁", "x₂"],
    constraints: [
      { coeffs: [3, 1], op: "=", rhs: 3 },
      { coeffs: [4, 3], op: ">=", rhs: 6 },
      { coeffs: [1, 2], op: "<=", rhs: 4 },
    ],
  },
  {
    title: "Penalización por Gran M (Big-M)",
    category: "Penalización Algebraica",
    desc: "Resolución directa asignando un costo artificial M >> 0 a las variables de holgura.",
    method: "big_m",
    sense: "max",
    objective: [2, 3],
    varNames: ["x₁", "x₂"],
    constraints: [
      { coeffs: [1, 2], op: "<=", rhs: 4 },
      { coeffs: [1, 1], op: "=", rhs: 3 },
    ],
  },
  {
    title: "Detección de Solución No Acotada (Unbounded)",
    category: "Casos Especiales",
    desc: "Columna pivote con coeficientes negativos/nulos donde Z puede crecer al infinito.",
    method: "primal",
    sense: "max",
    objective: [2, 1],
    varNames: ["x₁", "x₂"],
    constraints: [
      { coeffs: [1, -1], op: "<=", rhs: 10 },
      { coeffs: [-2, 1], op: "<=", rhs: 40 },
    ],
  },
];

// -----------------------------------------------------------------------------
// MOTOR MATEMÁTICO: ALGORITMO SIMPLEX COMPLETO Y DIDÁCTICO
// -----------------------------------------------------------------------------
function executeSimplexEngine(
  sense: ObjectiveSense,
  rawObj: number[],
  varNames: string[],
  constraints: SimplexConstraint[],
  method: SimplexMethodType
): SimplexResult {
  const isMax = sense === "max";
  const numVars = rawObj.length;
  const numConstraints = constraints.length;

  // Ajuste de función objetivo (siempre maximizamos Z internamente)
  const objCoeffs = rawObj.map((c) => (isMax ? c : -c));

  let slackCount = 0;
  let surplusCount = 0;
  let artificialCount = 0;

  constraints.forEach((c) => {
    if (c.operator === "<=") slackCount++;
    else if (c.operator === ">=") {
      surplusCount++;
      artificialCount++;
    } else if (c.operator === "=") {
      artificialCount++;
    }
  });

  const headers: string[] = [
    ...varNames,
    ...Array.from({ length: slackCount }, (_, i) => `s${i + 1}`),
    ...Array.from({ length: surplusCount }, (_, i) => `e${i + 1}`),
    ...Array.from({ length: artificialCount }, (_, i) => `R${i + 1}`),
    "b (RHS)",
  ];

  const totalCols = headers.length; // incluye RHS
  const totalVars = totalCols - 1;

  // Construcción de la matriz inicial
  const A: number[][] = [];
  const b: number[] = [];
  const basicVars: string[] = [];

  let curSlack = 0;
  let curSurplus = 0;
  let curArt = 0;

  constraints.forEach((c) => {
    let rhs = c.rhs;
    let coeffs = [...c.coefficients];
    let op = c.operator;

    if (rhs < 0) {
      rhs = -rhs;
      coeffs = coeffs.map((v) => -v);
      if (op === "<=") op = ">=";
      else if (op === ">=") op = "<=";
    }

    const row = new Array(totalVars).fill(0);
    for (let j = 0; j < numVars; j++) {
      row[j] = coeffs[j] || 0;
    }

    if (op === "<=") {
      row[numVars + curSlack] = 1;
      basicVars.push(`s${curSlack + 1}`);
      curSlack++;
    } else if (op === ">=") {
      row[numVars + slackCount + curSurplus] = -1;
      row[numVars + slackCount + surplusCount + curArt] = 1;
      basicVars.push(`R${curArt + 1}`);
      curSurplus++;
      curArt++;
    } else {
      row[numVars + slackCount + surplusCount + curArt] = 1;
      basicVars.push(`R${curArt + 1}`);
      curArt++;
    }

    A.push(row);
    b.push(rhs);
  });

  const tableaus: DetailedTableau[] = [];
  const enteringVars: string[] = [];
  const leavingVars: string[] = [];

  // ===========================================================================
  // FASE 1: Si existen variables artificiales y se usa Dos Fases
  // ===========================================================================
  let tableau = A.map((row, i) => [...row, b[i]]);

  if (artificialCount > 0 && method === "two_phase") {
    const rowW = new Array(totalCols).fill(0);
    const artStart = numVars + slackCount + surplusCount;

    for (let i = 0; i < artificialCount; i++) {
      rowW[artStart + i] = 1;
    }

    // Canonicalizar fila W restando las restricciones asociadas
    for (let i = 0; i < numConstraints; i++) {
      if (basicVars[i].startsWith("R")) {
        for (let j = 0; j < totalCols; j++) {
          rowW[j] -= tableau[i][j];
        }
      }
    }

    let p1Tableau = [rowW, ...tableau.map((r) => [...r])];

    // Iteraciones Fase 1
    let p1Iter = 0;
    while (p1Iter < 15) {
      p1Iter++;
      let pivotCol: number | null = null;
      let minVal = -1e-6;

      for (let j = 0; j < totalVars; j++) {
        if (p1Tableau[0][j] < minVal) {
          minVal = p1Tableau[0][j];
          pivotCol = j;
        }
      }

      // Cálculo de razones theta
      const ratios: (number | null)[] = [null]; // Fila W no tiene ratio
      let pivotRow: number | null = null;
      let minRatio = Infinity;

      if (pivotCol !== null) {
        for (let i = 1; i <= numConstraints; i++) {
          const a_ij = p1Tableau[i][pivotCol];
          if (a_ij > 1e-6) {
            const ratio = p1Tableau[i][totalVars] / a_ij;
            ratios.push(Number(ratio.toFixed(4)));
            if (ratio < minRatio) {
              minRatio = ratio;
              pivotRow = i;
            }
          } else {
            ratios.push(null);
          }
        }
      } else {
        for (let i = 1; i <= numConstraints; i++) ratios.push(null);
      }

      const currentPivotEl =
        pivotRow !== null && pivotCol !== null ? p1Tableau[pivotRow][pivotCol] : null;

      const rowOps: string[] = [];
      if (pivotRow !== null && pivotCol !== null && currentPivotEl !== null) {
        rowOps.push(`R_{${pivotRow}} \\leftarrow R_{${pivotRow}} / (${Number(currentPivotEl.toFixed(3))})`);
        rowOps.push(`Entra variable ${headers[pivotCol]}, sale ${basicVars[pivotRow - 1]}`);
      }

      tableaus.push({
        iteration: tableaus.length + 1,
        stageName: `Fase 1 (Minimizar W) - Iteración ${p1Iter}`,
        headers,
        basicVars: ["-W", ...basicVars],
        matrix: p1Tableau.map((r) => r.map((val) => Number(val.toFixed(4)))),
        ratios,
        pivotRow,
        pivotCol,
        pivotElement: currentPivotEl ? Number(currentPivotEl.toFixed(4)) : null,
        rowOperations: rowOps,
      });

      if (pivotCol === null) break; // Fase 1 Óptima

      if (pivotRow === null) {
        return {
          status: "unbounded",
          optimalZ: 0,
          solution: {},
          tableaus,
          iterationsCount: tableaus.length,
          enteringVars,
          leavingVars,
        };
      }

      // Pivoteo Gauss-Jordan
      enteringVars.push(headers[pivotCol]);
      leavingVars.push(basicVars[pivotRow - 1]);
      basicVars[pivotRow - 1] = headers[pivotCol];

      const pVal = p1Tableau[pivotRow][pivotCol];
      for (let j = 0; j < totalCols; j++) {
        p1Tableau[pivotRow][j] /= pVal;
      }

      for (let i = 0; i <= numConstraints; i++) {
        if (i !== pivotRow) {
          const factor = p1Tableau[i][pivotCol];
          for (let j = 0; j < totalCols; j++) {
            p1Tableau[i][j] -= factor * p1Tableau[pivotRow][j];
          }
        }
      }
    }

    if (Math.abs(p1Tableau[0][totalVars]) > 1e-4) {
      return {
        status: "infeasible",
        optimalZ: 0,
        solution: {},
        tableaus,
        iterationsCount: tableaus.length,
        enteringVars,
        leavingVars,
      };
    }

    tableau = p1Tableau.slice(1);
  }

  // ===========================================================================
  // FASE 2 / SIMPLEX PRIMAL: Optimización de la Función Objetivo Z
  // ===========================================================================
  const rowZ = new Array(totalCols).fill(0);
  for (let j = 0; j < numVars; j++) {
    rowZ[j] = -objCoeffs[j];
  }

  // Canonicalizar fila Z respecto a las variables básicas actuales
  for (let i = 0; i < numConstraints; i++) {
    const bVar = basicVars[i];
    const colIdx = headers.indexOf(bVar);
    if (colIdx !== -1 && colIdx < numVars) {
      const c_val = objCoeffs[colIdx];
      for (let j = 0; j < totalCols; j++) {
        rowZ[j] += c_val * tableau[i][j];
      }
    }
  }

  let p2Tableau = [rowZ, ...tableau.map((r) => [...r])];

  let p2Iter = 0;
  while (p2Iter < 20) {
    p2Iter++;

    let pivotCol: number | null = null;
    let minVal = -1e-6;

    for (let j = 0; j < totalVars; j++) {
      if (headers[j].startsWith("R")) continue; // Ignorar artificiales en Fase 2
      if (p2Tableau[0][j] < minVal) {
        minVal = p2Tableau[0][j];
        pivotCol = j;
      }
    }

    const ratios: (number | null)[] = [null];
    let pivotRow: number | null = null;
    let minRatio = Infinity;

    if (pivotCol !== null) {
      for (let i = 1; i <= numConstraints; i++) {
        const a_ij = p2Tableau[i][pivotCol];
        if (a_ij > 1e-6) {
          const ratio = p2Tableau[i][totalVars] / a_ij;
          ratios.push(Number(ratio.toFixed(4)));
          if (ratio < minRatio) {
            minRatio = ratio;
            pivotRow = i;
          }
        } else {
          ratios.push(null);
        }
      }
    } else {
      for (let i = 1; i <= numConstraints; i++) ratios.push(null);
    }

    const currentPivotEl =
      pivotRow !== null && pivotCol !== null ? p2Tableau[pivotRow][pivotCol] : null;

    const rowOps: string[] = [];
    if (pivotRow !== null && pivotCol !== null && currentPivotEl !== null) {
      rowOps.push(`R_{${pivotRow}} \\leftarrow R_{${pivotRow}} / (${Number(currentPivotEl.toFixed(3))})`);
      rowOps.push(`Entra variable ${headers[pivotCol]}, sale ${basicVars[pivotRow - 1]}`);
    }

    tableaus.push({
      iteration: tableaus.length + 1,
      stageName:
        artificialCount > 0 && method === "two_phase"
          ? `Fase 2 (Optimización Z) - Iteración ${p2Iter}`
          : `Simplex Primal - Iteración ${p2Iter}`,
      headers,
      basicVars: ["Z", ...basicVars],
      matrix: p2Tableau.map((r) => r.map((val) => Number(val.toFixed(4)))),
      ratios,
      pivotRow,
      pivotCol,
      pivotElement: currentPivotEl ? Number(currentPivotEl.toFixed(4)) : null,
      rowOperations: rowOps,
    });

    if (pivotCol === null) break; // Óptimo alcanzado

    if (pivotRow === null) {
      return {
        status: "unbounded",
        optimalZ: Infinity,
        solution: {},
        tableaus,
        iterationsCount: tableaus.length,
        enteringVars,
        leavingVars,
      };
    }

    enteringVars.push(headers[pivotCol]);
    leavingVars.push(basicVars[pivotRow - 1]);
    basicVars[pivotRow - 1] = headers[pivotCol];

    const pVal = p2Tableau[pivotRow][pivotCol];
    for (let j = 0; j < totalCols; j++) {
      p2Tableau[pivotRow][j] /= pVal;
    }

    for (let i = 0; i <= numConstraints; i++) {
      if (i !== pivotRow) {
        const factor = p2Tableau[i][pivotCol];
        for (let j = 0; j < totalCols; j++) {
          p2Tableau[i][j] -= factor * p2Tableau[pivotRow][j];
        }
      }
    }
  }

  // Extracción de la solución óptima
  const solution: Record<string, number> = {};
  varNames.forEach((v) => (solution[v] = 0));

  for (let i = 0; i < numConstraints; i++) {
    const bVar = basicVars[i];
    if (solution[bVar] !== undefined) {
      solution[bVar] = Number(p2Tableau[i + 1][totalVars].toFixed(4));
    }
  }

  let finalZ = p2Tableau[0][totalVars];
  if (!isMax) finalZ = -finalZ;

  return {
    status: "optimal",
    optimalZ: Number(finalZ.toFixed(4)),
    solution,
    tableaus,
    iterationsCount: tableaus.length,
    enteringVars,
    leavingVars,
  };
}

// -----------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// -----------------------------------------------------------------------------
export default function SimplexView({
  viewMode,
  initialExpression = "",
}: {
  viewMode: "calc" | "steps" | "theory";
  initialExpression?: string;
}) {
  const [method, setMethod] = useState<SimplexMethodType>("primal");
  const [sense, setSense] = useState<ObjectiveSense>("max");
  const [varNames, setVarNames] = useState<string[]>(["x₁", "x₂", "x₃"]);
  const [objective, setObjective] = useState<number[]>([3, 2, 5]);
  const [constraints, setConstraints] = useState<SimplexConstraint[]>([
    { id: "c1", coefficients: [1, 2, 1], operator: "<=", rhs: 430 },
    { id: "c2", coefficients: [3, 0, 2], operator: "<=", rhs: 460 },
    { id: "c3", coefficients: [1, 4, 0], operator: "<=", rhs: 420 },
  ]);

  const [currentTableauIndex, setCurrentTableauIndex] = useState<number>(0);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);

  const { setAIContext, injectedExpression, clearInjectedExpression } = useAIContext();

  // Manipulación de Variables Dinámicas
  const handleAddVar = () => {
    const nextIdx = varNames.length + 1;
    setVarNames((prev) => [...prev, `x${nextIdx}`]);
    setObjective((prev) => [...prev, 1]);
    setConstraints((prev) =>
      prev.map((c) => ({ ...c, coefficients: [...c.coefficients, 0] }))
    );
  };

  const handleRemoveVar = () => {
    if (varNames.length <= 2) return;
    setVarNames((prev) => prev.slice(0, -1));
    setObjective((prev) => prev.slice(0, -1));
    setConstraints((prev) =>
      prev.map((c) => ({ ...c, coefficients: c.coefficients.slice(0, -1) }))
    );
  };

  // Manipulación de Restricciones
  const handleAddConstraint = () => {
    setConstraints((prev) => [
      ...prev,
      {
        id: `c_${Date.now()}`,
        coefficients: new Array(varNames.length).fill(0),
        operator: "<=",
        rhs: 100,
      },
    ]);
  };

  const handleRemoveConstraint = (id: string) => {
    if (constraints.length <= 1) return;
    setConstraints((prev) => prev.filter((c) => c.id !== id));
  };

  // Ejecución del motor
  const result = useMemo(() => {
    return executeSimplexEngine(sense, objective, varNames, constraints, method);
  }, [sense, objective, varNames, constraints, method]);

  // Asegurar que el stepper esté en rango válido al cambiar el modelo
  useEffect(() => {
    if (currentTableauIndex >= result.tableaus.length) {
      setCurrentTableauIndex(Math.max(0, result.tableaus.length - 1));
    }
  }, [result.tableaus.length, currentTableauIndex]);

  const currentTableau = result.tableaus[currentTableauIndex] || result.tableaus[0];

  // Sincronización con ReSolve AI (Emisor)
  useEffect(() => {
    const solStr = Object.entries(result.solution)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");
    const summary = `Simplex (${method.toUpperCase()}) | ${sense.toUpperCase()} Z = ${result.optimalZ} | Estado: ${result.status} | Iteraciones: ${result.iterationsCount} | Solución: [${solStr}]`;

    setAIContext({
      module: "Matemáticas VI",
      subtopic: "Método Simplex Algorítmico",
      expression: `${sense.toUpperCase()} Z = ${objective.map((c, i) => `${c}${varNames[i]}`).join(" + ")}`,
      result: `Z* = ${result.optimalZ}`,
      details: summary,
    });
  }, [result, method, sense, objective, varNames, setAIContext]);

  // Receptor de IA
  useEffect(() => {
    if (injectedExpression) {
      try {
        const parsed = JSON.parse(injectedExpression);
        if (parsed.objective && Array.isArray(parsed.objective) && parsed.constraints) {
          setSense(parsed.sense || "max");
          setMethod(parsed.method || "primal");
          setObjective(parsed.objective);
          setVarNames(parsed.varNames || parsed.objective.map((_: any, i: number) => `x${i + 1}`));
          setConstraints(
            parsed.constraints.map((c: any, idx: number) => ({
              id: `c_${idx}`,
              coefficients: c.coeffs || c.coefficients,
              operator: c.op || c.operator || "<=",
              rhs: c.rhs !== undefined ? c.rhs : 100,
            }))
          );
        }
      } catch {
        // Silencioso
      }
      clearInjectedExpression();
    }
  }, [injectedExpression, clearInjectedExpression]);

  // Persistencia Supabase
  useEffect(() => {
    fetchUserHistory("mat6", "simplex").then((data) => setHistory(data));
  }, []);

  const saveCalculation = async () => {
    const title = `Simplex ${method.toUpperCase()} (${sense.toUpperCase()} Z)`;
    const resSummary = `Z* = ${result.optimalZ} (${result.status}, ${result.iterationsCount} iter)`;
    await saveUserCalculation("mat6", "simplex", title, resSummary);
    const refreshed = await fetchUserHistory("mat6", "simplex");
    setHistory(refreshed);
  };

  const clearHistory = async () => {
    await deleteUserHistory("simplex");
    setHistory([]);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`Z* = ${result.optimalZ}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    // REGLA 1 & 2: Ancestro raíz con relative explícito y cadena de alturas resuelta
    <div className="h-full flex flex-col gap-6 min-h-0 relative select-none">
      {viewMode === "calc" && (
        <div className="flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto custom-scrollbar pr-1">
          {/* BARRA DE SELECCIÓN DE MÉTODO */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-zinc-900/40 border border-zinc-800/60 rounded-2xl shrink-0 backdrop-blur-xl">
            <div className="flex flex-wrap items-center gap-1.5">
              {(["primal", "two_phase", "big_m"] as SimplexMethodType[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-mono transition-all capitalize flex items-center gap-1.5 ${
                    method === m
                      ? "bg-zinc-100 text-zinc-950 font-bold shadow-md"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Binary size={13} />
                  <span>
                    {m === "primal" ? "Simplex Primal" : m === "two_phase" ? "Dos Fases" : "Gran M"}
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsHelpOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-[11px] font-mono text-zinc-300 transition-colors flex items-center gap-1.5 shadow-sm ml-auto"
            >
              <Sparkles size={13} className="text-amber-400" />
              <span>Modelos de Prueba</span>
            </button>
          </div>

          {/* SECCIÓN SUPERIOR: CONFIGURACIÓN DEL MODELO + HERO CARD */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 shrink-0">
            {/* Panel Izquierdo: Constructor Matricial */}
            <div className="xl:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 space-y-5 overflow-hidden">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/60 pb-3">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-2">
                    <Scale size={14} className="text-zinc-500" />
                    Planteamiento del Tablero Simplex
                  </span>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl p-0.5">
                      <button
                        type="button"
                        onClick={handleRemoveVar}
                        disabled={varNames.length <= 2}
                        className="p-1 text-zinc-400 hover:text-zinc-100 disabled:opacity-30"
                        title="Quitar variable"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="px-2 text-[10px] font-mono text-zinc-300 font-bold">
                        {varNames.length} Vars
                      </span>
                      <button
                        type="button"
                        onClick={handleAddVar}
                        className="p-1 text-zinc-400 hover:text-zinc-100"
                        title="Añadir variable"
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    <div className="flex bg-zinc-900 p-0.5 rounded-xl border border-zinc-800 text-xs font-mono">
                      <button
                        type="button"
                        onClick={() => setSense("max")}
                        className={`px-3 py-1 rounded-lg transition-all ${
                          sense === "max"
                            ? "bg-emerald-500 text-zinc-950 font-bold shadow-md"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        Max
                      </button>
                      <button
                        type="button"
                        onClick={() => setSense("min")}
                        className={`px-3 py-1 rounded-lg transition-all ${
                          sense === "min"
                            ? "bg-amber-400 text-zinc-950 font-bold shadow-md"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        Min
                      </button>
                    </div>
                  </div>
                </div>

                {/* Coeficientes Z */}
                <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 space-y-2">
                  <span className="text-xs font-mono font-semibold text-zinc-300 block">
                    Función Objetivo Z:
                  </span>
                  <div className="flex flex-wrap items-center gap-2 overflow-x-auto py-1">
                    <span className="text-sm font-serif font-bold text-zinc-400">Z =</span>
                    {varNames.map((vName, idx) => (
                      <div key={vName} className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.5"
                          value={objective[idx] ?? 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setObjective((prev) => {
                              const next = [...prev];
                              next[idx] = val;
                              return next;
                            });
                          }}
                          className="w-16 h-9 bg-zinc-900 border border-zinc-800 rounded-xl font-mono text-sm text-center text-zinc-100 focus:outline-none focus:border-emerald-500"
                        />
                        <span className="font-mono text-xs font-bold text-emerald-400">{vName}</span>
                        {idx < varNames.length - 1 && <span className="text-zinc-600">+</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Restricciones Tecnológicas */}
                <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold text-zinc-300">
                      Restricciones Matriciales (A · x ≤, ≥, = b):
                    </span>
                    <button
                      type="button"
                      onClick={handleAddConstraint}
                      className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs font-mono text-zinc-300 flex items-center gap-1 transition-colors"
                    >
                      <Plus size={12} className="text-emerald-400" /> Añadir Fila
                    </button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                    {constraints.map((c, rIdx) => (
                      <div
                        key={c.id}
                        className="flex flex-wrap items-center gap-2 p-2 rounded-xl bg-zinc-900/60 border border-zinc-800/60"
                      >
                        <span className="text-[10px] font-mono text-zinc-500 w-6">F{rIdx + 1}:</span>
                        {varNames.map((vName, vIdx) => (
                          <div key={vName} className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.5"
                              value={c.coefficients[vIdx] ?? 0}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setConstraints((prev) =>
                                  prev.map((item) => {
                                    if (item.id !== c.id) return item;
                                    const nextCoeffs = [...item.coefficients];
                                    nextCoeffs[vIdx] = val;
                                    return { ...item, coefficients: nextCoeffs };
                                  })
                                );
                              }}
                              className="w-14 h-8 bg-zinc-950 border border-zinc-800 rounded-lg font-mono text-xs text-center text-zinc-100 focus:outline-none focus:border-sky-500"
                            />
                            <span className="text-[11px] font-mono text-zinc-400">{vName}</span>
                            {vIdx < varNames.length - 1 && <span className="text-zinc-700">+</span>}
                          </div>
                        ))}

                        <select
                          value={c.operator}
                          onChange={(e) => {
                            const op = e.target.value as ConstraintOperator;
                            setConstraints((prev) =>
                              prev.map((item) => (item.id === c.id ? { ...item, operator: op } : item))
                            );
                          }}
                          className="h-8 bg-zinc-950 border border-zinc-800 rounded-lg font-mono text-xs text-amber-400 px-2 focus:outline-none cursor-pointer"
                        >
                          <option value="<=">≤</option>
                          <option value=">=">≥</option>
                          <option value="=">=</option>
                        </select>

                        <input
                          type="number"
                          value={c.rhs}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setConstraints((prev) =>
                              prev.map((item) => (item.id === c.id ? { ...item, rhs: val } : item))
                            );
                          }}
                          className="w-16 h-8 bg-zinc-950 border border-zinc-800 rounded-lg font-mono text-xs text-center text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
                        />

                        <button
                          type="button"
                          onClick={() => handleRemoveConstraint(c.id)}
                          disabled={constraints.length <= 1}
                          className="p-1 text-zinc-600 hover:text-rose-400 disabled:opacity-20 ml-auto"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Botón Guardar */}
              <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-500">
                  Persistencia ReSolve · Simplex Gauss-Jordan
                </span>
                <button
                  type="button"
                  onClick={saveCalculation}
                  className="px-5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-semibold text-xs rounded-xl shadow-md transition-all active:scale-95"
                >
                  Guardar en Historial
                </button>
              </div>
            </div>

            {/* Panel Derecho: Hero Card con Solución Óptima */}
            <div className="xl:col-span-4 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden relative">
              <div className="pointer-events-none absolute -bottom-16 -right-16 w-52 h-52 bg-emerald-500/10 rounded-full blur-3xl" />

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold">
                    Valor Óptimo Z*
                  </span>
                  <button
                    onClick={handleCopy}
                    className="text-xs text-zinc-400 hover:text-zinc-100 flex items-center gap-1.5 transition-colors py-1 px-2.5 rounded-lg border border-zinc-800/60 bg-zinc-900/50"
                  >
                    {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                </div>

                <div className="py-2 text-center">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-1">
                    {sense === "max" ? "Máximo Valor Obtenido" : "Mínimo Costo Obtenido"}
                  </span>
                  <div
                    className={`text-5xl font-serif font-bold tracking-tight ${
                      result.status === "optimal"
                        ? "text-emerald-400"
                        : result.status === "unbounded"
                        ? "text-amber-400"
                        : "text-rose-400"
                    }`}
                  >
                    {result.status === "optimal"
                      ? result.optimalZ
                      : result.status === "unbounded"
                      ? "∞ (No Acot.)"
                      : "Infactible"}
                  </div>
                  <span className="text-[11px] font-mono text-zinc-400 mt-2 block">
                    {result.status === "optimal"
                      ? `Convergencia en ${result.iterationsCount} tabla(s)`
                      : result.status === "unbounded"
                      ? "Dirección de crecimiento no acotada"
                      : "Región factible vacía"}
                  </span>
                </div>

                {/* Vector de Solución Óptimo X* */}
                <div className="space-y-2 font-mono text-xs">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">
                    Variables de Decisión Óptimas:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {varNames.map((vName) => (
                      <div
                        key={vName}
                        className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70 flex justify-between items-center"
                      >
                        <span className="text-zinc-400 font-bold">{vName}:</span>
                        <strong className="text-emerald-400 text-sm">
                          {result.status === "optimal" ? result.solution[vName] ?? 0 : "—"}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Métricas del Algoritmo */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                    <span className="text-[10px] text-zinc-500 block">Iteraciones</span>
                    <strong className="text-sky-400">{result.iterationsCount}</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                    <span className="text-[10px] text-zinc-500 block">Algoritmo</span>
                    <strong className="text-amber-300 capitalize">{method}</strong>
                  </div>
                </div>
              </div>

              <div className="relative z-10 border-t border-zinc-800/60 pt-3 mt-3">
                <div className="text-[11px] font-mono text-zinc-500 flex items-center justify-between">
                  <span>Variables en la Base Óptima:</span>
                  <span className="text-emerald-400 font-bold">
                    {currentTableau?.basicVars.slice(1).join(", ") || "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN INFERIOR: NAVEGADOR DE TABLEROS SIMPLEX (REGLAS 1, 3, 4, 9) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-1 min-h-0">
            {/* Visualizador de Tablas Simplex */}
            <div
              className={`${
                isExpanded
                  ? "absolute inset-0 z-30 bg-zinc-950/95 backdrop-blur-2xl border border-zinc-700/80 rounded-3xl p-6 shadow-2xl flex flex-col min-h-0 overflow-hidden"
                  : "xl:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20 space-y-4 overflow-hidden"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between border-b border-zinc-800/60 pb-3 gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-zinc-200 flex items-center gap-1.5">
                    <TableIcon size={14} className="text-emerald-400" />
                    {currentTableau?.stageName || "Tabla Simplex"}
                  </span>
                </div>

                {/* Stepper de Iteraciones Simplex */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl p-0.5 text-xs font-mono">
                    <button
                      type="button"
                      disabled={currentTableauIndex <= 0}
                      onClick={() => setCurrentTableauIndex((prev) => Math.max(0, prev - 1))}
                      className="p-1 text-zinc-400 hover:text-zinc-100 disabled:opacity-25"
                      title="Iteración previa"
                    >
                      <ArrowLeft size={13} />
                    </button>
                    <span className="px-2 text-zinc-300 font-bold">
                      {currentTableauIndex + 1} / {result.tableaus.length}
                    </span>
                    <button
                      type="button"
                      disabled={currentTableauIndex >= result.tableaus.length - 1}
                      onClick={() =>
                        setCurrentTableauIndex((prev) =>
                          Math.min(result.tableaus.length - 1, prev + 1)
                        )
                      }
                      className="p-1 text-zinc-400 hover:text-zinc-100 disabled:opacity-25"
                      title="Siguiente iteración"
                    >
                      <ArrowRight size={13} />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs font-mono transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    {isExpanded ? <Minimize2 size={13} className="text-amber-400" /> : <Maximize2 size={13} />}
                    <span>{isExpanded ? "Reducir" : "Expandir"}</span>
                  </button>
                </div>
              </div>

              {/* REGLA 2 & 3: flex-1 min-h-0 min-w-0 con tabla scrollable */}
              <div className="flex-1 min-h-0 min-w-0 overflow-y-auto custom-scrollbar border border-zinc-800/60 rounded-2xl p-2 bg-zinc-950/70">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono text-center border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400 bg-zinc-900/60">
                        <th className="p-2.5">Base</th>
                        {currentTableau?.headers.map((h, colIdx) => (
                          <th
                            key={colIdx}
                            className={`p-2.5 ${
                              currentTableau.pivotCol === colIdx
                                ? "bg-amber-500/20 text-amber-300 font-bold border-x border-amber-500/40"
                                : ""
                            }`}
                          >
                            {h}
                          </th>
                        ))}
                        <th className="p-2.5 text-zinc-500">Razón (θ)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                      {currentTableau?.matrix.map((row, rIdx) => {
                        const isPivotRow = currentTableau.pivotRow === rIdx;
                        return (
                          <tr
                            key={rIdx}
                            className={`${
                              isPivotRow ? "bg-amber-500/10 font-semibold" : "hover:bg-zinc-900/30"
                            }`}
                          >
                            <td className="p-2.5 font-bold text-zinc-400 border-r border-zinc-800/60">
                              {currentTableau.basicVars[rIdx]}
                            </td>
                            {row.map((val, cIdx) => {
                              const isPivotCell =
                                isPivotRow && currentTableau.pivotCol === cIdx;
                              return (
                                <td
                                  key={cIdx}
                                  className={`p-2.5 ${
                                    isPivotCell
                                      ? "bg-amber-400 text-zinc-950 font-extrabold rounded-md shadow-sm"
                                      : currentTableau.pivotCol === cIdx
                                      ? "bg-amber-500/10 text-amber-200"
                                      : ""
                                  }`}
                                >
                                  {Number(val.toFixed(3))}
                                </td>
                              );
                            })}
                            <td className="p-2.5 text-zinc-400 border-l border-zinc-800/60">
                              {currentTableau.ratios[rIdx] !== null
                                ? currentTableau.ratios[rIdx]
                                : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Explicación didáctica del paso de pivoteo */}
                {currentTableau?.rowOperations && currentTableau.rowOperations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-zinc-800/60 px-2 flex flex-wrap items-center justify-between text-[11px] font-mono text-zinc-400 gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 font-bold">Operación Elemental:</span>
                      <span className="text-zinc-200">
                        {currentTableau.rowOperations.join(" | ")}
                      </span>
                    </div>
                    {currentTableau.pivotElement !== null && (
                      <span className="text-zinc-500">
                        Pivote a_{currentTableau.pivotRow},{currentTableau.pivotCol} ={" "}
                        <strong className="text-amber-300">{currentTableau.pivotElement}</strong>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Panel Historial */}
            <div className="xl:col-span-4 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20 overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <History size={15} className="text-zinc-400" /> Historial de Ejecuciones
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
                    <p>Sin tableros guardados.</p>
                    <p className="text-[10px] text-zinc-600 mt-1">
                      Guarda iteraciones para auditoría académica.
                    </p>
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

      {/* MODO 2: PROCEDIMIENTO ANALÍTICO PASO A PASO */}
      {viewMode === "steps" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 shadow-xl shadow-black/20 overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-5 shrink-0">
            <div>
              <h3 className="text-xl font-serif font-bold text-zinc-100">
                Procedimiento Riguroso de Pivoteo Simplex
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                Método: {method.toUpperCase()} · {sense.toUpperCase()} Z · {result.iterationsCount} Iteraciones
              </p>
            </div>
            <div className="text-xs font-mono px-4 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-zinc-300">
              Estado: <strong className="text-emerald-400">{result.status.toUpperCase()}</strong>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {result.tableaus.map((tb, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700/80 transition-all flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-200 font-mono">
                    {tb.stageName}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900/80 px-2 py-0.5 rounded-md border border-zinc-800">
                    Iteración #{tb.iteration}
                  </span>
                </div>

                <div className="overflow-x-auto py-1">
                  <table className="w-full text-xs font-mono text-center border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400 bg-zinc-900/80">
                        <th className="p-2">Base</th>
                        {tb.headers.map((h, i) => (
                          <th key={i} className="p-2">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                      {tb.matrix.map((row, rIdx) => (
                        <tr key={rIdx}>
                          <td className="p-2 font-bold text-zinc-400">{tb.basicVars[rIdx]}</td>
                          {row.map((val, cIdx) => (
                            <td key={cIdx} className="p-2">{Number(val.toFixed(3))}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {tb.rowOperations.length > 0 && (
                  <div className="text-[11px] font-mono text-emerald-400 bg-zinc-950/80 p-2.5 rounded-xl border border-zinc-800/70">
                    Operación de reducción: {tb.rowOperations.join("  |  ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODO 3: TEORÍA DE SIMPLEX */}
      {viewMode === "theory" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto shadow-xl shadow-black/20 custom-scrollbar">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800/80 bg-zinc-900/60 text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 mb-3">
              <BookOpen size={12} /> Algoritmos de Optimización Combinatoria
            </div>
            <h3 className="text-2xl font-serif font-bold text-zinc-100">
              El Algoritmo Simplex de George Dantzig (1947)
            </h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-3xl">
              El método Simplex navega eficientemente a lo largo de las aristas del politopo convexo factible de dimensión n, garantizando que cada pivoteo mejore monótonamente la función objetivo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 space-y-2">
              <strong className="text-xs text-zinc-200 block font-mono uppercase tracking-wider">
                1. Criterio de Entrada (Regla de Dantzig)
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Ingresa a la base aquella variable no básica cuyo coste reducido sea el más negativo (en maximización), representando la mayor tasa de beneficio por unidad de recurso consumido.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 space-y-2">
              <strong className="text-xs text-zinc-200 block font-mono uppercase tracking-wider">
                2. Criterio de Salida (Prueba de la Razón Mínima)
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Garantiza que ninguna variable básica se vuelva negativa (preservando la no-negatividad estricta xᵢ ≥ 0). Si todos los elementos de la columna son negativos o nulos, el problema es no acotado.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GUÍA CON MODELOS DE PRUEBA DE 1 CLIC */}
      <AnimatePresence>
        {isHelpOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative w-full max-w-3xl border border-zinc-800/80 bg-zinc-950/95 backdrop-blur-2xl rounded-3xl p-6 lg:p-8 shadow-2xl overflow-hidden"
            >
              <div className="pointer-events-none absolute -top-20 -right-20 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl" />

              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 relative z-10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <HelpCircle size={16} />
                  </div>
                  <div>
                    <h3 className="text-base font-serif font-bold text-zinc-100">
                      Guía y Casos de Estudio de Simplex
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Modelos didácticos universitarios para probar cada método
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
                    <Terminal size={13} className="text-zinc-400" /> Variantes del Algoritmo
                  </h4>
                  <p className="text-zinc-400 leading-relaxed">
                    Elige <code className="text-zinc-200">Simplex Primal</code> cuando todas las restricciones sean de menor o igual (≤). Para problemas con igualdades (=) o mayores o iguales (≥), utiliza <code className="text-zinc-200">Dos Fases</code> o <code className="text-zinc-200">Gran M</code>.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
                  <h4 className="font-mono uppercase tracking-wider text-zinc-300 font-semibold mb-2 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-400" /> Catálogo de Casos Universitarios
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {MODULE_EXAMPLES.map((ex) => (
                      <button
                        key={ex.title}
                        onClick={() => {
                          setMethod(ex.method);
                          setSense(ex.sense);
                          setObjective(ex.objective);
                          setVarNames(ex.varNames);
                          setConstraints(
                            ex.constraints.map((c, i) => ({
                              id: `c_${i}`,
                              coefficients: c.coeffs,
                              operator: c.op,
                              rhs: c.rhs,
                            }))
                          );
                          setIsHelpOpen(false);
                        }}
                        className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-left transition-all flex items-center justify-between group shadow-sm"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="text-[10px] font-mono text-emerald-400/90 block font-semibold">
                            {ex.category}
                          </span>
                          <span className="font-mono text-zinc-200 text-[11px] block truncate font-bold">
                            {ex.title}
                          </span>
                          <span className="text-[10px] text-zinc-500 block truncate">{ex.desc}</span>
                        </div>
                        <ChevronRight size={13} className="text-zinc-600 group-hover:text-zinc-200 shrink-0 transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
                  <h4 className="font-mono uppercase tracking-wider text-zinc-300 font-semibold mb-1 flex items-center gap-1.5">
                    <Cpu size={13} className="text-emerald-400" /> Complejidad Computacional
                  </h4>
                  <ul className="list-disc pl-4 space-y-1.5 text-zinc-400 leading-relaxed">
                    <li><strong>Complejidad Teórica:</strong> Exponencial en el peor caso (Cubo de Klee-Minty), requiriendo 2ⁿ iteraciones.</li>
                    <li><strong>Complejidad Práctica:</strong> Casi lineal $O(m)$ en problemas reales del mundo industrial.</li>
                    <li><strong>Solvers Industriales:</strong> CPLEX, Gurobi y GLPK combinan Simplex dual con Branch-and-Cut para programación entera mixta (MIP).</li>
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