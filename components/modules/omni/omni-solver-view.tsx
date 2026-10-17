"use client";

import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Zap,
  Dices,
  Eye,
  EyeOff,
  ArrowDownToLine,
  Loader2,
  X,
  History,
  Trash2,
  Cpu,
  Wand2,
  CheckCircle2,
  CornerDownLeft,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

import SolutionCard, { type SolutionData } from "@/components/shared/solution-card";
import { solveLocally, buildFallback, type EngineResult } from "@/lib/math/universal-engine";

// =============================================================================
// Calculadora Universal
// -----------------------------------------------------------------------------
// Motor de resolución en dos capas:
//   1. MOTOR LOCAL (determinista): reconoce métodos sencillos (aritmética,
//      ecuaciones, derivadas, integrales, límites, sistemas, determinantes…) y
//      los resuelve al instante, enrutándolos a su módulo especializado.
//   2. IA (respaldo): para lenguaje natural o problemas no reconocidos.
//   3. GARANTÍA: si todo falla, `buildFallback` SIEMPRE produce una respuesta.
// =============================================================================

export type CalcTargetModule =
  | "omni"
  | "mat1"
  | "mat2"
  | "mat3"
  | "mat4"
  | "mat5"
  | "mat6";

interface UniversalCalculatorProps {
  onNavigateToModule: (
    moduleId: CalcTargetModule,
    subtopicId: string,
    expression: string,
    extraParams?: { point?: string; side?: string }
  ) => void;
}

interface HistoryEntry {
  id: string;
  query: string;
  result: SolutionData;
  source: "local" | "ai" | "fallback";
}

const TOPICS_LIST = [
  { id: "random", label: "Cualquier tema (Aleatorio total)" },
  { id: "algebra", label: "Álgebra (Polinomios y Ecuaciones)" },
  { id: "limites", label: "Cálculo de Límites (0/0, ∞, Trigonométricos)" },
  { id: "geometria", label: "Geometría Analítica y Cuerpos 3D" },
  { id: "funciones", label: "Funciones y Análisis de Curvas" },
  { id: "aritmetica", label: "Aritmética y Fracciones Complejas" },
  { id: "matrices", label: "Matrices y Álgebra Lineal" },
  { id: "logica", label: "Lógica Computacional y Proposiciones" },
];

const DIFFICULTY_LEVELS = [
  { id: "facil", label: "Básico" },
  { id: "intermedio", label: "Examen Universitario" },
  { id: "avanzado", label: "Nivel Reto / Olimpiada" },
];

const QUICK_PROMPTS = [
  { title: "Aritmética", prompt: "√3782 + 5!", badge: "Aritmética" },
  { title: "Ecuación Cuadrática", prompt: "x^2 - 5x + 6 = 0", badge: "Álgebra" },
  { title: "Límite al Infinito", prompt: "límite de (3x^2 + 5) / (2x^2 - x) al infinito", badge: "Límites" },
  { title: "Derivada", prompt: "deriva x^3 - 2x", badge: "Derivadas" },
  { title: "Integral Definida", prompt: "integral de 0 a 3 de x^2", badge: "Integrales" },
  { title: "Sistema 2×2", prompt: "x + y = 5, x - y = 1", badge: "Sistemas" },
];

const KIND_LABELS: Record<string, string> = {
  aritmetica: "Aritmética",
  porcentaje: "Porcentaje",
  algebra: "Álgebra",
  derivadas: "Derivadas",
  integrales: "Integrales",
  limites: "Límites",
  matrices: "Matrices",
  determinantes: "Determinantes",
  "sistemas-gauss": "Sistemas Lineales",
  funciones: "Funciones",
};

/** Convierte un resultado del motor local al formato de `SolutionCard`. */
function engineToSolution(result: EngineResult): SolutionData {
  return {
    targetModule: result.targetModule,
    targetSubtopic: result.targetSubtopic,
    categoryName: result.categoryName,
    problemStatement: result.problemStatement,
    extractedFormula: result.extractedFormula,
    limitPoint: result.limitPoint ?? null,
    limitSide: result.limitSide ?? null,
    primaryResult: result.primaryResult,
    steps: result.steps,
    graphableExpression: result.graphableExpression,
    explanation: result.explanation,
    matrixData: result.matrixData
      ? { matrices: result.matrixData.matrices, operation: result.matrixData.operation }
      : undefined,
  };
}

