import { Container, getContainer } from "@cloudflare/containers";

export class Backend extends Container<Env> {
  // uvicorn port inside the container (backend/Dockerfile EXPOSE 8000)
  defaultPort = 8000;
  // Idle time before the container sleeps. Sleeping wipes the ephemeral disk,
  // including the SQLite database — longer keeps demo data alive but bills
  // more running time.
  sleepAfter = "30m";
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      // getContainer with no name routes every request to the same singleton
      // instance — SQLite allows only one writer.
      return getContainer(env.BACKEND).fetch(request);
    }
    // Unreachable while run_worker_first is ["/api/*"] (assets are served
    // without invoking the Worker), kept as a safety net.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
