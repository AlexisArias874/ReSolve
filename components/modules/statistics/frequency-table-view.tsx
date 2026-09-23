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
  BarChart2,
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
  Layers,
  Cpu,
  ArrowDownRight,
  Percent
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
// TIPOS Y MODELOS DE DISTRIBUCIONES DE FRECUENCIA
// -----------------------------------------------------------------------------
export type GroupingMethod = "sturges" | "sqrt" | "manual";

export interface FrequencyRow {
  index: number;
  lower: number;
  upper: number;
  classMark: number;
  absFreq: number;
  relFreq: number;
  pctFreq: number;
  cumAbsAsc: number;
  cumPctAsc: number;
  cumAbsDesc: number;
  fx: number;
}

export interface GroupedAnalysis {
  n: number;
  k: number;
  range: number;
  classWidth: number;
  min: number;
  max: number;
  rows: FrequencyRow[];
  groupedMean: number;
  groupedMedian: number;
  groupedMode: number;
  medianClassIndex: number;
  modalClassIndex: number;
}

interface ModuleExample {
  title: string;
  category: string;
  dataString: string;
  desc: string;
}

const MODULE_EXAMPLES: ModuleExample[] = [
  {
    title: "Tiempos de Respuesta HTTP en Microservicios (ms)",
    category: "Sistemas Distribuidos",
    dataString: "112, 115, 118, 122, 125, 128, 130, 132, 135, 138, 140, 142, 145, 148, 150, 152, 155, 160, 165, 170, 175, 185, 195, 210",
    desc: "Distribución asimétrica para auditar percentiles SLA en infraestructura Cloud.",
  },
  {
    title: "Salarios Mensuales de Desarrolladores Jr/Mid (k USD)",
    category: "Economía y Talento Tech",
    dataString: "32, 35, 38, 40, 42, 45, 45, 48, 50, 52, 55, 55, 58, 60, 62, 65, 68, 72, 75, 80, 85, 90",
    desc: "Segmentación en intervalos de ingresos para análisis de equidad salarial.",
  },
  {
    title: "Consumo Eléctrico de Racks en Centro de Datos (kW/h)",
    category: "Eficiencia Energética",
    dataString: "4.2, 4.5, 4.8, 5.1, 5.2, 5.4, 5.5, 5.7, 5.8, 6.0, 6.1, 6.3, 6.4, 6.6, 6.8, 7.0, 7.2, 7.5, 7.9, 8.3",
    desc: "Evaluación de demanda base y picos térmicos para dimensionamiento de UPS.",
  },
  {
    title: "Pruebas de Esfuerzo: Ciclos de CPU por Transacción",
    category: "Ingeniería de Software",
    dataString: "2100, 2150, 2180, 2220, 2250, 2290, 2310, 2350, 2400, 2420, 2480, 2510, 2550, 2600, 2680, 2750",
    desc: "Verificación de estabilidad de algoritmos concurrentes bajo carga sostenida.",
  },
];

function parseInputNumbers(raw: string): number[] {
  const matches = raw.match(/-?\d+(?:\.\d+)?/g);
  if (!matches) return [];
  return matches.map(Number).filter((n) => !isNaN(n));
}

