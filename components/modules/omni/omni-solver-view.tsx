"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Zap,
  Copy,
  Check,
  Compass,
  Variable,
  Layers,
  ExternalLink,
  Loader2,
  X,
  Dices,
  Eye,
  EyeOff,
  ArrowDownToLine,
  RotateCcw,
  BookOpen
} from "lucide-react";
import MathGrapher from "@/components/shared/math-grapher";
import { adaptExpressionForModule } from "@/lib/math/module-adapters";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

// ============================================================
// UTILIDAD: Formateo seguro de LaTeX para KaTeX
// ============================================================
function safeFormatMath(content: string): string {
  if (!content) return "";
  let text = content;

  // 1. Envolver matrices (pmatrix, bmatrix) y sistemas (cases) que vengan sin $$
  text = text.replace(
    /(?:^|[^\$])(\\begin\{(?:pmatrix|bmatrix|matrix|cases|aligned)\}[\s\S]*?\\end\{(?:pmatrix|bmatrix|matrix|cases|aligned)\})/g,
    "\n\n$$\n$1\n$$\n\n"
  );

  // 2. Limpiar corchetes que rodean entornos LaTeX como [\begin{cases}...]
  text = text.replace(
    /\[\s*(\\begin\{(?:pmatrix|bmatrix|matrix|cases)\}[\s\S]*?\\end\{(?:pmatrix|bmatrix|matrix|cases)\})\s*\]/g,
    "\n\n$$\n$1\n$$\n\n"
  );

  // 3. Separar títulos pegados
  text = text.replace(/([^\n])\s*(#{1,4}\s+)/g, "$1\n\n$2");

  // 4. Convertir corchetes \[ ... \] a $$ ... $$
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, eq) => `\n\n$$\n${eq.trim()}\n$$\n\n`);
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, eq) => ` $${eq.trim()}$ `);
  text = text.replace(/\\boxed\{([^}]+)\}/g, (_, val) => `\n\n$$\\mathbf{${val.trim()}}$$\n\n`);

  // 5. Cerrar $$ si quedaron impares
  const displayMathCount = (text.match(/\$\$/g) || []).length;
  if (displayMathCount % 2 !== 0) {
    text += "\n$$\n";
  }

  text = text.replace(/\n{3,}/g, "\n\n");
  return text;
}

export interface OmniStep {
  stage: string;
  description: string;
  math: string;
}

export interface OmniSolveResponse {
  targetModule: string;
  targetSubtopic: string;
  categoryName: string;
  problemStatement?: string;
  extractedFormula: string;
  limitPoint?: string | null;
  limitSide?: "both" | "left" | "right" | null;
  primaryResult: string;
  steps: OmniStep[];
  graphableExpression: string | null;
  explanation: string;
}

interface OmniSolverViewProps {
  onNavigateToModule: (
    moduleId: any,
    subtopicId: string,
    expression: string,
    extraParams?: { point?: string; side?: string }
  ) => void;
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

export default function OmniSolverView({ onNavigateToModule }: OmniSolverViewProps) {
  const [inputQuery, setInputQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [solution, setSolution] = useState<OmniSolveResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // --- Estados del Generador de Problemas Aleatorios ---
  const [isGeneratorOpen, setIsGeneratorOpen] = useState<boolean>(false);
  const [selectedTopic, setSelectedTopic] = useState<string>("random");
  const [selectedDiff, setSelectedDiff] = useState<string>("intermedio");
  const [generatingRandom, setGeneratingRandom] = useState<boolean>(false);
  const [generatedProblem, setGeneratedProblem] = useState<OmniSolveResponse | null>(null);
  const [showSolution, setShowSolution] = useState<boolean>(false);

  const handleSolve = async (queryText?: string) => {
    const text = (queryText || inputQuery).trim();
    if (!text || loading) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/ai/omni-solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "No se pudo interpretar el problema.");
      }

      setSolution(data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error al procesar el ejercicio.");
    } finally {
      setLoading(false);
    }
  };

