"use client";

import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { DIAGRAMS } from "@/lib/documentation/diagrams";
import { MODULE_CATALOG, SUBTOPICS_BY_MODULE } from "@/lib/platform/catalog";
import { ROLE_MATRIX, TRAINING_DATE_NOTICE, TRAINING_SESSIONS, UI_ZONES } from "@/lib/manuals/shared";
import type { ManualBlock, ManualDefinition, ManualSection } from "@/lib/manuals/types";

const styles = StyleSheet.create({
  page: {
    paddingTop: 54,
    paddingBottom: 48,
    paddingHorizontal: 54,
    fontFamily: "Times-Roman",
    fontSize: 10.5,
    color: "#1c1917",
    lineHeight: 1.5,
  },
  cover: {
    paddingTop: 90,
    paddingBottom: 60,
    paddingHorizontal: 66,
    fontFamily: "Times-Roman",
    color: "#1c1917",
  },
  coverKicker: {
    fontSize: 8,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#78716c",
    fontFamily: "Helvetica",
  },
  coverRule: {
    width: 52,
    borderTopWidth: 1.5,
    borderTopColor: "#292524",
    marginTop: 92,
    marginBottom: 24,
  },
  coverTitle: {
    fontSize: 34,
    fontFamily: "Times-Bold",
    lineHeight: 1.15,
  },
  coverDescription: {
    marginTop: 18,
    maxWidth: 400,
    fontSize: 11,
    lineHeight: 1.6,
    color: "#57534e",
  },
  coverFooter: {
    position: "absolute",
    left: 66,
    right: 66,
    bottom: 56,
    fontSize: 9,
    lineHeight: 1.7,
    color: "#57534e",
  },
  tocKicker: {
    fontSize: 8,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#78716c",
    fontFamily: "Helvetica",
  },
  tocTitle: {
    marginTop: 8,
    marginBottom: 24,
    fontSize: 22,
    fontFamily: "Times-Bold",
  },
  tocRow: {
    flexDirection: "row",
    borderBottomWidth: 0.6,
    borderBottomColor: "#e7e5e4",
    paddingVertical: 8,
    fontSize: 10.5,
  },
  tocNumber: {
    width: 28,
    color: "#a8a29e",
    fontFamily: "Helvetica",
    fontSize: 8,
  },
  sectionKicker: {
    fontSize: 7.5,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: "#a8a29e",
    fontFamily: "Helvetica",
    borderBottomWidth: 0.6,
    borderBottomColor: "#d6d3d1",
    paddingBottom: 7,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Times-Bold",
    lineHeight: 1.25,
    marginBottom: 12,
  },
  paragraph: {
    marginBottom: 8,
    textAlign: "justify",
  },
  listItem: {
    flexDirection: "row",
    marginBottom: 4,
  },
  bullet: {
    width: 13,
    fontSize: 10,
    color: "#78716c",
  },
  listText: {
    flex: 1,
  },
  table: {
    marginTop: 8,
    marginBottom: 10,
    borderWidth: 0.6,
    borderColor: "#d6d3d1",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f4",
    borderBottomWidth: 0.6,
    borderBottomColor: "#a8a29e",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e7e5e4",
  },
  tableCell: {
    paddingVertical: 5,
    paddingHorizontal: 6,
    fontSize: 8.5,
    lineHeight: 1.35,
  },
  tableHeaderCell: {
    paddingVertical: 5,
    paddingHorizontal: 6,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#44403c",
  },
  tableCaption: {
    marginTop: 3,
    marginBottom: 8,
    fontSize: 8,
    color: "#78716c",
  },
  codeTitle: {
    marginTop: 8,
    marginBottom: 3,
    fontFamily: "Times-Bold",
    fontSize: 9.5,
  },
  code: {
    backgroundColor: "#f5f5f4",
    borderWidth: 0.6,
    borderColor: "#d6d3d1",
    padding: 8,
    fontFamily: "Courier",
    fontSize: 7.2,
    lineHeight: 1.4,
    color: "#292524",
  },
  codeNote: {
    marginTop: 3,
    marginBottom: 8,
    fontSize: 8,
    color: "#78716c",
  },
  callout: {
    marginVertical: 8,
    padding: 9,
    borderLeftWidth: 2.5,
    borderLeftColor: "#57534e",
    backgroundColor: "#f5f5f4",
  },
  calloutTitle: {
    fontFamily: "Times-Bold",
    fontSize: 9.5,
    marginBottom: 2,
  },
  calloutText: {
    fontSize: 9,
    lineHeight: 1.5,
    color: "#44403c",
  },
  step: {
    flexDirection: "row",
    marginBottom: 7,
  },
  stepNumber: {
    width: 17,
    height: 17,
    borderWidth: 0.7,
    borderColor: "#78716c",
    borderRadius: 9,
    textAlign: "center",
    fontSize: 8,
    paddingTop: 2.5,
    marginRight: 8,
  },
  stepTitle: {
    fontFamily: "Times-Bold",
    fontSize: 9.5,
  },
  stepText: {
    fontSize: 9,
    lineHeight: 1.45,
    color: "#44403c",
    marginTop: 1,
  },
  figure: {
    marginVertical: 8,
    padding: 10,
    borderWidth: 0.6,
    borderColor: "#d6d3d1",
    backgroundColor: "#faf9f7",
  },
  figureLabel: {
    fontFamily: "Helvetica",
    fontSize: 7,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#78716c",
  },
  figureTitle: {
    fontFamily: "Times-Bold",
    fontSize: 11.5,
    marginTop: 3,
  },
  figureText: {
    fontSize: 8.5,
    lineHeight: 1.5,
    color: "#57534e",
    marginTop: 3,
  },
  figureNote: {
    fontSize: 7.5,
    color: "#a8a29e",
    marginTop: 4,
  },
  moduleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 6,
  },
  moduleCard: {
    width: "48.5%",
    borderWidth: 0.6,
    borderColor: "#d6d3d1",
    padding: 8,
    marginBottom: 8,
  },
  moduleTitle: {
    fontFamily: "Times-Bold",
    fontSize: 10.5,
  },
  moduleDesc: {
    fontSize: 8,
    color: "#78716c",
    marginTop: 1,
  },
  moduleSubs: {
    fontSize: 8,
    lineHeight: 1.45,
    color: "#44403c",
    marginTop: 4,
  },
  header: {
    position: "absolute",
    top: 24,
    left: 54,
    right: 54,
    fontSize: 7,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#a8a29e",
    fontFamily: "Helvetica",
  },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 54,
    right: 54,
    fontSize: 7,
    color: "#a8a29e",
    fontFamily: "Helvetica",
    textAlign: "right",
  },
  closing: {
    paddingTop: 300,
    textAlign: "center",
    fontSize: 10,
    lineHeight: 1.8,
    color: "#57534e",
  },
});

