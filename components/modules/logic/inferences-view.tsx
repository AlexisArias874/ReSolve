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
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Cpu
} from "lucide-react";
import { useAIContext } from "@/lib/context/ai-context";
import {
  fetchUserHistory,
  saveUserCalculation,
  deleteUserHistory,
  type HistoryItem,
} from "@/lib/supabase/history";

// -----------------------------------------------------------------------------
// CATÁLOGO DE REGLAS DE INFERENCIA Y FALACIAS
// -----------------------------------------------------------------------------
interface ModuleExample {
  category: string;
  premises: string;
  conclusion: string;
  ruleName: string;
  desc: string;
}

const MODULE_EXAMPLES: ModuleExample[] = [
  {
    category: "Modus Ponendo Ponens (MPP)",
    premises: "p → q, p",
    conclusion: "q",
    ruleName: "Modus Ponens",
    desc: "Si afirmo el antecedente de un condicional, concluyo necesariamente su consecuente.",
  },
  {
    category: "Modus Tollendo Tollens (MTT)",
    premises: "p → q, ¬q",
    conclusion: "¬p",
    ruleName: "Modus Tollens",
    desc: "Si niego el consecuente de un condicional, concluyo necesariamente la negación del antecedente.",
  },
  {
    category: "Silogismo Hipotético (SH)",
    premises: "p → q, q → r",
    conclusion: "p → r",
    ruleName: "Transitividad del Condicional",
    desc: "Encadenamiento lógico de causas y efectos sucesivos.",
  },
  {
    category: "Silogismo Disyuntivo (SD)",
    premises: "p ∨ q, ¬p",
    conclusion: "q",
    ruleName: "Modus Tollendo Ponens",
    desc: "En una disyunción, si se descarta una alternativa, la otra debe ser verdadera.",
  },
  {
    category: "Resolución Clausal (Base de IA)",
    premises: "p ∨ q, ¬p ∨ r",
    conclusion: "q ∨ r",
    ruleName: "Principio de Resolución de Robinson",
    desc: "El algoritmo fundamental de demostración automática en Prolog y solucionadores SAT.",
  },
  {
    category: "Regla de Simplificación",
    premises: "p ∧ q",
    conclusion: "p",
    ruleName: "Eliminación de la Conjunción",
    desc: "Si una conjunción es verdadera, cada una de sus partes también lo es de forma aislada.",
  },
  {
    category: "Regla de Adición",
    premises: "p",
    conclusion: "p ∨ q",
    ruleName: "Introducción de la Disyunción",
    desc: "Una proposición verdadera permite derivar su disyunción con cualquier otra proposición.",
  },
  {
    category: "Falacia de Afirmación del Consecuente",
    premises: "p → q, q",
    conclusion: "p",
    ruleName: "Falacia Formal (Inválido)",
    desc: "Error clásico: que ocurra el consecuente no garantiza que la causa haya sido p.",
  },
  {
    category: "Falacia de Negación del Antecedente",
    premises: "p → q, ¬p",
    conclusion: "¬q",
    ruleName: "Falacia Formal (Inválido)",
    desc: "Error clásico: que no ocurra p no impide que q pueda ocurrir por otra vía.",
  },
];

