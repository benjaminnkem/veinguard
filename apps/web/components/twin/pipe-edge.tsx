"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  Position,
  useInternalNode,
  type Edge,
  type EdgeProps,
  type InternalNode,
} from "@xyflow/react";

export interface PipeEdgeData extends Record<string, unknown> {
  flowM3s: number | null;
  velocityMs: number | null;
  parentId: string | null;
  derived: boolean;
  muted: boolean;
  inspectId: string;
}

export type PipeRfEdge = Edge<PipeEdgeData, "pipe">;

const FLOW_EPSILON = 1e-6;

export function PipeEdge({
  id,
  source,
  target,
  data,
  selected,
  markerEnd,
  markerStart,
}: EdgeProps<PipeRfEdge>) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) {
    return null;
  }
  const { sx, sy, tx, ty } = getEdgeParams(sourceNode, targetNode);
  const [path, labelX, labelY] = getStraightPath({
    sourceX: sx,
    sourceY: sy,
    targetX: tx,
    targetY: ty,
  });
  const flow = data?.flowM3s ?? null;
  const absFlow = flow == null ? 0 : Math.abs(flow);
  const directed = flow != null && absFlow >= FLOW_EPSILON;
  const muted = Boolean(data?.muted);
  const stroke = muted
    ? "#94a3b8"
    : directed
      ? "#334155"
      : "#94a3b8";
  const width = muted ? 1 : 1.2 + Math.min(4, absFlow * 8);

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke,
          strokeWidth: selected ? width + 1.5 : width,
          opacity: muted ? 0.25 : 1,
          strokeDasharray: directed ? undefined : "4 3",
        }}
        markerEnd={markerEnd}
        markerStart={markerStart}
      />
      {selected ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute rounded bg-card/90 px-1.5 py-0.5 text-[10px] shadow"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {flow == null
              ? "Flow not calculated"
              : `${flow.toPrecision(3)} m³/s`}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export const twinEdgeTypes = {
  pipe: PipeEdge,
};

function getEdgeParams(source: InternalNode, target: InternalNode) {
  const sourceIntersection = getNodeIntersection(source, target);
  const targetIntersection = getNodeIntersection(target, source);
  return {
    sx: sourceIntersection.x,
    sy: sourceIntersection.y,
    tx: targetIntersection.x,
    ty: targetIntersection.y,
    sourcePos: getEdgePosition(source, sourceIntersection),
    targetPos: getEdgePosition(target, targetIntersection),
  };
}

function getNodeIntersection(
  intersectionNode: InternalNode,
  targetNode: InternalNode,
) {
  const width = intersectionNode.measured.width ?? 0;
  const height = intersectionNode.measured.height ?? 0;
  const w = width / 2 || 1;
  const h = height / 2 || 1;
  const sourcePos = intersectionNode.internals.positionAbsolute;
  const targetPos = targetNode.internals.positionAbsolute;
  const targetW = targetNode.measured.width ?? 0;
  const targetH = targetNode.measured.height ?? 0;
  const x2 = sourcePos.x + w;
  const y2 = sourcePos.y + h;
  const x1 = targetPos.x + targetW / 2;
  const y1 = targetPos.y + targetH / 2;
  const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h);
  const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1);
  const xx3 = a * xx1;
  const yy3 = a * yy1;
  return {
    x: w * (xx3 + yy3) + x2,
    y: h * (-xx3 + yy3) + y2,
  };
}

function getEdgePosition(
  node: InternalNode,
  intersectionPoint: { x: number; y: number },
) {
  const nx = Math.round(node.internals.positionAbsolute.x);
  const ny = Math.round(node.internals.positionAbsolute.y);
  const px = Math.round(intersectionPoint.x);
  const py = Math.round(intersectionPoint.y);
  const width = node.measured.width ?? 0;
  const height = node.measured.height ?? 0;
  if (px <= nx + 1) {
    return Position.Left;
  }
  if (px >= nx + width - 1) {
    return Position.Right;
  }
  if (py <= ny + 1) {
    return Position.Top;
  }
  if (py >= ny + height - 1) {
    return Position.Bottom;
  }
  return Position.Top;
}
