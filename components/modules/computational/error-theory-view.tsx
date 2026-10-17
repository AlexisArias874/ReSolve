"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  Check,
  History,
  Trash2,
  CornerDownLeft,
  BookOpen,
  ListOrdered,
  Sparkles,
  HelpCircle,
  X,
  Terminal,
  ChevronRight,
  Info,
  TrendingUp,
  Cpu,
  Sliders,
  Scale,
  Percent,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ShieldCheck,
  PanelRightClose,
} from "lucide-react";
import { useHistoryVisibility } from "@/lib/hooks/use-history-visibility";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useAIContext } from "@/lib/context/ai-context";
import {
  fetchUserHistory,
  saveUserCalculation,
  deleteUserHistory,
  type HistoryItem,
} from "@/lib/supabase/history";

// -----------------------------------------------------------------------------
// TIPOS Y CATÁLOGO DE EJEMPLOS A NIVEL SUPERIOR TS
// -----------------------------------------------------------------------------
interface ModuleExample {
  category: string;
  exactExpr: string;
  approxExpr: string;
  decimals: number;
  desc: string;
}

const MODULE_EXAMPLES: ModuleExample[] = [
  {
    category: "Aproximación Histórica de Pi (22/7)",
    exactExpr: "pi",
    approxExpr: "22/7",
    decimals: 4,
    desc: "Aproximación de Arquímedes con error relativo menor al 0.05%.",
  },
  {
    category: "Fracción Periódica (1/3)",
    exactExpr: "1/3",
    approxExpr: "0.3333",
    decimals: 4,
    desc: "Demostración de error de truncamiento en números con periodo infinito.",
  },
  {
    category: "Raíz Irracional de 2 (√2)",
    exactExpr: "sqrt(2)",
    approxExpr: "1.414",
    decimals: 3,
    desc: "Aproximación clásica a 3 cifras decimales con cálculo de cifras significativas.",
  },
  {
    category: "Cancelación Catastrófica (Resta Crítica)",
    exactExpr: "1000.005 - 1000",
    approxExpr: "0.005",
    decimals: 6,
    desc: "Pérdida severa de dígitos de precisión al restar números casi idénticos.",
  },
  {
    category: "Número e de Euler",
    exactExpr: "e",
    approxExpr: "2.718",
    decimals: 3,
    desc: "Comparativa entre la constante trascendente e y su valor redondeado.",
  },
  {
    category: "Épsilon de Máquina (Float32 vs Float64)",
    exactExpr: "1 + 2.22e-16",
    approxExpr: "1",
    decimals: 8,
    desc: "Límite teórico de resolución del estándar IEEE-754 en coma flotante.",
  },
];

// Evaluador matemático seguro
function parseMathValue(expr: string): number {
  try {
    let s = expr.toLowerCase().replace(/\s+/g, "");
    if (!s) return NaN;
    s = s.replace(/pi/g, "Math.PI");
    s = s.replace(/\be\b/g, "Math.E");
    s = s.replace(/sqrt\(([^()]+)\)/g, "Math.sqrt($1)");
    s = s.replace(/sqrt([0-9.]+)/g, "Math.sqrt($1)");
    s = s.replace(/\^/g, "**");

    // eslint-disable-next-line no-new-func
    const fn = new Function(`"use strict"; return (${s});`);
    const val = fn();
    return typeof val === "number" && !isNaN(val) && isFinite(val) ? val : NaN;
  } catch {
    return NaN;
  }
}

