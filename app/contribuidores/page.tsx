"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { ViewTransition } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  BrainCircuit,
  Code2,
  Database,
  GraduationCap,
  LayoutDashboard,
  Rocket,
  ServerCog,
  ShieldCheck,
  TestTube2,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { SiAngular, SiAstro, SiBootstrap, SiCss, SiGit, SiHtml5, SiJavascript, SiNodedotjs, SiSupabase, SiSvelte, SiTypescript, SiVuedotjs } from "react-icons/si";
import BrandLogo from "@/components/shared/brand-logo";
import AnimatedContent from "@/components/effects/animated-content";
import LogoLoop, { type LogoLoopItem } from "@/components/effects/logo-loop";
import GlowWrap from "@/components/effects/glow-wrap";
import { THEME_FX, useTheme } from "@/lib/hooks/use-theme";

// El fondo WebGL solo se monta en cliente, igual que en la documentación.
const Antigravity = dynamic(() => import("@/components/effects/antigravity"), {
  ssr: false,
});

interface Contributor {
  name: string;
  role: string;
  contribution: string;
  icon: LucideIcon;
  accent: string;
}

// Integrantes y roles tomados del organigrama del Equipo 2.
const CONTRIBUTORS: Contributor[] = [
  {
    name: "Fischer Navarro Ethan Axel",
    role: "Representante · Líder de Proyecto · Arquitecto",
    contribution:
      "Coordinó el proyecto, definió la arquitectura y cuidó la integración entre módulos.",
    icon: Rocket,
    accent: "#f59e0b",
  },
  {
    name: "Gallardo Nava Rodrigo",
    role: "Analista Funcional",
    contribution:
      "Levantó requerimientos, casos de uso y el análisis funcional de la plataforma.",
    icon: Workflow,
    accent: "#38bdf8",
  },
  {
    name: "Corona Díaz Luis Enrique",
    role: "Administrador de Base de Datos",
    contribution:
      "Diseñó el modelo de datos, el esquema en Supabase y las consultas SQL.",
    icon: Database,
    accent: "#34d399",
  },
  {
    name: "Huerta Zarate Ernesto",
    role: "Desarrollo Backend",
    contribution:
      "Implementó la persistencia, la autenticación y los servicios del servidor.",
    icon: ServerCog,
    accent: "#a78bfa",
  },
  {
    name: "Santiago Vázquez Leonel",
    role: "Frontend / UX",
    contribution:
      "Construyó el dashboard, los módulos interactivos y la experiencia responsive.",
    icon: LayoutDashboard,
    accent: "#f472b6",
  },
  {
    name: "Perez Torres Juan Enrique",
    role: "Calidad (QA) / UML",
    contribution:
      "Definió las pruebas, los diagramas UML y los criterios de calidad del sistema.",
    icon: TestTube2,
    accent: "#fb7185",
  },
  {
    name: "Martinez Nery Diego Alejandro",
    role: "Integración de IA",
    contribution:
      "Integró el asistente de IA, los prompts y el motor de resolución universal.",
    icon: BrainCircuit,
    accent: "#c084fc",
  },
  {
    name: "Palma Lascano Jesús Alejandro",
    role: "Documentación / Manuales",
    contribution:
      "Redactó la documentación, los manuales de uso y los diagramas del proyecto.",
    icon: BookOpen,
    accent: "#facc15",
  },
  {
    name: "Acevedo Esparza Diego Eduardo",
    role: "DevOps / Seguridad",
    contribution:
      "Configuró el despliegue, la seguridad y las variables de entorno del proyecto.",
    icon: ShieldCheck,
    accent: "#2dd4bf",
  },
  {
    name: "Peña Arias Josue Alexis",
    role: "Procesos / Capacitación",
    contribution:
      "Documentó los procesos, la capacitación y el cierre del entregable.",
    icon: Code2,
    accent: "#60a5fa",
  },
];

