import { ALERT_SEVERITIES, ALERT_STATUSES, ALERT_TYPES } from "@/lib/api/types";
import { ROBOT_IDS, SITE_IDS } from "@/lib/mock-backend/fixtures";
import { listOf, oneOf, pageQuery, route } from "@/lib/mock-backend/http";
import { listAlerts } from "@/lib/mock-backend/queries";

export const GET = route((request) => {
  const params = request.nextUrl.searchParams;
  return Response.json(
    listAlerts({
      siteId: oneOf(params, "siteId", SITE_IDS),
      robotId: oneOf(params, "robotId", ROBOT_IDS),
      status: listOf(params, "status", ALERT_STATUSES),
      severity: listOf(params, "severity", ALERT_SEVERITIES),
      type: listOf(params, "type", ALERT_TYPES),
      ...pageQuery(params),
    }),
  );
});
