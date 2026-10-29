import { ROBOT_EVENT_TYPES } from "@/lib/api/types";
import { ROBOT_IDS, SITE_IDS } from "@/lib/mock-backend/fixtures";
import { listOf, oneOf, pageQuery, route } from "@/lib/mock-backend/http";
import { listEvents } from "@/lib/mock-backend/queries";

export const GET = route((request) => {
  const params = request.nextUrl.searchParams;
  return Response.json(
    listEvents({
      siteId: oneOf(params, "siteId", SITE_IDS),
      robotId: oneOf(params, "robotId", ROBOT_IDS),
      type: listOf(params, "type", ROBOT_EVENT_TYPES),
      ...pageQuery(params),
    }),
  );
});
