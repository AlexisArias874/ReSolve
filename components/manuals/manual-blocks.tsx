"use client";

import CodeBlock from "./code-block";
import InterfaceMap from "./interface-map";
import ManualDiagram from "./manual-diagram";
import ModuleCatalog from "./module-catalog";
import RoleMatrix from "./role-matrix";
import TrainingCalendar from "./training-calendar";
import type { ManualBlock } from "@/lib/manuals/types";

export default function ManualBlocks({ blocks, print = false }: { blocks: ManualBlock[]; print?: boolean }) {
  return (
    <>
      {blocks.map((block, index) => {
        switch (block.type) {
          case "paragraph":
            return print ? (
              <p key={index} style={{ margin: "0 0 9px", fontSize: "11px", lineHeight: 1.65, color: "#292524" }}>
                {block.text}
              </p>
            ) : (
              <p key={index} className="mb-4 text-[15px] leading-7 text-stone-700">
                {block.text}
              </p>
            );

          case "list":
            return print ? (
              block.ordered ? (
                <ol key={index} style={{ margin: "0 0 10px", paddingLeft: "18px", fontSize: "11px", lineHeight: 1.6, color: "#292524" }}>
                  {block.items.map((item) => (
                    <li key={item} style={{ marginBottom: "3px" }}>{item}</li>
                  ))}
                </ol>
              ) : (
                <ul key={index} style={{ margin: "0 0 10px", paddingLeft: "18px", fontSize: "11px", lineHeight: 1.6, color: "#292524" }}>
                  {block.items.map((item) => (
                    <li key={item} style={{ marginBottom: "3px" }}>{item}</li>
                  ))}
                </ul>
              )
            ) : block.ordered ? (
              <ol key={index} className="mb-5 list-decimal space-y-2 pl-5 text-[15px] leading-7 text-stone-700 marker:text-stone-400">
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            ) : (
              <ul key={index} className="mb-5 list-disc space-y-2 pl-5 text-[15px] leading-7 text-stone-700 marker:text-stone-400">
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            );

          case "table":
            return (
              <div key={index} className={print ? undefined : "my-6 overflow-x-auto rounded-lg border border-stone-300"}>
                <table
                  style={print ? { width: "100%", borderCollapse: "collapse", margin: "12px 0", fontSize: "10px" } : undefined}
                  className={print ? undefined : "w-full min-w-[560px] border-collapse text-left text-sm"}
                >
                  <thead>
                    <tr className={print ? undefined : "bg-stone-100"}>
                      {block.headers.map((header) => (
                        <th
                          key={header}
                          style={print ? { textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #57534e", fontFamily: "Georgia, serif", fontSize: "10px", color: "#292524" } : undefined}
                          className={print ? undefined : "border-b border-stone-300 px-4 py-3 font-serif text-xs font-semibold uppercase tracking-wider text-stone-500"}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={`${index}-${rowIndex}`} className={print ? undefined : "align-top"}>
                        {row.map((cell, cellIndex) => (
                          <td
                            key={`${index}-${rowIndex}-${cellIndex}`}
                            style={print ? { padding: "6px 8px", borderBottom: "1px solid #d6d3d1", verticalAlign: "top", fontSize: "10px", lineHeight: 1.5, color: "#292524" } : undefined}
                            className={print ? undefined : "border-b border-stone-200 px-4 py-3 text-xs leading-5 text-stone-600"}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {block.caption && (
                  <p style={print ? { margin: "3px 0 10px", fontSize: "9px", color: "#78716c" } : undefined} className={print ? undefined : "border-t border-stone-200 px-4 py-2 text-[11px] text-stone-500"}>
                    {block.caption}
                  </p>
                )}
              </div>
            );

          case "code":
            return <CodeBlock key={index} {...block} print={print} />;

          case "callout":
            return print ? (
              <div
                key={index}
                style={{
                  margin: "12px 0",
                  padding: "9px 12px",
                  borderLeft: "3px solid #57534e",
                  background: "#f5f5f4",
                  breakInside: "avoid",
                }}
              >
                <div style={{ fontFamily: "Georgia, serif", fontSize: "11px", fontWeight: 700, color: "#292524" }}>
                  {block.title}
                </div>
                <p style={{ margin: "3px 0 0", fontSize: "10px", lineHeight: 1.55, color: "#44403c" }}>
                  {block.text}
                </p>
              </div>
            ) : (
              <aside
                key={index}
                className={`my-6 border-l-2 py-1 pl-4 ${
                  block.tone === "important" ? "border-stone-700" : "border-stone-400"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-800">
                  {block.title}
                </p>
                <p className="mt-1 text-sm leading-6 text-stone-600">{block.text}</p>
              </aside>
            );

          case "steps":
            return print ? (
              <div key={index} style={{ margin: "10px 0" }}>
                {block.items.map((item, stepIndex) => (
                  <div key={item.title} style={{ display: "flex", gap: "9px", marginBottom: "7px", breakInside: "avoid" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "18px",
                        height: "18px",
                        flexShrink: 0,
                        border: "1px solid #78716c",
                        borderRadius: "999px",
                        fontSize: "9px",
                        fontWeight: 700,
                        color: "#292524",
                      }}
                    >
                      {stepIndex + 1}
                    </span>
                    <div>
                      <div style={{ fontFamily: "Georgia, serif", fontSize: "11px", fontWeight: 700, color: "#292524" }}>
                        {item.title}
                      </div>
                      <p style={{ margin: "1px 0 0", fontSize: "10px", lineHeight: 1.55, color: "#44403c" }}>
                        {item.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ol key={index} className="my-6 space-y-5 border-l border-stone-300 pl-6">
                {block.items.map((item, stepIndex) => (
                  <li key={item.title} className="relative">
                    <span className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border border-stone-400 bg-[#fbfaf7] text-[10px] font-bold text-stone-700">
                      {stepIndex + 1}
                    </span>
                    <h4 className="font-serif text-base font-semibold text-stone-900">{item.title}</h4>
                    <p className="mt-1 text-sm leading-6 text-stone-600">{item.text}</p>
                  </li>
                ))}
              </ol>
            );

          case "diagram":
            return <ManualDiagram key={index} diagramId={block.diagramId} caption={block.caption} print={print} />;

          case "interfaceMap":
            return <InterfaceMap key={index} print={print} />;

          case "moduleCatalog":
            return <ModuleCatalog key={index} print={print} />;

          case "roleMatrix":
            return <RoleMatrix key={index} print={print} />;

          case "trainingCalendar":
            return <TrainingCalendar key={index} print={print} />;

          default:
            return null;
        }
      })}
    </>
  );
}