// Evaluador Booleano Seguro
function evaluateBoolean(expr: string, state: Record<string, boolean>): boolean {
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

// Identificador heurístico de reglas e inferencias conocidas
function detectInferenceRule(premisesStr: string, conclusionStr: string, isValid: boolean): { name: string; desc: string } {
  const pNorm = premisesStr.replace(/\s+/g, "").toLowerCase();
  const cNorm = conclusionStr.replace(/\s+/g, "").toLowerCase();

  if (!isValid) {
    if ((pNorm.includes("p→q") && pNorm.includes("q") && cNorm === "p") || (pNorm.includes("p->q") && pNorm.includes("q") && cNorm === "p")) {
      return {
        name: "Falacia de Afirmación del Consecuente",
        desc: "Razonamiento erróneo: (p → q) ∧ q NO implica p.",
      };
    }
    if ((pNorm.includes("p→q") && pNorm.includes("¬p") && cNorm === "¬q") || (pNorm.includes("p->q") && pNorm.includes("!p") && cNorm === "!q")) {
      return {
        name: "Falacia de Negación del Antecedente",
        desc: "Razonamiento erróneo: (p → q) ∧ ¬p NO implica ¬q.",
      };
    }
    return {
      name: "Argumento Inválido (Falacia)",
      desc: "Existe al menos un estado donde todas las premisas son verdaderas pero la conclusión es falsa.",
    };
  }

  // Reglas válidas
  if ((pNorm.includes("p→q") && pNorm.includes("p") && cNorm === "q") || (pNorm.includes("p->q") && pNorm.includes("p") && cNorm === "q")) {
    return { name: "Modus Ponendo Ponens (MPP)", desc: "Si p implica q, y ocurre p, se concluye q." };
  }
  if ((pNorm.includes("p→q") && pNorm.includes("¬q") && cNorm === "¬p") || (pNorm.includes("p->q") && pNorm.includes("!q") && cNorm === "!p")) {
    return { name: "Modus Tollendo Tollens (MTT)", desc: "Si p implica q, y se niega q, se concluye ¬p." };
  }
  if ((pNorm.includes("p→q") && pNorm.includes("q→r") && cNorm === "p→r") || (pNorm.includes("p->q") && pNorm.includes("q->r") && cNorm === "p->r")) {
    return { name: "Silogismo Hipotético (SH)", desc: "Transitividad de implicaciones: p → q y q → r deducen p → r." };
  }
  if ((pNorm.includes("p∨q") && pNorm.includes("¬p") && cNorm === "q") || (pNorm.includes("p|q") && pNorm.includes("!p") && cNorm === "q")) {
    return { name: "Silogismo Disyuntivo (SD)", desc: "De una disyunción p ∨ q y la negación de una parte ¬p, se concluye q." };
  }
  if ((pNorm.includes("p∨q") && pNorm.includes("¬p∨r") && cNorm.includes("q∨r")) || (pNorm.includes("p|q") && pNorm.includes("!p|r") && cNorm.includes("q|r"))) {
    return { name: "Regla de Resolución (Robinson)", desc: "Eliminación del par complementario (p y ¬p), base de la inferencia en IA." };
  }
  if (pNorm.includes("p∧q") && (cNorm === "p" || cNorm === "q")) {
    return { name: "Regla de Simplificación", desc: "De una conjunción p ∧ q se deduce válidamente cualquiera de sus partes." };
  }

  return {
    name: "Deducción Válida (Tautología Formal)",
    desc: "En todos los mundos posibles donde las premisas son verdaderas, la conclusión también lo es.",
  };
}

export default function InferencesView({
  viewMode,
  initialExpression = "",
}: {
  viewMode: "calc" | "steps" | "theory";
  initialExpression?: string;
}) {
  // Estado de Premisas y Conclusión
  const [premisesInput, setPremisesInput] = useState<string>("p → q, p");
  const [conclusionInput, setConclusionInput] = useState<string>("q");
  const [activeFocus, setActiveFocus] = useState<"premises" | "conclusion">("premises");

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMethodInfoOpen, setIsMethodInfoOpen] = useState(false);

  const { setAIContext, injectedExpression, clearInjectedExpression } = useAIContext();

  // Parsear lista de premisas individuales separadas por comas
  const premisesList = useMemo(() => {
    return premisesInput
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
  }, [premisesInput]);

  // Extraer variables atómicas presentes en premisas o conclusión
  const detectedVariables = useMemo(() => {
    const combined = `${premisesInput} ${conclusionInput}`;
    const vars = Array.from(new Set(combined.match(/\b[p-z]\b/g) || [])).sort();
    return vars.length > 0 ? vars : ["p", "q"];
  }, [premisesInput, conclusionInput]);

  // Generador del Análisis Semántico de Validación (Tabla y Contraejemplos)
  const validation = useMemo(() => {
    const vars = detectedVariables;
    const n = vars.length;
    const totalRows = Math.pow(2, n);
    const rows = [];
    let isValid = true;
    let counterexampleRow: { id: number; state: Record<string, boolean>; premisesVals: boolean[]; conclVal: boolean } | null = null;
    let criticalRowsCount = 0; // Filas donde TODAS las premisas son verdaderas

    for (let i = 0; i < totalRows; i++) {
      const state: Record<string, boolean> = {};
      vars.forEach((v, vIdx) => {
        const period = Math.pow(2, n - 1 - vIdx);
        state[v] = Math.floor(i / period) % 2 === 0;
      });

      const premisesVals = premisesList.map((p) => evaluateBoolean(p, state));
      const allPremisesTrue = premisesVals.length > 0 ? premisesVals.every(Boolean) : true;
      const conclVal = evaluateBoolean(conclusionInput, state);

      // Fila crítica: todas las premisas son verdaderas
      if (allPremisesTrue) {
        criticalRowsCount++;
        // Si las premisas son verdaderas pero la conclusión es FALSA -> ARGUMENTO INVÁLIDO
        if (!conclVal) {
          isValid = false;
          if (!counterexampleRow) {
            counterexampleRow = { id: i + 1, state, premisesVals, conclVal };
          }
        }
      }

      rows.push({
        id: i + 1,
        state,
        premisesVals,
        allPremisesTrue,
        conclVal,
        rowValid: !allPremisesTrue || conclVal,
      });
    }

    const ruleInfo = detectInferenceRule(premisesInput, conclusionInput, isValid);

    return {
      vars,
      rows,
      totalRows,
      criticalRowsCount,
      isValid,
      ruleInfo,
      counterexampleRow,
    };
  }, [premisesList, conclusionInput, premisesInput, detectedVariables]);

  // Transpilación a Motores de Inferencia (Prolog y Python)
  const codeInference = useMemo(() => {
    const prologRules = premisesList
      .map((p) => {
        const condMatch = p.match(/([a-zA-Z])\s*(?:→|->)\s*([a-zA-Z])/);
        if (condMatch) return `${condMatch[2]} :- ${condMatch[1]}.`;
        return `${p.replace(/\s+/g, "")}.`;
      })
      .join("\n");

    const pythonCode = `# Motor de Inferencia hacia adelante
def verificar_argumento(p_dict):
    # Premisas: ${premisesInput}
    valido = ${premisesList.map((p) => `bool(${p.replace(/→/g, " <= ").replace(/∧/g, " and ").replace(/¬/g, " not ")})`).join(" and ")}
    if valido:
        conclusion = bool(${conclusionInput.replace(/¬/g, " not ")})
        return conclusion`;

    return {
      prolog: `% Base de conocimiento en Prolog:\n${prologRules}\n\n% Consulta:\n?- ${conclusionInput}.`,
      python: pythonCode,
    };
  }, [premisesList, premisesInput, conclusionInput]);

  // Sincronización con ReSolve AI
  useEffect(() => {
    const turnstileExpr = `${premisesInput} ⊢ ${conclusionInput}`;
    const statusStr = validation.isValid ? "Argumento Válido (Deducción Correcta)" : "Argumento Inválido (Falacia)";
    setAIContext({
      module: "Matemáticas II",
      subtopic: "Reglas de Inferencia",
      expression: turnstileExpr,
      result: `${statusStr} [${validation.ruleInfo.name}]`,
      details: `Regla: ${validation.ruleInfo.desc}. Filas críticas evaluadas: ${validation.criticalRowsCount}/${validation.totalRows}.`,
    });
  }, [premisesInput, conclusionInput, validation, setAIContext]);

  // Inyecciones inversas del chat (reconoce separador '⊢' o '|-')
  useEffect(() => {
    if (injectedExpression) {
      if (injectedExpression.includes("⊢") || injectedExpression.includes("|-")) {
        const parts = injectedExpression.split(/⊢|-/);
        setPremisesInput(parts[0].trim());
        setConclusionInput(parts[1].trim());
      } else {
        setPremisesInput(injectedExpression);
      }
      clearInjectedExpression();
    }
  }, [injectedExpression, clearInjectedExpression]);

  // Historial de Supabase
  useEffect(() => {
    fetchUserHistory("mat2", "inferencias").then((data) => setHistory(data));
  }, []);

  const saveCalculation = async () => {
    if (!premisesInput.trim() || !conclusionInput.trim()) return;
    const title = `${premisesInput} ⊢ ${conclusionInput}`;
    const summary = `${validation.isValid ? "Válido" : "Inválido"} (${validation.ruleInfo.name})`;
    await saveUserCalculation("mat2", "inferencias", title, summary);
    const refreshed = await fetchUserHistory("mat2", "inferencias");
    setHistory(refreshed);
  };

  const clearHistory = async () => {
    await deleteUserHistory("inferencias");
    setHistory([]);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`${premisesInput} ⊢ ${conclusionInput}`);
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
    { label: ",", val: ", " },
    { label: "(", val: "(" },
    { label: ")", val: ")" },
  ];

  return (
    <div className="h-full flex flex-col gap-6 min-h-0 relative select-none">
      {viewMode === "calc" && (
        <div className="flex-1 flex flex-col gap-6 min-h-0">
          
          {/* FILA SUPERIOR: CONSOLA DE PREMISAS, CONCLUSIÓN Y VEREDICTO */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 shrink-0">
            
            {/* Consola de Argumentos */}
            <div className="lg:col-span-8 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden">
              <div className="pointer-events-none absolute -top-16 -left-16 w-48 h-48 bg-zinc-700/10 rounded-full blur-3xl" />

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-2">
                    <Binary size={14} className="text-zinc-500" />
                    Validador Formal de Razonamiento (P₁, P₂... ⊢ Q)
                  </span>

                  <button
                    type="button"
                    onClick={() => setIsHelpOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-800 text-[11px] font-mono text-zinc-300 transition-colors flex items-center gap-1"
                  >
                    <HelpCircle size={13} className="text-amber-400" />
                    <span>Reglas de Inferencia</span>
                  </button>
                </div>

                {/* Inputs de Premisas y Conclusión */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div
                    onClick={() => setActiveFocus("premises")}
                    className={`md:col-span-8 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      activeFocus === "premises" ? "bg-zinc-950 border-amber-400/50 shadow-md" : "bg-zinc-950/60 border-zinc-800/80"
                    }`}
                  >
                    <div className="flex justify-between text-[11px] font-mono text-zinc-400 mb-1">
                      <span>Premisas (P₁, P₂, P₃... separadas por comas):</span>
                      {activeFocus === "premises" && <span className="text-amber-400 font-bold">Editando Premisas</span>}
                    </div>
                    <input
                      type="text"
                      value={premisesInput}
                      onChange={(e) => setPremisesInput(e.target.value)}
                      onFocus={() => setActiveFocus("premises")}
                      placeholder="Ej: p → q, p"
                      className="w-full bg-transparent font-mono text-sm lg:text-base text-zinc-100 outline-none"
                    />
                  </div>

                  <div
                    onClick={() => setActiveFocus("conclusion")}
                    className={`md:col-span-4 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      activeFocus === "conclusion" ? "bg-zinc-950 border-amber-400/50 shadow-md" : "bg-zinc-950/60 border-zinc-800/80"
                    }`}
                  >
                    <div className="flex justify-between text-[11px] font-mono text-zinc-400 mb-1">
                      <span>Conclusión (Q):</span>
                      {activeFocus === "conclusion" && <span className="text-amber-400 font-bold">Editando Conclusión</span>}
                    </div>
                    <input
                      type="text"
                      value={conclusionInput}
                      onChange={(e) => setConclusionInput(e.target.value)}
                      onFocus={() => setActiveFocus("conclusion")}
                      placeholder="Ej: q"
                      className="w-full bg-transparent font-mono text-sm lg:text-base text-zinc-100 outline-none font-bold"
                    />
                  </div>
                </div>

                {/* Notación Secuente Formal */}
                <div className="p-3 rounded-2xl bg-zinc-950/40 border border-zinc-800/60 flex items-center justify-between font-mono text-xs text-zinc-400">
                  <span className="truncate">
                    Secuente formal: <code className="text-zinc-200 font-bold">[{premisesList.join("  ∧  ")}] ⊢ {conclusionInput}</code>
                  </span>
                  <span className="text-[10px] text-zinc-500 shrink-0">
                    {premisesList.length} {premisesList.length === 1 ? "Premisa" : "Premisas"}
                  </span>
                </div>
              </div>

              {/* Botones del Teclado Lógico */}
              <div className="relative z-10 flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-zinc-800/60">
                {LOGIC_KEYS.map((k) => (
                  <button
                    key={k.label}
                    onClick={() => {
                      if (activeFocus === "premises") setPremisesInput((p) => p + k.val);
                      else setConclusionInput((c) => c + k.val);
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
                  <CornerDownLeft size={14} /> Validar Inferencia
                </button>

                <button
                  onClick={() => {
                    setPremisesInput("");
                    setConclusionInput("");
                  }}
                  className="h-10 px-3.5 bg-zinc-900/50 border border-zinc-800/80 text-zinc-400 hover:text-red-400 hover:border-red-900/40 rounded-xl text-xs font-medium transition-colors"
                >
                  Limpiar
                </button>
              </div>
            </div>

            {/* Caja Derecha: Diagnóstico de Validez */}
            <div className="lg:col-span-4 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden">
              <div className="pointer-events-none absolute -bottom-16 -right-16 w-48 h-48 bg-zinc-700/10 rounded-full blur-3xl" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold">
                    Validez del Argumento
                  </span>
                  {premisesInput && conclusionInput && (
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
                      key={validation.isValid ? "valid" : "invalid"}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col items-center gap-1.5"
                    >
                      {validation.isValid ? (
                        <div className="flex items-center gap-2 text-emerald-400 text-2xl lg:text-3xl font-serif font-bold tracking-tight">
                          <ShieldCheck size={28} className="text-emerald-400 shrink-0" />
                          <span>Argumento Válido</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-red-400 text-2xl lg:text-3xl font-serif font-bold tracking-tight">
                          <ShieldAlert size={28} className="text-red-400 shrink-0" />
                          <span>Argumento Inválido</span>
                        </div>
                      )}

                      <span className="text-[11px] font-mono text-zinc-400 mt-1">
                        {validation.isValid
                          ? "La conclusión se sigue necesariamente de las premisas"
                          : "Falacia lógica detectada: premisas verdaderas con conclusión falsa"}
                      </span>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Regla Identificada o Fila Contraejemplo */}
                <div className="space-y-2 mt-2 font-mono text-xs">
                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 block">Regla Deductiva / Diagnóstico:</span>
                    <strong className="text-amber-400 text-[11px] block truncate">{validation.ruleInfo.name}</strong>
                  </div>

                  {!validation.isValid && validation.counterexampleRow && (
                    <div className="p-2.5 rounded-xl bg-red-950/20 border border-red-900/40 text-[11px]">
                      <span className="text-red-300 font-semibold block flex items-center gap-1">
                        <AlertTriangle size={12} /> Contraejemplo en Fila #{validation.counterexampleRow.id}:
                      </span>
                      <span className="text-zinc-400 block mt-0.5">
                        {Object.entries(validation.counterexampleRow.state)
                          .map(([k, val]) => `${k} = ${val ? "V" : "F"}`)
                          .join(", ")}
                        {" ⟹ "}
                        <strong className="text-red-400">Premisas=V , Conclusión=F</strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Insignia del Método */}
              <div className="relative z-10 border-t border-zinc-800/60 pt-3.5">
                <button
                  type="button"
                  onClick={() => setIsMethodInfoOpen(!isMethodInfoOpen)}
                  className="w-full p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/70 hover:border-zinc-700 flex items-center justify-between text-[11px] font-mono transition-colors group"
                >
                  <div className="flex items-center gap-1.5 text-zinc-400 group-hover:text-zinc-200 truncate">
                    <Info size={12} className="text-amber-400 shrink-0" />
                    <span>Teorema de Validez Semántica</span>
                  </div>
                  <ChevronRight size={12} className="text-zinc-600 group-hover:text-zinc-300 shrink-0" />
                </button>
              </div>
            </div>
          </div>

          {/* FILA INFERIOR: TABLA SEMÁNTICA + HISTORIAL */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
            
            {/* Panel Izquierdo: Tabla de Verdad de Validación */}
            <div className="lg:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <ListOrdered size={15} className="text-zinc-400" /> Matriz de Validación Semántica ({validation.totalRows} renglones)
                </span>
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900/80 border border-zinc-800/80 px-2.5 py-1 rounded-full">
                  {validation.criticalRowsCount} {validation.criticalRowsCount === 1 ? "Fila Crítica" : "Filas Críticas"}
                </span>
              </div>

              {/* Tabla scrollable */}
              <div className="flex-1 min-h-0 overflow-y-auto mt-4 custom-scrollbar border border-zinc-800/60 rounded-2xl">
                <table className="w-full text-left font-mono text-xs divide-y divide-zinc-800">
                  <thead className="bg-zinc-950 text-zinc-400 sticky top-0 z-10">
                    <tr>
                      <th className="p-3 w-10 text-center text-[10px] text-zinc-600">#</th>
                      {validation.vars.map((v) => (
                        <th key={v} className="p-3 text-center">{v}</th>
                      ))}
                      {premisesList.map((p, idx) => (
                        <th key={idx} className="p-3 text-center text-amber-300 font-semibold">
                          P{idx + 1} ({p})
                        </th>
                      ))}
                      <th className="p-3 text-center text-sky-400 font-bold">Q ({conclusionInput})</th>
                      <th className="p-3 text-right text-zinc-100 font-bold">Estado Fila</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40 bg-zinc-900/20 text-zinc-300">
                    {validation.rows.map((row) => (
                      <tr
                        key={row.id}
                        className={`transition-colors ${
                          !row.rowValid
                            ? "bg-red-950/30 hover:bg-red-950/40"
                            : row.allPremisesTrue
                            ? "bg-emerald-950/20 hover:bg-emerald-950/30"
                            : "hover:bg-zinc-900/40"
                        }`}
                      >
                        <td className="p-3 text-center text-zinc-600 text-[10px]">{row.id}</td>
                        {validation.vars.map((v) => (
                          <td key={v} className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              row.state[v] ? "text-emerald-400 bg-emerald-950/30" : "text-zinc-500 bg-zinc-950/50"
                            }`}>
                              {row.state[v] ? "V" : "F"}
                            </span>
                          </td>
                        ))}
                        {row.premisesVals.map((pVal, idx) => (
                          <td key={idx} className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              pVal ? "text-amber-300" : "text-zinc-500"
                            }`}>
                              {pVal ? "V" : "F"}
                            </span>
                          </td>
                        ))}
                        <td className="p-3 text-center">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono ${
                            row.conclVal ? "text-sky-400 bg-sky-950/40 border border-sky-900/40" : "text-zinc-500 bg-zinc-950/50"
                          }`}>
                            {row.conclVal ? "V (1)" : "F (0)"}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono ${
                            !row.rowValid
                              ? "text-red-400 bg-red-950/50 border border-red-900/50"
                              : row.allPremisesTrue
                              ? "text-emerald-400 bg-emerald-950/50 border border-emerald-900/50"
                              : "text-zinc-500"
                          }`}>
                            {!row.rowValid ? "CONTRAEJEMPLO" : row.allPremisesTrue ? "Premisas V ➔ Q=V" : "Premisas F"}
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
                  <History size={15} className="text-zinc-400" /> Historial Deductivo
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
                    <p>Sin inferencias guardadas.</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Presiona Validar para registrar.</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        const parts = item.expression.split("⊢");
                        if (parts.length === 2) {
                          setPremisesInput(parts[0].trim());
                          setConclusionInput(parts[1].trim());
                        }
                      }}
                      className="group p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700 hover:bg-zinc-900/80 cursor-pointer transition-all flex items-center justify-between text-xs"
                    >
                      <div className="truncate pr-2 font-mono text-zinc-300 group-hover:text-zinc-100 transition-colors">
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

      {/* MODO 2: PASO A PASO */}
      {viewMode === "steps" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-5 shrink-0">
            <div>
              <h3 className="text-xl font-serif font-bold text-zinc-100">
                Demostración Formal de Validez Argumentativa
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                Argumento: [{premisesInput}] ⊢ {conclusionInput}
              </p>
            </div>
            <div className="text-xs font-mono px-4 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-zinc-300 shadow-inner">
              Veredicto: <strong className="text-emerald-400 text-sm font-serif">{validation.isValid ? "Válido" : "Falaz"}</strong>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 flex flex-col gap-2">
              <span className="text-xs font-mono font-semibold text-zinc-200">1. Criterio Semántico de Validez Tarski</span>
              <p className="text-xs text-zinc-400">Un argumento es válido si y solo si es IMPOSIBLE que sus premisas sean simultáneamente verdaderas y su conclusión falsa:</p>
              <div className="p-3 rounded-xl bg-zinc-950 font-mono text-xs text-emerald-400 text-center font-bold">
                ⊨ (P₁ ∧ P₂ ∧ ... ∧ Pₙ) ➔ Q
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 flex flex-col gap-2">
              <span className="text-xs font-mono font-semibold text-zinc-200">2. Análisis de las Filas Críticas</span>
              <p className="text-xs text-zinc-400">Se identificaron {validation.criticalRowsCount} renglones donde todas las premisas son verdaderas:</p>
              <div className="p-3 rounded-xl bg-zinc-950 font-mono text-xs text-amber-400 text-center font-bold">
                {validation.isValid
                  ? "En el 100% de las filas críticas la conclusión Q es VERDADERA. Deducción correcta."
                  : `Se encontró un contraejemplo en la fila #${validation.counterexampleRow?.id} donde las premisas son V pero Q es F.`}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 flex flex-col gap-2">
              <span className="text-xs font-mono font-semibold text-zinc-200">3. Regla Deducida en IA / Prolog</span>
              <p className="text-xs text-zinc-400">Codificación del razonamiento en lógica de primer orden y motores de inferencia:</p>
              <pre className="p-3 rounded-xl bg-zinc-950 font-mono text-xs text-sky-300 overflow-x-auto">
                {codeInference.prolog}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* MODO 3: TEORÍA */}
      {viewMode === "theory" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto shadow-xl shadow-black/20 custom-scrollbar">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800/80 bg-zinc-900/60 text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 mb-3">
              <BookOpen size={12} /> Teoría de la Demostración
            </div>
            <h3 className="text-2xl font-serif font-bold text-zinc-100">
              Reglas de Inferencia y Deducción Natural
            </h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-3xl">
              Las reglas de inferencia permiten transitar de axiomas y premisas verdaderas a nuevas conclusiones necesariamente verdaderas sin necesidad de recalcular tablas de verdad infinitas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                1. Modus Ponendo Ponens
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                "El método que afirmando, afirma". Si tenemos A → B y se confirma A, se deduce rigurosamente B. Es la instrucción `call/branch` fundamental de la computación.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                2. Modus Tollendo Tollens
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                "El método que negando, niega". Si A → B y se demuestra ¬B, se deduce ¬A. Fundamento del diagnóstico médico, depuración de software y pruebas unitarias de aserción.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                3. Principio de Resolución de Robinson
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                De A ∨ B y ¬A ∨ C se deriva B ∨ C. Es la única regla de inferencia necesaria en demostradores automáticos de teoremas y compiladores de Prolog.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                4. Falacias Formales
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Confundir la condición suficiente con la necesaria genera falacias estructurales que rompen la solidez de algoritmos de toma de decisiones en IA.
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
                  <Info size={15} className="text-amber-400" /> {validation.ruleInfo.name}
                </h4>
                <button onClick={() => setIsMethodInfoOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-100">
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs text-zinc-400 mt-3 leading-relaxed">
                {validation.ruleInfo.desc}
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE AYUDA CON CATÁLOGO DE INFERENCIAS DE 1 CLIC */}
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
                  <Binary size={16} className="text-amber-400" />
                  <h3 className="text-base font-serif font-bold text-zinc-100">Catálogo Canónico de Reglas de Inferencia</h3>
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
                        setPremisesInput(ex.premises);
                        setConclusionInput(ex.conclusion);
                        setIsHelpOpen(false);
                      }}
                      className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-left transition-all flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-[10px] font-mono text-amber-400/90 block font-semibold">{ex.category}</span>
                        <span className="font-mono text-zinc-200 text-xs block font-bold truncate">
                          [{ex.premises}] ⊢ {ex.conclusion}
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