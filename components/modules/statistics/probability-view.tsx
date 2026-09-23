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
  PieChart,
  GitBranch,
  Layers,
  Activity,
  ChevronRight,
  Info,
  Terminal,
  RotateCcw,
  Sliders,
  Maximize2,
  Minimize2,
  AlertCircle,
  CheckCircle2,
  Shuffle,
  Binary,
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
// TIPOS Y MODELOS DE PROBABILIDAD
// -----------------------------------------------------------------------------
export type ProbabilitySubtopic = "bayes" | "events" | "combinatorics";
export type EventRelation = "independent" | "mutually_exclusive" | "custom";
export type CombinatoricsType = "combinations" | "permutations" | "variations";

export interface BayesHypothesis {
  id: string;
  name: string;
  prior: number; // P(Ai)
  likelihood: number; // P(B|Ai)
}

export interface BayesResult {
  totalProbB: number; // P(B)
  posteriors: { name: string; posterior: number; posteriorCompl: number }[];
  isValidPriorSum: boolean;
}

export interface EventsResult {
  probA: number;
  probB: number;
  probIntersection: number;
  probUnion: number;
  probA_given_B: number;
  probB_given_A: number;
  probNotA: number;
  probNotB: number;
  probA_minus_B: number;
  isIndependent: boolean;
  isMutuallyExclusive: boolean;
}

export interface CombinatoricsResult {
  n: number;
  r: number;
  resultValue: number;
  formulaLaTeX: string;
  laplaceProb: number;
}

interface ModuleExample {
  title: string;
  category: string;
  subtopic: ProbabilitySubtopic;
  desc: string;
  data: any;
}

const MODULE_EXAMPLES: ModuleExample[] = [
  {
    title: "Prueba Médica y Falsos Positivos (Paradoja)",
    category: "Bioestadística / Bayes",
    subtopic: "bayes",
    desc: "Enfermedad rara (1% prevalencia) con test del 95% de sensibilidad y 5% de falsos positivos.",
    data: {
      hypotheses: [
        { id: "h1", name: "Enfermo (A₁)", prior: 0.01, likelihood: 0.95 },
        { id: "h2", name: "Sano (A₂)", prior: 0.99, likelihood: 0.05 },
      ],
    },
  },
  {
    title: "Clasificador Anti-Spam (Naive Bayes)",
    category: "Machine Learning / IA",
    subtopic: "bayes",
    desc: "Probabilidad de que un correo sea Spam dado que contiene la palabra 'Gratis'.",
    data: {
      hypotheses: [
        { id: "h1", name: "Spam (A₁)", prior: 0.2, likelihood: 0.85 },
        { id: "h2", name: "Legítimo (A₂)", prior: 0.8, likelihood: 0.02 },
      ],
    },
  },
  {
    title: "Control de Calidad en 3 Fábricas",
    category: "Ingeniería de Producción",
    subtopic: "bayes",
    desc: "Tres plantas que fabrican el 50%, 30% y 20% con 1%, 2% y 4% de piezas defectuosas.",
    data: {
      hypotheses: [
        { id: "h1", name: "Planta 1", prior: 0.5, likelihood: 0.01 },
        { id: "h2", name: "Planta 2", prior: 0.3, likelihood: 0.02 },
        { id: "h3", name: "Planta 3", prior: 0.2, likelihood: 0.04 },
      ],
    },
  },
  {
    title: "Eventos Independientes en Servidores",
    category: "Fiabilidad de Sistemas",
    subtopic: "events",
    desc: "Disponibilidad simultánea de dos nodos en clúster redundante activo-activo.",
    data: {
      probA: 0.98,
      probB: 0.95,
      relation: "independent",
      probIntersection: 0.931,
    },
  },
  {
    title: "Mano de Póker / Combinaciones",
    category: "Probabilidad Clásica",
    subtopic: "combinatorics",
    desc: "Seleccionar 5 cartas de una baraja inglesa de 52 Naipes (C(52, 5)).",
    data: {
      n: 52,
      r: 5,
      combType: "combinations",
    },
  },
];

// -----------------------------------------------------------------------------
// FUNCIONES AUXILIARES MATEMÁTICAS
// -----------------------------------------------------------------------------
function factorial(num: number): number {
  if (num < 0) return 0;
  if (num === 0 || num === 1) return 1;
  let res = 1;
  for (let i = 2; i <= num; i++) res *= i;
  return res;
}

