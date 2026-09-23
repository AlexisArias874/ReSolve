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
  Maximize2,
  Minimize2,
  TrendingUp,
  Cpu,
  BarChart3,
  CheckCircle2,
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
// TIPOS Y MODELOS DE DISTRIBUCIONES
// -----------------------------------------------------------------------------
export type DistributionFamily = "normal" | "binomial" | "poisson" | "exponential" | "hypergeometric";
export type IntervalQueryType = "exact" | "less_equal" | "greater_equal" | "between";

interface ModuleExample {
  title: string;
  category: string;
  family: DistributionFamily;
  desc: string;
  config: {
    queryType: IntervalQueryType;
    valA: number;
    valB?: number;
    params: Record<string, number>;
  };
}

const MODULE_EXAMPLES: ModuleExample[] = [
  {
    title: "Distribución Normal: Puntuaciones en Pruebas Estandarizadas",
    category: "Psicometría y Poblaciones",
    family: "normal",
    desc: "Media μ = 100, Desviación σ = 15. Probabilidad de obtener entre 85 y 115 puntos.",
    config: { queryType: "between", valA: 85, valB: 115, params: { mean: 100, stdDev: 15 } },
  },
  {
    title: "Binomial: Inspección de Calidad de Componentes",
    category: "Control de Calidad",
    family: "binomial",
    desc: "Lote de n = 20 unidades con p = 0.05 de defecto. Probabilidad de a lo sumo 2 defectuosos.",
    config: { queryType: "less_equal", valA: 2, params: { n: 20, p: 0.05 } },
  },
  {
    title: "Proceso de Poisson: Peticiones a Servidor Web",
    category: "Ingeniería de Sistemas",
    family: "poisson",
    desc: "Llegan en promedio λ = 8 peticiones/segundo. Probabilidad de recibir más de 12 peticiones.",
    config: { queryType: "greater_equal", valA: 12, params: { lambda: 8 } },
  },
  {
    title: "Exponencial: Tiempo de Vida de Servidor (MTBF)",
    category: "Fiabilidad de Sistemas",
    family: "exponential",
    desc: "Tasa de fallos λ = 0.02 fallos/hora (50h vida media). Probabilidad de sobrevivir más de 40 horas.",
    config: { queryType: "greater_equal", valA: 40, params: { expLambda: 0.02 } },
  },
  {
    title: "Hipergeométrica: Muestreo de Lotería sin Reemplazo",
    category: "Muestreo Finito",
    family: "hypergeometric",
    desc: "Población N = 50, Éxitos K = 12, Muestra n = 6. Probabilidad de exactamente 2 éxitos.",
    config: { queryType: "exact", valA: 2, params: { hypPopN: 50, hypPopK: 12, hypSampleN: 6 } },
  },
];

// -----------------------------------------------------------------------------
// FUNCIONES MATEMÁTICAS PURAS
// -----------------------------------------------------------------------------
function factorial(num: number): number {
  if (num < 0) return 0;
  if (num === 0 || num === 1) return 1;
  let r = 1;
  for (let i = 2; i <= num; i++) r *= i;
  return r;
}

function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  return factorial(n) / (factorial(k) * factorial(n - k));
}

// Aproximación polinómica de alta precisión de Abramowitz & Stegun para CDF Normal Φ(z)
function normalCDF(z: number): number {
  const b1 = 0.31938153;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const p = 0.2316419;
  const c = 0.39894228; // 1 / sqrt(2*pi)

  if (z >= 0.0) {
    const t = 1.0 / (1.0 + p * z);
    return 1.0 - c * Math.exp((-z * z) / 2.0) * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
  } else {
    const t = 1.0 / (1.0 - p * z);
    return c * Math.exp((-z * z) / 2.0) * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
  }
}

