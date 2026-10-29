import { route } from "@/lib/mock-backend/http";
import { listSites } from "@/lib/mock-backend/queries";

export const GET = route(() => Response.json(listSites()));