function formatCode(code: string) {
  return code
    .split("\n")
    .map((line) => line.replace(/^ +/g, (spaces) => "\u00A0".repeat(spaces.length)))
    .join("\n");
}

function splitCells(headers: string[]) {
  const width = `${100 / headers.length}%`;
  return { width };
}

function PdfTable({ headers, rows, caption }: { headers: string[]; rows: string[][]; caption?: string }) {
  const cellWidth = splitCells(headers);
  return (
    <View style={styles.table}>
      <View style={styles.tableHeader} fixed>
        {headers.map((header) => (
          <Text key={header} style={[styles.tableHeaderCell, cellWidth]}>
            {header}
          </Text>
        ))}
      </View>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.tableRow} wrap={false}>
          {row.map((cell, cellIndex) => (
            <Text key={cellIndex} style={[styles.tableCell, cellWidth]}>
              {cell}
            </Text>
          ))}
        </View>
      ))}
      {caption ? <Text style={styles.tableCaption}>{caption}</Text> : null}
    </View>
  );
}

function PdfDiagram({ diagramId, caption }: { diagramId: string; caption?: string }) {
  const diagram = DIAGRAMS.find((item) => item.id === diagramId);
  if (!diagram) return null;

  const elements =
    diagram.kind === "er"
      ? diagram.entities?.map((entity) => entity.name)
      : diagram.kind === "gantt"
        ? diagram.tasks?.slice(0, 6).map((task) => task.name)
        : diagram.kind === "mindmap"
          ? diagram.mindBranches?.map((branch) => branch.label)
          : diagram.nodes?.map((node) => node.label);

  return (
    <View style={styles.figure} wrap={false}>
      <Text style={styles.figureLabel}>Diagrama</Text>
      <Text style={styles.figureTitle}>{diagram.title}</Text>
      <Text style={styles.figureText}>{diagram.description}</Text>
      {elements && elements.length > 0 ? (
        <Text style={styles.figureText}>
          {elements.slice(0, 8).join(" · ")}
          {elements.length > 8 ? " · …" : ""}
        </Text>
      ) : null}
      <Text style={styles.figureNote}>
        El diagrama interactivo se consulta en la sección de Documentación de la plataforma.
      </Text>
      {caption ? <Text style={styles.figureNote}>{caption}</Text> : null}
    </View>
  );
}