export default function ErrorTheoryView({
  viewMode,
  initialExpression = "",
}: {
  viewMode: "calc" | "steps" | "theory";
  initialExpression?: string;
}) {
  const [exactInput, setExactInput] = useState<string>("pi");
  const { isHistoryHidden, setIsHistoryHidden } = useHistoryVisibility();
  const [approxInput, setApproxInput] = useState<string>("22/7");
  const [targetDecimals, setTargetDecimals] = useState<number>(4);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMethodInfoOpen, setIsMethodInfoOpen] = useState(false);

  const { setAIContext, injectedExpression, clearInjectedExpression } = useAIContext();

  // ---------------------------------------------------------------------------
  // MOTOR MATEMÁTICO DE TEORÍA DE ERRORES Y SCARBOROUGH
  // ---------------------------------------------------------------------------
  const calculation = useMemo(() => {
    const vExact = parseMathValue(exactInput);
    const vApprox = parseMathValue(approxInput);

    if (isNaN(vExact) || isNaN(vApprox)) {
      return {
        vExact: null,
        vApprox: null,
        absError: null,
        relError: null,
        pctError: null,
        sigDigits: 0,
        truncVal: null,
        roundVal: null,
        truncError: null,
        roundError: null,
        isCatastrophic: false,
        steps: [],
        error: "Introduce expresiones numéricas válidas para el valor verdadero y aproximado.",
      };
    }

    // 1. Error Absoluto Ea = |Vv - Va|
    const absError = Math.abs(vExact - vApprox);

    // 2. Error Relativo er = Ea / |Vv|
    const relError = Math.abs(vExact) > 1e-15 ? absError / Math.abs(vExact) : absError;

    // 3. Error Porcentual εp = er * 100%
    const pctError = relError * 100;

    // 4. Criterio de Scarborough para Cifras Significativas garantizadas
    // εp <= 0.5 * 10^(2 - n) %  ==>  n <= 2 - log10(εp / 0.5)
    let sigDigits = 0;
    if (pctError > 0) {
      const nCalc = Math.floor(2 - Math.log10(pctError / 0.5));
      sigDigits = Math.max(0, Math.min(16, nCalc));
    } else if (pctError === 0) {
      sigDigits = 16;
    }

    // 5. Comparativa Truncamiento vs Redondeo
    const factor = Math.pow(10, targetDecimals);
    const truncVal = Math.trunc(vExact * factor) / factor;
    const roundVal = Math.round(vExact * factor) / factor;

    const truncError = Math.abs(vExact - truncVal);
    const roundError = Math.abs(vExact - roundVal);

    // 6. Detección de Cancelación Catastrófica (Diferencia de números muy cercanos)
    const isCatastrophic = Math.abs(vExact) < 0.001 && absError > 0 && absError / Math.abs(vExact) > 0.05;

    const steps: { stage: string; desc: string; math: string }[] = [];
    let stepId = 1;

    steps.push({
      stage: `${stepId++}. Identificación de Valores Base`,
      desc: "Evaluamos las expresiones dadas con precisión flotante doble (IEEE-754)",
      math: `V_v (\\text{Valor Verdadero}) = ${vExact}\nV_a (\\text{Valor Aproximado}) = ${vApprox}`,
    });

    steps.push({
      stage: `${stepId++}. Error Absoluto (Eₐ)`,
      desc: "Magnitud escalar de la diferencia entre el valor exacto y el valor aproximado",
      math: `E_a = |V_v - V_a| = |${vExact} - (${vApprox})| = ${Number(absError.toPrecision(6))}`,
    });

    steps.push({
      stage: `${stepId++}. Error Relativo (eᵣ)`,
      desc: "Medida normalizada adimensional del error respecto a la magnitud real del número",
      math: `e_r = \\frac{|V_v - V_a|}{|V_v|} = \\frac{${Number(absError.toPrecision(5))}}{|${vExact}|} = ${Number(relError.toPrecision(6))}`,
    });

    steps.push({
      stage: `${stepId++}. Error Relativo Porcentual (εₚ)`,
      desc: "Porcentaje de desviación respecto a la referencia exacta",
      math: `\\varepsilon_p = e_r \\times 100\\% = ${Number(pctError.toPrecision(5))}\\%`,
    });

    steps.push({
      stage: `${stepId++}. Criterio de Scarborough (Cifras Significativas)`,
      desc: "Número de cifras decimales garantizadas sin alteración por redondeo: εₚ ≤ 0.5 × 10²⁻ⁿ%",
      math: `n = \\lfloor 2 - \\log_{10}\\left(\\frac{\\varepsilon_p}{0.5}\\right) \\rfloor \\Longrightarrow ${sigDigits} \\text{ cifras significativas}`,
    });

    return {
      vExact,
      vApprox,
      absError: Number(absError.toPrecision(6)),
      relError: Number(relError.toPrecision(6)),
      pctError: Number(pctError.toPrecision(5)),
      sigDigits,
      truncVal,
      roundVal,
      truncError: Number(truncError.toPrecision(5)),
      roundError: Number(roundError.toPrecision(5)),
      isCatastrophic,
      steps,
    };
  }, [exactInput, approxInput, targetDecimals]);

  // Sincronización con ReSolve AI
  useEffect(() => {
    const summary = `Vv = ${calculation.vExact} | Va = ${calculation.vApprox} | Ea = ${calculation.absError} | er = ${calculation.relError} | εp = ${calculation.pctError}% | Cifras: ${calculation.sigDigits}`;
    setAIContext({
      module: "Matemáticas IV",
      subtopic: "Teoría de Errores",
      expression: `${exactInput} vs ${approxInput}`,
      result: `εp = ${calculation.pctError}% (Cifras: ${calculation.sigDigits})`,
      details: summary,
    });
  }, [calculation, exactInput, approxInput, setAIContext]);

  // Inyección inversa
  useEffect(() => {
    if (injectedExpression) {
      if (injectedExpression.includes("vs")) {
        const parts = injectedExpression.split("vs");
        setExactInput(parts[0].trim());
        setApproxInput(parts[1].trim());
      } else {
        setExactInput(injectedExpression);
      }
      clearInjectedExpression();
    }
  }, [injectedExpression, clearInjectedExpression]);

  // Carga de historial de Supabase
  useEffect(() => {
    fetchUserHistory("mat4", "errores").then((data: HistoryItem[]) => setHistory(data));
  }, []);

  const saveCalculation = async () => {
    if (calculation.absError === null) return;
    const title = `Error: ${exactInput} vs ${approxInput}`;
    const resSummary = `Ea=${calculation.absError}, εp=${calculation.pctError}%, ${calculation.sigDigits} cifras`;
    await saveUserCalculation("mat4", "errores", title, resSummary);
    const refreshed = await fetchUserHistory("mat4", "errores");
    setHistory(refreshed);
  };

  const clearHistory = async () => {
    await deleteUserHistory("errores");
    setHistory([]);
  };

  const handleCopy = () => {
    if (calculation.pctError === null) return;
    navigator.clipboard.writeText(`${calculation.pctError}%`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Escape cierra los modales de información y de casos de estudio
  useEffect(() => {
    if (!isMethodInfoOpen && !isHelpOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMethodInfoOpen(false);
        setIsHelpOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMethodInfoOpen, isHelpOpen]);

  return (
    <div className="h-full flex flex-col gap-6 min-h-0 relative">
      {viewMode === "calc" && (
        <div className="flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto custom-scrollbar pr-1">
          
          {/* FILA SUPERIOR: CONSOLA Y RESULTADOS DE ERROR */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 shrink-0">
            
            {/* Consola de Entrada */}
            <div className="lg:col-span-8 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden">
              <div className="pointer-events-none absolute -top-20 -left-20 w-56 h-56 bg-zinc-700/10 rounded-full blur-3xl" />

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-2">
                    <Percent size={13} className="text-zinc-500" />
                    Consola de Precisión y Teoría de Errores
                  </span>

                  <button
                    type="button"
                    onClick={() => setIsHelpOpen(true)}
                    aria-label="Abrir casos de estudio"
                    className="px-3 py-1.5 rounded-lg bg-zinc-950/60 border border-zinc-800/60 hover:bg-zinc-800/60 text-[11px] font-mono text-zinc-300 transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <HelpCircle size={13} className="text-amber-400" />
                    <span>Casos de Estudio</span>
                  </button>
                </div>

                {/* Inputs de Valor Verdadero y Aproximado */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 space-y-1">
                    <label htmlFor="error-exact-input" className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
                      Valor Verdadero / Exacto (Vᵥ):
                    </label>
                    <input
                      id="error-exact-input"
                      type="text"
                      value={exactInput}
                      onChange={(e) => setExactInput(e.target.value)}
                      aria-label="Valor verdadero o exacto"
                      placeholder="Ej: pi, sqrt(2), 1/3, e"
                      className="w-full bg-transparent font-mono text-base text-zinc-100 outline-none font-bold"
                    />
                    <span className="text-[11px] font-mono text-zinc-500 block truncate">
                      = {calculation.vExact !== null ? calculation.vExact : "--"}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 space-y-1">
                    <label htmlFor="error-approx-input" className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
                      Valor Aproximado (Vₐ):
                    </label>
                    <input
                      id="error-approx-input"
                      type="text"
                      value={approxInput}
                      onChange={(e) => setApproxInput(e.target.value)}
                      aria-label="Valor aproximado"
                      placeholder="Ej: 3.1416, 22/7, 1.414"
                      className="w-full bg-transparent font-mono text-base text-zinc-100 outline-none font-bold"
                    />
                    <span className="text-[11px] font-mono text-zinc-500 block truncate">
                      = {calculation.vApprox !== null ? calculation.vApprox : "--"}
                    </span>
                  </div>
                </div>

                {/* Simulador Truncamiento vs Redondeo a 'k' decimales */}
                <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                    <span className="flex items-center gap-1.5 text-zinc-300 font-semibold">
                      <Sliders size={13} className="text-amber-400" /> Comparativa: Redondeo vs Truncamiento
                    </span>
                    <span>k = {targetDecimals} decimales</span>
                  </div>

                  <input
                    id="error-decimals-range"
                    type="range"
                    min="1"
                    max="8"
                    step="1"
                    value={targetDecimals}
                    onChange={(e) => setTargetDecimals(parseInt(e.target.value, 10))}
                    aria-label="Número de decimales para comparar redondeo y truncamiento"
                    className="w-full accent-amber-400 cursor-pointer"
                  />

                  <div className="grid grid-cols-2 gap-2.5 text-xs font-mono pt-1">
                    <div className="p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800/60">
                      <span className="text-[10px] text-zinc-500 block">Truncamiento (Chop)</span>
                      <strong className="text-zinc-200 block text-sm">{calculation.truncVal}</strong>
                      <span className="text-[10px] text-red-400 block mt-0.5">Eₐ = {calculation.truncError}</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800/60">
                      <span className="text-[10px] text-zinc-500 block">Redondeo Simétrico</span>
                      <strong className="text-emerald-400 block text-sm">{calculation.roundVal}</strong>
                      <span className="text-[10px] text-emerald-400/90 block mt-0.5">Eₐ = {calculation.roundError}</span>
                    </div>
                  </div>
                </div>

                {/* Alerta de Cancelación Catastrófica si ocurre */}
                {calculation.isCatastrophic && (
                  <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/40 text-xs text-amber-300 flex items-center gap-2">
                    <Flame size={15} className="text-amber-400 shrink-0" />
                    <span><strong>Peligro de Cancelación Catastrófica:</strong> Se restaron valores casi idénticos provocando una pérdida de cifras significativas.</span>
                  </div>
                )}
              </div>

              {/* Botón Guardar */}
              <div className="relative z-10 mt-5 pt-4 border-t border-zinc-800/60 flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-500">
                  Respaldo automático en Supabase
                </span>
                <button
                  type="button"
                  onClick={saveCalculation}
                  className="h-11 px-6 bg-zinc-100 text-zinc-950 rounded-xl text-xs font-semibold hover:bg-zinc-200 hover:scale-[1.02] transition-all flex items-center gap-2 shadow-lg shadow-zinc-100/5 active:scale-95"
                >
                  <CornerDownLeft size={14} /> Guardar Análisis
                </button>
              </div>
            </div>

            {/* Caja Derecha: Error Porcentual y Cifras Significativas */}
            <div className="lg:col-span-4 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden">
              <div className="pointer-events-none absolute -top-20 -left-20 w-56 h-56 bg-zinc-700/10 rounded-full blur-3xl" />

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold">
                    Error Relativo Porcentual
                  </span>
                  {calculation.pctError !== null && (
                    <button
                      type="button"
                      onClick={handleCopy}
                      aria-label="Copiar error porcentual"
                      className="text-[11px] font-mono text-zinc-400 hover:text-zinc-100 flex items-center gap-1.5 transition-colors py-1 px-2.5 rounded-lg border border-zinc-800/60 bg-zinc-950/60 hover:bg-zinc-800/60"
                    >
                      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      {copied ? "Copiado" : "Copiar"}
                    </button>
                  )}
                </div>

                <div className="py-6 text-center">
                  <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-zinc-500 block mb-2">
                    Desviación Porcentual (εₚ)
                  </span>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={calculation.pctError}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      transition={{ duration: 0.2 }}
                      className={`text-5xl lg:text-7xl font-serif font-bold tracking-tight transition-colors ${
                        calculation.pctError === null ? "text-zinc-600" : "text-zinc-100"
                      }`}
                    >
                      {calculation.pctError !== null ? `${calculation.pctError}%` : "--"}
                    </motion.div>
                  </AnimatePresence>
                  <span className="text-[11px] font-mono text-zinc-400 mt-3 block">
                    Cifras Significativas: <strong className="text-amber-400 font-bold">{calculation.sigDigits} dígitos exactos</strong>
                  </span>
                </div>

                {/* Métricas Clave de Error */}
                <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 block">Error Absoluto (Eₐ)</span>
                    <strong className="text-zinc-200">{calculation.absError !== null ? calculation.absError : "--"}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 block">Error Relativo (eᵣ)</span>
                    <strong className="text-zinc-200">{calculation.relError !== null ? calculation.relError : "--"}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 block">Criterio Scarborough</span>
                    <strong className="text-emerald-400">{calculation.sigDigits} cifras</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 block">Tolerancia Implícita</span>
                    <strong className="text-zinc-400">εₛ ≈ 0.5×10⁻ⁿ</strong>
                  </div>
                </div>
              </div>

              {/* Insignia de Información */}
              <div className="relative z-10 border-t border-zinc-800/60 pt-3.5">
                <button
                  type="button"
                  onClick={() => setIsMethodInfoOpen(!isMethodInfoOpen)}
                  className="w-full p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/70 hover:border-zinc-700 flex items-center justify-between text-[11px] font-mono transition-colors group"
                >
                  <div className="flex items-center gap-1.5 text-zinc-400 group-hover:text-zinc-200 truncate">
                    <Info size={12} className="text-amber-400 shrink-0" />
                    <span>Estándar IEEE-754 y Épsilon</span>
                  </div>
                  <ChevronRight size={12} className="text-zinc-600 group-hover:text-zinc-300 shrink-0" />
                </button>
              </div>
            </div>
          </div>

          {/* FILA INFERIOR: DESGLOSE PASO A PASO + HISTORIAL */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[640px]">
            
            {/* Panel Izquierdo: Pasos Analíticos */}
            <div className={`${isHistoryHidden ? "lg:col-span-12" : "lg:col-span-8"} border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20 overflow-hidden`}>
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <ListOrdered size={15} className="text-zinc-400" /> Procedimiento Analítico de Teoría de Errores
                </span>
                <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-zinc-500 bg-zinc-950/60 border border-zinc-800/60 px-2.5 py-1 rounded-full">
                  Scarborough n = {calculation.sigDigits}
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto pt-4 pr-2">
                {calculation.steps.map((st, idx) => (
                  <div key={idx} className="relative pl-11 pb-4 last:pb-0">
                    <span
                      className="absolute left-0 top-0 w-7 h-7 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300 flex items-center justify-center text-xs font-mono font-bold shadow-inner"
                      aria-hidden="true"
                    >
                      {idx + 1}
                    </span>
                    {idx < calculation.steps.length - 1 && (
                      <span
                        className="absolute left-[13px] top-9 bottom-0 w-px bg-zinc-800/70"
                        aria-hidden="true"
                      />
                    )}
                    <div className="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700/80 transition-colors flex flex-col gap-2">
                      <span className="text-xs font-mono font-semibold text-zinc-200">
                        {st.stage.replace(/^\d+\.\s*/, "")}
                      </span>
                      <p className="text-[11px] text-zinc-400 font-sans">{st.desc}</p>
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

            {/* Panel Derecho: Historial */}
            {isHistoryHidden ? null : (

            <div className="lg:col-span-4 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20 overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <History size={15} className="text-zinc-400" /> Historial de Precisión
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
                    type="button"
                    onClick={() => void clearHistory()}
                    title="Vaciar historial"
                    className="text-[11px] text-zinc-500 hover:text-red-400 flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 size={13} /> Limpiar
                  </button>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto pt-4 pr-1 space-y-2">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-6">
                    <span className="w-11 h-11 rounded-xl bg-zinc-900/50 border border-zinc-800/60 flex items-center justify-center">
                      <History size={18} className="text-zinc-600" />
                    </span>
                    <p className="text-sm text-zinc-300 font-medium">Sin análisis de error guardados</p>
                    <p className="text-[11px] text-zinc-500">Guarda comparaciones para auditar precisión</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      title={item.expression}
                      className="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700 hover:bg-zinc-800/60 cursor-default transition-colors flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="truncate pr-2 font-mono text-zinc-300">
                        {item.expression}
                      </div>
                      <div className="font-mono font-bold text-emerald-400 shrink-0 text-[11px] truncate max-w-[110px]">
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

      {/* MODO 2: PASO A PASO EXPANDIDO */}
      {viewMode === "steps" && (
        <div className="relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col min-h-0 shadow-xl shadow-black/20 overflow-hidden">
          <div className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 bg-zinc-700/10 rounded-full blur-3xl" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-800/60 shrink-0">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800/80 bg-zinc-900/60 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 mb-2.5">
                <ListOrdered size={12} /> Procedimiento
              </div>
              <h3 className="text-xl lg:text-2xl font-serif font-bold text-zinc-100">
                Procedimiento Detallado de Propagación y Cifras
              </h3>
              <p className="text-xs text-zinc-400 mt-1.5 font-mono truncate">
                {exactInput} vs {approxInput} | Error porcentual: {calculation.pctError}%
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 shadow-inner">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Cifras</span>
              <span className="text-sm font-serif font-bold text-emerald-400">{calculation.sigDigits} dígitos</span>
            </div>
          </div>

          <div className="relative z-10 flex-1 min-h-0 overflow-y-auto pt-6 pr-2">
            {calculation.steps.map((st, i) => (
              <div key={i} className="relative pl-13 pb-5 last:pb-0">
                <span
                  className="absolute left-0 top-0 w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300 flex items-center justify-center text-xs font-mono font-bold shadow-inner"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                {i < calculation.steps.length - 1 && (
                  <span
                    className="absolute left-[15px] top-10 bottom-0 w-px bg-zinc-800/70"
                    aria-hidden="true"
                  />
                )}
                <div className="p-4 lg:p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700/80 transition-colors flex flex-col gap-2.5">
                  <span className="text-sm font-semibold text-zinc-200 font-mono">
                    {st.stage.replace(/^\d+\.\s*/, "")}
                  </span>
                  <p className="text-xs text-zinc-300 font-sans leading-relaxed">{st.desc}</p>
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 font-mono text-xs text-emerald-400 text-center font-bold whitespace-pre-line">
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

      {/* MODO 3: TEORÍA */}
      {viewMode === "theory" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto shadow-xl shadow-black/20 custom-scrollbar">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800/80 bg-zinc-900/60 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 mb-3">
              <BookOpen size={12} /> Aritmética Computacional y Análisis de Error
            </div>
            <h3 className="text-2xl lg:text-3xl font-serif font-bold text-zinc-100">
              Precisión de Punto Flotante y Estabilidad Numérica
            </h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-3xl">
              Dado que las computadoras operan con registros de memoria finitos (32 o 64 bits), no pueden almacenar números reales continuos. Toda operación computacional introduce pequeñas discrepancias acumulativas de redondeo y truncamiento.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                1. Estándar IEEE-754 y Representación
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Los números se descomponen en Signo, Exponente sesgado y Mantisa fraccionaria. En doble precisión (float64), el épsilon de la máquina es aproximadamente 2.22 × 10⁻¹⁶ (~16 decimales significativos).
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                2. Cancelación Catastrófica (Sustracción)
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Al restar dos números casi idénticos (ej: 1000.005 - 1000), los dígitos principales se anulan dejando únicamente los bits ruidosos menos significativos, destruyendo la exactitud del algoritmo.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                3. Propagación de Errores
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                En sumas y restas se suman los errores absolutos. En multiplicaciones y divisiones se suman los errores relativos. Si un problema está mal condicionado, el error crece exponencialmente.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                4. Criterio de Scarborough
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Garantiza que al alcanzar una tolerancia εₛ = 0.5 × 10^(2-n)%, el resultado iterativo es correcto hasta al menos n cifras significativas exactas.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE INFORMACIÓN */}
      <AnimatePresence>
        {isMethodInfoOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              role="dialog"
              aria-modal="true"
              aria-label="Límites de precisión IEEE-754"
              className="relative w-full max-w-md border border-zinc-800 bg-zinc-950 rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <h4 className="text-sm font-serif font-bold text-zinc-100 flex items-center gap-2">
                  <Cpu size={15} className="text-amber-400" /> Límites de Precisión IEEE-754
                </h4>
                <button type="button" onClick={() => setIsMethodInfoOpen(false)} aria-label="Cerrar" className="p-1 text-zinc-400 hover:text-zinc-100">
                  <X size={16} />
                </button>
              </div>
              <div className="text-xs text-zinc-400 mt-3 space-y-2 leading-relaxed font-sans">
                <p>• <strong>Precisión Simple (float32):</strong> 24 bits de mantisa (~7 cifras significativas exactas). Épsilon: 1.19 × 10⁻⁷.</p>
                <p>• <strong>Precisión Doble (float64):</strong> 53 bits de mantisa (~16 cifras significativas exactas). Épsilon: 2.22 × 10⁻¹⁶.</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE AYUDA CON EJEMPLOS DE UN CLIC */}
      <AnimatePresence>
        {isHelpOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              role="dialog"
              aria-modal="true"
              aria-label="Casos notables de teoría de errores"
              className="relative w-full max-w-3xl border border-zinc-800/80 bg-zinc-950/95 backdrop-blur-2xl rounded-3xl p-6 lg:p-8 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
                <div className="flex items-center gap-2">
                  <Scale size={16} className="text-amber-400" />
                  <h3 className="text-base font-serif font-bold text-zinc-100">Casos Notables de Teoría de Errores</h3>
                </div>
                <button type="button" onClick={() => setIsHelpOpen(false)} aria-label="Cerrar" className="p-2 text-zinc-400 hover:text-zinc-100">
                  <X size={16} />
                </button>
              </div>

              <div className="mt-5 space-y-4 max-h-[65vh] overflow-y-auto pr-1.5 text-xs custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {MODULE_EXAMPLES.map((ex) => (
                    <button
                      key={ex.category}
                      onClick={() => {
                        setExactInput(ex.exactExpr);
                        setApproxInput(ex.approxExpr);
                        setTargetDecimals(ex.decimals);
                        setIsHelpOpen(false);
                      }}
                      className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-left transition-all flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-[10px] font-mono text-amber-400/90 block font-semibold">{ex.category}</span>
                        <span className="font-mono text-zinc-200 text-xs block font-bold truncate">
                          {ex.exactExpr} vs {ex.approxExpr}
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
    </div>
  );
}