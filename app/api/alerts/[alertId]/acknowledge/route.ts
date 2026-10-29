import { ApiError } from "@/lib/mock-backend/errors";
import { readBody, route } from "@/lib/mock-backend/http";
import { getSimulation } from "@/lib/mock-backend/simulation";

export const POST = route(async (request, { params }: RouteContext<"/api/alerts/[alertId]/acknowledge">) => {
  const { alertId } = await params;
  const { by = "Fleet manager" } = await readBody(request);
  if (typeof by !== "string" || !by.trim()) {
    throw ApiError.badRequest("by must be a non-empty string");
  }
  return Response.json(getSimulation().acknowledgeAlert(alertId, by.trim()));
});
