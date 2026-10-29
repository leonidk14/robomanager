import { TASK_STATUSES } from "@/lib/api/types";
import { ROBOT_IDS, SITE_IDS } from "@/lib/mock-backend/fixtures";
import { listOf, oneOf, pageQuery, route } from "@/lib/mock-backend/http";
import { listTasks } from "@/lib/mock-backend/queries";

export const GET = route((request) => {
  const params = request.nextUrl.searchParams;
  return Response.json(
    listTasks({
      siteId: oneOf(params, "siteId", SITE_IDS),
      robotId: oneOf(params, "robotId", ROBOT_IDS),
      status: listOf(params, "status", TASK_STATUSES),
      ...pageQuery(params),
    }),
  );
});
