"use client";

import Link from "next/link";
import Image from "next/image";

const ITEMS = [
  { href: "/operations", id: "operations", label: "Operations" },
  { href: "/digital-twin", id: "twin", label: "Digital Twin" },
  { href: "/intervention-lab", id: "lab", label: "Intervention Lab" },
  { href: "/resilience", id: "resilience", label: "Resilience" },
] as const;

export function AppNav({
  current,
}: {
  current: "operations" | "twin" | "lab" | "resilience";
}) {
  return (
    <nav aria-label="Primary" className="flex items-center gap-1 text-[11px]">
      <Link href="/" className="mr-2 flex items-center gap-2" aria-label="VeinGuard home">
        <Image src="/brand/veinguard-mark.svg" alt="" width={22} height={22} priority />
        <span className="hidden font-medium tracking-[0.16em] text-foreground sm:inline">VEINGUARD</span>
      </Link>
      <span className="mr-1 hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
      {ITEMS.map((item) => {
        const active = item.id === current;
        const className = active
          ? "border border-water/30 bg-water/10 px-2.5 py-1.5 font-medium text-water"
          : "border border-transparent px-2.5 py-1.5 text-muted-foreground hover:border-border hover:text-foreground";
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