export default function ProbabilityView({
  viewMode,
  initialExpression = "",
}: {
  viewMode: "calc" | "steps" | "theory";
  initialExpression?: string;
}) {
  const [subtopic, setSubtopic] = useState<ProbabilitySubtopic>("bayes");

  // Estado: Bayes
  const [hypotheses, setHypotheses] = useState<BayesHypothesis[]>([
    { id: "h1", name: "Enfermo (A₁)", prior: 0.01, likelihood: 0.95 },
    { id: "h2", name: "Sano (A₂)", prior: 0.99, likelihood: 0.05 },
  ]);

  // Estado: Álgebra de Eventos
  const [probA, setProbA] = useState<number>(0.6);
  const [probB, setProbB] = useState<number>(0.4);
  const [eventRelation, setEventRelation] = useState<EventRelation>("independent");
  const [customIntersection, setCustomIntersection] = useState<number>(0.24);

  // Estado: Combinatoria
  const [combN, setCombN] = useState<number>(10);
  const [combR, setCombR] = useState<number>(3);
  const [combType, setCombType] = useState<CombinatoricsType>("combinations");

  const [activeTab, setActiveTab] = useState<"diagram" | "table">("diagram");
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isPropsOpen, setIsPropsOpen] = useState<boolean>(false);

  const { setAIContext, injectedExpression, clearInjectedExpression } = useAIContext();

  // ---------------------------------------------------------------------------
  // MOTOR 1: TEOREMA DE BAYES Y PROBABILIDAD TOTAL
  // ---------------------------------------------------------------------------
  const bayesAnalysis = useMemo<BayesResult>(() => {
    const priorSum = hypotheses.reduce((acc, h) => acc + (h.prior || 0), 0);
    const isValidPriorSum = Math.abs(priorSum - 1.0) < 1e-4;

    // P(B) = sum( P(Ai) * P(B|Ai) )
    const totalProbB = hypotheses.reduce((acc, h) => acc + (h.prior || 0) * (h.likelihood || 0), 0);

    const posteriors = hypotheses.map((h) => {
      const joint = (h.prior || 0) * (h.likelihood || 0);
      const post = totalProbB > 0 ? joint / totalProbB : 0;
      const totalNotB = 1 - totalProbB;
      const jointNotB = (h.prior || 0) * (1 - (h.likelihood || 0));
      const postCompl = totalNotB > 0 ? jointNotB / totalNotB : 0;

      return {
        name: h.name,
        posterior: Number(post.toFixed(4)),
        posteriorCompl: Number(postCompl.toFixed(4)),
      };
    });

    return {
      totalProbB: Number(totalProbB.toFixed(4)),
      posteriors,
      isValidPriorSum,
    };
  }, [hypotheses]);

  // ---------------------------------------------------------------------------
  // MOTOR 2: ÁLGEBRA DE EVENTOS Y VENN
  // ---------------------------------------------------------------------------
  const eventsAnalysis = useMemo<EventsResult>(() => {
    let pInter = 0;
    if (eventRelation === "independent") {
      pInter = probA * probB;
    } else if (eventRelation === "mutually_exclusive") {
      pInter = 0;
    } else {
      pInter = Math.min(customIntersection, Math.min(probA, probB));
    }

    const pUnion = Math.min(1, probA + probB - pInter);
    const pA_given_B = probB > 0 ? pInter / probB : 0;
    const pB_given_A = probA > 0 ? pInter / probA : 0;
    const isIndep = Math.abs(pInter - probA * probB) < 1e-5;
    const isExcl = pInter === 0;

    return {
      probA: Number(probA.toFixed(3)),
      probB: Number(probB.toFixed(3)),
      probIntersection: Number(pInter.toFixed(4)),
      probUnion: Number(pUnion.toFixed(4)),
      probA_given_B: Number(pA_given_B.toFixed(4)),
      probB_given_A: Number(pB_given_A.toFixed(4)),
      probNotA: Number((1 - probA).toFixed(3)),
      probNotB: Number((1 - probB).toFixed(3)),
      probA_minus_B: Number((probA - pInter).toFixed(4)),
      isIndependent: isIndep,
      isMutuallyExclusive: isExcl,
    };
  }, [probA, probB, eventRelation, customIntersection]);

  // ---------------------------------------------------------------------------
  // MOTOR 3: COMBINATORIA Y ESPACIOS MUESTRALES
  // ---------------------------------------------------------------------------
  const combinatoricsAnalysis = useMemo<CombinatoricsResult>(() => {
    const n = Math.max(1, Math.min(30, Math.floor(combN)));
    const r = Math.max(0, Math.min(n, Math.floor(combR)));

    let val = 1;
    let formula = "";

    if (combType === "combinations") {
      val = factorial(n) / (factorial(r) * factorial(n - r));
      formula = `\\binom{${n}}{${r}} = \\frac{${n}!}{${r}!(${n}-${r})!} = ${val}`;
    } else if (combType === "permutations") {
      val = factorial(n) / factorial(n - r);
      formula = `P(${n}, ${r}) = \\frac{${n}!}{(${n}-${r})!} = ${val}`;
    } else {
      val = Math.pow(n, r);
      formula = `VR(${n}, ${r}) = ${n}^{${r}} = ${val}`;
    }

    return {
      n,
      r,
      resultValue: val,
      formulaLaTeX: formula,
      laplaceProb: val > 0 ? Number((1 / val).toFixed(6)) : 0,
    };
  }, [combN, combR, combType]);

  // ---------------------------------------------------------------------------
  // SINCRONIZACIÓN CON RE-SOLVE AI (EMISOR)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (subtopic === "bayes") {
      const topPosterior = bayesAnalysis.posteriors[0];
      setAIContext({
        module: "Matemáticas V",
        subtopic: "Teorema de Bayes y Probabilidad Total",
        expression: `P(B) = ${bayesAnalysis.totalProbB}`,
        result: topPosterior ? `P(${topPosterior.name}|B) = ${(topPosterior.posterior * 100).toFixed(2)}%` : "0%",
        details: `Hipótesis: ${hypotheses.length} | P(B): ${bayesAnalysis.totalProbB} | Suma Priors: ${hypotheses.reduce((acc, h) => acc + h.prior, 0)}`,
      });
    } else if (subtopic === "events") {
      setAIContext({
        module: "Matemáticas V",
        subtopic: "Álgebra de Eventos",
        expression: `P(A)=${eventsAnalysis.probA}, P(B)=${eventsAnalysis.probB}`,
        result: `P(A ∪ B) = ${eventsAnalysis.probUnion}, P(A ∩ B) = ${eventsAnalysis.probIntersection}`,
        details: `Independientes: ${eventsAnalysis.isIndependent} | Mutuamente Excluyentes: ${eventsAnalysis.isMutuallyExclusive}`,
      });
    } else {
      setAIContext({
        module: "Matemáticas V",
        subtopic: "Combinatoria y Conteo",
        expression: `n=${combinatoricsAnalysis.n}, r=${combinatoricsAnalysis.r}`,
        result: `Espacio muestral = ${combinatoricsAnalysis.resultValue}`,
        details: `P(1 Caso) = ${combinatoricsAnalysis.laplaceProb}`,
      });
    }
  }, [subtopic, bayesAnalysis, eventsAnalysis, combinatoricsAnalysis, hypotheses, setAIContext]);

  // Receptor de IA
  useEffect(() => {
    if (injectedExpression) {
      try {
        const parsed = JSON.parse(injectedExpression);
        if (parsed.hypotheses) {
          setSubtopic("bayes");
          setHypotheses(parsed.hypotheses);
        } else if (parsed.probA !== undefined) {
          setSubtopic("events");
          setProbA(parsed.probA);
          setProbB(parsed.probB || 0.5);
        }
      } catch {
        // Silencioso
      }
      clearInjectedExpression();
    }
  }, [injectedExpression, clearInjectedExpression]);

  // Persistencia Supabase
  useEffect(() => {
    fetchUserHistory("mat5", "probabilidad").then((data) => setHistory(data));
  }, []);

  const saveCalculation = async () => {
    let title = "";
    let res = "";

    if (subtopic === "bayes") {
      title = `Bayes (${hypotheses.length} hipótesis)`;
      res = `P(B)=${bayesAnalysis.totalProbB} | P(${hypotheses[0]?.name}|B)=${(bayesAnalysis.posteriors[0]?.posterior * 100).toFixed(1)}%`;
    } else if (subtopic === "events") {
      title = `Eventos A y B (${eventRelation})`;
      res = `P(A∪B)=${eventsAnalysis.probUnion} | P(A|B)=${eventsAnalysis.probA_given_B}`;
    } else {
      title = `Combinatoria (${combType} n=${combinatoricsAnalysis.n}, r=${combinatoricsAnalysis.r})`;
      res = `Formas = ${combinatoricsAnalysis.resultValue}`;
    }

    await saveUserCalculation("mat5", "probabilidad", title, res);
    const refreshed = await fetchUserHistory("mat5", "probabilidad");
    setHistory(refreshed);
  };

  const clearHistory = async () => {
    await deleteUserHistory("probabilidad");
    setHistory([]);
  };

  const handleCopy = () => {
    let val = "";
    if (subtopic === "bayes") {
      val = `P(B) = ${bayesAnalysis.totalProbB} ; Posterior = ${bayesAnalysis.posteriors[0]?.posterior}`;
    } else if (subtopic === "events") {
      val = `P(A u B) = ${eventsAnalysis.probUnion} ; P(A n B) = ${eventsAnalysis.probIntersection}`;
    } else {
      val = `Total: ${combinatoricsAnalysis.resultValue}`;
    }
    navigator.clipboard.writeText(val);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Moduladores de Hipótesis de Bayes
  const handleAddHypothesis = () => {
    const nextIdx = hypotheses.length + 1;
    setHypotheses((prev) => [
      ...prev,
      { id: `h${Date.now()}`, name: `Hipótesis A${nextIdx}`, prior: 0.1, likelihood: 0.5 },
    ]);
  };

  const handleRemoveHypothesis = (id: string) => {
    if (hypotheses.length <= 2) return;
    setHypotheses((prev) => prev.filter((h) => h.id !== id));
  };

  const updateHypothesis = (id: string, field: "prior" | "likelihood" | "name", val: any) => {
    setHypotheses((prev) =>
      prev.map((h) => (h.id === id ? { ...h, [field]: field === "name" ? val : parseFloat(val) || 0 } : h))
    );
  };

  // ---------------------------------------------------------------------------
  // DESGLOSE PASO A PASO EN KaTeX
  // ---------------------------------------------------------------------------
  const analyticalSteps = useMemo(() => {
    const steps: { stage: string; desc: string; math: string; rule: string }[] = [];
    let id = 1;

    if (subtopic === "bayes") {
      // Paso 1: Verificación de Partición del Espacio Muestral
      const priorEq = hypotheses.map((h) => `P(${h.name}) = ${h.prior}`).join(" , \\quad ");
      steps.push({
        stage: `${id++}. Verificación de Partición del Espacio (Priors)`,
        desc: "Las hipótesis Aᵢ deben formar una partición exhaustiva y mutuamente excluyente del espacio muestral (∑ P(Aᵢ) = 1).",
        math: `\\sum_{i=1}^k P(A_i) = ${hypotheses.reduce((acc, h) => acc + h.prior, 0).toFixed(4)} \\implies ${priorEq}`,
        rule: "Axioma de Kolmogorov",
      });

      // Paso 2: Teorema de la Probabilidad Total
      const totalTerms = hypotheses.map((h) => `(${h.prior} \\times ${h.likelihood})`).join(" + ");
      steps.push({
        stage: `${id++}. Teorema de la Probabilidad Total P(B)`,
        desc: "Calculamos la probabilidad global de observar la evidencia o síntoma B sumando todas las intersecciones disjuntas.",
        math: `P(B) = \\sum_{i=1}^k P(A_i) \\cdot P(B|A_i) = ${totalTerms} = ${bayesAnalysis.totalProbB}`,
        rule: "Probabilidad Total",
      });

      // Paso 3: Aplicación del Teorema de Bayes a Posteriori
      hypotheses.forEach((h, idx) => {
        const post = bayesAnalysis.posteriors[idx]?.posterior || 0;
        steps.push({
          stage: `${id++}. Probabilidad a Posteriori para ${h.name}`,
          desc: `Actualización bayesiana: Probabilidad de ${h.name} habiendo observado la evidencia positiva B.`,
          math: `P(${h.name}|B) = \\frac{P(${h.name}) \\cdot P(B|${h.name})}{P(B)} = \\frac{${h.prior} \\times ${h.likelihood}}{${bayesAnalysis.totalProbB}} = ${post} \\quad (${(post * 100).toFixed(2)}\\%)`,
          rule: "Regla de Bayes",
        });
      });
    } else if (subtopic === "events") {
      steps.push({
        stage: `${id++}. Regla General de la Adición (Unión de Eventos)`,
        desc: "La probabilidad de que ocurra al menos uno de los dos eventos considera la probabilidad individual menos su solapamiento.",
        math: `P(A \\cup B) = P(A) + P(B) - P(A \\cap B) = ${eventsAnalysis.probA} + ${eventsAnalysis.probB} - ${eventsAnalysis.probIntersection} = ${eventsAnalysis.probUnion}`,
        rule: "Principio de Inclusión-Exclusión",
      });

      steps.push({
        stage: `${id++}. Probabilidad Condicional y Criterio de Independencia`,
        desc: "La condición de independencia se cumple si y solo si P(A ∩ B) = P(A) · P(B), lo que implica P(A|B) = P(A).",
        math: `P(A|B) = \\frac{P(A \\cap B)}{P(B)} = \\frac{${eventsAnalysis.probIntersection}}{${eventsAnalysis.probB}} = ${eventsAnalysis.probA_given_B} \\\\[6pt] P(A) \\cdot P(B) = ${eventsAnalysis.probA} \\times ${eventsAnalysis.probB} = ${Number((eventsAnalysis.probA * eventsAnalysis.probB).toFixed(4))} \\implies \\text{${eventsAnalysis.isIndependent ? "Son Independientes" : "Son Dependientes"}}`,
        rule: "Independencia Estocástica",
      });

      steps.push({
        stage: `${id++}. Eventos Complementarios y Leyes de De Morgan`,
        desc: "Probabilidad de que ninguno de los eventos suceda (complemento de la unión).",
        math: `P((A \\cup B)') = 1 - P(A \\cup B) = 1 - ${eventsAnalysis.probUnion} = ${Number((1 - eventsAnalysis.probUnion).toFixed(4))}`,
        rule: "Leyes de De Morgan",
      });
    } else {
      steps.push({
        stage: `${id++}. Evaluación del Espacio de Configuraciones`,
        desc: `Aplicamos técnicas de conteo factorial según el orden y repetición de los elementos (${combType}).`,
        math: combinatoricsAnalysis.formulaLaTeX,
        rule: "Análisis Combinatorio",
      });

      steps.push({
        stage: `${id++}. Probabilidad Clásica de Laplace`,
        desc: "Asumiendo un espacio muestral equiprobable, la probabilidad de un resultado elemental exacto es el inverso del total.",
        math: `P(\\text{Evento}) = \\frac{1}{\\text{Total}} = \\frac{1}{${combinatoricsAnalysis.resultValue}} = ${combinatoricsAnalysis.laplaceProb}`,
        rule: "Regla de Laplace",
      });
    }

    return steps;
  }, [subtopic, hypotheses, bayesAnalysis, eventsAnalysis, combinatoricsAnalysis]);

  return (
    <div className="h-full flex flex-col gap-6 min-h-0 relative select-none">
      {viewMode === "calc" && (
        <div className="flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto custom-scrollbar pr-1">
          {/* BARRA DE SELECCIÓN DE SUB-MOTOR */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-zinc-900/40 border border-zinc-800/60 rounded-2xl shrink-0 backdrop-blur-xl">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSubtopic("bayes")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 ${
                  subtopic === "bayes"
                    ? "bg-zinc-100 text-zinc-950 font-bold shadow-md"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <GitBranch size={13} /> Teorema de Bayes & Total
              </button>

              <button
                type="button"
                onClick={() => setSubtopic("events")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 ${
                  subtopic === "events"
                    ? "bg-zinc-100 text-zinc-950 font-bold shadow-md"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <PieChart size={13} /> Eventos y Diagrama de Venn
              </button>

              <button
                type="button"
                onClick={() => setSubtopic("combinatorics")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 ${
                  subtopic === "combinatorics"
                    ? "bg-zinc-100 text-zinc-950 font-bold shadow-md"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Binary size={13} /> Combinatoria y Laplace
              </button>
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

          {/* SECCIÓN SUPERIOR: CONFIGURADOR DEL MODELO + HERO CARD */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 shrink-0">
            {/* Panel Izquierdo: Consola de Entradas */}
            <div className="xl:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 space-y-5">
              {/* 1. CONFIGURADOR BAYES */}
              {subtopic === "bayes" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                    <span className="text-xs font-mono font-semibold text-zinc-300 flex items-center gap-2">
                      <GitBranch size={14} className="text-emerald-400" />
                      Hipótesis a Priori y Verosimilitudes Condicionales
                    </span>
                    <button
                      type="button"
                      onClick={handleAddHypothesis}
                      className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs font-mono text-zinc-300 flex items-center gap-1 transition-colors"
                    >
                      + Añadir Hipótesis
                    </button>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                    {hypotheses.map((h, idx) => (
                      <div
                        key={h.id}
                        className="flex flex-wrap items-center gap-3 p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70 text-xs font-mono"
                      >
                        <input
                          type="text"
                          value={h.name}
                          onChange={(e) => updateHypothesis(h.id, "name", e.target.value)}
                          className="w-32 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-zinc-200 focus:outline-none focus:border-emerald-500"
                        />

                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-500 text-[11px]">P(Aᵢ):</span>
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            max="1"
                            value={h.prior}
                            onChange={(e) => updateHypothesis(h.id, "prior", e.target.value)}
                            className="w-16 bg-zinc-900 border border-zinc-800 rounded-lg px-1.5 py-1 text-center text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-500 text-[11px]">P(B|Aᵢ):</span>
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            max="1"
                            value={h.likelihood}
                            onChange={(e) => updateHypothesis(h.id, "likelihood", e.target.value)}
                            className="w-16 bg-zinc-900 border border-zinc-800 rounded-lg px-1.5 py-1 text-center text-amber-400 font-bold focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        <div className="text-[11px] text-sky-400 ml-auto font-bold">
                          Conjunta = {Number((h.prior * h.likelihood).toFixed(4))}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveHypothesis(h.id)}
                          disabled={hypotheses.length <= 2}
                          className="p-1 text-zinc-600 hover:text-rose-400 disabled:opacity-20 ml-2"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {!bayesAnalysis.isValidPriorSum && (
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-mono flex items-center gap-2">
                      <AlertCircle size={13} className="shrink-0" />
                      <span>
                        Atención: La suma de priors es {hypotheses.reduce((acc, h) => acc + h.prior, 0).toFixed(3)} (debe ser exactamente 1.0).
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 2. CONFIGURADOR EVENTOS */}
              {subtopic === "events" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                    <span className="text-xs font-mono font-semibold text-zinc-300">
                      Parámetros de Eventos A y B
                    </span>
                    <div className="flex bg-zinc-900 p-0.5 rounded-xl border border-zinc-800 text-xs font-mono">
                      <button
                        type="button"
                        onClick={() => setEventRelation("independent")}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          eventRelation === "independent" ? "bg-zinc-100 text-zinc-950 font-bold" : "text-zinc-400"
                        }`}
                      >
                        Independientes
                      </button>
                      <button
                        type="button"
                        onClick={() => setEventRelation("mutually_exclusive")}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          eventRelation === "mutually_exclusive" ? "bg-zinc-100 text-zinc-950 font-bold" : "text-zinc-400"
                        }`}
                      >
                        Excluyentes
                      </button>
                      <button
                        type="button"
                        onClick={() => setEventRelation("custom")}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          eventRelation === "custom" ? "bg-amber-400 text-zinc-950 font-bold" : "text-zinc-400"
                        }`}
                      >
                        Personalizado
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
                    <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/70 space-y-1.5">
                      <div className="flex justify-between text-zinc-400">
                        <span>P(A):</span>
                        <strong className="text-emerald-400">{probA}</strong>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.02"
                        value={probA}
                        onChange={(e) => setProbA(parseFloat(e.target.value))}
                        className="w-full accent-emerald-500"
                      />
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/70 space-y-1.5">
                      <div className="flex justify-between text-zinc-400">
                        <span>P(B):</span>
                        <strong className="text-sky-400">{probB}</strong>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.02"
                        value={probB}
                        onChange={(e) => setProbB(parseFloat(e.target.value))}
                        className="w-full accent-sky-500"
                      />
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/70 space-y-1.5">
                      <div className="flex justify-between text-zinc-400">
                        <span>P(A ∩ B):</span>
                        <strong className="text-purple-400">{eventsAnalysis.probIntersection}</strong>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={Math.min(probA, probB)}
                        step="0.01"
                        disabled={eventRelation !== "custom"}
                        value={eventsAnalysis.probIntersection}
                        onChange={(e) => setCustomIntersection(parseFloat(e.target.value))}
                        className="w-full accent-purple-500 disabled:opacity-30"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 3. CONFIGURADOR COMBINATORIA */}
              {subtopic === "combinatorics" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                    <span className="text-xs font-mono font-semibold text-zinc-300">
                      Técnicas de Conteo y Particiones
                    </span>
                    <div className="flex bg-zinc-900 p-0.5 rounded-xl border border-zinc-800 text-xs font-mono">
                      <button
                        type="button"
                        onClick={() => setCombType("combinations")}
                        className={`px-3 py-1 rounded-lg transition-all ${
                          combType === "combinations" ? "bg-zinc-100 text-zinc-950 font-bold" : "text-zinc-400"
                        }`}
                      >
                        Combinaciones C(n,r)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCombType("permutations")}
                        className={`px-3 py-1 rounded-lg transition-all ${
                          combType === "permutations" ? "bg-zinc-100 text-zinc-950 font-bold" : "text-zinc-400"
                        }`}
                      >
                        Permutaciones P(n,r)
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 font-mono text-xs">
                    <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-1.5">
                      <div className="flex justify-between text-zinc-400">
                        <span>Población Total (n):</span>
                        <strong className="text-emerald-400">{combN}</strong>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="25"
                        value={combN}
                        onChange={(e) => setCombN(parseInt(e.target.value))}
                        className="w-full accent-emerald-400"
                      />
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-1.5">
                      <div className="flex justify-between text-zinc-400">
                        <span>Muestra / Selección (r):</span>
                        <strong className="text-sky-400">{combR}</strong>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={combN}
                        value={combR}
                        onChange={(e) => setCombR(parseInt(e.target.value))}
                        className="w-full accent-sky-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Botón Guardar */}
              <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-500">
                  Persistencia ReSolve · Probabilidad Universal
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

            {/* Panel Derecho: Tarjeta Hero */}
            <div className="xl:col-span-4 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden relative">
              <div className="pointer-events-none absolute -bottom-16 -right-16 w-52 h-52 bg-emerald-500/10 rounded-full blur-3xl" />

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold">
                    {subtopic === "bayes"
                      ? "Posterior P(A₁|B)"
                      : subtopic === "events"
                      ? "Unión P(A ∪ B)"
                      : "Espacio Muestral"}
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
                    {subtopic === "bayes"
                      ? `Probabilidad de ${hypotheses[0]?.name}`
                      : subtopic === "events"
                      ? "Probabilidad Acumulada"
                      : "Configuraciones Posibles"}
                  </span>
                  <div className="text-5xl font-serif font-bold text-emerald-400 tracking-tight">
                    {subtopic === "bayes"
                      ? `${((bayesAnalysis.posteriors[0]?.posterior || 0) * 100).toFixed(2)}%`
                      : subtopic === "events"
                      ? `${(eventsAnalysis.probUnion * 100).toFixed(1)}%`
                      : combinatoricsAnalysis.resultValue.toLocaleString()}
                  </div>
                  <span className="text-[11px] font-mono text-zinc-400 mt-2 block">
                    {subtopic === "bayes"
                      ? `P(B) Total = ${(bayesAnalysis.totalProbB * 100).toFixed(2)}%`
                      : subtopic === "events"
                      ? `P(A ∩ B) = ${(eventsAnalysis.probIntersection * 100).toFixed(1)}%`
                      : `P(1 Caso) = ${combinatoricsAnalysis.laplaceProb}`}
                  </span>
                </div>

                {/* Métricas Secundarias */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  {subtopic === "bayes" ? (
                    <>
                      <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                        <span className="text-[10px] text-zinc-500 block">Probabilidad Total P(B)</span>
                        <strong className="text-emerald-400">{bayesAnalysis.totalProbB}</strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                        <span className="text-[10px] text-zinc-500 block">P(A₁|Bᶜ) (Negativo)</span>
                        <strong className="text-sky-400">
                          {bayesAnalysis.posteriors[0]?.posteriorCompl}
                        </strong>
                      </div>
                    </>
                  ) : subtopic === "events" ? (
                    <>
                      <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                        <span className="text-[10px] text-zinc-500 block">Condicional P(A|B)</span>
                        <strong className="text-emerald-400">{eventsAnalysis.probA_given_B}</strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                        <span className="text-[10px] text-zinc-500 block">Condicional P(B|A)</span>
                        <strong className="text-sky-400">{eventsAnalysis.probB_given_A}</strong>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                        <span className="text-[10px] text-zinc-500 block">Orden Importa</span>
                        <strong className="text-emerald-400">
                          {combType === "permutations" ? "Sí (P)" : "No (C)"}
                        </strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70">
                        <span className="text-[10px] text-zinc-500 block">Ratio de Laplace</span>
                        <strong className="text-sky-400">1 / {combinatoricsAnalysis.resultValue}</strong>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Botón de Propiedades Teóricas */}
              <div className="relative z-10 border-t border-zinc-800/60 pt-3 mt-3">
                <button
                  type="button"
                  onClick={() => setIsPropsOpen(true)}
                  className="w-full p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/70 hover:border-zinc-700 flex items-center justify-between text-[11px] font-mono transition-colors group"
                >
                  <div className="flex items-center gap-1.5 text-zinc-400 group-hover:text-zinc-200">
                    <Activity size={13} className="text-amber-400" />
                    <span>Propiedades y Axiomas de Kolmogorov</span>
                  </div>
                  <ChevronRight size={13} className="text-zinc-600 group-hover:text-zinc-300" />
                </button>
              </div>
            </div>
          </div>

          {/* SECCIÓN INFERIOR: VISUALIZACIÓN GRÁFICA (ÁRBOL / VENN) + HISTORIAL */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-1 min-h-0">
            {/* Contenedor Visual */}
            <div
              className={`${
                isExpanded
                  ? "fixed inset-4 z-50 bg-zinc-950/95 backdrop-blur-2xl border border-zinc-700/80 rounded-3xl p-6 shadow-2xl flex flex-col"
                  : "xl:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20 space-y-4"
              }`}
            >
              <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3 shrink-0">
                <span className="text-xs font-mono font-semibold text-zinc-300 flex items-center gap-2">
                  <Layers size={14} className="text-emerald-400" />
                  {subtopic === "bayes"
                    ? "Diagrama de Árbol Probabilístico"
                    : subtopic === "events"
                    ? "Diagrama de Venn y Particiones"
                    : "Espacio Muestral Discreto"}
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

              {/* Renderizado Gráfico */}
              <div className="flex-1 min-h-0 pt-2 flex items-center justify-center">
                {/* 1. ÁRBOL DE PROBABILIDAD DE BAYES (SVG) */}
                {subtopic === "bayes" && (
                  <div className={`w-full overflow-y-auto p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 ${isExpanded ? "h-[calc(100vh-160px)]" : "h-[360px]"}`}>
                    <div className="flex flex-col gap-4 max-w-xl mx-auto font-mono text-xs">
                      {hypotheses.map((h, i) => {
                        const post = bayesAnalysis.posteriors[i]?.posterior || 0;
                        const joint = Number((h.prior * h.likelihood).toFixed(4));
                        return (
                          <div key={h.id} className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/70 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-zinc-200">{h.name}</span>
                              <span className="text-emerald-400 font-bold">
                                P({h.name}|B) = {(post * 100).toFixed(2)}%
                              </span>
                            </div>

                            {/* Barra proporcional de posterior */}
                            <div className="h-3 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                              <div
                                style={{ width: `${Math.min(100, Math.max(2, post * 100))}%` }}
                                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                              />
                            </div>

                            <div className="flex justify-between text-[11px] text-zinc-500">
                              <span>Prior: P(A) = {h.prior}</span>
                              <span>Verosimilitud: P(B|A) = {h.likelihood}</span>
                              <span>P(A ∩ B) = {joint}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. DIAGRAMA DE VENN PROPORCIONAL */}
                {subtopic === "events" && (
                  <div className={`w-full flex flex-col items-center justify-center p-6 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 ${isExpanded ? "h-[calc(100vh-160px)]" : "h-[360px]"}`}>
                    <svg viewBox="0 0 400 200" className="w-full max-w-md h-auto">
                      {/* Fondo Universo S */}
                      <rect x="10" y="10" width="380" height="180" rx="16" fill="#09090b" stroke="#27272a" strokeWidth="1.5" />
                      <text x="30" y="35" fill="#71717a" fontSize="12" fontFamily="monospace">Universo S (100%)</text>

                      {/* Círculo Evento A */}
                      <circle cx="160" cy="105" r="65" fill="#10b981" fillOpacity="0.25" stroke="#10b981" strokeWidth="2" />
                      {/* Círculo Evento B */}
                      <circle cx="240" cy="105" r="65" fill="#0ea5e9" fillOpacity="0.25" stroke="#0ea5e9" strokeWidth="2" />

                      {/* Textos y Etiquetas */}
                      <text x="130" y="110" fill="#a7f3d0" fontSize="11" fontFamily="monospace" textAnchor="middle">
                        A \ B
                        <tspan x="130" dy="14" fontSize="10" fill="#6ee7b7">{(eventsAnalysis.probA_minus_B * 100).toFixed(1)}%</tspan>
                      </text>

                      <text x="200" y="110" fill="#fcd34d" fontSize="11" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                        A ∩ B
                        <tspan x="200" dy="14" fontSize="10" fill="#fef08a">{(eventsAnalysis.probIntersection * 100).toFixed(1)}%</tspan>
                      </text>

                      <text x="270" y="110" fill="#bae6fd" fontSize="11" fontFamily="monospace" textAnchor="middle">
                        B \ A
                        <tspan x="270" dy="14" fontSize="10" fill="#7dd3fc">{Number(((eventsAnalysis.probB - eventsAnalysis.probIntersection) * 100).toFixed(1))}%</tspan>
                      </text>
                    </svg>
                    <div className="text-[11px] font-mono text-zinc-400 mt-2 text-center">
                      Área total cubierta por la unión P(A ∪ B) = {(eventsAnalysis.probUnion * 100).toFixed(1)}%
                    </div>
                  </div>
                )}

                {/* 3. COMBINATORIA RESUMEN */}
                {subtopic === "combinatorics" && (
                  <div className={`w-full flex flex-col items-center justify-center p-6 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 space-y-4 ${isExpanded ? "h-[calc(100vh-160px)]" : "h-[360px]"}`}>
                    <div className="p-6 rounded-3xl bg-zinc-900/60 border border-zinc-800 text-center space-y-2">
                      <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest block">
                        Fórmula Combinatoria Evaluada
                      </span>
                      <div className="text-xl font-mono text-emerald-400">
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {`$$${combinatoricsAnalysis.formulaLaTeX}$$`}
                        </ReactMarkdown>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-zinc-500 text-center max-w-sm">
                      Cada subconjunto tiene una probabilidad uniforme idéntica de ocurrir de p = {combinatoricsAnalysis.laplaceProb}.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Panel Historial */}
            <div className="xl:col-span-4 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <History size={15} className="text-zinc-400" /> Historial de Probabilidad
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
                    <p className="text-[10px] text-zinc-600 mt-1">Guarda operaciones para auditar.</p>
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
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-5 shrink-0">
            <div>
              <h3 className="text-xl font-serif font-bold text-zinc-100">
                Procedimiento y Demostración Probabilística
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                {subtopic === "bayes"
                  ? "Teorema de Bayes y Descomposición del Espacio Muestral"
                  : subtopic === "events"
                  ? "Álgebra de Conjuntos y Axiomática de Kolmogorov"
                  : "Análisis Combinatorio y Regla de Laplace"}
              </p>
            </div>
            <div className="text-xs font-mono px-4 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-zinc-300">
              Método: <strong className="text-emerald-400">{subtopic.toUpperCase()}</strong>
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

      {/* MODO 3: TEORÍA DE PROBABILIDAD Y FUNDAMENTOS */}
      {viewMode === "theory" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto shadow-xl shadow-black/20 custom-scrollbar">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800/80 bg-zinc-900/60 text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 mb-3">
              <BookOpen size={12} /> Teoría de la Medida y Probabilidad
            </div>
            <h3 className="text-2xl font-serif font-bold text-zinc-100">
              Inferencia Bayesiana, Independencia y Teoría de la Información
            </h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-3xl">
              La probabilidad cuantifica la incertidumbre. Formalizada por Andréi Kolmogorov en 1933 a través de la teoría de la medida, constituye el núcleo de la toma de decisiones en Inteligencia Artificial y Filtros de Kalman.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 space-y-2">
              <strong className="text-xs text-zinc-200 block font-mono uppercase tracking-wider">
                1. Interpretación Bayesiana vs Frecuentista
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                El enfoque frecuentista interpreta la probabilidad como el límite de la frecuencia relativa en infinitos ensayos. La visión bayesiana trata la probabilidad como un grado de creencia que se actualiza racionalmente ante nueva evidencia.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 space-y-2">
              <strong className="text-xs text-zinc-200 block font-mono uppercase tracking-wider">
                2. Paradoja del Falso Positivo
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Cuando una condición es extraordinariamente infrecuente en la población general (prior muy bajo), incluso un test médico con 95% de precisión arrojará más falsos positivos que verdaderos positivos.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PROPIEDADES Y AXIOMAS */}
      <AnimatePresence>
        {isPropsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md border border-zinc-800 bg-zinc-950 rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <h4 className="text-sm font-serif font-bold text-zinc-100 flex items-center gap-2">
                  <Activity size={15} className="text-amber-400" /> Axiomas Fundamentales
                </h4>
                <button onClick={() => setIsPropsOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-100">
                  <X size={16} />
                </button>
              </div>

              <div className="text-xs text-zinc-300 mt-4 space-y-2.5 font-mono">
                <p>1. No negatividad: 0 ≤ P(A) ≤ 1</p>
                <p>2. Certidumbre: P(S) = 1 (Universo completo)</p>
                <p>3. Aditividad: Si A ∩ B = ∅ ⟹ P(A ∪ B) = P(A) + P(B)</p>
                <p>4. Complemento: P(A') = 1 - P(A)</p>
                <p>5. Imposibilidad: P(∅) = 0</p>
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
                    <h3 className="text-base font-serif font-bold text-zinc-100">Guía de Probabilidad Universitaria</h3>
                    <p className="text-xs text-zinc-400">Inferencia bayesiana, conjuntos y casos de estudio aplicados</p>
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
                    <Terminal size={13} className="text-zinc-400" /> Métodos Disponibles
                  </h4>
                  <p className="text-zinc-400 leading-relaxed">
                    Usa las pestañas superiores para alternar entre el <code className="text-zinc-200">Teorema de Bayes</code> (diagnósticos y clasificación), <code className="text-zinc-200">Eventos y Venn</code> (unión e independencia) o <code className="text-zinc-200">Combinatoria</code> (espacios muestrales discretos).
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
                          setSubtopic(ex.subtopic);
                          if (ex.subtopic === "bayes") {
                            setHypotheses(ex.data.hypotheses);
                          } else if (ex.subtopic === "events") {
                            setProbA(ex.data.probA);
                            setProbB(ex.data.probB);
                            setEventRelation(ex.data.relation);
                          } else {
                            setCombN(ex.data.n);
                            setCombR(ex.data.r);
                            setCombType(ex.data.combType);
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
                    <Cpu size={13} className="text-emerald-400" /> Aplicaciones en Ciencias de la Computación
                  </h4>
                  <ul className="list-disc pl-4 space-y-1.5 text-zinc-400 leading-relaxed">
                    <li><strong>Clasificadores Naive Bayes:</strong> Filtrado de spam y análisis de sentimientos en procesamiento de lenguaje natural (NLP).</li>
                    <li><strong>Redes Bayesianas de Decisión:</strong> Modelado causal en robótica autónoma y diagnóstico de fallos en arquitecturas de microservicios.</li>
                    <li><strong>Algoritmos Aleatorizados (Monte Carlo):</strong> Métodos computacionales para aproximar integrales en física cuántica y gráficos por computadora.</li>
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