"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Calculator, BrainCircuit, LineChart, ArrowRight, LogIn, User } from "lucide-react";
import Link from "next/link";
import { useState, useMemo, useEffect, memo } from "react";
import { createClient } from "@/lib/supabase/client";
import BrandLogo from "@/components/shared/brand-logo";
import GlowWrap from "@/components/effects/glow-wrap";
import StarBorder from "@/components/effects/star-border";

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
}

// Componente individual memorizado para evitar re-renders innecesarios
const SymbolSlot = memo(function SymbolSlot({
  slotIndex,
  col,
  row,
  cols,
  rows,
}: SymbolSlotProps) {
  const reduceMotion = useReducedMotion();

  // Símbolo inicial determinista (evita error de hidratación en SSR)
  const [charIndex, setCharIndex] = useState(
    () => slotIndex % SYMBOL_POOL.length
  );
  const [cycle, setCycle] = useState(0);

  // Parámetros calculados para cada posición
  const params = useMemo(() => {
    const cellW = 100 / cols;
    const cellH = 100 / rows;

    // Dispersión sutil dentro de su cuadrante
    const pseudoRandom1 = ((slotIndex * 13) % 100) / 100 - 0.5;
    const pseudoRandom2 = ((slotIndex * 37) % 100) / 100 - 0.5;
    const jitterX = pseudoRandom1 * (cellW * 0.55);
    const jitterY = pseudoRandom2 * (cellH * 0.55);

    return {
      top: `${cellH * row + cellH / 2 + jitterY}%`,
      left: `${cellW * col + cellW / 2 + jitterX}%`,
      // Cada símbolo tarda entre 7 y 11 s en completar su ciclo.
      duration: 7 + (slotIndex % 5),
      // Fases repartidas por toda la retícula: el fondo nunca queda vacío.
      initialDelay: (slotIndex * 0.41) % 2.8,
      // Respiración mínima entre ciclos (180–420 ms) para no dejar huecos.
      pause: 0.18 + (slotIndex % 3) * 0.12,
      moveX: pseudoRandom1 * 46,
      moveY: pseudoRandom2 * 46,
      rotate: pseudoRandom1 * 32,
      size: ["text-3xl", "text-4xl", "text-5xl", "text-4xl"][slotIndex % 4],
    };
  }, [slotIndex, col, row, cols, rows]);

  // Al terminar un ciclo se cambia el símbolo y arranca el siguiente.
  const handleAnimationComplete = () => {
    setCharIndex((prev) => {
      let next = prev;
      while (next === prev) {
        next = Math.floor(Math.random() * SYMBOL_POOL.length);
      }
      return next;
    });
    setCycle((prev) => prev + 1);
  };

  // Con movimiento reducido el efecto sigue presente, pero estático.
  if (reduceMotion) {
    return (
      <div
        className="absolute flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
        style={{ top: params.top, left: params.left }}
        aria-hidden="true"
      >
        <span
          className={`${params.size} font-serif text-zinc-500/25 select-none`}
        >
          {SYMBOL_POOL[charIndex]}
        </span>
      </div>
    );
  }

  return (
    <div
      className="absolute flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
      style={{ top: params.top, left: params.left }}
      aria-hidden="true"
    >
      <motion.div
        key={cycle}
        className={`${params.size} font-serif text-zinc-500/40 select-none cursor-default`}
        initial={{ opacity: 0, scale: 0.72, x: 0, y: 0, rotate: 0 }}
        animate={{
          // Entra rápido, permanece visible la mayor parte del ciclo y sale
          // en el último tramo: presencia continua en toda la retícula.
          opacity: [0, 0.55, 0.5, 0.55, 0],
          scale: [0.72, 1.04, 1, 1.02, 0.72],
          x: [0, params.moveX * 0.35, params.moveX * 0.7, params.moveX * 0.4, 0],
          y: [0, params.moveY * 0.35, params.moveY * 0.7, params.moveY * 0.4, 0],
          rotate: [0, params.rotate * 0.4, params.rotate * 0.8, params.rotate * 0.3, 0],
        }}
        transition={{
          duration: params.duration,
          ease: "easeInOut",
          times: [0, 0.16, 0.5, 0.86, 1],
          delay: cycle === 0 ? params.initialDelay : params.pause,
        }}
        onAnimationComplete={handleAnimationComplete}
      >
        {SYMBOL_POOL[charIndex]}
      </motion.div>
    </div>
  );
});

