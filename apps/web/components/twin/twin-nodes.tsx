"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { CSSProperties, ReactNode } from "react";

export interface TwinNodeData extends Record<string, unknown> {
  sourceId: string;
  assetType: string;
  fill: string;
  stroke: string;
  muted: boolean;
  breach: boolean;
  label: string;
}

export type JunctionRfNode = Node<TwinNodeData, "junction">;
export type ReservoirRfNode = Node<TwinNodeData, "reservoir">;
export type TankRfNode = Node<TwinNodeData, "tank">;
export type PumpRfNode = Node<TwinNodeData, "pump">;
export type ValveRfNode = Node<TwinNodeData, "valve">;
export type TwinRfNode =
  | JunctionRfNode
  | ReservoirRfNode
  | TankRfNode
  | PumpRfNode
  | ValveRfNode;

function Handles() {
  return (
    <>
      <Handle type="target" position={Position.Top} id="t" className="twin-handle" />
      <Handle type="source" position={Position.Bottom} id="s" className="twin-handle" />
    </>
  );
}

function Label({ data }: { data: TwinNodeData }) {
  if (!data.label) {
    return null;
  }
  return (
    <span
      className={`pointer-events-none absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap text-[9px] leading-none ${
        data.breach ? "font-semibold text-red-700 dark:text-red-300" : "text-foreground"
      }`}
    >
      {data.label}
    </span>
  );
}

function Shell({
  data,
  selected,
  children,
  width,
  height,
}: {
  data: TwinNodeData;
  selected?: boolean;
  children: ReactNode;
  width: number;
  height: number;
}) {
  return (
    <div
      className={`nopan twin-node relative ${data.muted ? "opacity-20" : ""}`}
      style={{ width, height }}
      title={`${data.assetType} ${data.sourceId}${
        data.breach ? " · projected target breach" : ""
      }`}
    >
      <Handles />
      <div
        className={selected ? "ring-2 ring-sky-500 ring-offset-1 ring-offset-background" : ""}
        style={{ width, height }}
      >
        {children}
      </div>
      <Label data={data} />
    </div>
  );
}

export function JunctionNode({ data, selected }: NodeProps<JunctionRfNode>) {
  return (
    <Shell data={data} selected={selected} width={14} height={14}>
      <div
        className="h-full w-full rounded-full"
        style={shapeStyle(data)}
        aria-label={`Junction ${data.sourceId}`}
      />
    </Shell>
  );
}

export function ReservoirNode({ data, selected }: NodeProps<ReservoirRfNode>) {
  return (
    <Shell data={data} selected={selected} width={28} height={18}>
      <div
        className="h-full w-full"
        style={{ ...shapeStyle(data), clipPath: "polygon(0 0, 100% 0, 80% 100%, 20% 100%)" }}
        aria-label={`Reservoir ${data.sourceId}`}
      />
    </Shell>
  );
}

export function TankNode({ data, selected }: NodeProps<TankRfNode>) {
  return (
    <Shell data={data} selected={selected} width={26} height={22}>
      <div
        className="flex h-full w-full flex-col overflow-hidden rounded-sm"
        style={shapeStyle(data)}
        aria-label={`Tank ${data.sourceId}`}
      >
        <div className="h-1/3 border-b border-black/20 bg-white/25" />
      </div>
    </Shell>
  );
}

export function PumpNode({ data, selected }: NodeProps<PumpRfNode>) {
  return (
    <Shell data={data} selected={selected} width={22} height={22}>
      <div className="flex h-full w-full items-center justify-center">
        <div
          className="h-4 w-4 rotate-45 rounded-[2px]"
          style={shapeStyle(data)}
          aria-label={`Pump ${data.sourceId}`}
        />
      </div>
    </Shell>
  );
}

export function ValveNode({ data, selected }: NodeProps<ValveRfNode>) {
  return (
    <Shell data={data} selected={selected} width={24} height={16}>
      <div className="relative h-full w-full" aria-label={`Valve ${data.sourceId}`}>
        <div
          className="absolute inset-0"
          style={{
            ...shapeStyle(data),
            clipPath: "polygon(0 0, 50% 50%, 0 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            ...shapeStyle(data),
            clipPath: "polygon(100% 0, 50% 50%, 100% 100%)",
          }}
        />
      </div>
    </Shell>
  );
}

function shapeStyle(data: TwinNodeData): CSSProperties {
  return {
    background: data.fill,
    border: `${data.breach ? 2 : 1}px solid ${data.stroke}`,
  };
}

export const twinNodeTypes = {
  junction: JunctionNode,
  reservoir: ReservoirNode,
  tank: TankNode,
  pump: PumpNode,
  valve: ValveNode,
};
