#!/usr/bin/env node
/**
 * build-docs.mjs
 * ----------------------------------------------------------------------------
 * Construye los entregables de Word y PDF a partir del Markdown fuente,
 * renderizando los diagramas Mermaid a imágenes (PNG para Word, SVG para PDF/HTML).
 *
 * Uso:  node scripts/build-docs.mjs
 *
 * Requisitos:
 *   - mermaid-cli (mmdc) instalado globalmente
 *   - pandoc en el PATH o en %LOCALAPPDATA%\Pandoc\pandoc.exe
 *   - Microsoft Edge (se usa como motor de render para mmdc y para el PDF)
 * ----------------------------------------------------------------------------
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const SRC = path.join(root, "docs", "Plan_de_Trabajo_Equipo2.md");
const BUILD = path.join(root, "docs", "build");
const DIAGRAMS = path.join(BUILD, "diagrams");
const PUPPETEER_CFG = path.join(BUILD, "puppeteer-config.json");
const OUT_DOCX = path.join(root, "docs", "Plan_de_Trabajo_Equipo2.docx");
const OUT_PDF = path.join(root, "docs", "Plan_de_Trabajo_Equipo2.pdf");

const MMDC = "C:\\nvm4w\\nodejs\\mmdc.cmd";
const PANDOC =
  process.env.PANDOC ||
  [path.join(process.env.LOCALAPPDATA || "", "Pandoc", "pandoc.exe"), "pandoc"].find(
    (p) => p === "pandoc" || fs.existsSync(p)
  );
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

fs.mkdirSync(DIAGRAMS, { recursive: true });

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: true, ...opts });
  if (r.status !== 0) throw new Error(`Falló: ${cmd} ${args.join(" ")}`);
}

function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

function svgSize(file) {
  const s = fs.readFileSync(file, "utf8");
  const vb = s.match(/viewBox="[\d.\s-]*?([\d.]+)\s+([\d.]+)"/);
  if (vb) return { w: parseFloat(vb[1]), h: parseFloat(vb[2]) };
  const w = s.match(/\bwidth="([\d.]+)/);
  const h = s.match(/\bheight="([\d.]+)/);
  return { w: w ? parseFloat(w[1]) : 800, h: h ? parseFloat(h[1]) : 600 };
}

/** Ancho a usar (pulgadas) para que la imagen quepa en la caja maxW x maxH. */
function fitWidth({ w, h }, maxW = 6.5, maxH = 8.5) {
  const aspect = w / h;
  const width = aspect >= maxW / maxH ? maxW : maxH * aspect;
  return Math.round(width * 10) / 10;
}

// ---------------------------------------------------------------------------
// 1) Leer y limpiar el Markdown
// ---------------------------------------------------------------------------
let md = fs.readFileSync(SRC, "utf8");

// Quitar la nota de edición (bloque cita al inicio)
md = md.replace(/^> \*\*Nota de edición[\s\S]*?(?=\n\n)/m, "");

// Quitar los respaldos ASCII (etiqueta en negritas + bloque de código)
md = md.replace(/\n\*\*Respaldo en texto[^\n]*\*\*[^\n]*\n+```[^\n]*\n[\s\S]*?\n```\n?/g, "\n");

// ---------------------------------------------------------------------------
// 2) Renderizar cada diagrama Mermaid
// ---------------------------------------------------------------------------
const dims = {};
let n = 0;
md = md.replace(/```mermaid\r?\n([\s\S]*?)```/g, (_m, code) => {
  n++;
  const id = String(n).padStart(2, "0");
  const mmd = path.join(BUILD, `diagram-${id}.mmd`);
  fs.writeFileSync(mmd, code, "utf8");

  const png = path.join(DIAGRAMS, `diagram-${id}.png`);
  const svg = path.join(DIAGRAMS, `diagram-${id}.svg`);
  const cached = fs.existsSync(png) && fs.statSync(png).size > 1000 &&
    fs.existsSync(svg) && fs.statSync(svg).size > 1000;
  if (cached) {
    console.log(`\n[${n}] diagram-${id}: en caché, se reutiliza.`);
  } else {
    console.log(`\n[${n}] Renderizando diagram-${id} ...`);
    run(MMDC, ["-i", mmd, "-o", png, "-p", PUPPETEER_CFG, "-b", "white", "-s", "3"]);
    run(MMDC, ["-i", mmd, "-o", svg, "-p", PUPPETEER_CFG, "-b", "white"]);
  }
  dims[id] = { png: pngSize(png), svg: svgSize(svg) };
  return `@@IMG:${id}@@`;
});

