"use client";

// =============================================================================
// ReSolve · Visores de diagramas basados en React Flow
// -----------------------------------------------------------------------------
// - FlowView : organigrama, arquitectura, casos de uso y actividades.
// - ErView   : modelo entidad-relación (nodos tipo "tabla").
// - MindView : Ishikawa como mapa mental con ramas colapsables.
// El layout automático lo calcula dagre a partir de las dimensiones declaradas.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  type Edge,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import "@xyflow/react/dist/style.css";
import { DocNodeView, EntityNodeView, MindNodeView } from "./diagram-nodes";
import type { DiagramDef, DocEdge, Tone } from "@/lib/documentation/diagrams";

const nodeTypes: NodeTypes = {
  doc: DocNodeView,
  entity: EntityNodeView,
  mind: MindNodeView,
};

// Nodos "tamañados": dagre necesita width/height para distribuir.
interface SizedNode extends Node {
  width: number;
  height: number;
}

function dagreLayout(nodes: SizedNode[], edges: Edge[], rankdir: "TB" | "LR"): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir,
    nodesep: rankdir === "TB" ? 38 : 30,
    ranksep: rankdir === "TB" ? 62 : 96,
    marginx: 24,
    marginy: 24,
  });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) g.setNode(n.id, { width: n.width, height: n.height });
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);

  return nodes.map((n) => {
    const p = g.node(n.id);
    return {
      ...n,
      position: { x: p.x - n.width / 2, y: p.y - n.height / 2 },
      style: { width: n.width, height: n.height },
    };
  });
}

function baseEdge(
  e: DocEdge,
  i: number,
  dir: "TB" | "LR",
  stroke = "#71717a",
): Edge {
  return {
    id: `${e.source}-${e.target}-${i}`,
    source: e.source,
    target: e.target,
    sourceHandle: dir === "LR" ? "r" : "b",
    targetHandle: dir === "LR" ? "l" : "t",
    label: e.label,
    type: "smoothstep",
    animated: e.animated ?? false,
    style: {
      stroke,
      strokeWidth: 1.5,
      strokeDasharray: e.dashed ? "6 4" : undefined,
    },
    labelStyle: { fill: "#d4d4d8", fontSize: 10 },
    labelBgStyle: { fill: "#18181b" },
    labelBgPadding: [5, 2] as [number, number],
    labelBgBorderRadius: 5,
  };
}

function buildFlow(def: DiagramDef) {
  const dir = def.direction ?? "TB";
  const sized: SizedNode[] = (def.nodes ?? []).map((n) => ({
    id: n.id,
    type: "doc",
    data: { label: n.label, sub: n.sub, tone: (n.tone ?? "process") as Tone },
    width: n.width ?? 190,
    height: n.height ?? (n.sub ? 60 : 46),
    position: { x: 0, y: 0 },
  }));
  const edges: Edge[] = (def.edges ?? []).map((e, i) => baseEdge(e, i, dir));
  return { nodes: dagreLayout(sized, edges, dir), edges };
}

function buildEr(def: DiagramDef) {
  const sized: SizedNode[] = (def.entities ?? []).map((en) => ({
    id: en.id,
    type: "entity",
    data: { name: en.name, fields: en.fields, tone: (en.tone ?? "data") as Tone },
    width: 250,
    height: 36 + en.fields.length * 22 + 12,
    position: { x: 0, y: 0 },
  }));
  const edges: Edge[] = (def.relations ?? []).map((r, i) => ({
    id: `${r.source}-${r.target}-${i}`,
    source: r.source,
    target: r.target,
    sourceHandle: "r",
    targetHandle: "l",
    label: `${r.sourceCard ?? ""}  ${r.label}  ${r.targetCard ?? ""}`.trim(),
    type: "smoothstep",
    animated: true,
    style: { stroke: "#a1a1aa", strokeWidth: 1.6 },
    labelStyle: { fill: "#e4e4e7", fontSize: 11, fontWeight: 600 },
    labelBgStyle: { fill: "#18181b" },
    labelBgPadding: [6, 3] as [number, number],
    labelBgBorderRadius: 6,
  }));
  return { nodes: dagreLayout(sized, edges, "LR"), edges };
}

function buildMind(
  def: DiagramDef,
  collapsed: Set<string>,
  onToggle: (id: string) => void,
) {
  const nodes: SizedNode[] = [];
  const edges: Edge[] = [];
  const root = def.mindRoot;
  if (!root) return { nodes: [], edges: [] };

  nodes.push({
    id: root.id,
    type: "mind",
    data: { label: root.label, depth: 0, hasChildren: true, collapsed: false, nodeId: root.id },
    width: 240,
    height: 64,
    position: { x: 0, y: 0 },
  });

  (def.mindBranches ?? []).forEach((br) => {
    const kids = br.children ?? [];
    const isCollapsed = collapsed.has(br.id);
    nodes.push({
      id: br.id,
      type: "mind",
      data: {
        label: br.label,
        depth: 1,
        hasChildren: kids.length > 0,
        collapsed: isCollapsed,
        onToggle,
        nodeId: br.id,
      },
      width: 150,
      height: 48,
      position: { x: 0, y: 0 },
    });
    edges.push({
      id: `${root.id}-${br.id}`,
      source: root.id,
      target: br.id,
      sourceHandle: "r",
      targetHandle: "l",
      type: "smoothstep",
      style: { stroke: "#a78bfa", strokeWidth: 1.6 },
    });
    if (!isCollapsed) {
      kids.forEach((k) => {
        nodes.push({
          id: k.id,
          type: "mind",
          data: { label: k.label, depth: 2, hasChildren: false, collapsed: false, nodeId: k.id },
          width: 250,
          height: 48,
          position: { x: 0, y: 0 },
        });
        edges.push({
          id: `${br.id}-${k.id}`,
          source: br.id,
          target: k.id,
          sourceHandle: "r",
          targetHandle: "l",
          type: "smoothstep",
          style: { stroke: "#52525b", strokeWidth: 1.4 },
        });
      });
    }
  });

  return { nodes: dagreLayout(nodes, edges, "LR"), edges };
}

function Canvas({ nodes: initial, edges }: { nodes: Node[]; edges: Edge[] }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initial);
  useEffect(() => setNodes(initial), [initial, setNodes]);

  return (
    <div className="h-full w-full">
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.22 }}
      minZoom={0.15}
      maxZoom={2.5}
      nodesConnectable={false}
      edgesFocusable={false}
      proOptions={{ hideAttribution: true }}
      className="rf-doc"
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#3f3f46" />
      <MiniMap
        pannable
        zoomable
        nodeColor="#52525b"
        maskColor="rgba(9,9,11,0.62)"
        className="rf-minimap"
      />
      <Controls showInteractive={false} className="rf-controls" />
    </ReactFlow>
    </div>
  );
}

export function FlowView({ def }: { def: DiagramDef }) {
  const { nodes, edges } = useMemo(() => buildFlow(def), [def]);
  return <Canvas nodes={nodes} edges={edges} />;
}

export function ErView({ def }: { def: DiagramDef }) {
  const { nodes, edges } = useMemo(() => buildEr(def), [def]);
  return <Canvas nodes={nodes} edges={edges} />;
}

export function MindView({ def }: { def: DiagramDef }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const onToggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const { nodes, edges } = useMemo(() => buildMind(def, collapsed, onToggle), [def, collapsed, onToggle]);
  return <Canvas nodes={nodes} edges={edges} />;
}
