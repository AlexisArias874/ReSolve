"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Code2, HelpCircle, Terminal, Eye, Cpu, ArrowDownToLine, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useAIContext, type AIMessage } from "@/lib/context/ai-context";

const AI_MODELS = [
  { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B", badge: "Más Preciso" },
  { id: "qwen/qwen3.6-27b", name: "Qwen 3.6 27B", badge: "Matemáticas" },
  { id: "qwen/qwen3.8-27b", name: "Qwen 3.8 27B", badge: "Lógica" },
  { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B", badge: "Rápido" },
];

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  injectableEquation?: string | null;
}

// Extractor de doble capa (Etiqueta explícita + Detección heurística de respaldo)
function parseAndExtractEquation(rawText: string): { cleanText: string; extractedEquation: string | null } {
  let cleanText = rawText;
  let extractedEquation: string | null = null;

  // 1. Detección por etiqueta explícita
  const injectMatch = rawText.match(/:::INJECT_EQUATION:\s*(.*?):::/);
  if (injectMatch) {
    extractedEquation = injectMatch[1].trim();
    cleanText = rawText.replace(/:::INJECT_EQUATION:\s*(.*?):::/, "").trim();
  } else {
    // 2. RESPALDO INTELIGENTE: Si el modelo olvidó la etiqueta, buscar la ecuación final en el texto
    // Busca patrones como P(x) = (x-2)(x-1)... o ecuaciones ... = 0
    const polyMatch = rawText.match(/(?:P\([a-zA-Z]\)\s*=\s*)([a-zA-Z0-9\^+\-*/().\s]+)/);
    const eqZeroMatch = rawText.match(/([a-zA-Z0-9\^+\-*/().\s]+=\s*0)/);
    const blockMathMatch = rawText.match(/\$\$\s*([^\$\n]+=[^\$\n]+)\s*\$\$/);

    if (polyMatch) {
      let candidate = polyMatch[1].trim().replace(/\.$/, "");
      if (!candidate.includes("=")) candidate += " = 0";
      extractedEquation = candidate;
    } else if (eqZeroMatch) {
      extractedEquation = eqZeroMatch[1].trim();
    } else if (blockMathMatch) {
      extractedEquation = blockMathMatch[1].trim();
    }
  }

  // Limpiar cualquier residuo de formato en la ecuación extraída
  if (extractedEquation) {
    extractedEquation = extractedEquation
      .replace(/\\mathbf\{([^}]+)\}/g, "$1")
      .replace(/\\boxed\{([^}]+)\}/g, "$1")
      .replace(/[\$]/g, "")
      .trim();
  }

  return { cleanText, extractedEquation };
}

function safeFormatMath(content: string): string {
  if (!content) return "";
  let text = content;

  text = text.replace(/([^\n])\s*(#{1,4}\s+)/g, "$1\n\n$2");
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, eq) => `\n\n$$\n${eq.trim()}\n$$\n\n`);
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, eq) => ` $${eq.trim()}$ `);
  text = text.replace(/\\boxed\{([^}]+)\}/g, (_, val) => `\n\n$$\\mathbf{${val.trim()}}$$\n\n`);
  text = text.replace(/([a-zA-ZáéíóúÁÉÍÓÚñÑ])(\d)/g, "$1 $2");
  text = text.replace(/(\d)([a-zA-ZáéíóúÁÉÍÓÚñÑ])/g, "$1 $2");

  const displayMathCount = (text.match(/\$\$/g) || []).length;
  if (displayMathCount % 2 !== 0) {
    text += "\n$$\n";
  }

  text = text.replace(/\n{3,}/g, "\n\n");
  return text;
}

