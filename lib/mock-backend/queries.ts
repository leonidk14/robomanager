import "server-only";

import {
  ROBOT_STATUSES,
  type Alert,
  type AlertSeverity,
  type AlertStatus,
  type AlertType,
  type FleetSummary,
  type Page,
  type RobotDetail,
  type RobotEvent,
  type RobotEventType,
  type RobotKind,
  type RobotList,
  type RobotStatus,
  type RobotSummary,
  type Site,
  type SiteDetail,
  type SiteSummary,
  type Task,
  type TaskStatus,
  type TelemetryPoint,
  type TelemetryRange,
  type TelemetrySeries,
} from "@/lib/api/types";

import { ApiError } from "./errors";
import { SITES } from "./fixtures";
import { CRITICAL_BATTERY, getSimulation, LOW_BATTERY, TICK_MS, type SimRobot, type Simulation } from "./simulation";

// Read models behind the GET endpoints. Server Components can call these directly instead of fetching
// the API over HTTP (call `await connection()` first, since the data is live).

const HOUR_MS = 60 * 60 * 1000;

const RANGE_MS: Record<TelemetryRange, number> = { "5m": 5 * 60_000, "15m": 15 * 60_000, "1h": HOUR_MS };

/** Order for `sort=status`: states that need an operator come first. */
const STATUS_PRIORITY: RobotStatus[] = [
  "emergency_stop",
  "error",
  "offline",
  "paused",
  "returning",
  "working",
  "charging",
  "idle",
];

export const ROBOT_SORTS = ["name", "battery", "status", "lastSeen"] as const;
export type RobotSort = (typeof ROBOT_SORTS)[number];

const COMPARATORS: Record<RobotSort, (a: RobotSummary, b: RobotSummary) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  battery: (a, b) => a.state.battery - b.state.battery,
  status: (a, b) => STATUS_PRIORITY.indexOf(a.state.status) - STATUS_PRIORITY.indexOf(b.state.status),
  lastSeen: (a, b) => a.state.ts.localeCompare(b.state.ts),
};

export interface PageQuery {
  limit: number;
  cursor?: string;
}

// ---------------------------------------------------------------------------------------------
// Sites and fleet
// ---------------------------------------------------------------------------------------------

export function listSites(): { items: SiteSummary[] } {
  const sim = getSimulation();
  return { items: SITES.map(({ site }) => siteSummary(sim, site)) };
}

export function getSite(siteId: string): SiteDetail {
  const entry = SITES.find(({ site }) => site.id === siteId);
  if (!entry) {
    throw ApiError.notFound(`Site ${siteId} not found`);
  }
  return { ...siteSummary(getSimulation(), entry.site), map: entry.map };
}

