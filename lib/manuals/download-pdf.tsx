import { createElement } from "react";
import type { ManualDefinition } from "./types";

/**
 * Genera un PDF vectorial (A4) a partir del modelo de contenido del manual.
 * @react-pdf/renderer se carga en el cliente solo al pulsar "Descargar PDF".
 */
export async function downloadManualPdf(manual: ManualDefinition): Promise<void> {
  const [{ pdf }, { default: ManualPdfDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/manuals/manual-pdf-document"),
  ]);

  const element = createElement(ManualPdfDocument, { manual }) as Parameters<typeof pdf>[0];
  const blob = await pdf(element).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Manual-${manual.shortTitle}-ReSolve.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
