"use client";

import { useState, useMemo, useEffect, useRef } from "react";
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
  Activity,
  ChevronRight,
  Terminal,
  RotateCcw,
  Sliders,
  Table as TableIcon,
  Maximize2,
  Minimize2,
  TrendingUp,
  Percent,
  Layers,
  Cpu,
  ArrowRight,
  ScatterChart,
  Target,
  PanelRightClose,
} from "lucide-react";
import { useHistoryVisibility } from "@/lib/hooks/use-history-visibility";
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
// TIPOS Y MODELOS DE REGRESIÓN
// -----------------------------------------------------------------------------
export interface DataPoint {
  x: number;
  y: number;
}

export interface ResidualPoint extends DataPoint {
  yHat: number;
  residual: number; // e_i = y - yHat
  squaredResidual: number;
}

export interface RegressionAnalysis {
  n: number;
  slope: number; // beta_1 (m)
  intercept: number; // beta_0 (b)
  pearsonR: number; // r
  rSquared: number; // R^2
  stdError: number; // s_e
  sumX: number;
  sumY: number;
  sumXY: number;
  sumX2: number;
  sumY2: number;
  ssTot: number;
  ssReg: number;
  ssRes: number;
  points: ResidualPoint[];
  equationTeX: string;
}

interface ModuleExample {
  title: string;
  category: string;
  desc: string;
  rawPairs: string;
  xName: string;
  yName: string;
}

const MODULE_EXAMPLES: ModuleExample[] = [
  {
    title: "Horas de Estudio vs Calificación de Examen",
    category: "Educación y Métricas de Aprendizaje",
    desc: "Correlación lineal positiva fuerte entre tiempo dedicado a práctica y nota final sobre 100.",
    rawPairs: "2 55, 3 62, 5 70, 6 78, 7 82, 8 88, 10 94, 12 98",
    xName: "Horas (X)",
    yName: "Nota (Y)",
  },
  {
    title: "Gasto en Publicidad vs Ventas Semanales (k USD)",
    category: "Economía y Marketing Cuantitativo",
    desc: "Ajuste de presupuesto de marketing para predecir ingresos comerciales en empresas SaaS.",
    rawPairs: "1.2 14, 1.8 19, 2.4 24, 3.0 28, 3.5 31, 4.2 38, 5.0 44, 5.5 49",
    xName: "Gasto (k$)",
    yName: "Ventas (k$)",
  },
  {
    title: "Consumo de RAM vs Latencia en Microservicios (ms)",
    category: "Rendimiento de Software y SRE",
    desc: "Evaluación de cuellos de botella por presión de memoria en contenedores Docker.",
    rawPairs: "256 12, 512 16, 768 22, 1024 35, 1280 48, 1536 68, 2048 95",
    xName: "RAM (MB)",
    yName: "Latencia (ms)",
  },
  {
    title: "Temperatura del Reactor vs Rendimiento Químico (%)",
    category: "Termodinámica y Procesos",
    desc: "Cinética de reacción controlada bajo variación térmica uniforme.",
    rawPairs: "50 65, 55 68, 60 74, 65 80, 70 85, 75 91, 80 96",
    xName: "Temp (°C)",
    yName: "Rendimiento (%)",
  },
];

// Parser inteligente: extrae pares (x, y) de listas, comas, saltos de línea o texto
function parsePairsInput(raw: string): DataPoint[] {
  const matches = raw.match(/-?\d+(?:\.\d+)?/g);
  if (!matches || matches.length < 4) return [];

  const points: DataPoint[] = [];
  for (let i = 0; i < matches.length - 1; i += 2) {
    const x = parseFloat(matches[i]);
    const y = parseFloat(matches[i + 1]);
    if (!isNaN(x) && !isNaN(y)) {
      points.push({ x, y });
    }
  }
  return points;
}

// -----------------------------------------------------------------------------
// UTILIDADES DE GRAFICACIÓN: marcas de eje y medición responsiva del lienzo
// -----------------------------------------------------------------------------
/** Marcas "redondas" dentro de [min, max] para los ejes coordenados. */
function niceTicks(min: number, max: number, count = 5): number[] {
  if (!isFinite(min) || !isFinite(max) || max <= min) return [min, max];
  const rawStep = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const start = Math.ceil(min / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

/** Formatea el valor de una marca de eje sin ruido de coma flotante. */
function formatTick(v: number): string {
  if (!isFinite(v)) return "";
  if (v === 0) return "0";
  const abs = Math.abs(v);
  if (abs >= 100000 || abs < 0.001) return v.toExponential(1);
  return String(Number(v.toPrecision(4)));
}

/** Mide el contenedor de la gráfica para dibujar en coordenadas reales. */
function useChartSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: Math.round(el.clientWidth), h: Math.round(el.clientHeight) });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, size };
}