export function fleetSummary(siteId?: string): FleetSummary {
  const sim = getSimulation();
  const robots = robotsAt(sim, siteId);
  const batteries = robots.filter((r) => !r.offline).map((r) => r.reported.battery);
  const openAlerts = robots.flatMap((r) => [...r.openAlerts.values()]);
  const since = Date.now() - HOUR_MS;
  const ended = sim.tasks.filter(
    (t) => t.endedAt && Date.parse(t.endedAt) >= since && (!siteId || t.siteId === siteId),
  );

  let samples = 0;
  let working = 0;
  for (const r of robots) {
    for (const sample of r.history) {
      if (sample.t < since) {
        continue;
      }
      samples++;
      if (sample.status === "working") {
        working++;
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    siteId: siteId ?? null,
    robots: { total: robots.length, online: batteries.length, byStatus: countStatuses(sim, robots) },
    battery: {
      average: batteries.length ? round(batteries.reduce((sum, b) => sum + b, 0) / batteries.length, 1) : 0,
      low: batteries.filter((b) => b < LOW_BATTERY).length,
      critical: batteries.filter((b) => b < CRITICAL_BATTERY).length,
    },
    alerts: {
      open: openAlerts.length,
      unacknowledged: openAlerts.filter((a) => a.status === "active").length,
      bySeverity: countBy<AlertSeverity>(
        openAlerts.map((a) => a.severity),
        ["critical", "warning"],
      ),
    },
    tasks: {
      inProgress: robots.filter((r) => r.task).length,
      completedLastHour: ended.filter((t) => t.status === "completed").length,
      failedLastHour: ended.filter((t) => t.status === "failed").length,
    },
    utilizationLastHour: samples ? round(working / samples, 3) : 0,
  };
}

// ---------------------------------------------------------------------------------------------
// Robots
// ---------------------------------------------------------------------------------------------

export function listRobots(query: {
  siteId?: string;
  status?: RobotStatus[];
  kind?: RobotKind[];
  q?: string;
  sort: RobotSort;
  order: "asc" | "desc";
  limit?: number;
  offset: number;
}): RobotList {
  const sim = getSimulation();
  const search = query.q?.trim().toLowerCase();
  const items = robotsAt(sim, query.siteId)
    .map((r) => robotSummary(sim, r))
    .filter(
      (robot) =>
        (!query.status || query.status.includes(robot.state.status)) &&
        (!query.kind || query.kind.includes(robot.model.kind)) &&
        (!search || [robot.id, robot.name, robot.serialNumber].some((value) => value.toLowerCase().includes(search))),
    );
  const direction = query.order === "desc" ? -1 : 1;
  items.sort((a, b) => direction * COMPARATORS[query.sort](a, b) || a.name.localeCompare(b.name));
  const end = query.limit === undefined ? undefined : query.offset + query.limit;
  return { items: items.slice(query.offset, end), total: items.length };
}

export function getRobot(robotId: string): RobotDetail {
  const sim = getSimulation();
  const r = sim.robot(robotId);
  const site = SITES.find(({ site }) => site.id === r.robot.siteId)!.site;
  const since = Date.now() - HOUR_MS;
  const samples = r.history.filter((s) => s.t >= since);
  const ended = sim.tasks.filter((t) => t.robotId === robotId && t.endedAt && Date.parse(t.endedAt) >= since);

  let distanceMeters = 0;
  let working = 0;
  samples.forEach((sample, i) => {
    if (sample.status === "working") {
      working++;
    }
    if (i > 0) {
      distanceMeters += Math.hypot(sample.x - samples[i - 1].x, sample.y - samples[i - 1].y);
    }
  });

  return {
    ...robotSummary(sim, r),
    site: { id: site.id, name: site.name, timezone: site.timezone },
    currentTask: r.task,
    openAlerts: [...r.openAlerts.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    lastHour: {
      tasksCompleted: ended.filter((t) => t.status === "completed").length,
      tasksFailed: ended.filter((t) => t.status === "failed").length,
      distanceMeters: Math.round(distanceMeters),
      uptime: round(Math.min(1, samples.length / (HOUR_MS / TICK_MS)), 3),
      utilization: samples.length ? round(working / samples.length, 3) : 0,
    },
  };
}

export function getTelemetry(robotId: string, range: TelemetryRange, maxPoints: number): TelemetrySeries {
  const r = getSimulation().robot(robotId);
  const to = Date.now();
  const from = to - RANGE_MS[range];
  const samples = r.history.filter((s) => s.t >= from);
  const stride = Math.max(1, Math.ceil(samples.length / maxPoints));
  const points: TelemetryPoint[] = [];
  // Walk back from the newest sample so the latest reading is always included.
  for (let i = samples.length - 1; i >= 0; i -= stride) {
    const { t, ...values } = samples[i];
    points.push({ ts: new Date(t).toISOString(), ...values });
  }
  return {
    robotId,
    range,
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString(),
    intervalSeconds: (stride * TICK_MS) / 1000,
    points: points.reverse(),
  };
}

// ---------------------------------------------------------------------------------------------
// Feeds
// ---------------------------------------------------------------------------------------------

export function listTasks(query: { siteId?: string; robotId?: string; status?: TaskStatus[] } & PageQuery): Page<Task> {
  return paginate(
    getSimulation().tasks,
    (t) => matchesScope(t, query) && (!query.status || query.status.includes(t.status)),
    query,
  );
}

export function listEvents(
  query: { siteId?: string; robotId?: string; type?: RobotEventType[] } & PageQuery,
): Page<RobotEvent> {
  return paginate(
    getSimulation().events,
    (e) => matchesScope(e, query) && (!query.type || query.type.includes(e.type)),
    query,
  );
}

export function listAlerts(
  query: {
    siteId?: string;
    robotId?: string;
    status?: AlertStatus[];
    severity?: AlertSeverity[];
    type?: AlertType[];
  } & PageQuery,
): Page<Alert> {
  return paginate(
    getSimulation().alerts,
    (a) =>
      matchesScope(a, query) &&
      (!query.status || query.status.includes(a.status)) &&
      (!query.severity || query.severity.includes(a.severity)) &&
      (!query.type || query.type.includes(a.type)),
    query,
  );
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

function robotsAt(sim: Simulation, siteId?: string): SimRobot[] {
  const robots = [...sim.robots.values()];
  return siteId ? robots.filter((r) => r.robot.siteId === siteId) : robots;
}

function robotSummary(sim: Simulation, r: SimRobot): RobotSummary {
  const alerts = [...r.openAlerts.values()];
  const highestSeverity = alerts.some((a) => a.severity === "critical") ? "critical" : alerts.length ? "warning" : null;
  return { ...r.robot, state: sim.stateOf(r), alerts: { open: alerts.length, highestSeverity } };
}

function siteSummary(sim: Simulation, site: Site): SiteSummary {
  const robots = robotsAt(sim, site.id);
  return {
    ...site,
    robotCount: robots.length,
    byStatus: countStatuses(sim, robots),
    openAlerts: robots.reduce((sum, r) => sum + r.openAlerts.size, 0),
  };
}

function countStatuses(sim: Simulation, robots: SimRobot[]) {
  return countBy<RobotStatus>(
    robots.map((r) => sim.stateOf(r).status),
    ROBOT_STATUSES,
  );
}

function countBy<K extends string>(values: K[], keys: readonly K[]): Record<K, number> {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
  for (const value of values) {
    counts[value]++;
  }
  return counts;
}

function matchesScope(item: { siteId: string; robotId: string }, scope: { siteId?: string; robotId?: string }) {
  return (!scope.siteId || item.siteId === scope.siteId) && (!scope.robotId || item.robotId === scope.robotId);
}

/** Newest-first page over an append-only list whose ids end in an increasing sequence number ("evt-42"). */
function paginate<T extends { id: string }>(
  items: readonly T[],
  matches: (item: T) => boolean,
  { limit, cursor }: PageQuery,
): Page<T> {
  const before = cursor === undefined ? Infinity : sequenceOf(cursor);
  if (Number.isNaN(before)) {
    throw ApiError.badRequest(`Invalid cursor "${cursor}"`);
  }
  const page: T[] = [];
  for (let i = items.length - 1; i >= 0 && page.length <= limit; i--) {
    if (sequenceOf(items[i].id) < before && matches(items[i])) {
      page.push(items[i]);
    }
  }
  const hasMore = page.length > limit;
  if (hasMore) {
    page.pop();
  }
  return { items: page, nextCursor: hasMore ? page[page.length - 1].id : null };
}

const sequenceOf = (id: string) => (/^[a-z]+-\d+$/.test(id) ? Number(id.slice(id.indexOf("-") + 1)) : NaN);

const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;
