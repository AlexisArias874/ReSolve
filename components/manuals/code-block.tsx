"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  title: string;
  language: string;
  code: string;
  note?: string;
  print?: boolean;
}

export default function CodeBlock({ title, language, code, note, print = false }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* El navegador puede bloquear el portapapeles. */
    }
  };

  if (print) {
    return (
      <div style={{ margin: "14px 0", breakInside: "avoid" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: "11px", fontWeight: 700, color: "#292524" }}>
          {title}
        </div>
        <pre
          style={{
            margin: "5px 0 0",
            padding: "10px 12px",
            background: "#f5f5f4",
            border: "1px solid #d6d3d1",
            borderRadius: "3px",
            fontFamily: "'Courier New', monospace",
            fontSize: "8.5px",
            lineHeight: 1.45,
            color: "#292524",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {code}
        </pre>
        {note && <div style={{ marginTop: "4px", fontSize: "9px", color: "#78716c" }}>{note}</div>}
      </div>
    );
  }

  return (
    <div className="my-6 overflow-hidden rounded-lg border border-stone-300 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-stone-300 bg-stone-100 px-4 py-2.5">
        <div className="min-w-0">
          <span className="block text-xs font-semibold text-stone-800">{title}</span>
          <span className="block text-[9px] font-mono uppercase tracking-[0.16em] text-stone-400">
            {language}
          </span>
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded border border-stone-300 bg-white px-2.5 py-1.5 text-[10px] font-medium text-stone-600 transition-colors hover:border-stone-500 hover:text-stone-900"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre className="overflow-x-auto bg-[#fbfaf8] p-4 text-[11px] leading-6 text-stone-800">
        <code>{code}</code>
      </pre>
      {note && (
        <p className="border-t border-stone-200 px-4 py-2 text-[11px] leading-5 text-stone-500">
          {note}
        </p>
      )}
    </div>
  );
}
