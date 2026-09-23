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
  BarChart3,
  TrendingUp,
  Activity,
  ChevronRight,
  Info,
  Terminal,
  RotateCcw,
  Sliders,
  Table as TableIcon,
  Maximize2,
  Minimize2,
  AlertCircle,
  PieChart,
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
// TIPOS Y MODELOS ESTADÍSTICOS
// -----------------------------------------------------------------------------
export type SampleType = "sample" | "population";

export interface FrequencyInterval {
  intervalIndex: number;
  lower: number;
  upper: number;
  classMark: number;
  absoluteFreq: number;
  relativeFreq: number;
  cumulativeAbsFreq: number;
  cumulativeRelFreq: number;
}

export interface DescriptiveStats {
  n: number;
  dataSorted: number[];
  mean: number;
  median: number;
  modes: number[];
  variance: number;
  stdDev: number;
  cv: number;
  range: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  iqr: number;
  p10: number;
  p90: number;
  outliers: number[];
  skewness: number;
  kurtosis: number;
  intervals: FrequencyInterval[];
  rawSum: number;
  sumSquares: number;
}

interface ModuleExample {
  title: string;
  category: string;
  statement: string;
  dataString: string;
  desc: string;
}

const MODULE_EXAMPLES: ModuleExample[] = [
  {
    title: "Latencia de Servidores en la Nube (SRE / DevOps)",
    category: "Computación en la Nube",
    statement: "Tiempos de respuesta (ms) registrados en 20 microservicios de pago.",
    dataString: "42, 45, 48, 44, 52, 49, 46, 47, 55, 43, 44, 46, 50, 51, 48, 47, 49, 120, 46, 45",
    desc: "Muestra la presencia de un cuello de botella extremo (outlier en 120 ms).",
  },
  {
    title: "Control de Calidad: Tolerancia de Microchips (μm)",
    category: "Ingeniería Industrial",
    statement: "Desviaciones de grosor en obleas de silicio de precisión milimétrica.",
    dataString: "10.2, 10.4, 9.8, 10.1, 10.0, 10.3, 9.9, 10.1, 10.2, 10.0, 9.7, 10.5, 10.1, 9.9, 10.2",
    desc: "Distribución cuasi-normal homogénea con bajísimo coeficiente de variación.",
  },
  {
    title: "Calificaciones de Examen de Cálculo Vectorial",
    category: "Rendimiento Académico",
    statement: "Notas sobre 100 de un grupo de estudiantes de ingeniería de software.",
    dataString: "35, 42, 58, 65, 70, 72, 75, 78, 80, 82, 85, 88, 90, 92, 95, 98, 45, 60, 74, 82",
    desc: "Asimetría negativa común en pruebas con alta tasa de aprobados concentrados.",
  },
  {
    title: "Tiempos de Ejecución de un Algoritmo Cuadrático (s)",
    category: "Análisis de Algoritmos",
    statement: "Tiempos medidos para 15 instancias de prueba con entrada aleatoria n=5000.",
    dataString: "2.14, 2.18, 2.10, 2.25, 2.15, 2.30, 2.12, 2.19, 2.22, 2.16, 2.40, 2.15, 2.11, 2.20, 2.17",
    desc: "Evaluación de consistencia y estabilidad del recolector de basura en JVM.",
  },
  {
    title: "Autonomía de Baterías de Sensores IoT (Horas)",
    category: "Hardware y Sistemas Embebidos",
    statement: "Duración continua de nodos sensores inalámbricos en campo agrícola.",
    dataString: "720, 745, 710, 690, 730, 715, 740, 755, 700, 725, 735, 718, 680, 760, 722",
    desc: "Análisis de dispersión con agrupamiento en intervalos según la Regla de Sturges.",
  },
];

// -----------------------------------------------------------------------------
// PARSER Y MOTOR MATEMÁTICO
// -----------------------------------------------------------------------------
function parseDataset(rawInput: string): number[] {
  const matches = rawInput.match(/-?\d+(?:\.\d+)?/g);
  if (!matches) return [];
  return matches.map(Number).filter((n) => !isNaN(n));
}

function calculatePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  const weight = rank - low;
  return Number((sorted[low] * (1 - weight) + sorted[high] * weight).toFixed(3));
}