export default function AIAssistant() {
  const { activeContext, injectToCalculator } = useAIContext();
  const [selectedModel, setSelectedModel] = useState<string>("openai/gpt-oss-120b");
  const [injectedSuccessId, setInjectedSuccessId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "👋 Hola. Puedes pegarme problemas complejos, ejercicios de examen o enunciados. Deduciré el procedimiento y podrás cargar la ecuación en tu calculadora con un solo clic.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleInjectClick = (msgId: string, eq: string) => {
    injectToCalculator(eq);
    setInjectedSuccessId(msgId);
    setTimeout(() => setInjectedSuccessId(null), 2500);
  };

  const sendMessage = async (promptText?: string) => {
    const textToSend = (promptText || input).trim();
    if (!textToSend || loading) return;

    const userMsg: Message = { id: String(Date.now()), role: "user", text: textToSend };
    setMessages((prev) => [...prev, userMsg]);
    if (!promptText) setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: activeContext.module,
          subtopic: activeContext.subtopic,
          expression: activeContext.expression,
          result: activeContext.result,
          details: activeContext.details,
          userPrompt: textToSend,
          model: selectedModel,
        }),
      });

      const data = await res.json();
      const rawReply = data.reply || "No se recibió respuesta.";
      const { cleanText, extractedEquation } = parseAndExtractEquation(rawReply);

      const aiReply: Message = {
        id: String(Date.now() + 1),
        role: "assistant",
        text: cleanText,
        injectableEquation: extractedEquation,
      };
      setMessages((prev) => [...prev, aiReply]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: "assistant",
          text: "⚠️ Error de red al intentar conectar con el asistente.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 border border-zinc-800/60 rounded-3xl bg-zinc-900/30 backdrop-blur-md p-4 flex flex-col justify-between shadow-xl shadow-black/20">
      
      {/* Selector de Motor de IA */}
      <div className="mb-2.5 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 text-[10px] uppercase font-mono text-zinc-400 tracking-wider">
          <Cpu size={12} className="text-zinc-500" />
          <span>Motor:</span>
        </div>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl px-2.5 py-1 text-[11px] font-mono text-zinc-200 focus:outline-none focus:border-zinc-600 transition-colors cursor-pointer"
        >
          {AI_MODELS.map((m) => (
            <option key={m.id} value={m.id} className="bg-zinc-950 text-zinc-200">
              {m.name} ({m.badge})
            </option>
          ))}
        </select>
      </div>

      {/* Insignia de Contexto */}
      {activeContext.expression && (
        <div className="mb-2 px-3 py-1.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex items-center gap-2 text-[11px] font-mono text-zinc-400 shrink-0">
          <Eye size={12} className="text-emerald-400 shrink-0 animate-pulse" />
          <span className="truncate">
            <span className="text-zinc-200">{activeContext.expression}</span>
            {activeContext.result && activeContext.result !== "--" && (
              <span className="text-emerald-400 font-bold"> = {activeContext.result}</span>
            )}
          </span>
        </div>
      )}

      {/* Mensajes */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 text-xs">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`p-3.5 rounded-2xl leading-relaxed ${
              m.role === "assistant"
                ? "bg-zinc-900/80 border border-zinc-800/80 text-zinc-200"
                : "bg-zinc-100 text-zinc-950 font-medium ml-4 shadow-sm"
            }`}
          >
            {m.role === "assistant" ? (
              <div className="space-y-3">
                <div className="prose prose-invert prose-xs max-w-none space-y-2">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath, remarkBreaks]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      h1: ({ children }) => (
                        <h1 className="text-sm font-bold font-serif text-zinc-100 mt-3 mb-1.5 border-b border-zinc-800 pb-1">
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-xs font-bold font-serif text-zinc-100 mt-3 mb-1">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-xs font-semibold font-mono text-emerald-400/90 mt-3.5 mb-1 flex items-center gap-1.5">
                          {children}
                        </h3>
                      ),
                      p: ({ children }) => (
                        <p className="text-xs text-zinc-300 leading-relaxed my-2">
                          {children}
                        </p>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc pl-4 space-y-1.5 my-2 text-zinc-300">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal pl-4 space-y-2 my-2 text-zinc-200 font-medium">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => (
                        <li className="text-xs leading-relaxed text-zinc-300 font-normal">
                          {children}
                        </li>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold text-zinc-100">
                          {children}
                        </strong>
                      ),
                      hr: () => <hr className="my-3 border-zinc-800" />,
                    }}
                  >
                    {safeFormatMath(m.text)}
                  </ReactMarkdown>
                </div>

                {/* TARJETA INTERACTIVA DE INYECCIÓN A LA CALCULADORA */}
                {m.injectableEquation && (
                  <div className="mt-3 pt-3 border-t border-zinc-800/80 bg-zinc-950/60 -mx-3.5 -mb-3.5 p-3 rounded-b-2xl flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-zinc-500">Ecuación extraída:</span>
                      <span className="text-emerald-400 font-semibold truncate max-w-[170px]">
                        {m.injectableEquation}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleInjectClick(m.id, m.injectableEquation!)}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 ${
                        injectedSuccessId === m.id
                          ? "bg-emerald-500 text-zinc-950 font-bold"
                          : "bg-zinc-100 hover:bg-zinc-200 text-zinc-950"
                      }`}
                    >
                      {injectedSuccessId === m.id ? (
                        <>
                          <Check size={14} /> ¡Cargada en la Calculadora!
                        </>
                      ) : (
                        <>
                          <ArrowDownToLine size={14} /> Cargar en la Calculadora
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <span className="whitespace-pre-wrap">{m.text}</span>
            )}
          </div>
        ))}

        {loading && (
          <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/60 text-zinc-400 flex items-center gap-2 text-xs">
            <Loader2 size={14} className="animate-spin text-zinc-300" />
            <span>ReSolve AI deduciendo solución...</span>
          </div>
        )}
      </div>

      {/* Sugerencias Rápidas */}
      <div className="pt-3 border-t border-zinc-800/60 mt-3 flex flex-wrap gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => sendMessage("Explícame el procedimiento matemático paso a paso de este cálculo.")}
          className="px-2.5 py-1 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1"
        >
          <HelpCircle size={12} /> Explicar
        </button>
        <button
          type="button"
          onClick={() => sendMessage("Escribe un script en Python que resuelva esta operación paso a paso.")}
          className="px-2.5 py-1 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1"
        >
          <Code2 size={12} /> Código Python
        </button>
        <button
          type="button"
          onClick={() => sendMessage("¿En qué algoritmos o áreas de desarrollo de software se aplica este tema?")}
          className="px-2.5 py-1 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1"
        >
          <Terminal size={12} /> Uso en Software
        </button>
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="mt-3 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-2 flex items-center gap-2 focus-within:border-zinc-600 transition-colors shadow-inner shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe o pega un ejercicio..."
          className="flex-1 bg-transparent text-xs outline-none text-zinc-100 placeholder:text-zinc-600 px-2 py-1"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Enviar pregunta"
          className="p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors disabled:opacity-40"
        >
          <Send size={13} />
        </button>
      </form>
    </div>
  );
}