const TECH_LOGOS: LogoLoopItem[] = [
  { node: <SiTypescript />, title: "TypeScript", href: "https://www.typescriptlang.org", hoverColor: "#3178c6" },
  { node: <SiVuedotjs />, title: "Vue", href: "https://vuejs.org", hoverColor: "#41b883" },
  { node: <SiJavascript />, title: "JavaScript", href: "https://developer.mozilla.org/docs/Web/JavaScript", hoverColor: "#f7df1e" },
  { node: <SiAngular />, title: "Angular", href: "https://angular.dev", hoverColor: "#dd0031" },
  { node: <SiCss />, title: "CSS", href: "https://developer.mozilla.org/docs/Web/CSS", hoverColor: "#663399" },
  { node: <SiSvelte />, title: "Svelte", href: "https://svelte.dev", hoverColor: "#ff3e00" },
  { node: <SiHtml5 />, title: "HTML5", href: "https://developer.mozilla.org/docs/Web/HTML", hoverColor: "#e34f26" },
  { node: <SiAstro />, title: "Astro", href: "https://astro.build", hoverColor: "#ff5d01" },
  { node: <SiSupabase />, title: "Supabase", href: "https://supabase.com", hoverColor: "#3ecf8e" },
  { node: <SiBootstrap />, title: "Bootstrap", href: "https://getbootstrap.com", hoverColor: "#7952b3" },
  { node: <SiNodedotjs />, title: "Node.js", href: "https://nodejs.org", hoverColor: "#5fa04e" },
  { node: <SiGit />, title: "Git", href: "https://git-scm.com", hoverColor: "#f05032" },
];