function PdfInterfaceMap() {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeader} fixed>
        <Text style={[styles.tableHeaderCell, { width: "7%" }]}>#</Text>
        <Text style={[styles.tableHeaderCell, { width: "24%" }]}>Zona</Text>
        <Text style={[styles.tableHeaderCell, { width: "69%" }]}>Función</Text>
      </View>
      {UI_ZONES.map((zone) => (
        <View key={zone.id} style={styles.tableRow} wrap={false}>
          <Text style={[styles.tableCell, { width: "7%" }]}>{zone.number}</Text>
          <Text style={[styles.tableCell, { width: "24%", fontFamily: "Times-Bold" }]}>{zone.title}</Text>
          <Text style={[styles.tableCell, { width: "69%" }]}>{zone.description}</Text>
        </View>
      ))}
    </View>
  );
}

function PdfModuleCatalog() {
  return (
    <View style={styles.moduleGrid}>
      {MODULE_CATALOG.map((module) => (
        <View key={module.id} style={styles.moduleCard} wrap={false}>
          <Text style={styles.moduleTitle}>{module.label}</Text>
          <Text style={styles.moduleDesc}>{module.desc}</Text>
          <Text style={styles.moduleSubs}>
            {SUBTOPICS_BY_MODULE[module.id].map((subtopic) => subtopic.label).join(" · ")}
          </Text>
        </View>
      ))}
      <View style={[styles.moduleCard, { width: "100%" }]} wrap={false}>
        <Text style={styles.moduleTitle}>Calculadora Universal</Text>
        <Text style={styles.moduleSubs}>
          Problemas en lenguaje natural, clasificados y orientados al módulo correspondiente.
        </Text>
      </View>
    </View>
  );
}

