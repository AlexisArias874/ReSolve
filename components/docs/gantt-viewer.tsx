"use client";

// =============================================================================
// ReSolve · Visor de calendario / Gantt interactivo (propio, con Tailwind)
// -----------------------------------------------------------------------------
// Pensado para que el calendario se entienda de un vistazo:
//  - Planes cortos (≤ 14 días): vista de calendario semanal por defecto.
//  - Planes largos: Gantt con escala automática (día / semana / mes).
//  - Cada tarea muestra su nombre, fechas y duración (o su horario).
//  - Fines de semana sombreados, rejilla por mes y línea de "hoy".
//  - Etiqueta y avance dentro de la barra cuando hay espacio.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import type { GanttTask } from "@/lib/documentation/diagrams";

const DAY = 86_400_000;

function toUTC(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

const longFmt = (ms: number) =>
  new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(ms));

const shortFmt = (ms: number) =>
  new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", timeZone: "UTC" }).format(
    new Date(ms),
  );

const monthFmt = (ms: number) =>
  new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(ms),
  );

const weekdayFmt = (ms: number) =>
  new Intl.DateTimeFormat("es-ES", { weekday: "short", timeZone: "UTC" })
    .format(new Date(ms))
    .replace(".", "");

const dayMonthFmt = (ms: number) =>
  new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(ms),
  );

const longWeekdayFmt = (ms: number) =>
  new Intl.DateTimeFormat("es-ES", { weekday: "long", timeZone: "UTC" }).format(new Date(ms));

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Scale = "day" | "week" | "month";
const BASE: Record<Scale, number> = { day: 46, week: 16, month: 7 };
const MAX: Record<Scale, number> = { day: 96, week: 26, month: 14 };

const SECTION_COLORS: Record<string, string> = {
  Inicio: "bg-violet-500",
  Análisis: "bg-sky-500",
  Diseño: "bg-amber-500",
  Desarrollo: "bg-emerald-500",
  Pruebas: "bg-rose-500",
  Despliegue: "bg-fuchsia-500",
  Cierre: "bg-zinc-400",
  Estudiantes: "bg-emerald-500",
  Soporte: "bg-sky-500",
};
const colorFor = (s: string) => SECTION_COLORS[s] ?? "bg-zinc-500";

const SECTION_CHIP: Record<string, string> = {
  Estudiantes: "border-emerald-500/35 bg-emerald-500/10",
  Soporte: "border-sky-500/35 bg-sky-500/10",
  Inicio: "border-violet-500/35 bg-violet-500/10",
  Análisis: "border-sky-500/35 bg-sky-500/10",
  Diseño: "border-amber-500/35 bg-amber-500/10",
  Desarrollo: "border-emerald-500/35 bg-emerald-500/10",
  Pruebas: "border-rose-500/35 bg-rose-500/10",
  Despliegue: "border-fuchsia-500/35 bg-fuchsia-500/10",
  Cierre: "border-zinc-600/50 bg-zinc-800/50",
};
const chipFor = (s: string) => SECTION_CHIP[s] ?? "border-zinc-700/60 bg-zinc-800/50";

const ROW_H = 48;
const SECTION_H = 30;
const MONTH_H = 26;
const TICK_H = 24;
const HEADER_H = MONTH_H + TICK_H;

const WEEKDAY_HEADERS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function pickScale(tasks: GanttTask[]): Scale {
  if (!tasks.length) return "week";
  const min = Math.min(...tasks.map((t) => toUTC(t.start)));
  const max = Math.max(...tasks.map((t) => toUTC(t.end)));
  const days = Math.round((max - min) / DAY) + 1;
  if (days <= 12) return "day";
  if (days <= 84) return "week";
  return "month";
}

function rangeDays(tasks: GanttTask[]): number {
  if (!tasks.length) return 0;
  const min = Math.min(...tasks.map((t) => toUTC(t.start)));
  const max = Math.max(...tasks.map((t) => toUTC(t.end)));
  return Math.round((max - min) / DAY) + 1;
}

/** Lunes de la semana (UTC) a la que pertenece `ms`. */
function startOfWeek(ms: number): number {
  const weekday = new Date(ms).getUTCDay(); // 0 = domingo
  const diff = (weekday + 6) % 7; // lunes = 0
  return ms - diff * DAY;
}

