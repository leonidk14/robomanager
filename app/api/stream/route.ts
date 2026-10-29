import type { StreamMessage } from "@/lib/api/types";
import { ROBOT_IDS, SITE_IDS } from "@/lib/mock-backend/fixtures";
import { listOf, oneOf, route } from "@/lib/mock-backend/http";
import { getSimulation } from "@/lib/mock-backend/simulation";

const KEEP_ALIVE_MS = 15_000;
const RECONNECT_MS = 2_000;

const encoder = new TextEncoder();

/**
 * Server-Sent Events. Starts with a `snapshot`, then pushes `telemetry`, `alert`, `task`, `robot_event` and
 * `command` messages. Filters: `?siteId=`, `?robotId=a,b`. `?_dropAfter=30` closes the stream after 30 s to
 * exercise reconnects. There is no replay: after a reconnect the new snapshot replaces the robot states.
 */
export const GET = route((request) => {
  const params = request.nextUrl.searchParams;
  const siteId = oneOf(params, "siteId", SITE_IDS);
  const robotIds = listOf(params, "robotId", ROBOT_IDS);
  const dropAfterMs = Number(params.get("_dropAfter")) * 1000;

  const sim = getSimulation();
  const watched = new Set(
    [...sim.robots.values()]
      .filter((r) => (!siteId || r.robot.siteId === siteId) && (!robotIds || robotIds.includes(r.robot.id)))
      .map((r) => r.robot.id),
  );
  let stop = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let unsubscribe = () => {};
      const keepAlive = setInterval(() => write(": keep-alive\n\n"), KEEP_ALIVE_MS);
      const drop = dropAfterMs > 0 ? setTimeout(() => close(), dropAfterMs) : undefined;

      const close = () => {
        if (closed) {
          return;
        }
        closed = true;
        unsubscribe();
        clearInterval(keepAlive);
        clearTimeout(drop);
        request.signal.removeEventListener("abort", close);
        try {
          controller.close();
        } catch {
          // Already closed by the client.
        }
      };
      const write = (chunk: string) => {
        if (closed) {
          return;
        }
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      };
      const send = ({ type, data }: StreamMessage) => write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);

      write(`retry: ${RECONNECT_MS}\n\n`);
      send({
        type: "snapshot",
        data: {
          serverTime: new Date().toISOString(),
          robots: [...sim.robots.values()].filter((r) => watched.has(r.robot.id)).map((r) => sim.stateOf(r)),
        },
      });

      unsubscribe = sim.subscribe((message) => {
        if (message.type === "snapshot") {
          return;
        }
        if (message.type !== "telemetry") {
          if (watched.has(message.data.robotId)) {
            send(message);
          }
          return;
        }
        const robots = message.data.robots.filter((state) => watched.has(state.robotId));
        if (robots.length > 0) {
          send({ type: "telemetry", data: { ts: message.data.ts, robots } });
        }
      }, close);
      request.signal.addEventListener("abort", close);
      stop = close;
    },
    cancel() {
      stop();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