function PdfBlocks({ blocks }: { blocks: ManualBlock[] }) {
  return (
    <>
      {blocks.map((block, index) => {
        switch (block.type) {
          case "paragraph":
            return (
              <Text key={index} style={styles.paragraph}>
                {block.text}
              </Text>
            );
          case "list":
            return (
              <View key={index} style={{ marginBottom: 7 }}>
                {block.items.map((item, itemIndex) => (
                  <View key={itemIndex} style={styles.listItem} wrap={false}>
                    <Text style={styles.bullet}>{block.ordered ? `${itemIndex + 1}.` : "•"}</Text>
                    <Text style={styles.listText}>{item}</Text>
                  </View>
                ))}
              </View>
            );
          case "table":
            return <PdfTable key={index} headers={block.headers} rows={block.rows} caption={block.caption} />;
          case "code":
            return (
              <View
                key={index}
                break={block.code.split("\n").length >= 10}
                style={{ marginBottom: 8 }}
              >
                <Text style={styles.codeTitle}>{block.title}</Text>
                <Text style={styles.code}>{formatCode(block.code)}</Text>
                {block.note ? <Text style={styles.codeNote}>{block.note}</Text> : null}
              </View>
            );
          case "callout":
            return (
              <View key={index} style={styles.callout} wrap={false}>
                <Text style={styles.calloutTitle}>{block.title}</Text>
                <Text style={styles.calloutText}>{block.text}</Text>
              </View>
            );
          case "steps":
            return (
              <View key={index} style={{ marginVertical: 6 }}>
                {block.items.map((item, stepIndex) => (
                  <View key={stepIndex} style={styles.step} wrap={false}>
                    <Text style={styles.stepNumber}>{stepIndex + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stepTitle}>{item.title}</Text>
                      <Text style={styles.stepText}>{item.text}</Text>
                    </View>
                  </View>
                ))}
              </View>
            );
          case "diagram":
            return <PdfDiagram key={index} diagramId={block.diagramId} caption={block.caption} />;
          case "interfaceMap":
            return <PdfInterfaceMap key={index} />;
          case "moduleCatalog":
            return <PdfModuleCatalog key={index} />;
          case "roleMatrix":
            return (
              <PdfTable
                key={index}
                headers={["Rol", "Acceso", "Puede"]}
                rows={ROLE_MATRIX.map((row) => [row.role, row.access, row.can])}
              />
            );
          case "trainingCalendar":
            return (
              <PdfTable
                key={index}
                headers={["Sesión", "Fecha", "Tema", "Dirigido a", "Duración"]}
                rows={TRAINING_SESSIONS.map((session) => [
                  String(session.number),
                  session.date,
                  session.topic,
                  session.audience,
                  session.duration,
                ])}
                caption={TRAINING_DATE_NOTICE}
              />
            );
          default:
            return null;
        }
      })}
    </>
  );
}

function PdfSectionPage({ section }: { section: ManualSection }) {
  return (
    <Page size="A4" style={styles.page}>
      <Text
        style={styles.footer}
        fixed
        render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
      />
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <PdfBlocks blocks={section.blocks} />
    </Page>
  );
}

export default function ManualPdfDocument({ manual }: { manual: ManualDefinition }) {
  return (
    <Document
      title={`${manual.title} · ReSolve`}
      author="Equipo 2 · FESC · Licenciatura en Informática"
      subject={manual.description}
      creator="ReSolve"
    >
      <Page size="A4" style={styles.cover}>
        <View style={styles.coverRule} />
        <Text style={styles.coverTitle}>{manual.title}</Text>
        <Text style={styles.coverDescription}>{manual.description}</Text>
        <View style={styles.coverFooter}>
          <Text>Dirigido a: {manual.audience}</Text>
          <Text style={{ marginTop: 16, color: "#78716c" }}>
            Equipo 2 · Licenciatura en Informática{"\n"}
            Facultad de Estudios Superiores Cuautitlán (FESC){"\n"}
            Octubre 2026
          </Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.tocKicker}>Contenido</Text>
        <Text style={styles.tocTitle}>Índice del manual</Text>
        {manual.sections.map((section, index) => (
          <View key={section.id} style={styles.tocRow}>
            <Text style={styles.tocNumber}>{String(index + 1).padStart(2, "0")}</Text>
            <Text style={{ flex: 1 }}>{section.title.replace(/^\d+\.\s*/, "")}</Text>
          </View>
        ))}
        <Text style={{ marginTop: 20, fontSize: 8, color: "#78716c", lineHeight: 1.5 }}>
          Este manual forma parte de la entrega documental del proyecto. Los diagramas interactivos se consultan en la
          sección de Documentación de la plataforma.
        </Text>
      </Page>

      {manual.sections.map((section) => (
        <PdfSectionPage key={section.id} section={section} />
      ))}

      <Page size="A4" style={styles.page}>
        <View style={styles.closing}>
          <Text style={{ fontFamily: "Times-Bold", fontSize: 12, color: "#292524" }}>
            Equipo 2 · Licenciatura en Informática · FESC
          </Text>
          <Text style={{ marginTop: 6 }}>Octubre 2026</Text>
        </View>
      </Page>
    </Document>
  );
}
