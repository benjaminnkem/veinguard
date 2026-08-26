import net from "node:net";
import { spawn } from "node:child_process";
import process from "node:process";

const workspace = process.env.VEINGUARD_WORKSPACE ?? "/workspace";
const children = new Map();
let shuttingDown = false;

const simulationToken = process.env.SIMULATION_SERVICE_TOKEN || process.env.SERVICE_TOKEN || "";

if (simulationToken.length < 16) {
  throw new Error("Set SIMULATION_SERVICE_TOKEN (or SERVICE_TOKEN) to at least 16 characters.");
}

const inherited = { ...process.env };
const childEnvironment = (overrides = {}) => ({
  ...inherited,
  ...overrides,
});

const publicChildEnvironment = (overrides = {}) => {
  const environment = { ...inherited };
  for (const key of [
    "MONGODB_URI",
    "REDIS_URL",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "SIMULATION_SERVICE_TOKEN",
    "SERVICE_TOKEN",
    "FORTYGUARD_API_KEY",
    "GEMINI_API_KEY_1",
    "GEMINI_API_KEY_2",
    "GEMINI_API_KEY_3",
    "GEMINI_API_KEY_4",
  ]) {
    delete environment[key];
  }
  return { ...environment, ...overrides };
};

const simulationEnvironment = {
  APP_ENV: process.env.NODE_ENV === "production" ? "production" : "development",
  HOST: "0.0.0.0",
  PORT: "8000",
  SERVICE_TOKEN: simulationToken,
  NETWORK_DATA_DIR: "/workspace/data/networks",
  CALIBRATION_DATA_DIR: "/workspace/data/calibration",
  GEOREFERENCE_DATA_DIR: "/workspace/data/georeference",
  FIXTURE_DATA_DIR: "/workspace/data/fixtures",
  CONSTRAINTS_DATA_DIR: "/workspace/data/constraints",
  OBJECTIVE_DATA_DIR: "/workspace/data/objective",
  MAX_CONCURRENT_SIMULATIONS: "1",
  SIMULATION_TIMEOUT_SECONDS: "120",
  THERMAL_MODEL_VERSION: "water-temp-v1",
  FREE_CHLORINE_MODEL_VERSION: "free-chlorine-v1",
  MONOCHLORAMINE_MODEL_VERSION: "monochloramine-v1",
  NITRIFICATION_RISK_MODEL_VERSION: "nitrification-conditions-v1",
};

const webEnvironment = {
  NODE_ENV: "production",
  PORT: "3000",
  HOSTNAME: "0.0.0.0",
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1",
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV ?? "production",
  NEXT_PUBLIC_MAP_STYLE_URL_LIGHT:
    process.env.NEXT_PUBLIC_MAP_STYLE_URL_LIGHT ?? "https://tiles.openfreemap.org/styles/positron",
  NEXT_PUBLIC_MAP_STYLE_URL_DARK:
    process.env.NEXT_PUBLIC_MAP_STYLE_URL_DARK ?? "https://tiles.openfreemap.org/styles/dark",
};

const services = [
  {
    name: "simulation",
    command: "/opt/veinguard-venv/bin/uvicorn",
    args: ["veinguard_sim.main:app", "--host", "0.0.0.0", "--port", "8000"],
    cwd: `${workspace}/services/simulation`,
    env: publicChildEnvironment(simulationEnvironment),
    port: 8000,
  },
  {
    name: "api",
    command: "node",
    args: ["apps/api/dist/main.js"],
    cwd: workspace,
    env: childEnvironment({ PORT: "3001", SIMULATION_SERVICE_TOKEN: simulationToken }),
    port: 3001,
  },
  {
    name: "worker",
    command: "node",
    args: ["apps/worker/dist/main.js"],
    cwd: workspace,
    env: childEnvironment({
      WORKER_HEALTH_PORT: "3002",
      SIMULATION_SERVICE_TOKEN: simulationToken,
    }),
    port: 3002,
  },
  {
    name: "web",
    command: "node",
    args: ["node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"],
    cwd: workspace,
    env: publicChildEnvironment(webEnvironment),
    port: 3000,
  },
];

function terminateChildren(signal = "SIGTERM") {
  for (const child of children.values()) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill(signal);
    }
  }
}

function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  process.exitCode = exitCode;
  console.log(
    JSON.stringify({
      level: "info",
      message: "VeinGuard Render container shutting down",
      signal,
    }),
  );
  terminateChildren("SIGTERM");
  const forceTimer = setTimeout(() => terminateChildren("SIGKILL"), 25_000);
  forceTimer.unref();
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

function waitForPort(port, timeoutMs = 30_000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (shuttingDown) {
        reject(new Error(`Shutdown while waiting for port ${port}.`));
        return;
      }
      const socket = net.createConnection({ host: "127.0.0.1", port });
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Timed out waiting for port ${port}.`));
          return;
        }
        setTimeout(attempt, 250).unref();
      });
    };
    attempt();
  });
}

function startService(service) {
  const child = spawn(service.command, service.args, {
    cwd: service.cwd,
    env: service.env,
    stdio: "inherit",
  });
  children.set(service.name, child);
  child.once("error", (error) => {
    console.error(
      JSON.stringify({
        level: "error",
        message: "VeinGuard child process failed to start",
        service: service.name,
        error: error.message,
      }),
    );
    shutdown(`start-error:${service.name}`, 1);
  });
  child.once("exit", (code, signal) => {
    children.delete(service.name);
    if (!shuttingDown) {
      console.error(
        JSON.stringify({
          level: "error",
          message: "Critical VeinGuard child process exited",
          service: service.name,
          code,
          signal,
        }),
      );
      shutdown(`child-exit:${service.name}`, 1);
    }
    if (children.size === 0) process.exit();
  });
}

try {
  for (const service of services) {
    startService(service);
  }
  await Promise.all(services.map((service) => waitForPort(service.port)));
  startService({
    name: "gateway",
    command: "node",
    args: ["docker/render/gateway.mjs"],
    cwd: workspace,
    env: publicChildEnvironment({ PORT: process.env.PORT ?? "10000" }),
  });
} catch (error) {
  console.error(
    JSON.stringify({
      level: "error",
      message: "VeinGuard Render startup failed",
      error: error instanceof Error ? error.message : "Unknown error",
    }),
  );
  shutdown("startup-failure", 1);
}
