import { z } from "zod";

export const geoJsonFeatureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(z.unknown()),
});

export const submitResponseSchema = z.object({
  error: z.boolean(),
  status_code: z.number(),
  message: z.string(),
  data: z.object({
    activity_id: z.string().min(1),
  }),
});

export const statusResponseSchema = z.object({
  error: z.boolean(),
  status_code: z.number(),
  message: z.string(),
  data: z.object({
    activity_id: z.string().min(1),
    status: z.enum(["Processing", "Completed", "Failed"]),
    result: z
      .object({
        map_data: z.unknown(),
        stats_data: z.unknown().optional(),
      })
      .optional(),
  }),
});

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

export function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
