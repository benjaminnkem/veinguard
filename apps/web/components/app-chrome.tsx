"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AppNav } from "@/components/app-nav";
import { ThemeToggle } from "@/components/theme-toggle";

export function AppHeader({
  current,
  children,
}: {
  current: "operations" | "twin" | "lab" | "resilience";
  children?: ReactNode;
}) {
  return (
    <header className="z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5 lg:px-5">
      <AppNav current={current} />
      <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
        {children}
        <Link
          href="/setup"
          className="px-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Setup
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}

export function AppSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select
        className="max-w-[10rem] border border-border bg-elevated px-2.5 py-1.5 text-[11px] text-foreground"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
      >
        {children}
      </select>
    </label>
  );
}

export function GhostButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="border border-water/30 bg-water/10 px-2.5 py-1.5 text-[11px] text-water hover:bg-water/15"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function SidebarRail({
  label,
  onOpen,
}: {
  label: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="flex h-full w-full flex-col items-center gap-3 bg-card py-3 text-muted-foreground hover:bg-muted hover:text-foreground"
      onClick={onOpen}
      aria-expanded={false}
      aria-label={`Show ${label}`}
    >
      <span aria-hidden="true" className="text-sm leading-none">
        ›
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] [writing-mode:vertical-rl]">
        {label}
      </span>
    </button>
  );
}

export function SidebarHeader({
  title,
  onHide,
}: {
  title: string;
  onHide: () => void;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </h2>
      <button
        type="button"
        onClick={onHide}
        className="px-1 text-[11px] text-muted-foreground hover:text-foreground"
        aria-label={`Hide ${title}`}
      >
        ‹
      </button>
    </div>
  );
}

export function SideSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-4">
      <h3 className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function ChoiceButton({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-[12px] disabled:cursor-not-allowed disabled:opacity-45 ${
        selected
          ? "bg-water/10 font-medium text-water"
          : "text-foreground hover:bg-muted"
      }`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
          selected ? "bg-water" : "bg-border"
        }`}
        aria-hidden="true"
      />
      {children}
    </button>
  );
}
