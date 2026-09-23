"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  Check,
  History,
  Trash2,
  BookOpen,
  ListOrdered,
  Sparkles,
  HelpCircle,
  X,
  Plus,
  Minus,
  Maximize2,
  ChevronRight,
  TrendingUp,
  Scale,
  Compass,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Table as TableIcon,
  Minimize2,
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
import MathGrapher, {
  type GraphPoint,
  type GuideLine,
  type LegendItem,
} from "@/components/shared/math-grapher";

// -----------------------------------------------------------------------------
// TIPOS Y MODELOS DE PROGRAMACIÓN LINEAL
// -----------------------------------------------------------------------------
export type ObjectiveType = "max" | "min";
export type ConstraintOperator = "<=" | ">=" | "=";

export interface Constraint {
  id: string;
  coefficients: number[];
  operator: ConstraintOperator;
  rhs: number;
}

export interface LPModel {
  type: ObjectiveType;
  objective: number[];
  constraints: Constraint[];
  varNames: string[];
}

export interface SimplexTableau {
  iteration: number;
  description: string;
  headers: string[];
  basicVars: string[];
  matrix: number[][];
  pivotRow?: number;
  pivotCol?: number;
}

export interface Vertex2D {
  x: number;
  y: number;
  zValue: number;
  isFeasible: boolean;
  label: string;
}

// -----------------------------------------------------------------------------
// CATÁLOGO DE CASOS UNIVERSITARIOS
// -----------------------------------------------------------------------------
interface LPExample {
  title: string;
  category: string;
  desc: string;
  model: LPModel;
}

const LP_EXAMPLES: LPExample[] = [
  {
    title: "Maximización de Producción 2D",
    category: "Manufactura Industrial",
    desc: "Problema clásico de asignación de recursos con 2 variables y 3 restricciones.",
    model: {
      type: "max",
      objective: [3, 5],
      varNames: ["x₁", "x₂"],
      constraints: [
        { id: "c1", coefficients: [1, 0], operator: "<=", rhs: 4 },
        { id: "c2", coefficients: [0, 2], operator: "<=", rhs: 12 },
        { id: "c3", coefficients: [3, 2], operator: "<=", rhs: 18 },
      ],
    },
  },
  {
    title: "Problema de la Dieta de Stigler (Minimización)",
    category: "Costos y Nutrición",
    desc: "Minimización de costo sujeta a requisitos mínimos de nutrientes (operadores ≥).",
    model: {
      type: "min",
      objective: [0.6, 1.0],
      varNames: ["x₁", "x₂"],
      constraints: [
        { id: "c1", coefficients: [10, 20], operator: ">=", rhs: 60 },
        { id: "c2", coefficients: [30, 20], operator: ">=", rhs: 100 },
        { id: "c3", coefficients: [20, 10], operator: ">=", rhs: 40 },
      ],
    },
  },
  {
    title: "Mezcla de Refinería 3D (Simplex Primal)",
    category: "Investigación de Operaciones",
    desc: "Modelo de 3 variables de decisión con cuellos de botella en destilación.",
    model: {
      type: "max",
      objective: [5, 4, 3],
      varNames: ["x₁", "x₂", "x₃"],
      constraints: [
        { id: "c1", coefficients: [2, 3, 1], operator: "<=", rhs: 100 },
        { id: "c2", coefficients: [4, 1, 2], operator: "<=", rhs: 120 },
        { id: "c3", coefficients: [3, 4, 2], operator: "<=", rhs: 150 },
      ],
    },
  },
  {
    title: "Región No Acotada (Unbounded)",
    category: "Casos Especiales",
    desc: "El polígono no está acotado en la dirección de optimización (Z → ∞).",
    model: {
      type: "max",
      objective: [2, 1],
      varNames: ["x₁", "x₂"],
      constraints: [
        { id: "c1", coefficients: [1, -1], operator: "<=", rhs: 10 },
        { id: "c2", coefficients: [2, 0], operator: ">=", rhs: 4 },
      ],
    },
  },
  {
    title: "Sistema Infactible (Contradicción)",
    category: "Casos Especiales",
    desc: "Restricciones mutuamente excluyentes que no generan espacio de soluciones.",
    model: {
      type: "max",
      objective: [3, 2],
      varNames: ["x₁", "x₂"],
      constraints: [
        { id: "c1", coefficients: [1, 1], operator: "<=", rhs: 2 },
        { id: "c2", coefficients: [1, 1], operator: ">=", rhs: 5 },
      ],
    },
  },
];

