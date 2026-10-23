"use client";

import { ROLE_MATRIX } from "@/lib/manuals/shared";

export default function RoleMatrix({ print = false }: { print?: boolean }) {
  if (print) {
    return (
      <table style={{ width: "100%", borderCollapse: "collapse", margin: "14px 0", fontSize: "10px" }}>
        <thead>
          <tr>
            {["Rol", "Acceso", "Puede"].map((header) => (
              <th
                key={header}
                style={{
                  textAlign: "left",
                  padding: "6px 8px",
                  borderBottom: "1px solid #57534e",
                  fontFamily: "Georgia, serif",
                  fontSize: "10px",
                }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROLE_MATRIX.map((row) => (
            <tr key={row.role}>
              <td style={{ padding: "6px 8px", borderBottom: "1px solid #d6d3d1", verticalAlign: "top", fontWeight: 700 }}>
                {row.role}
              </td>
              <td style={{ padding: "6px 8px", borderBottom: "1px solid #d6d3d1", verticalAlign: "top" }}>
                {row.access}
              </td>
              <td style={{ padding: "6px 8px", borderBottom: "1px solid #d6d3d1", verticalAlign: "top" }}>
                {row.can}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div className="my-6 overflow-x-auto rounded-lg border border-stone-300">
      <table className="w-full min-w-[620px] border-collapse text-left text-sm">
        <thead>
          <tr className="bg-stone-100">
            <th className="border-b border-stone-300 px-4 py-3 font-serif text-xs font-semibold uppercase tracking-wider text-stone-600">
              Rol
            </th>
            <th className="border-b border-stone-300 px-4 py-3 font-serif text-xs font-semibold uppercase tracking-wider text-stone-600">
              Acceso
            </th>
            <th className="border-b border-stone-300 px-4 py-3 font-serif text-xs font-semibold uppercase tracking-wider text-stone-600">
              Puede
            </th>
          </tr>
        </thead>
        <tbody>
          {ROLE_MATRIX.map((row) => (
            <tr key={row.role} className="align-top">
              <td className="border-b border-stone-200 px-4 py-3 text-xs font-semibold text-stone-900">
                {row.role}
              </td>
              <td className="border-b border-stone-200 px-4 py-3 text-xs text-stone-600">
                {row.access}
              </td>
              <td className="border-b border-stone-200 px-4 py-3 text-xs leading-5 text-stone-600">
                {row.can}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
