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
  Cpu,
  BrainCircuit,
  Loader2,
  Quote
} from "lucide-react";
import { useAIContext } from "@/lib/context/ai-context";
import {
  fetchUserHistory,
  saveUserCalculation,
  deleteUserHistory,
  type HistoryItem,
} from "@/lib/supabase/history";

// -----------------------------------------------------------------------------
// CATÁLOGO DE EJEMPLOS
// -----------------------------------------------------------------------------
interface ModuleExample {
  category: string;
  formula: string;
  pText: string;
  qText: string;
  rText: string;
  desc: string;
}

const MODULE_EXAMPLES: ModuleExample[] = [
  {
    category: "Implicación y Recíproca",
    formula: "(p → q) ∧ (¬p → ¬q)",
    pText: "estudio para el examen",
    qText: "apruebo la materia",
    rText: "",
    desc: "Si estudio apruebo, y si no estudio no apruebo (Doble implicación intuitiva).",
  },
  {
    category: "Implicación Condicional",
    formula: "(p ∧ q) → r",
    pText: "el servidor responde",
    qText: "la base de datos está activa",
    rText: "la aplicación funciona",
    desc: "Si el servidor responde y la BD está activa, la app funciona.",
  },
  {
    category: "Leyes de De Morgan (Tautología)",
    formula: "¬(p ∧ q) ↔ (¬p ∨ ¬q)",
    pText: "es fin de semana",
    qText: "tengo vacaciones",
    rText: "",
    desc: "Equivalencia lógica universal de negación de conjunciones.",
  },
  {
    category: "Modus Ponens (Inferencia)",
    formula: "((p → q) ∧ p) → q",
    pText: "compilo el código fuente",
    qText: "se genera el archivo binario",
    rText: "",
    desc: "Tautología fundamental de deducción lógica.",
  },
  {
    category: "Disyunción Exclusiva (XOR)",
    formula: "p ⊕ q",
    pText: "el interruptor está en encendido",
    qText: "el interruptor está en apagado",
    rText: "",
    desc: "O bien está encendido, o bien está apagado (no ambos).",
  },
  {
    category: "Tercero Excluido",
    formula: "p ∨ ¬p",
    pText: "el sistema es determinista",
    qText: "",
    rText: "",
    desc: "Principio clásico: una proposición es verdadera o su negación lo es.",
  },
];

// =============================================================================
// PARSER Y TRANS PILADOR SEMÁNTICO (LÓGICA FORMAL ➔ ESPAÑOL)
// =============================================================================
type LogicAST =
  | { type: "var"; name: string }
  | { type: "not"; operand: LogicAST }
  | { type: "and"; left: LogicAST; right: LogicAST }
  | { type: "or"; left: LogicAST; right: LogicAST }
  | { type: "xor"; left: LogicAST; right: LogicAST }
  | { type: "implies"; left: LogicAST; right: LogicAST }
  | { type: "iff"; left: LogicAST; right: LogicAST };

function tokenizeLogic(expr: string): string[] {
  let s = expr.replace(/\s+/g, "");
  s = s.replace(/<->|↔/g, " ↔ ");
  s = s.replace(/->|→/g, " → ");
  s = s.replace(/xor|⊕/g, " ⊕ ");
  s = s.replace(/and|∧|&/g, " ∧ ");
  s = s.replace(/or|∨|\|/g, " ∨ ");
  s = s.replace(/not|¬|~|!/g, " ¬ ");
  s = s.replace(/\(/g, " ( ");
  s = s.replace(/\)/g, " ) ");
  return s.trim().split(/\s+/).filter(Boolean);
}