function computeDescriptiveStats(data: number[], sampleType: SampleType): DescriptiveStats | null {
  const n = data.length;
  if (n < 2) return null;

  const sorted = [...data].sort((a, b) => a - b);
  const rawSum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = rawSum / n;

  const mid = Math.floor(n / 2);
  const median = n % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  const freqMap = new Map<number, number>();
  let maxFreq = 0;
  sorted.forEach((val) => {
    const count = (freqMap.get(val) || 0) + 1;
    freqMap.set(val, count);
    if (count > maxFreq) maxFreq = count;
  });

  const modes: number[] = [];
  if (maxFreq > 1) {
    freqMap.forEach((count, val) => {
      if (count === maxFreq) modes.push(val);
    });
  }

  const divisor = sampleType === "sample" ? n - 1 : n;
  let sumSquaredDiffs = 0;
  let sumCubes = 0;
  let sumQuads = 0;

  sorted.forEach((x) => {
    const diff = x - mean;
    sumSquaredDiffs += diff * diff;
    sumCubes += Math.pow(diff, 3);
    sumQuads += Math.pow(diff, 4);
  });

  const variance = sumSquaredDiffs / divisor;
  const stdDev = Math.sqrt(variance);
  const cv = mean !== 0 ? (stdDev / Math.abs(mean)) * 100 : 0;

  const min = sorted[0];
  const max = sorted[n - 1];
  const range = max - min;

  const q1 = calculatePercentile(sorted, 25);
  const q3 = calculatePercentile(sorted, 75);
  const iqr = q3 - q1;
  const p10 = calculatePercentile(sorted, 10);
  const p90 = calculatePercentile(sorted, 90);

  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  const outliers = sorted.filter((x) => x < lowerFence || x > upperFence);

  let skewness = 0;
  let kurtosis = 0;
  if (stdDev > 1e-8 && n >= 3) {
    const m3 = sumCubes / n;
    const m4 = sumQuads / n;
    skewness = m3 / Math.pow(stdDev, 3);
    kurtosis = m4 / Math.pow(variance, 2) - 3;
  }

  const k = Math.max(4, Math.min(12, Math.ceil(1 + 3.322 * Math.log10(n))));
  const classWidth = range === 0 ? 1 : Number(((range / k) * 1.01).toFixed(3));
  const intervals: FrequencyInterval[] = [];

  let currentLower = min;
  let runningCumulative = 0;

  for (let i = 0; i < k; i++) {
    const currentUpper = Number((currentLower + classWidth).toFixed(3));
    const count = sorted.filter((v) =>
      i === k - 1
        ? v >= currentLower && v <= currentUpper
        : v >= currentLower && v < currentUpper
    ).length;

    runningCumulative += count;

    intervals.push({
      intervalIndex: i + 1,
      lower: Number(currentLower.toFixed(3)),
      upper: currentUpper,
      classMark: Number(((currentLower + currentUpper) / 2).toFixed(3)),
      absoluteFreq: count,
      relativeFreq: Number((count / n).toFixed(4)),
      cumulativeAbsFreq: runningCumulative,
      cumulativeRelFreq: Number((runningCumulative / n).toFixed(4)),
    });

    currentLower = currentUpper;
  }

  return {
    n,
    dataSorted: sorted,
    mean: Number(mean.toFixed(3)),
    median: Number(median.toFixed(3)),
    modes,
    variance: Number(variance.toFixed(4)),
    stdDev: Number(stdDev.toFixed(4)),
    cv: Number(cv.toFixed(2)),
    range: Number(range.toFixed(3)),
    min,
    max,
    q1,
    q3,
    iqr: Number(iqr.toFixed(3)),
    p10,
    p90,
    outliers,
    skewness: Number(skewness.toFixed(3)),
    kurtosis: Number(kurtosis.toFixed(3)),
    intervals,
    rawSum: Number(rawSum.toFixed(3)),
    sumSquares: Number(sumSquaredDiffs.toFixed(3)),
  };
}