function shortName(name: string): string {
  const base = name.includes("·") ? name.split("·")[0].trim() : name;
  return base.length > 24 ? `${base.slice(0, 23).trimEnd()}…` : base;
}

// -----------------------------------------------------------------------------
// Vista de calendario (para planes cortos: capacitación)
// -----------------------------------------------------------------------------
function CalendarAgenda({ tasks, today }: { tasks: GanttTask[]; today: number }) {
  const min = Math.min(...tasks.map((t) => toUTC(t.start)));
  const max = Math.max(...tasks.map((t) => toUTC(t.end)));
  const first = startOfWeek(min);
  const last = startOfWeek(max) + 6 * DAY;

  const todayDate = new Date(today);
  const todayUTC = Date.UTC(
    todayDate.getUTCFullYear(),
    todayDate.getUTCMonth(),
    todayDate.getUTCDate(),
  );

  const cells: number[] = [];
  for (let day = first; day <= last; day += DAY) cells.push(day);

  return (
    <div className="h-full min-h-0 overflow-auto p-3 sm:p-4">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAY_HEADERS.map((label, i) => (
            <div
              key={label}
              className={`pb-1.5 text-center font-mono text-[10px] uppercase tracking-wider ${
                i >= 5 ? "text-zinc-600" : "text-zinc-500"
              }`}
            >
              {label}
            </div>
          ))}

          {cells.map((day) => {
            const date = new Date(day);
            const weekday = date.getUTCDay();
            const isWeekend = weekday === 0 || weekday === 6;
            const inRange = day >= min && day <= max;
            const isToday = day === todayUTC;
            const dayTasks = inRange
              ? tasks.filter((t) => toUTC(t.start) <= day && day <= toUTC(t.end))
              : [];

            return (
              <div
                key={day}
                className={`min-h-[152px] rounded-xl border p-2 transition-colors ${
                  inRange
                    ? "border-zinc-800/80 bg-zinc-900/50"
                    : "border-zinc-900/80 bg-zinc-950/30"
                } ${isWeekend ? "bg-zinc-950/50" : ""} ${
                  isToday ? "ring-1 ring-rose-400/70" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`text-sm font-semibold leading-none ${
                      inRange ? "text-zinc-200" : "text-zinc-700"
                    }`}
                  >
                    {date.getUTCDate()}
                  </span>
                  {isToday ? (
                    <span className="rounded bg-rose-500 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
                      hoy
                    </span>
                  ) : (
                    <span className="font-mono text-[9px] uppercase text-zinc-600">
                      {new Intl.DateTimeFormat("es-ES", { month: "short", timeZone: "UTC" })
                        .format(date)
                        .replace(".", "")}
                    </span>
                  )}
                </div>

                <div className="mt-2 space-y-1.5">
                  {dayTasks.map((task) => (
                    <div
                      key={task.id}
                      title={`${task.name}\n${longFmt(toUTC(task.start))} → ${longFmt(
                        toUTC(task.end),
                      )}${task.detail ? `\n${task.detail}` : ""}`}
                      className={`rounded-lg border px-2 py-1.5 ${chipFor(task.section)}`}
                    >
                      <div className="flex items-start gap-1.5">
                        <span
                          className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${colorFor(
                            task.section,
                          )}`}
                        />
                        <div className="min-w-0">
                          <p className="text-[10.5px] font-semibold leading-snug text-zinc-100">
                            {task.name}
                          </p>
                          {task.detail && (
                            <p className="mt-0.5 font-mono text-[9px] text-zinc-400">
                              {task.detail}
                            </p>
                          )}
                          {task.start !== task.end && (
                            <p className="mt-0.5 font-mono text-[9px] text-zinc-500">
                              hasta {dayMonthFmt(toUTC(task.end))}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              Sesiones programadas
            </h3>
            <span className="font-mono text-[10px] text-zinc-600">{tasks.length}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {[...tasks]
              .sort((a, b) => toUTC(a.start) - toUTC(b.start))
              .map((task, i) => (
                <div
                  key={task.id}
                  className={`flex items-start gap-3 rounded-xl border p-3 ${chipFor(task.section)}`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-bold text-white shadow-sm ring-1 ring-white/10 ${colorFor(
                      task.section,
                    )}`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11.5px] font-semibold leading-snug text-zinc-100">
                      {task.name}
                    </p>
                    <p className="mt-1 font-mono text-[9.5px] text-zinc-400">
                      {capitalize(longWeekdayFmt(toUTC(task.start)))} {dayMonthFmt(toUTC(task.start))}
                      {task.detail ? ` · ${task.detail}` : ""}
                    </p>
                    <span className="mt-1.5 flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-zinc-500">
                      <span className={`h-1.5 w-1.5 rounded-full ${colorFor(task.section)}`} />
                      {task.section}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Visor principal
// -----------------------------------------------------------------------------
export function GanttView({ tasks }: { tasks: GanttTask[] }) {
  const initialDays = rangeDays(tasks);
  const [view, setView] = useState<"calendar" | "gantt">(() =>
    initialDays > 0 && initialDays <= 14 ? "calendar" : "gantt",
  );
  const [scale, setScale] = useState<Scale>(() => pickScale(tasks));
  // Solo se renderiza en cliente (la página usa ssr:false): sin desajuste.
  const [today] = useState(() => Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);
  // Estimación inicial (el componente solo existe en cliente). El observer la
  // afina al ancho real del panel; si el navegador lo difiere, el calendario
  // igualmente aprovecha el espacio.
  const [avail, setAvail] = useState(() =>
    typeof window === "undefined" ? 900 : Math.max(320, Math.min(1400, window.innerWidth - 380)),
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setAvail(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  const model = useMemo(() => {
    if (!tasks.length) return null;

    const min = Math.min(...tasks.map((t) => toUTC(t.start)));
    const max = Math.max(...tasks.map((t) => toUTC(t.end)));
    const totalDays = Math.round((max - min) / DAY) + 1;

    // Estira la escala para aprovechar el ancho disponible (con topes legibles).
    const px =
      avail > 0
        ? Math.min(MAX[scale], Math.max(BASE[scale], avail / totalDays))
        : BASE[scale];
    const totalWidth = totalDays * px;

    const offset = (s: string) => ((toUTC(s) - min) / DAY) * px;
    const span = (t: GanttTask) => ((toUTC(t.end) - toUTC(t.start)) / DAY + 1) * px;
    const days = (t: GanttTask) => Math.round((toUTC(t.end) - toUTC(t.start)) / DAY) + 1;

    // Cabecera de meses
    const months: { label: string; left: number; width: number }[] = [];
    const startDate = new Date(min);
    let cursor = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1);
    while (cursor <= max) {
      const d = new Date(cursor);
      const daysIn = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      const monthStart = Math.max(cursor, min);
      const monthEnd = Math.min(cursor + (daysIn - 1) * DAY, max);
      months.push({
        label: monthFmt(cursor),
        left: ((monthStart - min) / DAY) * px,
        width: ((monthEnd - monthStart) / DAY + 1) * px,
      });
      cursor = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    }

    // Marcas de la segunda fila
    const ticks: { label: string; left: number }[] = [];
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(min + i * DAY);
      const day = date.getUTCDate();
      if (scale === "day") {
        ticks.push({ label: `${weekdayFmt(min + i * DAY)} ${day}`, left: i * px });
      } else if (scale === "week" && i % 7 === 0) {
        ticks.push({ label: shortFmt(min + i * DAY), left: i * px });
      } else if (scale === "month" && day === 1) {
        ticks.push({
          label: new Intl.DateTimeFormat("es-ES", { month: "short", timeZone: "UTC" }).format(date),
          left: i * px,
        });
      }
    }

    // Fines de semana (solo en escala diaria)
    const weekends: { left: number; width: number }[] = [];
    if (scale === "day") {
      for (let i = 0; i < totalDays; i++) {
        const wd = new Date(min + i * DAY).getUTCDay();
        if (wd === 0 || wd === 6) weekends.push({ left: i * px, width: px });
      }
    }

    // Filas agrupadas por sección (respetando el orden de aparición)
    const order: string[] = [];
    for (const t of tasks) if (!order.includes(t.section)) order.push(t.section);
    const rows: ({ type: "section"; name: string; count: number } | { type: "task"; task: GanttTask })[] =
      [];
    for (const sec of order) {
      const list = tasks.filter((x) => x.section === sec);
      rows.push({ type: "section", name: sec, count: list.length });
      for (const t of list) rows.push({ type: "task", task: t });
    }

    return { min, max, totalDays, px, totalWidth, offset, span, days, months, ticks, weekends, rows, order };
  }, [tasks, scale, avail]);

  if (!model) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Este calendario no tiene tareas.
      </div>
    );
  }

  const todayLeft = ((today - model.min) / DAY) * model.px;
  const todayInRange = todayLeft >= -1 && todayLeft <= model.totalWidth;
  const isShort = model.totalDays > 0 && model.totalDays <= 14;
  const sections = model.order;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40">
      {/* Barra de herramientas */}
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-800/80 bg-zinc-950/50 px-4 py-2.5">
        {isShort && (
          <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 p-0.5">
            {(["calendar", "gantt"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`rounded-md px-3 py-1 text-[11px] font-medium transition-colors ${
                  view === v ? "bg-zinc-100 text-zinc-950" : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {v === "calendar" ? "Calendario" : "Gantt"}
              </button>
            ))}
          </div>
        )}

        {view === "gantt" && (
          <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 p-0.5">
            {(["day", "week", "month"] as Scale[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScale(s)}
                aria-pressed={scale === s}
                className={`rounded-md px-3 py-1 text-[11px] font-medium transition-colors ${
                  scale === s ? "bg-zinc-100 text-zinc-950" : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {s === "day" ? "Día" : s === "week" ? "Semana" : "Mes"}
              </button>
            ))}
          </div>
        )}

        <span className="font-mono text-[11px] text-zinc-400">
          {longFmt(model.min)} — {longFmt(model.max)}
        </span>
        <span className="rounded-full border border-zinc-800 px-2 py-0.5 font-mono text-[10px] text-zinc-500">
          {view === "calendar"
            ? `${tasks.length} ${tasks.length === 1 ? "sesión" : "sesiones"}`
            : `${model.totalDays} días`}
        </span>

        {view === "calendar" ? (
          <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-500">
            {sections.map((section) => (
              <span key={section} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${colorFor(section)}`} /> {section}
              </span>
            ))}
          </span>
        ) : (
          <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-5 rounded-sm bg-emerald-500" /> duración
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-5 overflow-hidden rounded-sm bg-emerald-500">
                <span className="block h-full w-1/2 bg-white/40" />
              </span>
              avance
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-px bg-rose-400" /> hoy
            </span>
          </span>
        )}
      </div>

      {view === "calendar" ? (
        <CalendarAgenda tasks={tasks} today={today} />
      ) : (
        /* Tabla */
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex min-h-full">
            {/* Columna de etiquetas */}
            <div style={{ width: 240 }} className="shrink-0 border-r border-zinc-800/80 bg-zinc-950/40">
              <div style={{ height: HEADER_H }} className="border-b border-zinc-800/80" />
              {model.rows.map((r, i) =>
                r.type === "section" ? (
                  <div
                    key={`s-${i}`}
                    style={{ height: SECTION_H }}
                    className="flex items-center gap-2 px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-300"
                  >
                    <span className={`h-2 w-2 rounded-full ${colorFor(r.name)}`} />
                    <span className="truncate">{r.name}</span>
                    <span className="ml-auto font-mono text-[9px] text-zinc-600">{r.count}</span>
                  </div>
                ) : (
                  <div
                    key={r.task.id}
                    style={{ height: ROW_H }}
                    className="flex flex-col justify-center border-t border-zinc-800/40 px-3"
                  >
                    <span className="truncate text-[11.5px] leading-tight text-zinc-200" title={r.task.name}>
                      {r.task.name}
                    </span>
                    <span className="mt-0.5 truncate font-mono text-[9.5px] text-zinc-500">
                      {r.task.start === r.task.end
                        ? `${shortFmt(toUTC(r.task.start))}${
                            r.task.detail ? ` · ${r.task.detail}` : ` · ${model.days(r.task)} d`
                          }`
                        : `${shortFmt(toUTC(r.task.start))} – ${shortFmt(toUTC(r.task.end))}${
                            r.task.detail ? ` · ${r.task.detail}` : ` · ${model.days(r.task)} d`
                          }`}
                    </span>
                  </div>
                ),
              )}
            </div>

            {/* Área de barras */}
            <div className="min-w-0 flex-1 overflow-x-auto">
              <div className="relative" style={{ width: model.totalWidth }}>
                {/* Encabezado */}
                <div style={{ height: HEADER_H }} className="border-b border-zinc-800/80">
                  <div className="relative" style={{ height: MONTH_H }}>
                    {model.months.map((m, i) => (
                      <div
                        key={i}
                        style={{ left: m.left, width: m.width }}
                        className="absolute top-0 flex h-full items-center border-r border-zinc-800/60 px-2 text-[10px] font-semibold capitalize text-zinc-300"
                      >
                        <span className="truncate">{m.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="relative" style={{ height: TICK_H }}>
                    {model.ticks.map((t, i) => (
                      <div
                        key={i}
                        style={{ left: t.left }}
                        className="absolute top-0 flex h-full items-center whitespace-nowrap pl-1 font-mono text-[9px] text-zinc-500"
                      >
                        {t.label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Filas */}
                <div className="relative">
                  {/* Capa de fondo: fines de semana, meses y hoy */}
                  <div className="pointer-events-none absolute inset-0">
                    {model.weekends.map((w, i) => (
                      <div
                        key={`w-${i}`}
                        className="absolute inset-y-0 bg-zinc-800/25"
                        style={{ left: w.left, width: w.width }}
                      />
                    ))}
                    {model.months.map((m, i) => (
                      <div
                        key={`m-${i}`}
                        className="absolute inset-y-0 w-px bg-zinc-700/30"
                        style={{ left: m.left }}
                      />
                    ))}
                    {todayInRange && (
                      <div
                        className="absolute inset-y-0 z-20 w-px bg-rose-400/80"
                        style={{ left: todayLeft }}
                      >
                        <span className="absolute -top-px -translate-x-1/2 rounded bg-rose-500 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
                          hoy
                        </span>
                      </div>
                    )}
                  </div>

                  {model.rows.map((r, i) =>
                    r.type === "section" ? (
                      <div
                        key={`s-${i}`}
                        style={{ height: SECTION_H }}
                        className="relative z-10 border-t border-zinc-800/50 bg-zinc-950/50"
                      />
                    ) : (
                      <div
                        key={r.task.id}
                        style={{ height: ROW_H }}
                        className="relative border-t border-zinc-800/40"
                      >
                        <div
                          style={{ left: model.offset(r.task.start), width: model.span(r.task) }}
                          title={`${r.task.name}\n${longFmt(toUTC(r.task.start))} → ${longFmt(
                            toUTC(r.task.end),
                          )}${r.task.detail ? `\n${r.task.detail}` : ""}${
                            r.task.progress != null ? `\nAvance: ${r.task.progress}%` : ""
                          }`}
                          className={`group absolute top-1/2 flex h-6 -translate-y-1/2 items-center justify-between gap-1 overflow-hidden rounded-md ${colorFor(
                            r.task.section,
                          )} shadow-sm ring-1 ring-white/10 transition-transform hover:scale-[1.01]`}
                        >
                          {r.task.progress != null && (
                            <span
                              className="absolute inset-y-0 left-0 bg-white/30"
                              style={{ width: `${r.task.progress}%` }}
                            />
                          )}
                          {model.span(r.task) > 84 && (
                            <span className="relative z-10 min-w-0 flex-1 truncate px-1.5 text-left text-[9px] font-semibold text-white/90">
                              {shortName(r.task.name)}
                            </span>
                          )}
                          {model.span(r.task) > 84 && r.task.progress != null && (
                            <span className="relative z-10 shrink-0 pr-1.5 font-mono text-[9px] font-bold text-white/90">
                              {r.task.progress}%
                            </span>
                          )}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