function parseLogicTokens(tokens: string[]): LogicAST {
  let pos = 0;

  function parseIff(): LogicAST {
    let node = parseImplies();
    while (pos < tokens.length && tokens[pos] === "↔") {
      pos++;
      const right = parseImplies();
      node = { type: "iff", left: node, right };
    }
    return node;
  }

  function parseImplies(): LogicAST {
    let node = parseOr();
    if (pos < tokens.length && tokens[pos] === "→") {
      pos++;
      const right = parseImplies(); // Asociativa por la derecha
      node = { type: "implies", left: node, right };
    }
    return node;
  }

  function parseOr(): LogicAST {
    let node = parseAnd();
    while (pos < tokens.length && (tokens[pos] === "∨" || tokens[pos] === "⊕")) {
      const op = tokens[pos];
      pos++;
      const right = parseAnd();
      node = op === "∨" ? { type: "or", left: node, right } : { type: "xor", left: node, right };
    }
    return node;
  }

  function parseAnd(): LogicAST {
    let node = parseNot();
    while (pos < tokens.length && tokens[pos] === "∧") {
      pos++;
      const right = parseNot();
      node = { type: "and", left: node, right };
    }
    return node;
  }

  function parseNot(): LogicAST {
    if (pos < tokens.length && tokens[pos] === "¬") {
      pos++;
      return { type: "not", operand: parseNot() };
    }
    return parsePrimary();
  }

  function parsePrimary(): LogicAST {
    const token = tokens[pos++];
    if (token === "(") {
      const node = parseIff();
      if (tokens[pos] === ")") pos++;
      return node;
    }
    return { type: "var", name: token || "p" };
  }

  return parseIff();
}

function astToSpanish(ast: LogicAST, propTexts: Record<string, string>): string {
  function getText(v: string) {
    return propTexts[v] ? propTexts[v].trim() : `[${v}]`;
  }

  switch (ast.type) {
    case "var":
      return getText(ast.name);

    case "not":
      if (ast.operand.type === "var") {
        const t = getText(ast.operand.name);
        return t.startsWith("no ") ? t.replace(/^no\s+/, "") : `no ${t}`;
      }
      return `no es cierto que (${astToSpanish(ast.operand, propTexts)})`;

    case "and":
      return `${astToSpanish(ast.left, propTexts)} y ${astToSpanish(ast.right, propTexts)}`;

    case "or":
      return `${astToSpanish(ast.left, propTexts)} o ${astToSpanish(ast.right, propTexts)}`;

    case "xor":
      return `o bien ${astToSpanish(ast.left, propTexts)}, o bien ${astToSpanish(ast.right, propTexts)}`;

    case "implies":
      return `si ${astToSpanish(ast.left, propTexts)}, entonces ${astToSpanish(ast.right, propTexts)}`;

    case "iff":
      return `${astToSpanish(ast.left, propTexts)} si y solo si ${astToSpanish(ast.right, propTexts)}`;
  }
}

function translateLogicToSpanish(formula: string, propTexts: Record<string, string>): string {
  try {
    const tokens = tokenizeLogic(formula);
    if (tokens.length === 0) return "";
    const ast = parseLogicTokens(tokens);
    const result = astToSpanish(ast, propTexts);
    // Capitalizar primera letra y cerrar con punto
    return result.charAt(0).toUpperCase() + result.slice(1) + ".";
  } catch {
    return "Estructura lógica en evaluación...";
  }
}

