import { route } from "@/lib/mock-backend/http";
import { getRobot } from "@/lib/mock-backend/queries";

export const GET = route(async (_request, { params }: RouteContext<"/api/robots/[robotId]">) => {
  const { robotId } = await params;
  return Response.json(getRobot(robotId));
});
