"use client";

import { useTheme } from "next-themes";

const OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  if (theme == null) {
    return (
      <div className="inline-flex rounded-lg border border-border bg-card p-1" aria-hidden="true">
        <span className="px-3 py-1.5 text-xs text-muted-foreground">Theme</span>
      </div>
    );
  }

  return (
    <div
      className="inline-flex rounded-lg border border-border bg-card p-1"
      role="group"
      aria-label="Color theme"
    >
      {OPTIONS.map((option) => {
        const selected = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              setTheme(option.value);
            }}
            aria-pressed={selected}
            className={
              selected
                ? "rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground"
                : "rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
