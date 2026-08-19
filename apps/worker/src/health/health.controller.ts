import { Controller, Get, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get("live")
  live(@Req() request: Request) {
    return {
      data: this.health.live(),
      meta: { correlationId: correlationIdFrom(request) },
    };
  }

  @Get("ready")
  async ready(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const correlationId = correlationIdFrom(request);
    response.setHeader("x-correlation-id", correlationId);
    const data = await this.health.ready();
    if (data.status !== "ready") {
      response.status(503);
      return {
        error: {
          code: "INTERNAL_DEPENDENCY_UNAVAILABLE",
          message: "Worker is not ready.",
          correlationId,
        },
      };
    }
    return {
      data,
      meta: { correlationId },
    };
  }
}

function correlationIdFrom(request: Request): string {
  const existing = request.header("x-correlation-id");
  return existing && existing.trim().length > 0 ? existing.trim() : randomUUID();
}
