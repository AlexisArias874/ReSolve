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
  UserCheck,
  Briefcase,
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
// TIPOS Y MODELOS DEL PROBLEMA DE ASIGNACIÓN
// -----------------------------------------------------------------------------
export type AssignmentSense = "min" | "max";

export interface HungarianStep {
  stepNumber: number;
  title: string;
  description: string;
  matrix: number[][];
  lines?: { rows: number[]; cols: number[] };
  assignments?: { worker: number; task: number }[];
  note?: string;
}

export interface AssignmentResult {
  isBalanced: boolean;
  paddedRows: number;
  paddedCols: number;
  workers: string[];
  tasks: string[];
  originalCostMatrix: number[][];
  steps: HungarianStep[];
  assignments: { worker: string; task: string; cost: number }[];
  totalOptimalCost: number;
}

interface ModuleExample {
  title: string;
  category: string;
  desc: string;
  sense: AssignmentSense;
  workers: string[];
  tasks: string[];
  costMatrix: number[][];
}

const MODULE_EXAMPLES: ModuleExample[] = [
  {
    title: "Desarrolladores vs Módulos de Software (Horas)",
    category: "Gestión de Proyectos Tech",
    desc: "Asignación de 4 ingenieros a 4 microservicios minimizando el tiempo total de desarrollo.",
    sense: "min",
    workers: ["Dev Alfa", "Dev Beta", "Dev Gamma", "Dev Delta"],
    tasks: ["Auth API", "Payment", "Analytics", "Sync Engine"],
    costMatrix: [
      [9, 2, 7, 8],
      [6, 4, 3, 7],
      [5, 8, 1, 8],
      [7, 6, 9, 4],
    ],
  },
  {
    title: "Líneas de Producción y Máquinas (Costos en USD)",
    category: "Ingeniería Industrial",
    desc: "Optimización de costos operativos al configurar 3 tornos para 3 pedidos metalmecánicos.",
    sense: "min",
    workers: ["Máquina A", "Máquina B", "Máquina C"],
    tasks: ["Lote 101", "Lote 102", "Lote 103"],
    costMatrix: [
      [250, 150, 400],
      [300, 200, 350],
      [200, 250, 300],
    ],
  },
  {
    title: "Maximización de Ventas en Territorios",
    category: "Estrategia Comercial",
    desc: "Asignación de 3 ejecutivos a 3 regiones comerciales para maximizar ingresos proyectados.",
    sense: "max",
    workers: ["Ejecutivo 1", "Ejecutivo 2", "Ejecutivo 3"],
    tasks: ["Zona Norte", "Zona Centro", "Zona Sur"],
    costMatrix: [
      [35, 40, 28],
      [42, 38, 30],
      [30, 45, 36],
    ],
  },
  {
    title: "Caso No Balanceado (4 Técnicos, 3 Rutas)",
    category: "Logística y Transporte",
    desc: "Demuestra la inyección automática de una columna ficticia (Dummy) con costo 0.",
    sense: "min",
    workers: ["Técnico 1", "Técnico 2", "Técnico 3", "Técnico 4"],
    tasks: ["Ruta A", "Ruta B", "Ruta C"],
    costMatrix: [
      [14, 18, 20],
      [12, 15, 17],
      [11, 16, 15],
      [16, 19, 22],
    ],
  },
];

