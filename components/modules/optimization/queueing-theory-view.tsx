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
  Maximize2,
  Minimize2,
  ChevronRight,
  RotateCcw,
  Sliders,
  Table as TableIcon,
  Activity,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Compass,
  Cpu,
  Server,
  Clock,
  Users,
  Percent,
  ArrowRight,
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
// TIPOS Y MODELOS DE TEORÍA DE COLAS
// -----------------------------------------------------------------------------
export type QueueModelType = "MM1" | "MMc" | "MM1K";

export interface StateProbability {
  n: number;
  pn: number;
}

export interface QueueAnalysis {
  modelType: QueueModelType;
  lambda: number; // Tasa de llegada
  mu: number; // Tasa de servicio
  servers: number; // c o s
  capacityK?: number; // K en M/M/1/K
  rho: number; // Factor de utilización (intensidad de tráfico)
  isStable: boolean;
  p0: number; // Probabilidad de sistema vacío
  l: number; // Clientes promedio en el sistema (L)
  lq: number; // Clientes promedio en la cola (L_q)
  w: number; // Tiempo promedio en el sistema (W)
  wq: number; // Tiempo promedio en cola (W_q)
  lossProb?: number; // P_K de descarte en capacidad finita
  effectiveLambda: number;
  pnStates: StateProbability[];
}

interface ModuleExample {
  title: string;
  category: string;
  desc: string;
  modelType: QueueModelType;
  lambda: number;
  mu: number;
  servers: number;
  capacityK?: number;
}

const MODULE_EXAMPLES: ModuleExample[] = [
  {
    title: "Microservicio Cloud API Gateway (M/M/1)",
    category: "Ingeniería de Software / SRE",
    desc: "Llegan 45 req/s a un nodo Docker con capacidad de procesar 60 req/s. Tiempo de respuesta medio.",
    modelType: "MM1",
    lambda: 45,
    mu: 60,
    servers: 1,
  },
  {
    title: "Centro de Atención y Soporte Bancario (M/M/c)",
    category: "Operaciones y Servicios",
    desc: "30 clientes/hora atendidos por 4 cajeros en paralelo, cada uno atiende a 10 clientes/hora.",
    modelType: "MMc",
    lambda: 30,
    mu: 10,
    servers: 4,
  },
  {
    title: "Buffer de Paquetes en Router Cisco (M/M/1/K)",
    category: "Redes y Telecomunicaciones",
    desc: "Llegada de 120 paquetes/s, ancho de banda para 130 paquetes/s y cola limitada a K = 8 paquetes.",
    modelType: "MM1K",
    lambda: 120,
    mu: 130,
    servers: 1,
    capacityK: 8,
  },
  {
    title: "Clúster GPU para Inferencia de IA (M/M/c)",
    category: "Inteligencia Artificial y ML",
    desc: "8 nodos GPU en paralelo atendiendo consultas generativas con λ = 14 req/s y μ = 2 req/s por GPU.",
    modelType: "MMc",
    lambda: 14,
    mu: 2,
    servers: 8,
  },
];

