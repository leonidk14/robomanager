import { SITE_IDS } from "@/lib/mock-backend/fixtures";
import { oneOf, route } from "@/lib/mock-backend/http";
import { fleetSummary } from "@/lib/mock-backend/queries";

export const GET = route((request) => {
  return Response.json(fleetSummary(oneOf(request.nextUrl.searchParams, "siteId", SITE_IDS)));
});
