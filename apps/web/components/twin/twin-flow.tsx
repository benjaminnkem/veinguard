"use client";

import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef } from "react";
import type {
  TwinColorBy,
  TwinEdge,
  TwinGraph,
  TwinNode,
  TwinTrace,
} from "@/lib/operations";
import { twinEdgeTypes, type PipeEdgeData } from "./pipe-edge";
import { twinNodeTypes, type TwinNodeData } from "./twin-nodes";
import { metricRange, nodeColors } from "./twin-style";

interface TwinFlowProps {
  graph: TwinGraph;
  colorBy: TwinColorBy;
  selectedId: string | null;
  trace: TwinTrace | null;
  onSelect: (id: string | null) => void;
  focusId: string | null;
}

const FLOW_NODE_TYPES: Record<string, "junction" | "reservoir" | "tank" | "pump" | "valve"> =
  {
    JUNCTION: "junction",
    RESERVOIR: "reservoir",
    TANK: "tank",
    PUMP: "pump",
    VALVE: "valve",
  };

const NODE_SIZE: Record<
  "junction" | "reservoir" | "tank" | "pump" | "valve",
  { width: number; height: number }
> = {
  junction: { width: 14, height: 14 },
  reservoir: { width: 28, height: 18 },
  tank: { width: 26, height: 22 },
  pump: { width: 22, height: 22 },
  valve: { width: 24, height: 16 },
};

export function TwinFlow(props: TwinFlowProps) {
  return (
    <ReactFlowProvider>
      <TwinCanvas {...props} />
    </ReactFlowProvider>
  );
}

function TwinCanvas({
  graph,
  colorBy,
  selectedId,
  trace,
  onSelect,
  focusId,
}: TwinFlowProps) {
  const { resolvedTheme } = useTheme();
  const { fitView } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const fitted = useRef<string | null>(null);
  const range = useMemo(
    () => metricRange(graph.nodes, colorBy),
    [graph.nodes, colorBy],
  );
  const tracedNodes = useMemo(
    () => (trace ? new Set(trace.nodeIds) : null),
    [trace],
  );
  const tracedEdges = useMemo(
    () => (trace ? new Set(trace.edgeIds) : null),
    [trace],
  );

  const nodes = useMemo(
    () =>
      graph.nodes.map((node) =>
        toFlowNode(
          node,
          colorBy,
          range,
          graph.operationalTargetMgL,
          selectedId,
          tracedNodes,
        ),
      ),
    [graph, colorBy, range, selectedId, tracedNodes],
  );

  const edges = useMemo(
    () => graph.edges.map((edge) => toFlowEdge(edge, selectedId, tracedEdges)),
    [graph.edges, selectedId, tracedEdges],
  );

  useEffect(() => {
    if (!focusId || !nodesInitialized || nodes.length === 0) {
      return;
    }
    const key = `${graph.snapshotId}:${focusId}`;
    if (fitted.current === key) {
      return;
    }
    const match = nodes.find((node) => node.id === focusId);
    fitted.current = key;
    const frame = requestAnimationFrame(() => {
      if (match) {
        void fitView({ nodes: [match], padding: 0.55, duration: 350 });
        return;
      }
      void fitView({ padding: 0.15, duration: 350 });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusId, fitView, graph.snapshotId, nodes, nodesInitialized]);

  return (
    <ReactFlow
      className="h-full w-full"
      nodes={nodes}
      edges={edges}
      nodeTypes={twinNodeTypes}
      edgeTypes={twinEdgeTypes}
      colorMode={resolvedTheme === "dark" ? "dark" : "light"}
      fitView
      fitViewOptions={{ padding: 0.12 }}
      minZoom={0.15}
      maxZoom={4}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      edgesReconnectable={false}
      connectOnClick={false}
      deleteKeyCode={null}
      selectionOnDrag={false}
      panOnDrag
      zoomOnScroll
      connectionMode={ConnectionMode.Loose}
      onNodeClick={(_, node) => onSelect(node.id)}
      onEdgeClick={(_, edge) => {
        const inspectId = (edge.data as PipeEdgeData | undefined)?.inspectId;
        onSelect(inspectId ?? edge.id);
      }}
      onPaneClick={() => onSelect(null)}
      proOptions={{ hideAttribution: false }}
    >
      <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
      <Controls showInteractive={false} />
      <MiniMap
        pannable
        zoomable
        nodeStrokeWidth={3}
        nodeColor={(node) => (node.data as TwinNodeData).fill}
        maskColor="color-mix(in oklab, var(--background) 70%, transparent)"
      />
      <Panel
        position="bottom-center"
        className="rounded-md bg-card/90 px-2 py-1 text-[10px] text-muted-foreground shadow"
      >
        EPA_BENCHMARK · SYNTHETIC_GEOREFERENCING · flow-signed arrows
      </Panel>
    </ReactFlow>
  );
}

function toFlowNode(
  node: TwinNode,
  colorBy: TwinColorBy,
  range: { min: number; max: number } | null,
  target: number | null,
  selectedId: string | null,
  tracedNodes: Set<string> | null,
): Node<TwinNodeData> {
  const colors = nodeColors(node, colorBy, range, target);
  const muted = tracedNodes != null && !tracedNodes.has(node.id);
  const type = FLOW_NODE_TYPES[node.type] ?? "junction";
  const size = NODE_SIZE[type];
  return {
    id: node.id,
    type,
    position: node.position,
    selected: selectedId === node.id,
    draggable: false,
    connectable: false,
    style: size,
    width: size.width,
    height: size.height,
    data: {
      sourceId: node.sourceId,
      assetType: node.type,
      fill: colors.fill,
      stroke: colors.stroke,
      muted,
      breach: node.projectedTargetBreach,
      label: nodeLabel(node, selectedId, tracedNodes),
    },
  };
}

function nodeLabel(
  node: TwinNode,
  selectedId: string | null,
  tracedNodes: Set<string> | null,
): string {
  const highlighted =
    node.projectedTargetBreach ||
    selectedId === node.id ||
    Boolean(tracedNodes?.has(node.id));
  if (node.type === "JUNCTION" && !highlighted) {
    return "";
  }
  return node.type === "JUNCTION" ? node.sourceId : node.id;
}

function toFlowEdge(
  edge: TwinEdge,
  selectedId: string | null,
  tracedEdges: Set<string> | null,
): Edge<PipeEdgeData> {
  const inspectId = edge.parentId ?? edge.id;
  const muted = tracedEdges != null && !tracedEdges.has(edge.id);
  const flow = edge.flowM3s;
  const directed = flow != null && Math.abs(flow) >= 1e-6;
  const marker = {
    type: MarkerType.ArrowClosed,
    width: 12,
    height: 12,
    color: muted ? "#94a3b8" : "#334155",
  };
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: "s",
    targetHandle: "t",
    type: "pipe",
    selectable: true,
    selected: selectedId === inspectId || selectedId === edge.id,
    markerEnd: directed && flow != null && flow > 0 ? marker : undefined,
    markerStart: directed && flow != null && flow < 0 ? marker : undefined,
    data: {
      flowM3s: edge.flowM3s,
      velocityMs: edge.velocityMs,
      parentId: edge.parentId,
      derived: edge.derived,
      muted,
      inspectId,
    },
  };
}