// -----------------------------------------------------------------------------
// MOTOR MATEMÁTICO: ALGORITMO HÚNGARO COMPLETO
// -----------------------------------------------------------------------------
function solveHungarianAssignment(
  sense: AssignmentSense,
  rawWorkers: string[],
  rawTasks: string[],
  rawMatrix: number[][]
): AssignmentResult {
  const isMax = sense === "max";
  const numWorkers = rawWorkers.length;
  const numTasks = rawTasks.length;
  const dim = Math.max(numWorkers, numTasks);

  const workers = [...rawWorkers];
  const tasks = [...rawTasks];

  // Balanceo con filas o columnas ficticias (dummy)
  const isBalanced = numWorkers === numTasks;
  while (workers.length < dim) workers.push(`Ficticio ${workers.length + 1}`);
  while (tasks.length < dim) tasks.push(`Tarea Dummy ${tasks.length + 1}`);

  // Matriz de trabajo balanceada
  let matrix: number[][] = [];
  for (let r = 0; r < dim; r++) {
    const row: number[] = [];
    for (let c = 0; c < dim; c++) {
      if (r < numWorkers && c < numTasks) {
        row.push(rawMatrix[r]?.[c] ?? 0);
      } else {
        row.push(0); // Costo 0 en ficticias
      }
    }
    matrix.push(row);
  }

  const steps: HungarianStep[] = [];
  let stepCounter = 1;

  steps.push({
    stepNumber: stepCounter++,
    title: isBalanced
      ? "Matriz de Costos Inicial"
      : "Balanceo de Matriz (Inyección de Ficticias con Costo 0)",
    description: `Matriz cuadrada balanceada de orden ${dim}×${dim}.`,
    matrix: matrix.map((row) => [...row]),
  });

  // Si es maximización, transformar a minimización restando de maxVal
  if (isMax) {
    let maxVal = -Infinity;
    for (let r = 0; r < dim; r++) {
      for (let c = 0; c < dim; c++) {
        if (matrix[r][c] > maxVal) maxVal = matrix[r][c];
      }
    }
    matrix = matrix.map((row) => row.map((v) => maxVal - v));

    steps.push({
      stepNumber: stepCounter++,
      title: "Transformación a Problema de Minimización",
      description: `Restamos cada valor del elemento máximo (${maxVal}) para crear la matriz de oportunidad.`,
      matrix: matrix.map((row) => [...row]),
    });
  }

  // PASO 1: Reducción por filas
  matrix = matrix.map((row) => {
    const minRow = Math.min(...row);
    return row.map((v) => v - minRow);
  });

  steps.push({
    stepNumber: stepCounter++,
    title: "Paso 1: Reducción por Filas",
    description: "Restamos el costo mínimo de cada fila a todos sus elementos.",
    matrix: matrix.map((row) => [...row]),
  });

  // PASO 2: Reducción por columnas
  for (let c = 0; c < dim; c++) {
    let minCol = Infinity;
    for (let r = 0; r < dim; r++) {
      if (matrix[r][c] < minCol) minCol = matrix[r][c];
    }
    for (let r = 0; r < dim; r++) {
      matrix[r][c] -= minCol;
    }
  }

  steps.push({
    stepNumber: stepCounter++,
    title: "Paso 2: Reducción por Columnas",
    description: "Restamos el valor mínimo de cada columna a todos sus elementos.",
    matrix: matrix.map((row) => [...row]),
  });

  // PASO 3 y 4: Cobertura mínima de ceros e iteraciones
  let iteration = 0;
  let finalAssignment: { worker: number; task: number }[] = [];

  while (iteration < 10) {
    iteration++;

    // Asignación voraz de ceros para verificar si se alcanza la cobertura óptima
    const rowAssigned: number[] = new Array(dim).fill(-1);
    const colAssigned: number[] = new Array(dim).fill(-1);
    const assignedZeros: { worker: number; task: number }[] = [];

    // Búsqueda de ceros únicos
    for (let r = 0; r < dim; r++) {
      for (let c = 0; c < dim; c++) {
        if (matrix[r][c] === 0 && rowAssigned[r] === -1 && colAssigned[c] === -1) {
          rowAssigned[r] = c;
          colAssigned[c] = r;
          assignedZeros.push({ worker: r, task: c });
        }
      }
    }

    if (assignedZeros.length === dim) {
      finalAssignment = assignedZeros;
      break;
    }

    // Cobertura heurística de ceros con líneas mínimas
    const coveredRows = new Set<number>();
    const coveredCols = new Set<number>();

    // Marcar filas sin asignación
    const markedRows = new Set<number>();
    for (let r = 0; r < dim; r++) {
      if (rowAssigned[r] === -1) markedRows.add(r);
    }

    const markedCols = new Set<number>();
    let changed = true;
    while (changed) {
      changed = false;
      for (const r of Array.from(markedRows)) {
        for (let c = 0; c < dim; c++) {
          if (matrix[r][c] === 0 && !markedCols.has(c)) {
            markedCols.add(c);
            changed = true;
          }
        }
      }

      for (const c of Array.from(markedCols)) {
        for (let r = 0; r < dim; r++) {
          if (rowAssigned[r] === c && !markedRows.has(r)) {
            markedRows.add(r);
            changed = true;
          }
        }
      }
    }

    for (let r = 0; r < dim; r++) {
      if (!markedRows.has(r)) coveredRows.add(r);
    }
    for (const c of Array.from(markedCols)) {
      coveredCols.add(c);
    }

    const totalLines = coveredRows.size + coveredCols.size;

    steps.push({
      stepNumber: stepCounter++,
      title: `Paso 3: Cobertura de Ceros (Iteración ${iteration})`,
      description: `Se requieren ${totalLines} líneas mínimas para cubrir todos los ceros (Dimensión = ${dim}).`,
      matrix: matrix.map((row) => [...row]),
      lines: { rows: Array.from(coveredRows), cols: Array.from(coveredCols) },
    });

    if (totalLines >= dim) {
      // Si el número de líneas es igual o mayor a la dimensión, existe solución completa
      finalAssignment = assignedZeros;
      break;
    }

    // PASO 4: Menor elemento no cubierto
    let minUncovered = Infinity;
    for (let r = 0; r < dim; r++) {
      for (let c = 0; c < dim; c++) {
        if (!coveredRows.has(r) && !coveredCols.has(c)) {
          if (matrix[r][c] < minUncovered) minUncovered = matrix[r][c];
        }
      }
    }

    if (minUncovered === Infinity || minUncovered <= 0) minUncovered = 1;

    for (let r = 0; r < dim; r++) {
      for (let c = 0; c < dim; c++) {
        if (!coveredRows.has(r) && !coveredCols.has(c)) {
          matrix[r][c] -= minUncovered;
        } else if (coveredRows.has(r) && coveredCols.has(c)) {
          matrix[r][c] += minUncovered;
        }
      }
    }

    steps.push({
      stepNumber: stepCounter++,
      title: `Paso 4: Creación de Ceros Adicionales (k = ${minUncovered})`,
      description: `Restamos ${minUncovered} a elementos no cubiertos y lo sumamos a intersecciones de líneas.`,
      matrix: matrix.map((row) => [...row]),
    });
  }

  // Asignación final de contingencia
  if (finalAssignment.length < dim) {
    const usedCols = new Set<number>();
    finalAssignment = [];
    for (let r = 0; r < dim; r++) {
      let chosenCol = -1;
      for (let c = 0; c < dim; c++) {
        if (!usedCols.has(c)) {
          if (chosenCol === -1 || matrix[r][c] < matrix[r][chosenCol]) {
            chosenCol = c;
          }
        }
      }
      if (chosenCol !== -1) {
        usedCols.add(chosenCol);
        finalAssignment.push({ worker: r, task: chosenCol });
      }
    }
  }

  // Paso 5: Resumen de Asignación
  const assignments: { worker: string; task: string; cost: number }[] = [];
  let totalOptimalCost = 0;

  finalAssignment.forEach((pair) => {
    const wName = workers[pair.worker];
    const tName = tasks[pair.task];
    const originalCost =
      pair.worker < numWorkers && pair.task < numTasks
        ? rawMatrix[pair.worker][pair.task]
        : 0;

    assignments.push({
      worker: wName,
      task: tName,
      cost: originalCost,
    });
    totalOptimalCost += originalCost;
  });

  steps.push({
    stepNumber: stepCounter++,
    title: "Paso 5: Asignación Final Óptima",
    description: `Asignación biunívoca 1:1 alcanzada con ${sense === "min" ? "costo mínimo" : "beneficio máximo"}.`,
    matrix: matrix.map((row) => [...row]),
    assignments: finalAssignment,
  });

  return {
    isBalanced,
    paddedRows: dim,
    paddedCols: dim,
    workers,
    tasks,
    originalCostMatrix: rawMatrix,
    steps,
    assignments,
    totalOptimalCost,
  };
}

