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
  Binary,
  Terminal,
  Code2,
  ChevronRight,
  Info,
  Scale,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from "lucide-react";
import { useAIContext } from "@/lib/context/ai-context";
import {
  fetchUserHistory,
  saveUserCalculation,
  deleteUserHistory,
  type HistoryItem,
} from "@/lib/supabase/history";

// -----------------------------------------------------------------------------
// CATÁLOGO DE LEYES DE EQUIVALENCIA LÓGICA (Nivel Superior TypeScript)
// -----------------------------------------------------------------------------
interface ModuleExample {
  category: string;
  exprA: string;
  exprB: string;
  lawName: string;
  desc: string;
}

const MODULE_EXAMPLES: ModuleExample[] = [
  {
    category: "Leyes de De Morgan (Conjunción)",
    exprA: "¬(p ∧ q)",
    exprB: "¬p ∨ ¬q",
    lawName: "Primera Ley de De Morgan",
    desc: "La negación de una conjunción equivale a la disyunción de las negaciones.",
  },
  {
    category: "Leyes de De Morgan (Disyunción)",
    exprA: "¬(p ∨ q)",
    exprB: "¬p ∧ ¬q",
    lawName: "Segunda Ley de De Morgan",
    desc: "La negación de una disyunción equivale a la conjunción de las negaciones.",
  },
  {
    category: "Definición del Condicional",
    exprA: "p → q",
    exprB: "¬p ∨ q",
    lawName: "Ley de la Implicación Material",
    desc: "Una implicación es falsa únicamente si el antecedente es verdadero y el consecuente falso.",
  },
  {
    category: "Ley de la Contrapositiva",
    exprA: "p → q",
    exprB: "¬q → ¬p",
    lawName: "Ley de Contraposición",
    desc: "Base del método de demostración por contraposición en matemáticas.",
  },
  {
    category: "Ley de Absorción",
    exprA: "p ∧ (p ∨ q)",
    exprB: "p",
    lawName: "Ley de Absorción",
    desc: "Permite simplificar expresiones booleanas redundantes en circuitos digitales.",
  },
  {
    category: "Ley de Exportación",
    exprA: "(p ∧ q) → r",
    exprB: "p → (q → r)",
    lawName: "Ley de Exportación / Currificación",
    desc: "Principio lógico de funciones de orden superior en programación funcional (Currying).",
  },
  {
    category: "Distributividad",
    exprA: "p ∧ (q ∨ r)",
    exprB: "(p ∧ q) ∨ (p ∧ r)",
    lawName: "Ley Distributiva de la Conjunción",
    desc: "Distribución del operador AND sobre el operador OR.",
  },
  {
    category: "Doble Negación",
    exprA: "¬(¬p)",
    exprB: "p",
    lawName: "Ley de Involución (Doble Negación)",
    desc: "Negar dos veces una proposición equivale a su afirmación original.",
  },
  {
    category: "Falacia (No Equivalentes)",
    exprA: "p → q",
    exprB: "q → p",
    lawName: "Falacia de Afirmación del Consecuente",
    desc: "Un condicional NO es equivalente a su recíproca (falla cuando p=F, q=V).",
  },
];

// Evaluador Booleano Seguro
function evaluateBooleanLogic(expr: string, state: Record<string, boolean>): boolean {
  try {
    let s = expr;
    s = s.replace(/↔|<->/g, "===");
    s = s.replace(/⊕|\bxor\b/g, "!==");
    s = s.replace(/→|->/g, "<=");
    s = s.replace(/∧|\band\b|&/g, "&&");
    s = s.replace(/∨|\bor\b|\|/g, "||");
    s = s.replace(/¬|\bnot\b|~|!/g, "!");

    Object.keys(state).forEach((v) => {
      s = s.replace(new RegExp(`\\b${v}\\b`, "g"), state[v] ? "true" : "false");
    });

    // eslint-disable-next-line no-new-func
    const fn = new Function(`"use strict"; return Boolean(${s});`);
    return fn();
  } catch {
    return false;
  }
}

