"use client";

import Link from "next/link";

const ITEMS = [
  { href: "/operations", id: "operations", label: "Operations" },
  { href: "/digital-twin", id: "twin", label: "Digital Twin" },
  { href: "/intervention-lab", id: "lab", label: "Intervention Lab" },
  {
    href: null,
    id: "resilience",
    label: "Resilience",
    title: "Resilience ships in a later phase",
  },
] as const;

export function AppNav({
  current,
}: {
  current: "operations" | "twin" | "lab" | "resilience";
}) {
  return (
    <nav aria-label="Primary" className="flex gap-1 text-xs">
      {ITEMS.map((item) => {
        const active = item.id === current;
        const className = active
          ? "rounded-md bg-accent px-2 py-1 font-medium"
          : "rounded-md px-2 py-1 text-muted-foreground";
        if (!item.href) {
          return (
            <span key={item.id} className={className} title={item.title}>
              {item.label}
            </span>
          );
        }
        return (
          <Link
            key={item.id}
            href={item.href}
            className={className}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
