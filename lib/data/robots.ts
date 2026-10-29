import "server-only";

import { connection } from "next/server";

import type { RobotList, Site } from "@/lib/api/types";
import { listRobots, listSites } from "@/lib/mock-backend/queries";
import type { RobotFilters } from "@/lib/robots/search-params";

// The seam between the UI and the fleet backend. Today it calls the in-process mock read models; against a real
// backend these become `fetch` calls with the same query parameters as `GET /api/robots`.

export type SiteOption = Pick<Site, "id" | "name" | "timezone">;

export interface RobotPage extends RobotList {
  /** When the data was read; "last seen" times are relative to it because the list is a snapshot. */
  fetchedAt: string;
}

export async function getRobots(filters: RobotFilters): Promise<RobotPage> {
  await connection();
  const list = listRobots({
    siteId: filters.siteId ?? undefined,
    status: filters.status.length ? filters.status : undefined,
    kind: filters.kind.length ? filters.kind : undefined,
    q: filters.q || undefined,
    hasAlerts: filters.hasAlerts || undefined,
    lowBattery: filters.lowBattery || undefined,
    outdatedFirmware: filters.outdatedFirmware || undefined,
    sort: filters.sort,
    order: filters.order,
    limit: filters.pageSize,
    offset: (filters.page - 1) * filters.pageSize,
  });
  return { ...list, fetchedAt: new Date().toISOString() };
}

export async function getSites(): Promise<SiteOption[]> {
  await connection();
  return listSites().items.map(({ id, name, timezone }) => ({ id, name, timezone }));
}
