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
  Target
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

  // Proyección del estimador en tiempo real
  const predictedY = useMemo(() => {
    if (!analysis) return null;
    return Number((analysis.intercept + analysis.slope * predictX).toFixed(3));
  }, [analysis, predictX]);

  // Sincronización con ReSolve AI (Emisor)
  useEffect(() => {
    if (!analysis) return;
    const summary = `Regresión Lineal Simple | n = ${analysis.n} | Ecuación: y = ${analysis.slope}x + ${analysis.intercept} | r = ${analysis.pearsonR} | R² = ${analysis.rSquared} (${(analysis.rSquared * 100).toFixed(1)}%) | s_e = ${analysis.stdError}`;

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
      stage: `${id++}. Error Estándar de la Estimación (s_e)`,
      desc: "Desviación estándar de los residuos alrededor de la línea ajustada con n - 2 grados de libertad.",
      math: `s_e = \\sqrt{\\frac{SS_{res}}{n - 2}} = \\sqrt{\\frac{${analysis.ssRes}}{${analysis.n} - 2}} = ${analysis.stdError}`,
      rule: "Dispersión Residual",
    });

    return steps;
  }, [analysis]);

  return (
    // REGLA 1 & 2: Contenedor raíz con relative y cadena de alturas resuelta
    <div className="h-full flex flex-col gap-6 min-h-0 relative select-none">
      {viewMode === "calc" && (
        <div className="flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto custom-scrollbar pr-1">
          {/* SECCIÓN SUPERIOR: CONSOLA DE ENTRADA + HERO CARD */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 shrink-0">
            {/* Panel Izquierdo: Consola y Pares (x, y) */}
            <div className="xl:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 space-y-5 overflow-hidden">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/60 pb-3">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-2">
                    <ScatterChart size={14} className="text-zinc-500" />
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
                  className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-semibold text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-40"
                >
                  Guardar en Historial
                </button>
              </div>
            </div>

            {/* Panel Derecho: Hero Card con Ecuación OLS y R^2 */}
            <div className="xl:col-span-4 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden relative">
              <div className="pointer-events-none absolute -bottom-16 -right-16 w-52 h-52 bg-emerald-500/10 rounded-full blur-3xl" />

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold">
                    Recta de Ajuste OLS
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
                    Modelo de Mínimos Cuadrados
                  </span>
                  <div className="text-3xl lg:text-4xl font-serif font-bold text-emerald-400 tracking-tight">
                    {analysis ? `y = ${analysis.slope}x ${analysis.intercept >= 0 ? "+" : "-"} ${Math.abs(analysis.intercept)}` : "—"}
                  </div>
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
                      <span className="text-[9px] text-zinc-500 block mt-0.5">
                        {analysis.pearsonR > 0 ? "Asociación Positiva" : "Asociación Negativa"}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                      <span className="text-[10px] text-zinc-500 block">Error Estándar (s_e)</span>
                      <strong className="text-sm text-sky-400">{analysis.stdError}</strong>
                      <span className="text-[9px] text-zinc-500 block mt-0.5">Dispersión residual</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                      <span className="text-[10px] text-zinc-500 block">Pendiente (m)</span>
                      <strong className="text-sm text-zinc-200">{analysis.slope}</strong>
                      <span className="text-[9px] text-zinc-500 block mt-0.5">Tasa marginal Δy/Δx</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                      <span className="text-[10px] text-zinc-500 block">Intercepto (b)</span>
                      <strong className="text-sm text-amber-300">{analysis.intercept}</strong>
                      <span className="text-[9px] text-zinc-500 block mt-0.5">Corte Eje Y</span>
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
                    <span>Descomposición ANOVA (SS_tot, SS_reg, SS_res)</span>
                  </div>
                  <ChevronRight size={13} className="text-zinc-600 group-hover:text-zinc-300" />
                </button>
              </div>
            </div>
          </div>

          {/* SECCIÓN INFERIOR: VISUALIZADOR SVG ESTRICTO + TABLA DE RESIDUOS */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-1 min-h-0">
            {/* Visualizador de Dispersión y Ajuste (Reglas 1, 4 y 9) */}
            <div
              className={`${
                isExpanded
                  ? "absolute inset-0 z-30 bg-zinc-950/95 backdrop-blur-2xl border border-zinc-700/80 rounded-3xl p-6 shadow-2xl flex flex-col min-h-0 overflow-hidden"
                  : "xl:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20 space-y-4 overflow-hidden"
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
                  // REGLA 11: Coordenadas homogéneas dentro de viewBox 0 0 520 280
                  <div className="relative w-full flex-1 min-h-0 overflow-hidden flex flex-col justify-end">
                    <svg viewBox="0 0 520 280" className="w-full h-full" preserveAspectRatio="none">
                      {/* Grid de fondo */}
                      <line x1="40" y1="20" x2="40" y2="250" stroke="#27272a" strokeWidth="1" />
                      <line x1="40" y1="250" x2="500" y2="250" stroke="#27272a" strokeWidth="1" />

                      {/* Conversor lineal a coordenadas SVG */}
                      {(() => {
                        const toSvgX = (x: number) => 40 + ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * 460;
                        const toSvgY = (y: number) => 250 - ((y - bounds.minY) / (bounds.maxY - bounds.minY)) * 230;

                        const lineX1 = bounds.minX;
                        const lineY1 = analysis.intercept + analysis.slope * lineX1;
                        const lineX2 = bounds.maxX;
                        const lineY2 = analysis.intercept + analysis.slope * lineX2;

                        return (
                          <>
                            {/* Recta de Regresión OLS */}
                            <line
                              x1={toSvgX(lineX1)}
                              y1={toSvgY(lineY1)}
                              x2={toSvgX(lineX2)}
                              y2={toSvgY(lineY2)}
                              stroke="#10b981"
                              strokeWidth="2.5"
                            />

                            {/* Residuos verticales opcionales e_i */}
                            {showResiduals &&
                              analysis.points.map((p, i) => (
                                <line
                                  key={`res-${i}`}
                                  x1={toSvgX(p.x)}
                                  y1={toSvgY(p.y)}
                                  x2={toSvgX(p.x)}
                                  y2={toSvgY(p.yHat)}
                                  stroke="#f43f5e"
                                  strokeWidth="1.2"
                                  strokeDasharray="2 2"
                                />
                              ))}

                            {/* Puntos de dispersión (Scatter Points) */}
                            {analysis.points.map((p, i) => (
                              <g key={`pt-${i}`} className="group">
                                <circle
                                  cx={toSvgX(p.x)}
                                  cy={toSvgY(p.y)}
                                  r="5"
                                  fill="#38bdf8"
                                  stroke="#0f172a"
                                  strokeWidth="1.5"
                                  className="transition-all group-hover:scale-125"
                                />
                              </g>
                            ))}
                          </>
                        );
                      })()}
                    </svg>

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
                          <th className="p-2.5">x_i</th>
                          <th className="p-2.5">y_i (Real)</th>
                          <th className="p-2.5">ŷ_i (Modelo)</th>
                          <th className="p-2.5">e_i (Residuo)</th>
                          <th className="p-2.5">e_i²</th>
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
            <div className="xl:col-span-4 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20 overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <History size={15} className="text-zinc-400" /> Historial de Regresión
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
                    <p>Sin análisis guardados.</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Guarda modelos para auditar correlaciones.</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setPairsInput(item.expression)}
                      className="group p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700 hover:bg-zinc-900/80 cursor-pointer transition-all flex items-center justify-between text-xs"
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
          </div>
        </div>
      )}

      {/* MODO 2: PROCEDIMIENTO ANALÍTICO PASO A PASO */}
      {viewMode === "steps" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 shadow-xl shadow-black/20 overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-5 shrink-0">
            <div>
              <h3 className="text-xl font-serif font-bold text-zinc-100">
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

      {/* MODO 3: TEORÍA DE REGRESIÓN LINEAL */}
      {viewMode === "theory" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto shadow-xl shadow-black/20 custom-scrollbar">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800/80 bg-zinc-900/60 text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 mb-3">
              <BookOpen size={12} /> Modelado Estadístico y Aprendizaje Supervisado
            </div>
            <h3 className="text-2xl font-serif font-bold text-zinc-100">
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
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md border border-zinc-800 bg-zinc-950 rounded-3xl p-6 shadow-2xl"
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}