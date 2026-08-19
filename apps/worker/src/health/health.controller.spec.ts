import { Test, TestingModule } from "@nestjs/testing";
import type { Request, Response } from "express";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

function mockRequest(): Request {
  return {
    header: () => undefined,
  } as unknown as Request;
}

function mockResponse(): { response: Response; status: jest.Mock } {
  const status = jest.fn().mockReturnThis();
  return {
    status,
    response: {
      setHeader: jest.fn(),
      status,
    } as unknown as Response,
  };
}

describe("HealthController", () => {
  let controller: HealthController;
  let health: { live: jest.Mock; ready: jest.Mock };

  beforeEach(async () => {
    health = {
      live: jest.fn().mockReturnValue({ status: "ok", service: "veinguard-worker" }),
      ready: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: health }],
    }).compile();
    controller = module.get(HealthController);
  });

  it("returns live status", () => {
    const body = controller.live(mockRequest());
    expect(body.data.service).toBe("veinguard-worker");
  });

  it("returns 503 when worker is not ready", async () => {
    health.ready.mockResolvedValue({
      status: "not_ready",
      service: "veinguard-worker",
      checks: [{ name: "redis", status: "down" }],
    });
    const { response, status } = mockResponse();
    const body = await controller.ready(mockRequest(), response);
    expect(status).toHaveBeenCalledWith(503);
    expect("error" in body).toBe(true);
  });
});
