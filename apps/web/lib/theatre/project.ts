import { getProject, type ISheetObject } from "@theatre/core";
import projectState from "@/theatre/veinguard-project-state.json";

export type HeroSceneValues = {
  strength: number;
  drift: number;
  thermalIntensity: number;
};

const project = getProject("VeinGuard Visual System", { state: projectState });

export const heroSheet = project.sheet("VeinGuard / Hero");

export const heroObjects: {
  network: ISheetObject<HeroSceneValues>;
  camera: ISheetObject<{ x: number; y: number; z: number }>;
  thermal: ISheetObject<{ intensity: number; warmth: number }>;
} = {
  network: heroSheet.object("Hero / Network", {
    strength: 1,
    drift: 0.18,
    thermalIntensity: 0.42,
  }),
  camera: heroSheet.object("Hero / Camera", { x: 0, y: 0, z: 8.5 }),
  thermal: heroSheet.object("Hero / Thermal Surface", {
    intensity: 0.42,
    warmth: 0.65,
  }),
};

export { project as theatreProject };