// -----------------------------------------------------------------------------
// MOTOR ALGORÍTMICO: SIMPLEX DE DOS FASES
// -----------------------------------------------------------------------------
function solveTwoPhaseSimplex(model: LPModel) {
  const isMax = model.type === "max";
  const numOrigVars = model.objective.length;
  const numConstraints = model.constraints.length;

  const objCoeffs = model.objective.map((c) => (isMax ? c : -c));

  let slackCount = 0;
  let surplusCount = 0;
  let artificialCount = 0;

  model.constraints.forEach((c) => {
    if (c.operator === "<=") slackCount++;
    else if (c.operator === ">=") {
      surplusCount++;
      artificialCount++;
    } else if (c.operator === "=") {
      artificialCount++;
    }
  });

  const headers: string[] = [
    ...model.varNames,
    ...Array.from({ length: slackCount }, (_, i) => `s${i + 1}`),
    ...Array.from({ length: surplusCount }, (_, i) => `e${i + 1}`),
    ...Array.from({ length: artificialCount }, (_, i) => `R${i + 1}`),
    "Sol (RHS)",
  ];

  const totalVars = headers.length - 1;
  const tableaus: SimplexTableau[] = [];

  const A: number[][] = [];
  const b: number[] = [];
  const basicVars: string[] = [];

  let curSlack = 0;
  let curSurplus = 0;
  let curArt = 0;

  model.constraints.forEach((c) => {
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
    for (let j = 0; j < numOrigVars; j++) {
      row[j] = coeffs[j] || 0;
    }

    if (op === "<=") {
      row[numOrigVars + curSlack] = 1;
      basicVars.push(`s${curSlack + 1}`);
      curSlack++;
    } else if (op === ">=") {
      row[numOrigVars + slackCount + curSurplus] = -1;
      row[numOrigVars + slackCount + surplusCount + curArt] = 1;
      basicVars.push(`R${curArt + 1}`);
      curSurplus++;
      curArt++;
    } else {
      row[numOrigVars + slackCount + surplusCount + curArt] = 1;
      basicVars.push(`R${curArt + 1}`);
      curArt++;
    }

    A.push(row);
    b.push(rhs);
  });

  let isPhase1Needed = artificialCount > 0;
  let tableau = A.map((row, i) => [...row, b[i]]);

  if (isPhase1Needed) {
    const rowW = new Array(totalVars + 1).fill(0);
    const artStart = numOrigVars + slackCount + surplusCount;

    for (let i = 0; i < artificialCount; i++) {
      rowW[artStart + i] = 1;
    }

    for (let i = 0; i < numConstraints; i++) {
      if (basicVars[i].startsWith("R")) {
        for (let j = 0; j <= totalVars; j++) {
          rowW[j] -= tableau[i][j];
        }
      }
    }

    let p1Tableau = [rowW, ...tableau];

    tableaus.push({
      iteration: 1,
      description: "Fase 1: Tabla Inicial con Variables Artificiales (Minimizar W)",
      headers,
      basicVars: ["-W", ...basicVars],
      matrix: p1Tableau.map((r) => [...r]),
    });

    let p1Iter = 1;
    while (p1Iter < 15) {
      let pivotCol = -1;
      let minVal = -1e-7;
      for (let j = 0; j < totalVars; j++) {
        if (p1Tableau[0][j] < minVal) {
          minVal = p1Tableau[0][j];
          pivotCol = j;
        }
      }

      if (pivotCol === -1) break;

      let pivotRow = -1;
      let minRatio = Infinity;
      for (let i = 1; i <= numConstraints; i++) {
        const a_ij = p1Tableau[i][pivotCol];
        if (a_ij > 1e-7) {
          const ratio = p1Tableau[i][totalVars] / a_ij;
          if (ratio < minRatio) {
            minRatio = ratio;
            pivotRow = i;
          }
        }
      }

      if (pivotRow === -1) {
        return { status: "unbounded", tableaus, optimalZ: 0, solution: [] };
      }

      const pivotVal = p1Tableau[pivotRow][pivotCol];
      for (let j = 0; j <= totalVars; j++) {
        p1Tableau[pivotRow][j] /= pivotVal;
      }
      basicVars[pivotRow - 1] = headers[pivotCol];

      for (let i = 0; i <= numConstraints; i++) {
        if (i !== pivotRow) {
          const factor = p1Tableau[i][pivotCol];
          for (let j = 0; j <= totalVars; j++) {
            p1Tableau[i][j] -= factor * p1Tableau[pivotRow][j];
          }
        }
      }

      p1Iter++;
      tableaus.push({
        iteration: p1Iter,
        description: `Fase 1: Iteración ${p1Iter - 1} (Entra ${headers[pivotCol]}, Sale de la base)`,
        headers,
        basicVars: ["-W", ...basicVars],
        matrix: p1Tableau.map((r) => [...r]),
        pivotRow,
        pivotCol,
      });
    }

    const finalW = Math.abs(p1Tableau[0][totalVars]);
    if (finalW > 1e-4) {
      return {
        status: "infeasible",
        tableaus,
        optimalZ: 0,
        solution: new Array(numOrigVars).fill(0),
      };
    }

    tableau = p1Tableau.slice(1);
  }

  const rowZ = new Array(totalVars + 1).fill(0);
  for (let j = 0; j < numOrigVars; j++) {
    rowZ[j] = -objCoeffs[j];
  }

  for (let i = 0; i < numConstraints; i++) {
    const bVar = basicVars[i];
    const colIdx = headers.indexOf(bVar);
    if (colIdx !== -1 && colIdx < numOrigVars) {
      const c_val = objCoeffs[colIdx];
      for (let j = 0; j <= totalVars; j++) {
        rowZ[j] += c_val * tableau[i][j];
      }
    }
  }

  let p2Tableau = [rowZ, ...tableau];

  tableaus.push({
    iteration: tableaus.length + 1,
    description: isPhase1Needed
      ? "Fase 2: Tabla Inicial con Función Objetivo Original Z"
      : "Tabla Inicial Simplex Estándar",
    headers,
    basicVars: ["Z", ...basicVars],
    matrix: p2Tableau.map((r) => [...r]),
  });

  let iter = 1;
  while (iter < 20) {
    let pivotCol = -1;
    let minVal = -1e-7;

    for (let j = 0; j < totalVars; j++) {
      if (headers[j].startsWith("R")) continue;
      if (p2Tableau[0][j] < minVal) {
        minVal = p2Tableau[0][j];
        pivotCol = j;
      }
    }

    if (pivotCol === -1) break;

    let pivotRow = -1;
    let minRatio = Infinity;
    for (let i = 1; i <= numConstraints; i++) {
      const a_ij = p2Tableau[i][pivotCol];
      if (a_ij > 1e-7) {
        const ratio = p2Tableau[i][totalVars] / a_ij;
        if (ratio < minRatio) {
          minRatio = ratio;
          pivotRow = i;
        }
      }
    }

    if (pivotRow === -1) {
      return {
        status: "unbounded",
        tableaus,
        optimalZ: Infinity,
        solution: new Array(numOrigVars).fill(0),
      };
    }

    const pivotVal = p2Tableau[pivotRow][pivotCol];
    for (let j = 0; j <= totalVars; j++) {
      p2Tableau[pivotRow][j] /= pivotVal;
    }
    basicVars[pivotRow - 1] = headers[pivotCol];

    for (let i = 0; i <= numConstraints; i++) {
      if (i !== pivotRow) {
        const factor = p2Tableau[i][pivotCol];
        for (let j = 0; j <= totalVars; j++) {
          p2Tableau[i][j] -= factor * p2Tableau[pivotRow][j];
        }
      }
    }

    iter++;
    tableaus.push({
      iteration: tableaus.length + 1,
      description: `Iteración Simplex ${iter - 1}: Entra ${headers[pivotCol]}, Sale de la base`,
      headers,
      basicVars: ["Z", ...basicVars],
      matrix: p2Tableau.map((r) => [...r]),
      pivotRow,
      pivotCol,
    });
  }

  const solution = new Array(numOrigVars).fill(0);
  for (let i = 0; i < numConstraints; i++) {
    const varName = basicVars[i];
    const vIdx = model.varNames.indexOf(varName);
    if (vIdx !== -1) {
      solution[vIdx] = Number(p2Tableau[i + 1][totalVars].toFixed(4));
    }
  }

  let finalZ = p2Tableau[0][totalVars];
  if (!isMax) finalZ = -finalZ;
  finalZ = Number(finalZ.toFixed(4));

  const shadowPrices: { constraint: string; price: number }[] = [];
  model.constraints.forEach((c, idx) => {
    let colName = `s${idx + 1}`;
    let colIdx = headers.indexOf(colName);
    let price = 0;
    if (colIdx !== -1) {
      price = Number(p2Tableau[0][colIdx].toFixed(4));
    }
    shadowPrices.push({
      constraint: `Restricción ${idx + 1}`,
      price: isMax ? price : -price,
    });
  });

  return {
    status: "optimal",
    tableaus,
    optimalZ: finalZ,
    solution,
    shadowPrices,
  };
}