// Evaluador Booleano para la Tabla de Verdad
function evaluateLogicExpression(expr: string, state: Record<string, boolean>): boolean {
  try {
    let s = expr;
    s = s.replace(/↔|<->/g, "===");
    s = s.replace(/⊕|\bxor\b/g, "!==");
    s = s.replace(/→|->/g, "<=");
    s = s.replace(/∧|\band\b/g, "&&");
    s = s.replace(/∨|\bor\b/g, "||");
    s = s.replace(/¬|\bnot\b|~/g, "!");

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

export default function PropositionsView({
  viewMode,
  initialExpression = "",
}: {
  viewMode: "calc" | "steps" | "theory";
  initialExpression?: string;
}) {
  const [formula, setFormula] = useState<string>(
    initialExpression || "(p → q) ∧ (¬p → ¬q)"
  );

  // Variables contextuales dinámicas
  const [propTexts, setPropTexts] = useState<Record<string, string>>({
    p: "estudio para el examen",
    q: "apruebo la materia",
    r: "obtengo la beca",
  });

  // Modal para formalizar con IA en lenguaje natural
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [naturalQuery, setNaturalQuery] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [copiedTranslation, setCopiedTranslation] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMethodInfoOpen, setIsMethodInfoOpen] = useState(false);

  const { setAIContext, injectedExpression, clearInjectedExpression } = useAIContext();

  // Detectar variables atómicas (p, q, r, s...)
  const detectedVariables = useMemo(() => {
    const vars = Array.from(new Set(formula.match(/\b[p-z]\b/g) || [])).sort();
    return vars.length > 0 ? vars : ["p", "q"];
  }, [formula]);

  // Generar la Traducción Semántica en Español en tiempo real
  const naturalLanguageTranslation = useMemo(() => {
    return translateLogicToSpanish(formula, propTexts);
  }, [formula, propTexts]);

  // Generar la Tabla de Verdad (2^n filas)
  const truthTable = useMemo(() => {
    const vars = detectedVariables;
    const n = vars.length;
    const totalRows = Math.pow(2, n);
    const rows = [];
    let trueCount = 0;

    for (let i = 0; i < totalRows; i++) {
      const state: Record<string, boolean> = {};
      vars.forEach((v, vIdx) => {
        const period = Math.pow(2, n - 1 - vIdx);
        state[v] = Math.floor(i / period) % 2 === 0;
      });

      const result = evaluateLogicExpression(formula, state);
      if (result) trueCount++;

      rows.push({ id: i + 1, state, result });
    }

    let classification: "Tautología" | "Contradicción" | "Contingencia" = "Contingencia";
    if (trueCount === totalRows) classification = "Tautología";
    else if (trueCount === 0) classification = "Contradicción";

    return { vars, rows, totalRows, trueCount, classification };
  }, [formula, detectedVariables]);

  // Traducción a Código Computacional
  const codeTranslation = useMemo(() => {
    let py = formula
      .replace(/∧/g, " and ")
      .replace(/∨/g, " or ")
      .replace(/¬/g, " not ")
      .replace(/→/g, " <= ")
      .replace(/↔/g, " == ")
      .replace(/⊕/g, " != ");

    let js = formula
      .replace(/∧/g, " && ")
      .replace(/∨/g, " || ")
      .replace(/¬/g, "!")
      .replace(/→/g, " ? ")
      .replace(/↔/g, " === ")
      .replace(/⊕/g, " !== ");

    return {
      python: py.replace(/\s+/g, " ").trim(),
      javascript: js.replace(/\s+/g, " ").trim(),
    };
  }, [formula]);

  // Sincronización con ReSolve AI
  useEffect(() => {
    setAIContext({
      module: "Matemáticas II",
      subtopic: "Lógica Proposicional",
      expression: formula,
      result: `${truthTable.classification} (${truthTable.trueCount}/${truthTable.totalRows} V)`,
      details: `Lectura: "${naturalLanguageTranslation}". Variables: [${truthTable.vars.join(", ")}]`,
    });
  }, [formula, truthTable, naturalLanguageTranslation, setAIContext]);

  // Inyecciones inversas desde el chat
  useEffect(() => {
    if (injectedExpression) {
      setFormula(injectedExpression);
      clearInjectedExpression();
    }
  }, [injectedExpression, clearInjectedExpression]);

  // Historial de Supabase
  useEffect(() => {
    fetchUserHistory("mat2", "proposiciones").then((data) => setHistory(data));
  }, []);

  const saveCalculation = async () => {
    if (!formula.trim()) return;
    const summary = `${truthTable.classification} | "${naturalLanguageTranslation.slice(0, 40)}..."`;
    await saveUserCalculation("mat2", "proposiciones", formula, summary);
    const refreshed = await fetchUserHistory("mat2", "proposiciones");
    setHistory(refreshed);
  };

  const clearHistory = async () => {
    await deleteUserHistory("proposiciones");
    setHistory([]);
  };

  const handleCopyFormula = () => {
    navigator.clipboard.writeText(formula);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleCopyTranslation = () => {
    navigator.clipboard.writeText(naturalLanguageTranslation);
    setCopiedTranslation(true);
    setTimeout(() => setCopiedTranslation(false), 1500);
  };

  // Formalizador de IA: extrae FÓRMULA Y DICCIONARIO DE VARIABLES
  const handleFormalizeWithAI = async () => {
    if (!naturalQuery.trim() || isTranslating) return;
    setIsTranslating(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: "Matemáticas II",
          subtopic: "Lógica Proposicional",
          userPrompt: `Formaliza este enunciado en español: "${naturalQuery}".
Extrae las proposiciones simples y la fórmula lógica compuesta.
DEBES devolver al final DOS etiquetas estrictas:
1. El diccionario de variables con su significado en minúsculas en formato JSON:
:::VARS: {"p": "significado", "q": "significado"}:::
2. La fórmula proposicional simbólica con conectores estándar (∧, ∨, ¬, →, ↔, ⊕):
:::INJECT_EQUATION: fórmula:::`,
        }),
      });

      const data = await res.json();

      // Extraer y aplicar las variables contextuales
      const varsMatch = data.reply?.match(/:::VARS:\s*(\{[\s\S]*?\})\s*:::/);
      if (varsMatch) {
        try {
          const parsedVars = JSON.parse(varsMatch[1]);
          setPropTexts(parsedVars);
        } catch {}
      }

      // Extraer y aplicar la fórmula
      const eqMatch = data.reply?.match(/:::INJECT_EQUATION:\s*(.*?):::/);
      if (eqMatch) {
        setFormula(eqMatch[1].trim());
        setIsAIPanelOpen(false);
        setNaturalQuery("");
      }
    } catch {
      // Error silencioso
    } finally {
      setIsTranslating(false);
    }
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
          
          {/* FILA SUPERIOR: CONSOLA Y RESULTADOS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 shrink-0">
            
            {/* Consola de Entrada Lógica */}
            <div className="lg:col-span-8 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden">
              <div className="pointer-events-none absolute -top-16 -left-16 w-48 h-48 bg-zinc-700/10 rounded-full blur-3xl" />

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-2">
                    <Binary size={14} className="text-zinc-500" />
                    Consola Lógica Proposicional
                  </span>

                  <div className="flex items-center gap-2">
                    {/* Botón para abrir el formalizador por IA */}
                    <button
                      type="button"
                      onClick={() => setIsAIPanelOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-[11px] font-mono text-amber-300 transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      <BrainCircuit size={13} className="text-amber-400" />
                      <span>Lenguaje Natural ➔ Símbolos</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsHelpOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-800 text-[11px] font-mono text-zinc-300 transition-colors flex items-center gap-1"
                    >
                      <HelpCircle size={13} className="text-zinc-400" />
                      <span>Guía</span>
                    </button>
                  </div>
                </div>

                {/* Input de la Fórmula */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                    <span>Expresión Lógica Proposicional:</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Conectores: ∧, ∨, ¬, →, ↔, ⊕</span>
                  </label>
                  <input
                    type="text"
                    value={formula}
                    onChange={(e) => setFormula(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveCalculation();
                    }}
                    placeholder="Ej: (p → q) ∧ (¬p → ¬q)"
                    className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-2xl px-5 py-3.5 font-mono text-base lg:text-lg text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-all shadow-inner"
                  />
                </div>

                {/* TARJETA DE TRADUCCIÓN SEMÁNTICA A LENGUAJE NATURAL */}
                <div className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 space-y-1.5 shadow-inner">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-400 font-semibold flex items-center gap-1.5">
                      <Quote size={12} /> Interpretación en Lenguaje Natural (Español)
                    </span>
                    <button
                      onClick={handleCopyTranslation}
                      className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-mono transition-colors"
                    >
                      {copiedTranslation ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      {copiedTranslation ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                  <p className="text-xs lg:text-sm font-sans text-zinc-200 leading-relaxed font-medium italic">
                    "{naturalLanguageTranslation}"
                  </p>
                </div>

                {/* Asignador de Contexto en Lenguaje Natural de Variables */}
                <div className="p-3.5 rounded-2xl bg-zinc-950/40 border border-zinc-800/60 space-y-2">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
                    Variables Atómicas Detectadas (Modifica su significado para ver cambiar la frase arriba):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {truthTable.vars.map((v) => (
                      <div key={v} className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800/80 px-2.5 py-1.5 rounded-xl text-xs font-mono">
                        <strong className="text-amber-400">{v}:</strong>
                        <input
                          type="text"
                          value={propTexts[v] || ""}
                          onChange={(e) => setPropTexts({ ...propTexts, [v]: e.target.value })}
                          placeholder={`Significado de ${v}...`}
                          className="bg-transparent text-zinc-300 text-[11px] outline-none w-full font-sans"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Botones de Teclado Lógico */}
              <div className="relative z-10 flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-zinc-800/60">
                {LOGIC_KEYS.map((k) => (
                  <button
                    key={k.label}
                    onClick={() => setFormula((prev) => prev + k.val)}
                    className="h-10 min-w-[42px] px-3 bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-600 hover:bg-zinc-800/80 text-zinc-200 rounded-xl font-mono text-sm font-medium transition-all active:scale-95 shadow-sm backdrop-blur-sm flex items-center justify-center"
                  >
                    {k.label}
                  </button>
                ))}

                <button
                  onClick={() => void saveCalculation()}
                  className="h-10 px-5 bg-zinc-100 text-zinc-950 rounded-xl text-xs font-semibold hover:bg-zinc-200 hover:scale-[1.02] transition-all flex items-center gap-2 shadow-lg shadow-zinc-100/5 ml-auto active:scale-95"
                >
                  <CornerDownLeft size={14} /> Evaluar Tabla
                </button>

                <button
                  onClick={() => setFormula("")}
                  className="h-10 px-3.5 bg-zinc-900/50 border border-zinc-800/80 text-zinc-400 hover:text-red-400 hover:border-red-900/40 rounded-xl text-xs font-medium transition-colors"
                >
                  Limpiar
                </button>
              </div>
            </div>

            {/* Caja Derecha: Clasificación Ontológica */}
            <div className="lg:col-span-4 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden">
              <div className="pointer-events-none absolute -bottom-16 -right-16 w-48 h-48 bg-zinc-700/10 rounded-full blur-3xl" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold">
                    Diagnóstico Lógico
                  </span>
                  {formula && (
                    <button
                      onClick={handleCopyFormula}
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
                      key={truthTable.classification}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      transition={{ duration: 0.2 }}
                      className={`text-3xl lg:text-4xl font-serif font-bold tracking-tight ${
                        truthTable.classification === "Tautología"
                          ? "text-emerald-400"
                          : truthTable.classification === "Contradicción"
                          ? "text-red-400"
                          : "text-amber-400"
                      }`}
                    >
                      {truthTable.classification}
                    </motion.div>
                  </AnimatePresence>
                  <span className="text-[11px] font-mono text-zinc-400 mt-1 block">
                    {truthTable.trueCount} de {truthTable.totalRows} estados son Verdaderos
                  </span>
                </div>

                {/* Transpilación a Código */}
                <div className="space-y-2 mt-2 font-mono text-xs">
                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 block">Equivalencia en Python:</span>
                    <strong className="text-sky-300 text-[11px] truncate block">{codeTranslation.python}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 block">Equivalencia en JavaScript / C++:</span>
                    <strong className="text-emerald-300 text-[11px] truncate block">{codeTranslation.javascript}</strong>
                  </div>
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
                    <span>Propiedades Booleanas de la Fórmula</span>
                  </div>
                  <ChevronRight size={12} className="text-zinc-600 group-hover:text-zinc-300 shrink-0" />
                </button>
              </div>
            </div>
          </div>

          {/* FILA INFERIOR: TABLA DE VERDAD + HISTORIAL */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
            
            {/* Panel Izquierdo: Tabla de Verdad */}
            <div className="lg:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <ListOrdered size={15} className="text-zinc-400" /> Tabla de Verdad Completa ({truthTable.totalRows} renglones)
                </span>
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900/80 border border-zinc-800/80 px-2.5 py-1 rounded-full">
                  2^{truthTable.vars.length} Estados
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto mt-4 custom-scrollbar border border-zinc-800/60 rounded-2xl">
                <table className="w-full text-left font-mono text-xs divide-y divide-zinc-800">
                  <thead className="bg-zinc-950 text-zinc-400 sticky top-0 z-10">
                    <tr>
                      <th className="p-3 w-12 text-center text-[10px] text-zinc-600">#</th>
                      {truthTable.vars.map((v) => (
                        <th key={v} className="p-3 text-center">{v}</th>
                      ))}
                      <th className="p-3 text-right text-zinc-100 font-bold">Resultado ({formula})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40 bg-zinc-900/20 text-zinc-300">
                    {truthTable.rows.map((row) => (
                      <tr key={row.id} className="hover:bg-zinc-900/40 transition-colors">
                        <td className="p-3 text-center text-zinc-600 text-[10px]">{row.id}</td>
                        {truthTable.vars.map((v) => (
                          <td key={v} className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              row.state[v] ? "text-emerald-400 bg-emerald-950/30" : "text-zinc-500 bg-zinc-950/50"
                            }`}>
                              {row.state[v] ? "V" : "F"}
                            </span>
                          </td>
                        ))}
                        <td className="p-3 text-right">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono ${
                            row.result ? "text-emerald-400 bg-emerald-950/50 border border-emerald-900/50" : "text-red-400 bg-red-950/30 border border-red-900/40"
                          }`}>
                            {row.result ? "V (1)" : "F (0)"}
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
                  <History size={15} className="text-zinc-400" /> Historial Lógico
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
                    <p>Sin fórmulas guardadas.</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Presiona Evaluar para registrar.</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setFormula(item.expression)}
                      className="group p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700 hover:bg-zinc-900/80 cursor-pointer transition-all flex items-center justify-between text-xs"
                    >
                      <div className="truncate pr-2 font-mono text-zinc-300 group-hover:text-zinc-100 transition-colors">
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

      {/* MODO 2: PASO A PASO */}
      {viewMode === "steps" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-5 shrink-0">
            <div>
              <h3 className="text-xl font-serif font-bold text-zinc-100">
                Deducción Proposicional Paso a Paso
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                Fórmula: <span className="text-zinc-200 font-semibold">{formula}</span>
              </p>
            </div>
            <div className="text-xs font-mono px-4 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-zinc-300 shadow-inner">
              Clasificación: <strong className="text-emerald-400 text-sm font-serif">{truthTable.classification}</strong>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 flex flex-col gap-2">
              <span className="text-xs font-mono font-semibold text-zinc-200">1. Identificación de Variables Atómicas</span>
              <p className="text-xs text-zinc-400">El número de estados de verdad necesarios es 2ⁿ, donde n es la cantidad de proposiciones simples:</p>
              <div className="p-3 rounded-xl bg-zinc-950 font-mono text-xs text-emerald-400 text-center font-bold">
                n = {truthTable.vars.length} variables ({truthTable.vars.join(", ")}) ⟹ 2^{truthTable.vars.length} = {truthTable.totalRows} filas de evaluación
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 flex flex-col gap-2">
              <span className="text-xs font-mono font-semibold text-zinc-200">2. Jerarquía de Conectores Lógicos Aplicada</span>
              <p className="text-xs text-zinc-400">Orden de precedencia formal en la evaluación booleana:</p>
              <div className="p-3 rounded-xl bg-zinc-950 font-mono text-xs text-zinc-300 text-center">
                1. Paréntesis ( ) ➔ 2. Negación ¬ ➔ 3. Conjunción ∧ ➔ 4. Disyunción ∨ ➔ 5. Condicional → ➔ 6. Bicondicional ↔
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 flex flex-col gap-2">
              <span className="text-xs font-mono font-semibold text-zinc-200">3. Veredicto Ontológico Final</span>
              <p className="text-xs text-zinc-400">Interpretación del vector de verdad de la columna principal:</p>
              <div className="p-3 rounded-xl bg-zinc-950 font-mono text-xs text-emerald-400 text-center font-bold">
                {truthTable.classification === "Tautología" && "Todos los valores son Verdaderos (1). La proposición es válida en todo modelo."}
                {truthTable.classification === "Contradicción" && "Todos los valores son Falsos (0). Es insatisfactible (inconsistente)."}
                {truthTable.classification === "Contingencia" && `Presenta ${truthTable.trueCount} estados verdaderos y ${truthTable.totalRows - truthTable.trueCount} falsos. Su verdad depende de las premisas.`}
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
              <BookOpen size={12} /> Lógica Matemática y Computacional
            </div>
            <h3 className="text-2xl font-serif font-bold text-zinc-100">
              Álgebra Booleana y Verificación Formal de Software
            </h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-3xl">
              La lógica proposicional es el lenguaje formal sobre el que se diseñan los circuitos digitales de CPU, los condicionales en lenguajes de programación y la verificación formal de algoritmos críticos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                1. Condicional y Cortocircuito (p → q)
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                En lógica formal, p → q es falsa ÚNICAMENTE cuando la premisa es verdadera y la conclusión falsa. Equivale a ¬p ∨ q, base del cortocircuito en condicionales `if (!p || q)`.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                2. Leyes de De Morgan y Optimización
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                ¬(p ∧ q) ≡ ¬p ∨ ¬q. Los compiladores modernos aplican estas leyes para simplificar árboles sintácticos y reducir el número de instrucciones de salto condicional a nivel ensamblador.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DEL FORMALIZADOR DE LENGUAJE NATURAL CON IA */}
      <AnimatePresence>
        {isAIPanelOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-xl select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-xl border border-zinc-800/80 bg-zinc-950/95 backdrop-blur-2xl rounded-3xl p-6 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <BrainCircuit size={16} />
                  </div>
                  <div>
                    <h3 className="text-base font-serif font-bold text-zinc-100">Formalizador de Lenguaje Natural a Símbolos</h3>
                    <p className="text-xs text-zinc-400">Escribe cualquier frase y la IA extraerá las variables y la fórmula lógica</p>
                  </div>
                </div>
                <button onClick={() => setIsAIPanelOpen(false)} className="p-1.5 text-zinc-400 hover:text-zinc-100">
                  <X size={16} />
                </button>
              </div>

              <div className="py-4 space-y-3 text-xs">
                <p className="text-zinc-400 leading-relaxed">
                  Ingresa un razonamiento en español (ejemplo: "Si estudio apruebo, pero si no estudio repruebo"):
                </p>
                <textarea
                  rows={3}
                  value={naturalQuery}
                  onChange={(e) => setNaturalQuery(e.target.value)}
                  placeholder="Ej: Si el servidor está activo y no hay sobrecarga entonces la aplicación responde rápido..."
                  className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/60 font-sans resize-none"
                />

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[10px] font-mono text-zinc-500">Mapeará p, q, r al contexto de tu frase</span>
                  <button
                    type="button"
                    onClick={handleFormalizeWithAI}
                    disabled={isTranslating || !naturalQuery.trim()}
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all disabled:opacity-40"
                  >
                    {isTranslating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    <span>{isTranslating ? "Extrayendo variables..." : "Formalizar a Símbolos"}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE AYUDA GENERAL CON CATÁLOGO DE EJEMPLOS */}
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
                <h3 className="text-base font-serif font-bold text-zinc-100">Guía de Lógica Proposicional</h3>
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
                        setFormula(ex.formula);
                        setPropTexts({ p: ex.pText, q: ex.qText, r: ex.rText });
                        setIsHelpOpen(false);
                      }}
                      className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-left transition-all flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-[10px] font-mono text-amber-400/90 block font-semibold">{ex.category}</span>
                        <span className="font-mono text-zinc-200 text-xs block font-bold truncate">{ex.formula}</span>
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