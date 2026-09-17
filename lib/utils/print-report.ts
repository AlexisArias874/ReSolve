// 📁 lib/utils/print-report.ts
export function printDocumentById(elementId: string, fileName: string) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`[print-report] No se encontró #${elementId}`);
    return;
  }

  const originalTitle = document.title;
  document.title = fileName;

  // Crear iframe aislado
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  // ✅ @page SIN márgenes de header/footer (los márgenes sí se respetan)
  // ✅ El header/footer nativo se quita desde el diálogo de impresión,
  //    pero al aislar en iframe ya NO se imprime la URL del dashboard.
  const styles = `
    <style>
      @page {
        size: A4;
        margin: 15mm 12mm 15mm 12mm;
      }
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      html, body {
        margin: 0;
        padding: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
        color: #000;
        background: #fff;
        font-size: 11px;
        line-height: 1.4;
      }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #6b7280; padding: 5px 7px; vertical-align: top; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
      .print-avoid-break { page-break-inside: avoid; }
      .print-break-before { page-break-before: always; }
      h1 { font-size: 18px; margin: 0 0 4px 0; }
      h2 { font-size: 13px; margin: 0 0 6px 0; }
      p { margin: 0 0 4px 0; }
    </style>
  `;

  doc.open();
  doc.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${fileName}</title>
  ${styles}
</head>
<body>${element.innerHTML}</body>
</html>`);
  doc.close();

  const doPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error("[print-report] Error al imprimir:", e);
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe);
        document.title = originalTitle;
      }, 1500);
    }
  };

  // Esperar a que el iframe termine de cargar antes de imprimir
  if (doc.readyState === "complete") {
    setTimeout(doPrint, 300);
  } else {
    iframe.onload = () => setTimeout(doPrint, 300);
  }
}