"use client";

import { CalendarDays } from "lucide-react";
import { TRAINING_DATE_NOTICE, TRAINING_SESSIONS } from "@/lib/manuals/shared";

export default function TrainingCalendar({ print = false }: { print?: boolean }) {
  if (print) {
    return (
      <div style={{ margin: "14px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px", fontSize: "10px", color: "#57534e" }}>
          <CalendarDays size={13} /> Calendario propuesto
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
          <thead>
            <tr>
              {["Sesión", "Fecha", "Tema", "Dirigido a", "Duración"].map((header) => (
                <th
                  key={header}
                  style={{
                    textAlign: "left",
                    padding: "6px 8px",
                    borderBottom: "1px solid #57534e",
                    fontFamily: "Georgia, serif",
                  }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TRAINING_SESSIONS.map((session) => (
              <tr key={session.number}>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid #d6d3d1" }}>{session.number}</td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid #d6d3d1" }}>{session.date}</td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid #d6d3d1" }}>{session.topic}</td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid #d6d3d1" }}>{session.audience}</td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid #d6d3d1" }}>{session.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ margin: "7px 0 0", fontSize: "9px", lineHeight: 1.5, color: "#78716c" }}>
          {TRAINING_DATE_NOTICE}
        </p>
      </div>
    );
  }

  return (
    <div className="my-6 overflow-hidden rounded-lg border border-stone-300">
      <div className="flex items-center gap-2 border-b border-stone-300 bg-stone-100 px-4 py-3 text-[10px] font-mono uppercase tracking-[0.16em] text-stone-500">
        <CalendarDays size={13} /> Calendario propuesto
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-left text-sm">
          <thead>
            <tr>
              {["Sesión", "Fecha", "Tema", "Dirigido a", "Duración"].map((header) => (
                <th
                  key={header}
                  className="border-b border-stone-300 px-4 py-3 font-serif text-xs font-semibold uppercase tracking-wider text-stone-500"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TRAINING_SESSIONS.map((session) => (
              <tr key={session.number} className="align-top">
                <td className="border-b border-stone-200 px-4 py-3 text-xs font-semibold text-stone-900">
                  {session.number}
                </td>
                <td className="border-b border-stone-200 px-4 py-3 text-xs text-stone-600">
                  {session.date}
                </td>
                <td className="border-b border-stone-200 px-4 py-3 text-xs text-stone-700">
                  <span className="block font-medium text-stone-900">{session.topic}</span>
                  <span className="mt-0.5 block text-[11px] text-stone-500">{session.objective}</span>
                </td>
                <td className="border-b border-stone-200 px-4 py-3 text-xs text-stone-600">
                  {session.audience}
                </td>
                <td className="border-b border-stone-200 px-4 py-3 text-xs text-stone-600">
                  {session.duration}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-stone-200 px-4 py-3 text-[11px] leading-5 text-stone-500">
        {TRAINING_DATE_NOTICE}
      </p>
    </div>
  );
}