// -----------------------------------------------------------------------------
// MOTOR MATEMÁTICO: MÍNIMOS CUADRADOS ORDINARIOS (OLS)
// -----------------------------------------------------------------------------
function computeLinearRegression(points: DataPoint[]): RegressionAnalysis | null {
  const n = points.length;
  if (n < 2) return null;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  points.forEach((p) => {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
    sumY2 += p.y * p.y;
  });

  const meanX = sumX / n;
  const meanY = sumY / n;

  const sxx = sumX2 - (sumX * sumX) / n;
  const sxy = sumXY - (sumX * sumY) / n;
  const syy = sumY2 - (sumY * sumY) / n;

  if (Math.abs(sxx) < 1e-9) return null; // Recta vertical degenerada

  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;

  // Correlación de Pearson r y R^2
  let pearsonR = 0;
  if (sxx * syy > 1e-9) {
    pearsonR = sxy / Math.sqrt(sxx * syy);
  }
  const rSquared = Math.max(0, Math.min(1, pearsonR * pearsonR));

  // Residuos y Descomposición de Varianza
  let ssRes = 0;
  let ssTot = 0;
  const residualPoints: ResidualPoint[] = points.map((p) => {
    const yHat = intercept + slope * p.x;
    const residual = p.y - yHat;
    const squaredResidual = residual * residual;
    ssRes += squaredResidual;
    ssTot += Math.pow(p.y - meanY, 2);
    return {
      x: p.x,
      y: p.y,
      yHat: Number(yHat.toFixed(3)),
      residual: Number(residual.toFixed(3)),
      squaredResidual: Number(squaredResidual.toFixed(4)),
    };
  });

  const ssReg = Math.max(0, ssTot - ssRes);
  const stdError = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;

  const slopeRounded = Number(slope.toFixed(4));
  const interceptRounded = Number(intercept.toFixed(4));
  const sign = interceptRounded >= 0 ? "+" : "-";
  const absIntercept = Math.abs(interceptRounded);
  const equationTeX = `\\hat{y} = ${slopeRounded}x ${sign} ${absIntercept}`;

  return {
    n,
    slope: slopeRounded,
    intercept: interceptRounded,
    pearsonR: Number(pearsonR.toFixed(4)),
    rSquared: Number(rSquared.toFixed(4)),
    stdError: Number(stdError.toFixed(4)),
    sumX: Number(sumX.toFixed(3)),
    sumY: Number(sumY.toFixed(3)),
    sumXY: Number(sumXY.toFixed(3)),
    sumX2: Number(sumX2.toFixed(3)),
    sumY2: Number(sumY2.toFixed(3)),
    ssTot: Number(ssTot.toFixed(3)),
    ssReg: Number(ssReg.toFixed(3)),
    ssRes: Number(ssRes.toFixed(3)),
    points: residualPoints,
    equationTeX,
  };
}

