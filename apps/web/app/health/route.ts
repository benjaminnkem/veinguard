export function GET(): Response {
  return Response.json({
    data: {
      status: "ok",
      service: "veinguard-web",
    },
    meta: {
      appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
    },
  });
}