function factorial(n: number): number {
  if (n <= 1) return 1;
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

// -----------------------------------------------------------------------------
// MOTOR ANALÍTICO: CÁLCULO ESTOCÁSTICO DE COLAS
// -----------------------------------------------------------------------------
function computeQueueModel(
  modelType: QueueModelType,
  lambda: number,
  mu: number,
  c: number,
  K: number
): QueueAnalysis {
  const safeLambda = Math.max(0.001, lambda);
  const safeMu = Math.max(0.001, mu);
  const servers = Math.max(1, Math.floor(c));
  const capacityK = Math.max(servers, Math.floor(K));

  let rho = 0;
  let isStable = true;
  let p0 = 0;
  let lq = 0;
  let l = 0;
  let wq = 0;
  let w = 0;
  let lossProb = 0;
  let effectiveLambda = safeLambda;
  const pnStates: StateProbability[] = [];

  // ===========================================================================
  // 1. MODELO M/M/1 (Servidor Único)
  // ===========================================================================
  if (modelType === "MM1") {
    rho = safeLambda / safeMu;
    isStable = rho < 1;

    if (isStable) {
      p0 = 1 - rho;
      l = rho / (1 - rho);
      lq = (rho * rho) / (1 - rho);
      w = 1 / (safeMu - safeLambda);
      wq = safeLambda / (safeMu * (safeMu - safeLambda));

      for (let n = 0; n <= 12; n++) {
        const pn = p0 * Math.pow(rho, n);
        pnStates.push({ n, pn: Number(pn.toFixed(4)) });
      }
    } else {
      p0 = 0;
      l = Infinity;
      lq = Infinity;
      w = Infinity;
      wq = Infinity;
    }
  }

  // ===========================================================================
  // 2. MODELO M/M/c (Múltiples Servidores en Paralelo)
  // ===========================================================================
  else if (modelType === "MMc") {
    rho = safeLambda / (servers * safeMu);
    isStable = rho < 1;

    if (isStable) {
      const a = safeLambda / safeMu; // Intensidad de tráfico Erlang
      let sumTerms = 0;
      for (let n = 0; n < servers; n++) {
        sumTerms += Math.pow(a, n) / factorial(n);
      }
      const lastTerm = Math.pow(a, servers) / (factorial(servers) * (1 - rho));
      p0 = 1 / (sumTerms + lastTerm);

      // Fórmula de Erlang C para cola
      lq = (p0 * Math.pow(a, servers) * rho) / (factorial(servers) * Math.pow(1 - rho, 2));
      l = lq + a;
      wq = lq / safeLambda;
      w = wq + 1 / safeMu;

      for (let n = 0; n <= Math.max(12, servers + 4); n++) {
        let pn = 0;
        if (n <= servers) {
          pn = (Math.pow(a, n) / factorial(n)) * p0;
        } else {
          pn = (Math.pow(a, n) / (factorial(servers) * Math.pow(servers, n - servers))) * p0;
        }
        pnStates.push({ n, pn: Number(pn.toFixed(4)) });
      }
    } else {
      p0 = 0;
      l = Infinity;
      lq = Infinity;
      w = Infinity;
      wq = Infinity;
    }
  }

  // ===========================================================================
  // 3. MODELO M/M/1/K (Capacidad Finita y Pérdida de Paquetes)
  // ===========================================================================
  else {
    rho = safeLambda / safeMu;
    isStable = true; // Un sistema finito siempre es estable

    if (Math.abs(rho - 1) < 1e-5) {
      p0 = 1 / (capacityK + 1);
      for (let n = 0; n <= capacityK; n++) {
        pnStates.push({ n, pn: Number(p0.toFixed(4)) });
      }
      l = capacityK / 2;
    } else {
      p0 = (1 - rho) / (1 - Math.pow(rho, capacityK + 1));
      let lSum = 0;
      for (let n = 0; n <= capacityK; n++) {
        const pn = p0 * Math.pow(rho, n);
        pnStates.push({ n, pn: Number(pn.toFixed(4)) });
        lSum += n * pn;
      }
      l = lSum;
    }

    lossProb = pnStates[pnStates.length - 1]?.pn || 0;
    effectiveLambda = safeLambda * (1 - lossProb);
    w = effectiveLambda > 0 ? l / effectiveLambda : 0;
    wq = Math.max(0, w - 1 / safeMu);
    lq = effectiveLambda * wq;
  }

  return {
    modelType,
    lambda: safeLambda,
    mu: safeMu,
    servers,
    capacityK,
    rho: Number(rho.toFixed(4)),
    isStable,
    p0: Number(p0.toFixed(4)),
    l: Number(l.toFixed(3)),
    lq: Number(lq.toFixed(3)),
    w: Number(w.toFixed(4)),
    wq: Number(wq.toFixed(4)),
    lossProb: modelType === "MM1K" ? Number(lossProb.toFixed(4)) : undefined,
    effectiveLambda: Number(effectiveLambda.toFixed(3)),
    pnStates,
  };
}

// -----------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// -----------------------------------------------------------------------------
export default function QueueingTheoryView({
  viewMode,
  initialExpression = "",
}: {
  viewMode: "calc" | "steps" | "theory";
  initialExpression?: string;
}) {
  const [modelType, setModelType] = useState<QueueModelType>("MM1");
  const [lambda, setLambda] = useState<number>(45);
  const [mu, setMu] = useState<number>(60);
  const [servers, setServers] = useState<number>(3);
  const [capacityK, setCapacityK] = useState<number>(10);

  const [activeTab, setActiveTab] = useState<"topology" | "probabilities">("topology");
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);

  const { setAIContext, injectedExpression, clearInjectedExpression } = useAIContext();

  const analysis = useMemo(() => {
    return computeQueueModel(modelType, lambda, mu, servers, capacityK);
  }, [modelType, lambda, mu, servers, capacityK]);

  // REGLA 10: Precalcular maxPn en useMemo fuera del render
  const maxPn = useMemo(() => {
    if (analysis.pnStates.length === 0) return 1;
    return Math.max(...analysis.pnStates.map((s) => s.pn), 0.001);
  }, [analysis.pnStates]);

  // Sincronización con ReSolve AI (Emisor)
  useEffect(() => {
    const summary = `Teoría de Colas (${analysis.modelType}) | λ=${analysis.lambda}, μ=${analysis.mu} | ρ=${analysis.rho} (${(analysis.rho * 100).toFixed(1)}%) | L=${analysis.l} clientes | Lq=${analysis.lq} | W=${analysis.w}s | Wq=${analysis.wq}s | Estable: ${analysis.isStable}`;
    setAIContext({
      module: "Matemáticas VI",
      subtopic: `Teoría de Colas (${analysis.modelType})`,
      expression: `Modelo ${analysis.modelType}: λ=${analysis.lambda}, μ=${analysis.mu}`,
      result: `W = ${analysis.w} (Espera en cola Wq = ${analysis.wq})`,
      details: summary,
    });
  }, [analysis, setAIContext]);

  // Receptor de IA
  useEffect(() => {
    if (injectedExpression) {
      try {
        const parsed = JSON.parse(injectedExpression);
        if (parsed.modelType) setModelType(parsed.modelType);
        if (parsed.lambda !== undefined) setLambda(parsed.lambda);
        if (parsed.mu !== undefined) setMu(parsed.mu);
        if (parsed.servers !== undefined) setServers(parsed.servers);
        if (parsed.capacityK !== undefined) setCapacityK(parsed.capacityK);
      } catch {
        // Silencioso
      }
      clearInjectedExpression();
    }
  }, [injectedExpression, clearInjectedExpression]);

  // Historial Supabase
  useEffect(() => {
    fetchUserHistory("mat6", "colas").then((data) => setHistory(data));
  }, []);

  const saveCalculation = async () => {
    const title = `Colas ${analysis.modelType} (λ=${analysis.lambda}, μ=${analysis.mu})`;
    const resSummary = `W = ${analysis.w} | L = ${analysis.l} | ρ = ${(analysis.rho * 100).toFixed(1)}%`;
    await saveUserCalculation("mat6", "colas", title, resSummary);
    const refreshed = await fetchUserHistory("mat6", "colas");
    setHistory(refreshed);
  };

  const clearHistory = async () => {
    await deleteUserHistory("colas");
    setHistory([]);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`W = ${analysis.w}, Wq = ${analysis.wq}, L = ${analysis.l}, Lq = ${analysis.lq}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Pasos analíticos KaTeX
  const analyticalSteps = useMemo(() => {
    const steps: { stage: string; desc: string; math: string; rule: string }[] = [];
    let id = 1;

    // 1. Tasa de utilización
    steps.push({
      stage: `${id++}. Tasa de Ocupación / Intensidad de Tráfico (ρ)`,
      desc: `Proporción del tiempo en que los servidores están ocupados. Condición de estabilidad: ρ < 1.`,
      math: `\\rho = \\frac{\\lambda}{${analysis.modelType === "MMc" ? `c \\cdot \\mu` : `\\mu`}} = \\frac{${analysis.lambda}}{${analysis.modelType === "MMc" ? `${analysis.servers} \\times ${analysis.mu}` : analysis.mu}} = ${analysis.rho} \\quad (${(analysis.rho * 100).toFixed(2)}\\%)`,
      rule: analysis.isStable ? "Sistema Estable (ρ < 1)" : "Sistema Saturado (ρ ≥ 1, Cola Infinita)",
    });

    // 2. Probabilidad de Sistema Vacío P0
    steps.push({
      stage: `${id++}. Probabilidad de Sistema Ocioso / Vacío (P₀)`,
      desc: "Probabilidad de que no haya ningún cliente en el sistema al arribar una nueva petición.",
      math: `P_0 = ${analysis.p0} \\quad (${(analysis.p0 * 100).toFixed(2)}\\%)`,
      rule: "Condición Inicial Estacionaria",
    });

    // 3. Medidas en Cola (Lq y Wq)
    steps.push({
      stage: `${id++}. Medidas de Desempeño en Cola (L_q y W_q)`,
      desc: "Número promedio de clientes esperando servicio y tiempo medio de espera antes de ser atendido.",
      math: `L_q = ${analysis.lq} \\text{ clientes}, \\quad W_q = \\frac{L_q}{\\lambda} = \\frac{${analysis.lq}}{${analysis.effectiveLambda}} = ${analysis.wq} \\text{ unidades de tiempo}`,
      rule: "Ley de Little en Cola",
    });

    // 4. Medidas Globales en el Sistema (L y W)
    steps.push({
      stage: `${id++}. Medidas Globales en el Sistema (L y W)`,
      desc: "Total promedio de clientes en el sistema (cola + servicio) y tiempo de estancia total.",
      math: `L = ${analysis.l} \\text{ clientes}, \\quad W = W_q + \\frac{1}{\\mu} = ${analysis.wq} + \\frac{1}{${analysis.mu}} = ${analysis.w} \\text{ unidades de tiempo}`,
      rule: "Ley Fundamental de Little: L = λW",
    });

    if (analysis.modelType === "MM1K") {
      steps.push({
        stage: `${id++}. Probabilidad de Bloqueo y Pérdida (P_K)`,
        desc: "Probabilidad de que la capacidad K del búfer esté llena al llegar un paquete/cliente.",
        math: `P_{\\text{pérdida}} = P_{${analysis.capacityK}} = ${analysis.lossProb} \\implies \\lambda_{\\text{efectiva}} = ${analysis.effectiveLambda}`,
        rule: "Capacidad Finita M/M/1/K",
      });
    }

    return steps;
  }, [analysis]);

  return (
    // REGLA 1 & 2: Ancestro raíz con relative explícito y cadena de alturas resuelta
    <div className="h-full flex flex-col gap-6 min-h-0 relative select-none">
      {viewMode === "calc" && (
        <div className="flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto custom-scrollbar pr-1">
          {/* BARRA DE SELECCIÓN DE MODELO DE KENDALL */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-zinc-900/40 border border-zinc-800/60 rounded-2xl shrink-0 backdrop-blur-xl">
            <div className="flex flex-wrap items-center gap-1.5">
              {(["MM1", "MMc", "MM1K"] as QueueModelType[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModelType(m)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 ${
                    modelType === m
                      ? "bg-zinc-100 text-zinc-950 font-bold shadow-md"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Server size={13} />
                  <span>{m === "MM1" ? "M/M/1 (Servidor Único)" : m === "MMc" ? "M/M/c (Servidores Paralelos)" : "M/M/1/K (Capacidad Finita)"}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsHelpOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-[11px] font-mono text-zinc-300 transition-colors flex items-center gap-1.5 shadow-sm ml-auto"
            >
              <Sparkles size={13} className="text-amber-400" />
              <span>Casos Reales</span>
            </button>
          </div>

          {/* SECCIÓN SUPERIOR: CONFIGURACIÓN DE PARÁMETROS + HERO CARD */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 shrink-0">
            {/* Panel Izquierdo: Consola de Parámetros */}
            <div className="xl:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 space-y-5 overflow-hidden">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/60 pb-3">
                  <span className="text-xs font-mono font-semibold text-zinc-300 flex items-center gap-2">
                    <Sliders size={14} className="text-emerald-400" />
                    Parámetros Operativos del Sistema ({modelType})
                  </span>
                  <span className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border ${
                    analysis.isStable ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                  }`}>
                    {analysis.isStable ? "Sistema Estable (ρ < 1)" : "Sistema Saturado (ρ ≥ 1)"}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                  {/* Tasa de Llegada λ */}
                  <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800 space-y-1.5">
                    <div className="flex justify-between text-zinc-400">
                      <span>Tasa de Llegada (λ):</span>
                      <strong className="text-emerald-400">{lambda} clientes/u.t.</strong>
                    </div>
                    <input
                      type="number"
                      step="1"
                      min="0.1"
                      value={lambda}
                      onChange={(e) => setLambda(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-zinc-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Tasa de Servicio μ */}
                  <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800 space-y-1.5">
                    <div className="flex justify-between text-zinc-400">
                      <span>Tasa de Servicio (μ por servidor):</span>
                      <strong className="text-sky-400">{mu} clientes/u.t.</strong>
                    </div>
                    <input
                      type="number"
                      step="1"
                      min="0.1"
                      value={mu}
                      onChange={(e) => setMu(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-zinc-200 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  {/* Servidores Paralelos (M/M/c) */}
                  {modelType === "MMc" && (
                    <div className="col-span-2 p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800 space-y-1.5">
                      <div className="flex justify-between text-zinc-400">
                        <span>Número de Servidores (c):</span>
                        <strong className="text-amber-400">{servers} canales en paralelo</strong>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="16"
                        value={servers}
                        onChange={(e) => setServers(parseInt(e.target.value))}
                        className="w-full accent-amber-400"
                      />
                    </div>
                  )}

                  {/* Capacidad Máxima (M/M/1/K) */}
                  {modelType === "MM1K" && (
                    <div className="col-span-2 p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800 space-y-1.5">
                      <div className="flex justify-between text-zinc-400">
                        <span>Capacidad Total del Sistema (K = cola + servicio):</span>
                        <strong className="text-purple-400">{capacityK} lugares</strong>
                      </div>
                      <input
                        type="range"
                        min="2"
                        max="25"
                        value={capacityK}
                        onChange={(e) => setCapacityK(parseInt(e.target.value))}
                        className="w-full accent-purple-400"
                      />
                    </div>
                  )}
                </div>

                {/* Factor de Utilización Rho */}
                <div className="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/70 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <Activity size={14} className="text-emerald-400" />
                    <span className="text-zinc-400">Intensidad de Tráfico (ρ = λ / cμ):</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                      <div
                        style={{ width: `${Math.min(100, Math.max(2, analysis.rho * 100))}%` }}
                        className={`h-full rounded-full transition-all ${
                          analysis.rho < 0.75
                            ? "bg-emerald-400"
                            : analysis.rho < 1
                            ? "bg-amber-400"
                            : "bg-rose-500"
                        }`}
                      />
                    </div>
                    <strong className={`font-mono text-sm ${analysis.isStable ? "text-emerald-400" : "text-rose-400"}`}>
                      {(analysis.rho * 100).toFixed(1)}%
                    </strong>
                  </div>
                </div>
              </div>

              {/* Botón Guardar */}
              <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-500">
                  Persistencia ReSolve · Notación de Kendall
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

            {/* Panel Derecho: Hero Card con Tiempo en Sistema (W) */}
            <div className="xl:col-span-4 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden relative">
              <div className="pointer-events-none absolute -bottom-16 -right-16 w-52 h-52 bg-emerald-500/10 rounded-full blur-3xl" />

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold">
                    Tiempo en el Sistema (W)
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
                    Estancia Media Total (Cola + Servicio)
                  </span>
                  <div className={`text-5xl font-serif font-bold tracking-tight ${analysis.isStable ? "text-emerald-400" : "text-rose-400"}`}>
                    {analysis.isStable ? analysis.w : "∞"}
                  </div>
                  <span className="text-[11px] font-mono text-zinc-400 mt-2 block">
                    {analysis.isStable
                      ? `Tiempo en espera de cola Wq = ${analysis.wq}`
                      : "La tasa de llegada supera la capacidad de atención"}
                  </span>
                </div>

                {/* Métricas del Sistema de Colas */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                    <span className="text-[10px] text-zinc-500 block">Clientes en Sistema (L)</span>
                    <strong className="text-emerald-400 text-sm">{analysis.isStable ? analysis.l : "∞"}</strong>
                  </div>

                  <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                    <span className="text-[10px] text-zinc-500 block">Clientes en Cola (Lq)</span>
                    <strong className="text-sky-400 text-sm">{analysis.isStable ? analysis.lq : "∞"}</strong>
                  </div>

                  <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                    <span className="text-[10px] text-zinc-500 block">Sistema Ocioso (P₀)</span>
                    <strong className="text-amber-400 text-sm">{(analysis.p0 * 100).toFixed(1)}%</strong>
                  </div>

                  <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                    <span className="text-[10px] text-zinc-500 block">
                      {modelType === "MM1K" ? "Pérdida (P_K)" : "Tiempo en Cola (Wq)"}
                    </span>
                    <strong className="text-purple-400 text-sm">
                      {modelType === "MM1K" && analysis.lossProb !== undefined
                        ? `${(analysis.lossProb * 100).toFixed(2)}%`
                        : `${analysis.wq}`}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="relative z-10 border-t border-zinc-800/60 pt-3 mt-3">
                <div className="text-[11px] font-mono text-zinc-500 flex items-center justify-between">
                  <span>Modelo de Kendall Activo:</span>
                  <span className="text-emerald-400 font-bold">{modelType}</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN INFERIOR: VISUALIZADOR TOPOLOGÍA / PROBABILIDADES P_n (REGLAS 1, 3, 4, 9) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-1 min-h-0">
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
                    onClick={() => setActiveTab("topology")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 ${
                      activeTab === "topology"
                        ? "bg-zinc-100 text-zinc-950 font-bold shadow-md"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Layers size={13} /> Topología de Cola & Servidores
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("probabilities")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 ${
                      activeTab === "probabilities"
                        ? "bg-zinc-100 text-zinc-950 font-bold shadow-md"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Percent size={13} /> Distribución de Estados Pₙ
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

              {/* REGLA 2 & 3: flex-1 min-h-0 min-w-0 con overflow-hidden */}
              <div className="flex-1 min-h-0 min-w-0 flex flex-col justify-end p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 overflow-hidden">
                {/* 1. VISTA TOPOLOGÍA DEL SISTEMA */}
                {activeTab === "topology" && (
                  <div className="w-full flex-1 min-h-0 flex flex-col items-center justify-center space-y-6 overflow-hidden">
                    {/* Flujo de Llegada -> Cola -> Servidores */}
                    <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-mono">
                      {/* Llegada */}
                      <div className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-center space-y-1">
                        <span className="text-[10px] text-zinc-500 uppercase block">Arribo λ</span>
                        <strong className="text-emerald-400 text-sm block">{analysis.lambda}</strong>
                        <span className="text-[10px] text-zinc-500">Poisson</span>
                      </div>

                      <ArrowRight size={16} className="text-zinc-600" />

                      {/* Búfer / Cola */}
                      <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-dashed border-zinc-700 text-center space-y-1.5 min-w-[140px]">
                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Cola de Espera</span>
                        <div className="flex items-center justify-center gap-1 text-emerald-400 font-bold text-base">
                          <Users size={16} />
                          <span>Lq ≈ {analysis.isStable ? analysis.lq : "∞"}</span>
                        </div>
                        <span className="text-[10px] text-zinc-500 block">Espera: {analysis.isStable ? `${analysis.wq}s` : "∞"}</span>
                      </div>

                      <ArrowRight size={16} className="text-zinc-600" />

                      {/* Servidores en Paralelo */}
                      <div className="flex flex-col gap-1.5">
                        {Array.from({ length: Math.min(6, analysis.servers) }).map((_, idx) => (
                          <div
                            key={idx}
                            className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <Server size={13} className="text-sky-400" />
                              <span className="text-zinc-300">Servidor {idx + 1}</span>
                            </div>
                            <span className="text-[11px] text-emerald-400 font-bold">μ = {analysis.mu}</span>
                          </div>
                        ))}
                        {analysis.servers > 6 && (
                          <span className="text-[10px] text-zinc-500 text-center font-mono">
                            + {analysis.servers - 6} servidores adicionales activos
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-[11px] font-mono text-zinc-400 text-center">
                      Tiempo Total de Estancia W = Wq + 1/μ = {analysis.isStable ? `${analysis.w} unidades de tiempo` : "Saturado"}
                    </div>
                  </div>
                )}

                {/* 2. DISTRIBUCIÓN DE ESTADOS P_n (REGLAS 5, 8, 10) */}
                {activeTab === "probabilities" && (
                  <div className="w-full flex-1 min-h-0 flex flex-col justify-end overflow-hidden">
                    {/* Fila de Barras: items-stretch en el padre, justify-end en el hijo */}
                    <div className="flex items-stretch gap-1 w-full flex-1 min-h-0 pb-1">
                      {analysis.pnStates.map((s) => {
                        const heightPct = Math.max(4, (s.pn / maxPn) * 100);
                        return (
                          <div key={s.n} className="flex-1 min-w-0 flex flex-col justify-end h-full group relative">
                            <div
                              style={{ height: `${heightPct}%` }}
                              className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-sm transition-all group-hover:brightness-125"
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* REGLA 8: Fila hermana replicando exactamente el reparto (gap-1, flex-1 min-w-0) */}
                    <div className="flex items-center gap-1 w-full shrink-0 pt-2 border-t border-zinc-800">
                      {analysis.pnStates.map((s) => (
                        <div key={s.n} className="flex-1 min-w-0 text-center">
                          <span className="text-[9px] font-mono text-zinc-500 block truncate">
                            n={s.n}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Panel Historial */}
            <div className="xl:col-span-4 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20 overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <History size={15} className="text-zinc-400" /> Historial de Colas
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
                    <p className="text-[10px] text-zinc-600 mt-1">
                      Guarda configuraciones de tráfico para comparar SLAs.
                    </p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700 transition-all flex items-center justify-between text-xs"
                    >
                      <div className="truncate pr-2 font-mono text-zinc-300">{item.expression}</div>
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
                Procedimiento y Deducción Analítica del Sistema de Colas
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                Modelo {analysis.modelType} (λ = {analysis.lambda}, μ = {analysis.mu})
              </p>
            </div>
            <div className="text-xs font-mono px-4 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-zinc-300">
              Ocupación: <strong className="text-emerald-400 font-serif">{(analysis.rho * 100).toFixed(1)}%</strong>
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

      {/* MODO 3: TEORÍA DE SISTEMAS DE ESPERA */}
      {viewMode === "theory" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto shadow-xl shadow-black/20 custom-scrollbar">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800/80 bg-zinc-900/60 text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 mb-3">
              <BookOpen size={12} /> Procesos de Nacimiento y Muerte (Markov)
            </div>
            <h3 className="text-2xl font-serif font-bold text-zinc-100">
              Teoría de Colas, Notación de Kendall y la Ley de Little
            </h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-3xl">
              Iniciada por A.K. Erlang en 1909 para dimensionar centrales telefónicas, la teoría de colas modela el equilibrio entre el costo de proveer servicio y el costo derivado de los retrasos por espera.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 space-y-2">
              <strong className="text-xs text-zinc-200 block font-mono uppercase tracking-wider">
                1. La Ley Universal de Little (L = λW)
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Demostrada rigurosamente por John Little en 1961, establece que bajo condiciones estacionarias, el número promedio de elementos en un sistema equivale a la tasa de llegada efectiva multiplicada por el tiempo medio de permanencia, independientemente de la distribución de probabilidad subyacente.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 space-y-2">
              <strong className="text-xs text-zinc-200 block font-mono uppercase tracking-wider">
                2. Notación de Kendall (A / S / c / K)
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Estandariza los sistemas de espera mediante la distribución de llegadas (A), distribución de servicio (S), número de servidores paralelos (c) y capacidad del búfer (K). M indica distribución exponencial con propiedad de pérdida de memoria (Markoviana).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GUÍA CON CASOS REALES DE 1 CLIC */}
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
                      Guía de Teoría de Colas y Modelos de Tráfico
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Problemas reales de telecomunicaciones, servidores y logística
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
                    <Terminal size={13} className="text-zinc-400" /> Modelos Estocásticos Disponibles
                  </h4>
                  <p className="text-zinc-400 leading-relaxed">
                    Usa <code className="text-zinc-200">M/M/1</code> para cuellos de botella de canal único, <code className="text-zinc-200">M/M/c</code> para servidores paralelos escalables y <code className="text-zinc-200">M/M/1/K</code> para búferes con límite de capacidad física donde existe descarte de paquetes.
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
                          setModelType(ex.modelType);
                          setLambda(ex.lambda);
                          setMu(ex.mu);
                          setServers(ex.servers);
                          if (ex.capacityK !== undefined) setCapacityK(ex.capacityK);
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
                    <Cpu size={13} className="text-emerald-400" /> Aplicaciones en Computación y Redes
                  </h4>
                  <ul className="list-disc pl-4 space-y-1.5 text-zinc-400 leading-relaxed">
                    <li><strong>Balanceo de Carga (Load Balancing):</strong> Enrutamiento de peticiones HTTP en clústeres Kubernetes con auto-escalado horizontal de pods (HPA).</li>
                    <li><strong>Ingeniería de Tráfico en Redes (QoS):</strong> Dimensionamiento de búferes en routers de fibra óptica para evitar caídas de paquetes por desbordamiento (Drop-Tail).</li>
                    <li><strong>Bases de Datos y Conexiones (Connection Pooling):</strong> Determinación del tamaño óptimo de pools en PostgreSQL/MySQL para minimizar la latencia de queries.</li>
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