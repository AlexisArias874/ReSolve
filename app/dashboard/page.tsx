"use client";

import { useSearchParams } from "next/navigation";
import ProfileModal from "@/components/profile/profile-modal";
import { Settings, Zap } from "lucide-react";
import OmniSolverView from "@/components/modules/omni/omni-solver-view";
import TechBackdrop from "@/components/shared/tech-backdrop";
import BrandLogo from "@/components/shared/brand-logo";

import { useState, useEffect, useRef, Suspense, ViewTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import {
  Calculator,
  Binary,
  Wallet,
  FunctionSquare,
  BarChart,
  Network,
  Sparkles,
  BookOpen,
  BookText,
  ListOrdered,
  Equal,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  ChevronRight,
  LogOut,
  LogIn,
  UserPlus,
  Maximize2,
  Minimize2,
  X,
  Cpu,
  Palette,
  Sun,
  Moon,
  Terminal,
  Eye,
  EyeOff,
  Users
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { AIContextProvider } from "@/lib/context/ai-context";
import { useHistoryVisibility } from "@/lib/hooks/use-history-visibility";
import { useEffectsPreference } from "@/lib/hooks/use-effects-preference";
import { THEME_FX, type ThemeId } from "@/lib/hooks/use-theme";
import dynamic from "next/dynamic";

// AeroShards (React Bits) — fondo trasero del módulo Matemáticas I.
// ssr:false: requiere WebGPU y solo corre en cliente.
const AeroShards = dynamic(() => import("@/components/shared/aero-shards"), {
  ssr: false,
});

// SplitText (React Bits) — efecto del título de sección del header (por letras).
// Requiere gsap y @gsap/react y trabaja sobre el DOM en cliente: no aporta SSR.
const SplitText = dynamic(() => import("@/components/shared/split-text"), {
  ssr: false,
});

// FoldText (React Bits) — efecto de "ReSolve AI" en el panel de IA. Requiere
// gsap; se carga sin SSR (igual que SplitText).
const FoldText = dynamic(() => import("@/components/shared/fold-text"), {
  ssr: false,
});

// =============================================================================
// IMPORTACIÓN DE VISTAS (ACTIVAS Y FUTURAS)
// =============================================================================
import ArithmeticView from "@/components/modules/basic-math/arithmetic-view";
import AlgebraView from "@/components/modules/basic-math/algebra-view";
import GeometryView from "@/components/modules/basic-math/geometry-view";
import FunctionsView from "@/components/modules/basic-math/functions-view";
import LimitsView from "@/components/modules/basic-math/limits-view";
import DerivativesView from "@/components/modules/basic-math/derivatives-view";
import IntegralsView from "@/components/modules/basic-math/integrals-view";

import PropositionsView from "@/components/modules/logic/propositions-view";
import InferencesView from "@/components/modules/logic/inferences-view";
import EquivalencesView from "@/components/modules/logic/equivalences-view";

import SimpleInterestView from "@/components/modules/finance/simple-interest-view";
import CompoundInterestView from "@/components/modules/finance/compound-interest-view";
import AnnuitiesView from "@/components/modules/finance/annuities-view";
import AmortizationView from "@/components/modules/finance/amortization-view";

import MatricesView from "@/components/modules/computational/matrices-view";
import DeterminantsView from "@/components/modules/computational/determinants-view";
import GaussJordanView from "@/components/modules/computational/gauss-jordan-view";
import NumericalRootsView from "@/components/modules/computational/numerical-roots-view";
import InterpolationView from "@/components/modules/computational/interpolation-view";
import ErrorTheoryView from "@/components/modules/computational/error-theory-view";

import DescriptiveStatsView from "@/components/modules/statistics/descriptive-stats-view";
import FrequencyTableView from "@/components/modules/statistics/frequency-table-view";
import ProbabilityView from "@/components/modules/statistics/probability-view";
import DistributionsView from "@/components/modules/statistics/distributions-view";
import RegressionView from "@/components/modules/statistics/regression-view";

import LinearProgrammingView from "@/components/modules/optimization/linear-programming-view";
import SimplexView from "@/components/modules/optimization/simplex-view";
import AssignmentView from "@/components/modules/optimization/assignment-view";
import QueueingTheoryView from "@/components/modules/optimization/queueing-theory-view";

import AIAssistant from "@/components/ai/ai-assistant";
import GlowWrap from "@/components/effects/glow-wrap";
import SpecularButton from "@/components/effects/specular-button";
import {
  MODULE_CATALOG,
  SUBTOPICS_BY_MODULE,
  type ModuleId,
  type ViewMode,
} from "@/lib/platform/catalog";

interface ModuleConfig {
  id: ModuleId;
  label: string;
  desc: string;
  icon: React.ElementType;
}

const MODULE_ICONS: Record<ModuleId, React.ElementType> = {
  omni: Zap,
  mat1: Calculator,
  mat2: Binary,
  mat3: Wallet,
  mat4: FunctionSquare,
  mat5: BarChart,
  mat6: Network,
};

const MODULES: ModuleConfig[] = MODULE_CATALOG.map((module) => ({
  ...module,
  icon: MODULE_ICONS[module.id],
}));

// Adelanta la descarga de la documentación (React Flow y el fondo WebGL) al
// pasar el cursor o enfocar el enlace, para que el cambio de página sea casi
// instantáneo en la primera visita.
const preloadDocs = () => {
  void import("@/components/docs/docs-view");
  void import("@/components/effects/antigravity");
};

const VIEW_MODES: { id: ViewMode; label: string; icon: React.ElementType }[] = [
  { id: "calc", label: "Calcular", icon: Equal },
  { id: "steps", label: "Paso a Paso", icon: ListOrdered },
  { id: "theory", label: "Teoría", icon: BookOpen },
];

const THEME_OPTIONS = [
  { id: "dark", label: "Oscuro", icon: Moon },
  { id: "light", label: "Claro", icon: Sun },
  { id: "sepia", label: "Sepia", icon: BookOpen },
  { id: "matrix", label: "Matrix", icon: Terminal },
];

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlExpr = searchParams.get("expr") || "";

  // Restaura módulo y subtema desde la URL (enlaces del Omni-Solver, historial o
  // recargas de página). Sin esto, el estado siempre vuelve a mat1/aritmetica.
  const VALID_MODULE_IDS: ModuleId[] = ["omni", "mat1", "mat2", "mat3", "mat4", "mat5", "mat6"];
  const paramModule = searchParams.get("module");
  const initialModule: ModuleId = VALID_MODULE_IDS.includes(paramModule as ModuleId)
    ? (paramModule as ModuleId)
    : "mat1";
  const paramSubtopic = searchParams.get("subtopic");
  const initialSubtopics = SUBTOPICS_BY_MODULE[initialModule] || [];
  const initialSubtopic =
    paramSubtopic && initialSubtopics.some((s) => s.id === paramSubtopic)
      ? paramSubtopic
      : initialSubtopics[0]?.id || "aritmetica";

  const [activeModule, setActiveModule] = useState<ModuleId>(initialModule);
  const [subTopic, setSubTopic] = useState<string>(initialSubtopic);
  const [viewMode, setViewMode] = useState<ViewMode>("calc");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  // Modo enfoque: oculta el chrome superior/lateral y deja solo el título del
  // módulo para una vista de trabajo completamente limpia.
  const [isFocusMode, setIsFocusMode] = useState(false);
  // Foto del estado de las barras justo antes de entrar en enfoque, para poder
  // devolver la vista exactamente como estaba (izquierda y derecha).
  const focusSnapshotRef = useRef<{
    sidebar: boolean;
    ai: boolean;
    aiDrawer: boolean;
    aiMaximized: boolean;
  } | null>(null);

  // Expresión extraída desde la Calculadora Universal para inyectar de forma
  // puntual en su módulo/subtema de destino (se limpia al navegar a otro lado).
  const [navInjectedExpr, setNavInjectedExpr] = useState<{
    module: ModuleId;
    subtopic: string;
    expr: string;
  } | null>(null);

  // La operación extraída solo se inyecta en el módulo/subtema de destino real.
  // Así no se "copia" a todos los módulos al navegar por el menú (el parámetro
  // `expr` sigue en la URL al cambiar de módulo).
  const initialExpr =
    navInjectedExpr &&
    navInjectedExpr.module === activeModule &&
    navInjectedExpr.subtopic === subTopic
      ? navInjectedExpr.expr
      : urlExpr && paramModule === activeModule && paramSubtopic === subTopic
      ? urlExpr
      : "";

  // Menú lateral: columna en escritorio (lg+) y drawer superpuesto en móvil.
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // --- Estados de Asistente IA (Visibilidad, Ancho y Maximizado) ---
  const [isAiOpen, setIsAiOpen] = useState<boolean>(true);
  // Drawer del asistente para pantallas < 1280px (xl), donde no cabe en columna.
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  // Preferencia global de visibilidad del historial (persistente entre vistas).
  const { isHistoryHidden, setIsHistoryHidden } = useHistoryVisibility();
  // Animaciones decorativas opcionales (fondo + logo).
  const { effectsEnabled, setEffectsEnabled } = useEffectsPreference();
  // Ancho inicial reducido a 320px para liberar 40px al área central
  const [aiWidth, setAiWidth] = useState<number>(320);
  const [isAiMaximized, setIsAiMaximized] = useState<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);

  // Cierra el drawer de navegación al elegir contenido en pantallas pequeñas.
  const closeMobileNav = () => setIsMobileNavOpen(false);

  const toggleFocusMode = () => {
    if (!isFocusMode) {
      focusSnapshotRef.current = {
        sidebar: isSidebarOpen,
        ai: isAiOpen,
        aiDrawer: isAiDrawerOpen,
        aiMaximized: isAiMaximized,
      };
      setIsFocusMode(true);
      setIsMobileNavOpen(false);
      setIsAiOpen(false);
      setIsAiDrawerOpen(false);
      setIsAiMaximized(false);
      return;
    }

    const snapshot = focusSnapshotRef.current;
    setIsFocusMode(false);
    if (snapshot) {
      setIsSidebarOpen(snapshot.sidebar);
      setIsAiOpen(snapshot.ai);
      setIsAiDrawerOpen(snapshot.aiDrawer);
      setIsAiMaximized(snapshot.aiMaximized);
      focusSnapshotRef.current = null;
    }
  };

  // --- Estado Global de Tema (Para Invitados y Autenticados) ---
  const [currentTheme, setCurrentTheme] = useState<string>("dark");
  // El botón de restaurar usa un acabado claro/oscuro según el tema activo.
  const isLightTheme = currentTheme === "light" || currentTheme === "sepia";
  // Paleta de los fondos animados: cada tema recibe colores con contraste.
  const themeFx = THEME_FX[currentTheme as ThemeId] ?? THEME_FX.dark;

  useEffect(() => {
    const saved = localStorage.getItem("resolve_theme") || document.documentElement.getAttribute("data-theme") || "dark";
    // El tema se lee de localStorage (sistema externo) al montar; el estado
    // local solo refleja el botón activo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  const handleThemeChange = (newTheme: string) => {
    setCurrentTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("resolve_theme", newTheme);
    // Notifica a los gráficos Canvas (math-grapher) para que se recoloreen al instante
    window.dispatchEvent(new Event("themechange"));
  };

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

  const handleNavigateFromOmni = (
    moduleId: ModuleId,
    subtopicId: string,
    formula: string,
    extraParams?: { point?: string; side?: string }
  ) => {
    setActiveModule(moduleId);
    setSubTopic(subtopicId);
    // Inyección inmediata (sin esperar a que la URL se actualice).
    setNavInjectedExpr({ module: moduleId, subtopic: subtopicId, expr: formula });

    const query = new URLSearchParams();
    query.set("module", moduleId);
    query.set("subtopic", subtopicId);
    query.set("expr", formula);
    if (extraParams?.point) query.set("point", extraParams.point);
    if (extraParams?.side) query.set("side", extraParams.side);

    closeMobileNav();
    // El cambio de módulo es estado local: se refleja en la URL con
    // replaceState para no disparar una navegación del router (y su
    // ViewTransition), que provocaba un destello negro al terminar de cargar
    // cada sección. Al recargar, la URL sigue restaurando el módulo y la
    // expresión indicados.
    window.history.replaceState(null, "", `/dashboard?${query.toString()}`);
  };

  const handleSelectModule = (id: ModuleId) => {
    setActiveModule(id);
    const subList = SUBTOPICS_BY_MODULE[id];
    if (subList && subList.length > 0) {
      setSubTopic(subList[0].id);
    }
    closeMobileNav();
    // Al elegir un módulo a mano se descarta la operación extraída previamente,
    // para que no se reaproveche en un módulo distinto al de destino.
    setNavInjectedExpr(null);
    // Limpia los parámetros sin navegar: el router.replace disparaba una
    // ViewTransition completa y un parpadeo negro entre módulos.
    window.history.replaceState(null, "", "/dashboard");
  };

  const currentModule = MODULES.find((m) => m.id === activeModule) || MODULES[0];
  const currentSubtopics = SUBTOPICS_BY_MODULE[activeModule] || SUBTOPICS_BY_MODULE.mat1;
  const currentSubtopicConfig = currentSubtopics.find((s) => s.id === subTopic) || currentSubtopics[0];

  // Cabecera: la Calculadora Universal (omni) no pertenece a MODULES ni tiene
  // subtemas, así que recibe su propia identidad en lugar de heredar la de mat1.
  const isOmni = activeModule === "omni";
  const crumbModuleLabel = isOmni ? "Calculadora Universal" : currentModule?.label;
  const headerTitle = isOmni ? "Calculadora Universal" : currentSubtopicConfig?.label;
  const headerDesc = isOmni
    ? "Resuelve, grafica y explica cualquier expresión"
    : currentSubtopicConfig?.desc;

  // SplitText: se dispara cuando todas las letras del título terminan de animar.
  const handleLetterAnimationComplete = () => {
    console.log("All letters have animated!");
  };

  const userInitials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.substring(0, 2).toUpperCase()
    : user?.email?.substring(0, 2).toUpperCase() || "U";

  const renderPlaceholder = (title: string, desc: string) => (
    <div className="h-full min-h-[400px] border border-dashed border-shell-hairline rounded-3xl flex flex-col items-center justify-center p-10 text-center bg-shell-surface backdrop-blur-sm max-w-2xl mx-auto my-auto">
      <div className="w-14 h-14 rounded-2xl bg-zinc-900/80 border border-shell-hairline flex items-center justify-center mb-4 text-zinc-400 shadow-inner">
        <currentModule.icon size={26} />
      </div>
      <h3 className="text-xl font-serif font-bold text-zinc-200 mb-1">{title}</h3>
      <p className="text-xs text-zinc-400 max-w-md mt-1 leading-relaxed">{desc}</p>
      <div className="mt-5 flex items-center gap-2 text-[11px] font-mono text-zinc-500 bg-zinc-950/60 border border-shell-hairline px-3.5 py-1.5 rounded-xl">
        <Cpu size={13} className="text-amber-400" />
        <span>Módulo en preparación · Conexión ReSolve AI activa</span>
      </div>
    </div>
  );

  return (
    <ViewTransition
      enter={{
        "nav-forward": "nav-forward",
        "nav-back": "nav-back",
        default: "page-fade",
      }}
      exit={{
        "nav-forward": "nav-forward",
        "nav-back": "nav-back",
        default: "page-fade",
      }}
      default="page-fade"
    >
      <div className="relative flex h-[100dvh] w-full bg-zinc-950 text-zinc-100 overflow-hidden font-sans print:h-auto print:w-full print:overflow-visible print:bg-white print:text-black">
      {/* Fondo ambiental */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="dash-ambient absolute inset-0" />
        <div className="absolute inset-0 bg-zinc-950/40" />
        <TechBackdrop />
        {/* Fondo común a todos los módulos: la cinta de cristales AeroShards
            (React Bits), el mismo que funcionó en Matemáticas I. Se desactiva
            con el switch global de animaciones. TEMPORAL: se personalizará por
            módulo más adelante. */}
        {effectsEnabled && (
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <AeroShards
              shardColor={themeFx.aero.shard}
              accentColor={themeFx.aero.accent}
              lightMode={themeFx.aero.light}
              placement="full"
              material="glass"
              markers="plus"
              count={1300}
              depthOfField={0.75}
              vignette={0.3}
              mouseInteraction
              pulseOnClick
              holdToGather
            />
          </motion.div>
        )}
      </div>

      {/* 1. MENÚ LATERAL IZQUIERDO (drawer en móvil, columna en escritorio) */}
      <AnimatePresence>
        {isMobileNavOpen && (
          <motion.div
            key="mobile-nav-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeMobileNav}
            className="fixed inset-0 z-30 bg-zinc-950/70 backdrop-blur-sm lg:hidden print:hidden"
          />
        )}
      </AnimatePresence>
      <aside
        className={`fixed lg:relative inset-y-0 left-0 z-40 lg:z-20 h-full border-r border-shell-hairline bg-shell-surface-strong lg:bg-shell-surface backdrop-blur-xl flex flex-col justify-between transition-all duration-300 ease-in-out shrink-0 print:hidden w-[86vw] max-w-xs ${
          isMobileNavOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 lg:max-w-none ${
          isFocusMode || !isSidebarOpen
            ? "lg:w-0 lg:border-r-0 lg:overflow-hidden"
            : "lg:w-72"
        }`}
      >
        <div className="flex flex-col min-h-0 flex-1">
          <div className="p-5 border-b border-shell-hairline shrink-0">
            <div className="relative flex items-center justify-center">
              <h1 className="leading-none">
                <BrandLogo size="lg" align="center" />
              </h1>
              <button
                onClick={() => {
                  closeMobileNav();
                  setIsSidebarOpen(false);
                }}
                title="Ocultar menú lateral"
                aria-label="Ocultar menú lateral"
                className="absolute right-0 top-0 p-2 rounded-lg text-zinc-500 hover:text-zinc-100 hover:bg-shell-hover transition-colors shrink-0"
              >
                <PanelLeftClose size={16} />
              </button>
            </div>
          </div>

          <nav className="flex flex-1 flex-col p-3 space-y-1 overflow-y-auto overflow-x-hidden no-scrollbar">
            <div className="px-3 pt-2 pb-1">
              <GlowWrap radius={16}>
              <button
                onClick={() => {
                  setActiveModule("omni");
                  closeMobileNav();
                  setNavInjectedExpr(null);
                  window.history.replaceState(null, "", "/dashboard");
                }}
                className={`w-full flex items-center justify-center gap-3 px-3.5 py-2.5 rounded-2xl text-left transition-all border outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 ${
                  activeModule === "omni"
                    ? "bg-amber-400/10 border-amber-400/30 text-amber-300 font-semibold shadow-lg shadow-amber-400/5"
                    : "bg-zinc-900/40 border-zinc-800/80 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                  <Zap size={15} />
                </div>
                <span className="type-nav-label truncate text-center">Calculadora Universal</span>
              </button>
              </GlowWrap>
            </div>

            <p className="px-3 pt-2 pb-2 text-[10px] uppercase tracking-[0.2em] text-zinc-600 font-mono">
              Módulos
            </p>
            {MODULES.map((mod) => {
              const Icon = mod.icon;
              const isActive = activeModule === mod.id;
              return (
                <GlowWrap key={mod.id} radius={12}>
                <button
                  onClick={() => handleSelectModule(mod.id)}
                  className={`group relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 ${
                    isActive
                      ? "bg-shell-active text-shell-active-fg shadow-lg shadow-black/5 font-semibold"
                      : "text-zinc-400 hover:bg-shell-hover hover:text-zinc-100"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      isActive
                        ? "bg-shell-active-fg/10 text-shell-active-fg"
                        : "bg-zinc-900/60 text-zinc-400 group-hover:text-zinc-200"
                    }`}
                  >
                    <Icon size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block type-nav-label truncate">
                      {mod.label}
                    </span>
                    <span
                      className={`block type-nav-desc truncate ${
                        isActive ? "text-shell-active-fg/70 font-normal" : "text-zinc-500"
                      }`}
                    >
                      {mod.desc}
                    </span>
                  </div>
                  {isActive && (
                    <ChevronRight size={14} className="text-shell-active-fg/60 shrink-0" />
                  )}
                </button>
                </GlowWrap>
              );
            })}

            <p className="mt-auto px-3 pt-4 pb-2 text-[10px] uppercase tracking-[0.2em] text-zinc-600 font-mono">
              Recursos
            </p>

            <GlowWrap radius={12}>
              <Link
                href="/documentacion"
                onClick={closeMobileNav}
                onMouseEnter={preloadDocs}
                onFocus={preloadDocs}
                transitionTypes={["nav-forward"]}
                className="group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-zinc-400 transition-all outline-none hover:bg-shell-hover hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-sky-400/40"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-500/20 bg-sky-500/10 text-sky-400">
                  <BookText size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block type-nav-label truncate">Documentación</span>
                  <span className="block type-nav-desc truncate text-zinc-500">
                    Guías y funcionamiento
                  </span>
                </div>
                <ChevronRight size={14} className="shrink-0 text-zinc-600 group-hover:text-zinc-300" />
              </Link>
            </GlowWrap>

            <GlowWrap radius={12}>
              <Link
                href="/contribuidores"
                onClick={closeMobileNav}
                transitionTypes={["nav-forward"]}
                className="group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-zinc-400 transition-all outline-none hover:bg-shell-hover hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-violet-400/40"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-400">
                  <Users size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block type-nav-label truncate">Contribuidores</span>
                  <span className="block type-nav-desc truncate text-zinc-500">
                    Equipo y aportaciones
                  </span>
                </div>
                <ChevronRight size={14} className="shrink-0 text-zinc-600 group-hover:text-zinc-300" />
              </Link>
            </GlowWrap>
          </nav>
        </div>

        {/* PIE DEL MENÚ LATERAL */}
        <div className="p-3 border-t border-shell-hairline bg-shell-surface shrink-0 space-y-2">
          <div className="p-2 rounded-xl bg-zinc-900/40 border border-shell-hairline flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-zinc-500 flex items-center gap-1.5">
              <Palette size={12} className="text-amber-400" /> Tema
            </span>
            <div className="flex gap-1">
              {THEME_OPTIONS.map((t) => {
                const Icon = t.icon;
                const isCurrent = currentTheme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleThemeChange(t.id)}
                    title={`Cambiar a tema ${t.label}`}
                    aria-label={`Cambiar a tema ${t.label}`}
                    aria-pressed={isCurrent}
                    className={`p-1.5 rounded-lg text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 ${
                      isCurrent
                        ? "bg-shell-active text-shell-active-fg font-bold"
                        : "text-zinc-400 hover:text-zinc-100 hover:bg-shell-hover"
                    }`}
                  >
                    <Icon size={12} />
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={effectsEnabled}
            aria-label="Activar o desactivar animaciones decorativas"
            onClick={() => setEffectsEnabled(!effectsEnabled)}
            className="w-full p-2 rounded-xl bg-zinc-900/40 border border-shell-hairline flex items-center justify-between gap-2 text-left hover:border-zinc-700 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
          >
            <span className="text-[10px] font-mono uppercase text-zinc-500 flex items-center gap-1.5">
              <Sparkles size={12} className="text-emerald-400" /> Animaciones
            </span>
            <span
              className={`relative h-4 w-7 shrink-0 rounded-full border transition-colors ${
                effectsEnabled
                  ? "bg-emerald-500/30 border-emerald-400/40"
                  : "bg-zinc-800 border-zinc-700"
              }`}
            >
              <span
                className={`absolute top-0.5 h-2.5 w-2.5 rounded-full transition-all ${
                  effectsEnabled
                    ? "left-3.5 bg-emerald-300"
                    : "left-0.5 bg-zinc-500"
                }`}
              />
            </span>
          </button>

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

          <div className="flex items-center gap-2 px-2 py-1 text-[10px] text-zinc-500 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 animate-pulse" />
            Beta 1.0
          </div>
        </div>
      </aside>

      {/* 2. ÁREA CENTRAL */}
      <main className="relative z-10 flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        <header
          className={`relative px-5 lg:px-8 border-b border-shell-hairline bg-shell-surface backdrop-blur-xl flex flex-col shrink-0 print:hidden transition-all duration-300 ${
            isFocusMode ? "py-3 gap-0" : "py-4 gap-3.5"
          }`}
        >
          <div className={isFocusMode ? "relative grid min-h-10 grid-cols-[1fr_auto_1fr] items-center gap-2" : "flex items-start justify-between gap-4"}>
            <div className={isFocusMode ? "col-start-2 min-w-0 max-w-full text-center" : "flex items-center gap-3 min-w-0"}>
              {!isFocusMode && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsMobileNavOpen(true)}
                    aria-label="Abrir menú de módulos"
                    title="Abrir menú de módulos"
                    className="dash-control lg:hidden -ml-1 p-2 rounded-xl backdrop-blur shrink-0"
                  >
                    <PanelLeftOpen size={18} />
                  </button>

                  {!isSidebarOpen && (
                    <button
                      type="button"
                      onClick={() => setIsSidebarOpen(true)}
                      title="Mostrar menú lateral"
                      aria-label="Mostrar menú lateral"
                      className="dash-control hidden lg:flex p-2 rounded-xl backdrop-blur shrink-0"
                    >
                      <PanelLeftOpen size={16} />
                    </button>
                  )}
                </>
              )}

              <div className={isFocusMode ? "min-w-0 text-center" : "min-w-0"}>
                <AnimatePresence initial={false}>
                  {!isFocusMode && (
                    <motion.div
                      key="dashboard-eyebrow"
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: effectsEnabled ? 0.2 : 0 }}
                      className="flex items-center gap-1.5 type-eyebrow text-muted-foreground mb-4"
                    >
                      <span className="truncate">{crumbModuleLabel}</span>
                      {!isOmni && (
                        <>
                          <ChevronRight size={14} className="shrink-0 opacity-60" />
                          <span className="text-foreground/75 truncate">{headerTitle}</span>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
                <SplitText
                  key={`${headerTitle}-${isFocusMode ? "focus" : "normal"}`}
                  tag="h2"
                  text={headerTitle ?? ""}
                  className="type-title font-serif font-bold text-foreground"
                  effect="rise"
                  splitType="chars"
                  delay={45}
                  duration={2.05}
                  staggerFrom="start"
                  trigger="view"
                  hoverEffect="lift"
                  loop={false}
                  loopDelay={1.5}
                  mask={false}
                  threshold={0.1}
                  rootMargin="-100px"
                  textAlign={isFocusMode ? "center" : "left"}
                  onLetterAnimationComplete={handleLetterAnimationComplete}
                />
                <AnimatePresence initial={false}>
                  {!isFocusMode && (
                    <motion.p
                      key="dashboard-description"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: effectsEnabled ? 0.2 : 0 }}
                      className="type-subtitle text-muted-foreground mt-1 max-w-[62ch]"
                    >
                      {headerDesc}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {!isFocusMode && (
                <motion.div
                  key="dashboard-controls"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: effectsEnabled ? 0.2 : 0 }}
                  className="flex items-center gap-2 shrink-0"
                >
                  <div className="dash-segment flex p-1 rounded-2xl gap-1 shrink-0 backdrop-blur">
                    {VIEW_MODES.map((vm) => {
                      const Icon = vm.icon;
                      const isActive = viewMode === vm.id;
                      return (
                        <button
                          key={vm.id}
                          onClick={() => setViewMode(vm.id)}
                          aria-pressed={isActive}
                          className={`dash-segment-button relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl type-control font-medium outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 ${
                            isActive ? "text-shell-active-fg font-semibold" : "text-shell-muted hover:text-foreground"
                          }`}
                        >
                          {isActive && (
                            <motion.span
                              layoutId="viewModePill"
                              className="absolute inset-0 bg-shell-active rounded-xl"
                              transition={
                                effectsEnabled
                                  ? { type: "spring", stiffness: 400, damping: 30 }
                                  : { duration: 0 }
                              }
                            />
                          )}
                          <span className="relative flex items-center gap-1.5">
                            <Icon size={14} />
                            <span className="hidden sm:inline">{vm.label}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <GlowWrap radius={16}>
                  <button
                    type="button"
                    onClick={() => setIsHistoryHidden(!isHistoryHidden)}
                    title={isHistoryHidden ? "Mostrar historial" : "Ocultar historial"}
                    aria-pressed={!isHistoryHidden}
                    className="dash-control flex items-center gap-1.5 px-3 py-2 rounded-2xl backdrop-blur type-control font-mono"
                  >
                    {isHistoryHidden ? (
                      <PanelRightOpen size={13} className="text-emerald-400" />
                    ) : (
                      <PanelRightClose size={13} className="text-shell-muted" />
                    )}
                    <span className="hidden lg:inline">
                      {isHistoryHidden ? "Mostrar historial" : "Ocultar historial"}
                    </span>
                  </button>
                  </GlowWrap>

                  {!isAiOpen && (
                    <GlowWrap radius={16} className="hidden xl:block">
                    <button
                      type="button"
                      onClick={() => setIsAiOpen(true)}
                      title="Abrir asistente ReSolve AI"
                      className="dash-control hidden xl:flex items-center gap-1.5 px-3 py-2 rounded-2xl backdrop-blur type-control font-mono"
                    >
                      <Sparkles size={13} className="text-amber-400" />
                      <span className="hidden sm:inline">ReSolve AI</span>
                    </button>
                    </GlowWrap>
                  )}

                  <GlowWrap radius={16} className="xl:hidden">
                  <button
                    type="button"
                    onClick={() => setIsAiDrawerOpen(true)}
                    title="Abrir asistente ReSolve AI"
                    aria-label="Abrir asistente ReSolve AI"
                    className="dash-control xl:hidden flex items-center gap-1.5 px-3 py-2 rounded-2xl backdrop-blur type-control font-mono"
                  >
                    <Sparkles size={13} className="text-amber-400" />
                    <span className="hidden sm:inline">IA</span>
                  </button>
                  </GlowWrap>

                  <GlowWrap radius={16}>
                  <button
                    type="button"
                    onClick={toggleFocusMode}
                    title="Modo enfoque: ocultar el panel superior"
                    aria-label="Activar modo enfoque"
                    className="dash-control flex items-center gap-1.5 px-3 py-2 rounded-2xl backdrop-blur type-control font-mono"
                  >
                    <EyeOff size={14} />
                    <span className="hidden xl:inline">Enfoque</span>
                  </button>
                  </GlowWrap>
                </motion.div>
              )}
            </AnimatePresence>

            {isFocusMode && (
              <SpecularButton
                size="lg"
                radius={18}
                tint="#ffffff"
                tintOpacity={isLightTheme ? 0.16 : 0.04}
                textColor={isLightTheme ? "#18181b" : "#f5f5f5"}
                lineColor={isLightTheme ? "#3f3f46" : "#ffffff"}
                baseColor={isLightTheme ? "#a1a1aa" : "#525252"}
                intensity={1}
                idleIntensity={0.35}
                shineSize={10}
                shineFade={34}
                thickness={1.2}
                glow={1}
                speed={0.35}
                followMouse
                autoAnimate
                proximity={250}
                onClick={toggleFocusMode}
                title="Restaurar vista anterior"
                aria-label="Restaurar vista anterior"
                className="col-start-3 justify-self-end type-control font-mono"
              >
                <Eye size={14} />
                <span className="hidden sm:inline">Restaurar</span>
              </SpecularButton>
            )}
          </div>

          <AnimatePresence initial={false}>
            {!isFocusMode && currentSubtopics.length > 0 && (
              <motion.div
                key="dashboard-subtopics"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: effectsEnabled ? 0.2 : 0 }}
                className="flex items-center gap-1.5 overflow-x-auto no-scrollbar"
              >
                {currentSubtopics.map((item) => {
                  const isActive = subTopic === item.id;
                  return (
                    <GlowWrap key={item.id} radius={9999}>
                    <button
                      onClick={() => {
                        setSubTopic(item.id);
                        closeMobileNav();
                        setNavInjectedExpr(null);
                        window.history.replaceState(null, "", "/dashboard");
                      }}
                      aria-pressed={isActive}
                      className={`relative px-4 py-2 rounded-full whitespace-nowrap type-control transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 ${
                        isActive
                          ? "text-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="subtopicPill"
                          className="absolute inset-0 bg-accent border border-border rounded-full"
                          transition={
                            effectsEnabled
                              ? { type: "spring", stiffness: 450, damping: 30 }
                              : { duration: 0 }
                          }
                        />
                      )}
                      <span className="relative z-10">{item.label}</span>
                    </button>
                    </GlowWrap>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* CONTENEDOR DE VISTAS CON CONTAINER QUERIES */}
        <div className="flex-1 min-h-0 p-4 lg:p-6 overflow-y-auto @container">
          {/* La vista anterior se desmonta al instante y la nueva entra opaca
              con un leve desplazamiento. Mantener ambas montadas (o fundirlas
              con opacidad) dejaba ver el fondo negro al terminar la sección. */}
          <motion.div
            key={`${activeModule}-${subTopic}-${viewMode}`}
            initial={{ y: effectsEnabled ? 10 : 0 }}
            animate={{ y: 0 }}
            transition={{ duration: effectsEnabled ? 0.22 : 0, ease: "easeOut" }}
            className="h-full"
          >
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
              ) : activeModule === "mat2" && subTopic === "proposiciones" ? (
                <PropositionsView viewMode={viewMode} initialExpression={initialExpr} />
              ) : activeModule === "mat2" && subTopic === "equivalencias" ? (
                <EquivalencesView viewMode={viewMode} initialExpression={initialExpr} />
              ) : activeModule === "mat2" && subTopic === "inferencias" ? (
                <InferencesView viewMode={viewMode} initialExpression={initialExpr} />
              ) : activeModule === "mat3" && subTopic === "interes-simple" ? (
                <SimpleInterestView viewMode={viewMode} initialExpression={initialExpr} />
              ) : activeModule === "mat3" && subTopic === "interes-compuesto" ? (
                <CompoundInterestView viewMode={viewMode} initialExpression={initialExpr} />
              ) : activeModule === "mat3" && subTopic === "anualidades" ? (
                <AnnuitiesView viewMode={viewMode} initialExpression={initialExpr} />
              ) : activeModule === "mat3" && subTopic === "amortizacion" ? (
                <AmortizationView viewMode={viewMode} initialExpression={initialExpr} />
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
                <ErrorTheoryView viewMode={viewMode} initialExpression={initialExpr} />
              ) : activeModule === "mat5" && subTopic === "descriptiva" ? (
                <DescriptiveStatsView viewMode={viewMode} initialExpression={initialExpr} />
              ) : activeModule === "mat5" && subTopic === "tablas-frecuencia" ? (
                <FrequencyTableView viewMode={viewMode} initialExpression={initialExpr} />
              ) : activeModule === "mat5" && subTopic === "probabilidad" ? (
                <ProbabilityView viewMode={viewMode} initialExpression={initialExpr} />
              ) : activeModule === "mat5" && subTopic === "distribuciones" ? (
                <DistributionsView viewMode={viewMode} initialExpression={initialExpr} />
              ) : activeModule === "mat5" && subTopic === "regresion" ? (
                <RegressionView viewMode={viewMode} initialExpression={initialExpr} />
              ) : activeModule === "mat6" && subTopic === "prog-lineal" ? (
                <LinearProgrammingView viewMode={viewMode} initialExpression={initialExpr} />
              ) : activeModule === "mat6" && subTopic === "simplex" ? (
                <SimplexView viewMode={viewMode} initialExpression={initialExpr} />
              ) : activeModule === "mat6" && subTopic === "asignacion" ? (
                <AssignmentView viewMode={viewMode} initialExpression={initialExpr} />
              ) : activeModule === "mat6" && subTopic === "teoria-colas" ? (
                <QueueingTheoryView viewMode={viewMode} initialExpression={initialExpr} />
              ) : (
                renderPlaceholder("Módulo en Desarrollo", "La arquitectura modular está lista para recibir las funciones de este apartado.")
              )}
          </motion.div>
        </div>
      </main>

      {/* =======================================================================
          3. ASISTENTE IA: COLUMNA EN ESCRITORIO (xl+), DRAWER EN PANTALLAS MENORES,
             CON REDIMENSIONADO POR ARRASTRE Y MODO MAXIMIZADO.
      ======================================================================== */}
      {isAiMaximized && !isFocusMode && (
        <div
          onClick={() => setIsAiMaximized(false)}
          className="fixed inset-0 z-40 bg-zinc-950/80 backdrop-blur-md transition-opacity"
        />
      )}

      {isAiOpen && !isFocusMode && (
        <motion.aside
          key="ai-panel"
          initial={{ opacity: 0, x: effectsEnabled ? 40 : 0 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: effectsEnabled ? 0.32 : 0, ease: [0.22, 1, 0.36, 1] }}
          style={!isAiMaximized ? { width: `${aiWidth}px` } : undefined}
          className={`transition-all duration-200 ease-out flex flex-col justify-between ${
            isAiMaximized
              ? "fixed inset-4 lg:inset-8 z-50 max-w-6xl mx-auto rounded-3xl border border-shell-hairline bg-zinc-950/95 backdrop-blur-2xl shadow-2xl p-6 lg:p-8 overflow-hidden"
              : "relative z-10 border-l border-shell-hairline p-5 hidden xl:flex h-full bg-shell-surface backdrop-blur-xl shrink-0"
          } print:hidden`}
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
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2 font-serif">
                <Sparkles size={13} className="text-amber-400 shrink-0" />
                <FoldText
                  text="ReSolve AI"
                  foldStyle="paper"
                  splitBy="char"
                  hinge="top"
                  trigger="mount"
                  foldAngle={92}
                  duration={0.65}
                  stagger={0.045}
                  staggerFrom="start"
                  ease="power3.out"
                  loopDelay={1.4}
                  hoverRefold
                  refoldRadius={140}
                  refoldAngle={45}
                  perspective={700}
                  creaseShading={0.55}
                  fontSize={26}
                  fontWeight={700}
                  className="text-foreground"
                />
                {isAiMaximized && (
                  <span className="text-[10px] text-zinc-500 lowercase font-sans font-normal">
                    · modo extendido
                  </span>
                )}
              </h3>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsAiMaximized(!isAiMaximized)}
                title={isAiMaximized ? "Restaurar tamaño (Esc)" : "Expandir a pantalla completa"}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-shell-hover transition-colors flex items-center gap-1 text-xs font-mono"
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

              <button
                type="button"
                onClick={() => {
                  if (isAiMaximized) setIsAiMaximized(false);
                  setIsAiOpen(false);
                }}
                title="Ocultar asistente IA"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-shell-hover transition-colors"
              >
                <PanelRightClose size={15} />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            <AIAssistant />
          </div>
        </motion.aside>
      )}

      {/* Drawer del asistente para pantallas < xl */}
      <AnimatePresence>
        {isAiDrawerOpen && !isFocusMode && (
          <>
            <motion.div
              key="ai-drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsAiDrawerOpen(false)}
              className="fixed inset-0 z-40 bg-zinc-950/70 backdrop-blur-sm xl:hidden print:hidden"
            />
            <motion.aside
              key="ai-drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              role="dialog"
              aria-label="Asistente ReSolve AI"
              className="fixed inset-y-0 right-0 z-50 w-[92vw] max-w-md border-l border-shell-hairline bg-shell-surface-strong backdrop-blur-2xl flex flex-col p-5 xl:hidden print:hidden"
            >
              <div className="mb-4 flex items-center justify-between shrink-0">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2 font-serif">
                  <Sparkles size={13} className="text-amber-400 shrink-0" />
                  <FoldText
                    text="ReSolve AI"
                    foldStyle="paper"
                    splitBy="char"
                    hinge="top"
                    trigger="mount"
                    foldAngle={92}
                    duration={0.65}
                    stagger={0.045}
                    staggerFrom="start"
                    ease="power3.out"
                    loopDelay={1.4}
                    hoverRefold
                    refoldRadius={140}
                    refoldAngle={45}
                    perspective={700}
                    creaseShading={0.55}
                    fontSize={26}
                    fontWeight={700}
                    className="text-foreground"
                  />
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAiDrawerOpen(false)}
                  title="Cerrar asistente"
                  aria-label="Cerrar asistente"
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-shell-hover transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 min-h-0 flex flex-col">
                <AIAssistant />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

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
    </ViewTransition>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="h-[100dvh] w-full bg-zinc-950 flex items-center justify-center text-xs text-zinc-500 font-mono">
          Cargando ReSolve...
        </div>
      }
    >
      <MotionConfig reducedMotion="user">
        <AIContextProvider>
          <DashboardContent />
        </AIContextProvider>
      </MotionConfig>
    </Suspense>
  );
}