// Identificador heurístico de leyes lógicas conocidas
function detectKnownLogicLaw(exprA: string, exprB: string, isEq: boolean): { name: string; desc: string } {
  if (!isEq) {
    return {
      name: "Proposiciones No Equivalentes",
      desc: "Las expresiones difieren en al menos una asignación de verdad (contraejemplo detectado).",
    };
  }

  const sA = exprA.replace(/\s+/g, "").toLowerCase();
  const sB = exprB.replace(/\s+/g, "").toLowerCase();

  if ((sA.includes("¬(p∧q)") && sB.includes("¬p∨¬q")) || (sB.includes("¬(p∧q)") && sA.includes("¬p∨¬q"))) {
    return { name: "Primera Ley de De Morgan", desc: "¬(p ∧ q) ≡ ¬p ∨ ¬q" };
  }
  if ((sA.includes("¬(p∨q)") && sB.includes("¬p∧¬q")) || (sB.includes("¬(p∨q)") && sA.includes("¬p∧¬q"))) {
    return { name: "Segunda Ley de De Morgan", desc: "¬(p ∨ q) ≡ ¬p ∧ ¬q" };
  }
  if ((sA.includes("p→q") && sB.includes("¬p∨q")) || (sB.includes("p→q") && sA.includes("¬p∨q"))) {
    return { name: "Ley de la Implicación Material", desc: "p → q ≡ ¬p ∨ q" };
  }
  if ((sA.includes("p→q") && sB.includes("¬q→¬p")) || (sB.includes("p→q") && sA.includes("¬q→¬p"))) {
    return { name: "Ley de la Contrapositiva", desc: "p → q ≡ ¬q → ¬p" };
  }
  if (sA.includes("p∧(p∨q)") || sB.includes("p∧(p∨q)") || sA.includes("p∨(p∧q)") || sB.includes("p∨(p∧q)")) {
    return { name: "Ley de Absorción", desc: "p ∧ (p ∨ q) ≡ p" };
  }
  if (sA.includes("¬(¬p)") || sB.includes("¬(¬p)")) {
    return { name: "Ley de Doble Negación", desc: "¬(¬p) ≡ p" };
  }

  return {
    name: "Equivalencia Lógica Válida (Tautología)",
    desc: "A ↔ B es verdadera para todas las combinaciones posibles de verdad.",
  };
}

