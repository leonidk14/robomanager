import { TELEMETRY_RANGES } from "@/lib/api/types";
import { integer, oneOf, route } from "@/lib/mock-backend/http";
import { getTelemetry } from "@/lib/mock-backend/queries";

export const GET = route(async (request, { params }: RouteContext<"/api/robots/[robotId]/telemetry">) => {
  const { robotId } = await params;
  const search = request.nextUrl.searchParams;
  const range = oneOf(search, "range", TELEMETRY_RANGES) ?? "15m";
  return Response.json(getTelemetry(robotId, range, integer(search, "maxPoints", 10, 3600) ?? 300));
});
