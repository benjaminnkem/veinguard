import http from "node:http";

const publicPort = Number.parseInt(process.env.PORT ?? "10000", 10);
const targets = {
  api: { hostname: "127.0.0.1", port: 3001 },
  simulation: { hostname: "127.0.0.1", port: 8000 },
  web: { hostname: "127.0.0.1", port: 3000 },
  worker: { hostname: "127.0.0.1", port: 3002 },
};

if (!Number.isInteger(publicPort) || publicPort < 1 || publicPort > 65_535) {
  throw new Error("PORT must be a valid TCP port");
}

const readinessChecks = [
  ["api", "/health/ready"],
  ["simulation", "/health/ready"],
  ["worker", "/health/ready"],
  ["web", "/health"],
];

async function checkReadiness() {
  const results = await Promise.allSettled(
    readinessChecks.map(async ([name, path]) => {
      const target = targets[name];
      const response = await fetch(`http://${target.hostname}:${target.port}${path}`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) {
        throw new Error(`${name} readiness returned ${response.status}`);
      }
    }),
  );
  return results.every((result) => result.status === "fulfilled");
}

function routeRequest(pathname) {
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return {
      target: targets.api,
      pathname: pathname.slice("/api".length) || "/",
    };
  }
  if (pathname === "/simulation" || pathname.startsWith("/simulation/")) {
    return {
      target: targets.simulation,
      pathname: pathname.slice("/simulation".length) || "/",
    };
  }
  if (pathname === "/worker" || pathname.startsWith("/worker/")) {
    return {
      target: targets.worker,
      pathname: pathname.slice("/worker".length) || "/",
    };
  }
  return { target: targets.web, pathname };
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? "/", "http://veinguard.internal");

  if (requestUrl.pathname === "/health/live") {
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": "application/json",
    });
    response.end(JSON.stringify({ data: { status: "ok", service: "veinguard-render" } }));
    return;
  }

  if (requestUrl.pathname === "/health/ready") {
    const ready = await checkReadiness().catch(() => false);
    response.writeHead(ready ? 200 : 503, {
      "cache-control": "no-store",
      "content-type": "application/json",
    });
    response.end(
      JSON.stringify({
        data: { status: ready ? "ready" : "not_ready", service: "veinguard-render" },
      }),
    );
    return;
  }

  const route = routeRequest(requestUrl.pathname);
  const forwardedPath = `${route.pathname}${requestUrl.search}`;
  const forwardedHeaders = {
    ...request.headers,
    host: `${route.target.hostname}:${route.target.port}`,
    "x-forwarded-host": request.headers.host ?? "",
    "x-forwarded-proto": "https",
  };
  const proxyRequest = http.request(
    {
      hostname: route.target.hostname,
      port: route.target.port,
      method: request.method,
      path: forwardedPath,
      headers: forwardedHeaders,
    },
    (proxyResponse) => {
      response.writeHead(
        proxyResponse.statusCode ?? 502,
        proxyResponse.statusMessage,
        proxyResponse.headers,
      );
      proxyResponse.pipe(response);
    },
  );

  proxyRequest.on("error", (error) => {
    console.error(
      JSON.stringify({
        level: "warn",
        message: "VeinGuard gateway upstream request failed",
        target: route.target,
        error: error.message,
      }),
    );
    if (!response.headersSent) {
      response.writeHead(502, {
        "cache-control": "no-store",
        "content-type": "application/json",
      });
    }
    response.end(
      JSON.stringify({
        error: {
          code: "UPSTREAM_UNAVAILABLE",
          message: "The requested VeinGuard service is starting or unavailable.",
        },
      }),
    );
  });

  request.on("aborted", () => proxyRequest.destroy());
  request.pipe(proxyRequest);
});

server.listen(publicPort, "0.0.0.0", () => {
  console.log(
    JSON.stringify({
      level: "info",
      message: "VeinGuard Render gateway listening",
      port: publicPort,
    }),
  );
});

function shutdown() {
  server.close(() => {
    process.exitCode = 0;
  });
  server.closeAllConnections();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
