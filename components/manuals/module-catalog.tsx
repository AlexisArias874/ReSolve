"use client";

import { MODULE_CATALOG, SUBTOPICS_BY_MODULE } from "@/lib/platform/catalog";

export default function ModuleCatalog({ print = false }: { print?: boolean }) {
  if (print) {
    return (
      <div style={{ margin: "16px 0" }}>
        {MODULE_CATALOG.map((module) => (
          <div
            key={module.id}
            style={{
              marginBottom: "10px",
              padding: "10px 12px",
              border: "1px solid #d6d3d1",
              borderRadius: "3px",
              breakInside: "avoid",
            }}
          >
            <div style={{ fontFamily: "Georgia, serif", fontSize: "14px", fontWeight: 700, color: "#1c1917" }}>
              {module.label}
            </div>
            <div style={{ marginTop: "2px", fontSize: "10px", color: "#78716c" }}>{module.desc}</div>
            <div style={{ marginTop: "6px", fontSize: "10px", lineHeight: 1.5, color: "#44403c" }}>
              {SUBTOPICS_BY_MODULE[module.id].map((subtopic) => subtopic.label).join(" · ")}
            </div>
          </div>
        ))}
        <div style={{ fontSize: "10px", color: "#78716c" }}>
          Calculadora Universal: problemas en lenguaje natural clasificados por IA.
        </div>
      </div>
    );
  }

  return (
    <div className="my-6 grid gap-4 sm:grid-cols-2">
      {MODULE_CATALOG.map((module) => (
        <div
          key={module.id}
          className="rounded-lg border border-stone-300 bg-white/60 p-4"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="font-serif text-lg font-semibold text-stone-900">{module.label}</h4>
            <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400">
              {module.id}
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-500">{module.desc}</p>
          <ul className="mt-3 space-y-1 border-t border-stone-200 pt-3">
            {SUBTOPICS_BY_MODULE[module.id].map((subtopic) => (
              <li key={subtopic.id} className="flex gap-2 text-xs leading-5 text-stone-600">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-stone-400" />
                <span>
                  <span className="font-medium text-stone-800">{subtopic.label}:</span>{" "}
                  {subtopic.desc}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="rounded-lg border border-stone-300 bg-stone-100/70 p-4 sm:col-span-2">
        <h4 className="font-serif text-lg font-semibold text-stone-900">Calculadora Universal</h4>
        <p className="mt-1 text-xs leading-5 text-stone-600">
          Recibe problemas en lenguaje natural, los clasifica y propone el módulo y el subtema
          adecuados. Es el acceso directo para enunciados que no están escritos como una fórmula.
        </p>
      </div>
    </div>
  );
}
