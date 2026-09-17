"use client";

import { useSearchParams } from "next/navigation";
import ProfileModal from "@/components/profile/profile-modal";
import { User as UserIcon, Settings, Zap } from "lucide-react";
import OmniSolverView from "@/components/modules/omni/omni-solver-view";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator,
  Binary,
  Wallet,
  FunctionSquare,
  BarChart,
  Network,
  Sparkles,
  ArrowLeft,
  BookOpen,
  ListOrdered,
  Equal,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  LogOut,
  LogIn,
  UserPlus,
  Maximize2,
  Minimize2,
  X,
  Cpu
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { AIContextProvider } from "@/lib/context/ai-context";

// =============================================================================
// IMPORTACIÓN DE VISTAS (ACTIVAS Y FUTURAS)
// =============================================================================
// --- MATEMÁTICAS I: BÁSICAS Y CÁLCULO ---
import ArithmeticView from "@/components/modules/basic-math/arithmetic-view";
import AlgebraView from "@/components/modules/basic-math/algebra-view";
import GeometryView from "@/components/modules/basic-math/geometry-view";
import FunctionsView from "@/components/modules/basic-math/functions-view";
import LimitsView from "@/components/modules/basic-math/limits-view";
import DerivativesView from "@/components/modules/basic-math/derivatives-view";
import IntegralsView from "@/components/modules/basic-math/integrals-view";

// --- MATEMÁTICAS II: LÓGICA COMPUTACIONAL (FUTURAS) ---
import PropositionsView from "@/components/modules/logic/propositions-view";
// import EquivalencesView from "@/components/modules/logic/equivalences-view";
import InferencesView from "@/components/modules/logic/inferences-view";
// import PredicatesView from "@/components/modules/logic/predicates-view";
// import LogicTranslatorView from "@/components/modules/logic/translator-view";

// --- MATEMÁTICAS III: MATEMÁTICAS FINANCIERAS (FUTURAS) ---
import SimpleInterestView from "@/components/modules/finance/simple-interest-view";
import CompoundInterestView from "@/components/modules/finance/compound-interest-view";
import AnnuitiesView from "@/components/modules/finance/annuities-view";
import AmortizationView from "@/components/modules/finance/amortization-view";

// --- MATEMÁTICAS IV: MATEMÁTICAS COMPUTACIONALES (FUTURAS) ---
import MatricesView from "@/components/modules/computational/matrices-view";
import DeterminantsView from "@/components/modules/computational/determinants-view";
import GaussJordanView from "@/components/modules/computational/gauss-jordan-view";
import NumericalRootsView from "@/components/modules/computational/numerical-roots-view";
import InterpolationView from "@/components/modules/computational/interpolation-view";
// import ErrorTheoryView from "@/components/modules/computational/error-theory-view";

// --- MATEMÁTICAS V: PROBABILIDAD Y ESTADÍSTICA (FUTURAS) ---
// import DescriptiveStatsView from "@/components/modules/statistics/descriptive-stats-view";
// import FrequencyTableView from "@/components/modules/statistics/frequency-table-view";
// import ProbabilityView from "@/components/modules/statistics/probability-view";
// import DistributionsView from "@/components/modules/statistics/distributions-view";
// import RegressionView from "@/components/modules/statistics/regression-view";

// --- MATEMÁTICAS VI: INVESTIGACIÓN DE OPERACIONES (FUTURAS) ---
// import LinearProgrammingView from "@/components/modules/optimization/linear-programming-view";
// import SimplexView from "@/components/modules/optimization/simplex-view";
// import TransportationView from "@/components/modules/optimization/transportation-view";
// import AssignmentView from "@/components/modules/optimization/assignment-view";
// import QueueingTheoryView from "@/components/modules/optimization/queueing-theory-view";

import AIAssistant from "@/components/ai/ai-assistant";
import EquivalencesView from "@/components/modules/logic/equivalences-view";

export type ModuleId = "omni" | "mat1" | "mat2" | "mat3" | "mat4" | "mat5" | "mat6";
export type ViewMode = "calc" | "steps" | "theory";

