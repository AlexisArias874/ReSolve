"use client";

import { motion } from "framer-motion";
import { Calculator, BrainCircuit, LineChart, ArrowRight, LogIn, User } from "lucide-react";
import Link from "next/link";
import { useState, useMemo, useEffect, useRef, memo } from "react";

// --- Pool de símbolos matemáticos ---
const SYMBOL_POOL = [
  "∫", "∬", "∭", "∮", "∂", "∇", "∆", "∑", "∏", "√", "∛", "∜",
  "α", "β", "γ", "δ", "ε", "ζ", "η", "θ", "λ", "μ", "π", "ρ", "σ", "φ", "ψ", "ω",
  "+", "−", "×", "÷", "±", "∓", "⋅", "∘",
  "≠", "≈", "≡", "≤", "≥", "≪", "≫", "∝",
  "∈", "∉", "⊂", "⊃", "⊆", "⊇", "∪", "∩", "∅", "∀", "∃",
  "∧", "∨", "¬", "⊕", "⊤", "⊥",
  "→", "↔", "⇒", "⇔", "↦",
  "∞", "ℵ", "ℏ", "℘"
];

interface SymbolSlotProps {
  slotIndex: number;
  col: number;
  row: number;
  cols: number;
  rows: number;
  totalSlots: number;
}

// Componente individual memorizado para evitar re-renders innecesarios
const SymbolSlot = memo(function SymbolSlot({
  slotIndex,
  col,
  row,
  cols,
  rows,
  totalSlots,
}: SymbolSlotProps) {
  // Símbolo inicial determinista (evita error de hidratación en SSR)
  const [currentChar, setCurrentChar] = useState(
    () => SYMBOL_POOL[slotIndex % SYMBOL_POOL.length]
  );
  const [animKey, setAnimKey] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Parámetros calculados para cada posición
  const params = useMemo(() => {
    const cellW = 100 / cols;
    const cellH = 100 / rows;
    
    // Dispersión sutil dentro de su cuadrante
    const pseudoRandom1 = ((slotIndex * 13) % 100) / 100 - 0.5;
    const pseudoRandom2 = ((slotIndex * 37) % 100) / 100 - 0.5;
    const jitterX = pseudoRandom1 * (cellW * 0.35);
    const jitterY = pseudoRandom2 * (cellH * 0.35);

    return {
      top: `${cellH * row + cellH / 2 + jitterY}%`,
      left: `${cellW * col + cellW / 2 + jitterX}%`,
      // Duración prolongada y visible (8 a 14 segundos)
      duration: 8 + (slotIndex % 7),
      // Retraso inicial escalonado para que no aparezcan todos juntos
      initialDelay: (slotIndex / totalSlots) * 5,
      moveX: pseudoRandom1 * 50,
      moveY: pseudoRandom2 * 50,
      rotate: pseudoRandom1 * 40,
      size: ["text-4xl", "text-5xl", "text-6xl"][slotIndex % 3],
    };
  }, [slotIndex, col, row, cols, rows, totalSlots]);

  // Selección del siguiente símbolo aleatorio diferente
  const pickNextSymbol = () => {
    let next = currentChar;
    while (next === currentChar) {
      next = SYMBOL_POOL[Math.floor(Math.random() * SYMBOL_POOL.length)];
    }
    return next;
  };

  // Al completar la animación de Framer Motion de forma natural
  const handleAnimationComplete = () => {
    setIsVisible(false);

    // Pausa breve antes de emerger nuevamente (entre 2 y 5 segundos)
    const restDuration = 2000 + Math.random() * 3000;
    timerRef.current = setTimeout(() => {
      setCurrentChar(pickNextSymbol());
      setAnimKey((prev) => prev + 1);
      setIsVisible(true);
    }, restDuration);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div
      className="absolute flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
      style={{ top: params.top, left: params.left }}
    >
      {isVisible && (
        <motion.div
          key={animKey}
          className={`${params.size} font-serif text-zinc-500/40 select-none cursor-default`}
          // Entra desde escala 0.7 y escala naturalmente a 1.0 (sin brincos raros)
          initial={{
            opacity: 0,
            scale: 0.7,
            x: 0,
            y: 0,
            rotate: 0,
          }}
          animate={{
            // Entra, se mantiene estable en el medio y sale gradualmente al final
            opacity: [0, 0.45, 0.5, 0.45, 0],
            scale: [0.7, 1.05, 1, 0.95, 0.7],
            x: [0, params.moveX * 0.5, params.moveX, params.moveX * 0.5, 0],
            y: [0, params.moveY * 0.5, params.moveY, params.moveY * 0.5, 0],
            rotate: [0, params.rotate * 0.5, params.rotate, params.rotate * 0.2, 0],
          }}
          transition={{
            duration: params.duration,
            ease: "easeInOut",
            times: [0, 0.2, 0.5, 0.8, 1], // El 60% del tiempo el símbolo está 100% visible
            delay: animKey === 0 ? params.initialDelay : 0,
          }}
          onAnimationComplete={handleAnimationComplete}
        >
          {currentChar}
        </motion.div>
      )}
    </div>
  );
});