// -----------------------------------------------------------------------------
// MOTOR MATEMÁTICO
// -----------------------------------------------------------------------------
function computeFrequencyDistribution(
  data: number[],
  method: GroupingMethod,
  manualK: number
): GroupedAnalysis | null {
  const n = data.length;
  if (n < 4) return null;

  const sorted = [...data].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[n - 1];
  const range = Number((max - min).toFixed(3));

  let k = 5;
  if (method === "sturges") {
    k = Math.max(4, Math.ceil(1 + 3.322 * Math.log10(n)));
  } else if (method === "sqrt") {
    k = Math.max(4, Math.ceil(Math.sqrt(n)));
  } else {
    k = Math.max(3, Math.min(15, manualK));
  }

  const classWidth = range === 0 ? 1 : Number(((range / k) * 1.002).toFixed(3));

  const rows: FrequencyRow[] = [];
  let currentLower = min;
  let runningCumAsc = 0;

  for (let i = 0; i < k; i++) {
    const currentUpper = Number((currentLower + classWidth).toFixed(3));
    const count = sorted.filter((v) =>
      i === k - 1
        ? v >= currentLower && v <= currentUpper
        : v >= currentLower && v < currentUpper
    ).length;

    runningCumAsc += count;
    const classMark = Number(((currentLower + currentUpper) / 2).toFixed(3));
    const relFreq = Number((count / n).toFixed(4));
    const pctFreq = Number((relFreq * 100).toFixed(2));

    rows.push({
      index: i + 1,
      lower: Number(currentLower.toFixed(3)),
      upper: currentUpper,
      classMark,
      absFreq: count,
      relFreq,
      pctFreq,
      cumAbsAsc: runningCumAsc,
      cumPctAsc: Number(((runningCumAsc / n) * 100).toFixed(2)),
      cumAbsDesc: 0,
      fx: Number((count * classMark).toFixed(3)),
    });

    currentLower = currentUpper;
  }

  let runningCumDesc = n;
  for (let i = 0; i < k; i++) {
    rows[i].cumAbsDesc = runningCumDesc;
    runningCumDesc -= rows[i].absFreq;
  }

  const totalFX = rows.reduce((acc, r) => acc + r.fx, 0);
  const groupedMean = Number((totalFX / n).toFixed(3));

  const halfN = n / 2;
  let medianClassIndex = rows.findIndex((r) => r.cumAbsAsc >= halfN);
  if (medianClassIndex === -1) medianClassIndex = rows.length - 1;

  const medRow = rows[medianClassIndex];
  const prevCum = medianClassIndex > 0 ? rows[medianClassIndex - 1].cumAbsAsc : 0;
  let groupedMedian = medRow.lower;
  if (medRow.absFreq > 0) {
    groupedMedian = medRow.lower + ((halfN - prevCum) / medRow.absFreq) * classWidth;
  }
  groupedMedian = Number(groupedMedian.toFixed(3));

  let modalClassIndex = 0;
  let maxFreq = 0;
  rows.forEach((r, idx) => {
    if (r.absFreq > maxFreq) {
      maxFreq = r.absFreq;
      modalClassIndex = idx;
    }
  });

  const modalRow = rows[modalClassIndex];
  const prevF = modalClassIndex > 0 ? rows[modalClassIndex - 1].absFreq : 0;
  const nextF = modalClassIndex < rows.length - 1 ? rows[modalClassIndex + 1].absFreq : 0;
  const delta1 = modalRow.absFreq - prevF;
  const delta2 = modalRow.absFreq - nextF;
  let groupedMode = modalRow.lower;

  if (delta1 + delta2 > 0) {
    groupedMode = modalRow.lower + (delta1 / (delta1 + delta2)) * classWidth;
  }
  groupedMode = Number(groupedMode.toFixed(3));

  return {
    n,
    k,
    range,
    classWidth,
    min,
    max,
    rows,
    groupedMean,
    groupedMedian,
    groupedMode,
    medianClassIndex: medianClassIndex + 1,
    modalClassIndex: modalClassIndex + 1,
  };
}

