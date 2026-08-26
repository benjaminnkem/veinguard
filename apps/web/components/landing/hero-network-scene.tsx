"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMemo, useRef } from "react";
import type { Group, Mesh } from "three";
import { heroObjects } from "@/lib/theatre/project";

const PIPE_PATHS = [
  [[-6, -1.4, -1], [-3.7, -0.3, 0], [-1.5, -0.8, 0]],
  [[-1.5, -0.8, 0], [0, 0.6, 0.1], [2.2, 0.15, 0]],
  [[-1.5, -0.8, 0], [0.4, -1.2, -0.3], [2.8, -1.35, -0.4]],
  [[2.2, 0.15, 0], [3.8, 1.3, -0.3], [6, 1.1, -0.6]],
  [[2.2, 0.15, 0], [3.8, -0.35, 0.2], [6.2, -0.65, 0.1]],
] as const;

function FlowPipe({ points, index }: { points: readonly (readonly [number, number, number])[]; index: number }) {
  const group = useRef<Group>(null);
  const curve = useMemo(
    () => new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z))),
    [points],
  );
  const geometry = useMemo(() => new THREE.TubeGeometry(curve, 28, index === 1 ? 0.09 : 0.065, 8, false), [curve, index]);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const drift = heroObjects.network.value.drift;
    group.current.position.y = Math.sin(clock.elapsedTime * 0.28 + index) * 0.025 * drift;
    group.current.rotation.z = Math.sin(clock.elapsedTime * 0.16 + index) * 0.004 * drift;
  });

  return (
    <group ref={group}>
      <mesh geometry={geometry}>
        <meshStandardMaterial color="#121719" metalness={0.72} roughness={0.28} />
      </mesh>
      <mesh geometry={geometry} scale={1.015}>
        <meshBasicMaterial color={index === 1 ? "#49C6E5" : "#0E667B"} transparent opacity={index === 1 ? 0.5 : 0.18} />
      </mesh>
    </group>
  );
}

function NetworkScene({ reducedMotion }: { reducedMotion: boolean }) {
  const network = useRef<Group>(null);
  const thermal = useRef<Mesh>(null);
  const cameraTarget = useRef(new THREE.Vector3(0, 0, 8.5));

  useFrame(({ camera, clock, pointer }) => {
    const cameraValues = heroObjects.camera.value;
    cameraTarget.current.set(cameraValues.x + pointer.x * 0.08, cameraValues.y + pointer.y * 0.05, cameraValues.z);
    camera.position.lerp(cameraTarget.current, 0.025);
    camera.lookAt(0, 0, 0);
    if (!reducedMotion && network.current) {
      network.current.rotation.y = Math.sin(clock.elapsedTime * 0.08) * 0.03;
      network.current.rotation.x = Math.cos(clock.elapsedTime * 0.11) * 0.012;
    }
    if (thermal.current) {
      const thermalValues = heroObjects.thermal.value;
      const material = thermal.current.material as THREE.MeshBasicMaterial;
      material.opacity = thermalValues.intensity * (0.16 + Math.sin(clock.elapsedTime * 0.22) * 0.015);
    }
  });

  return (
    <>
      <ambientLight intensity={0.35} />
      <pointLight position={[2, 2, 4]} intensity={8} color="#49C6E5" distance={14} />
      <pointLight position={[-4, 3, 1]} intensity={1.4} color="#F59E0B" distance={12} />
      <group ref={network}>
        {PIPE_PATHS.map((points, index) => <FlowPipe key={index} points={points} index={index} />)}
        {[-1.5, 2.2, 6, 6.2].map((x, index) => (
          <mesh key={`${x}-${index}`} position={[x, index === 0 ? -0.8 : index === 1 ? 0.15 : index === 2 ? 1.1 : -0.65, index < 2 ? 0 : -0.2]}>
            <sphereGeometry args={[index === 1 ? 0.18 : 0.12, 16, 16]} />
            <meshStandardMaterial color="#0C1517" emissive="#49C6E5" emissiveIntensity={index === 1 ? 2.6 : 0.8} roughness={0.3} />
          </mesh>
        ))}
        <mesh position={[1.25, 1.55, -0.9]} ref={thermal}>
          <circleGeometry args={[2.45, 64]} />
          <meshBasicMaterial color="#F59E0B" depthWrite={false} transparent opacity={0.075} />
        </mesh>
      </group>
    </>
  );
}

export function HeroNetworkScene({ reducedMotion = false }: { reducedMotion?: boolean }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 8.5], fov: 42 }}
      dpr={[1, 1.45]}
      frameloop={reducedMotion ? "demand" : "always"}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      fallback={<div className="h-full w-full bg-[#050505]" aria-hidden="true" />}
      aria-hidden="true"
    >
      <NetworkScene reducedMotion={reducedMotion} />
    </Canvas>
  );
}
