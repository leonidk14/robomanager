import { COMMAND_TYPES } from "@/lib/api/types";
import { expectOneOf, readBody, route } from "@/lib/mock-backend/http";
import { getSimulation } from "@/lib/mock-backend/simulation";

/** Accepts the command (202, status "pending"); the outcome arrives on the stream as a `command` message. */
export const POST = route(async (request, { params }: RouteContext<"/api/robots/[robotId]/commands">) => {
  const { robotId } = await params;
  const { type } = await readBody(request);
  const command = getSimulation().issueCommand(robotId, expectOneOf(type, "type", COMMAND_TYPES));
  return Response.json(command, { status: 202 });
});