interface ModuleConfig {
  id: ModuleId;
  label: string;
  desc: string;
  icon: React.ElementType;
}

const MODULES: ModuleConfig[] = [
  { id: "mat1", label: "Matemáticas I", desc: "Básicas y Cálculo", icon: Calculator },
  { id: "mat2", label: "Lógica", desc: "Proposiciones y Tablas", icon: Binary },
  { id: "mat3", label: "Financieras", desc: "Interés y Anualidades", icon: Wallet },
  { id: "mat4", label: "Computacionales", desc: "Matrices y Métodos", icon: FunctionSquare },
  { id: "mat5", label: "Estadística", desc: "Probabilidad y Series", icon: BarChart },
  { id: "mat6", label: "Optimización", desc: "Simplex y Colas", icon: Network },
];

// Catálogo Completo de Subtemas para las 6 materias
const SUBTOPICS_BY_MODULE: Record<ModuleId, { id: string; label: string; desc: string }[]> = {
  mat1: [
    { id: "aritmetica", label: "Aritmética", desc: "Jerarquía, Fracciones y Operaciones Básicas" },
    { id: "algebra", label: "Álgebra", desc: "Ecuaciones Cuadráticas, Factores y Polinomios" },
    { id: "geometria", label: "Geometría", desc: "Analítica 2D, Planimetría y Cuerpos 3D" },
    { id: "funciones", label: "Funciones", desc: "Graficador Interactivo, Análisis y Tangentes" },
    { id: "limites", label: "Límites", desc: "Indeterminaciones, Racionalización y L'Hôpital" },
    { id: "derivadas", label: "Derivadas", desc: "Reglas de Derivación, Cadena y Optimización" },
    { id: "integrales", label: "Integrales", desc: "Definidas, Indefinidas y Área bajo la Curva" },
  ],
  mat2: [
    { id: "proposiciones", label: "Proposiciones", desc: "Tablas de Verdad, Tautologías y Conectores" },
    { id: "equivalencias", label: "Equivalencias", desc: "Leyes de De Morgan y Simplificación Lógica" },
    { id: "inferencias", label: "Inferencias", desc: "Modus Ponens, Tollens y Silogismos Válidos" },
    //{ id: "predicados", label: "Predicados", desc: "Cuantificadores Universales ∀ y Existenciales ∃" },
    //{ id: "traductor", label: "Traductor a Código", desc: "Conversión de Proposiciones a C++/Python" },
  ],
  mat3: [
    { id: "interes-simple", label: "Interés Simple", desc: "Capital, Tasa, Tiempo y Despeje de Variables" },
    { id: "interes-compuesto", label: "Interés Compuesto", desc: "Capitalización, Tasa Efectiva y Valor Futuro" },
    { id: "anualidades", label: "Anualidades", desc: "Ordinarias, Anticipadas y Valor Presente" },
    { id: "amortizacion", label: "Amortización", desc: "Tablas de Pago, Capital, Interés y Saldos" },
  ],
  mat4: [
    { id: "matrices", label: "Matrices", desc: "Operaciones Básicas, Multiplicación e Inversa" },
    { id: "determinantes", label: "Determinantes", desc: "Cofactores, Sarrus y Regla de Cramer" },
    { id: "sistemas-gauss", label: "Sistemas Lineales", desc: "Eliminación Gaussiana y Gauss-Jordan" },
    { id: "raices-metodos", label: "Raíces Numéricas", desc: "Bisección, Newton-Raphson y Secante" },
    { id: "interpolacion", label: "Interpolación", desc: "Polinomios de Lagrange y Newton" },
    { id: "errores", label: "Teoría de Errores", desc: "Error Absoluto, Relativo y Truncamiento" },
  ],
  mat5: [
    { id: "descriptiva", label: "Estadística Descriptiva", desc: "Media, Mediana, Moda, Varianza y Desviación" },
    { id: "tablas-frecuencia", label: "Tablas de Frecuencia", desc: "Frecuencia Absoluta, Relativa y Acumulada" },
    { id: "probabilidad", label: "Probabilidad", desc: "Combinatoria, Permutaciones y Teorema de Bayes" },
    { id: "distribuciones", label: "Distribuciones", desc: "Binomial, Poisson y Normal Estándar" },
    { id: "regresion", label: "Regresión Lineal", desc: "Ajuste por Mínimos Cuadrados y Correlación" },
  ],
  mat6: [
    { id: "prog-lineal", label: "Programación Lineal", desc: "Método Gráfico y Regiones Factibles" },
    { id: "simplex", label: "Método Simplex", desc: "Tablas Simplex, Variables Holgura y Gran M" },
    { id: "transporte", label: "Problemas de Transporte", desc: "Esquina Noroeste, Costo Mínimo y Vogel" },
    { id: "asignacion", label: "Asignación", desc: "Método Húngaro de Minimización y Maximización" },
    { id: "teoria-colas", label: "Teoría de Colas", desc: "Modelos M/M/1, Tasas de Llegada y Espera" },
  ],
  omni: []
};