// --- Fondo completo de símbolos ---
const BackgroundSymbols = () => {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const COLS = 5;
  const ROWS = 3;
  const TOTAL = COLS * ROWS;

  const slots = useMemo(
    () =>
      Array.from({ length: TOTAL }, (_, i) => ({
        id: i,
        col: i % COLS,
        row: Math.floor(i / COLS),
      })),
    [TOTAL]
  );

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Gradiente radial de fondo */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#09090b_90%)]" />

      {/* Renderizado de slots tras montaje (previene errores de SSR) */}
      {hasMounted &&
        slots.map((s) => (
          <SymbolSlot
            key={s.id}
            slotIndex={s.id}
            col={s.col}
            row={s.row}
            cols={COLS}
            rows={ROWS}
            totalSlots={TOTAL}
          />
        ))}
    </div>
  );
};

// --- Landing Page ---
export default function LandingPage() {
  const [isLoggedIn] = useState(false);

  return (
    <div className="relative min-h-screen bg-zinc-950 selection:bg-zinc-800 selection:text-zinc-100">
      <BackgroundSymbols />

      {/* Barra de Navegación */}
<nav className="fixed top-0 w-full border-b border-zinc-900 bg-zinc-950/70 backdrop-blur-md z-50">
  <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
    
    {/* Logo */}
    <Link href="/" className="flex items-center gap-2 shrink-0">
      <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center shadow-sm">
        <Calculator className="text-zinc-950" size={18} />
      </div>
      <span className="text-xl font-bold font-serif tracking-wide text-zinc-100">
        Re<span className="text-zinc-500">Solve</span>
      </span>
    </Link>

    {/* Acciones / Navegación */}
    <div className="flex items-center gap-4 shrink-0">
      {isLoggedIn ? (
        <div className="flex items-center gap-6 text-sm font-medium text-zinc-400">
          <Link href="/metodos" className="hover:text-zinc-100 transition-colors whitespace-nowrap">
            Métodos
          </Link>
          <Link href="/historial" className="hover:text-zinc-100 transition-colors whitespace-nowrap">
            Historial
          </Link>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-800 hover:bg-zinc-900 text-zinc-100 transition-all whitespace-nowrap">
            <User size={14} /> Perfil
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-4 text-sm font-medium">
          <Link
            href="/registro"
            className="text-zinc-400 hover:text-zinc-100 transition-colors whitespace-nowrap"
          >
            Regístrate
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-2 bg-zinc-100 text-zinc-950 px-4 py-2 rounded-full hover:bg-zinc-300 transition-colors font-medium whitespace-nowrap"
          >
            <LogIn size={16} /> Iniciar Sesión
          </Link>
        </div>
      )}
    </div>
  </div>
</nav>

      {/* Contenido Principal */}
      <div className="relative z-10">
        {/* Sección Hero */}
        <section className="pt-40 pb-20 px-6 flex flex-col items-center text-center max-w-4xl mx-auto">
          <motion.div
            className="flex flex-col items-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >

            <h1 className="text-5xl md:text-7xl font-serif leading-tight tracking-tight text-zinc-100 mb-6 drop-shadow-sm">
              El poder de las matemáticas,<br />
              <span className="text-zinc-500 italic">explicado paso a paso.</span>
            </h1>

            <p className="text-lg text-zinc-400 mb-10 max-w-2xl mx-auto font-light leading-relaxed">
              Proyecto analitico diseñado para estudiantes. 
              Resuelve desde cálculo diferencial hasta modelos de investigación de operaciones, 
              potenciado con contexto algorítmico y explicaciones claras.
            </p>

            <div className="flex justify-center">
              <Link href="/dashboard">
                <button className="flex items-center justify-center gap-2 bg-zinc-100 text-zinc-950 px-7 py-3.5 rounded-full font-medium hover:scale-105 transition-transform shadow-lg shadow-zinc-100/10">
                  Comenzar a calcular <ArrowRight size={18} />
                </button>
              </Link>
            </div>
          </motion.div>
        </section>

        {/* Sección de Características */}
        <section className="py-24 px-6 max-w-7xl mx-auto">
          <motion.div
            className="grid md:grid-cols-3 gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.15 } },
            }}
          >
            <motion.div
              variants={{ hidden: { opacity: 0, y: 25 }, visible: { opacity: 1, y: 0 } }}
              className="p-8 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md hover:bg-zinc-900/80 hover:border-zinc-700/60 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-6">
                <Calculator className="text-zinc-100" size={24} />
              </div>
              <h3 className="text-xl font-serif text-zinc-100 mb-3">Lógica Computacional</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Traduce tablas de verdad y proposiciones lógicas directamente a código ejecutable en Python, C++ y JavaScript.
              </p>
            </motion.div>

            <motion.div
              variants={{ hidden: { opacity: 0, y: 25 }, visible: { opacity: 1, y: 0 } }}
              className="p-8 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md hover:bg-zinc-900/80 hover:border-zinc-700/60 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-6">
                <BrainCircuit className="text-zinc-100" size={24} />
              </div>
              <h3 className="text-xl font-serif text-zinc-100 mb-3">Asistente Contextual</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Desglose analítico paso a paso. Consulta cada iteración en métodos numéricos y cada operación de fila en matrices.
              </p>
            </motion.div>

            <motion.div
              variants={{ hidden: { opacity: 0, y: 25 }, visible: { opacity: 1, y: 0 } }}
              className="p-8 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md hover:bg-zinc-900/80 hover:border-zinc-700/60 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-6">
                <LineChart className="text-zinc-100" size={24} />
              </div>
              <h3 className="text-xl font-serif text-zinc-100 mb-3">Modelado y Optimización</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Desde distribuciones estadísticas hasta el algoritmo Simplex y problemas de transporte con gráficos claros.
              </p>
            </motion.div>
          </motion.div>
        </section>
      </div>
    </div>
  );
}