/** Convierte la respuesta cruda de la IA al formato de `SolutionCard`. */
function aiToSolution(data: Partial<SolutionData> & Record<string, unknown>): SolutionData {
  return {
    targetModule: (data.targetModule as string) || "omni",
    targetSubtopic: (data.targetSubtopic as string) || "",
    categoryName: (data.categoryName as string) || "Solución Universal",
    problemStatement: data.problemStatement as string | undefined,
    extractedFormula: (data.extractedFormula as string) || "",
    limitPoint: (data.limitPoint as string | null) ?? null,
    limitSide: (data.limitSide as SolutionData["limitSide"]) ?? null,
    primaryResult: (data.primaryResult as string) || "—",
    steps: (data.steps as SolutionData["steps"]) || [],
    graphableExpression: (data.graphableExpression as string | null) ?? null,
    explanation: (data.explanation as string) || "",
    matrixData: data.matrixData as SolutionData["matrixData"],
    propositionData: data.propositionData as SolutionData["propositionData"],
    frequencyData: data.frequencyData as SolutionData["frequencyData"],
    amortizationData: data.amortizationData as SolutionData["amortizationData"],
    renderHints: data.renderHints as SolutionData["renderHints"],
  };
}

export default function UniversalCalculatorView({ onNavigateToModule }: UniversalCalculatorProps) {
  const [inputQuery, setInputQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [solution, setSolution] = useState<SolutionData | null>(null);
  const [source, setSource] = useState<"local" | "ai" | "fallback" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // --- Estados del Generador de Problemas Aleatorios ---
  const [isGeneratorOpen, setIsGeneratorOpen] = useState<boolean>(false);
  const [selectedTopic, setSelectedTopic] = useState<string>("random");
  const [selectedDiff, setSelectedDiff] = useState<string>("intermedio");
  const [generatingRandom, setGeneratingRandom] = useState<boolean>(false);
  const [generatedProblem, setGeneratedProblem] = useState<SolutionData | null>(null);
  const [showSolution, setShowSolution] = useState<boolean>(false);

  const resolveWithAI = useCallback(async (text: string): Promise<SolutionData | null> => {
    const res = await fetch("/api/ai/omni-solve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: text }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || "No se pudo interpretar el problema.");
    }
    return aiToSolution(data);
  }, []);

  /**
   * Flujo principal garantizado:
   *   1. Motor local → si reconoce el método, resuelve y enruta.
   *   2. IA → para lenguaje natural / problemas complejos.
   *   3. Fallback → SIEMPRE hay respuesta.
   */
  const handleSolve = async (queryText?: string) => {
    const text = (queryText || inputQuery).trim();
    if (!text || loading) return;

    setLoading(true);
    setErrorMsg(null);
    setSolution(null);
    setSource(null);

    try {
      // 1. Motor determinista local
      const local = await solveLocally(text);
      if (local) {
        const mapped = engineToSolution(local);
        setSolution(mapped);
        setSource("local");
        pushHistory(text, mapped, "local");
        return;
      }

      // 2. IA de respaldo
      try {
        const ai = await resolveWithAI(text);
        if (ai) {
          setSolution(ai);
          setSource("ai");
          pushHistory(text, ai, "ai");
          return;
        }
      } catch (aiErr) {
        // Guardamos el error pero seguimos al fallback garantizado
        setErrorMsg(aiErr instanceof Error ? aiErr.message : null);
      }

      // 3. Fallback garantizado: nunca dejar sin respuesta
      const fb = buildFallback(text);
      const mappedFb = engineToSolution(fb);
      setSolution(mappedFb);
      setSource("fallback");
      pushHistory(text, mappedFb, "fallback");
    } finally {
      setLoading(false);
    }
  };

  const pushHistory = (query: string, result: SolutionData, src: HistoryEntry["source"]) => {
    setHistory((prev) => {
      const entry: HistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        query,
        result,
        source: src,
      };
      const deduped = prev.filter((h) => h.query !== query);
      return [entry, ...deduped].slice(0, 6);
    });
  };

  const handleReplay = (entry: HistoryEntry) => {
    setInputQuery(entry.query);
    setSolution(entry.result);
    setSource(entry.source);
    setErrorMsg(null);
  };

  const handleGenerateRandomProblem = async () => {
    setGeneratingRandom(true);
    setShowSolution(false);
    setGeneratedProblem(null);

    const topicLabel = TOPICS_LIST.find((t) => t.id === selectedTopic)?.label || "matemáticas";
    const diffLabel = DIFFICULTY_LEVELS.find((d) => d.id === selectedDiff)?.label || "universitario";

    const promptText = `GENERA UN EJERCICIO DE PRÁCTICA UNIVERSITARIO NUEVO.
Tema: ${topicLabel}.
Dificultad: ${diffLabel}.
Redacta el enunciado completo en 'problemStatement', extrae la ecuación canónica en 'extractedFormula' y resuélvelo paso a paso con todos los detalles.`;

    try {
      const data = await resolveWithAI(promptText);
      if (data) setGeneratedProblem(data);
    } catch {
      // Error silencioso: el generador es opcional
    } finally {
      setGeneratingRandom(false);
    }
  };

  const sourceBadge = () => {
    if (source === "local")
      return { icon: <Cpu size={12} />, label: "Motor local determinista", color: "text-emerald-400" };
    if (source === "ai")
      return { icon: <Sparkles size={12} />, label: "Resuelto con IA", color: "text-amber-400" };
    if (source === "fallback")
      return { icon: <Wand2 size={12} />, label: "Interpretación general", color: "text-sky-400" };
    return null;
  };

  const badge = sourceBadge();

  return (
    <div className="h-full flex flex-col gap-6 min-h-0 overflow-y-auto custom-scrollbar">

      {/* 1. BARRA DE ENTRADA UNIVERSAL */}
      <div className="relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 shadow-2xl overflow-hidden shrink-0">
        <div className="pointer-events-none absolute -top-24 -left-24 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 w-60 h-60 bg-sky-500/10 rounded-full blur-3xl" />

        <div className="relative z-10 space-y-4 max-w-4xl mx-auto">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-sm">
                <Zap size={16} />
              </div>
              <div>
                <h3 className="text-base font-serif font-bold text-zinc-100 flex flex-wrap items-center gap-2">
                  Calculadora Universal
                  <span className="text-xs font-mono font-normal text-zinc-500">· resuelve todo, sin excepciones</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Escribe cualquier problema. Detectamos el método, lo resolvemos y te llevamos a su módulo.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsGeneratorOpen(true);
                if (!generatedProblem) handleGenerateRandomProblem();
              }}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300 text-xs font-mono flex items-center gap-2 transition-all shadow-lg shadow-amber-500/5 active:scale-95 shrink-0"
            >
              <Dices size={14} />
              <span className="hidden sm:inline">Reto Aleatorio</span>
            </button>
          </div>

          {/* Formulario Principal */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSolve();
            }}
            className="relative flex items-center gap-2"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ej: x^2 - 5x + 6 = 0   ·   deriva x^3 - 2x   ·   integral de 0 a 3 de x^2   ·   √3782"
              className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-2xl px-5 py-4 font-mono text-sm lg:text-base text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/20 transition-all shadow-inner"
            />

            <button
              type="submit"
              disabled={loading || !inputQuery.trim()}
              className="h-12 px-6 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 rounded-2xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-zinc-100/5 transition-all shrink-0 active:scale-95 disabled:opacity-40"
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Resolviendo...
                </>
              ) : (
                <>
                  <Sparkles size={15} className="text-amber-500" /> Resolver
                  <span className="ml-1 hidden sm:inline-flex items-center rounded-md border border-zinc-950/20 px-1.5 py-0.5 font-mono text-[9px] tracking-wider opacity-70">
                    <CornerDownLeft size={9} className="mr-0.5" /> ENTER
                  </span>
                </>
              )}
            </button>
          </form>

          {/* Sugerencias Rápidas */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1 text-xs">
            <span className="text-[11px] font-mono text-zinc-500 shrink-0">Probar:</span>
            {QUICK_PROMPTS.map((qp, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setInputQuery(qp.prompt);
                  handleSolve(qp.prompt);
                }}
                className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-zinc-300 text-[11px] font-mono transition-colors whitespace-nowrap flex items-center gap-1.5"
              >
                <span className="text-amber-400/90">[{qp.badge}]</span>
                <span className="truncate max-w-[200px]">{qp.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-950/30 border border-red-900/50 text-xs text-red-300 flex items-center justify-between gap-3">
          <span className="truncate">La IA no pudo intervenir: {errorMsg}. Se muestra una solución local.</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-200 shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* 2. RESULTADO PRINCIPAL */}
        <div className="xl:col-span-9 min-w-0">
          {solution ? (
            <div className="space-y-4">
              {badge && (
                <div className={`flex items-center gap-2 text-[11px] font-mono ${badge.color}`}>
                  {badge.icon}
                  <span>{badge.label}</span>
                  {solution.targetSubtopic && (
                    <span className="text-zinc-500">
                      · método: {KIND_LABELS[solution.targetSubtopic] || solution.targetSubtopic}
                    </span>
                  )}
                  {solution.targetModule !== "omni" && (
                    <span className="text-zinc-500">· solución dirigida a su módulo</span>
                  )}
                </div>
              )}
              <SolutionCard
                solution={solution}
                onLoadIntoCalculator={(expr) => setInputQuery(expr)}
                onNavigateToModule={(moduleId, subtopicId, expression, extraParams) =>
                  onNavigateToModule(
                    moduleId as CalcTargetModule,
                    subtopicId,
                    expression,
                    extraParams as { point?: string; side?: string } | undefined
                  )
                }
              />
            </div>
          ) : (
            <div className="border border-dashed border-zinc-800/80 rounded-3xl p-10 lg:p-14 flex flex-col items-center justify-center text-center bg-zinc-950/30 min-h-[320px]">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
                <Sparkles size={24} />
              </div>
              <h4 className="text-sm font-serif font-bold text-zinc-200">
                Escribe un problema y pulsa Resolver
              </h4>
              <p className="text-xs text-zinc-500 max-w-md mt-2 leading-relaxed">
                Detectamos automáticamente si es aritmética, ecuación, derivada, integral, límite, sistema o
                determinante. Los métodos sencillos se resuelven al instante y se abren en su módulo; el resto se
                resuelve aquí mismo.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-5 text-[11px] font-mono text-zinc-500">
                <span className="px-2.5 py-1 rounded-lg border border-zinc-800/80 bg-zinc-900/50">Motor local</span>
                <span className="px-2.5 py-1 rounded-lg border border-zinc-800/80 bg-zinc-900/50">IA de respaldo</span>
                <span className="px-2.5 py-1 rounded-lg border border-zinc-800/80 bg-zinc-900/50">Respuesta garantizada</span>
              </div>
            </div>
          )}
        </div>

        {/* 3. HISTORIAL DE CÁLCULOS */}
        <div className="xl:col-span-3 min-w-0">
          <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-5 shadow-xl shadow-black/20 h-full flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/60">
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                <History size={14} className="text-zinc-400" /> Historial
              </span>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={() => setHistory([])}
                  className="text-[11px] text-zinc-500 hover:text-red-400 flex items-center gap-1 transition-colors"
                >
                  <Trash2 size={12} /> Limpiar
                </button>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pt-3 space-y-2 custom-scrollbar">
              {history.length === 0 ? (
                <p className="text-[11px] text-zinc-600 font-sans leading-relaxed">
                  Tus últimos cálculos aparecerán aquí para reutilizarlos con un clic.
                </p>
              ) : (
                history.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => handleReplay(h)}
                    className="w-full text-left p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700 transition-colors"
                  >
                    <span className="block text-[11px] font-mono text-zinc-300 truncate">{h.query}</span>
                    <span className="block text-[11px] font-serif font-bold text-emerald-400 truncate mt-0.5">
                      {h.result.primaryResult}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. MODAL DEL GENERADOR DE RETOS */}
      <AnimatePresence>
        {isGeneratorOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-xl select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-3xl border border-zinc-800/80 bg-zinc-950/95 backdrop-blur-2xl rounded-3xl p-6 lg:p-8 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="pointer-events-none absolute -top-24 -right-24 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl" />

              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-sm">
                    <Dices size={16} />
                  </div>
                  <div>
                    <h3 className="text-base font-serif font-bold text-zinc-100">
                      Generador de Retos y Práctica
                    </h3>
                    <p className="text-xs text-zinc-400">Genera problemas nuevos para practicar o ponerte a prueba</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsGeneratorOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="py-4 border-b border-zinc-800/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedTopic}
                    onChange={(e) => setSelectedTopic(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-600 cursor-pointer"
                  >
                    {TOPICS_LIST.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedDiff}
                    onChange={(e) => setSelectedDiff(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-600 cursor-pointer"
                  >
                    {DIFFICULTY_LEVELS.map((d) => (
                      <option key={d.id} value={d.id}>
                        Dificultad: {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateRandomProblem}
                  disabled={generatingRandom}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-40"
                >
                  {generatingRandom ? (
                    <>
                      <Loader2 size={13} className="animate-spin" /> Creando reto...
                    </>
                  ) : (
                    <>
                      <Dices size={14} /> Generar Nuevo Reto
                    </>
                  )}
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-4 pr-1.5 custom-scrollbar">
                {generatingRandom ? (
                  <div className="p-16 flex flex-col items-center justify-center text-center space-y-3">
                    <Loader2 size={28} className="animate-spin text-amber-400" />
                    <p className="text-xs font-mono text-zinc-400">ReSolve AI formulando problema universitario...</p>
                  </div>
                ) : generatedProblem ? (
                  <div className="space-y-4">
                    <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-amber-400 uppercase tracking-wider font-semibold">
                          {generatedProblem.categoryName}
                        </span>
                        <span className="text-zinc-500">
                          {DIFFICULTY_LEVELS.find((d) => d.id === selectedDiff)?.label}
                        </span>
                      </div>

                      <div className="text-sm text-zinc-100 font-sans leading-relaxed pt-1">
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {generatedProblem.problemStatement || generatedProblem.explanation || ""}
                        </ReactMarkdown>
                      </div>

                      <div className="pt-2 text-xs font-mono text-zinc-400 border-t border-zinc-800/60">
                        Ecuación / Modelo:{" "}
                        <code className="text-emerald-400">{generatedProblem.extractedFormula}</code>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setShowSolution(!showSolution)}
                        className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-mono text-zinc-300 flex items-center gap-2 transition-colors"
                      >
                        {showSolution ? <EyeOff size={14} /> : <Eye size={14} className="text-emerald-400" />}
                        <span>{showSolution ? "Ocultar Solución" : "Revelar Solución y Pasos"}</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const formula = generatedProblem.extractedFormula;
                            setInputQuery(formula);
                            setIsGeneratorOpen(false);
                            handleSolve(formula);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-mono text-zinc-300 flex items-center gap-1.5 transition-colors"
                        >
                          <ArrowDownToLine size={13} /> Resolver aquí
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsGeneratorOpen(false);
                            setSolution(generatedProblem);
                            setSource("ai");
                          }}
                          className="px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                        >
                          <CheckCircle2 size={13} /> Ver en la calculadora
                        </button>
                      </div>
                    </div>

                    {showSolution && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="p-5 rounded-2xl bg-zinc-950 border border-emerald-900/40 space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">
                            Resultado Final
                          </span>
                          <span className="text-lg font-serif font-bold text-emerald-400">
                            {generatedProblem.primaryResult}
                          </span>
                        </div>

                        <div className="space-y-2.5 pt-2 border-t border-zinc-900">
                          <span className="text-[11px] font-mono text-zinc-400 font-semibold block">
                            Deducción Paso a Paso:
                          </span>
                          {generatedProblem.steps.map((st, i) => (
                            <div
                              key={i}
                              className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/60 text-xs space-y-1"
                            >
                              <span className="font-mono text-zinc-300 font-semibold block">{st.stage}</span>
                              <p className="text-zinc-400 text-[11px]">{st.description}</p>
                              {st.math && (
                                <div className="font-mono text-emerald-400 text-center font-bold text-xs pt-1 overflow-x-auto">
                                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                    {`\n$$\n${st.math.replace(/[\$]/g, "")}\n$$\n`}
                                  </ReactMarkdown>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <div className="p-12 text-center text-xs text-zinc-500">
                    Presiona «Generar Nuevo Reto» para formular un problema.
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