  // Generar Problema Aleatorio vía IA
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
      const res = await fetch("/api/ai/omni-solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText }),
      });

      const data = await res.json();
      if (res.ok && !data.error) {
        setGeneratedProblem(data);
      }
    } catch {
      // Error silencioso
    } finally {
      setGeneratingRandom(false);
    }
  };

  const handleCopy = (textToCopy?: string) => {
    const txt = textToCopy || solution?.primaryResult;
    if (!txt) return;
    navigator.clipboard.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleRedirect = (targetSol?: OmniSolveResponse) => {
    const sol = targetSol || solution;
    if (!sol) return;

    const adapted = adaptExpressionForModule(
      sol.targetSubtopic,
      sol.extractedFormula,
      {
        point: sol.limitPoint || undefined,
        side: sol.limitSide || undefined,
      }
    );

    onNavigateToModule(
      sol.targetModule,
      sol.targetSubtopic,
      adapted.expression,
      adapted.queryParams
    );
  };

  const QUICK_PROMPTS = [
    { title: "Límite al Infinito", prompt: "Calcula el límite al infinito de (3x^2 + 5) / (2x^2 - x)", badge: "Límites" },
    { title: "Raíz Cuadrada Aritmética", prompt: "Calcula √3782 con aproximación", badge: "Aritmética" },
    { title: "Geometría (2 Puntos)", prompt: "Halla la distancia y la recta entre los puntos (2, 3) y (6, 7)", badge: "Geometría" },
    { title: "Polinomio de Raíces", prompt: "Sabiendo que x=2 y x=1 son raíces de P(x) = x^4 - ax^3 + bx^2 - 12x + 8, determina a y b y factoriza.", badge: "Álgebra" },
    { title: "Problema Razonado", prompt: "Un proyectil se lanza con h(t) = -5t^2 + 20t + 25 = 0. Halla el tiempo de impacto.", badge: "Física" },
  ];

  return (
    <div className="h-full flex flex-col gap-6 min-h-0 overflow-y-auto custom-scrollbar select-none">
      
      {/* 1. BARRA DE ENTRADA OMNICANALE */}
      <div className="relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 shadow-2xl overflow-hidden shrink-0">
        <div className="pointer-events-none absolute -top-24 -left-24 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 w-60 h-60 bg-sky-500/10 rounded-full blur-3xl" />

        <div className="relative z-10 space-y-4 max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-sm">
                <Zap size={16} />
              </div>
              <div>
                <h3 className="text-base font-serif font-bold text-zinc-100 flex items-center gap-2">
                  ReSolve Omni-Solver <span className="text-xs font-mono font-normal text-zinc-500">· Motor Photomath Universal</span>
                </h3>
                <p className="text-xs text-zinc-400">Escribe o pega cualquier problema, o genera ejercicios de práctica con un clic</p>
              </div>
            </div>

            {/* BOTÓN DEL GENERADOR DE PROBLEMAS ALEATORIOS */}
            <button
              type="button"
              onClick={() => {
                setIsGeneratorOpen(true);
                if (!generatedProblem) handleGenerateRandomProblem();
              }}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300 text-xs font-mono flex items-center gap-2 transition-all shadow-lg shadow-amber-500/5 active:scale-95"
            >
              <Dices size={14} className="animate-spin-slow" />
              <span>Reto Aleatorio</span>
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
              placeholder="Ej: límite de (3x^2+5)/(2x^2-x) en inf   o   √3782   o   recta entre (2,3) y (6,7)"
              className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-2xl px-5 py-4 font-mono text-sm lg:text-base text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/20 transition-all shadow-inner"
            />

            <button
              type="submit"
              disabled={loading || !inputQuery.trim()}
              className="h-12 px-6 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 rounded-2xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-zinc-100/5 transition-all shrink-0 active:scale-95 disabled:opacity-40"
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Analizando...
                </>
              ) : (
                <>
                  <Sparkles size={15} className="text-amber-500" /> Resolver Todo
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
        <div className="p-4 rounded-2xl bg-red-950/30 border border-red-900/50 text-xs text-red-300 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-200">
            <X size={14} />
          </button>
        </div>
      )}

      {/* 2. RESULTADOS DINÁMICOS */}
      {solution && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-amber-400 font-semibold flex items-center gap-2">
                    <Variable size={13} />
                    {solution.categoryName}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleCopy()}
                    className="text-xs text-zinc-400 hover:text-zinc-100 flex items-center gap-1.5 transition-colors py-1 px-2.5 rounded-lg border border-zinc-800/60 bg-zinc-900/50"
                  >
                    {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                </div>

                <p className="text-xs text-zinc-400 mb-4 font-sans leading-relaxed">
                  {solution.explanation}
                </p>

                <div className="p-6 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-center my-3 shadow-inner">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-1">
                    Resultado Extraído
                  </span>
                  <div className="text-3xl lg:text-4xl font-serif font-bold text-emerald-400 tracking-tight">
                    {solution.primaryResult}
                  </div>
                  <div className="text-[11px] font-mono text-zinc-400 mt-2 truncate">
                    Fórmula Canónica: <code className="text-zinc-200">{solution.extractedFormula}</code>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800/60 mt-4">
                <button
                  type="button"
                  onClick={() => handleRedirect()}
                  className="w-full py-3.5 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-zinc-100/5 transition-all active:scale-95"
                >
                  <ExternalLink size={14} />
                  <span>Abrir en módulo de {solution.categoryName} con solución precargada</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-6 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-2">
                  <Compass size={14} className="text-zinc-500" />
                  Representación Visual
                </span>
                <span className="text-[10px] font-mono text-zinc-500">60 FPS Canvas</span>
              </div>

              <div className="flex-1 min-h-[280px]">
                {solution.graphableExpression ? (
                  <MathGrapher
                    expression={solution.graphableExpression}
                    height="h-[280px]"
                    initialScale={40}
                  />
                ) : (
                  <div className="h-full min-h-[280px] border border-dashed border-zinc-800/80 rounded-2xl flex flex-col items-center justify-center p-6 text-center bg-zinc-950/40">
                    <Layers size={28} className="text-zinc-600 mb-2" />
                    <h4 className="text-xs font-mono font-semibold text-zinc-300">Resolución Analítica Directa</h4>
                    <p className="text-[11px] text-zinc-500 max-w-xs mt-1">
                      Este problema no requiere un trazo en curva 2D, pero puedes consultar los pasos completos a continuación.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pasos KaTeX */}
          <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 shadow-xl shadow-black/20">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 mb-4">
              <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                <Sparkles size={15} className="text-amber-400" /> Procedimiento Paso a Paso Deductivo
              </span>
              <span className="text-[10px] font-mono text-zinc-400 bg-zinc-950 border border-zinc-800 px-3 py-1 rounded-full">
                {solution.steps.length} Pasos
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {solution.steps.map((st, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700/80 transition-all flex flex-col justify-between gap-2.5"
                >
                  <div>
                    <span className="text-xs font-mono font-semibold text-zinc-200 flex items-center gap-2 mb-1">
                      <span className="w-5 h-5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      {st.stage}
                    </span>
                    <p className="text-xs text-zinc-400 font-sans leading-relaxed">{st.description}</p>
                  </div>

                  {st.math && (
                    <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-emerald-400 text-center font-bold overflow-x-auto text-xs">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {`$$${st.math.replace(/[\$]/g, "")}$$`}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* =======================================================================
          3. MODAL DEL GENERADOR DE RETOS Y PROBLEMAS ALEATORIOS
      ======================================================================== */}
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

              {/* Cabecera del Generador */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-sm">
                    <Dices size={16} />
                  </div>
                  <div>
                    <h3 className="text-base font-serif font-bold text-zinc-100 flex items-center gap-2">
                      Generador de Retos y Práctica Universitaria
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

              {/* Filtros de Generación */}
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

              {/* Contenido del Problema Generado */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-4 pr-1.5 custom-scrollbar">
                {generatingRandom ? (
                  <div className="p-16 flex flex-col items-center justify-center text-center space-y-3">
                    <Loader2 size={28} className="animate-spin text-amber-400" />
                    <p className="text-xs font-mono text-zinc-400">ReSolve AI formulando problema universitario...</p>
                  </div>
                ) : generatedProblem ? (
                  <div className="space-y-4">
                    {/* Tarjeta del Enunciado */}
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
                          {generatedProblem.problemStatement || generatedProblem.explanation}
                        </ReactMarkdown>
                      </div>

                      <div className="pt-2 text-xs font-mono text-zinc-400 border-t border-zinc-800/60">
                        Ecuación / Modelo: <code className="text-emerald-400">{generatedProblem.extractedFormula}</code>
                      </div>
                    </div>

                    {/* Botón Revelar Solución */}
                    <div className="flex items-center justify-between gap-2 pt-1">
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
                            setInputQuery(generatedProblem.extractedFormula);
                            setIsGeneratorOpen(false);
                            handleSolve(generatedProblem.extractedFormula);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-mono text-zinc-300 flex items-center gap-1.5 transition-colors"
                        >
                          <ArrowDownToLine size={13} /> Cargar en Consola
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsGeneratorOpen(false);
                            handleRedirect(generatedProblem);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                        >
                          <ExternalLink size={13} /> Abrir en su Módulo
                        </button>
                      </div>
                    </div>

                    {/* Solución Ocultable / Revelable */}
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
                            <div key={i} className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/60 text-xs space-y-1">
                              <span className="font-mono text-zinc-300 font-semibold block">{st.stage}</span>
                              <p className="text-zinc-400 text-[11px]">{st.description}</p>
                              {st.math && (
                                <div className="font-mono text-emerald-400 text-center font-bold text-xs pt-1">
                                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                    {`$$${st.math.replace(/[\$]/g, "")}$$`}
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
                    Presiona "Generar Nuevo Reto" para formular un problema.
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