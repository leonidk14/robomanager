import { route } from "@/lib/mock-backend/http";
import { getSite } from "@/lib/mock-backend/queries";

export const GET = route(async (_request, { params }: RouteContext<"/api/sites/[siteId]">) => {
  const { siteId } = await params;
  return Response.json(getSite(siteId));
});