const VIEW_MODES: { id: ViewMode; label: string; icon: React.ElementType }[] = [
  { id: "calc", label: "Calcular", icon: Equal },
  { id: "steps", label: "Paso a Paso", icon: ListOrdered },
  { id: "theory", label: "Teoría", icon: BookOpen },
];

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialExpr = searchParams.get("expr") || "";

  const [activeModule, setActiveModule] = useState<ModuleId>("mat1");
  const [subTopic, setSubTopic] = useState<string>("aritmetica");
  const [viewMode, setViewMode] = useState<ViewMode>("calc");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // --- Estados de Redimensionamiento y Maximizado de IA ---
  const [aiWidth, setAiWidth] = useState<number>(360);
  const [isAiMaximized, setIsAiMaximized] = useState<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const newWidth = window.innerWidth - moveEvent.clientX;
      if (newWidth >= 320 && newWidth <= Math.min(850, window.innerWidth * 0.6)) {
        setAiWidth(newWidth);
      }
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = "default";
      document.body.style.userSelect = "auto";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isAiMaximized) {
        setIsAiMaximized(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAiMaximized]);

  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.refresh();
  };

  // Función de navegación parametrizada
  const handleNavigateFromOmni = (
    moduleId: ModuleId,
    subtopicId: string,
    formula: string,
    extraParams?: { point?: string; side?: string }
  ) => {
    setActiveModule(moduleId);
    setSubTopic(subtopicId);

    const query = new URLSearchParams();
    query.set("module", moduleId);
    query.set("subtopic", subtopicId);
    query.set("expr", formula);
    if (extraParams?.point) query.set("point", extraParams.point);
    if (extraParams?.side) query.set("side", extraParams.side);

    router.push(`/dashboard?${query.toString()}`);
  };

  // Cambio de módulo con reseteo al primer subtema correspondiente
  const handleSelectModule = (id: ModuleId) => {
    setActiveModule(id);
    const subList = SUBTOPICS_BY_MODULE[id];
    if (subList && subList.length > 0) {
      setSubTopic(subList[0].id);
    }
  };

  const currentModule = MODULES.find((m) => m.id === activeModule) || MODULES[0];
  const currentSubtopics = SUBTOPICS_BY_MODULE[activeModule] || SUBTOPICS_BY_MODULE.mat1;
  const currentSubtopicConfig = currentSubtopics.find((s) => s.id === subTopic) || currentSubtopics[0];

  const userInitials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.substring(0, 2).toUpperCase()
    : user?.email?.substring(0, 2).toUpperCase() || "U";

  // Función auxiliar para renderizar placeholders de módulos en preparación
  const renderPlaceholder = (title: string, desc: string) => (
    <div className="h-full min-h-[400px] border border-dashed border-zinc-800/80 rounded-3xl flex flex-col items-center justify-center p-10 text-center bg-zinc-900/20 backdrop-blur-sm max-w-2xl mx-auto my-auto">
      <div className="w-14 h-14 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-center mb-4 text-zinc-400 shadow-inner">
        <currentModule.icon size={26} />
      </div>
      <h3 className="text-xl font-serif font-bold text-zinc-200 mb-1">{title}</h3>
      <p className="text-xs text-zinc-400 max-w-md mt-1 leading-relaxed">{desc}</p>
      <div className="mt-5 flex items-center gap-2 text-[11px] font-mono text-zinc-500 bg-zinc-950/60 border border-zinc-800/80 px-3.5 py-1.5 rounded-xl">
        <Cpu size={13} className="text-amber-400" />
        <span>Módulo en preparación · Conexión ReSolve AI activa</span>
      </div>
    </div>
  );

  return (
    <div className="relative flex h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans select-none print:h-auto print:w-full print:overflow-visible print:bg-white print:text-black">
      {/* Fondo ambiental */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(63,63,70,0.25),transparent_50%),radial-gradient(circle_at_80%_90%,rgba(63,63,70,0.2),transparent_50%)]" />
        <div className="absolute inset-0 bg-zinc-950/40" />
      </div>

      {/* 1. MENÚ LATERAL IZQUIERDO */}
      <aside
        className={`relative z-20 h-full border-r border-zinc-800/60 bg-zinc-950/60 backdrop-blur-xl flex flex-col justify-between transition-all duration-300 ease-in-out shrink-0 print:hidden ${
          isSidebarOpen ? "w-72" : "w-0 border-r-0 overflow-hidden"
        }`}
      >
        <div className="flex flex-col min-h-0 flex-1">
          <div className="p-5 border-b border-zinc-800/60 shrink-0">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors mb-3 tracking-wide"
                >
                  <ArrowLeft size={12} /> Volver a Inicio
                </Link>
                <h1 className="text-2xl font-bold tracking-tight font-serif leading-none">
                  Re<span className="text-zinc-500">Solve</span>
                </h1>
                <p className="text-[10px] text-zinc-500 tracking-[0.2em] uppercase font-mono mt-2">
                  
                </p>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                title="Ocultar menú lateral"
                aria-label="Ocultar menú lateral"
                className="p-2 rounded-lg text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors shrink-0"
              >
                <PanelLeftClose size={16} />
              </button>
            </div>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">

            <div className="px-3 pt-2 pb-1">
            <button
              onClick={() => setActiveModule("omni")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-left transition-all border ${
                activeModule === "omni"
                  ? "bg-amber-400/10 border-amber-400/30 text-amber-300 font-semibold shadow-lg shadow-amber-400/5"
                  : "bg-zinc-900/40 border-zinc-800/80 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
              }`}
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <Zap size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[13px] leading-tight">ReSolve Solver</span>
                <span className="block text-[10px] text-zinc-500 font-mono">Omni-Motor Photomath</span>
              </div>
            </button>
          </div>
            <p className="px-3 pt-2 pb-2 text-[10px] uppercase tracking-[0.2em] text-zinc-600 font-mono">
              Módulos
            </p>
            {MODULES.map((mod) => {
              const Icon = mod.icon;
              const isActive = activeModule === mod.id;
              return (
                <button
                  key={mod.id}
                  onClick={() => handleSelectModule(mod.id)}
                  className={`group relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all ${
                    isActive
                      ? "bg-zinc-100 text-zinc-950 shadow-lg shadow-zinc-100/5 font-semibold"
                      : "text-zinc-400 hover:bg-zinc-900/70 hover:text-zinc-100"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      isActive
                        ? "bg-zinc-950/10 text-zinc-950"
                        : "bg-zinc-900/60 text-zinc-400 group-hover:text-zinc-200"
                    }`}
                  >
                    <Icon size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-[13px] leading-tight truncate">
                      {mod.label}
                    </span>
                    <span
                      className={`block text-[10px] truncate ${
                        isActive ? "text-zinc-600 font-normal" : "text-zinc-500"
                      }`}
                    >
                      {mod.desc}
                    </span>
                  </div>
                  {isActive && (
                    <ChevronRight size={14} className="text-zinc-700 shrink-0" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* PIE DEL MENÚ LATERAL */}
        <div className="p-3 border-t border-zinc-800/60 bg-zinc-950/40 shrink-0">
          {user ? (
            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur">
              <button
                onClick={() => setIsProfileOpen(true)}
                className="flex items-center gap-2.5 min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
                title="Editar perfil y ajustes"
              >
                <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-950 font-bold flex items-center justify-center text-xs shrink-0 shadow-sm">
                  {userInitials}
                </div>
                <div className="min-w-0">
                  <span className="block text-xs font-medium text-zinc-200 truncate flex items-center gap-1">
                    {user.user_metadata?.full_name || user.email}
                    <Settings size={11} className="text-zinc-500" />
                  </span>
                  <span className="block text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Sincronizado
                  </span>
                </div>
              </button>
              <button
                onClick={handleLogout}
                title="Cerrar sesión"
                className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-800/60 rounded-lg transition-colors shrink-0"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-300">Modo Invitado</span>
                <span className="text-[10px] text-amber-400/90 font-mono bg-amber-950/40 border border-amber-900/40 px-1.5 py-0.5 rounded">
                  Local
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-tight">
                Inicia sesión para guardar tu historial en la nube.
              </p>
              <div className="flex gap-2 pt-1">
                <Link
                  href="/login"
                  className="flex-1 py-1.5 bg-zinc-100 hover:bg-zinc-300 text-zinc-950 text-center rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                >
                  <LogIn size={13} /> Entrar
                </Link>
                <Link
                  href="/registro"
                  className="flex-1 py-1.5 border border-zinc-800 hover:bg-zinc-900 text-zinc-300 text-center rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1"
                >
                  <UserPlus size={13} /> Registro
                </Link>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 px-2 py-2 mt-1 text-[10px] text-zinc-500 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 animate-pulse" />
            v1.0 · Beta
          </div>
        </div>
      </aside>

      {/* 2. ÁREA CENTRAL */}
      <main className="relative z-10 flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        <header className="px-6 lg:px-8 py-5 border-b border-zinc-800/60 bg-zinc-950/40 backdrop-blur-xl flex flex-col gap-4 shrink-0 print:hidden">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {!isSidebarOpen && (
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  title="Mostrar menú lateral"
                  aria-label="Mostrar menú lateral"
                  className="p-2 rounded-xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors shrink-0"
                >
                  <PanelLeftOpen size={16} />
                </button>
              )}

              <div className="truncate">
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-mono uppercase tracking-wider mb-1">
                  <span>{currentModule?.label}</span>
                  <ChevronRight size={11} />
                  <span className="text-zinc-400">{currentSubtopicConfig?.label}</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-serif font-bold tracking-tight text-zinc-100 truncate leading-tight">
                  {currentSubtopicConfig?.label}{" "}
                  <span className="text-zinc-500 italic font-normal text-lg md:text-xl">
                    · {currentSubtopicConfig?.desc}
                  </span>
                </h2>
              </div>
            </div>

            <div className="flex bg-zinc-900/60 border border-zinc-800/80 p-1 rounded-2xl gap-1 shrink-0 backdrop-blur">
              {VIEW_MODES.map((vm) => {
                const Icon = vm.icon;
                const isActive = viewMode === vm.id;
                return (
                  <button
                    key={vm.id}
                    onClick={() => setViewMode(vm.id)}
                    className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-colors ${
                      isActive ? "text-zinc-950 font-semibold" : "text-zinc-400 hover:text-zinc-100"
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="viewModePill"
                        className="absolute inset-0 bg-zinc-100 rounded-xl"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative flex items-center gap-1.5">
                      <Icon size={13} />
                      {vm.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Barra de Subtemas Dinámica (Cambia según la materia activa) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
            {currentSubtopics.map((item) => {
              const isActive = subTopic === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setSubTopic(item.id)}
                  className={`relative px-3.5 py-1.5 rounded-full whitespace-nowrap text-xs transition-colors ${
                    isActive ? "text-zinc-100 font-medium" : "text-zinc-500 hover:text-zinc-200"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="subtopicPill"
                      className="absolute inset-0 bg-zinc-800/80 border border-zinc-700/80 rounded-full"
                      transition={{ type: "spring", stiffness: 450, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{item.label}</span>
                </button>
              );
            })}
          </div>
        </header>

        {/* =====================================================================
            CONTENEDOR DE VISTAS (ACTIVAS Y PREPARADAS PARA EL FUTURO)
        ====================================================================== */}
        <div className="flex-1 min-h-0 p-6 lg:p-8 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeModule}-${subTopic}-${viewMode}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="h-full"
            >
              {/* ===============================================================
                  RAMA 1: MATEMÁTICAS I (BÁSICAS Y CÁLCULO)
              ================================================================ */}
             {activeModule === "omni" ? (
                <OmniSolverView onNavigateToModule={handleNavigateFromOmni} />

              ) : activeModule === "mat1" && subTopic === "aritmetica" ? (
                <ArithmeticView viewMode={viewMode} initialExpression={initialExpr} />

              ) : activeModule === "mat1" && subTopic === "algebra" ? (
                <AlgebraView viewMode={viewMode} initialExpression={initialExpr} />
              ) : activeModule === "mat1" && subTopic === "geometria" ? (
                <GeometryView viewMode={viewMode} initialExpression={initialExpr} />
              ) : activeModule === "mat1" && subTopic === "funciones" ? (
                <FunctionsView viewMode={viewMode} initialExpression={initialExpr} />
              ) : activeModule === "mat1" && subTopic === "limites" ? (
                <LimitsView viewMode={viewMode} initialExpression={initialExpr} /> 
              ) : activeModule === "mat1" && subTopic === "derivadas" ? (
                <DerivativesView viewMode={viewMode} initialExpression={initialExpr} />
              ) : activeModule === "mat1" && subTopic === "integrales" ? (
                <IntegralsView viewMode={viewMode} initialExpression={initialExpr} /> 

              /* ===============================================================
                  RAMA 2: MATEMÁTICAS II (LÓGICA COMPUTACIONAL)
              ================================================================ */
              ) : activeModule === "mat2" && subTopic === "proposiciones" ? (
                <PropositionsView viewMode={viewMode} initialExpression={initialExpr} /> 
              ) : activeModule === "mat2" && subTopic === "equivalencias" ? (
                <EquivalencesView viewMode={viewMode} initialExpression={initialExpr} />
              ) : activeModule === "mat2" && subTopic === "inferencias" ? (
               <InferencesView viewMode={viewMode} initialExpression={initialExpr} /> 
              ) : activeModule === "mat2" && subTopic === "predicados" ? (
                /* <PredicatesView viewMode={viewMode} initialExpression={initialExpr} /> */
                renderPlaceholder("Lógica de Predicados", "Cuantificadores universales ∀, existenciales ∃, negaciones y dominios de discurso")
              ) : activeModule === "mat2" && subTopic === "traductor" ? (
                /* <LogicTranslatorView viewMode={viewMode} initialExpression={initialExpr} /> */
                renderPlaceholder("Traductor de Lógica a Código", "Traducción de proposiciones lógicas directamente a código ejecutable en C++, Python y JavaScript")

              /* ===============================================================
                  RAMA 3: MATEMÁTICAS III (FINANCIERAS)
              ================================================================ */
              ) : activeModule === "mat3" && subTopic === "interes-simple" ? (
                 <SimpleInterestView viewMode={viewMode} initialExpression={initialExpr} /> 
              ) : activeModule === "mat3" && subTopic === "interes-compuesto" ? (
                <CompoundInterestView viewMode={viewMode} initialExpression={initialExpr} />
              ) : activeModule === "mat3" && subTopic === "anualidades" ? (
                <AnnuitiesView viewMode={viewMode} initialExpression={initialExpr} />
              ) : activeModule === "mat3" && subTopic === "amortizacion" ? (
                <AmortizationView viewMode={viewMode} initialExpression={initialExpr} />
              /* ===============================================================
                  RAMA 4: MATEMÁTICAS IV (COMPUTACIONALES / NUMÉRICAS)
              ================================================================ */
              ) : activeModule === "mat4" && subTopic === "matrices" ? (
                <MatricesView viewMode={viewMode} initialExpression={initialExpr} />
              ) : activeModule === "mat4" && subTopic === "determinantes" ? (
                <DeterminantsView viewMode={viewMode} initialExpression={initialExpr} /> 
              ) : activeModule === "mat4" && subTopic === "sistemas-gauss" ? (
                <GaussJordanView viewMode={viewMode} initialExpression={initialExpr} /> 
              ) : activeModule === "mat4" && subTopic === "raices-metodos" ? (
                <NumericalRootsView viewMode={viewMode} initialExpression={initialExpr} /> 
              ) : activeModule === "mat4" && subTopic === "interpolacion" ? (
                <InterpolationView viewMode={viewMode} initialExpression={initialExpr} />
              ) : activeModule === "mat4" && subTopic === "errores" ? (
                /* <ErrorTheoryView viewMode={viewMode} initialExpression={initialExpr} /> */
                renderPlaceholder("Teoría de Errores y Precisión", "Error absoluto, error relativo, error porcentual, redondeo y truncamiento computacional")

              /* ===============================================================
                  RAMA 5: MATEMÁTICAS V (PROBABILIDAD Y ESTADÍSTICA)
              ================================================================ */
              ) : activeModule === "mat5" && subTopic === "descriptiva" ? (
                /* <DescriptiveStatsView viewMode={viewMode} initialExpression={initialExpr} /> */
                renderPlaceholder("Estadística Descriptiva", "Cálculo de Media, Mediana, Moda, Rango, Varianza, Desviación Estándar y Cuartiles")
              ) : activeModule === "mat5" && subTopic === "tablas-frecuencia" ? (
                /* <FrequencyTableView viewMode={viewMode} initialExpression={initialExpr} /> */
                renderPlaceholder("Tablas de Frecuencia", "Agrupación en intervalos, frecuencias absolutas, relativas y acumuladas")
              ) : activeModule === "mat5" && subTopic === "probabilidad" ? (
                /* <ProbabilityView viewMode={viewMode} initialExpression={initialExpr} /> */
                renderPlaceholder("Probabilidad y Combinatoria", "Permutaciones, combinaciones, probabilidad condicional y Teorema de Bayes")
              ) : activeModule === "mat5" && subTopic === "distribuciones" ? (
                /* <DistributionsView viewMode={viewMode} initialExpression={initialExpr} /> */
                renderPlaceholder("Distribuciones de Probabilidad", "Distribución Binomial, Poisson y Normal Estándar con cálculo de probabilidades Z")
              ) : activeModule === "mat5" && subTopic === "regresion" ? (
                /* <RegressionView viewMode={viewMode} initialExpression={initialExpr} /> */
                renderPlaceholder("Regresión Lineal y Correlación", "Ajuste de recta por mínimos cuadrados, coeficiente de Pearson r y R²")

              /* ===============================================================
                  RAMA 6: MATEMÁTICAS VI (INVESTIGACIÓN DE OPERACIONES)
              ================================================================ */
              ) : activeModule === "mat6" && subTopic === "prog-lineal" ? (
                /* <LinearProgrammingView viewMode={viewMode} initialExpression={initialExpr} /> */
                renderPlaceholder("Programación Lineal Gráfica", "Optimización de función objetivo Z sujeta a restricciones, con región factible 2D")
              ) : activeModule === "mat6" && subTopic === "simplex" ? (
                /* <SimplexView viewMode={viewMode} initialExpression={initialExpr} /> */
                renderPlaceholder("Algoritmo Simplex", "Tablas Simplex paso a paso, variables de holgura, método de la Gran M y Dos Fases")
              ) : activeModule === "mat6" && subTopic === "transporte" ? (
                /* <TransportationView viewMode={viewMode} initialExpression={initialExpr} /> */
                renderPlaceholder("Modelos de Transporte", "Optimización logística por Esquina Noroeste, Costo Mínimo y Aproximación de Vogel")
              ) : activeModule === "mat6" && subTopic === "asignacion" ? (
                /* <AssignmentView viewMode={viewMode} initialExpression={initialExpr} /> */
                renderPlaceholder("Problemas de Asignación", "Método Húngaro para minimización de costos o maximización de rendimientos")
              ) : activeModule === "mat6" && subTopic === "teoria-colas" ? (
                /* <QueueingTheoryView viewMode={viewMode} initialExpression={initialExpr} /> */
                renderPlaceholder("Teoría de Colas y Líneas de Espera", "Modelos M/M/1, M/M/c, factor de utilización ρ, tiempos en cola Wq y en el sistema W")
              ) : (
                renderPlaceholder("Módulo en Desarrollo", "La arquitectura modular está lista para recibir las funciones de este apartado.")
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* =======================================================================
          3. ASISTENTE IA: PERMANENTE, ARRASTRABLE (DRAG) Y MAXIMIZABLE
      ======================================================================== */}
      {isAiMaximized && (
        <div
          onClick={() => setIsAiMaximized(false)}
          className="fixed inset-0 z-40 bg-zinc-950/80 backdrop-blur-md transition-opacity"
        />
      )}

      <aside
        style={!isAiMaximized ? { width: `${aiWidth}px` } : undefined}
        className={`transition-all duration-200 ease-out flex flex-col justify-between ${
          isAiMaximized
            ? "fixed inset-4 lg:inset-8 z-50 max-w-6xl mx-auto rounded-3xl border border-zinc-800/80 bg-zinc-950/95 backdrop-blur-2xl shadow-2xl p-6 lg:p-8 overflow-hidden"
            : "relative z-10 border-l border-zinc-800/60 p-5 hidden xl:flex h-full bg-zinc-950/40 backdrop-blur-xl shrink-0"
        }print:hidden`}
      >
        {!isAiMaximized && (
          <div
            onMouseDown={handleMouseDown}
            title="Arrastra para redimensionar el ancho del chat"
            className="absolute -left-1 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-zinc-500/40 active:bg-amber-400/50 transition-colors z-30 flex items-center justify-center group"
          >
            <div className="w-0.5 h-8 bg-zinc-700/60 group-hover:bg-zinc-400 rounded-full transition-colors" />
          </div>
        )}

        <div className="mb-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2 font-mono">
              <Sparkles size={13} className="text-amber-400" />
              ReSolve AI
              {isAiMaximized && (
                <span className="text-[10px] text-zinc-500 lowercase font-sans font-normal">
                  · modo extendido
                </span>
              )}
            </h3>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsAiMaximized(!isAiMaximized)}
              title={isAiMaximized ? "Restaurar tamaño (Esc)" : "Expandir a pantalla completa"}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors flex items-center gap-1 text-xs font-mono"
            >
              {isAiMaximized ? (
                <>
                  <Minimize2 size={13} />
                  <span className="hidden sm:inline text-[11px]">Restaurar</span>
                </>
              ) : (
                <Maximize2 size={13} />
              )}
            </button>

            {isAiMaximized && (
              <button
                type="button"
                onClick={() => setIsAiMaximized(false)}
                title="Cerrar (Esc)"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors"
              >
                <X size={15} />
              </button>
            )}

            {!isAiMaximized && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 animate-pulse ml-1" />
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <AIAssistant />
        </div>
      </aside>

      {/* MODAL DE PERFIL */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        onProfileUpdated={() => {
          const supabase = createClient();
          supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
        }}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen bg-zinc-950 flex items-center justify-center text-xs text-zinc-500 font-mono">
          Cargando ReSolve...
        </div>
      }
    >
      <AIContextProvider>
        <DashboardContent />
      </AIContextProvider>
    </Suspense>
  );
}