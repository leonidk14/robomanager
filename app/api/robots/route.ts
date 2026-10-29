import { ROBOT_KINDS, ROBOT_STATUSES } from "@/lib/api/types";
import { SITE_IDS } from "@/lib/mock-backend/fixtures";
import { integer, listOf, oneOf, route } from "@/lib/mock-backend/http";
import { listRobots, ROBOT_SORTS } from "@/lib/mock-backend/queries";

export const GET = route((request) => {
  const params = request.nextUrl.searchParams;
  return Response.json(
    listRobots({
      siteId: oneOf(params, "siteId", SITE_IDS),
      status: listOf(params, "status", ROBOT_STATUSES),
      kind: listOf(params, "kind", ROBOT_KINDS),
      q: params.get("q") ?? undefined,
      sort: oneOf(params, "sort", ROBOT_SORTS) ?? "name",
      order: oneOf(params, "order", ["asc", "desc"]) ?? "asc",
      limit: integer(params, "limit", 1, 500),
      offset: integer(params, "offset", 0, 10_000) ?? 0,
    }),
  );
});