export default function RegressionView({
  viewMode,
  initialExpression = "",
}: {
  viewMode: "calc" | "steps" | "theory";
  initialExpression?: string;
}) {
  const [pairsInput, setPairsInput] = useState<string>(
    initialExpression || "2 55, 3 62, 5 70, 6 78, 7 82, 8 88, 10 94, 12 98"
  );
  const [predictX, setPredictX] = useState<number>(9);
  const [showResiduals, setShowResiduals] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"scatter" | "table">("scatter");
  const { isHistoryHidden, setIsHistoryHidden } = useHistoryVisibility();

  // Estados de control UI y persistencia
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isAnovaModalOpen, setIsAnovaModalOpen] = useState<boolean>(false);

  const { setAIContext, injectedExpression, clearInjectedExpression } = useAIContext();

  const parsedPoints = useMemo(() => parsePairsInput(pairsInput), [pairsInput]);
  const analysis = useMemo(() => computeLinearRegression(parsedPoints), [parsedPoints]);

  // REGLA 10: Precalculamos extremos una sola vez fuera del render/mapeo
  const bounds = useMemo(() => {
    if (!analysis || analysis.points.length === 0) {
      return { minX: 0, maxX: 10, minY: 0, maxY: 10 };
    }
    const xVals = analysis.points.map((p) => p.x);
    const yVals = analysis.points.map((p) => p.y);
    const minXRaw = Math.min(...xVals);
    const maxXRaw = Math.max(...xVals);
    const minYRaw = Math.min(...yVals);
    const maxYRaw = Math.max(...yVals);

    const padX = (maxXRaw - minXRaw) * 0.1 || 1;
    const padY = (maxYRaw - minYRaw) * 0.1 || 1;

    return {
      minX: minXRaw - padX,
      maxX: maxXRaw + padX,
      minY: minYRaw - padY,
      maxY: maxYRaw + padY,
    };
  }, [analysis]);

  // Lienzo responsivo para el diagrama de dispersión
  const { ref: scatterRef, size: scatterSize } = useChartSize();

  // Proyección del estimador en tiempo real
  const predictedY = useMemo(() => {
    if (!analysis) return null;
    return Number((analysis.intercept + analysis.slope * predictX).toFixed(3));
  }, [analysis, predictX]);

  // Sincronización con ReSolve AI (Emisor)
  useEffect(() => {
    if (!analysis) return;
    const summary = `Regresión Lineal Simple | n = ${analysis.n} | Ecuación: y = ${analysis.slope}x + ${analysis.intercept} | r = ${analysis.pearsonR} | R² = ${analysis.rSquared} (${(analysis.rSquared * 100).toFixed(1)}%) | sₑ = ${analysis.stdError}`;

    setAIContext({
      module: "Matemáticas V",
      subtopic: "Regresión Lineal y Correlación",
      expression: `Modelo OLS: y = ${analysis.slope}x + ${analysis.intercept}`,
      result: `R² = ${analysis.rSquared}, r = ${analysis.pearsonR}`,
      details: summary,
    });
  }, [analysis, setAIContext]);

  // Receptor de IA
  useEffect(() => {
    if (injectedExpression) {
      try {
        const parsed = JSON.parse(injectedExpression);
        if (parsed.pairs) {
          setPairsInput(parsed.pairs);
        } else if (Array.isArray(parsed)) {
          const str = parsed.map((p: any) => `${p[0] || p.x} ${p[1] || p.y}`).join(", ");
          setPairsInput(str);
        }
      } catch {
        // En caso de que se inyecte texto directo
        if (injectedExpression.includes(",") || injectedExpression.includes(" ")) {
          setPairsInput(injectedExpression);
        }
      }
      clearInjectedExpression();
    }
  }, [injectedExpression, clearInjectedExpression]);

  // Carga de historial Supabase
  useEffect(() => {
    fetchUserHistory("mat5", "regresion_lineal").then((data) => setHistory(data));
  }, []);

  const saveCalculation = async () => {
    if (!analysis) return;
    const title = `Regresión OLS (n = ${analysis.n} pares)`;
    const resSummary = `y = ${analysis.slope}x + ${analysis.intercept} | R² = ${analysis.rSquared}`;
    await saveUserCalculation("mat5", "regresion_lineal", title, resSummary);
    const refreshed = await fetchUserHistory("mat5", "regresion_lineal");
    setHistory(refreshed);
  };

  const clearHistory = async () => {
    await deleteUserHistory("regresion_lineal");
    setHistory([]);
  };

  const handleCopy = () => {
    if (!analysis) return;
    navigator.clipboard.writeText(`y = ${analysis.slope}x + ${analysis.intercept} (R² = ${analysis.rSquared})`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Pasos analíticos KaTeX
  const analyticalSteps = useMemo(() => {
    if (!analysis) return [];
    const steps: { stage: string; desc: string; math: string; rule: string }[] = [];
    let id = 1;

    // 1. Resumen de Sumatorias
    steps.push({
      stage: `${id++}. Compilación de Sumatorias Básicas`,
      desc: `A partir de los n = ${analysis.n} pares muestrales, acumulamos los productos cruzados y sumas cuadráticas.`,
      math: `\\sum x_i = ${analysis.sumX}, \\quad \\sum y_i = ${analysis.sumY}, \\quad \\sum x_i y_i = ${analysis.sumXY} \\\\[6pt] \\sum x_i^2 = ${analysis.sumX2}, \\quad \\sum y_i^2 = ${analysis.sumY2}`,
      rule: "Tabla de Acumulación",
    });

    // 2. Pendiente e Intercepto (OLS)
    steps.push({
      stage: `${id++}. Pendiente de la Recta de Regresión (β₁)`,
      desc: "Cociente entre la covarianza muestral y la varianza de la variable independiente X.",
      math: `\\beta_1 = \\frac{n\\sum x_i y_i - \\sum x_i \\sum y_i}{n\\sum x_i^2 - (\\sum x_i)^2} = \\frac{${analysis.n}(${analysis.sumXY}) - (${analysis.sumX})(${analysis.sumY})}{${analysis.n}(${analysis.sumX2}) - (${analysis.sumX})^2} = ${analysis.slope}`,
      rule: "Mínimos Cuadrados Ordinarios",
    });

    steps.push({
      stage: `${id++}. Ordenada al Origen / Intercepto (β₀)`,
      desc: "Punto donde la recta corta al eje Y, forzando a la recta a pasar por el centroide de medias (x̄, ȳ).",
      math: `\\beta_0 = \\bar{y} - \\beta_1 \\bar{x} = \\frac{${analysis.sumY}}{${analysis.n}} - (${analysis.slope})\\left(\\frac{${analysis.sumX}}{${analysis.n}}\\right) = ${analysis.intercept}`,
      rule: "Condición de Centroide",
    });

    // 3. Correlación y Determinación
    steps.push({
      stage: `${id++}. Coeficiente de Correlación de Pearson y Ajuste R²`,
      desc: "Grado de asociación lineal y proporción de varianza total explicada por el modelo.",
      math: `r = ${analysis.pearsonR} \\implies R^2 = (${analysis.pearsonR})^2 = ${analysis.rSquared} \\quad (${(analysis.rSquared * 100).toFixed(2)}\\%)`,
      rule: "Bondad de Ajuste",
    });

    // 4. Error Estándar y Residuos
    steps.push({
      stage: `${id++}. Error Estándar de la Estimación (sₑ)`,
      desc: "Desviación estándar de los residuos alrededor de la línea ajustada con n - 2 grados de libertad.",
      math: `s_e = \\sqrt{\\frac{SS_{res}}{n - 2}} = \\sqrt{\\frac{${analysis.ssRes}}{${analysis.n} - 2}} = ${analysis.stdError}`,
      rule: "Dispersión Residual",
    });

    return steps;
  }, [analysis]);

  // Cierre del modal ANOVA con la tecla Escape (accesibilidad)
  useEffect(() => {
    if (!isAnovaModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsAnovaModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAnovaModalOpen]);

  return (
    // REGLA 1 & 2: Contenedor raíz con relative y cadena de alturas resuelta
    <div className="h-full flex flex-col gap-6 min-h-0 relative">
      {viewMode === "calc" && (
        <div className="flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto custom-scrollbar pr-1">
          {/* SECCIÓN SUPERIOR: CONSOLA DE ENTRADA + HERO CARD */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 shrink-0">
            {/* Panel Izquierdo: Consola y Pares (x, y) */}
            <div className="xl:col-span-8 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 space-y-5 overflow-hidden">
              <div className="pointer-events-none absolute -top-20 -left-20 w-56 h-56 bg-zinc-700/10 rounded-full blur-3xl" />
              <div className="relative z-10 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/60 pb-3">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-2">
                    <ScatterChart size={13} className="text-zinc-500" />
                    Consola de Pares Bivariados (X, Y)
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
                      onClick={() => setPairsInput("")}
                      className="p-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-zinc-400 hover:text-rose-400 transition-colors"
                      title="Limpiar datos"
                    >
                      <RotateCcw size={13} />
                    </button>
                  </div>
                </div>

                {/* Textarea de Pares */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                    <span>Ingresa pares x y (separados por espacios, comas o líneas):</span>
                    <span className="text-[11px] text-emerald-400 font-bold">
                      {analysis ? `${analysis.n} pares procesados` : "Esperando mínimo 2 pares..."}
                    </span>
                  </div>
                  <textarea
                    aria-label="Pares bivariados (x, y)"
                    rows={3}
                    value={pairsInput}
                    onChange={(e) => setPairsInput(e.target.value)}
                    placeholder="Ej: 2 55, 3 62, 5 70, 6 78, 7 82, 8 88, 10 94..."
                    className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/60 transition-all shadow-inner custom-scrollbar"
                  />
                </div>

                {/* Modulador de Predicción Interactiva (x -> ŷ) */}
                <div className="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/70 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <Target size={14} className="text-amber-400" />
                    <span className="text-zinc-300 font-semibold">Estimador Predictivo:</span>
                    <label className="flex items-center gap-1.5 ml-2">
                      <span className="text-zinc-500">Para X =</span>
                      <input
                        type="number"
                        step="0.5"
                        value={predictX}
                        onChange={(e) => setPredictX(parseFloat(e.target.value) || 0)}
                        className="w-20 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-center text-zinc-200 focus:outline-none focus:border-amber-400"
                      />
                    </label>
                  </div>

                  <div className="text-right">
                    <span className="text-zinc-500 text-[10px] block">Valor Estimado:</span>
                    <strong className="text-emerald-400 text-sm">
                      {predictedY !== null ? `ŷ = ${predictedY}` : "—"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Botón Guardar en Supabase */}
              <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-500">
                  Persistencia ReSolve · Regresión MCO
                </span>
                <button
                  type="button"
                  onClick={saveCalculation}
                  disabled={!analysis}
                  className="h-11 px-6 bg-zinc-100 text-zinc-950 rounded-xl text-xs font-semibold hover:bg-zinc-200 hover:scale-[1.02] shadow-lg shadow-zinc-100/5 transition-all active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
                >
                  Guardar en Historial
                </button>
              </div>
            </div>

            {/* Panel Derecho: Hero Card con Ecuación OLS y R^2 */}
            <div className="xl:col-span-4 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden">
              <div className="pointer-events-none absolute -bottom-20 -right-20 w-56 h-56 bg-zinc-700/10 rounded-full blur-3xl" />

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-2">
                    <TrendingUp size={13} className="text-zinc-500" />
                    Recta de Ajuste OLS
                  </span>
                  {analysis && (
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="text-[11px] font-mono text-zinc-400 hover:text-zinc-100 flex items-center gap-1.5 transition-colors py-1 px-2.5 rounded-lg border border-zinc-800/60 bg-zinc-950/60 hover:bg-zinc-800/60"
                    >
                      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      {copied ? "Copiado" : "Copiar"}
                    </button>
                  )}
                </div>

                <div className="py-2 text-center">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-1">
                    Modelo de Mínimos Cuadrados
                  </span>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={analysis ? `${analysis.slope}-${analysis.intercept}` : "empty"}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      transition={{ duration: 0.2 }}
                      className={`flex items-center justify-center gap-2 text-4xl lg:text-5xl font-serif font-bold tracking-tight transition-colors ${
                        analysis ? "text-zinc-100" : "text-zinc-600"
                      }`}
                    >
                      <TrendingUp size={26} className="text-zinc-500 shrink-0" />
                      <span>
                        {analysis ? `y = ${analysis.slope}x ${analysis.intercept >= 0 ? "+" : "-"} ${Math.abs(analysis.intercept)}` : "—"}
                      </span>
                    </motion.div>
                  </AnimatePresence>
                  <span className="text-[11px] font-mono text-zinc-400 mt-2 block">
                    {analysis
                      ? `R² = ${analysis.rSquared} (${(analysis.rSquared * 100).toFixed(1)}% de varianza explicada)`
                      : "Inserta pares numéricos"}
                  </span>
                </div>

                {/* Grid de Métricas de Correlación */}
                {analysis && (
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                      <span className="text-[10px] text-zinc-500 block">Pearson (r)</span>
                      <strong className={`text-sm ${Math.abs(analysis.pearsonR) > 0.7 ? "text-emerald-400" : "text-amber-400"}`}>
                        {analysis.pearsonR}
                      </strong>
                      <span className="text-[10px] text-zinc-500 block mt-0.5">
                        {analysis.pearsonR > 0 ? "Asociación Positiva" : "Asociación Negativa"}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                      <span className="text-[10px] text-zinc-500 block">Error Estándar (s<sub>e</sub>)</span>
                      <strong className="text-sm text-sky-400">{analysis.stdError}</strong>
                      <span className="text-[10px] text-zinc-500 block mt-0.5">Dispersión residual</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                      <span className="text-[10px] text-zinc-500 block">Pendiente (m)</span>
                      <strong className="text-sm text-zinc-200">{analysis.slope}</strong>
                      <span className="text-[10px] text-zinc-500 block mt-0.5">Tasa marginal Δy/Δx</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                      <span className="text-[10px] text-zinc-500 block">Intercepto (b)</span>
                      <strong className="text-sm text-amber-300">{analysis.intercept}</strong>
                      <span className="text-[10px] text-zinc-500 block mt-0.5">Corte Eje Y</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Botón de Descomposición ANOVA */}
              <div className="relative z-10 border-t border-zinc-800/60 pt-3 mt-3">
                <button
                  type="button"
                  onClick={() => setIsAnovaModalOpen(true)}
                  disabled={!analysis}
                  className="w-full p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/70 hover:border-zinc-700 flex items-center justify-between text-[11px] font-mono transition-colors group disabled:opacity-40"
                >
                  <div className="flex items-center gap-1.5 text-zinc-400 group-hover:text-zinc-200">
                    <Activity size={13} className="text-amber-400" />
                    <span>Descomposición ANOVA (SS<sub>tot</sub>, SS<sub>reg</sub>, SS<sub>res</sub>)</span>
                  </div>
                  <ChevronRight size={13} className="text-zinc-600 group-hover:text-zinc-300" />
                </button>
              </div>
            </div>
          </div>

          {/* SECCIÓN INFERIOR: VISUALIZADOR SVG ESTRICTO + TABLA DE RESIDUOS */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-1 min-h-[640px]">
            {/* Visualizador de Dispersión y Ajuste (Reglas 1, 4 y 9) */}
            <div
              className={`${
                isExpanded
                  ? "absolute inset-0 z-30 bg-zinc-950/95 backdrop-blur-2xl border border-zinc-700/80 rounded-3xl p-6 shadow-2xl flex flex-col min-h-0 overflow-hidden"
                  : `${isHistoryHidden ? "xl:col-span-12" : "xl:col-span-8"} border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20 space-y-4 overflow-hidden`
              }`}
            >
              <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("scatter")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 ${
                      activeTab === "scatter"
                        ? "bg-zinc-100 text-zinc-950 font-bold shadow-md"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <ScatterChart size={13} /> Diagrama de Dispersión
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
                    <TableIcon size={13} /> Tabla de Residuos ({analysis?.points.length || 0})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {activeTab === "scatter" && (
                    <button
                      type="button"
                      onClick={() => setShowResiduals(!showResiduals)}
                      className={`px-2.5 py-1 rounded-xl border text-[11px] font-mono transition-colors flex items-center gap-1 ${
                        showResiduals
                          ? "bg-rose-500/20 border-rose-500/50 text-rose-300"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400"
                      }`}
                    >
                      Residuos (eᵢ)
                    </button>
                  )}

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

              {/* Contenido Visual con REGLA 2 & 3: Cadena de alturas resuelta flex-1 min-h-0 */}
              <div className="flex-1 min-h-0 flex flex-col justify-end p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 overflow-hidden">
                {activeTab === "scatter" && analysis && (
                  <div className="w-full flex-1 min-h-0 flex flex-col">
                    <div ref={scatterRef} className="relative w-full flex-1 min-h-0">
                      {scatterSize.w > 0 &&
                        scatterSize.h > 0 &&
                        (() => {
                          const W = scatterSize.w;
                          const H = scatterSize.h;
                          const M = { top: 20, right: 18, bottom: 34, left: 48 };
                          const plotL = M.left;
                          const plotR = W - M.right;
                          const plotT = M.top;
                          const plotB = H - M.bottom;

                          const { minX, maxX, minY, maxY } = bounds;
                          const spanX = maxX - minX || 1;
                          const spanY = maxY - minY || 1;
                          const sx = (x: number) => plotL + ((x - minX) / spanX) * (plotR - plotL);
                          const sy = (y: number) => plotB - ((y - minY) / spanY) * (plotB - plotT);

                          const xTicks = niceTicks(minX, maxX, 6);
                          const yTicks = niceTicks(minY, maxY, 5);

                          const yLine1 = analysis.intercept + analysis.slope * minX;
                          const yLine2 = analysis.intercept + analysis.slope * maxX;

                          const cardW = 178;
                          const cardH = 66;
                          // Coloca la tarjeta en la esquina con menos datos observados
                          const midX = (minX + maxX) / 2;
                          const midY = (minY + maxY) / 2;
                          const cornerScore = { tl: 0, tr: 0, bl: 0, br: 0 };
                          analysis.points.forEach((p) => {
                            const right = p.x >= midX;
                            const topHalf = p.y >= midY;
                            if (topHalf) cornerScore[right ? "tr" : "tl"] += 1;
                            else cornerScore[right ? "br" : "bl"] += 1;
                          });
                          const bestCorner = (Object.keys(cornerScore) as (keyof typeof cornerScore)[]).sort(
                            (a, b) => cornerScore[a] - cornerScore[b]
                          )[0];
                          const cardX = bestCorner === "tr" || bestCorner === "br" ? plotR - cardW - 10 : plotL + 10;
                          const cardY = bestCorner === "tl" || bestCorner === "tr" ? plotT + 8 : plotB - cardH - 10;

                          return (
                            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block">
                              {/* Cuadrícula */}
                              {xTicks.map((t, i) => (
                                <line key={`gx-${i}`} x1={sx(t)} y1={plotT} x2={sx(t)} y2={plotB}
                                  stroke="currentColor" strokeOpacity={0.14} className="text-zinc-500" />
                              ))}
                              {yTicks.map((t, i) => (
                                <line key={`gy-${i}`} x1={plotL} y1={sy(t)} x2={plotR} y2={sy(t)}
                                  stroke="currentColor" strokeOpacity={0.14} className="text-zinc-500" />
                              ))}

                              {/* Ejes */}
                              <line x1={plotL} y1={plotT} x2={plotL} y2={plotB} stroke="currentColor" strokeOpacity={0.55} className="text-zinc-500" />
                              <line x1={plotL} y1={plotB} x2={plotR} y2={plotB} stroke="currentColor" strokeOpacity={0.55} className="text-zinc-500" />

                              {/* Marcas y rótulos del eje X */}
                              {xTicks.map((t, i) => (
                                <g key={`tx-${i}`}>
                                  <line x1={sx(t)} y1={plotB} x2={sx(t)} y2={plotB + 4} stroke="currentColor" strokeOpacity={0.55} className="text-zinc-500" />
                                  <text x={sx(t)} y={plotB + 16} textAnchor="middle" fontSize={10} fill="currentColor" className="text-zinc-500 font-mono">
                                    {formatTick(t)}
                                  </text>
                                </g>
                              ))}

                              {/* Marcas y rótulos del eje Y */}
                              {yTicks.map((t, i) => (
                                <g key={`ty-${i}`}>
                                  <line x1={plotL - 4} y1={sy(t)} x2={plotL} y2={sy(t)} stroke="currentColor" strokeOpacity={0.55} className="text-zinc-500" />
                                  <text x={plotL - 7} y={sy(t) + 3} textAnchor="end" fontSize={10} fill="currentColor" className="text-zinc-500 font-mono">
                                    {formatTick(t)}
                                  </text>
                                </g>
                              ))}

                              {/* Títulos de ejes */}
                              <text x={(plotL + plotR) / 2} y={H - 4} textAnchor="middle" fontSize={10} fill="currentColor" className="text-zinc-400 font-mono">
                                x
                              </text>
                              <text x={13} y={(plotT + plotB) / 2} textAnchor="middle" fontSize={10} fill="currentColor"
                                className="text-zinc-400 font-mono" transform={`rotate(-90 13 ${(plotT + plotB) / 2})`}>
                                y
                              </text>

                              {/* Residuos verticales e_i = y - ŷ */}
                              {showResiduals &&
                                analysis.points.map((p, i) => (
                                  <line key={`res-${i}`} x1={sx(p.x)} y1={sy(p.y)} x2={sx(p.x)} y2={sy(p.yHat)}
                                    stroke="#f43f5e" strokeWidth={1.2} strokeDasharray="3 3" strokeOpacity={0.85} />
                                ))}

                              {/* Recta de regresión OLS */}
                              <line x1={sx(minX)} y1={sy(yLine1)} x2={sx(maxX)} y2={sy(yLine2)}
                                stroke="#10b981" strokeWidth={2.5} strokeLinecap="round" />

                              {/* Puntos observados */}
                              {analysis.points.map((p, i) => (
                                <circle key={`pt-${i}`} cx={sx(p.x)} cy={sy(p.y)} r={4.5} fill="#0ea5e9" stroke="#ffffff" strokeWidth={1.2} />
                              ))}

                              {/* Tarjeta de ajuste */}
                              <g>
                                <rect x={cardX} y={cardY} width={cardW} height={cardH} rx={9}
                                  fill="rgba(9,9,11,0.85)" stroke="rgba(113,113,122,0.55)" />
                                <text x={cardX + 11} y={cardY + 21} fontSize={11.5} fill="#f4f4f5" className="font-mono">
                                  ŷ = {analysis.slope}x + {analysis.intercept}
                                </text>
                                <text x={cardX + 11} y={cardY + 39} fontSize={11.5} fill="#34d399" className="font-mono">
                                  R² = {analysis.rSquared}
                                </text>
                                <text x={cardX + 11} y={cardY + 55} fontSize={10} fill="#a1a1aa" className="font-mono">
                                  r = {analysis.pearsonR} · n = {analysis.n}
                                </text>
                              </g>
                            </svg>
                          );
                        })()}
                    </div>

                    <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-zinc-500 shrink-0 border-t border-zinc-900 mt-2">
                      <span className="text-emerald-400 font-semibold">Recta: ŷ = {analysis.slope}x + {analysis.intercept}</span>
                      <span className="text-rose-400">Líneas punteadas: Residuos eᵢ = y - ŷ</span>
                      <span className="text-sky-400">Puntos: Datos Observados</span>
                    </div>
                  </div>
                )}

                {activeTab === "table" && analysis && (
                  <div className="w-full flex-1 min-h-0 overflow-y-auto custom-scrollbar border border-zinc-800/60 rounded-xl">
                    <table className="w-full text-left font-mono text-xs divide-y divide-zinc-800">
                      <thead className="bg-zinc-900/80 text-zinc-400 sticky top-0">
                        <tr>
                          <th className="p-2.5">i</th>
                          <th className="p-2.5">x<sub>i</sub></th>
                          <th className="p-2.5">y<sub>i</sub> (Real)</th>
                          <th className="p-2.5">ŷ<sub>i</sub> (Modelo)</th>
                          <th className="p-2.5">e<sub>i</sub> (Residuo)</th>
                          <th className="p-2.5">e<sub>i</sub>²</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                        {analysis.points.map((p, i) => (
                          <tr key={i} className="hover:bg-zinc-900/30">
                            <td className="p-2.5 text-zinc-500">#{i + 1}</td>
                            <td className="p-2.5 text-zinc-200">{p.x}</td>
                            <td className="p-2.5 text-sky-400 font-bold">{p.y}</td>
                            <td className="p-2.5 text-emerald-400">{p.yHat}</td>
                            <td className={`p-2.5 font-bold ${p.residual >= 0 ? "text-amber-400" : "text-rose-400"}`}>
                              {p.residual}
                            </td>
                            <td className="p-2.5 text-zinc-400">{p.squaredResidual}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Panel Historial */}
            {isHistoryHidden ? null : (

            <div className="xl:col-span-4 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20 overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <History size={15} className="text-zinc-400" /> Historial de Regresión
                </span>
                <button
                  type="button"
                  onClick={() => setIsHistoryHidden(true)}
                  title="Ocultar historial"
                  aria-label="Ocultar historial"
                  className="ml-auto mr-1.5 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors"
                >
                  <PanelRightClose size={14} />
                </button>
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
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-6">
                    <span className="w-11 h-11 rounded-xl bg-zinc-900/50 border border-zinc-800/60 flex items-center justify-center">
                      <History size={18} className="text-zinc-600" />
                    </span>
                    <p className="text-sm text-zinc-300 font-medium">Sin análisis guardados</p>
                    <p className="text-[11px] text-zinc-500">Guarda modelos para auditar correlaciones</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setPairsInput(item.expression)}
                      title={`Recargar: ${item.expression}`}
                      className="group p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700 hover:bg-zinc-800/60 cursor-pointer transition-all flex items-center justify-between gap-3 text-xs focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500/40"
                    >
                      <div className="truncate pr-2 font-mono text-zinc-300 group-hover:text-zinc-100">
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

            )}
          </div>
        </div>
      )}

      {/* MODO 2: PROCEDIMIENTO ANALÍTICO PASO A PASO */}
      {viewMode === "steps" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 shadow-xl shadow-black/20 overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-5 shrink-0">
            <div>
              <h3 className="text-xl lg:text-2xl font-serif font-bold text-zinc-100">
                Procedimiento y Deducción por Mínimos Cuadrados
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                Ajuste lineal para n = {analysis?.n || 0} pares bivariados
              </p>
            </div>
            <div className="text-xs font-mono px-4 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-zinc-300">
              Modelo: <strong className="text-emerald-400">{analysis?.equationTeX || "—"}</strong>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pt-1 pr-2 custom-scrollbar">
            {analyticalSteps.map((st, i) => (
              <div key={i} className="relative pl-11 pb-5 last:pb-0">
                <span
                  className="absolute left-0 top-0 w-7 h-7 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300 flex items-center justify-center text-xs font-mono font-bold shadow-inner"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                {i < analyticalSteps.length - 1 && (
                  <span
                    className="absolute left-[13px] top-9 bottom-0 w-px bg-zinc-800/70"
                    aria-hidden="true"
                  />
                )}
                <div className="p-4 lg:p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700/80 transition-colors flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-zinc-100 font-mono">
                      {st.stage.replace(/^\d+\.\s*/, "")}
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 bg-zinc-900/60 px-2 py-0.5 rounded-md border border-zinc-800/60 shrink-0">
                      {st.rule}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 font-sans leading-relaxed">{st.desc}</p>
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 font-mono text-xs text-emerald-400 text-center font-bold overflow-x-auto whitespace-pre-line">
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {`\n$$\n${st.math}\n$$\n`}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODO 3: TEORÍA DE REGRESIÓN LINEAL */}
      {viewMode === "theory" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto shadow-xl shadow-black/20 custom-scrollbar">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800/80 bg-zinc-900/60 text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 mb-3">
              <BookOpen size={12} /> Modelado Estadístico y Aprendizaje Supervisado
            </div>
            <h3 className="text-2xl lg:text-3xl font-serif font-bold text-zinc-100">
              Regresión Lineal, Teorema de Gauss-Markov y Optimización
            </h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-3xl">
              La regresión lineal simple busca la mejor línea recta que minimice la suma de errores cuadráticos entre los valores observados y las predicciones teóricas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 space-y-2">
              <strong className="text-xs text-zinc-200 block font-mono uppercase tracking-wider">
                1. Teorema de Gauss-Markov (BLUE)
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Bajo los supuestos de media de errores nula, homoscedasticidad (varianza constante) y ausencia de autocorrelación, los estimadores OLS son los Mejores Estimadores Lineales Insesgados (Best Linear Unbiased Estimators).
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 space-y-2">
              <strong className="text-xs text-zinc-200 block font-mono uppercase tracking-wider">
                2. Correlación de Pearson vs Causalidad
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Un coeficiente r elevado demuestra correlación empírica pero no implica causalidad física. Factores ocultos o variables confusoras pueden inducir correlaciones espurias si no se controlan adecuadamente.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DESCOMPOSICIÓN ANOVA */}
      <AnimatePresence>
        {isAnovaModalOpen && analysis && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md select-none">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Descomposición de varianza ANOVA"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md border border-zinc-800/80 bg-zinc-950/95 backdrop-blur-2xl rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <h4 className="text-sm font-serif font-bold text-zinc-100 flex items-center gap-2">
                  <Layers size={15} className="text-emerald-400" />
                  Descomposición de Varianza (ANOVA)
                </h4>
                <button
                  type="button"
                  onClick={() => setIsAnovaModalOpen(false)}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="mt-4 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <span className="text-zinc-400">SS<sub>tot</sub> (Total)</span>
                  <strong className="text-zinc-100">{analysis.ssTot}</strong>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <span className="text-zinc-400">SS<sub>reg</sub> (Regresión)</span>
                  <strong className="text-emerald-400">{analysis.ssReg}</strong>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <span className="text-zinc-400">SS<sub>res</sub> (Residual)</span>
                  <strong className="text-amber-400">{analysis.ssRes}</strong>
                </div>
                <p className="text-[10px] text-zinc-500 pt-1 font-sans">
                  Se cumple SS<sub>tot</sub> = SS<sub>reg</sub> + SS<sub>res</sub>. La proporción explicada es R² = SS<sub>reg</sub> / SS<sub>tot</sub>.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}