// -----------------------------------------------------------------------------
// MOTOR GEOMÉTRICO 2D
// -----------------------------------------------------------------------------
function calculate2DGeometry(model: LPModel) {
  if (model.objective.length !== 2) return null;

  const lines: { a: number; b: number; c: number; op: ConstraintOperator; id: string }[] = [];

  lines.push({ a: 1, b: 0, c: 0, op: ">=", id: "x1_nonneg" });
  lines.push({ a: 0, b: 1, c: 0, op: ">=", id: "x2_nonneg" });

  model.constraints.forEach((c) => {
    lines.push({
      a: c.coefficients[0] || 0,
      b: c.coefficients[1] || 0,
      c: c.rhs,
      op: c.operator,
      id: c.id,
    });
  });

  const rawIntersections: { x: number; y: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const L1 = lines[i];
      const L2 = lines[j];
      const det = L1.a * L2.b - L1.b * L2.a;
      if (Math.abs(det) > 1e-6) {
        const x = (L1.c * L2.b - L1.b * L2.c) / det;
        const y = (L1.a * L2.c - L1.c * L2.a) / det;
        rawIntersections.push({ x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) });
      }
    }
  }

  const feasibleVertices: Vertex2D[] = [];
  const allVertices: Vertex2D[] = [];

  rawIntersections.forEach((pt, idx) => {
    if (pt.x < -1e-4 || pt.y < -1e-4) return;

    let isFeasible = true;
    for (const c of model.constraints) {
      const val = (c.coefficients[0] || 0) * pt.x + (c.coefficients[1] || 0) * pt.y;
      if (c.operator === "<=" && val > c.rhs + 1e-4) isFeasible = false;
      if (c.operator === ">=" && val < c.rhs - 1e-4) isFeasible = false;
      if (c.operator === "=" && Math.abs(val - c.rhs) > 1e-4) isFeasible = false;
    }

    const zVal = Number((model.objective[0] * pt.x + model.objective[1] * pt.y).toFixed(3));
    const vertex: Vertex2D = {
      x: pt.x,
      y: pt.y,
      zValue: zVal,
      isFeasible,
      label: `V${idx + 1}(${pt.x}, ${pt.y})`,
    };

    allVertices.push(vertex);
    if (isFeasible) {
      if (!feasibleVertices.some((v) => Math.abs(v.x - pt.x) < 1e-3 && Math.abs(v.y - pt.y) < 1e-3)) {
        feasibleVertices.push(vertex);
      }
    }
  });

  if (feasibleVertices.length > 2) {
    const cx = feasibleVertices.reduce((sum, v) => sum + v.x, 0) / feasibleVertices.length;
    const cy = feasibleVertices.reduce((sum, v) => sum + v.y, 0) / feasibleVertices.length;
    feasibleVertices.sort((p1, p2) => Math.atan2(p1.y - cy, p1.x - cx) - Math.atan2(p2.y - cy, p2.x - cx));
  }

  return {
    feasibleVertices,
    allVertices,
  };
}