export default function EquivalencesView({
  viewMode,
  initialExpression = "",
}: {
  viewMode: "calc" | "steps" | "theory";
  initialExpression?: string;
}) {
  // Expresión A y Expresión B
  const [exprA, setExprA] = useState<string>("¬(p ∧ q)");
  const [exprB, setExprB] = useState<string>("¬p ∨ ¬q");
  const [activeInput, setActiveInput] = useState<"A" | "B">("A");

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMethodInfoOpen, setIsMethodInfoOpen] = useState(false);

  const { setAIContext, injectedExpression, clearInjectedExpression } = useAIContext();

  // Detectar todas las variables atómicas presentes en ambas fórmulas
  const detectedVariables = useMemo(() => {
    const combined = `${exprA} ${exprB}`;
    const vars = Array.from(new Set(combined.match(/\b[p-z]\b/g) || [])).sort();
    return vars.length > 0 ? vars : ["p", "q"];
  }, [exprA, exprB]);

  // Generador de la Tabla Comparativa en Paralelo
  const comparison = useMemo(() => {
    const vars = detectedVariables;
    const n = vars.length;
    const totalRows = Math.pow(2, n);
    const rows = [];
    let matchCount = 0;
    let firstCounterexample: { id: number; state: Record<string, boolean>; resA: boolean; resB: boolean } | null = null;

    for (let i = 0; i < totalRows; i++) {
      const state: Record<string, boolean> = {};
      vars.forEach((v, vIdx) => {
        const period = Math.pow(2, n - 1 - vIdx);
        state[v] = Math.floor(i / period) % 2 === 0;
      });

      const resA = evaluateBooleanLogic(exprA, state);
      const resB = evaluateBooleanLogic(exprB, state);
      const isMatch = resA === resB;

      if (isMatch) {
        matchCount++;
      } else if (!firstCounterexample) {
        firstCounterexample = { id: i + 1, state, resA, resB };
      }

      rows.push({
        id: i + 1,
        state,
        resA,
        resB,
        isMatch,
      });
    }

    const isEquivalent = matchCount === totalRows;
    const lawInfo = detectKnownLogicLaw(exprA, exprB, isEquivalent);

    return {
      vars,
      rows,
      totalRows,
      matchCount,
      isEquivalent,
      lawInfo,
      firstCounterexample,
    };
  }, [exprA, exprB, detectedVariables]);

  // Transpilación a Código Optimizado
  const codeOptimization = useMemo(() => {
    const toPy = (s: string) =>
      s.replace(/∧/g, " and ").replace(/∨/g, " or ").replace(/¬/g, " not ").replace(/→/g, " <= ").replace(/↔/g, " == ");
    const toJs = (s: string) =>
      s.replace(/∧/g, " && ").replace(/∨/g, " || ").replace(/¬/g, "!").replace(/→/g, " ? ").replace(/↔/g, " === ");

    return {
      pyA: toPy(exprA).replace(/\s+/g, " ").trim(),
      pyB: toPy(exprB).replace(/\s+/g, " ").trim(),
      jsA: toJs(exprA).replace(/\s+/g, " ").trim(),
      jsB: toJs(exprB).replace(/\s+/g, " ").trim(),
    };
  }, [exprA, exprB]);

  // Sincronización con ReSolve AI
  useEffect(() => {
    const title = `${exprA} ≡ ${exprB}`;
    const statusStr = comparison.isEquivalent ? "Equivalencia Lógica Válida" : "No Equivalentes";
    setAIContext({
      module: "Matemáticas II",
      subtopic: "Equivalencias Lógicas",
      expression: title,
      result: `${statusStr} (${comparison.lawInfo.name})`,
      details: `Coincidencia: ${comparison.matchCount}/${comparison.totalRows}. Ley: ${comparison.lawInfo.desc}`,
    });
  }, [exprA, exprB, comparison, setAIContext]);

  // Inyecciones inversas del chat (si viene con signo '≡' o '<=>')
  useEffect(() => {
    if (injectedExpression) {
      if (injectedExpression.includes("≡") || injectedExpression.includes("<=>")) {
        const parts = injectedExpression.split(/≡|<=>/);
        setExprA(parts[0].trim());
        setExprB(parts[1].trim());
      } else {
        setExprA(injectedExpression);
      }
      clearInjectedExpression();
    }
  }, [injectedExpression, clearInjectedExpression]);

  // Carga de historial
  useEffect(() => {
    fetchUserHistory("mat2", "equivalencias").then((data) => setHistory(data));
  }, []);

  const saveCalculation = async () => {
    if (!exprA.trim() || !exprB.trim()) return;
    const title = `${exprA} ≡ ${exprB}`;
    const summary = `${comparison.isEquivalent ? "Equivalente" : "No Equivalente"} (${comparison.lawInfo.name})`;
    await saveUserCalculation("mat2", "equivalencias", title, summary);
    const refreshed = await fetchUserHistory("mat2", "equivalencias");
    setHistory(refreshed);
  };

  const clearHistory = async () => {
    await deleteUserHistory("equivalencias");
    setHistory([]);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`${exprA} ≡ ${exprB}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const LOGIC_KEYS = [
    { label: "p", val: "p" },
    { label: "q", val: "q" },
    { label: "r", val: "r" },
    { label: "s", val: "s" },
    { label: "¬ (NOT)", val: "¬" },
    { label: "∧ (AND)", val: " ∧ " },
    { label: "∨ (OR)", val: " ∨ " },
    { label: "→ (IF)", val: " → " },
    { label: "↔ (IFF)", val: " ↔ " },
    { label: "⊕ (XOR)", val: " ⊕ " },
    { label: "(", val: "(" },
    { label: ")", val: ")" },
  ];

  return (
    <div className="h-full flex flex-col gap-6 min-h-0 relative select-none">
      {viewMode === "calc" && (
        <div className="flex-1 flex flex-col gap-6 min-h-0">
          
          {/* FILA SUPERIOR: CONSOLA DUAL (A vs B) Y VEREDICTO */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 shrink-0">
            
            {/* Consola Dual de Comparación */}
            <div className="lg:col-span-8 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden">
              <div className="pointer-events-none absolute -top-16 -left-16 w-48 h-48 bg-zinc-700/10 rounded-full blur-3xl" />

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-2">
                    <Scale size={14} className="text-zinc-500" />
                    Comparador de Equivalencia Semántica (A ≡ B)
                  </span>

                  <button
                    type="button"
                    onClick={() => setIsHelpOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-800 text-[11px] font-mono text-zinc-300 transition-colors flex items-center gap-1"
                  >
                    <HelpCircle size={13} className="text-amber-400" />
                    <span>Leyes de Boole</span>
                  </button>
                </div>

                {/* Inputs Duales A y B */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div
                    onClick={() => setActiveInput("A")}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                      activeInput === "A" ? "bg-zinc-950 border-amber-400/50 shadow-md" : "bg-zinc-950/60 border-zinc-800/80"
                    }`}
                  >
                    <div className="flex justify-between text-[11px] font-mono text-zinc-400 mb-1">
                      <span>Expresión A:</span>
                      {activeInput === "A" && <span className="text-amber-400 font-bold">Activo</span>}
                    </div>
                    <input
                      type="text"
                      value={exprA}
                      onChange={(e) => setExprA(e.target.value)}
                      onFocus={() => setActiveInput("A")}
                      placeholder="Ej: ¬(p ∧ q)"
                      className="w-full bg-transparent font-mono text-sm lg:text-base text-zinc-100 outline-none"
                    />
                  </div>

                  <div
                    onClick={() => setActiveInput("B")}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                      activeInput === "B" ? "bg-zinc-950 border-amber-400/50 shadow-md" : "bg-zinc-950/60 border-zinc-800/80"
                    }`}
                  >
                    <div className="flex justify-between text-[11px] font-mono text-zinc-400 mb-1">
                      <span>Expresión B:</span>
                      {activeInput === "B" && <span className="text-amber-400 font-bold">Activo</span>}
                    </div>
                    <input
                      type="text"
                      value={exprB}
                      onChange={(e) => setExprB(e.target.value)}
                      onFocus={() => setActiveInput("B")}
                      placeholder="Ej: ¬p ∨ ¬q"
                      className="w-full bg-transparent font-mono text-sm lg:text-base text-zinc-100 outline-none"
                    />
                  </div>
                </div>

                {/* Relación Simbólica Activa */}
                <div className="p-3 rounded-2xl bg-zinc-950/40 border border-zinc-800/60 flex items-center justify-between font-mono text-xs text-zinc-400">
                  <span className="truncate">
                    Evaluando bicondicional tautológico: <code className="text-zinc-200">({exprA}) ↔ ({exprB})</code>
                  </span>
                  <span className="text-[10px] text-zinc-500 shrink-0">Escribiendo en Expresión {activeInput}</span>
                </div>
              </div>

              {/* Botones del Teclado Lógico */}
              <div className="relative z-10 flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-zinc-800/60">
                {LOGIC_KEYS.map((k) => (
                  <button
                    key={k.label}
                    onClick={() => {
                      if (activeInput === "A") setExprA((prev) => prev + k.val);
                      else setExprB((prev) => prev + k.val);
                    }}
                    className="h-10 min-w-[42px] px-3 bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-600 hover:bg-zinc-800/80 text-zinc-200 rounded-xl font-mono text-sm font-medium transition-all active:scale-95 shadow-sm backdrop-blur-sm flex items-center justify-center"
                  >
                    {k.label}
                  </button>
                ))}

                <button
                  onClick={() => void saveCalculation()}
                  className="h-10 px-5 bg-zinc-100 text-zinc-950 rounded-xl text-xs font-semibold hover:bg-zinc-200 hover:scale-[1.02] transition-all flex items-center gap-2 shadow-lg shadow-zinc-100/5 ml-auto active:scale-95"
                >
                  <CornerDownLeft size={14} /> Comprobar
                </button>

                <button
                  onClick={() => {
                    setExprA("");
                    setExprB("");
                  }}
                  className="h-10 px-3.5 bg-zinc-900/50 border border-zinc-800/80 text-zinc-400 hover:text-red-400 hover:border-red-900/40 rounded-xl text-xs font-medium transition-colors"
                >
                  Limpiar
                </button>
              </div>
            </div>

            {/* Caja Derecha: Veredicto de Equivalencia */}
            <div className="lg:col-span-4 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden">
              <div className="pointer-events-none absolute -bottom-16 -right-16 w-48 h-48 bg-zinc-700/10 rounded-full blur-3xl" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold">
                    Veredicto de Equivalencia
                  </span>
                  {exprA && exprB && (
                    <button
                      onClick={handleCopy}
                      className="text-xs text-zinc-400 hover:text-zinc-100 flex items-center gap-1.5 transition-colors py-1 px-2.5 rounded-lg border border-zinc-800/60 bg-zinc-900/50"
                    >
                      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      {copied ? "Copiado" : "Copiar"}
                    </button>
                  )}
                </div>

                <div className="py-4 text-center">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={comparison.isEquivalent ? "valid" : "invalid"}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col items-center gap-1.5"
                    >
                      {comparison.isEquivalent ? (
                        <div className="flex items-center gap-2 text-emerald-400 text-2xl lg:text-3xl font-serif font-bold tracking-tight">
                          <CheckCircle2 size={26} className="text-emerald-400 shrink-0" />
                          <span>Son Equivalentes</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-red-400 text-2xl lg:text-3xl font-serif font-bold tracking-tight">
                          <XCircle size={26} className="text-red-400 shrink-0" />
                          <span>No Equivalentes</span>
                        </div>
                      )}

                      <span className="text-[11px] font-mono text-zinc-400 mt-1">
                        {comparison.isEquivalent
                          ? `${comparison.matchCount} de ${comparison.totalRows} estados coinciden (100%)`
                          : `Discrepancia en ${comparison.totalRows - comparison.matchCount} de ${comparison.totalRows} estados`}
                      </span>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Diagnóstico de Ley o Contraejemplo */}
                <div className="space-y-2 mt-2 font-mono text-xs">
                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 block">Ley Booleana Identificada:</span>
                    <strong className="text-amber-400 text-[11px] block truncate">{comparison.lawInfo.name}</strong>
                  </div>

                  {!comparison.isEquivalent && comparison.firstCounterexample && (
                    <div className="p-2.5 rounded-xl bg-red-950/20 border border-red-900/40 text-[11px]">
                      <span className="text-red-300 font-semibold block flex items-center gap-1">
                        <AlertTriangle size={12} /> Contraejemplo (Fila #{comparison.firstCounterexample.id}):
                      </span>
                      <span className="text-zinc-400 block mt-0.5">
                        {Object.entries(comparison.firstCounterexample.state)
                          .map(([k, val]) => `${k} = ${val ? "V" : "F"}`)
                          .join(", ")}
                        {" ⟹ "}
                        <strong className="text-red-400">
                          A={comparison.firstCounterexample.resA ? "V" : "F"}, B={comparison.firstCounterexample.resB ? "V" : "F"}
                        </strong>
                      </span>
                    </div>
                  )}
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
                    <span>Teorema y Significado Booleano</span>
                  </div>
                  <ChevronRight size={12} className="text-zinc-600 group-hover:text-zinc-300 shrink-0" />
                </button>
              </div>
            </div>
          </div>

          {/* FILA INFERIOR: TABLA COMPARATIVA EN PARALELO + HISTORIAL */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
            
            {/* Panel Izquierdo: Tabla Comparativa A vs B */}
            <div className="lg:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <ListOrdered size={15} className="text-zinc-400" /> Tabla de Verdad Comparativa ({comparison.totalRows} renglones)
                </span>
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900/80 border border-zinc-800/80 px-2.5 py-1 rounded-full">
                  {comparison.matchCount}/{comparison.totalRows} Coincidencias
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto mt-4 custom-scrollbar border border-zinc-800/60 rounded-2xl">
                <table className="w-full text-left font-mono text-xs divide-y divide-zinc-800">
                  <thead className="bg-zinc-950 text-zinc-400 sticky top-0 z-10">
                    <tr>
                      <th className="p-3 w-10 text-center text-[10px] text-zinc-600">#</th>
                      {comparison.vars.map((v) => (
                        <th key={v} className="p-3 text-center">{v}</th>
                      ))}
                      <th className="p-3 text-center text-sky-400 font-bold">A ({exprA})</th>
                      <th className="p-3 text-center text-amber-400 font-bold">B ({exprB})</th>
                      <th className="p-3 text-right text-zinc-100 font-bold">A ≡ B</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40 bg-zinc-900/20 text-zinc-300">
                    {comparison.rows.map((row) => (
                      <tr
                        key={row.id}
                        className={`transition-colors ${
                          row.isMatch ? "hover:bg-zinc-900/40" : "bg-red-950/20 hover:bg-red-950/30"
                        }`}
                      >
                        <td className="p-3 text-center text-zinc-600 text-[10px]">{row.id}</td>
                        {comparison.vars.map((v) => (
                          <td key={v} className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              row.state[v] ? "text-emerald-400 bg-emerald-950/30" : "text-zinc-500 bg-zinc-950/50"
                            }`}>
                              {row.state[v] ? "V" : "F"}
                            </span>
                          </td>
                        ))}
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            row.resA ? "text-sky-300" : "text-zinc-500"
                          }`}>
                            {row.resA ? "V (1)" : "F (0)"}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            row.resB ? "text-amber-300" : "text-zinc-500"
                          }`}>
                            {row.resB ? "V (1)" : "F (0)"}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono ${
                            row.isMatch
                              ? "text-emerald-400 bg-emerald-950/50 border border-emerald-900/50"
                              : "text-red-400 bg-red-950/50 border border-red-900/50"
                          }`}>
                            {row.isMatch ? "Coincide" : "Discrepa"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Panel Derecho: Historial */}
            <div className="lg:col-span-4 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <History size={15} className="text-zinc-400" /> Historial de Leyes
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
                    <p>Sin equivalencias guardadas.</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Presiona Comprobar para registrar.</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        const parts = item.expression.split("≡");
                        if (parts.length === 2) {
                          setExprA(parts[0].trim());
                          setExprB(parts[1].trim());
                        }
                      }}
                      className="group p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700 hover:bg-zinc-900/80 cursor-pointer transition-all flex items-center justify-between text-xs"
                    >
                      <div className="truncate pr-2 font-mono text-zinc-300 group-hover:text-zinc-100 transition-colors">
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

          </div>
        </div>
      )}

      {/* MODO 2: PASO A PASO */}
      {viewMode === "steps" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-5 shrink-0">
            <div>
              <h3 className="text-xl font-serif font-bold text-zinc-100">
                Demostración Semántica de Equivalencia
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                Bicondicional evaluado: ({exprA}) ↔ ({exprB})
              </p>
            </div>
            <div className="text-xs font-mono px-4 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-zinc-300 shadow-inner">
              Estado: <strong className="text-emerald-400 text-sm font-serif">{comparison.isEquivalent ? "Tautología" : "Falla"}</strong>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 flex flex-col gap-2">
              <span className="text-xs font-mono font-semibold text-zinc-200">1. Principio de Sustitución y Tautología</span>
              <p className="text-xs text-zinc-400">Dos proposiciones compuestas A y B son lógicamente equivalentes si y solo si la fórmula condicional doble A ↔ B es una Tautología:</p>
              <div className="p-3 rounded-xl bg-zinc-950 font-mono text-xs text-emerald-400 text-center font-bold">
                A ≡ B  ⟺  ⊨ (A ↔ B)
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 flex flex-col gap-2">
              <span className="text-xs font-mono font-semibold text-zinc-200">2. Identificación de Ley del Álgebra de Boole</span>
              <p className="text-xs text-zinc-400">Propiedad formal que vincula la estructura sintáctica de ambas proposiciones:</p>
              <div className="p-3 rounded-xl bg-zinc-950 font-mono text-xs text-amber-400 text-center font-bold">
                {comparison.lawInfo.name}: {comparison.lawInfo.desc}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 flex flex-col gap-2">
              <span className="text-xs font-mono font-semibold text-zinc-200">3. Veredicto y Contraejemplos</span>
              <p className="text-xs text-zinc-400">Comprobación del espacio de estados booleanos:</p>
              <div className="p-3 rounded-xl bg-zinc-950 font-mono text-xs text-emerald-400 text-center font-bold">
                {comparison.isEquivalent
                  ? "Las columnas de verdad son 100% idénticas en todas las filas. A y B pueden intercambiarse sin alterar la validez."
                  : `Se detectaron diferencias de verdad. Ejemplo en fila #${comparison.firstCounterexample?.id}.`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODO 3: TEORÍA */}
      {viewMode === "theory" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto shadow-xl shadow-black/20 custom-scrollbar">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800/80 bg-zinc-900/60 text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 mb-3">
              <BookOpen size={12} /> Álgebra de Proposiciones
            </div>
            <h3 className="text-2xl font-serif font-bold text-zinc-100">
              Leyes Fundamentales del Álgebra Booleana
            </h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-3xl">
              Las equivalencias lógicas permiten transformar algoritmos complejos en expresiones minimalistas, reduciendo el consumo de ciclos de reloj y compuertas lógicas en hardware.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                1. Leyes de De Morgan
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                ¬(p ∧ q) ≡ ¬p ∨ ¬q y ¬(p ∨ q) ≡ ¬p ∧ ¬q. Fundamentales para transformar compuertas NAND y NOR universales en circuitos lógicos.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                2. Ley de la Implicación y Cortocircuito
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                p → q ≡ ¬p ∨ q. En compiladores, la evaluación de cortocircuito en `if (!p || q)` aprovecha esta equivalencia para no computar `q` si `p` es falso.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                3. Contraposición y Demostración
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                p → q ≡ ¬q → ¬p. Permite demostrar teoremas difíciles probando su contrapositiva equivalente (ej: si n² es par, entonces n es par).
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                4. Ley de Absorción
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                p ∧ (p ∨ q) ≡ p y p ∨ (p ∧ q) ≡ p. Elimina variables y términos redundantes en optimizadores de consultas SQL y mapas de Karnaugh.
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
              className="relative w-full max-w-md border border-zinc-800 bg-zinc-950 rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <h4 className="text-sm font-serif font-bold text-zinc-100 flex items-center gap-2">
                  <Info size={15} className="text-amber-400" /> {comparison.lawInfo.name}
                </h4>
                <button onClick={() => setIsMethodInfoOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-100">
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs text-zinc-400 mt-3 leading-relaxed">
                {comparison.lawInfo.desc}
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE AYUDA CON CATÁLOGO DE LEYES DE UN CLIC */}
      <AnimatePresence>
        {isHelpOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-3xl border border-zinc-800/80 bg-zinc-950/95 backdrop-blur-2xl rounded-3xl p-6 lg:p-8 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
                <div className="flex items-center gap-2">
                  <Scale size={16} className="text-amber-400" />
                  <h3 className="text-base font-serif font-bold text-zinc-100">Catálogo de Leyes del Álgebra Booleana</h3>
                </div>
                <button onClick={() => setIsHelpOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-100">
                  <X size={16} />
                </button>
              </div>

              <div className="mt-5 space-y-4 max-h-[65vh] overflow-y-auto pr-1.5 text-xs custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {MODULE_EXAMPLES.map((ex) => (
                    <button
                      key={ex.category}
                      onClick={() => {
                        setExprA(ex.exprA);
                        setExprB(ex.exprB);
                        setIsHelpOpen(false);
                      }}
                      className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-left transition-all flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-[10px] font-mono text-amber-400/90 block font-semibold">{ex.category}</span>
                        <span className="font-mono text-zinc-200 text-xs block font-bold truncate">
                          {ex.exprA} ≡ {ex.exprB}
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