// -----------------------------------------------------------------------------
// COMPONENTE DE VISTA PRINCIPAL
// -----------------------------------------------------------------------------
export default function AssignmentView({
  viewMode,
  initialExpression = "",
}: {
  viewMode: "calc" | "steps" | "theory";
  initialExpression?: string;
}) {
  const [sense, setSense] = useState<AssignmentSense>("min");
  const [workers, setWorkers] = useState<string[]>([
    "Dev Alfa",
    "Dev Beta",
    "Dev Gamma",
    "Dev Delta",
  ]);
  const [tasks, setTasks] = useState<string[]>([
    "Auth API",
    "Payment",
    "Analytics",
    "Sync Engine",
  ]);
  const [costMatrix, setCostMatrix] = useState<number[][]>([
    [9, 2, 7, 8],
    [6, 4, 3, 7],
    [5, 8, 1, 8],
    [7, 6, 9, 4],
  ]);

  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);

  const { setAIContext, injectedExpression, clearInjectedExpression } = useAIContext();

  // Control Dinámico de Dimensiones
  const handleAddWorker = () => {
    if (workers.length >= 6) return;
    const nextIdx = workers.length + 1;
    setWorkers((prev) => [...prev, `Agente ${nextIdx}`]);
    setCostMatrix((prev) => [...prev, new Array(tasks.length).fill(5)]);
  };

  // Modificadores de nombres personalizados
  const updateWorkerName = (index: number, newName: string) => {
    setWorkers((prev) => {
      const next = [...prev];
      next[index] = newName;
      return next;
    });
  };

  const updateTaskName = (index: number, newName: string) => {
    setTasks((prev) => {
      const next = [...prev];
      next[index] = newName;
      return next;
    });
  };

  const handleRemoveWorker = () => {
    if (workers.length <= 2) return;
    setWorkers((prev) => prev.slice(0, -1));
    setCostMatrix((prev) => prev.slice(0, -1));
  };

  const handleAddTask = () => {
    if (tasks.length >= 6) return;
    const nextIdx = tasks.length + 1;
    setTasks((prev) => [...prev, `Tarea ${nextIdx}`]);
    setCostMatrix((prev) => prev.map((row) => [...row, 5]));
  };

  const handleRemoveTask = () => {
    if (tasks.length <= 2) return;
    setTasks((prev) => prev.slice(0, -1));
    setCostMatrix((prev) => prev.map((row) => row.slice(0, -1)));
  };

  const updateCostCell = (r: number, c: number, val: number) => {
    setCostMatrix((prev) => {
      const next = prev.map((row) => [...row]);
      if (next[r]) next[r][c] = isNaN(val) ? 0 : val;
      return next;
    });
  };

  // Ejecución del motor Húngaro
  const result = useMemo(() => {
    return solveHungarianAssignment(sense, workers, tasks, costMatrix);
  }, [sense, workers, tasks, costMatrix]);

  useEffect(() => {
    if (currentStepIdx >= result.steps.length) {
      setCurrentStepIdx(Math.max(0, result.steps.length - 1));
    }
  }, [result.steps.length, currentStepIdx]);

  const currentStep = result.steps[currentStepIdx] || result.steps[0];

  // Sincronización con ReSolve AI (Emisor)
  useEffect(() => {
    const assignStr = result.assignments
      .map((a) => `${a.worker} ➔ ${a.task} ($${a.cost})`)
      .join(", ");
    const summary = `Problema de Asignación (${sense.toUpperCase()}) | Dim: ${workers.length}x${tasks.length} | Costo Total Z* = ${result.totalOptimalCost} | Asignaciones: [${assignStr}]`;

    setAIContext({
      module: "Matemáticas VI",
      subtopic: "Problemas de Asignación (Método Húngaro)",
      expression: `${sense.toUpperCase()} Z (Matriz ${workers.length}×${tasks.length})`,
      result: `Z* = ${result.totalOptimalCost}`,
      details: summary,
    });
  }, [result, sense, workers.length, tasks.length, setAIContext]);

  // Receptor de IA
  useEffect(() => {
    if (injectedExpression) {
      try {
        const parsed = JSON.parse(injectedExpression);
        if (parsed.costMatrix && Array.isArray(parsed.costMatrix)) {
          setSense(parsed.sense || "min");
          setCostMatrix(parsed.costMatrix);
          setWorkers(
            parsed.workers || parsed.costMatrix.map((_: any, i: number) => `Agente ${i + 1}`)
          );
          setTasks(
            parsed.tasks ||
              parsed.costMatrix[0].map((_: any, i: number) => `Tarea ${i + 1}`)
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
    fetchUserHistory("mat6", "asignacion").then((data) => setHistory(data));
  }, []);

  const saveCalculation = async () => {
    const title = `Asignación ${sense.toUpperCase()} (${workers.length}×${tasks.length})`;
    const resSummary = `Z* = ${result.totalOptimalCost} (${result.isBalanced ? "Balanceada" : "Dummy Padded"})`;
    await saveUserCalculation("mat6", "asignacion", title, resSummary);
    const refreshed = await fetchUserHistory("mat6", "asignacion");
    setHistory(refreshed);
  };

  const clearHistory = async () => {
    await deleteUserHistory("asignacion");
    setHistory([]);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`Costo Total Z* = ${result.totalOptimalCost}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    // REGLA 1 & 2: Ancestro raíz con relative explícito y cadena de alturas resuelta
    <div className="h-full flex flex-col gap-6 min-h-0 relative select-none">
      {viewMode === "calc" && (
        <div className="flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto custom-scrollbar pr-1">
          {/* BARRA DE CONFIGURACIÓN SUPERIOR */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-zinc-900/40 border border-zinc-800/60 rounded-2xl shrink-0 backdrop-blur-xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-zinc-900 p-0.5 rounded-xl border border-zinc-800 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setSense("min")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    sense === "min"
                      ? "bg-zinc-100 text-zinc-950 font-bold shadow-md"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Minimizar Costos / Tiempo
                </button>
                <button
                  type="button"
                  onClick={() => setSense("max")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    sense === "max"
                      ? "bg-emerald-500 text-zinc-950 font-bold shadow-md"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Maximizar Beneficios / Ventas
                </button>
              </div>

              {/* Modulador de Dimensiones */}
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 bg-zinc-950/80 px-3 py-1 rounded-xl border border-zinc-800">
                <span>Agentes:</span>
                <button
                  type="button"
                  onClick={handleRemoveWorker}
                  disabled={workers.length <= 2}
                  className="p-1 hover:text-zinc-100 disabled:opacity-20"
                >
                  <Minus size={12} />
                </button>
                <strong className="text-emerald-400">{workers.length}</strong>
                <button
                  type="button"
                  onClick={handleAddWorker}
                  disabled={workers.length >= 6}
                  className="p-1 hover:text-zinc-100 disabled:opacity-20"
                >
                  <Plus size={12} />
                </button>

                <span className="text-zinc-600">|</span>

                <span>Tareas:</span>
                <button
                  type="button"
                  onClick={handleRemoveTask}
                  disabled={tasks.length <= 2}
                  className="p-1 hover:text-zinc-100 disabled:opacity-20"
                >
                  <Minus size={12} />
                </button>
                <strong className="text-sky-400">{tasks.length}</strong>
                <button
                  type="button"
                  onClick={handleAddTask}
                  disabled={tasks.length >= 6}
                  className="p-1 hover:text-zinc-100 disabled:opacity-20"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsHelpOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-[11px] font-mono text-zinc-300 transition-colors flex items-center gap-1.5 shadow-sm ml-auto"
            >
              <Sparkles size={13} className="text-amber-400" />
              <span>Casos de Asignación</span>
            </button>
          </div>

          {/* SECCIÓN SUPERIOR: MATRIZ DE COSTOS + HERO CARD */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 shrink-0">
            {/* Panel Izquierdo: Editor de Matriz de Costos C_ij */}
            <div className="xl:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 space-y-5 overflow-hidden">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/60 pb-3">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-2">
                    <Briefcase size={14} className="text-zinc-500" />
                    Matriz de Costos / Rendimiento C_{`{ij}`}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {result.isBalanced
                      ? "Matriz Balanceada (n = m)"
                      : "Matriz Rectangular (Requiere Variable Ficticia Dummy)"}
                  </span>
                </div>

                {/* Tabla de Entrada Matricial */}
                {/* Tabla de Entrada Matricial con Nombres Editables */}
                <div className="overflow-x-auto custom-scrollbar p-2 rounded-2xl bg-zinc-950/70 border border-zinc-800/80">
                  <table className="w-full text-xs font-mono text-center border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400">
                        <th className="p-2 text-left font-bold text-zinc-500 min-w-[110px]">
                          Agente \ Tarea
                        </th>
                        {/* Cabeceras de Tareas Editables */}
                        {tasks.map((tName, cIdx) => (
                          <th key={cIdx} className="p-1 min-w-[85px]">
                            <input
                              type="text"
                              value={tName}
                              onChange={(e) => updateTaskName(cIdx, e.target.value)}
                              placeholder={`Tarea ${cIdx + 1}`}
                              className="w-full bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-sky-400 focus:bg-zinc-900/80 rounded px-1.5 py-1 text-center font-mono text-xs text-sky-400 font-bold focus:outline-none transition-all truncate"
                              title="Haz clic para renombrar esta tarea"
                            />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/40">
                      {workers.map((wName, rIdx) => (
                        <tr key={rIdx} className="hover:bg-zinc-900/20">
                          {/* Nombre de Agente Editable */}
                          <td className="p-1 text-left pr-2 min-w-[110px]">
                            <input
                              type="text"
                              value={wName}
                              onChange={(e) => updateWorkerName(rIdx, e.target.value)}
                              placeholder={`Agente ${rIdx + 1}`}
                              className="w-full bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-emerald-400 focus:bg-zinc-900/80 rounded px-1.5 py-1 text-left font-mono text-xs text-emerald-400 font-bold focus:outline-none transition-all truncate"
                              title="Haz clic para renombrar este agente"
                            />
                          </td>
                          {/* Celdas de costo numérico */}
                          {tasks.map((_, cIdx) => (
                            <td key={cIdx} className="p-1.5">
                              <input
                                type="number"
                                step="1"
                                value={costMatrix[rIdx]?.[cIdx] ?? 0}
                                onChange={(e) =>
                                  updateCostCell(rIdx, cIdx, parseFloat(e.target.value))
                                }
                                className="w-16 h-8 bg-zinc-900 border border-zinc-800 rounded-lg text-center font-mono text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Botón Guardar en Supabase */}
              <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-500">
                  Persistencia ReSolve · Algoritmo Húngaro (Kuhn-Munkres)
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

            {/* Panel Derecho: Hero Card con Costo Total y Parejas Asignadas */}
            <div className="xl:col-span-4 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden relative">
              <div className="pointer-events-none absolute -bottom-16 -right-16 w-52 h-52 bg-emerald-500/10 rounded-full blur-3xl" />

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold">
                    Costo Total Óptimo Z*
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
                    {sense === "min" ? "Costo Mínimo Global" : "Beneficio Máximo Obtenido"}
                  </span>
                  <div className="text-5xl font-serif font-bold text-emerald-400 tracking-tight">
                    {result.totalOptimalCost}
                  </div>
                  <span className="text-[11px] font-mono text-zinc-400 mt-2 block">
                    {result.isBalanced
                      ? "✓ Asignación 1 a 1 Factible y Completa"
                      : "✓ Asignación con Tarea/Agente Ficticio (Dummy)"}
                  </span>
                </div>

                {/* Lista de Emparejamientos Asignados */}
                <div className="space-y-1.5 font-mono text-xs max-h-44 overflow-y-auto custom-scrollbar pr-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">
                    Pares Asignados:
                  </span>
                  {result.assignments.map((a, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-xl bg-zinc-950/70 border border-zinc-800/70 flex justify-between items-center"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <UserCheck size={13} className="text-emerald-400 shrink-0" />
                        <span className="text-zinc-200 truncate">{a.worker}</span>
                        <ArrowRight size={11} className="text-zinc-600 shrink-0" />
                        <span className="text-sky-400 truncate">{a.task}</span>
                      </div>
                      <strong className="text-amber-400 shrink-0 ml-2">${a.cost}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative z-10 border-t border-zinc-800/60 pt-3 mt-3">
                <div className="text-[11px] font-mono text-zinc-500 flex items-center justify-between">
                  <span>Iteraciones Húngaras:</span>
                  <span className="text-emerald-400 font-bold">{result.steps.length} Pasos</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN INFERIOR: VISUALIZADOR DEL ALGORITMO HÚNGARO (REGLAS 1, 3, 4, 9) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-1 min-h-0">
            {/* Visualizador de Matrices de Pasos */}
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
                    {currentStep?.title || "Paso del Algoritmo Húngaro"}
                  </span>
                </div>

                {/* Stepper de Pasos Húngaros */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl p-0.5 text-xs font-mono">
                    <button
                      type="button"
                      disabled={currentStepIdx <= 0}
                      onClick={() => setCurrentStepIdx((prev) => Math.max(0, prev - 1))}
                      className="p-1 text-zinc-400 hover:text-zinc-100 disabled:opacity-25"
                      title="Paso anterior"
                    >
                      <ArrowLeft size={13} />
                    </button>
                    <span className="px-2 text-zinc-300 font-bold">
                      {currentStepIdx + 1} / {result.steps.length}
                    </span>
                    <button
                      type="button"
                      disabled={currentStepIdx >= result.steps.length - 1}
                      onClick={() =>
                        setCurrentStepIdx((prev) =>
                          Math.min(result.steps.length - 1, prev + 1)
                        )
                      }
                      className="p-1 text-zinc-400 hover:text-zinc-100 disabled:opacity-25"
                      title="Paso siguiente"
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
              <div className="flex-1 min-h-0 min-w-0 overflow-y-auto custom-scrollbar border border-zinc-800/60 rounded-2xl p-4 bg-zinc-950/70 space-y-3">
                <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                  {currentStep?.description}
                </p>

                <div className="overflow-x-auto py-2">
                  <table className="w-full text-xs font-mono text-center border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400 bg-zinc-900/60">
                        <th className="p-2 text-left text-zinc-500">Agentes</th>
                        {result.tasks.map((t, idx) => {
                          const isCoveredCol = currentStep?.lines?.cols.includes(idx);
                          return (
                            <th
                              key={idx}
                              className={`p-2 min-w-[70px] ${
                                isCoveredCol
                                  ? "bg-amber-500/20 text-amber-300 border-x border-amber-500/40 font-bold"
                                  : ""
                              }`}
                            >
                              {t}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                      {currentStep?.matrix.map((row, rIdx) => {
                        const isCoveredRow = currentStep?.lines?.rows.includes(rIdx);
                        return (
                          <tr
                            key={rIdx}
                            className={`${
                              isCoveredRow ? "bg-amber-500/10 font-semibold" : "hover:bg-zinc-900/30"
                            }`}
                          >
                            <td className="p-2.5 text-left font-bold text-zinc-400 border-r border-zinc-800/60">
                              {result.workers[rIdx]}
                            </td>
                            {row.map((val, cIdx) => {
                              const isCoveredCol = currentStep?.lines?.cols.includes(cIdx);
                              const isIntersection = isCoveredRow && isCoveredCol;
                              const isAssigned = currentStep?.assignments?.some(
                                (a) => a.worker === rIdx && a.task === cIdx
                              );

                              return (
                                <td
                                  key={cIdx}
                                  className={`p-2.5 transition-colors ${
                                    isAssigned
                                      ? "bg-emerald-500/30 text-emerald-300 font-extrabold border-2 border-emerald-400 rounded-lg shadow-sm"
                                      : isIntersection
                                      ? "bg-amber-400/20 text-amber-200 font-bold"
                                      : val === 0
                                      ? "text-sky-400 font-bold"
                                      : ""
                                  }`}
                                >
                                  {val}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {currentStep?.assignments && (
                  <div className="pt-2 text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 size={13} />
                    <span>Las celdas con borde esmeralda indican la asignación óptima alcanzada.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Panel Historial */}
            <div className="xl:col-span-4 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20 overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <History size={15} className="text-zinc-400" /> Historial de Asignaciones
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
                    <p>Sin problemas guardados.</p>
                    <p className="text-[10px] text-zinc-600 mt-1">
                      Guarda asignaciones para auditar costos.
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
                Procedimiento Riguroso del Método Húngaro
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                {sense.toUpperCase()} Z · Dimensión {result.paddedRows}×{result.paddedCols} · {result.steps.length} Pasos
              </p>
            </div>
            <div className="text-xs font-mono px-4 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-zinc-300">
              Costo Total Z* = <strong className="text-emerald-400">{result.totalOptimalCost}</strong>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {result.steps.map((st, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700/80 transition-all flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-200 font-mono">
                    {st.title}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900/80 px-2 py-0.5 rounded-md border border-zinc-800">
                    Paso #{st.stepNumber}
                  </span>
                </div>
                <p className="text-xs text-zinc-300 font-sans leading-relaxed">{st.description}</p>

                <div className="overflow-x-auto py-1">
                  <table className="w-full text-xs font-mono text-center border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400 bg-zinc-900/80">
                        <th className="p-2 text-left">Agente</th>
                        {result.tasks.map((t, i) => (
                          <th key={i} className="p-2">{t}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                      {st.matrix.map((row, rIdx) => (
                        <tr key={rIdx}>
                          <td className="p-2 text-left font-bold text-zinc-400">{result.workers[rIdx]}</td>
                          {row.map((val, cIdx) => (
                            <td key={cIdx} className="p-2">{val}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODO 3: TEORÍA DE PROBLEMAS DE ASIGNACIÓN */}
      {viewMode === "theory" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto shadow-xl shadow-black/20 custom-scrollbar">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800/80 bg-zinc-900/60 text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 mb-3">
              <BookOpen size={12} /> Grafos Bipartitos y Emparejamiento Ponderado
            </div>
            <h3 className="text-2xl font-serif font-bold text-zinc-100">
              El Teorema de Kuhn-Munkres y el Problema de Asignación
            </h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-3xl">
              El problema de asignación es un caso especial de la programación lineal y del problema de transporte donde cada recurso tiene oferta 1 y cada destino demanda 1 (variables binarias xᵢⱼ ∈ {`{0, 1}`}).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 space-y-2">
              <strong className="text-xs text-zinc-200 block font-mono uppercase tracking-wider">
                1. Teorema de Kőnig y Reducción Matricial
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                El número mínimo de líneas necesarias para cubrir todos los ceros de una matriz equivale al número máximo de ceros independientes que se pueden seleccionar sin compartir fila o columna.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 space-y-2">
              <strong className="text-xs text-zinc-200 block font-mono uppercase tracking-wider">
                2. Complejidad Polinomial O(n³)
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                A diferencia del enfoque de fuerza bruta que requeriría evaluar n! permutaciones factoriales, el Algoritmo Húngaro resuelve la optimización global en tiempo fuertemente polinomial O(n³).
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
                      Guía del Algoritmo Húngaro
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Modelos de prueba universitaria para problemas de asignación
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
                    <Terminal size={13} className="text-zinc-400" /> Principio del Algoritmo
                  </h4>
                  <p className="text-zinc-400 leading-relaxed">
                    Si a todos los elementos de una fila o columna de una matriz de costos se les suma o resta una constante, la asignación óptima permanece inalterada. El algoritmo utiliza esta propiedad para generar ceros independientes.
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
                          setSense(ex.sense);
                          setWorkers(ex.workers);
                          setTasks(ex.tasks);
                          setCostMatrix(ex.costMatrix);
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
                    <Cpu size={13} className="text-emerald-400" /> Aplicaciones en Computación y Logística
                  </h4>
                  <ul className="list-disc pl-4 space-y-1.5 text-zinc-400 leading-relaxed">
                    <li><strong>Planificación de Procesos (CPU Scheduling):</strong> Asignación de hilos concurrentes a núcleos físicos heterogéneos minimizando tiempos de conmutación de contexto.</li>
                    <li><strong>Visión Artificial y Rastreo de Objetos:</strong> Emparejamiento de bounding boxes entre fotogramas consecutivos (ejemplo en algoritmos SORT / DeepSORT).</li>
                    <li><strong>Rutas de Transporte y Vehículos Autónomos:</strong> Emparejamiento de pedidos a repartidores en tiempo real en plataformas de delivery.</li>
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