// -----------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// -----------------------------------------------------------------------------
export default function DescriptiveStatisticsView({
  viewMode,
  initialExpression = "",
}: {
  viewMode: "calc" | "steps" | "theory";
  initialExpression?: string;
}) {
  const [dataInput, setDataInput] = useState<string>(
    initialExpression || "42, 45, 48, 44, 52, 49, 46, 47, 55, 43, 44, 46, 50, 51, 48, 47, 49, 120, 46, 45"
  );
  const [sampleType, setSampleType] = useState<SampleType>("sample");
  const [activeTab, setActiveTab] = useState<"histogram" | "table" | "boxplot">("histogram");
  const [isExpanded, setIsExpanded] = useState(false);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isAdvancedModalOpen, setIsAdvancedModalOpen] = useState(false);

  const { setAIContext, injectedExpression, clearInjectedExpression } = useAIContext();

  const parsedNumbers = useMemo(() => parseDataset(dataInput), [dataInput]);
  const stats = useMemo(() => computeDescriptiveStats(parsedNumbers, sampleType), [parsedNumbers, sampleType]);

  // Máxima frecuencia absoluta (para histograma) — memoizado
  const maxAbsoluteFreq = useMemo(() => {
    if (!stats || stats.intervals.length === 0) return 1;
    return Math.max(...stats.intervals.map((i) => i.absoluteFreq), 1);
  }, [stats]);

  const analyticalSteps = useMemo(() => {
    if (!stats) return [];
    const steps: { stage: string; desc: string; math: string; rule: string }[] = [];
    let id = 1;

    steps.push({
      stage: `${id++}. Muestra Ordenada y Tamaño Muestral`,
      desc: `Conjunto de ${stats.n} observaciones numéricas ordenadas en orden ascendente para computar estadísticos de posición.`,
      math: `x_{(i)} = \\{ ${stats.dataSorted.slice(0, 12).join(", ")}${stats.n > 12 ? ", \\dots" : ""} \\}, \\quad n = ${stats.n}`,
      rule: "Arreglo Ordenado",
    });

    steps.push({
      stage: `${id++}. Media Aritmética Muestral (Centroide)`,
      desc: "Promedio ponderado de las observaciones evaluado como la suma total dividida entre el número de datos.",
      math: `\\bar{x} = \\frac{1}{n}\\sum_{i=1}^n x_i = \\frac{${stats.rawSum}}{${stats.n}} = ${stats.mean}`,
      rule: "Tendencia Central",
    });

    const modeStr = stats.modes.length > 0 ? stats.modes.join(", ") : "\\text{Amodal (Sin repeticiones)}";
    steps.push({
      stage: `${id++}. Mediana y Moda`,
      desc: "La mediana divide a la distribución en dos mitades del 50%, mientras que la moda refleja la mayor frecuencia absoluta.",
      math: `Me = x_{\\frac{n+1}{2}} = ${stats.median}, \\quad Mo = ${modeStr}`,
      rule: "Robustez ante Outliers",
    });

    const varSymbol = sampleType === "sample" ? "s^2" : "\\sigma^2";
    const stdSymbol = sampleType === "sample" ? "s" : "\\sigma";
    const div = sampleType === "sample" ? `n - 1 = ${stats.n - 1}` : `N = ${stats.n}`;

    steps.push({
      stage: `${id++}. Varianza y Dispersión Estándar`,
      desc: `Suma de desviaciones cuadráticas respecto a la media (${stats.sumSquares}) dividida entre los grados de libertad.`,
      math: `${varSymbol} = \\frac{\\sum (x_i - \\bar{x})^2}{${div}} = \\frac{${stats.sumSquares}}{${sampleType === "sample" ? stats.n - 1 : stats.n}} = ${stats.variance} \\\\[6pt] ${stdSymbol} = \\sqrt{${varSymbol}} = ${stats.stdDev}, \\quad CV = \\frac{${stdSymbol}}{\\bar{x}} \\times 100\\% = ${stats.cv}\\%`,
      rule: sampleType === "sample" ? "Corrección de Bessel (n-1)" : "Poblacional (N)",
    });

    steps.push({
      stage: `${id++}. Cuartiles y Detección de Valores Atípicos (Tukey)`,
      desc: "Límites valla para clasificar anomalías: [Q1 - 1.5·IQR, Q3 + 1.5·IQR].",
      math: `Q_1 = ${stats.q1}, \\quad Q_3 = ${stats.q3}, \\quad \\text{IQR} = Q_3 - Q_1 = ${stats.iqr} \\\\[4pt] \\text{Valla Inferior} = ${Number((stats.q1 - 1.5 * stats.iqr).toFixed(2))}, \\quad \\text{Valla Superior} = ${Number((stats.q3 + 1.5 * stats.iqr).toFixed(2))} \\\\[4pt] \\text{Atípicos Detectados} = \\{ ${stats.outliers.length > 0 ? stats.outliers.join(", ") : "\\emptyset"} \\}`,
      rule: "Exploratory Data Analysis (EDA)",
    });

    steps.push({
      stage: `${id++}. Regla de Sturges para Intervalos de Clase`,
      desc: "Número óptimo de intervalos k para la construcción del histograma sin distorsión de densidad.",
      math: `k = 1 + 3.322 \\log_{10}(${stats.n}) \\approx ${stats.intervals.length}, \\quad c = \\frac{\\text{Rango}}{k} = \\frac{${stats.range}}{${stats.intervals.length}} \\approx ${stats.intervals[0]?.upper - stats.intervals[0]?.lower}`,
      rule: "Agrupamiento de Datos",
    });

    return steps;
  }, [stats, sampleType]);

  useEffect(() => {
    if (!stats) return;
    const summary = `Estadística Descriptiva | n=${stats.n} | x̄=${stats.mean} | s=${stats.stdDev} | Me=${stats.median} | CV=${stats.cv}% | Outliers: [${stats.outliers.join(", ")}] | Asimetría: ${stats.skewness}`;

    setAIContext({
      module: "Matemáticas V",
      subtopic: "Estadística Descriptiva",
      expression: `Datos: {${stats.dataSorted.slice(0, 8).join(", ")}...}`,
      result: `x̄ = ${stats.mean}, s = ${stats.stdDev}`,
      details: summary,
    });
  }, [stats, setAIContext]);

  useEffect(() => {
    if (injectedExpression) {
      setDataInput(injectedExpression);
      clearInjectedExpression();
    }
  }, [injectedExpression, clearInjectedExpression]);

  useEffect(() => {
    fetchUserHistory("mat5", "estadistica_descriptiva").then((data) => setHistory(data));
  }, []);

  const saveCalculation = async () => {
    if (!stats) return;
    const title = `Estadística (n = ${stats.n}, ${sampleType === "sample" ? "Muestral" : "Poblacional"})`;
    const resSummary = `x̄ = ${stats.mean} | s = ${stats.stdDev} | Me = ${stats.median} | CV = ${stats.cv}%`;
    await saveUserCalculation("mat5", "estadistica_descriptiva", title, resSummary);
    const refreshed = await fetchUserHistory("mat5", "estadistica_descriptiva");
    setHistory(refreshed);
  };

  const clearHistory = async () => {
    await deleteUserHistory("estadistica_descriptiva");
    setHistory([]);
  };

  const handleCopy = () => {
    if (!stats) return;
    navigator.clipboard.writeText(`Media: ${stats.mean}, Mediana: ${stats.median}, DesvEst: ${stats.stdDev}, CV: ${stats.cv}%`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="h-full flex flex-col gap-6 min-h-0 relative select-none">
      {viewMode === "calc" && (
        <div className="flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto custom-scrollbar pr-1 relative">
          {/* SECCIÓN SUPERIOR */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 shrink-0">
            {/* Panel Izquierdo: Consola de Datos */}
            <div className="xl:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 space-y-5">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/60 pb-3">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-2">
                    <BarChart3 size={14} className="text-zinc-500" />
                    Consola de Datos y Enunciados Estadísticos
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsHelpOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-800 text-[11px] font-mono text-zinc-300 transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <Sparkles size={13} className="text-amber-400" />
                      <span>Casos de Estudio</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDataInput("")}
                      className="p-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-zinc-400 hover:text-rose-400 transition-colors"
                      title="Limpiar entrada"
                    >
                      <RotateCcw size={13} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                    <span>Ingresa números, párrafos o listas:</span>
                    <span className="text-[11px] text-emerald-400 font-bold">
                      {stats ? `${stats.n} observaciones extraídas` : "Esperando datos..."}
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={dataInput}
                    onChange={(e) => setDataInput(e.target.value)}
                    placeholder="Pega aquí tus valores separados por comas, espacios o el enunciado del problema (ej: 12, 14.5, 18, 22, 19)..."
                    className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/60 transition-all shadow-inner custom-scrollbar"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/70 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500 text-[10px] uppercase">Enfoque:</span>
                    <div className="flex bg-zinc-900 p-0.5 rounded-xl border border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setSampleType("sample")}
                        className={`px-3 py-1 rounded-lg transition-all ${
                          sampleType === "sample"
                            ? "bg-zinc-100 text-zinc-950 font-bold shadow-md"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        Muestral (n - 1)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSampleType("population")}
                        className={`px-3 py-1 rounded-lg transition-all ${
                          sampleType === "population"
                            ? "bg-zinc-100 text-zinc-950 font-bold shadow-md"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        Poblacional (N)
                      </button>
                    </div>
                  </div>

                  <div className="text-[11px] text-zinc-400 flex items-center gap-2">
                    <span>Rango: <strong className="text-zinc-200">{stats ? `[${stats.min}, ${stats.max}]` : "—"}</strong></span>
                    <span>·</span>
                    <span>Amplitud: <strong className="text-emerald-400">{stats?.range ?? "—"}</strong></span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-500">
                  Persistencia ReSolve · Motor Descriptivo
                </span>
                <button
                  type="button"
                  onClick={saveCalculation}
                  disabled={!stats}
                  className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-semibold text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-40"
                >
                  Guardar en Historial
                </button>
              </div>
            </div>

            {/* Panel Derecho: Tarjeta Hero */}
            <div className="xl:col-span-4 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden relative">
              <div className="pointer-events-none absolute -bottom-16 -right-16 w-52 h-52 bg-emerald-500/10 rounded-full blur-3xl" />

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold">
                    Media Aritmética (x̄)
                  </span>
                  {stats && (
                    <button
                      onClick={handleCopy}
                      className="text-xs text-zinc-400 hover:text-zinc-100 flex items-center gap-1.5 transition-colors py-1 px-2.5 rounded-lg border border-zinc-800/60 bg-zinc-900/50"
                    >
                      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      {copied ? "Copiado" : "Copiar"}
                    </button>
                  )}
                </div>

                <div className="py-2 text-center">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-1">
                    Centro de Masa / Promedio
                  </span>
                  <div className="text-5xl font-serif font-bold text-emerald-400 tracking-tight">
                    {stats ? stats.mean : "—"}
                  </div>
                  <span className="text-[11px] font-mono text-zinc-400 mt-2 block">
                    {stats
                      ? `Mediana = ${stats.median} | Desv. Estándar = ${stats.stdDev}`
                      : "Inserta datos numéricos"}
                  </span>
                </div>

                {stats && (
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                      <span className="text-[10px] text-zinc-500 block">Coef. Variación (CV)</span>
                      <strong className={`text-sm ${stats.cv > 30 ? "text-amber-400" : "text-emerald-400"}`}>
                        {stats.cv}%
                      </strong>
                      <span className="text-[9px] text-zinc-500 block mt-0.5">
                        {stats.cv > 30 ? "Heterogéneo" : "Homogéneo"}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                      <span className="text-[10px] text-zinc-500 block">Varianza ({sampleType === "sample" ? "s²" : "σ²"})</span>
                      <strong className="text-sm text-zinc-200">{stats.variance}</strong>
                      <span className="text-[9px] text-zinc-500 block mt-0.5">Unidades²</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                      <span className="text-[10px] text-zinc-500 block">Rango Intercuartil</span>
                      <strong className="text-sm text-sky-400">IQR = {stats.iqr}</strong>
                      <span className="text-[9px] text-zinc-500 block mt-0.5">Q3 - Q1</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                      <span className="text-[10px] text-zinc-500 block">Moda(s)</span>
                      <strong className="text-sm text-amber-300 truncate block">
                        {stats.modes.length > 0 ? stats.modes.join(", ") : "Amodal"}
                      </strong>
                      <span className="text-[9px] text-zinc-500 block mt-0.5">Frecuencia max</span>
                    </div>
                  </div>
                )}

                {stats && stats.outliers.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-rose-300 text-xs font-mono">
                    <AlertCircle size={15} className="shrink-0" />
                    <span className="truncate">
                      {stats.outliers.length} Outlier(s) detectado(s): <strong>{stats.outliers.join(", ")}</strong>
                    </span>
                  </div>
                )}
              </div>

              <div className="relative z-10 border-t border-zinc-800/60 pt-3 mt-3">
                <button                  type="button"
                  onClick={() => setIsAdvancedModalOpen(true)}
                  disabled={!stats}
                  className="w-full p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/70 hover:border-zinc-700 flex items-center justify-between text-[11px] font-mono transition-colors group disabled:opacity-40"
                >
                  <div className="flex items-center gap-1.5 text-zinc-400 group-hover:text-zinc-200">
                    <PieChart size={13} className="text-amber-400" />
                    <span>Forma, Asimetría y Curtosis</span>
                  </div>
                  <ChevronRight size={13} className="text-zinc-600 group-hover:text-zinc-300" />
                </button>
              </div>
            </div>
          </div>

          {/* SECCIÓN INFERIOR */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-1 min-h-0">
            {/* Contenedor Visual y Tabular */}
            <div
              className={`${
                isExpanded
                  ? "absolute inset-2 z-30 bg-zinc-950/95 backdrop-blur-2xl border border-zinc-700/80 rounded-3xl p-6 shadow-2xl flex flex-col overflow-hidden"
                  : "xl:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20 space-y-4"
              }`}
            >
              {/* Pestañas */}
              <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("histogram")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 ${
                      activeTab === "histogram"
                        ? "bg-zinc-100 text-zinc-950 font-bold shadow-md"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <BarChart3 size={13} /> Histograma de Frecuencias
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("table")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 ${
                      activeTab === "table"
                        ? "bg-zinc-100 text-zinc-950 font-bold shadow-md"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <TableIcon size={13} /> Tabla de Frecuencias (Sturges)
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("boxplot")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 ${
                      activeTab === "boxplot"
                        ? "bg-zinc-100 text-zinc-950 font-bold shadow-md"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Activity size={13} /> Diagrama Boxplot
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

              {/* Contenido Dinámico — flex flex-col para que flex-1 propague */}
              <div className="flex-1 min-h-0 pt-2 flex flex-col">

                {/* 1. HISTOGRAMA DE FRECUENCIAS */}
                {activeTab === "histogram" && stats && (
                  <div className="w-full flex flex-col flex-1 min-h-0 p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 overflow-hidden">
                    {/* Área del gráfico: relativa, con altura explícita vía flex-1 */}
                    <div className="relative flex-1 min-h-0 flex flex-col">
                      {/* Indicador de frecuencia máxima */}
                      <div className="absolute top-0 right-2 z-20 rounded-md bg-zinc-950/90 px-2 py-1 text-[10px] font-mono text-zinc-500 border border-zinc-800/60">
                        Frecuencia Máxima: {maxAbsoluteFreq}
                      </div>

                      {/* Área de barras: top-9 reserva el indicador, pb-8 reserva los labels */}
                      <div className="flex-1 min-h-0 pt-9 pb-8">
                        <div className="relative h-full border-b border-zinc-800">
                          <div className="absolute inset-0 flex items-end gap-2">
                            {stats.intervals.map((it) => {
                              const heightPct =
                                it.absoluteFreq === 0
                                  ? 0
                                  : Math.max(4, (it.absoluteFreq / maxAbsoluteFreq) * 100);

                              return (
                                <div
                                  key={it.intervalIndex}
                                  className="relative flex-1 h-full min-w-0 group"
                                >
                                  {/* Barra */}
                                  <div
                                    className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-emerald-600/40 via-emerald-500/60 to-emerald-400 rounded-t-lg transition-all border-t border-emerald-300 group-hover:brightness-125"
                                    style={{ height: `${heightPct}%` }}
                                  />

                                  {/* Etiqueta numérica: pegada al TOPE de la barra, con fondo para legibilidad */}
                                  <span
                                    className="absolute left-0 right-0 z-10 mx-auto w-fit px-1 rounded text-center text-[10px] font-mono text-emerald-300 font-bold leading-none bg-zinc-950/80 transition-transform group-hover:scale-110"
                                    style={{
                                      bottom: `calc(${heightPct}% + 2px)`,
                                    }}
                                  >
                                    {it.absoluteFreq}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Labels de intervalo: alineados 1:1 con las barras */}
                      <div className="h-8 shrink-0 flex gap-2 items-start pt-1">
                        {stats.intervals.map((it) => (
                          <span
                            key={`label-${it.intervalIndex}`}
                            className="flex-1 min-w-0 text-[9px] font-mono text-zinc-400 text-center leading-tight"
                            title={`[${it.lower} - ${it.upper})`}
                          >
                            <span className="block truncate">
                              {it.lower}–{it.upper}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="shrink-0 pt-3 text-center text-[10px] font-mono text-zinc-500">
                      Intervalos de clase evaluados mediante Regla de Sturges (k = {stats.intervals.length})
                    </div>
                  </div>
                )}

                {/* 2. TABLA DE FRECUENCIAS */}
                {activeTab === "table" && stats && (
                  <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar border border-zinc-800/60 rounded-2xl">
                    <table className="w-full min-w-full text-left font-mono text-xs divide-y divide-zinc-800">
                      <thead className="bg-zinc-900/80 text-zinc-400 sticky top-0 z-10">
                        <tr>
                          <th className="p-2.5">Clase</th>
                          <th className="p-2.5">Intervalo [Li - Ui)</th>
                          <th className="p-2.5">Marca (xi)</th>
                          <th className="p-2.5">f_i (Abs)</th>
                          <th className="p-2.5">h_i (Rel)</th>
                          <th className="p-2.5">F_i (Acum)</th>
                          <th className="p-2.5">H_i (%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                        {stats.intervals.map((it) => (
                          <tr key={it.intervalIndex} className="hover:bg-zinc-900/30">
                            <td className="p-2.5 text-zinc-500">#{it.intervalIndex}</td>
                            <td className="p-2.5 font-bold text-sky-400">[{it.lower}, {it.upper})</td>
                            <td className="p-2.5 text-zinc-200">{it.classMark}</td>
                            <td className="p-2.5 text-emerald-400 font-bold">{it.absoluteFreq}</td>
                            <td className="p-2.5 text-zinc-400">{it.relativeFreq}</td>
                            <td className="p-2.5 text-zinc-300">{it.cumulativeAbsFreq}</td>
                            <td className="p-2.5 text-amber-400">{(it.cumulativeRelFreq * 100).toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 3. BOXPLOT */}
                {activeTab === "boxplot" && stats && (
                  <div className="w-full flex-1 min-h-0 flex flex-col justify-center p-6 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 space-y-6 overflow-hidden">
                    <div className="space-y-1 text-center">
                      <span className="text-xs font-mono text-zinc-400">
                        Resumen de 5 Números de Tukey: Min={stats.min} | Q1={stats.q1} | Me={stats.median} | Q3={stats.q3} | Max={stats.max}
                      </span>
                    </div>

                    <div className="relative h-24 w-full shrink-0">
                      {/* Línea de bigotes */}
                      <div className="absolute left-[5%] right-[5%] top-1/2 -translate-y-1/2 h-1 bg-zinc-700 rounded" />

                      {/* Contenedor del rango min→max para posicionar la caja */}
                      <div className="absolute left-[5%] right-[5%] top-1/2 -translate-y-1/2 h-16">
                        <div
                          style={{
                            left: `${Math.max(0, Math.min(100, ((stats.q1 - stats.min) / (stats.range || 1)) * 100))}%`,
                            width: `${Math.max(0.5, Math.min(100, (stats.iqr / (stats.range || 1)) * 100))}%`,
                          }}
                          className="absolute top-0 h-full bg-emerald-500/20 border-2 border-emerald-400 rounded-xl backdrop-blur-sm"
                        >
                          <div
                            className="absolute top-0 h-full w-1 bg-amber-400"
                            style={{
                              left: `${Math.max(0, Math.min(100, ((stats.median - stats.q1) / (stats.iqr || 1)) * 100))}%`,
                            }}
                            title={`Mediana: ${stats.median}`}
                          />
                        </div>
                      </div>

                      {/* Extremos */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-8 bg-zinc-400 rounded"
                        style={{ left: "5%" }}
                        title={`Min: ${stats.min}`}
                      />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 translate-x-1/2 w-2.5 h-8 bg-zinc-400 rounded"
                        style={{ right: "5%" }}
                        title={`Max: ${stats.max}`}
                      />
                    </div>

                    <div className="flex justify-between text-xs font-mono text-zinc-400 px-2 shrink-0">
                      <span>Mínimo: {stats.min}</span>
                      <span className="text-emerald-400 font-bold">Q1: {stats.q1}</span>
                      <span className="text-amber-400 font-bold">Mediana: {stats.median}</span>
                      <span className="text-emerald-400 font-bold">Q3: {stats.q3}</span>
                      <span>Máximo: {stats.max}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Panel Historial */}
            <div className="xl:col-span-4 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <History size={15} className="text-zinc-400" /> Historial de Análisis
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
                    <p>Sin cálculos guardados.</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Guarda muestras para consultar después.</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setDataInput(item.expression)}
                      className="group p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700 hover:bg-zinc-900/80 cursor-pointer transition-all flex items-center justify-between text-xs"
                    >
                      <div className="truncate pr-2 font-mono text-zinc-300 group-hover:text-zinc-100">
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
                Procedimiento y Deducción Estadística
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                Muestra de {stats?.n || 0} observaciones · Enfoque {sampleType === "sample" ? "Muestral" : "Poblacional"}
              </p>
            </div>
            <div className="text-xs font-mono px-4 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-zinc-300">
              Media: <strong className="text-emerald-400 font-serif">{stats?.mean || "—"}</strong>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {analyticalSteps.map((st, i) => (
              <div
                key={i}
                className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700/80 transition-all flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-200 font-mono">{st.stage}</span>
                  <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900/80 px-2 py-0.5 rounded-md border border-zinc-800">
                    {st.rule}
                  </span>
                </div>
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
              <BookOpen size={12} /> Fundamentos de Ciencia de Datos y Probabilidad
            </div>
            <h3 className="text-2xl font-serif font-bold text-zinc-100">
              Análisis Exploratorio de Datos (EDA) y Distribución
            </h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-3xl">
              La estadística descriptiva proporciona los cimientos cuantitativos para resumir, verificar anomalías y detectar sesgos en grandes volúmenes de datos antes de entrenar modelos de Inteligencia Artificial.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 space-y-2">
              <strong className="text-xs text-zinc-200 block font-mono uppercase tracking-wider">
                1. Teorema de Chebyshev y Dispersión
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Para cualquier distribución de datos, la proporción de observaciones que se ubican a menos de k desviaciones estándar de la media es al menos 1 - 1/k². Para k=2, al menos el 75% de los datos se encuentra en [x̄ - 2s, x̄ + 2s].
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 space-y-2">
              <strong className="text-xs text-zinc-200 block font-mono uppercase tracking-wider">
                2. Sensibilidad ante Outliers: Media vs Mediana
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                La media es susceptible a valores extremos, mientras que la mediana y el rango intercuartil (IQR) son medidas robustas que preservan la representatividad central en distribuciones asimétricas o con colas pesadas.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE FORMA, ASIMETRÍA Y CURTOSIS */}
      <AnimatePresence>
        {isAdvancedModalOpen && stats && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg border border-zinc-800 bg-zinc-950 rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <h4 className="text-sm font-serif font-bold text-zinc-100 flex items-center gap-2">
                  <PieChart size={15} className="text-amber-400" /> Estadísticos de Forma y Momentos
                </h4>
                <button onClick={() => setIsAdvancedModalOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-100">
                  <X size={16} />
                </button>
              </div>

              <div className="text-xs text-zinc-300 mt-4 space-y-3 font-sans">
                <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-zinc-400">Coeficiente de Asimetría (Fisher):</span>
                    <strong className="font-mono text-emerald-400">{stats.skewness}</strong>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    {stats.skewness > 0.5
                      ? "Sesgo a la derecha (Cola positiva prolongada)"
                      : stats.skewness < -0.5
                      ? "Sesgo a la izquierda (Cola negativa prolongada)"
                      : "Distribución simétrica aproximada"}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-zinc-400">Exceso de Curtosis:</span>
                    <strong className="font-mono text-sky-400">{stats.kurtosis}</strong>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    {stats.kurtosis > 0.5
                      ? "Leptocúrtica (Puntiaguda con colas pesadas)"
                      : stats.kurtosis < -0.5
                      ? "Platicúrtica (Aplanada con baja dispersión)"
                      : "Mesocúrtica (Similar a la curva normal estándar)"}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-[11px] font-mono text-zinc-400 space-y-1">
                  <p>• Percentil 10 (P10): {stats.p10}</p>
                  <p>• Percentil 90 (P90): {stats.p90}</p>
                  <p>• Sumatoria Simple Σx: {stats.rawSum}</p>
                  <p>• Suma de Cuadrados Σ(x - x̄)²: {stats.sumSquares}</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL GUÍA */}
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
                    <h3 className="text-base font-serif font-bold text-zinc-100">Guía General de Estadística Descriptiva</h3>
                    <p className="text-xs text-zinc-400">Procesamiento de texto, formatos y catálogo de problemas aplicados</p>
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
                    <Terminal size={13} className="text-zinc-400" /> Extracción Inteligente de Datos
                  </h4>
                  <p className="text-zinc-400 leading-relaxed">
                    No necesitas pre-formatear tus datos. Puedes copiar directamente enunciados de exámenes, columnas de Excel o reportes de laboratorio. El motor filtra las palabras y compila todas las observaciones numéricas automáticamente.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
                  <h4 className="font-mono uppercase tracking-wider text-zinc-300 font-semibold mb-2 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-400" /> Casos Notables (Haz clic para cargar de inmediato)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {MODULE_EXAMPLES.map((ex) => (
                      <button
                        key={ex.title}
                        onClick={() => {
                          setDataInput(ex.dataString);
                          setIsHelpOpen(false);
                        }}
                        className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-left transition-all flex items-center justify-between group shadow-sm"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="text-[10px] font-mono text-emerald-400/90 block font-semibold">{ex.category}</span>
                          <span className="font-mono text-zinc-200 text-[11px] block truncate font-bold">{ex.title}</span>
                          <span className="text-[10px] text-zinc-500 block truncate">{ex.desc}</span>
                        </div>
                        <ChevronRight size={13} className="text-zinc-600 group-hover:text-zinc-200 shrink-0 transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
                  <h4 className="font-mono uppercase tracking-wider text-zinc-300 font-semibold mb-1 flex items-center gap-1.5">
                    <Cpu size={13} className="text-emerald-400" /> Aplicaciones en Inteligencia Artificial y Computación
                  </h4>
                  <ul className="list-disc pl-4 space-y-1.5 text-zinc-400 leading-relaxed">
                    <li><strong>Normalización de Features (Z-Score):</strong> El escalado estándar $z = (x - \mu) / \sigma$ en redes neuronales depende de la media y varianza muestral.</li>
                    <li><strong>Detección de Anomalías:</strong> Identificación de accesos no autorizados o fallos de hardware mediante el criterio IQR de Tukey.</li>
                    <li><strong>Ingeniería de Confiabilidad (SRE):</strong> Los percentiles P90 y P99 garantizan acuerdos de nivel de servicio (SLA) en sistemas de alta disponibilidad.</li>
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