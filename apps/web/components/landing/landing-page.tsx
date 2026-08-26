"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { TheatreStudioLoader } from "@/components/theatre/theatre-studio-loader";
import { NetworkParticleField } from "./network-particle-field";

const PIPELINE = [
  ["01", "Thermal environment", "FortyGuard boundary condition"],
  ["02", "Modeled water temperature", "calculated state · not a sensor reading"],
  ["03", "Hydraulics + water age", "actual EPANET/WNTR behavior"],
  ["04", "Chemistry", "Free Chlorine or Monochloramine"],
  ["05", "Projected target crossing", "configured operational target"],
  ["06", "Intervention search", "typed candidates · isolated scenarios"],
  ["07", "Hard constraints", "feasible or rejected"],
  ["08", "Decision support", "deterministic rank · concise rationale"],
] as const;

export function LandingPage() {
  const root = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const [cursorLabel, setCursorLabel] = useState("");
  const [cursorActive, setCursorActive] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    gsap.registerPlugin(ScrollTrigger);
    const context = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 768px)", () => {
        gsap.fromTo(
          "[data-reveal]",
          { opacity: 0, y: 28 },
          { opacity: 1, y: 0, duration: 0.8, stagger: 0.06, ease: "power3.out", delay: 0.15 },
        );
        gsap.utils.toArray<HTMLElement>("[data-scroll-reveal]").forEach((node) => {
          gsap.fromTo(
            node,
            { opacity: 0, y: 44 },
            {
              opacity: 1,
              y: 0,
              duration: 0.9,
              ease: "power3.out",
              scrollTrigger: { trigger: node, start: "top 84%", once: true },
            },
          );
        });
        gsap.to("[data-hero-copy]", {
          yPercent: 24,
          ease: "none",
          scrollTrigger: {
            trigger: "[data-hero]",
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });
        gsap.to("[data-hero-scene]", {
          yPercent: 14,
          scale: 1.05,
          ease: "none",
          scrollTrigger: {
            trigger: "[data-hero]",
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });
      });

      if (!prefersReducedMotion) {
        const lenis = new Lenis({ lerp: 0.085, smoothWheel: true, syncTouch: false });
        const tick = (time: number) => {
          lenis.raf(time * 1000);
          ScrollTrigger.update();
        };
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);
        return () => {
          gsap.ticker.remove(tick);
          lenis.destroy();
          mm.revert();
        };
      }
      return () => mm.revert();
    }, element);
    return () => context.revert();
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion || !window.matchMedia("(pointer: fine)").matches) return;
    const dot = document.querySelector<HTMLElement>(".cursor-dot");
    const ring = document.querySelector<HTMLElement>(".cursor-ring");
    if (!dot || !ring) return;
    let targetX = -100;
    let targetY = -100;
    let currentX = targetX;
    let currentY = targetY;
    let frame = 0;
    const render = () => {
      currentX += (targetX - currentX) * 0.24;
      currentY += (targetY - currentY) * 0.24;
      dot.style.left = `${currentX}px`;
      dot.style.top = `${currentY}px`;
      ring.style.left = `${currentX}px`;
      ring.style.top = `${currentY}px`;
      frame = requestAnimationFrame(render);
    };
    const onMove = (event: PointerEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
    };
    const onOver = (event: PointerEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-cursor]");
      if (!target) return;
      setCursorLabel(target.dataset.cursor ?? "");
      setCursorActive(true);
    };
    const onOut = (event: PointerEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-cursor]");
      if (
        target &&
        !(event.relatedTarget instanceof Node && target.contains(event.relatedTarget))
      ) {
        setCursorActive(false);
        setCursorLabel("");
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerover", onOver, { passive: true });
    window.addEventListener("pointerout", onOut, { passive: true });
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerover", onOver);
      window.removeEventListener("pointerout", onOut);
    };
  }, [prefersReducedMotion]);

  return (
    <div ref={root} className="relative overflow-clip bg-[#050505] text-[#FAFAFA]">
      <TheatreStudioLoader />
      <div className="cursor-dot" aria-hidden="true" />
      <div className={`cursor-ring ${cursorActive ? "is-active" : ""}`} aria-hidden="true">
        {cursorLabel}
      </div>

      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-[#050505]/75 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 lg:px-10">
          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label="VeinGuard home"
            data-cursor="HOME"
          >
            <Image src="/brand/veinguard-mark.svg" alt="" width={27} height={27} priority />
            <span className="text-[11px] font-medium tracking-[0.22em]">VEINGUARD</span>
          </Link>
          <nav
            className="hidden items-center gap-7 text-[10px] uppercase tracking-[0.18em] text-zinc-400 md:flex"
            aria-label="Landing page"
          >
            <a href="#platform" data-cursor="EXPLORE">
              Platform
            </a>
            <a href="#pipeline" data-cursor="TRACE">
              Causal model
            </a>
            <a href="#integrity" data-cursor="VIEW">
              Integrity
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/operations"
              data-cursor="LAUNCH"
              className="hidden border border-water/50 bg-water/10 px-4 py-2 text-[10px] font-semibold tracking-[0.18em] text-water transition hover:bg-water hover:text-[#050505] sm:inline-flex"
            >
              LAUNCH APP ↗
            </Link>
            <button
              type="button"
              className="border border-white/15 p-2 text-zinc-300 md:hidden"
              aria-expanded={mobileMenu}
              aria-label="Toggle navigation"
              onClick={() => setMobileMenu((value) => !value)}
            >
              ☰
            </button>
          </div>
        </div>
        {mobileMenu ? (
          <nav className="border-t border-white/10 px-5 py-4 text-[10px] uppercase tracking-[0.18em] text-zinc-300 md:hidden">
            <div className="flex flex-col gap-4">
              <a href="#platform" onClick={() => setMobileMenu(false)}>
                Platform
              </a>
              <a href="#pipeline" onClick={() => setMobileMenu(false)}>
                Causal model
              </a>
              <a href="#integrity" onClick={() => setMobileMenu(false)}>
                Integrity
              </a>
              <Link href="/operations" className="text-water">
                Launch app ↗
              </Link>
            </div>
          </nav>
        ) : null}
      </header>

      <main>
        <section
          data-hero
          className="hero-surface relative min-h-[680px] overflow-hidden border-b border-white/10 pt-16 lg:min-h-[790px]"
        >
          <div className="hero-contours pointer-events-none absolute inset-0" aria-hidden="true" />
          <div
            className="hero-network-pattern pointer-events-none absolute inset-y-0 right-0 hidden w-[58%] lg:block"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-100 mix-blend-screen"
            aria-hidden="true"
          >
            <NetworkParticleField reducedMotion={Boolean(prefersReducedMotion)} />
          </div>
          <div
            className="technical-grid pointer-events-none absolute inset-0 opacity-25"
            aria-hidden="true"
          />
          <div className="relative mx-auto flex min-h-[616px] max-w-[1280px] items-center justify-center px-5 py-24 text-center sm:py-20 lg:min-h-[726px] lg:px-10">
            <div data-hero-copy className="flex max-w-5xl flex-col items-center">
              <p
                data-reveal
                className="mb-7 flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.2em] text-water sm:text-[10px]"
              >
                <span className="h-px w-7 bg-water" />
                HEAT-AWARE WATER NETWORK DIGITAL TWIN
                <span className="h-px w-7 bg-water" />
              </p>
              <h1
                data-reveal
                className="max-w-[980px] text-[clamp(3rem,6vw,6.4rem)] font-light leading-[0.9] tracking-[-0.06em]"
              >
                MODEL THE HEAT.
                <br />
                <span className="text-white/45">TRACE THE NETWORK.</span>
                <br />
                SIMULATE WHAT&apos;S NEXT.
              </h1>
              <div className="mt-8 flex max-w-2xl flex-col items-center gap-7">
                <p data-reveal className="max-w-2xl text-sm leading-7 text-zinc-300 sm:text-base">
                  VeinGuard turns hyperlocal environmental thermal intelligence into modeled water
                  temperature, hydraulics, water age, chemistry, and auditable intervention decision
                  support.
                </p>
                <motion.div
                  data-reveal
                  whileHover={{ x: 3 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-wrap justify-center gap-3"
                >
                  <Link
                    href="/operations"
                    data-cursor="LAUNCH"
                    className="inline-flex items-center border border-water bg-water px-6 py-3 text-[10px] font-semibold tracking-[0.2em] text-[#050505] transition hover:bg-water-luminous"
                  >
                    LAUNCH APP ↗
                  </Link>
                  <a
                    href="#platform"
                    data-cursor="EXPLORE"
                    className="inline-flex items-center border border-white/20 px-6 py-3 text-[10px] font-semibold tracking-[0.2em] text-white transition hover:border-white/50"
                  >
                    EXPLORE VEINGUARD ↓
                  </a>
                </motion.div>
              </div>
              <div
                data-reveal
                className="mt-10 flex flex-wrap justify-center gap-x-7 gap-y-2 font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500"
              >
                <span>environmental boundary ≠ water measurement</span>
                <span>EPA_BENCHMARK</span>
                <span>SYNTHETIC_GEOREFERENCING</span>
              </div>
            </div>
          </div>
        </section>

        <section
          id="platform"
          className="landing-frame mx-auto max-w-[1440px] border-b border-white/10 px-5 py-28 lg:px-10 lg:py-40"
        >
          <div data-scroll-reveal className="grid gap-14 lg:grid-cols-[0.72fr_1.28fr] lg:gap-24">
            <div>
              <Eyebrow number="01" label="THE INVISIBLE PROBLEM" />
              <h2 className="mt-8 max-w-md text-4xl font-light leading-[0.96] tracking-[-0.045em] sm:text-6xl">
                Heat is visible.
                <br />
                <span className="text-white/40">What it does inside the network isn&apos;t.</span>
              </h2>
            </div>
            <div className="grid gap-10 lg:grid-cols-2">
              <p className="max-w-sm text-lg leading-8 text-zinc-300">
                A thermal map is an environmental input. It does not tell an operator how residence
                time, tank turnover, hydraulic routing, or disinfectant chemistry will respond.
              </p>
              <div className="relative min-h-64 overflow-hidden border border-white/10 bg-[#0c0c0c] p-6">
                <div
                  className="absolute inset-0 bg-[url('/brand/thermal-contours.svg')] bg-cover bg-center opacity-50"
                  aria-hidden="true"
                />
                <div className="relative flex h-full flex-col justify-between">
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-amber-400">
                    01 · environmental boundary
                  </span>
                  <div className="flex items-end justify-between">
                    <span className="text-2xl font-light">FortyGuard</span>
                    <span className="font-mono text-[10px] text-zinc-500">provider input</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="pipeline"
          className="landing-frame mx-auto max-w-[1440px] border-b border-white/10 px-5 py-28 lg:px-10 lg:py-40"
        >
          <div data-scroll-reveal className="grid gap-16 lg:grid-cols-[0.42fr_1fr] lg:gap-24">
            <div>
              <Eyebrow number="02" label="THE CAUSAL MODEL" />
              <h2 className="mt-8 max-w-sm text-4xl font-light leading-[0.96] tracking-[-0.045em] sm:text-6xl">
                From thermal boundary to an operator&apos;s next move.
              </h2>
              <p className="mt-7 max-w-sm text-sm leading-7 text-zinc-400">
                Every stage is visible, versioned, and constrained. Gemini may propose candidates;
                deterministic simulation decides what survives.
              </p>
            </div>
            <div className="relative border-l border-white/10 pl-7 sm:pl-12">
              {PIPELINE.map(([index, title, note], step) => (
                <div
                  key={index}
                  className="group relative border-b border-white/10 py-5 first:pt-0 last:border-b-0"
                >
                  <div
                    className="absolute -left-[2.03rem] top-6 h-2 w-2 rounded-full border border-water bg-[#050505] shadow-[0_0_15px_rgba(73,198,229,.55)] sm:-left-[3.05rem]"
                    aria-hidden="true"
                  />
                  <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                    <span className="font-mono text-[10px] text-water">{index}</span>
                    <h3
                      className={`text-xl font-light tracking-[-0.02em] sm:text-2xl ${step === 4 ? "text-amber-300" : step === 6 ? "text-emerald-300" : "text-white"}`}
                    >
                      {title}
                    </h3>
                  </div>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                    {note}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-frame mx-auto max-w-[1440px] border-b border-white/10 px-5 py-28 lg:px-10 lg:py-40">
          <div data-scroll-reveal>
            <Eyebrow number="03" label="OPERATIONS AT OPERATING SCALE" />
            <div className="mt-9 grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
              <h2 className="max-w-3xl text-5xl font-light leading-[0.9] tracking-[-0.055em] sm:text-7xl">
                The network
                <br />
                <span className="text-white/40">is the workspace.</span>
              </h2>
              <p className="max-w-md text-sm leading-7 text-zinc-400">
                A map-first command surface keeps environmental source, modeled state, target
                crossings, time, and provenance in one operational frame.
              </p>
            </div>
            <div className="relative mt-14 min-h-[470px] overflow-hidden border border-white/15 bg-[#08090a]">
              <div className="technical-grid absolute inset-0 opacity-60" />
              <div className="absolute inset-0 bg-[url('/brand/network-pattern.svg')] bg-cover bg-center opacity-50" />
              <div className="absolute inset-x-0 top-0 flex items-center justify-between border-b border-white/10 bg-[#0c0c0c]/90 px-4 py-3 font-mono text-[9px] uppercase tracking-[0.15em] text-zinc-500">
                <span>OPERATIONS / MODELED NETWORK STATE</span>
                <span className="text-emerald-300">● COMPLETED RUN</span>
              </div>
              <div className="absolute inset-10 md:inset-20">
                <svg
                  viewBox="0 0 900 360"
                  className="h-full w-full"
                  role="img"
                  aria-label="Illustrative network topology preview"
                >
                  <g fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path
                      d="M18 260h150l100-115h130l94 85h136l110-142h165"
                      stroke="#1d343a"
                      strokeWidth="14"
                    />
                    <path
                      d="M18 260h150l100-115h130l94 85h136l110-142h165"
                      stroke="#49C6E5"
                      strokeOpacity=".78"
                      strokeWidth="3"
                      strokeDasharray="2 18"
                    />
                    <path
                      d="M268 145 355 44h120"
                      stroke="#F59E0B"
                      strokeOpacity=".6"
                      strokeWidth="2"
                      strokeDasharray="7 9"
                    />
                  </g>
                  <g fill="#0C0C0C" stroke="#67D5EE" strokeWidth="3">
                    <circle cx="168" cy="260" r="10" />
                    <circle cx="268" cy="145" r="10" />
                    <circle cx="398" cy="145" r="10" />
                    <circle cx="492" cy="230" r="10" />
                    <circle cx="628" cy="230" r="10" />
                    <circle cx="738" cy="88" r="10" />
                  </g>
                  <g fill="#A1A1AA" fontFamily="monospace" fontSize="12">
                    <text x="12" y="295">
                      RESERVOIR
                    </text>
                    <text x="244" y="123">
                      TARGET CROSSING
                    </text>
                    <text x="624" y="265">
                      TRACE
                    </text>
                  </g>
                </svg>
              </div>
              <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-500">
                <span className="border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-amber-300">
                  environmental field
                </span>
                <span className="border border-water/30 bg-water/10 px-2 py-1 text-water">
                  modeled water state
                </span>
                <span className="border border-white/15 px-2 py-1">
                  synthetic geography disclosed
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-frame mx-auto max-w-[1440px] border-b border-white/10 px-5 py-28 lg:px-10 lg:py-40">
          <div data-scroll-reveal className="grid gap-14 lg:grid-cols-2 lg:items-center">
            <div>
              <Eyebrow number="04" label="DIGITAL TWIN" />
              <h2 className="mt-8 max-w-xl text-5xl font-light leading-[0.9] tracking-[-0.055em] sm:text-7xl">
                Trace the network.
                <br />
                <span className="text-white/40">Not just the alert.</span>
              </h2>
              <p className="mt-8 max-w-md text-sm leading-7 text-zinc-400">
                Topology remains topology: reservoirs, tanks, pumps, valves, junctions, and pipes
                retain their identifiers while upstream and downstream traces bring the causal path
                forward.
              </p>
              <Link
                href="/digital-twin"
                data-cursor="TRACE"
                className="mt-8 inline-flex border border-white/20 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-water hover:border-water/60"
              >
                Open digital twin ↗
              </Link>
            </div>
            <div className="relative min-h-[350px] border border-white/10 bg-[#0c0c0c] p-5">
              <div
                className="absolute inset-0 bg-[url('/brand/topology-grid.svg')] opacity-25"
                aria-hidden="true"
              />
              <div className="relative flex h-full items-center justify-center">
                <svg
                  viewBox="0 0 560 270"
                  className="w-full"
                  role="img"
                  aria-label="Digital twin branching topology"
                >
                  <g fill="none" stroke="#1e3b43" strokeWidth="12" strokeLinecap="round">
                    <path d="M48 135h120l68-78h100l72 78h112" />
                    <path d="M236 57l75 162h122" />
                  </g>
                  <g
                    fill="none"
                    stroke="#49C6E5"
                    strokeWidth="2"
                    strokeDasharray="2 11"
                    strokeLinecap="round"
                  >
                    <path d="M48 135h120l68-78h100l72 78h112" />
                    <path d="M236 57l75 162h122" />
                  </g>
                  <g fill="#0C0C0C" stroke="#67D5EE" strokeWidth="2">
                    <circle cx="48" cy="135" r="14" />
                    <circle cx="168" cy="135" r="11" />
                    <circle cx="236" cy="57" r="11" />
                    <circle cx="336" cy="57" r="11" />
                    <circle cx="308" cy="219" r="11" />
                    <circle cx="430" cy="219" r="11" />
                    <circle cx="520" cy="135" r="14" />
                  </g>
                  <g fill="#A1A1AA" fontFamily="monospace" fontSize="10">
                    <text x="30" y="168">
                      SOURCE
                    </text>
                    <text x="214" y="43">
                      PUMP
                    </text>
                    <text x="438" y="109">
                      ZONE
                    </text>
                  </g>
                </svg>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-frame mx-auto max-w-[1440px] border-b border-white/10 px-5 py-28 lg:px-10 lg:py-40">
          <div
            data-scroll-reveal
            className="grid gap-14 lg:grid-cols-[0.7fr_1.3fr] lg:items-center"
          >
            <div>
              <Eyebrow number="05" label="INTERVENTION LAB" />
              <h2 className="mt-8 max-w-lg text-5xl font-light leading-[0.9] tracking-[-0.055em] sm:text-7xl">
                Don&apos;t just find the problem.
                <br />
                <span className="text-white/40">Simulate what to do next.</span>
              </h2>
            </div>
            <div className="border border-white/10 bg-[#0c0c0c] p-5 sm:p-8">
              <div className="mb-7 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.15em] text-zinc-500">
                <span>BASELINE → CANDIDATE BRANCHES</span>
                <span>constraint gate</span>
              </div>
              <div className="grid gap-5 sm:grid-cols-[0.75fr_1.25fr]">
                <div className="flex items-center border border-water/30 bg-water/10 p-4 text-sm text-water">
                  <span className="mr-3 h-2 w-2 rounded-full bg-water" />
                  Baseline
                  <br />
                  <span className="ml-auto font-mono text-[9px]">FIXED</span>
                </div>
                <div className="space-y-3">
                  <Branch label="Candidate 01" state="FEASIBLE" tone="success" />
                  <Branch label="Candidate 02" state="REJECTED · MIN PRESSURE" tone="danger" />
                  <Branch label="Candidate 03" state="FEASIBLE" tone="success" />
                  <Branch label="Candidate 04" state="QUEUED" tone="water" />
                </div>
              </div>
              <p className="mt-7 border-t border-white/10 pt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                Feasibility comes from hard constraints. Ranking comes from the deterministic
                objective profile.
              </p>
            </div>
          </div>
        </section>

        <section className="landing-frame mx-auto max-w-[1440px] border-b border-white/10 px-5 py-28 lg:px-10 lg:py-40">
          <div data-scroll-reveal className="grid gap-14 lg:grid-cols-[1fr_0.9fr] lg:items-start">
            <div>
              <Eyebrow number="06" label="OPERATIONS AGENT" />
              <h2 className="mt-8 max-w-2xl text-5xl font-light leading-[0.9] tracking-[-0.055em] sm:text-7xl">
                AI can propose.
                <br />
                <span className="text-white/40">The model still has to prove it.</span>
              </h2>
              <p className="mt-8 max-w-lg text-sm leading-7 text-zinc-400">
                A bounded Gemini run can inspect state, propose typed interventions, request
                simulations, and explain a deterministic comparison. It cannot calculate hydraulics,
                bypass constraints, or actuate infrastructure.
              </p>
            </div>
            <div className="border border-white/10 bg-[#0c0c0c] p-5 font-mono text-[11px] text-zinc-300">
              <p className="mb-5 text-water">
                GOAL · Protect Zone C through midnight without flushing.
              </p>
              {[
                "Inspect network state",
                "Run deterministic baseline",
                "Propose typed candidates",
                "Simulate candidates",
                "Reject pressure violation",
                "Rank feasible scenarios",
                "Explain result",
              ].map((event, index) => (
                <div key={event} className="flex items-center gap-3 border-t border-white/10 py-3">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${index === 4 ? "bg-amber-400" : "bg-water"}`}
                  />
                  <span>{event}</span>
                  <span className="ml-auto text-[9px] uppercase tracking-[0.12em] text-zinc-600">
                    {index === 4 ? "gate" : "event"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-frame mx-auto max-w-[1440px] border-b border-white/10 px-5 py-28 lg:px-10 lg:py-40">
          <div data-scroll-reveal>
            <Eyebrow number="07" label="CHEMISTRY" />
            <div className="mt-8 grid gap-10 lg:grid-cols-[0.55fr_1.45fr] lg:items-end">
              <h2 className="max-w-xl text-5xl font-light leading-[0.9] tracking-[-0.055em] sm:text-7xl">
                Different profiles.
                <br />
                <span className="text-white/40">Different models.</span>
              </h2>
              <p className="max-w-md text-sm leading-7 text-zinc-400">
                Free Chlorine and Monochloramine are active, distinct chemistry profiles.
                Nitrification is described as modeled conditions, not a fabricated probability.
              </p>
            </div>
            <div className="mt-14 grid gap-px border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
              <Chemistry name="FREE CHLORINE" active detail="temperature · age · residual" />
              <Chemistry name="MONOCHLORAMINE" active detail="ammonia · pH · residual" />
              <Chemistry name="CHLORINE DIOXIDE" detail="coming soon" />
              <Chemistry name="ADVANCED MULTI-SPECIES" detail="coming soon" />
            </div>
          </div>
        </section>

        <section className="landing-frame mx-auto max-w-[1440px] border-b border-white/10 px-5 py-28 lg:px-10 lg:py-40">
          <div
            data-scroll-reveal
            className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:items-center"
          >
            <div>
              <Eyebrow number="08" label="PROVENANCE" />
              <h2 className="mt-8 max-w-2xl text-5xl font-light leading-[0.9] tracking-[-0.055em] sm:text-7xl">
                Every number
                <br />
                <span className="text-white/40">has a lineage.</span>
              </h2>
              <p className="mt-8 max-w-md text-sm leading-7 text-zinc-400">
                Network version, checksum, synthetic transform, provider activity, model version,
                calibration, simulation run, and agent run stay traceable.
              </p>
            </div>
            <div className="relative min-h-[320px] overflow-hidden border border-white/10 bg-[#0c0c0c] p-6">
              <div className="absolute inset-0 bg-[url('/brand/provenance-mark.svg')] bg-[length:260px] bg-right-bottom bg-no-repeat opacity-60" />
              <div className="relative space-y-2 font-mono text-[10px] uppercase tracking-[0.12em]">
                {[
                  "FORTYGUARD ACTIVITY",
                  "THERMAL SNAPSHOT",
                  "NETWORK VERSION / SHA",
                  "MODEL + CALIBRATION",
                  "SIMULATION RUN",
                  "RESULT / TARGET STATE",
                ].map((item, index) => (
                  <div
                    key={item}
                    className="flex items-center justify-between border border-white/10 bg-[#111214]/90 px-3 py-3"
                  >
                    <span className={index === 5 ? "text-water" : "text-zinc-400"}>{item}</span>
                    <span className="text-zinc-600">{index === 5 ? "↳ traced" : "linked"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          id="integrity"
          className="landing-frame mx-auto max-w-[1440px] border-b border-white/10 px-5 py-28 lg:px-10 lg:py-40"
        >
          <div data-scroll-reveal className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <Eyebrow number="09" label="ENGINEERING INTEGRITY" />
              <h2 className="mt-8 max-w-xl text-5xl font-light leading-[0.9] tracking-[-0.055em] sm:text-7xl">
                No scripted results.
                <br />
                <span className="text-white/40">No AI-generated physics.</span>
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["REAL / CACHED-REAL", "FortyGuard responses carry provider provenance."],
                [
                  "ACTUAL SIMULATION",
                  "Hydraulics, water age, thermal and chemistry are modeled in deterministic services.",
                ],
                ["HARD CONSTRAINTS", "Infeasible candidates cannot be recommended."],
                ["NO REAL ACTUATION", "Apply means Apply to Digital Twin."],
              ].map(([title, detail]) => (
                <div key={title} className="border border-white/10 p-5">
                  <div className="mb-5 h-px w-10 bg-water" />
                  <h3 className="font-mono text-[10px] tracking-[0.16em] text-water">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-t border-white/10 px-5 py-28 lg:px-10 lg:py-40">
          <div className="technical-grid pointer-events-none absolute inset-0 opacity-20" />
          <div
            data-scroll-reveal
            className="relative mx-auto grid max-w-[1120px] overflow-hidden border border-white/15 bg-[#090a0b] lg:grid-cols-[1.05fr_0.95fr]"
          >
            <div className="relative z-10 p-7 sm:p-10 lg:p-14">
              <Eyebrow number="10" label="OPEN THE WORKSPACE" />
              <h2 className="mt-7 max-w-xl text-[clamp(2.8rem,5.5vw,5.5rem)] font-light leading-[0.92] tracking-[-0.055em]">
                Start with the
                <br />
                <span className="text-white/45">modeled network.</span>
              </h2>
              <p className="mt-7 max-w-lg text-sm leading-7 text-zinc-400">
                Open Operations to inspect the captured thermal boundary, modeled network state,
                projected operational targets, and provenance in one map-first workspace.
              </p>
            </div>
            <div className="relative z-10 flex flex-col justify-between border-t border-white/10 bg-[#0c0c0c]/92 p-7 sm:p-10 lg:border-l lg:border-t-0 lg:p-14">
              <div>
                <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.16em] text-water">
                  Primary workspace
                </p>
                <ul className="mt-4 space-y-3 border-t border-white/10 pt-5 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-400">
                  <li className="flex justify-between gap-4">
                    <span>01 · Environmental input</span>
                    <span className="text-amber-300">TCM</span>
                  </li>
                  <li className="flex justify-between gap-4">
                    <span>02 · Modeled state</span>
                    <span className="text-water">NETWORK</span>
                  </li>
                  <li className="flex justify-between gap-4">
                    <span>03 · Decision support</span>
                    <span className="text-zinc-300">TRACEABLE</span>
                  </li>
                </ul>
              </div>
              <div className="mt-10">
                <Link
                  href="/operations"
                  data-cursor="OPEN"
                  className="inline-flex w-full items-center justify-between border border-water bg-water px-5 py-4 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#050505] transition hover:bg-water-luminous"
                >
                  Open Operations <span aria-hidden="true">↗</span>
                </Link>
                <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-600">
                  Decision support only · no real infrastructure control
                </p>
              </div>
            </div>
          </div>
          <div className="relative mx-auto mt-12 max-w-[1440px] overflow-hidden pt-8 text-center lg:mt-16">
            <span
              data-scroll-reveal
              className="landing-display block select-none whitespace-nowrap text-[clamp(5.8rem,15vw,15rem)] leading-[0.76] tracking-[-0.09em] text-white/[0.13]"
              aria-hidden="true"
            >
              VEINGUARD
            </span>
          </div>
        </section>
      </main>
      <footer className="border-t border-white/10 px-5 py-8 lg:px-10">
        <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-4 font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-600 sm:flex-row">
          <span>VEINGUARD · PROTECTED WATER CIRCULATION</span>
          <span>MODELED · PROJECTED · SIMULATED · PROVENANCE</span>
        </div>
      </footer>
    </div>
  );
}

function Eyebrow({ number, label }: { number: string; label: string }) {
  return (
    <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-water">
      <span className="text-sm text-zinc-500">{number}</span>
      <span className="h-4 w-px bg-white/20" />
      {label}
    </div>
  );
}

function Branch({
  label,
  state,
  tone,
}: {
  label: string;
  state: string;
  tone: "success" | "danger" | "water";
}) {
  const color =
    tone === "success"
      ? "text-emerald-300 border-emerald-300/30"
      : tone === "danger"
        ? "text-rose-300 border-rose-300/30"
        : "text-water border-water/30";
  return (
    <div className={`flex items-center gap-3 border-l-2 bg-[#111214] px-3 py-3 ${color}`}>
      <span className="font-mono text-[10px]">{label}</span>
      <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.1em]">{state}</span>
    </div>
  );
}

function Chemistry({ name, active, detail }: { name: string; active?: boolean; detail: string }) {
  return (
    <div className={`min-h-36 bg-[#0c0c0c] p-5 ${active ? "" : "opacity-60"}`}>
      <div
        className={`mb-6 h-2 w-2 rounded-full ${active ? "bg-water shadow-[0_0_12px_rgba(73,198,229,.8)]" : "border border-zinc-600"}`}
      />
      <h3 className="font-mono text-[10px] tracking-[0.13em] text-zinc-300">{name}</h3>
      <p
        className={`mt-3 text-[10px] uppercase tracking-[0.12em] ${active ? "text-water" : "text-zinc-600"}`}
      >
        {active ? "ACTIVE" : "COMING SOON"}
      </p>
      <p className="mt-3 text-xs text-zinc-500">{detail}</p>
    </div>
  );
}