const STATS = [
  { label: "Integrantes", value: "10" },
  { label: "Módulos", value: "6" },
  { label: "Especialidades", value: "9" },
];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function ContribuidoresPage() {
  const theme = useTheme();
  const fx = THEME_FX[theme].particles;

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
      <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
        {/* Fondo animado + capas de profundidad */}
        <div className="pointer-events-none fixed inset-0 z-0 opacity-70">
          <Antigravity
            colors={fx.colors}
            count={1100}
            magnetRadius={9}
            ringRadius={7}
            particleSize={0.9}
            lightMode={fx.light}
            autoAnimate
            interactive
            clickBurst={false}
          />
        </div>
        <div className="fx-overlay-contrib pointer-events-none fixed inset-0 z-0" />

        <header className="sticky top-0 z-40 border-b border-zinc-900/80 bg-zinc-950/70 backdrop-blur-xl">
          <div className="mx-auto grid max-w-[1400px] grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-4 sm:px-6">
            <Link
              href="/dashboard"
              transitionTypes={["nav-back"]}
              className="inline-flex items-center gap-2 justify-self-start text-sm text-zinc-400 transition-colors hover:text-zinc-100"
            >
              <ArrowLeft size={16} /> Volver al panel
            </Link>
            <BrandLogo size="md" align="center" />
          </div>
        </header>

        <main className="relative z-10 mx-auto max-w-[1400px] px-4 pb-20 pt-14 sm:px-6 lg:pt-20">
          <AnimatedContent
            distance={40}
            direction="vertical"
            duration={0.8}
            ease="power3.out"
            blur={4}
            stagger={0.1}
            threshold={0.1}
            className="mx-auto max-w-3xl text-center"
          >
            <div className="mb-5 flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-4 py-1.5 text-[11px] font-mono uppercase tracking-[0.18em] text-violet-200/90">
                <GraduationCap size={14} /> FESC · Licenciatura en Informática
              </span>
            </div>
            <h1 className="font-serif text-4xl font-bold tracking-tight text-zinc-50 sm:text-5xl lg:text-6xl">
              Contribuidores
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
              Esta plataforma fue creada por alumnos de la Facultad de Estudios
              Superiores Cuautitlán (FESC) de la Licenciatura en Informática.
              Cada integrante aportó desde su especialidad para convertir a
              ReSolve en una herramienta completa de matemáticas.
            </p>
          </AnimatedContent>

          {/* Cifras rápidas */}
          <AnimatedContent
            distance={24}
            duration={0.6}
            ease="power2.out"
            stagger={0.08}
            threshold={0.2}
            className="mx-auto mt-10 grid max-w-2xl grid-cols-3 gap-3"
          >
            {STATS.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-4 text-center backdrop-blur-xl"
              >
                <span className="block font-serif text-2xl font-bold text-zinc-100 sm:text-3xl">
                  {stat.value}
                </span>
                <span className="mt-1 block text-[10px] font-mono uppercase tracking-[0.16em] text-zinc-500">
                  {stat.label}
                </span>
              </div>
            ))}
          </AnimatedContent>

          {/* Equipo */}
          <section className="mt-20" aria-labelledby="equipo">
            <AnimatedContent
              distance={30}
              duration={0.7}
              ease="power3.out"
              stagger={0.08}
              className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
            >
              <div>
                <p className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-violet-300/80">
                  <Users size={13} /> Equipo 2
                </p>
                <h2 id="equipo" className="mt-2 font-serif text-2xl font-bold text-zinc-100 sm:text-3xl">
                  Integrantes del equipo
                </h2>
              </div>
            </AnimatedContent>

            <AnimatedContent
              distance={34}
              duration={0.7}
              ease="power3.out"
              blur={2}
              stagger={0.07}
              threshold={0.08}
              className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
            >
              {CONTRIBUTORS.map((person) => {
                const Icon = person.icon;
                return (
                  <article
                    key={person.name}
                    className="group relative h-full overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/40 p-5 backdrop-blur-xl transition-colors duration-300 hover:border-white/20 hover:bg-zinc-900/60"
                  >
                    <div
                      className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-30"
                      style={{ backgroundColor: person.accent }}
                    />
                    <div className="relative flex items-start gap-3.5">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-sm font-bold"
                        style={{
                          borderColor: `${person.accent}55`,
                          backgroundColor: `${person.accent}18`,
                          color: person.accent,
                        }}
                        aria-hidden
                      >
                        {initials(person.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold leading-5 text-zinc-100">
                          {person.name}
                        </h3>
                        <p
                          className="mt-1 flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.08em]"
                          style={{ color: person.accent }}
                        >
                          <Icon size={12} className="shrink-0" /> {person.role}
                        </p>
                      </div>
                    </div>
                    <p className="relative mt-4 text-xs leading-6 text-zinc-400">
                      {person.contribution}
                    </p>
                  </article>
                );
              })}
            </AnimatedContent>
          </section>

          {/* Herramientas */}
          <section className="mt-24" aria-labelledby="herramientas">
            <AnimatedContent
              distance={30}
              duration={0.7}
              ease="power3.out"
              stagger={0.1}
              className="mx-auto max-w-3xl text-center"
            >
              <h2 id="herramientas" className="font-serif text-2xl font-bold text-zinc-100 sm:text-3xl">
                Herramientas que hacen posible ReSolve
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-zinc-400">
                Construimos la interfaz con TypeScript y componentes
                reutilizables; los estilos y la responsividad con CSS; los datos
                y la autenticación con Supabase.
              </p>
            </AnimatedContent>

            <AnimatedContent
              distance={24}
              duration={0.6}
              ease="power2.out"
              threshold={0.15}
              className="mx-auto mt-8 max-w-4xl"
            >
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-8 backdrop-blur-xl sm:px-8">
                <LogoLoop
                  logos={TECH_LOGOS}
                  speed={80}
                  direction="left"
                  logoHeight={44}
                  gap={56}
                  hoverSpeed={0}
                  scaleOnHover
                  ariaLabel="Tecnologías utilizadas en ReSolve"
                />
              </div>
            </AnimatedContent>
          </section>

          {/* Cierre */}
          <AnimatedContent
            distance={30}
            duration={0.7}
            ease="power3.out"
            stagger={0.1}
            threshold={0.2}
            className="mx-auto mt-24 max-w-2xl text-center"
          >
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-500">
              Hecho en la FESC
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <GlowWrap radius={14}>
                <Link
                  href="/dashboard"
                  transitionTypes={["nav-back"]}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07]"
                >
                  <ArrowLeft size={15} /> Volver al panel
                </Link>
              </GlowWrap>
              <GlowWrap radius={14}>
                <Link
                  href="/documentacion"
                  transitionTypes={["nav-forward"]}
                  className="inline-flex items-center gap-2 rounded-2xl border border-violet-400/25 bg-violet-500/10 px-4 py-2.5 text-sm text-violet-100 transition-colors hover:border-violet-300/40 hover:bg-violet-500/15"
                >
                  Ver documentación <ArrowUpRight size={15} />
                </Link>
              </GlowWrap>
            </div>
          </AnimatedContent>
        </main>

        <footer className="relative z-10 border-t border-white/5">
          <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-3 px-4 py-6 text-center text-[11px] text-zinc-600 sm:flex-row sm:px-6 sm:text-left">
            <span className="flex items-center gap-2 font-mono uppercase tracking-[0.14em]">
              <GraduationCap size={13} /> FESC · Licenciatura en Informática
            </span>
            <span>ReSolve · Proyecto académico del Equipo 2</span>
          </div>
        </footer>
      </div>
    </ViewTransition>
  );
}
