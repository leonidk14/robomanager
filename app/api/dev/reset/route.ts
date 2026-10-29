import { ApiError } from "@/lib/mock-backend/errors";
import { readBody, route } from "@/lib/mock-backend/http";
import { resetSimulation } from "@/lib/mock-backend/simulation";

/** Dev tool: restarts the simulation (optionally with another seed). Open streams are closed and reconnect. */
export const POST = route(async (request) => {
  const { seed } = await readBody(request);
  if (seed !== undefined && !Number.isInteger(seed)) {
    throw ApiError.badRequest("seed must be an integer");
  }
  resetSimulation(seed as number | undefined);
  return new Response(null, { status: 204 });
});
