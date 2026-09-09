"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

const OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

const emptySubscribe = () => () => undefined;

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const active = mounted
    ? theme === "light" || theme === "dark"
      ? theme
      : resolvedTheme === "light"
        ? "light"
        : "dark"
    : "dark";

  return (
    <div
      className="inline-flex border border-border bg-muted p-0.5"
      role="group"
      aria-label="Color theme"
    >
      {OPTIONS.map((option) => {
        const selected = mounted && active === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            aria-pressed={selected}
            className={
              selected
                ? "bg-card px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm"
                : "px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