// -----------------------------------------------------------------------------
// COMPONENTE DE VISTA
// -----------------------------------------------------------------------------
export default function FrequencyView({
  viewMode,
  initialExpression = "",
}: {
  viewMode: "calc" | "steps" | "theory";
  initialExpression?: string;
}) {
  const [dataInput, setDataInput] = useState<string>(
    initialExpression || "112, 115, 118, 122, 125, 128, 130, 132, 135, 138, 140, 142, 145, 148, 150, 152, 155, 160, 165, 170, 175, 185, 195, 210"
  );
  const [method, setMethod] = useState<GroupingMethod>("sturges");
  const [manualK, setManualK] = useState<number>(6);
  const [activeTab, setActiveTab] = useState<"table" | "histogram" | "ogive">("table");
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isGroupedMetricsOpen, setIsGroupedMetricsOpen] = useState(false);

  const { setAIContext, injectedExpression, clearInjectedExpression } = useAIContext();

  const parsedNumbers = useMemo(() => parseInputNumbers(dataInput), [dataInput]);
  const analysis = useMemo(
    () => computeFrequencyDistribution(parsedNumbers, method, manualK),
    [parsedNumbers, method, manualK]
  );

  useEffect(() => {
    if (!analysis) return;
    const summary = `Distribución de Frecuencias | n=${analysis.n} | Clases k=${analysis.k} | Amplitud c=${analysis.classWidth} | Media Agrupada=${analysis.groupedMean} | Mediana=${analysis.groupedMedian} | Moda Czuber=${analysis.groupedMode} | Clase Modal=Clase ${analysis.modalClassIndex}`;

    setAIContext({
      module: "Matemáticas V",
      subtopic: "Distribuciones de Frecuencia",
      expression: `Rango: [${analysis.min}, ${analysis.max}] (k = ${analysis.k})`,
      result: `x̄ = ${analysis.groupedMean}, Me = ${analysis.groupedMedian}`,
      details: summary,
    });
  }, [analysis, setAIContext]);

  useEffect(() => {
    if (injectedExpression) {
      setDataInput(injectedExpression);
      clearInjectedExpression();
    }
  }, [injectedExpression, clearInjectedExpression]);

  useEffect(() => {
    fetchUserHistory("mat5", "frecuencias").then((data) => setHistory(data));
  }, []);

  const saveCalculation = async () => {
    if (!analysis) return;
    const title = `Frecuencias (n = ${analysis.n}, k = ${analysis.k} clases)`;
    const resSummary = `x̄ = ${analysis.groupedMean} | Me = ${analysis.groupedMedian} | c = ${analysis.classWidth}`;
    await saveUserCalculation("mat5", "frecuencias", title, resSummary);
    const refreshed = await fetchUserHistory("mat5", "frecuencias");
    setHistory(refreshed);
  };

  const clearHistory = async () => {
    await deleteUserHistory("frecuencias");
    setHistory([]);
  };

  const handleCopy = () => {
    if (!analysis) return;
    navigator.clipboard.writeText(
      `Media Agrupada: ${analysis.groupedMean}, Mediana: ${analysis.groupedMedian}, Moda Czuber: ${analysis.groupedMode}, Amplitud: ${analysis.classWidth}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const analyticalSteps = useMemo(() => {
    if (!analysis) return [];
    const steps: { stage: string; desc: string; math: string; rule: string }[] = [];
    let id = 1;

    steps.push({
      stage: `${id++}. Determinación del Rango o Recorrido`,
      desc: "Diferencia entre la observación máxima y mínima de la muestra ordenada.",
      math: `R = x_{\\max} - x_{\\min} = ${analysis.max} - ${analysis.min} = ${analysis.range}`,
      rule: "Amplitud Total",
    });

    const methodDesc =
      method === "sturges"
        ? `Regla de Sturges: k = 1 + 3.322 \\log_{10}(${analysis.n})`
        : method === "sqrt"
        ? `Regla de la Raíz: k = \\lceil \\sqrt{${analysis.n}} \\rceil`
        : `Definición Manual de Intervalos: k = ${analysis.k}`;

    steps.push({
      stage: `${id++}. Número de Intervalos de Clase (k)`,
      desc: "Cálculo del número óptimo de estratos para evitar sobre-agrupamiento o pérdida de densidad.",
      math: `${methodDesc} \\implies k = ${analysis.k}`,
      rule: method.toUpperCase(),
    });

    steps.push({
      stage: `${id++}. Amplitud o Ancho de Intervalo (c)`,
      desc: "Cociente entre el rango y el número de clases, ajustado con holgura para incluir el valor extremo.",
      math: `c = \\frac{R}{k} = \\frac{${analysis.range}}{${analysis.k}} \\approx ${analysis.classWidth}`,
      rule: "Ancho de Banda Uniforme",
    });

    const sumFX = analysis.rows.reduce((acc, r) => acc + r.fx, 0);
    steps.push({
      stage: `${id++}. Media Aritmética para Datos Agrupados`,
      desc: "Suma de los productos de cada marca de clase xᵢ por su frecuencia absoluta fᵢ dividida entre n.",
      math: `\\bar{x} = \\frac{\\sum_{i=1}^k f_i x_i}{n} = \\frac{${sumFX}}{${analysis.n}} = ${analysis.groupedMean}`,
      rule: "Centroide Ponderado",
    });

    const medRow = analysis.rows[analysis.medianClassIndex - 1];
    const prevCum = analysis.medianClassIndex > 1 ? analysis.rows[analysis.medianClassIndex - 2].cumAbsAsc : 0;
    steps.push({
      stage: `${id++}. Mediana Agrupada por Interpolación Lineal`,
      desc: `Ubicada en la Clase ${analysis.medianClassIndex} [${medRow.lower}, ${medRow.upper}) que contiene la posición n/2 = ${analysis.n / 2}.`,
      math: `Me = L_i + \\left( \\frac{\\frac{n}{2} - F_{i-1}}{f_i} \\right) \\cdot c = ${medRow.lower} + \\left( \\frac{${analysis.n / 2} - ${prevCum}}{${medRow.absFreq}} \\right) \\cdot ${analysis.classWidth} = ${analysis.groupedMedian}`,
      rule: "Interpolación de Ojiva",
    });

    const modalRow = analysis.rows[analysis.modalClassIndex - 1];
    const prevF = analysis.modalClassIndex > 1 ? analysis.rows[analysis.modalClassIndex - 2].absFreq : 0;
    const nextF = analysis.modalClassIndex < analysis.rows.length ? analysis.rows[analysis.modalClassIndex].absFreq : 0;
    const d1 = modalRow.absFreq - prevF;
    const d2 = modalRow.absFreq - nextF;
    steps.push({
      stage: `${id++}. Moda Agrupada (Fórmula de Czuber)`,
      desc: `Evaluada en la clase de mayor frecuencia absoluta (Clase ${analysis.modalClassIndex} con f = ${modalRow.absFreq}).`,
      math: `Mo = L_i + \\left( \\frac{\\Delta_1}{\\Delta_1 + \\Delta_2} \\right) \\cdot c = ${modalRow.lower} + \\left( \\frac{${d1}}{${d1} + ${d2}} \\right) \\cdot ${analysis.classWidth} = ${analysis.groupedMode}`,
      rule: "Fórmula Diferencial de Czuber",
    });

    return steps;
  }, [analysis, method]);

  return (
    <div className="h-full flex flex-col gap-6 min-h-0 relative select-none">
      {viewMode === "calc" && (
        <div className="relative flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto custom-scrollbar pr-1">
          {/* SECCIÓN SUPERIOR */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 shrink-0">
            <div className="xl:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 space-y-5">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/60 pb-3">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-2">
                    <TableIcon size={14} className="text-zinc-500" />
                    Consola de Distribución y Frecuencias
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsHelpOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-800 text-[11px] font-mono text-zinc-300 transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <Sparkles size={13} className="text-amber-400" />
                      <span>Casos Modelo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDataInput("")}
                      className="p-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-zinc-400 hover:text-rose-400 transition-colors"
                      title="Limpiar datos"
                    >
                      <RotateCcw size={13} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                    <span>Muestra u observaciones continuas:</span>
                    <span className="text-[11px] text-emerald-400 font-bold">
                      {analysis ? `${analysis.n} observaciones procesadas` : "Esperando datos..."}
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={dataInput}
                    onChange={(e) => setDataInput(e.target.value)}
                    placeholder="Ingresa tus datos continuos separados por comas, espacios o saltos de línea..."
                    className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/60 transition-all shadow-inner custom-scrollbar"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/70 text-xs font-mono items-center">
                  <div className="md:col-span-6 flex items-center gap-2">
                    <span className="text-zinc-500 text-[10px] uppercase">Regla:</span>
                    <div className="flex bg-zinc-900 p-0.5 rounded-xl border border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setMethod("sturges")}
                        className={`px-3 py-1 rounded-lg transition-all ${
                          method === "sturges"
                            ? "bg-zinc-100 text-zinc-950 font-bold shadow-md"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        Sturges
                      </button>
                      <button
                        type="button"
                        onClick={() => setMethod("sqrt")}
                        className={`px-3 py-1 rounded-lg transition-all ${
                          method === "sqrt"
                            ? "bg-zinc-100 text-zinc-950 font-bold shadow-md"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        √n
                      </button>
                      <button
                        type="button"
                        onClick={() => setMethod("manual")}
                        className={`px-3 py-1 rounded-lg transition-all ${
                          method === "manual"
                            ? "bg-amber-400 text-zinc-950 font-bold shadow-md"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        Manual k
                      </button>
                    </div>
                  </div>

                  {method === "manual" && (
                    <div className="md:col-span-6 flex items-center gap-3">
                      <span className="text-zinc-400 text-[11px] whitespace-nowrap">Clases (k={manualK}):</span>
                      <input
                        type="range"
                        min="3"
                        max="15"
                        step="1"
                        value={manualK}
                        onChange={(e) => setManualK(parseInt(e.target.value))}
                        className="w-full accent-amber-400"
                      />
                    </div>
                  )}

                  {method !== "manual" && (
                    <div className="md:col-span-6 flex justify-end text-[11px] text-zinc-400 gap-2">
                      <span>k = <strong className="text-emerald-400">{analysis?.k ?? "—"}</strong> intervalos</span>
                      <span>·</span>
                      <span>Amplitud c = <strong className="text-sky-400">{analysis?.classWidth ?? "—"}</strong></span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-500">
                  Persistencia ReSolve · Motor de Tabulación Continua
                </span>
                <button
                  type="button"
                  onClick={saveCalculation}
                  disabled={!analysis}
                  className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-semibold text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-40"
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
                    Media Agrupada (x̄)
                  </span>
                  {analysis && (
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
                    Centroide Ponderado por Frecuencia
                  </span>
                  <div className="text-5xl font-serif font-bold text-emerald-400 tracking-tight">
                    {analysis ? analysis.groupedMean : "—"}
                  </div>
                  <span className="text-[11px] font-mono text-zinc-400 mt-2 block">
                    {analysis
                      ? `Mediana = ${analysis.groupedMedian} | Moda Czuber = ${analysis.groupedMode}`
                      : "Inserta observaciones para tabular"}
                  </span>
                </div>

                {analysis && (
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                      <span className="text-[10px] text-zinc-500 block">Número de Clases (k)</span>
                      <strong className="text-sm text-emerald-400">{analysis.k} Intervalos</strong>
                      <span className="text-[9px] text-zinc-500 block mt-0.5">
                        {method === "sturges" ? "Fórmula de Sturges" : method === "sqrt" ? "Raíz de n" : "Ajuste Personalizado"}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                      <span className="text-[10px] text-zinc-500 block">Ancho de Intervalo (c)</span>
                      <strong className="text-sm text-sky-400">{analysis.classWidth}</strong>
                      <span className="text-[9px] text-zinc-500 block mt-0.5">Amplitud uniforme</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                      <span className="text-[10px] text-zinc-500 block">Clase Mediana</span>
                      <strong className="text-sm text-amber-400">Clase #{analysis.medianClassIndex}</strong>
                      <span className="text-[9px] text-zinc-500 block mt-0.5">Contiene n/2 ({analysis.n / 2})</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                      <span className="text-[10px] text-zinc-500 block">Clase Modal</span>
                      <strong className="text-sm text-purple-400">Clase #{analysis.modalClassIndex}</strong>
                      <span className="text-[9px] text-zinc-500 block mt-0.5">Máxima densidad</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative z-10 border-t border-zinc-800/60 pt-3 mt-3">
                <button
                  type="button"
                  onClick={() => setIsGroupedMetricsOpen(true)}
                  disabled={!analysis}
                  className="w-full p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/70 hover:border-zinc-700 flex items-center justify-between text-[11px] font-mono transition-colors group disabled:opacity-40"
                >
                  <div className="flex items-center gap-1.5 text-zinc-400 group-hover:text-zinc-200">
                    <Activity size={13} className="text-amber-400" />
                    <span>Deducción de Fórmulas Agrupadas</span>
                  </div>
                  <ChevronRight size={13} className="text-zinc-600 group-hover:text-zinc-300" />
                </button>
              </div>
            </div>
          </div>

          {/* SECCIÓN INFERIOR */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-1 min-h-0">
            <div
              className={`${
                isExpanded
                  ? "absolute inset-2 z-30 bg-zinc-950/95 backdrop-blur-2xl border border-zinc-700/80 rounded-3xl p-6 shadow-2xl flex flex-col overflow-hidden"
                  : "xl:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20 space-y-4"
              }`}
            >
              <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("table")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 ${
                      activeTab === "table"
                        ? "bg-zinc-100 text-zinc-950 font-bold shadow-md"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <TableIcon size={13} /> Tabla de Frecuencias Completa
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("histogram")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 ${
                      activeTab === "histogram"
                        ? "bg-zinc-100 text-zinc-950 font-bold shadow-md"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <BarChart2 size={13} /> Histograma + Polígono
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("ogive")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 ${
                      activeTab === "ogive"
                        ? "bg-zinc-100 text-zinc-950 font-bold shadow-md"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <TrendingUp size={13} /> Curva Ojiva (Frec. Acumulada)
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

              <div className="flex-1 min-h-0 pt-2 flex flex-col">
                {activeTab === "table" && analysis && (
                  <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar border border-zinc-800/60 rounded-2xl">
                    <table className="w-full min-w-full text-left font-mono text-xs divide-y divide-zinc-800">
                      <thead className="bg-zinc-900/80 text-zinc-400 sticky top-0 z-10">
                        <tr>
                          <th className="p-3">Clase</th>
                          <th className="p-3">Intervalo [L_i, U_i)</th>
                          <th className="p-3">Marca (x_i)</th>
                          <th className="p-3">f_i (Abs)</th>
                          <th className="p-3">h_i (Rel)</th>
                          <th className="p-3">h_i %</th>
                          <th className="p-3">F_i (Asc)</th>
                          <th className="p-3">H_i %</th>
                          <th className="p-3">F_i* (Desc)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                        {analysis.rows.map((r) => (
                          <tr
                            key={r.index}
                            className={`hover:bg-zinc-900/30 ${
                              r.index === analysis.modalClassIndex ? "bg-purple-500/5 font-semibold" : ""
                            }`}
                          >
                            <td className="p-3 text-zinc-500">#{r.index}</td>
                            <td className="p-3 font-bold text-sky-400">[{r.lower}, {r.upper})</td>
                            <td className="p-3 text-zinc-200">{r.classMark}</td>
                            <td className="p-3 text-emerald-400 font-bold">{r.absFreq}</td>
                            <td className="p-3 text-zinc-400">{r.relFreq}</td>
                            <td className="p-3 text-amber-400">{r.pctFreq}%</td>
                            <td className="p-3 text-sky-300 font-semibold">{r.cumAbsAsc}</td>
                            <td className="p-3 text-zinc-400">{r.cumPctAsc}%</td>
                            <td className="p-3 text-rose-300">{r.cumAbsDesc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === "histogram" && analysis && (
                  <div className="w-full flex flex-col flex-1 min-h-0 p-5 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 overflow-hidden">
                    <div className="relative flex-1 min-h-0">
                      <div className="absolute top-0 right-2 z-20 rounded-md bg-zinc-950/90 px-2 py-1 text-[10px] font-mono text-zinc-500 border border-zinc-800/60">
                        Frecuencia Máxima f = {Math.max(...analysis.rows.map((r) => r.absFreq), 1)}
                      </div>

                      <div className="absolute inset-x-0 top-8 bottom-8 border-b border-zinc-800">
                        <div className="h-full flex items-end gap-3">
                          {analysis.rows.map((r) => {
                            const maxF = Math.max(...analysis.rows.map((row) => row.absFreq), 1);
                            const heightPct = Math.max(4, (r.absFreq / maxF) * 100);
                            const isModal = r.index === analysis.modalClassIndex;
                            return (
                              <div key={r.index} className="relative flex-1 h-full min-w-0 group">
                                <div
                                  style={{ height: `${heightPct}%` }}
                                  className={`absolute inset-x-0 bottom-0 rounded-t-lg transition-all border-t ${
                                    isModal
                                      ? "bg-gradient-to-t from-purple-700/50 to-purple-400 border-purple-300"
                                      : "bg-gradient-to-t from-emerald-600/40 via-emerald-500/60 to-emerald-400 border-emerald-300"
                                  } group-hover:brightness-125 shadow-lg`}
                                />
                                <span
                                  className="absolute left-0 right-0 z-10 mx-auto w-fit px-1 rounded text-center text-[10px] font-mono font-bold text-emerald-300 bg-zinc-950/80 leading-none transition-transform group-hover:scale-110"
                                  style={{ bottom: `calc(${heightPct}% + 2px)` }}
                                >
                                  {r.absFreq}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 h-8 flex gap-3 items-start">
                        {analysis.rows.map((r) => (
                          <span
                            key={`lbl-${r.index}`}
                            className="flex-1 min-w-0 text-[9px] font-mono text-zinc-400 text-center leading-tight"
                            title={`Marca de clase x̄ = ${r.classMark}`}
                          >
                            <span className="block truncate">x̄={r.classMark}</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="shrink-0 pt-3 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                      <span>Base: Marcas de clase (xᵢ) de los {analysis.k} estratos</span>
                      <span className="text-purple-400 font-semibold">Clase #{analysis.modalClassIndex} destacada en morado</span>
                    </div>
                  </div>
                )}

                {activeTab === "ogive" && analysis && (
                  <div className="w-full flex flex-col flex-1 min-h-0 p-5 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 overflow-hidden">
                    <div className="relative flex-1 min-h-0">
                      <div className="absolute top-0 left-2 z-20 rounded-md bg-zinc-950/90 px-2 py-1 text-[10px] font-mono text-zinc-400 border border-zinc-800/60">
                        Ojiva Ascendente ("Menor que"): Acumulación hasta n = {analysis.n} (100%)
                      </div>

                      <div className="absolute inset-x-0 top-8 bottom-8 border-b border-zinc-800">
                        <div className="h-full flex items-end gap-3">
                          {analysis.rows.map((r) => {
                            const heightPct = Math.max(2, (r.cumAbsAsc / analysis.n) * 100);
                            return (
                              <div key={r.index} className="relative flex-1 h-full min-w-0 group">
                                <div
                                  style={{ height: `${heightPct}%` }}
                                  className="absolute inset-x-0 bottom-0 mx-auto w-2.5 bg-sky-400 rounded-t-full transition-all group-hover:scale-y-105 shadow-md shadow-sky-500/20"
                                />
                                <span
                                  className="absolute left-0 right-0 z-10 mx-auto w-fit px-1 rounded text-center text-[10px] font-mono font-bold text-sky-300 bg-zinc-950/80 leading-none"
                                  style={{ bottom: `calc(${heightPct}% + 2px)` }}
                                >
                                  {r.cumAbsAsc}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 h-8 flex gap-3 items-start">
                        {analysis.rows.map((r) => (
                          <span
                            key={`lbl-${r.index}`}
                            className="flex-1 min-w-0 text-[9px] font-mono text-zinc-400 text-center leading-tight"
                            title={`Acumulado hasta < ${r.upper}`}
                          >
                            <span className="block truncate">&lt; {r.upper}</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="shrink-0 pt-3 text-center text-[10px] font-mono text-zinc-500">
                      Visualización de frecuencias acumuladas absolutas (Fᵢ) en cada límite superior de clase
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="xl:col-span-4 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <History size={15} className="text-zinc-400" /> Historial de Tabulaciones
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
                    <p>Sin tabulaciones guardadas.</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Guarda frecuencias para auditar.</p>
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

      {viewMode === "steps" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-5 shrink-0">
            <div>
              <h3 className="text-xl font-serif font-bold text-zinc-100">
                Procedimiento Riguroso de Tabulación y Agrupamiento
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                Muestra n = {analysis?.n || 0} observaciones · Agrupamiento por {method.toUpperCase()} (k = {analysis?.k || 0})
              </p>
            </div>
            <div className="text-xs font-mono px-4 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-zinc-300 shadow-inner">
              Media Agrupada: <strong className="text-emerald-400 font-serif">{analysis?.groupedMean || "—"}</strong>
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

      {viewMode === "theory" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto shadow-xl shadow-black/20 custom-scrollbar">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800/80 bg-zinc-900/60 text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 mb-3">
              <BookOpen size={12} /> Fundamentos de Agrupamiento Estadístico
            </div>
            <h3 className="text-2xl font-serif font-bold text-zinc-100">
              Distribuciones de Frecuencia, Densidad y Compresión de Información
            </h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-3xl">
              Agrupar datos en intervalos de clase es la técnica clásica de reducción de dimensionalidad unidimensional. Permite modelar distribuciones continuas a partir de muestras discretas, base del entrenamiento de clasificadores probabilísticos como Naive Bayes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 space-y-2">
              <strong className="text-xs text-zinc-200 block font-mono uppercase tracking-wider">
                1. Regla de Sturges vs Regla de Freedman-Diaconis
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Sturges asume normalidad subyacente para definir k = 1 + 3.322 log₁₀(n). En muestras asimétricas o con colas pesadas, métodos basados en el IQR evitan distorsionar los picos multimodales.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 space-y-2">
              <strong className="text-xs text-zinc-200 block font-mono uppercase tracking-wider">
                2. Pérdida de Información y Corrección de Sheppard
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Reemplazar cada punto por su marca de clase xᵢ introduce un error de varianza sistemático (+c²/12). La corrección de Sheppard resta este factor al calcular momentos estadísticos de orden superior.
              </p>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {isGroupedMetricsOpen && analysis && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg border border-zinc-800 bg-zinc-950 rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <h4 className="text-sm font-serif font-bold text-zinc-100 flex items-center gap-2">
                  <Cpu size={15} className="text-amber-400" /> Fórmulas Interpoladas para Datos Agrupados
                </h4>
                <button onClick={() => setIsGroupedMetricsOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-100">
                  <X size={16} />
                </button>
              </div>

              <div className="text-xs text-zinc-300 mt-4 space-y-3 font-sans">
                <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-zinc-400">Mediana por Interpolación:</span>
                    <strong className="font-mono text-emerald-400">{analysis.groupedMedian}</strong>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Evalúa la posición n/2 ({analysis.n / 2}) acumulada en la ojiva de frecuencias.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-zinc-400">Moda de Czuber:</span>
                    <strong className="font-mono text-purple-400">{analysis.groupedMode}</strong>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Pondera el pico de la clase #{analysis.modalClassIndex} con respecto a sus clases adyacentes.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-[11px] font-mono text-zinc-400 space-y-1">
                  <p>• Clase Mediana: [{analysis.rows[analysis.medianClassIndex - 1]?.lower}, {analysis.rows[analysis.medianClassIndex - 1]?.upper})</p>
                  <p>• Clase Modal: [{analysis.rows[analysis.modalClassIndex - 1]?.lower}, {analysis.rows[analysis.modalClassIndex - 1]?.upper})</p>
                  <p>• Rango Total R: {analysis.range}</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                    <h3 className="text-base font-serif font-bold text-zinc-100">Guía de Distribuciones de Frecuencia</h3>
                    <p className="text-xs text-zinc-400">Reglas de tabulación, interpolación de ojivas y catálogo de problemas</p>
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
                    <Terminal size={13} className="text-zinc-400" /> Reglas de Estratificación
                  </h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Selecciona el método de agrupamiento más adecuado para organizar tus observaciones en intervalos de clase.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}