// --- Fondo completo de símbolos ---
// Siempre visible en la landing: no depende del switch de animaciones ni de
// la preferencia guardada, y no se puede desactivar.
const BackgroundSymbols = () => {
  const COLS = 6;
  const ROWS = 4;
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
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Gradiente radial de fondo */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#09090b_90%)]" />

      {/* Retícula bajo la barra de navegación (80 px) para adaptarse al
          nuevo encabezado y al contenido de la página. */}
      <div className="absolute inset-x-0 top-20 bottom-0">
        {slots.map((s) => (
          <SymbolSlot
            key={s.id}
            slotIndex={s.id}
            col={s.col}
            row={s.row}
            cols={COLS}
            rows={ROWS}
          />
        ))}
      </div>
    </div>
  );
};

// --- Landing Page ---
export default function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => setIsLoggedIn(!!user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="relative min-h-screen bg-zinc-950 selection:bg-zinc-800 selection:text-zinc-100">
      <BackgroundSymbols />

      {/* Barra de Navegación */}
<nav className="fixed top-0 w-full border-b border-zinc-900 bg-zinc-950/70 backdrop-blur-md z-50">
  <div className="max-w-7xl mx-auto px-6 py-4 min-h-[80px] flex items-center justify-between gap-4">
    
    {/* Logo */}
    <div className="flex items-center gap-2 shrink-0">
      <Link
        href="/"
        aria-label="Ir al inicio"
        className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center shadow-sm"
      >
        <Calculator className="text-zinc-950" size={18} />
      </Link>
      <BrandLogo size="sm" />
    </div>

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
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-800 hover:bg-zinc-900 text-zinc-100 transition-all whitespace-nowrap"
          >
            <User size={14} /> Perfil
          </Link>
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
              <StarBorder
                as={Link}
                href="/dashboard"
                color="#ffffff"
                trailColor="#ffffff"
                duration={4}
                direction="clockwise"
                stars={1}
                trailLength={0.3}
                thickness={1}
                radius={12}
                glow={0.6}
                hover="lap"
                sparkle={false}
                clickPulse
                theme="dark"
                className="transition-transform hover:scale-105"
              >
                Comenzar a calcular <ArrowRight size={18} />
              </StarBorder>
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
              className="h-full"
            >
              <GlowWrap radius={16} className="h-full">
                <div className="h-full p-8 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md hover:bg-zinc-900/80 hover:border-zinc-700/60 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-6">
                    <Calculator className="text-zinc-100" size={24} />
                  </div>
                  <h3 className="text-xl font-serif text-zinc-100 mb-3">Lógica Computacional</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Traduce tablas de verdad y proposiciones lógicas directamente a código ejecutable en Python, C++ y JavaScript.
                  </p>
                </div>
              </GlowWrap>
            </motion.div>

            <motion.div
              variants={{ hidden: { opacity: 0, y: 25 }, visible: { opacity: 1, y: 0 } }}
              className="h-full"
            >
              <GlowWrap radius={16} className="h-full">
                <div className="h-full p-8 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md hover:bg-zinc-900/80 hover:border-zinc-700/60 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-6">
                    <BrainCircuit className="text-zinc-100" size={24} />
                  </div>
                  <h3 className="text-xl font-serif text-zinc-100 mb-3">Asistente Contextual</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Desglose analítico paso a paso. Consulta cada iteración en métodos numéricos y cada operación de fila en matrices.
                  </p>
                </div>
              </GlowWrap>
            </motion.div>

            <motion.div
              variants={{ hidden: { opacity: 0, y: 25 }, visible: { opacity: 1, y: 0 } }}
              className="h-full"
            >
              <GlowWrap radius={16} className="h-full">
                <div className="h-full p-8 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md hover:bg-zinc-900/80 hover:border-zinc-700/60 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-6">
                    <LineChart className="text-zinc-100" size={24} />
                  </div>
                  <h3 className="text-xl font-serif text-zinc-100 mb-3">Modelado y Optimización</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Desde distribuciones estadísticas hasta el algoritmo Simplex y problemas de transporte con gráficos claros.
                  </p>
                </div>
              </GlowWrap>
            </motion.div>
          </motion.div>
        </section>
      </div>
    </div>
  );
}