function resolveImages(text, ext) {
  return text.replace(/@@IMG:(\d+)@@/g, (_m, id) => {
    const d = dims[id] || { png: { w: 800, h: 600 }, svg: { w: 800, h: 600 } };
    const width = fitWidth(ext === "svg" ? d.svg : d.png);
    return `![](diagrams/diagram-${id}.${ext}){ width=${width}in }`;
  });
}

const mdDocx = resolveImages(md, "png");
const mdHtml = resolveImages(md, "svg");
fs.writeFileSync(path.join(BUILD, "Plan.docx.md"), mdDocx, "utf8");
fs.writeFileSync(path.join(BUILD, "Plan.html.md"), mdHtml, "utf8");
console.log(`\nDiagramas renderizados: ${n}`);

// ---------------------------------------------------------------------------
// 3) DOCX (Pandoc)
// ---------------------------------------------------------------------------
console.log("\nGenerando DOCX con Pandoc ...");
run(
  PANDOC,
  [
    "Plan.docx.md",
    "-o", OUT_DOCX,
    "--toc", "--toc-depth=3",
    '--metadata', "title=Plan de Trabajo - ReSolve (Equipo 2)",
  ],
  { cwd: BUILD, shell: false }
);

// ---------------------------------------------------------------------------
// 4) HTML autocontenido (para el PDF)
// ---------------------------------------------------------------------------
const css = `
@page { size: A4; margin: 16mm 14mm; }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
       line-height: 1.55; color: #1f2328; max-width: 1000px; margin: 0 auto; padding: 8px 20px; }
h1, h2, h3, h4 { line-height: 1.25; margin-top: 1.2em; }
h1 { font-size: 1.9em; border-bottom: 2px solid #d0d7de; padding-bottom: .25em; }
h2 { font-size: 1.5em; border-bottom: 1px solid #d0d7de; padding-bottom: .2em; }
h3 { font-size: 1.2em; }
a { color: #0969da; text-decoration: none; }
code, pre { font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace; }
code { background: #f6f8fa; border-radius: 5px; padding: .1em .35em; font-size: .9em; }
pre { background: #f6f8fa; border: 1px solid #e1e4e8; border-radius: 8px; padding: 12px 14px;
      overflow: auto; font-size: 12px; }
pre code { background: none; padding: 0; }
table { border-collapse: collapse; width: 100%; margin: 14px 0; font-size: 12px; }
th, td { border: 1px solid #d0d7de; padding: 6px 9px; text-align: left; vertical-align: top;
         word-break: break-word; }
th { background: #f6f8fa; }
tr:nth-child(even) td { background: #fbfcfd; }
blockquote { border-left: 4px solid #d0d7de; color: #59636e; margin: 12px 0; padding: 2px 16px; }
img { max-width: 100%; height: auto; display: block; margin: 14px auto; }
hr { border: 0; border-top: 1px solid #d0d7de; margin: 24px 0; }
ul, ol { padding-left: 1.6em; }
`;
fs.writeFileSync(path.join(BUILD, "style.css"), css, "utf8");

console.log("\nGenerando HTML ...");
run(
  PANDOC,
  [
    "Plan.html.md",
    "-o", "Plan.html",
    "--standalone", "--embed-resources", "--css", "style.css",
    '--metadata', "title=Plan de Trabajo - ReSolve (Equipo 2)",
    "--toc", "--toc-depth=3",
  ],
  { cwd: BUILD, shell: false }
);

// ---------------------------------------------------------------------------
// 5) PDF (Microsoft Edge headless)
// ---------------------------------------------------------------------------
console.log("\nGenerando PDF con Edge ...");
const htmlUrl = "file:///" + path.join(BUILD, "Plan.html").replace(/\\/g, "/");
run(EDGE, [
  "--headless=new",
  "--disable-gpu",
  "--no-pdf-header-footer",
  "--run-all-compositor-stages-before-draw",
  "--virtual-time-budget=15000",
  `--user-data-dir=${path.join(BUILD, "edge-profile")}`,
  `--print-to-pdf=${OUT_PDF}`,
  htmlUrl,
], { shell: false });

// ---------------------------------------------------------------------------
console.log("\n=== LISTO ===");
for (const f of [OUT_DOCX, OUT_PDF]) {
  if (fs.existsSync(f)) console.log(`✔ ${f}  (${(fs.statSync(f).size / 1024).toFixed(0)} KB)`);
}
