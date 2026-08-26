"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: "water" | "thermal" | "neutral";
  phase: number;
};

const PARTICLE_COUNT = 74;

export function NetworkParticleField({ reducedMotion }: { reducedMotion: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let frame = 0;
    let visible = true;
    let width = 0;
    let height = 0;
    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
      x: (Math.sin(index * 19.7) + 1) / 2,
      y: (Math.sin(index * 43.1) + 1) / 2,
      vx: 0.000035 + (index % 5) * 0.000006,
      vy: ((index % 7) - 3) * 0.000008,
      kind: index % 11 === 0 ? "thermal" : index % 3 === 0 ? "neutral" : "water",
      phase: index * 0.73,
    }));

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = Math.max(bounds.width, 1);
      height = Math.max(bounds.height, 1);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const draw = (time: number) => {
      frame = 0;
      context.clearRect(0, 0, width, height);
      const minDimension = Math.min(width, height);

      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];
        if (!reducedMotion) {
          particle.x = (particle.x + particle.vx) % 1;
          particle.y += particle.vy + Math.sin(time * 0.00022 + particle.phase) * 0.000006;
          if (particle.y < -0.03) particle.y = 1.03;
          if (particle.y > 1.03) particle.y = -0.03;
        }
        for (let neighborIndex = index + 1; neighborIndex < particles.length; neighborIndex += 1) {
          const neighbor = particles[neighborIndex];
          const dx = (particle.x - neighbor.x) * width;
          const dy = (particle.y - neighbor.y) * height;
          const distance = Math.hypot(dx, dy);
          if (distance > minDimension * 0.15) continue;
          const alpha = (1 - distance / (minDimension * 0.15)) * 0.16;
          context.strokeStyle = particle.kind === "thermal" || neighbor.kind === "thermal"
            ? `rgba(245, 158, 11, ${alpha * 0.62})`
            : `rgba(73, 198, 229, ${alpha})`;
          context.lineWidth = 0.7;
          context.beginPath();
          context.moveTo(particle.x * width, particle.y * height);
          context.lineTo(neighbor.x * width, neighbor.y * height);
          context.stroke();
        }
      }

      for (const particle of particles) {
        const pulse = 0.65 + Math.sin(time * 0.0012 + particle.phase) * 0.25;
        const radius = particle.kind === "neutral" ? 1.2 : particle.kind === "thermal" ? 2.4 : 1.85;
        context.fillStyle = particle.kind === "thermal"
          ? `rgba(245, 158, 11, ${pulse})`
          : particle.kind === "neutral"
            ? "rgba(228, 228, 231, 0.42)"
            : `rgba(103, 213, 238, ${pulse})`;
        context.beginPath();
        context.arc(particle.x * width, particle.y * height, radius, 0, Math.PI * 2);
        context.fill();
      }

      if (!reducedMotion && visible) frame = requestAnimationFrame(draw);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !frame && !reducedMotion) frame = requestAnimationFrame(draw);
    });
    intersectionObserver.observe(canvas);
    resize();
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, [reducedMotion]);

  return <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />;
}
