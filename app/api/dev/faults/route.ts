import { ALERT_TYPES } from "@/lib/api/types";
import { ROBOT_IDS } from "@/lib/mock-backend/fixtures";
import { expectOneOf, readBody, route } from "@/lib/mock-backend/http";
import { getSimulation } from "@/lib/mock-backend/simulation";

/** Dev tool: puts a robot into the condition behind an alert type, e.g. `{ "robotId": "rbt-001", "type": "emergency_stop" }`. */
export const POST = route(async (request) => {
  const body = await readBody(request);
  const robotId = expectOneOf(body.robotId, "robotId", ROBOT_IDS);
  const type = expectOneOf(body.type, "type", ALERT_TYPES);
  getSimulation().injectFault(robotId, type);
  return Response.json({ robotId, type }, { status: 202 });
});