export default function DistributionsView({
  viewMode,
  initialExpression = "",
}: {
  viewMode: "calc" | "steps" | "theory";
  initialExpression?: string;
}) {
  const [family, setFamily] = useState<DistributionFamily>("normal");
  const [queryType, setQueryType] = useState<IntervalQueryType>("between");

  // Parámetros Normal
  const [normMean, setNormMean] = useState<number>(100);
  const [normStdDev, setNormStdDev] = useState<number>(15);

  // Parámetros Binomial
  const [binomN, setBinomN] = useState<number>(20);
  const [binomP, setBinomP] = useState<number>(0.3);

  // Parámetros Poisson
  const [poissonLambda, setPoissonLambda] = useState<number>(5);

  // Parámetros Exponencial
  const [expLambda, setExpLambda] = useState<number>(0.2);

  // Parámetros Hipergeométrica
  const [hypPopN, setHypPopN] = useState<number>(50);
  const [hypPopK, setHypPopK] = useState<number>(12);
  const [hypSampleN, setHypSampleN] = useState<number>(6);

  // Puntos del intervalo evaluado
  const [valA, setValA] = useState<number>(85);
  const [valB, setValB] = useState<number>(115);

  // Modos de UI y Persistencia
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isPropsModalOpen, setIsPropsModalOpen] = useState<boolean>(false);

  const { setAIContext, injectedExpression, clearInjectedExpression } = useAIContext();

  // ---------------------------------------------------------------------------
  // MOTOR DE CÁLCULO ESTOCÁSTICO
  // ---------------------------------------------------------------------------
  const calculation = useMemo(() => {
    let prob = 0;
    let expected = 0;
    let variance = 0;
    let discreteBars: { k: number; probVal: number; inInterval: boolean }[] = [];
    let continuousPath = "";
    let continuousShadedPath = "";
    let formulaTeX = "";
    let zA: number | null = null;
    let zB: number | null = null;
    const isContinuous = family === "normal" || family === "exponential";

    // 1. NORMAL (GAUSSIANA)
    if (family === "normal") {
      const mu = normMean;
      const sigma = Math.max(0.001, normStdDev);
      expected = mu;
      variance = Number((sigma * sigma).toFixed(3));

      const cdf = (x: number) => normalCDF((x - mu) / sigma);

      if (queryType === "exact") {
        prob = 0;
      } else if (queryType === "less_equal") {
        prob = cdf(valA);
        zA = Number(((valA - mu) / sigma).toFixed(3));
      } else if (queryType === "greater_equal") {
        prob = 1 - cdf(valA);
        zA = Number(((valA - mu) / sigma).toFixed(3));
      } else {
        const minVal = Math.min(valA, valB);
        const maxVal = Math.max(valA, valB);
        prob = cdf(maxVal) - cdf(minVal);
        zA = Number(((minVal - mu) / sigma).toFixed(3));
        zB = Number(((maxVal - mu) / sigma).toFixed(3));
      }

      // Muestreo paramétrico para renderizar SVG continuo (viewBox 0..500 x 0..200)
      const xMin = mu - 3.5 * sigma;
      const xMax = mu + 3.5 * sigma;
      const yMax = 1 / (sigma * Math.sqrt(2 * Math.PI));
      const steps = 80;
      const stepX = (xMax - xMin) / steps;

      const pts: { svgX: number; svgY: number; origX: number }[] = [];
      for (let i = 0; i <= steps; i++) {
        const currX = xMin + i * stepX;
        const pdfVal = (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((currX - mu) / sigma, 2));
        const svgX = (i / steps) * 500;
        const svgY = 190 - (pdfVal / yMax) * 165; // Margen de 10 a 190 en Y
        pts.push({ svgX, svgY, origX: currX });
      }

      continuousPath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.svgX.toFixed(1)} ${p.svgY.toFixed(1)}`).join(" ");

      // Construcción del polígono sombreado
      const shadedPts = pts.filter((p) => {
        if (queryType === "less_equal") return p.origX <= valA;
        if (queryType === "greater_equal") return p.origX >= valA;
        if (queryType === "between") return p.origX >= Math.min(valA, valB) && p.origX <= Math.max(valA, valB);
        return false;
      });

      if (shadedPts.length > 1) {
        const first = shadedPts[0];
        const last = shadedPts[shadedPts.length - 1];
        continuousShadedPath = `M ${first.svgX.toFixed(1)} 190 L ${shadedPts
          .map((p) => `${p.svgX.toFixed(1)} ${p.svgY.toFixed(1)}`)
          .join(" L ")} L ${last.svgX.toFixed(1)} 190 Z`;
      }

      formulaTeX = `f(x) = \\frac{1}{${sigma}\\sqrt{2\\pi}} e^{-\\frac{1}{2}\\left(\\frac{x - ${mu}}{${sigma}}\\right)^2}`;
    }

    // 2. BINOMIAL
    else if (family === "binomial") {
      const n = Math.max(1, Math.floor(binomN));
      const p = Math.max(0, Math.min(1, binomP));
      expected = Number((n * p).toFixed(3));
      variance = Number((n * p * (1 - p)).toFixed(3));

      const pmf = (k: number) => combinations(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);

      if (queryType === "exact") {
        prob = pmf(Math.floor(valA));
      } else if (queryType === "less_equal") {
        for (let k = 0; k <= Math.floor(valA); k++) prob += pmf(k);
      } else if (queryType === "greater_equal") {
        for (let k = Math.ceil(valA); k <= n; k++) prob += pmf(k);
      } else {
        for (let k = Math.min(valA, valB); k <= Math.max(valA, valB); k++) prob += pmf(k);
      }

      for (let k = 0; k <= n; k++) {
        let inInterval = false;
        if (queryType === "exact") inInterval = k === valA;
        else if (queryType === "less_equal") inInterval = k <= valA;
        else if (queryType === "greater_equal") inInterval = k >= valA;
        else inInterval = k >= Math.min(valA, valB) && k <= Math.max(valA, valB);

        discreteBars.push({ k, probVal: pmf(k), inInterval });
      }

      formulaTeX = `P(X = k) = \\binom{${n}}{k} (${p})^k (1 - ${p})^{${n} - k}`;
    }

    // 3. POISSON
    else if (family === "poisson") {
      const l = Math.max(0.1, poissonLambda);
      expected = l;
      variance = l;

      const pmf = (k: number) => (Math.pow(l, k) * Math.exp(-l)) / factorial(k);

      if (queryType === "exact") {
        prob = pmf(Math.floor(valA));
      } else if (queryType === "less_equal") {
        for (let k = 0; k <= Math.floor(valA); k++) prob += pmf(k);
      } else if (queryType === "greater_equal") {
        let sumLower = 0;
        for (let k = 0; k < Math.ceil(valA); k++) sumLower += pmf(k);
        prob = 1 - sumLower;
      } else {
        for (let k = Math.min(valA, valB); k <= Math.max(valA, valB); k++) prob += pmf(k);
      }

      const maxK = Math.max(12, Math.min(30, Math.ceil(l + 3.2 * Math.sqrt(l))));
      for (let k = 0; k <= maxK; k++) {
        let inInterval = false;
        if (queryType === "exact") inInterval = k === valA;
        else if (queryType === "less_equal") inInterval = k <= valA;
        else if (queryType === "greater_equal") inInterval = k >= valA;
        else inInterval = k >= Math.min(valA, valB) && k <= Math.max(valA, valB);

        discreteBars.push({ k, probVal: pmf(k), inInterval });
      }

      formulaTeX = `P(X = k) = \\frac{${l}^k e^{-${l}}}{k!}`;
    }

    // 4. EXPONENCIAL
    else if (family === "exponential") {
      const l = Math.max(0.001, expLambda);
      expected = Number((1 / l).toFixed(3));
      variance = Number((1 / (l * l)).toFixed(3));

      const cdf = (x: number) => (x < 0 ? 0 : 1 - Math.exp(-l * x));

      if (queryType === "exact") prob = 0;
      else if (queryType === "less_equal") prob = cdf(valA);
      else if (queryType === "greater_equal") prob = 1 - cdf(valA);
      else prob = cdf(Math.max(valA, valB)) - cdf(Math.min(valA, valB));

      const xMax = expected * 3.5;
      const yMax = l;
      const steps = 80;
      const stepX = xMax / steps;

      const pts: { svgX: number; svgY: number; origX: number }[] = [];
      for (let i = 0; i <= steps; i++) {
        const currX = i * stepX;
        const pdfVal = l * Math.exp(-l * currX);
        const svgX = (i / steps) * 500;
        const svgY = 190 - (pdfVal / yMax) * 165;
        pts.push({ svgX, svgY, origX: currX });
      }

      continuousPath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.svgX.toFixed(1)} ${p.svgY.toFixed(1)}`).join(" ");

      const shadedPts = pts.filter((p) => {
        if (queryType === "less_equal") return p.origX <= valA;
        if (queryType === "greater_equal") return p.origX >= valA;
        if (queryType === "between") return p.origX >= Math.min(valA, valB) && p.origX <= Math.max(valA, valB);
        return false;
      });

      if (shadedPts.length > 1) {
        const first = shadedPts[0];
        const last = shadedPts[shadedPts.length - 1];
        continuousShadedPath = `M ${first.svgX.toFixed(1)} 190 L ${shadedPts
          .map((p) => `${p.svgX.toFixed(1)} ${p.svgY.toFixed(1)}`)
          .join(" L ")} L ${last.svgX.toFixed(1)} 190 Z`;
      }

      formulaTeX = `f(x) = ${l} e^{-${l}x} \\quad (x \\ge 0)`;
    }

    // 5. HIPERGEOMÉTRICA
    else {
      const N = Math.max(2, hypPopN);
      const K = Math.max(1, Math.min(N, hypPopK));
      const n = Math.max(1, Math.min(N, hypSampleN));

      expected = Number(((n * K) / N).toFixed(3));
      variance = Number((((n * K * (N - K) * (N - n)) / (N * N * (N - 1))) || 0).toFixed(3));

      const pmf = (k: number) => {
        if (k < Math.max(0, n - (N - K)) || k > Math.min(n, K)) return 0;
        return (combinations(K, k) * combinations(N - K, n - k)) / combinations(N, n);
      };

      if (queryType === "exact") prob = pmf(valA);
      else if (queryType === "less_equal") {
        for (let k = 0; k <= valA; k++) prob += pmf(k);
      } else if (queryType === "greater_equal") {
        for (let k = valA; k <= n; k++) prob += pmf(k);
      } else {
        for (let k = Math.min(valA, valB); k <= Math.max(valA, valB); k++) prob += pmf(k);
      }

      for (let k = 0; k <= n; k++) {
        let inInterval = false;
        if (queryType === "exact") inInterval = k === valA;
        else if (queryType === "less_equal") inInterval = k <= valA;
        else if (queryType === "greater_equal") inInterval = k >= valA;
        else inInterval = k >= Math.min(valA, valB) && k <= Math.max(valA, valB);

        discreteBars.push({ k, probVal: pmf(k), inInterval });
      }

      formulaTeX = `P(X = k) = \\frac{\\binom{${K}}{k} \\binom{${N - K}}{${n} - k}}{\\binom{${N}}{${n}}}`;
    }

    prob = Math.max(0, Math.min(1, Number(prob.toFixed(5))));

    return {
      prob,
      probPct: Number((prob * 100).toFixed(2)),
      expected,
      variance,
      stdDev: Number(Math.sqrt(variance).toFixed(3)),
      isContinuous,
      discreteBars,
      continuousPath,
      continuousShadedPath,
      formulaTeX,
      zA,
      zB,
    };
  }, [family, queryType, normMean, normStdDev, binomN, binomP, poissonLambda, expLambda, hypPopN, hypPopK, hypSampleN, valA, valB]);

  // REGLA 10: Cálculo del valor máximo una sola vez con useMemo
  const maxDiscreteY = useMemo(() => {
    if (calculation.discreteBars.length === 0) return 1;
    return Math.max(...calculation.discreteBars.map((b) => b.probVal), 0.0001);
  }, [calculation.discreteBars]);

  // Sincronización con ReSolve AI (Emisor)
  useEffect(() => {
    const summary = `Distribución: ${family.toUpperCase()} | P(Intervalo) = ${calculation.prob} (${calculation.probPct}%) | E[X] = ${calculation.expected} | Var = ${calculation.variance} | DesvEst = ${calculation.stdDev}`;
    setAIContext({
      module: "Matemáticas V",
      subtopic: `Distribución ${family.toUpperCase()}`,
      expression: `${family.toUpperCase()} con consulta ${queryType}`,
      result: `P = ${calculation.prob} (${calculation.probPct}%)`,
      details: summary,
    });
  }, [family, queryType, calculation, setAIContext]);

  // Receptor de IA
  useEffect(() => {
    if (injectedExpression) {
      try {
        const parsed = JSON.parse(injectedExpression);
        if (parsed.family) setFamily(parsed.family);
        if (parsed.valA !== undefined) setValA(parsed.valA);
        if (parsed.valB !== undefined) setValB(parsed.valB);
      } catch {
        // Silencioso
      }
      clearInjectedExpression();
    }
  }, [injectedExpression, clearInjectedExpression]);

  // Historial Supabase
  useEffect(() => {
    fetchUserHistory("mat5", "distribuciones").then((data) => setHistory(data));
  }, []);

  const saveCalculation = async () => {
    const title = `Dist. ${family.toUpperCase()} (${queryType})`;
    const resSummary = `P = ${calculation.prob} (${calculation.probPct}%) | E[X] = ${calculation.expected}`;
    await saveUserCalculation("mat5", "distribuciones", title, resSummary);
    const refreshed = await fetchUserHistory("mat5", "distribuciones");
    setHistory(refreshed);
  };

  const clearHistory = async () => {
    await deleteUserHistory("distribuciones");
    setHistory([]);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`P = ${calculation.prob} (${calculation.probPct}%)`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Pasos analíticos KaTeX
  const analyticalSteps = useMemo(() => {
    const steps: { stage: string; desc: string; math: string; rule: string }[] = [];
    let id = 1;

    steps.push({
      stage: `${id++}. Identificación del Modelo Paramétrico`,
      desc: `Familia seleccionada: ${family.toUpperCase()} con esperanza matemática E[X] = ${calculation.expected} y varianza Var(X) = ${calculation.variance}.`,
      math: calculation.formulaTeX,
      rule: "Definición Estocástica",
    });

    if (family === "normal") {
      steps.push({
        stage: `${id++}. Estandarización a la Normal Tipificada Z ~ N(0, 1)`,
        desc: "Transformación lineal de la variable continua desacoplando escala y traslación.",
        math:
          queryType === "between"
            ? `Z_A = \\frac{${Math.min(valA, valB)} - ${normMean}}{${normStdDev}} = ${calculation.zA}, \\quad Z_B = \\frac{${Math.max(valA, valB)} - ${normMean}}{${normStdDev}} = ${calculation.zB}`
            : `Z = \\frac{${valA} - ${normMean}}{${normStdDev}} = ${calculation.zA}`,
        rule: "Estandarización Z",
      });

      steps.push({
        stage: `${id++}. Integral de Densidad Acumulada`,
        desc: "Aproximación polinomial de la integral de Gauss bajo la curva normal.",
        math: `P(\\text{Región}) = \\int f(x) \\, dx \\approx ${calculation.prob} \\quad (${calculation.probPct}\\%)`,
        rule: "Aproximación de Abramowitz-Stegun",
      });
    } else {
      steps.push({
        stage: `${id++}. Evaluación Discreta de la Masa de Probabilidad`,
        desc: "Suma finita de los eventos elementales comprendidos en el intervalo consultado.",
        math: `P(\\text{Intervalo}) = \\sum_{k \\in \\mathcal{A}} P(X = k) = ${calculation.prob} \\quad (${calculation.probPct}\\%)`,
        rule: "Axioma de Kolmogorov",
      });
    }

    return steps;
  }, [family, calculation, normMean, normStdDev, valA, valB, queryType]);

  return (
    // REGLA 1 & 2: Ancestro directo con relative y cadena de alturas resuelta
    <div className="h-full flex flex-col gap-6 min-h-0 relative select-none">
      {viewMode === "calc" && (
        <div className="flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto custom-scrollbar pr-1">
          {/* BARRA DE SELECCIÓN DE FAMILIA DE DISTRIBUCIÓN */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-zinc-900/40 border border-zinc-800/60 rounded-2xl shrink-0 backdrop-blur-xl">
            <div className="flex flex-wrap items-center gap-1.5">
              {(["normal", "binomial", "poisson", "exponential", "hypergeometric"] as DistributionFamily[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFamily(f)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-mono transition-all capitalize flex items-center gap-1.5 ${
                    family === f
                      ? "bg-zinc-100 text-zinc-950 font-bold shadow-md"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {f === "normal" ? <TrendingUp size={13} /> : <BarChart3 size={13} />}
                  <span>{f}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsHelpOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-[11px] font-mono text-zinc-300 transition-colors flex items-center gap-1.5 shadow-sm ml-auto"
            >
              <Sparkles size={13} className="text-amber-400" />
              <span>Casos Universitarios</span>
            </button>
          </div>

          {/* SECCIÓN SUPERIOR: CONFIGURACIÓN + HERO CARD */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 shrink-0">
            {/* Panel Izquierdo: Consola de Parámetros */}
            <div className="xl:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 space-y-5 overflow-hidden">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/60 pb-3">
                  <span className="text-xs font-mono font-semibold text-zinc-300 flex items-center gap-2">
                    <Sliders size={14} className="text-emerald-400" />
                    Parámetros de la Distribución {family.toUpperCase()}
                  </span>
                  <div className="flex bg-zinc-900 p-0.5 rounded-xl border border-zinc-800 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => setQueryType("exact")}
                      disabled={calculation.isContinuous}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        queryType === "exact" ? "bg-zinc-100 text-zinc-950 font-bold" : "text-zinc-400 disabled:opacity-20"
                      }`}
                    >
                      P(X = a)
                    </button>
                    <button
                      type="button"
                      onClick={() => setQueryType("less_equal")}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        queryType === "less_equal" ? "bg-zinc-100 text-zinc-950 font-bold" : "text-zinc-400"
                      }`}
                    >
                      P(X ≤ a)
                    </button>
                    <button
                      type="button"
                      onClick={() => setQueryType("greater_equal")}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        queryType === "greater_equal" ? "bg-zinc-100 text-zinc-950 font-bold" : "text-zinc-400"
                      }`}
                    >
                      P(X ≥ a)
                    </button>
                    <button
                      type="button"
                      onClick={() => setQueryType("between")}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        queryType === "between" ? "bg-amber-400 text-zinc-950 font-bold" : "text-zinc-400"
                      }`}
                    >
                      P(a ≤ X ≤ b)
                    </button>
                  </div>
                </div>

                {/* Parámetros Específicos según Familia */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                  {family === "normal" && (
                    <>
                      <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800 space-y-1.5">
                        <div className="flex justify-between text-zinc-400">
                          <span>Media (μ):</span>
                          <strong className="text-emerald-400">{normMean}</strong>
                        </div>
                        <input
                          type="number"
                          step="5"
                          value={normMean}
                          onChange={(e) => setNormMean(parseFloat(e.target.value) || 0)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-zinc-200"
                        />
                      </div>
                      <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800 space-y-1.5">
                        <div className="flex justify-between text-zinc-400">
                          <span>Desviación Estándar (σ):</span>
                          <strong className="text-sky-400">{normStdDev}</strong>
                        </div>
                        <input
                          type="number"
                          step="1"
                          min="0.1"
                          value={normStdDev}
                          onChange={(e) => setNormStdDev(Math.max(0.1, parseFloat(e.target.value) || 1))}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-zinc-200"
                        />
                      </div>
                    </>
                  )}

                  {family === "binomial" && (
                    <>
                      <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800 space-y-1.5">
                        <div className="flex justify-between text-zinc-400">
                          <span>Ensayos (n):</span>
                          <strong className="text-emerald-400">{binomN}</strong>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="50"
                          value={binomN}
                          onChange={(e) => setBinomN(parseInt(e.target.value))}
                          className="w-full accent-emerald-400"
                        />
                      </div>
                      <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800 space-y-1.5">
                        <div className="flex justify-between text-zinc-400">
                          <span>Éxito (p):</span>
                          <strong className="text-sky-400">{binomP}</strong>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.02"
                          value={binomP}
                          onChange={(e) => setBinomP(parseFloat(e.target.value))}
                          className="w-full accent-sky-400"
                        />
                      </div>
                    </>
                  )}

                  {family === "poisson" && (
                    <div className="col-span-2 p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800 space-y-1.5">
                      <div className="flex justify-between text-zinc-400">
                        <span>Tasa Media (λ):</span>
                        <strong className="text-emerald-400">{poissonLambda}</strong>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="25"
                        step="0.5"
                        value={poissonLambda}
                        onChange={(e) => setPoissonLambda(parseFloat(e.target.value))}
                        className="w-full accent-emerald-400"
                      />
                    </div>
                  )}

                  {family === "exponential" && (
                    <div className="col-span-2 p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800 space-y-1.5">
                      <div className="flex justify-between text-zinc-400">
                        <span>Tasa de Eventos (λ):</span>
                        <strong className="text-emerald-400">{expLambda}</strong>
                      </div>
                      <input
                        type="range"
                        min="0.01"
                        max="2"
                        step="0.01"
                        value={expLambda}
                        onChange={(e) => setExpLambda(parseFloat(e.target.value))}
                        className="w-full accent-emerald-400"
                      />
                    </div>
                  )}

                  {family === "hypergeometric" && (
                    <>
                      <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800 space-y-1.5">
                        <div className="flex justify-between text-zinc-400">
                          <span>Población (N) / Éxitos (K):</span>
                          <strong className="text-emerald-400">{hypPopN} / {hypPopK}</strong>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={hypPopN}
                            onChange={(e) => setHypPopN(parseInt(e.target.value) || 2)}
                            className="w-1/2 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-center text-zinc-200"
                          />
                          <input
                            type="number"
                            value={hypPopK}
                            onChange={(e) => setHypPopK(parseInt(e.target.value) || 1)}
                            className="w-1/2 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-center text-zinc-200"
                          />
                        </div>
                      </div>
                      <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800 space-y-1.5">
                        <div className="flex justify-between text-zinc-400">
                          <span>Muestra Extraída (n):</span>
                          <strong className="text-sky-400">{hypSampleN}</strong>
                        </div>
                        <input
                          type="number"
                          value={hypSampleN}
                          onChange={(e) => setHypSampleN(parseInt(e.target.value) || 1)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-center text-zinc-200"
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Intervalos a Evaluar */}
                <div className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/70 flex flex-wrap items-center gap-4 text-xs font-mono">
                  <span className="text-zinc-400 font-bold">Punto / Intervalo:</span>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1">
                      <span className="text-zinc-500">a:</span>
                      <input
                        type="number"
                        step="0.5"
                        value={valA}
                        onChange={(e) => setValA(parseFloat(e.target.value) || 0)}
                        className="w-20 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-center text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
                      />
                    </label>

                    {queryType === "between" && (
                      <label className="flex items-center gap-1">
                        <span className="text-zinc-500">b:</span>
                        <input
                          type="number"
                          step="0.5"
                          value={valB}
                          onChange={(e) => setValB(parseFloat(e.target.value) || 0)}
                          className="w-20 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-center text-sky-400 font-bold focus:outline-none focus:border-sky-500"
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* Botón Guardar */}
              <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-500">
                  Persistencia ReSolve · Motores Paramétricos
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

            {/* Panel Derecho: Hero Card con Probabilidad Acumulada */}
            <div className="xl:col-span-4 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden relative">
              <div className="pointer-events-none absolute -bottom-16 -right-16 w-52 h-52 bg-emerald-500/10 rounded-full blur-3xl" />

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold">
                    Probabilidad P(Región)
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
                    Masa / Área Bajo la Curva
                  </span>
                  <div className="text-5xl font-serif font-bold text-emerald-400 tracking-tight">
                    {calculation.probPct}%
                  </div>
                  <span className="text-[11px] font-mono text-zinc-400 mt-2 block">
                    P = {calculation.prob}
                  </span>
                </div>

                {/* Métricas del Modelo */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                    <span className="text-[10px] text-zinc-500 block">Esperanza E[X] (μ)</span>
                    <strong className="text-emerald-400">{calculation.expected}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                    <span className="text-[10px] text-zinc-500 block">Desv. Estándar (σ)</span>
                    <strong className="text-sky-400">{calculation.stdDev}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                    <span className="text-[10px] text-zinc-500 block">Varianza Var(X)</span>
                    <strong className="text-zinc-200">{calculation.variance}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                    <span className="text-[10px] text-zinc-500 block">Naturaleza</span>
                    <strong className="text-amber-400">
                      {calculation.isContinuous ? "Continua" : "Discreta"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Botón de Propiedades Teóricas */}
              <div className="relative z-10 border-t border-zinc-800/60 pt-3 mt-3">
                <button
                  type="button"
                  onClick={() => setIsPropsModalOpen(true)}
                  className="w-full p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/70 hover:border-zinc-700 flex items-center justify-between text-[11px] font-mono transition-colors group"
                >
                  <div className="flex items-center gap-1.5 text-zinc-400 group-hover:text-zinc-200">
                    <Activity size={13} className="text-amber-400" />
                    <span>Propiedades y Teorema Central del Límite</span>
                  </div>
                  <ChevronRight size={13} className="text-zinc-600 group-hover:text-zinc-300" />
                </button>
              </div>
            </div>
          </div>

          {/* SECCIÓN INFERIOR: VISUALIZACIÓN GRÁFICA ESTRICTA + HISTORIAL */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-1 min-h-0">
            {/* Visualizador Gráfico (Reglas 1, 4 y 9) */}
            <div
              className={`${
                isExpanded
                  ? "absolute inset-0 z-30 bg-zinc-950/95 backdrop-blur-2xl border border-zinc-700/80 rounded-3xl p-6 shadow-2xl flex flex-col min-h-0 overflow-hidden"
                  : "xl:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20 space-y-4 overflow-hidden"
              }`}
            >
              <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3 shrink-0">
                <span className="text-xs font-mono font-semibold text-zinc-300 flex items-center gap-2">
                  <Activity size={14} className="text-emerald-400" />
                  {calculation.isContinuous
                    ? "Función de Densidad de Probabilidad (PDF)"
                    : "Función de Masa de Probabilidad (PMF)"}
                </span>

                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs font-mono transition-all flex items-center gap-1.5 shadow-sm"
                >
                  {isExpanded ? <Minimize2 size={13} className="text-amber-400" /> : <Maximize2 size={13} />}
                  <span>{isExpanded ? "Reducir" : "Expandir"}</span>
                </button>
              </div>

              {/* REGLA 2 & 3: Cadena de alturas resuelta con flex-1 min-h-0 */}
              <div className="flex-1 min-h-0 flex flex-col justify-end p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 overflow-hidden">
                {/* 1. RENDERIZADO CONTINUO (NORMAL / EXPONENCIAL) VIA SVG ESTRICTO (Regla 11: Coordenadas homogéneas 0..500 x 0..200) */}
                {calculation.isContinuous ? (
                  <div className="relative w-full flex-1 min-h-0 overflow-hidden flex flex-col justify-end">
                    <div className="absolute top-2 right-2 text-[10px] font-mono text-zinc-400 z-10">
                      Región Evaluada P = {calculation.probPct}%
                    </div>
                    <svg viewBox="0 0 500 200" className="w-full h-full" preserveAspectRatio="none">
                      {/* Eje de base */}
                      <line x1="0" y1="190" x2="500" y2="190" stroke="#27272a" strokeWidth="1.5" />

                      {/* Región sombreada evaluada */}
                      {calculation.continuousShadedPath && (
                        <path
                          d={calculation.continuousShadedPath}
                          fill="rgba(16, 185, 129, 0.35)"
                          stroke="rgba(16, 185, 129, 0.7)"
                          strokeWidth="1"
                        />
                      )}

                      {/* Curva continua de densidad */}
                      <path
                        d={calculation.continuousPath}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2.5"
                      />
                    </svg>
                  </div>
                ) : (
                  /* 2. RENDERIZADO DISCRETO (BINOMIAL / POISSON / HIPERGEOMÉTRICA) (Reglas 5, 8 y 10) */
                  <div className="w-full flex-1 min-h-0 flex flex-col justify-end overflow-hidden">
                    {/* Fila de Barras: items-stretch en el padre, justify-end en el hijo */}
                    <div className="flex items-stretch gap-1 w-full flex-1 min-h-0 pb-1">
                      {calculation.discreteBars.map((b) => {
                        const heightPct = Math.max(3, (b.probVal / maxDiscreteY) * 100);
                        return (
                          <div key={b.k} className="flex-1 min-w-0 flex flex-col justify-end h-full group relative">
                            {/* Barra con altura porcentual calculada contra el padre con altura resuelta */}
                            <div
                              style={{ height: `${heightPct}%` }}
                              className={`w-full rounded-t-sm transition-all ${
                                b.inInterval
                                  ? "bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-sm shadow-emerald-500/20"
                                  : "bg-zinc-800/60 hover:bg-zinc-700/60"
                              }`}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* REGLA 8: Fila hermana en flujo normal replicando EXACTAMENTE el mismo reparto (gap-1, flex-1 min-w-0) */}
                    <div className="flex items-center gap-1 w-full shrink-0 pt-2 border-t border-zinc-800">
                      {calculation.discreteBars.map((b) => (
                        <div key={b.k} className="flex-1 min-w-0 text-center">
                          <span
                            className={`text-[9px] font-mono block truncate ${
                              b.inInterval ? "text-emerald-400 font-bold" : "text-zinc-500"
                            }`}
                          >
                            {b.k}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-zinc-500 shrink-0 border-t border-zinc-900 mt-2">
                  <span>E[X] = {calculation.expected}</span>
                  <span className="text-emerald-400 font-semibold">Área Sombreada: P(Intervalo) = {calculation.probPct}%</span>
                </div>
              </div>
            </div>

            {/* Panel Historial */}
            <div className="xl:col-span-4 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20 overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <History size={15} className="text-zinc-400" /> Historial de Distribuciones
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
                    <p>Sin evaluaciones guardadas.</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Guarda cálculos para auditoría.</p>
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
                Procedimiento y Deducción Analítica
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                Distribución {family.toUpperCase()} con consulta {queryType}
              </p>
            </div>
            <div className="text-xs font-mono px-4 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-zinc-300">
              Probabilidad: <strong className="text-emerald-400">{calculation.probPct}%</strong>
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

      {/* MODO 3: TEORÍA DE DISTRIBUCIONES */}
      {viewMode === "theory" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto shadow-xl shadow-black/20 custom-scrollbar">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800/80 bg-zinc-900/60 text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 mb-3">
              <BookOpen size={12} /> Modelos de Probabilidad Paramétrica
            </div>
            <h3 className="text-2xl font-serif font-bold text-zinc-100">
              Distribuciones Teóricas y el Teorema Central del Límite
            </h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-3xl">
              Las distribuciones de probabilidad cuantifican la densidad o masa asociada a variables aleatorias en ciencias de la computación, telecomunicaciones y aprendizaje automático.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 space-y-2">
              <strong className="text-xs text-zinc-200 block font-mono uppercase tracking-wider">
                1. El Teorema Central del Límite (TCL)
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Establece que la suma o promedio de un número grande de variables aleatorias independientes e idénticamente distribuidas tiende asintóticamente hacia una distribución Gaussiana, independientemente de la distribución original.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 space-y-2">
              <strong className="text-xs text-zinc-200 block font-mono uppercase tracking-wider">
                2. Ley de los Eventos Raros (Poisson)
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Cuando el número de ensayos n es muy grande y la probabilidad de éxito p es muy pequeña de modo que np = λ se mantiene constante, la distribución Binomial converge exactamente hacia la distribución de Poisson.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PROPIEDADES AVANZADAS */}
      <AnimatePresence>
        {isPropsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md border border-zinc-800 bg-zinc-950 rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <h4 className="text-sm font-serif font-bold text-zinc-100 flex items-center gap-2">
                  <Activity size={15} className="text-amber-400" /> Propiedades de {family.toUpperCase()}
                </h4>
                <button onClick={() => setIsPropsModalOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-100">
                  <X size={16} />
                </button>
              </div>

              <div className="text-xs text-zinc-300 mt-4 space-y-2.5 font-mono">
                <p>• E[X] = {calculation.expected}</p>
                <p>• Var(X) = {calculation.variance}</p>
                <p>• Desv. Estándar = {calculation.stdDev}</p>
                {family === "normal" && <p>• Asimetría de Fisher = 0 (Curva simétrica mónada)</p>}
                {family === "exponential" && <p>• Pérdida de memoria: P(X &gt; s+t | X &gt; s) = P(X &gt; t)</p>}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL GUÍA CON CASOS UNIVERSITARIOS DE 1 CLIC */}
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
                    <h3 className="text-base font-serif font-bold text-zinc-100">Guía de Distribuciones de Probabilidad</h3>
                    <p className="text-xs text-zinc-400">Modelos paramétricos y catálogo de problemas universitarios</p>
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
                    <Terminal size={13} className="text-zinc-400" /> Selección de Familia
                  </h4>
                  <p className="text-zinc-400 leading-relaxed">
                    Selecciona entre distribuciones continuas (<code className="text-zinc-200">Normal</code>, <code className="text-zinc-200">Exponencial</code>) o discretas (<code className="text-zinc-200">Binomial</code>, <code className="text-zinc-200">Poisson</code>, <code className="text-zinc-200">Hipergeométrica</code>). El visor adaptará la densidad o masa en consecuencia.
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
                          setFamily(ex.family);
                          setQueryType(ex.config.queryType);
                          setValA(ex.config.valA);
                          if (ex.config.valB !== undefined) setValB(ex.config.valB);

                          if (ex.family === "normal") {
                            setNormMean(ex.config.params.mean);
                            setNormStdDev(ex.config.params.stdDev);
                          } else if (ex.family === "binomial") {
                            setBinomN(ex.config.params.n);
                            setBinomP(ex.config.params.p);
                          } else if (ex.family === "poisson") {
                            setPoissonLambda(ex.config.params.lambda);
                          } else if (ex.family === "exponential") {
                            setExpLambda(ex.config.params.expLambda);
                          } else if (ex.family === "hypergeometric") {
                            setHypPopN(ex.config.params.hypPopN);
                            setHypPopK(ex.config.params.hypPopK);
                            setHypSampleN(ex.config.params.hypSampleN);
                          }

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
                    <Cpu size={13} className="text-emerald-400" /> Aplicaciones en Computación
                  </h4>
                  <ul className="list-disc pl-4 space-y-1.5 text-zinc-400 leading-relaxed">
                    <li><strong>Teoría de Colas y Redes:</strong> Llegadas de paquetes a buffers de routers modelados como procesos de Poisson con tiempos de servicio exponenciales.</li>
                    <li><strong>Machine Learning:</strong> Inicialización gaussiana de pesos en redes neuronales profundas (He / Xavier Initialization).</li>
                    <li><strong>Simulación Estocástica:</strong> Generación de variables aleatorias continuas mediante transformación inversa de la CDF.</li>
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