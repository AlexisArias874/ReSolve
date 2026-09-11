"use client";

import { useState } from "react";

const TABS = ["Calcular", "Paso a Paso", "Teoría"] as const;

export default function MethodTabs() {
  const [active, setActive] = useState<typeof TABS[number]>("Calcular");

  return (
    <div className="flex gap-2 border-b border-zinc-800 pb-2">
      {TABS.map((tab) => (
        <button
          key={tab}
          onClick={() => setActive(tab)}
          className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
            active === tab
              ? "bg-zinc-100 text-zinc-950"
              : "text-zinc-400 hover:text-zinc-100"
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