// -----------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// -----------------------------------------------------------------------------
export default function LinearProgrammingView({
  viewMode,
  initialExpression = "",
}: {
  viewMode: "calc" | "steps" | "theory";
  initialExpression?: string;
}) {
  const [model, setModel] = useState<LPModel>({
    type: "max",
    objective: [3, 5],
    varNames: ["x₁", "x₂"],
    constraints: [
      { id: "c1", coefficients: [1, 0], operator: "<=", rhs: 4 },
      { id: "c2", coefficients: [0, 2], operator: "<=", rhs: 12 },
      { id: "c3", coefficients: [3, 2], operator: "<=", rhs: 18 },
    ],
  });

  const [activeTab, setActiveTab] = useState<"graph" | "simplex" | "table">("graph");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSensitivityOpen, setIsSensitivityOpen] = useState(false);

  const { setAIContext, injectedExpression, clearInjectedExpression } = useAIContext();

  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const handleAddVariable = () => {
    const nextIdx = model.varNames.length + 1;
    setModel((prev) => ({
      ...prev,
      varNames: [...prev.varNames, `x${nextIdx}`],
      objective: [...prev.objective, 0],
      constraints: prev.constraints.map((c) => ({
        ...c,
        coefficients: [...c.coefficients, 0],
      })),
    }));
  };

  const handleRemoveVariable = () => {
    if (model.varNames.length <= 2) return;
    setModel((prev) => ({
      ...prev,
      varNames: prev.varNames.slice(0, -1),
      objective: prev.objective.slice(0, -1),
      constraints: prev.constraints.map((c) => ({
        ...c,
        coefficients: c.coefficients.slice(0, -1),
      })),
    }));
  };

  const handleAddConstraint = () => {
    const newId = `c_${Date.now()}`;
    setModel((prev) => ({
      ...prev,
      constraints: [
        ...prev.constraints,
        {
          id: newId,
          coefficients: new Array(prev.varNames.length).fill(0),
          operator: "<=",
          rhs: 10,
        },
      ],
    }));
  };

  const handleRemoveConstraint = (id: string) => {
    if (model.constraints.length <= 1) return;
    setModel((prev) => ({
      ...prev,
      constraints: prev.constraints.filter((c) => c.id !== id),
    }));
  };

  const updateObjectiveCoeff = (index: number, val: number) => {
    setModel((prev) => {
      const next = [...prev.objective];
      next[index] = isNaN(val) ? 0 : val;
      return { ...prev, objective: next };
    });
  };

  const updateConstraintCoeff = (cId: string, varIdx: number, val: number) => {
    setModel((prev) => ({
      ...prev,
      constraints: prev.constraints.map((c) => {
        if (c.id !== cId) return c;
        const nextCoeffs = [...c.coefficients];
        nextCoeffs[varIdx] = isNaN(val) ? 0 : val;
        return { ...c, coefficients: nextCoeffs };
      }),
    }));
  };

  const updateConstraintRhs = (cId: string, val: number) => {
    setModel((prev) => ({
      ...prev,
      constraints: prev.constraints.map((c) => (c.id === cId ? { ...c, rhs: isNaN(val) ? 0 : val } : c)),
    }));
  };

  const updateConstraintOp = (cId: string, op: ConstraintOperator) => {
    setModel((prev) => ({
      ...prev,
      constraints: prev.constraints.map((c) => (c.id === cId ? { ...c, operator: op } : c)),
    }));
  };

  const calculation = useMemo(() => {
    const simplexRes = solveTwoPhaseSimplex(model);
    const geom2D = model.varNames.length === 2 ? calculate2DGeometry(model) : null;

    const steps: { stage: string; desc: string; math: string }[] = [];
    let stepId = 1;

    const objStr = model.objective.map((c, i) => `${c >= 0 && i > 0 ? "+" : ""}${c}${model.varNames[i]}`).join(" ");
    steps.push({
      stage: `${stepId++}. Modelo Matemático Primal`,
      desc: `Función objetivo de ${model.type === "max" ? "maximización" : "minimización"} sujeta a ${model.constraints.length} restricciones tecnológicas.`,
      math: `\\text{${model.type.toUpperCase()}} \\quad Z = ${objStr} \\\\[6pt] \\text{s.a.} \\quad \\begin{cases} ${model.constraints
        .map(
          (c) =>
            `${c.coefficients.map((v, i) => `${v >= 0 && i > 0 ? "+" : ""}${v}${model.varNames[i]}`).join(" ")} \\; ${c.operator === "<=" ? "\\le" : c.operator === ">=" ? "\\ge" : "="} \\; ${c.rhs}`
        )
        .join(" \\\\[4pt] ")} \\\\[4pt] ${model.varNames.join(", ")} \\ge 0 \\end{cases}`,
    });

    steps.push({
      stage: `${stepId++}. Conversión a Forma Estándar Canónica`,
      desc: "Introducción de variables de holgura (sᵢ ≥ 0), variables de exceso (eᵢ ≥ 0) y variables artificiales (Rᵢ ≥ 0) para formar la base canónica.",
      math: `\\text{Se transforman las desigualdades en igualdades estrictas vectoriales } A x = b`,
    });

    if (simplexRes.status === "optimal") {
      steps.push({
        stage: `${stepId++}. Criterio de Optimalidad y Vector Solución`,
        desc: "Todos los costes reducidos en la fila Z satisfacen la condición de parada (c̄ⱼ ≥ 0).",
        math: `X^* = \\begin{pmatrix} ${model.varNames.map((v, i) => `${v}^* = ${simplexRes.solution[i]}`).join(" \\\\ ")} \\end{pmatrix}, \\quad Z^* = ${simplexRes.optimalZ}`,
      });

      if (simplexRes.shadowPrices && simplexRes.shadowPrices.length > 0) {
        steps.push({
          stage: `${stepId++}. Análisis Dual y Precios Sombra (Shadow Prices)`,
          desc: "Tasa marginal de cambio en la función objetivo por cada unidad adicional del recurso bᵢ.",
          math: simplexRes.shadowPrices.map((sp) => `y_{${sp.constraint}} = ${sp.price}`).join(" \\quad | \\quad "),
        });
      }
    } else if (simplexRes.status === "infeasible") {
      steps.push({
        stage: `${stepId++}. Diagnóstico de Infactibilidad`,
        desc: "Al finalizar la Fase 1, la función artificial W* no pudo reducirse a cero, lo que demuestra que las restricciones son incompatibles.",
        math: `\\min W > 0 \\implies \\mathcal{F} = \\emptyset \\quad \\text{(Región factible vacía)}`,
      });
    } else if (simplexRes.status === "unbounded") {
      steps.push({
        stage: `${stepId++}. Diagnóstico de Solución No Acotada`,
        desc: "Existe una variable entrante con todos sus coeficientes de intercambio aᵢⱼ ≤ 0. El beneficio puede crecer indefinidamente.",
        math: `\\forall i, \\; a_{ik} \\le 0 \\implies Z^* \\longrightarrow +\\infty`,
      });
    }

    return {
      simplexRes,
      geom2D,
      steps,
      is2D: model.varNames.length === 2,
    };
  }, [model]);

  const grapherPoints = useMemo<GraphPoint[]>(() => {
    if (!calculation.geom2D) return [];
    const pts: GraphPoint[] = [];

    model.constraints.forEach((c, idx) => {
      const color = idx === 0 ? "#38bdf8" : idx === 1 ? "#f97316" : "#ec4899";
      const a1 = c.coefficients[0] || 0;
      const a2 = c.coefficients[1] || 0;

      if (Math.abs(a2) > 1e-4) {
        const yVal = Number((c.rhs / a2).toFixed(2));
        if (yVal >= 0) {
          pts.push({
            x: 0,
            y: yVal,
            label: `${yVal}`,
            color: color,
            type: "solid",
          });
        }
      }

      if (Math.abs(a1) > 1e-4) {
        const xVal = Number((c.rhs / a1).toFixed(2));
        if (xVal >= 0) {
          pts.push({
            x: xVal,
            y: 0,
            label: `${xVal}`,
            color: color,
            type: "solid",
          });
        }
      }
    });

    calculation.geom2D.feasibleVertices.forEach((v) => {
      const isOptimal =
        calculation.simplexRes.status === "optimal" &&
        Math.abs(v.x - calculation.simplexRes.solution[0]) < 0.05 &&
        Math.abs(v.y - calculation.simplexRes.solution[1]) < 0.05;

      if (v.x > 0.05 && v.y > 0.05) {
        pts.push({
          x: v.x,
          y: v.y,
          label: isOptimal
            ? `Óptimo (${v.x}, ${v.y}) Z*=${v.zValue}`
            : `Cruce (${v.x}, ${v.y})`,
          color: isOptimal ? "#10b981" : "#a855f7",
          type: "solid",
        });
      }
    });

    return pts;
  }, [calculation, model.constraints]);

  const grapherPrimaryExpr = useMemo<string>(() => {
    const c = model.constraints[0];
    if (!c || !calculation.is2D) return "0";
    const a2 = c.coefficients[1] || 0;
    if (Math.abs(a2) < 1e-6) return `x = ${c.rhs / (c.coefficients[0] || 1)}`;
    return `(${c.rhs} - ${(c.coefficients[0] || 0).toFixed(2)}*x) / ${a2.toFixed(2)}`;
  }, [model.constraints, calculation.is2D]);

  const grapherSecondaryExpr = useMemo<string | undefined>(() => {
    const c = model.constraints[1];
    if (!c || !calculation.is2D) return undefined;
    const a2 = c.coefficients[1] || 0;
    if (Math.abs(a2) < 1e-6) return undefined;
    return `(${c.rhs} - ${(c.coefficients[0] || 0).toFixed(2)}*x) / ${a2.toFixed(2)}`;
  }, [model.constraints, calculation.is2D]);

  const grapherLegend = useMemo<LegendItem[]>(() => {
    const items: LegendItem[] = [];
    if (calculation.is2D) {
      items.push({ label: `R1: ${model.constraints[0]?.coefficients[0] ?? 0}·x₁ + ${model.constraints[0]?.coefficients[1] ?? 0}·x₂ ${model.constraints[0]?.operator ?? ""} ${model.constraints[0]?.rhs ?? 0}`, color: "#38bdf8", shape: "line" });
      if (model.constraints[1]) {
        items.push({ label: `R2: ${model.constraints[1].coefficients[0]}·x₁ + ${model.constraints[1].coefficients[1]}·x₂ ${model.constraints[1].operator} ${model.constraints[1].rhs}`, color: "#f43f5e", shape: "line" });
      }
      if (showRootsCheck(model)) {
        const opt = calculation.simplexRes.status === "optimal" ? calculation.simplexRes.solution : null;
        if (opt) {
          items.push({ label: `Óptimo Z* = ${calculation.simplexRes.optimalZ} en (${opt[0]}, ${opt[1]})`, color: "#10b981", shape: "dot" });
        }
      }
    }
    return items;
  }, [model, calculation]);

  function showRootsCheck(m: LPModel): boolean {
    return m.constraints.length > 0;
  }

  useEffect(() => {
    const solStr =
      calculation.simplexRes.status === "optimal"
        ? calculation.simplexRes.solution.map((val, i) => `${model.varNames[i]}=${val}`).join(", ")
        : "Sin solución finita";

    const summary = `PL (${model.type.toUpperCase()}) | Variables: ${model.varNames.length} | Restricciones: ${model.constraints.length} | Estado: ${calculation.simplexRes.status} | Z* = ${calculation.simplexRes.optimalZ} | X* = [${solStr}]`;

    setAIContext({
      module: "Matemáticas VI",
      subtopic: "Programación Lineal y Optimización",
      expression: `${model.type.toUpperCase()} Z = ${model.objective.join("x₁ + ")}`,
      result: `Z* = ${calculation.simplexRes.optimalZ}`,
      details: summary,
    });
  }, [model, calculation, setAIContext]);

  useEffect(() => {
    if (injectedExpression) {
      try {
        const parsed = JSON.parse(injectedExpression);
        if (parsed.objective && Array.isArray(parsed.objective) && parsed.constraints) {
          setModel({
            type: parsed.type === "min" ? "min" : "max",
            objective: parsed.objective,
            varNames: parsed.varNames || parsed.objective.map((_: number, i: number) => `x${i + 1}`),
            constraints: parsed.constraints.map((c: any, idx: number) => ({
              id: `c_${idx}`,
              coefficients: c.coefficients || c.coeffs,
              operator: c.operator || c.op || "<=",
              rhs: c.rhs !== undefined ? c.rhs : c.b,
            })),
          });
        }
      } catch {
        // silent
      }
      clearInjectedExpression();
    }
  }, [injectedExpression, clearInjectedExpression]);

  useEffect(() => {
    fetchUserHistory("mat6", "programacion_lineal").then((data) => setHistory(data));
  }, []);

  const saveCalculation = async () => {
    const title = `PL ${model.type.toUpperCase()} (${model.varNames.length} vars, ${model.constraints.length} rest.)`;
    const resSummary = `Z* = ${calculation.simplexRes.optimalZ} (${calculation.simplexRes.status})`;
    await saveUserCalculation("mat6", "programacion_lineal", title, resSummary);
    const refreshed = await fetchUserHistory("mat6", "programacion_lineal");
    setHistory(refreshed);
  };

  const clearHistory = async () => {
    await deleteUserHistory("programacion_lineal");
    setHistory([]);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(calculation.simplexRes.optimalZ.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="h-full flex flex-col gap-6 min-h-0 relative select-none">
      {viewMode === "calc" && (
        <div className="relative flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto custom-scrollbar pr-1">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 shrink-0">
            <div className="xl:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 space-y-6">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/60 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-2">
                      <Scale size={14} className="text-zinc-500" />
                      Modelo de Optimización Lineal
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono">
                      {model.varNames.length} Variables · {model.constraints.length} Restricciones
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsHelpOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-800 text-[11px] font-mono text-zinc-300 transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <Sparkles size={13} className="text-amber-400" />
                      <span>Modelos Modelo</span>
                    </button>

                    <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl p-0.5">
                      <button
                        type="button"
                        onClick={handleRemoveVariable}
                        disabled={model.varNames.length <= 2}
                        className="p-1 text-zinc-400 hover:text-zinc-100 disabled:opacity-30"
                        title="Eliminar última variable"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="px-2 text-[10px] font-mono text-zinc-300 font-bold">Vars</span>
                      <button
                        type="button"
                        onClick={handleAddVariable}
                        className="p-1 text-zinc-400 hover:text-zinc-100"
                        title="Agregar variable adicional"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold text-zinc-300">
                      Función Objetivo:
                    </span>
                    <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs font-mono">
                      <button
                        type="button"
                        onClick={() => setModel((prev) => ({ ...prev, type: "max" }))}
                        className={`px-3 py-1 rounded-lg transition-all ${
                          model.type === "max"
                            ? "bg-emerald-500 text-zinc-950 font-bold shadow-md"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        Maximizar (Max)
                      </button>
                      <button
                        type="button"
                        onClick={() => setModel((prev) => ({ ...prev, type: "min" }))}
                        className={`px-3 py-1 rounded-lg transition-all ${
                          model.type === "min"
                            ? "bg-amber-400 text-zinc-950 font-bold shadow-md"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        Minimizar (Min)
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 overflow-x-auto py-1">
                    <span className="text-sm font-serif font-bold text-zinc-400">Z =</span>
                    {model.varNames.map((vName, idx) => (
                      <div key={vName} className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.5"
                          value={model.objective[idx]}
                          onChange={(e) => updateObjectiveCoeff(idx, parseFloat(e.target.value))}
                          className="w-16 h-10 bg-zinc-900 border border-zinc-800 rounded-xl font-mono text-sm text-center text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                        <span className="font-mono text-xs font-bold text-emerald-400">{vName}</span>
                        {idx < model.varNames.length - 1 && <span className="text-zinc-600">+</span>}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold text-zinc-300">
                      Restricciones del Sistema (s.a.):
                    </span>
                    <button
                      type="button"
                      onClick={handleAddConstraint}
                      className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs font-mono text-zinc-300 flex items-center gap-1 transition-colors"
                    >
                      <Plus size={12} className="text-emerald-400" /> Añadir Restricción
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                    {model.constraints.map((c, rIdx) => (
                      <div
                        key={c.id}
                        className="flex flex-wrap items-center gap-2 p-2 rounded-xl bg-zinc-900/60 border border-zinc-800/60"
                      >
                        <span className="text-[10px] font-mono text-zinc-500 w-6">R{rIdx + 1}:</span>
                        {model.varNames.map((vName, vIdx) => (
                          <div key={vName} className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.5"
                              value={c.coefficients[vIdx]}
                              onChange={(e) =>
                                updateConstraintCoeff(c.id, vIdx, parseFloat(e.target.value))
                              }
                              className="w-14 h-8 bg-zinc-950 border border-zinc-800 rounded-lg font-mono text-xs text-center text-zinc-100 focus:outline-none focus:border-sky-500"
                            />
                            <span className="text-[11px] font-mono text-zinc-400">{vName}</span>
                            {vIdx < model.varNames.length - 1 && <span className="text-zinc-700">+</span>}
                          </div>
                        ))}

                        <select
                          value={c.operator}
                          onChange={(e) => updateConstraintOp(c.id, e.target.value as ConstraintOperator)}
                          className="h-8 bg-zinc-950 border border-zinc-800 rounded-lg font-mono text-xs text-amber-400 px-2 focus:outline-none cursor-pointer"
                        >
                          <option value="<=">≤</option>
                          <option value=">=">≥</option>
                          <option value="=">=</option>
                        </select>

                        <input
                          type="number"
                          value={c.rhs}
                          onChange={(e) => updateConstraintRhs(c.id, parseFloat(e.target.value))}
                          className="w-16 h-8 bg-zinc-950 border border-zinc-800 rounded-lg font-mono text-xs text-center text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
                        />

                        <button
                          type="button"
                          onClick={() => handleRemoveConstraint(c.id)}
                          disabled={model.constraints.length <= 1}
                          className="p-1 text-zinc-600 hover:text-rose-400 disabled:opacity-20 ml-auto"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="text-[10px] font-mono text-zinc-500 text-right pt-1">
                    Condición intrínseca: {model.varNames.join(", ")} ≥ 0 (No negatividad)
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800/60 flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-500">
                  Persistencia ReSolve · Motor Simplex 2-Fases
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

                <div className="py-3 text-center">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-1">
                    {model.type === "max" ? "Máxima Utilidad" : "Mínimo Costo"}
                  </span>
                  <div
                    className={`text-5xl font-serif font-bold tracking-tight ${
                      calculation.simplexRes.status === "optimal"
                        ? "text-emerald-400"
                        : calculation.simplexRes.status === "unbounded"
                        ? "text-amber-400"
                        : "text-rose-400"
                    }`}
                  >
                    {calculation.simplexRes.status === "optimal"
                      ? calculation.simplexRes.optimalZ
                      : calculation.simplexRes.status === "unbounded"
                      ? "∞ (No Acot.)"
                      : "Infactible"}
                  </div>
                  <span className="text-[11px] font-mono text-zinc-400 mt-2 block">
                    {calculation.simplexRes.status === "optimal"
                      ? "✓ Solución Básica Factible Óptima (SBF)"
                      : calculation.simplexRes.status === "unbounded"
                      ? "⚠️ Región No Acotada en Dirección Z"
                      : "❌ Restricciones Incompatibles (Fase 1 > 0)"}
                  </span>
                </div>

                <div className="space-y-2 font-mono text-xs">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">
                    Vector de Decisión Óptimo (X*):
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {model.varNames.map((vName, idx) => (
                      <div
                        key={vName}
                        className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70 flex justify-between items-center"
                      >
                        <span className="text-zinc-400 font-bold">{vName}:</span>
                        <strong className="text-emerald-400 text-sm">
                          {calculation.simplexRes.status === "optimal"
                            ? calculation.simplexRes.solution[idx]
                            : "—"}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>

                {calculation.simplexRes.shadowPrices && (
                  <div className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                      <span>Precios Sombra (Recursos):</span>
                      <span className="text-[10px] text-amber-400">Valor Marginal</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-mono">
                      {calculation.simplexRes.shadowPrices.map((sp, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 text-[11px]"
                        >
                          R{i + 1}: <strong className="text-emerald-400">{sp.price}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative z-10 border-t border-zinc-800/60 pt-3 mt-3">
                <button
                  type="button"
                  onClick={() => setIsSensitivityOpen(true)}
                  className="w-full p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/70 hover:border-zinc-700 flex items-center justify-between text-[11px] font-mono transition-colors group"
                >
                  <div className="flex items-center gap-1.5 text-zinc-400 group-hover:text-zinc-200">
                    <Compass size={13} className="text-amber-400" />
                    <span>Dualidad y Análisis de Sensibilidad</span>
                  </div>
                  <ChevronRight size={13} className="text-zinc-600 group-hover:text-zinc-300" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-1 min-h-[640px]">
            <div
              className={`${
                isExpanded
                  ? "absolute inset-2 z-30 bg-zinc-950/95 backdrop-blur-2xl border border-zinc-700/80 rounded-3xl p-6 shadow-2xl flex flex-col min-h-0 min-w-0 overflow-hidden"
                  : "xl:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20 space-y-4"
              }`}
            >
              <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  {calculation.is2D && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("graph")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 ${
                        activeTab === "graph"
                          ? "bg-zinc-100 text-zinc-950 font-bold shadow-md"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <Layers size={13} /> Método Gráfico 2D
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTab("simplex")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 ${
                      activeTab === "simplex" || !calculation.is2D
                        ? "bg-zinc-100 text-zinc-950 font-bold shadow-md"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <TableIcon size={13} /> Tablas Simplex ({calculation.simplexRes.tableaus.length})
                  </button>
                  {calculation.is2D && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("table")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 ${
                        activeTab === "table"
                          ? "bg-zinc-100 text-zinc-950 font-bold shadow-md"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Vértices ({calculation.geom2D?.feasibleVertices.length || 0})
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs font-mono transition-all flex items-center gap-1.5 shadow-sm"
                  title={isExpanded ? "Reducir ventana" : "Expandir a pantalla completa"}
                >
                  {isExpanded ? <Minimize2 size={13} className="text-amber-400" /> : <Maximize2 size={13} />}
                  <span>{isExpanded ? "Salir de Pantalla Completa" : "Expandir Visor"}</span>
                </button>
              </div>

              <div className="flex-1 min-h-0 flex flex-col">
                {activeTab === "graph" && calculation.is2D && (
  <div
    className="relative w-full overflow-hidden rounded-xl"
    style={{ height: isExpanded ? "calc(100vh - 220px)" : "640px" }}
  >
    <div className="absolute inset-0">
      <MathGrapher
        expression={grapherPrimaryExpr}
        secondaryExpression={grapherSecondaryExpr}
        points={grapherPoints}
        legend={grapherLegend}
        initialScale={isExpanded ? 65 : 45}
        height="h-full"
      />
    </div>
  </div>
)}

                  {activeTab === "simplex" && (
  <div
    className="relative w-full overflow-hidden rounded-xl"
    style={{ height: isExpanded ? "calc(100vh - 220px)" : "640px" }}
  >
    <div className="absolute inset-0 overflow-y-auto space-y-4 custom-scrollbar pr-1">
      {calculation.simplexRes.tableaus.map((tb, idx) => (
        <div
          key={idx}
          className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 space-y-2"
        >
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-zinc-200">{tb.description}</span>
            <span className="text-[10px] text-zinc-500">Iteración {tb.iteration}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono text-center border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 bg-zinc-900/60">
                  <th className="p-2">Base</th>
                  {tb.headers.map((h, i) => (
                    <th
                      key={i}
                      className={`p-2 ${
                        tb.pivotCol === i ? "bg-amber-500/20 text-amber-300 font-bold" : ""
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                {tb.matrix.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className={`${
                      tb.pivotRow === rIdx ? "bg-amber-500/10 text-amber-200 font-semibold" : ""
                    }`}
                  >
                    <td className="p-2 font-bold text-zinc-400">{tb.basicVars[rIdx]}</td>
                    {row.map((val, cIdx) => (
                      <td
                        key={cIdx}
                        className={`p-2 ${
                          tb.pivotRow === rIdx && tb.pivotCol === cIdx
                            ? "bg-amber-400 text-zinc-950 font-extrabold rounded"
                            : ""
                        }`}
                      >
                        {Number(val.toFixed(3))}
                      </td>
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
                
                {activeTab === "table" && calculation.geom2D && (
  <div
    className="relative w-full overflow-hidden rounded-xl"
    style={{ height: isExpanded ? "calc(100vh - 220px)" : "640px" }}
  >
    <div className="absolute inset-0 overflow-y-auto custom-scrollbar border border-zinc-800/60 rounded-2xl">
      <table className="w-full min-w-full text-left font-mono text-xs divide-y divide-zinc-800">
        <thead className="bg-zinc-900/80 text-zinc-400 sticky top-0 z-10">
          <tr>
            <th className="p-3">Vértice</th>
            <th className="p-3">Coordenada (x₁, x₂)</th>
            <th className="p-3">Valor Z</th>
            <th className="p-3">Condición</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
          {calculation.geom2D.feasibleVertices.map((v, i) => {
            const isOpt =
              calculation.simplexRes.status === "optimal" &&
              Math.abs(v.zValue - calculation.simplexRes.optimalZ) < 0.05;
            return (
              <tr key={i} className={isOpt ? "bg-emerald-500/10 font-bold" : ""}>
                <td className="p-3 text-zinc-400">V{i + 1}</td>
                <td className="p-3 text-sky-400">({v.x}, {v.y})</td>
                <td className="p-3 text-emerald-400">{v.zValue}</td>
                <td className="p-3 text-[11px]">
                  {isOpt ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                      ÓPTIMO GLOBAL
                    </span>
                  ) : (
                    <span className="text-zinc-500">Factible</span>
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
            </div>

            <div className="xl:col-span-4 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <History size={15} className="text-zinc-400" /> Historial de Optimización
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

              <div className="flex-1 min-h-[640px] overflow-y-auto space-y-2.5 mt-4 pr-1 custom-scrollbar">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-xs text-zinc-500 p-6">
                    <p>Sin modelos guardados.</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Guarda ejecuciones para auditar.</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700 transition-all flex items-center justify-between text-xs"
                    >
                      <div className="truncate pr-2 font-mono text-zinc-300">{item.expression}</div>
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

      {viewMode === "steps" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-5 shrink-0">
            <div>
              <h3 className="text-xl font-serif font-bold text-zinc-100">
                Procedimiento Riguroso del Método Simplex
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                {model.type.toUpperCase()} Z ({model.varNames.length} variables, {model.constraints.length} restricciones)
              </p>
            </div>
            <div className="text-xs font-mono px-4 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-zinc-300">
              Estado: <strong className="text-emerald-400">{calculation.simplexRes.status.toUpperCase()}</strong>
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

      {viewMode === "theory" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto shadow-xl shadow-black/20 custom-scrollbar">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800/80 bg-zinc-900/60 text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 mb-3">
              <BookOpen size={12} /> Fundamentos de Investigación Operativa
            </div>
            <h3 className="text-2xl font-serif font-bold text-zinc-100">
              Programación Lineal, Convexidad y el Algoritmo Simplex
            </h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-3xl">
              La Programación Lineal (PL) modela la asignación óptima de recursos limitados entre actividades competitivas. Formulada por George Dantzig en 1947, su sustento radica en la geometría convexa de los poliedros en ℝⁿ.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 space-y-2">
              <strong className="text-xs text-zinc-200 block font-mono uppercase tracking-wider">
                1. Teorema Fundamental de la Programación Lineal
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Si un problema lineal acotado posee una solución óptima, esta se ubica en al menos uno de los puntos extremos (vértices) del poliedro factible. Por ende, no es necesario evaluar el infinito interior de la región, sino únicamente sus puntos esquina.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 space-y-2">
              <strong className="text-xs text-zinc-200 block font-mono uppercase tracking-wider">
                2. Dualidad y Teorema de Holguras Complementarias
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                A cada problema Primal le corresponde un problema Dual idéntico en valor óptimo ($Z^* = W^*$). Los precios sombra representan el multiplicador de Lagrange del recurso, indicando cuánto incrementaría el beneficio si se añade una unidad adicional de capacidad.
              </p>
            </div>
          </div>
        </div>
      )}

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
                  <Sparkles size={16} className="text-amber-400" />
                  <h3 className="text-base font-serif font-bold text-zinc-100">
                    Modelos Universitarios de Programación Lineal
                  </h3>
                </div>
                <button
                  onClick={() => setIsHelpOpen(false)}
                  className="p-2 text-zinc-400 hover:text-zinc-100"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-5 space-y-4 max-h-[65vh] overflow-y-auto pr-1.5 text-xs custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {LP_EXAMPLES.map((ex) => (
                    <button
                      key={ex.title}
                      onClick={() => {
                        setModel(ex.model);
                        setIsHelpOpen(false);
                      }}
                      className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-left transition-all flex items-center justify-between group shadow-sm"
                    >
                      <div className="min-w-0 pr-2 space-y-0.5">
                        <span className="text-[10px] font-mono text-emerald-400/90 block font-semibold">
                          {ex.category}
                        </span>
                        <span className="font-mono text-zinc-200 text-xs block font-bold truncate">
                          {ex.title}
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

      <AnimatePresence>
        {isSensitivityOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-xl border border-zinc-800 bg-zinc-950 rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <h4 className="text-sm font-serif font-bold text-zinc-100 flex items-center gap-2">
                  <Compass size={15} className="text-amber-400" /> Análisis Dual y Sensibilidad
                </h4>
                <button
                  onClick={() => setIsSensitivityOpen(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-100"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="text-xs text-zinc-300 mt-4 space-y-4 font-sans">
                <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
                    Formulación del Problema Dual Asociado
                  </span>
                  <div className="text-emerald-400 font-mono text-xs">
                    {model.type === "max" ? "MIN W" : "MAX W"} ={" "}
                    {model.constraints.map((c, i) => `${c.rhs}y${i + 1}`).join(" + ")}
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Las variables duales $y_i$ equivalen a los precios sombra de los recursos primales.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-[11px] font-mono text-zinc-400 space-y-1.5">
                  <p>• Un precio sombra positivo ($y_i &gt; 0$) indica un recurso agotado (recurso escaso).</p>
                  <p>• Un precio sombra nulo ($y_i = 0$) indica recurso sobrante (holgura estricta).</p>
                  <p>• La igualdad $Z^* = W^*$ verifica el Teorema Fuerte de Dualidad de Von Neumann.</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}