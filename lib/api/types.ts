/**
 * Contract of the mock fleet API (endpoint reference: API_ENDPOINTS.md, local only). Safe to import from client and server code.
 *
 * Conventions:
 * - Timestamps are ISO 8601 strings (UTC).
 * - Map coordinates are metres from the top-left corner of the site map, x to the right, y down
 *   (same orientation as SVG). Headings are degrees clockwise from +x, so they work with SVG rotate().
 * - Speeds are m/s, temperatures °C, Wi-Fi signal is RSSI in dBm.
 */

// ---------------------------------------------------------------------------------------------
// Enumerations (exported as arrays too, for filters, selects and validation)
// ---------------------------------------------------------------------------------------------

export const ROBOT_STATUSES = [
  "working", // executing a task
  "idle", // online, waiting for a task
  "returning", // driving to its charger
  "charging",
  "paused", // paused by an operator
  "error", // fault that needs a reset, see RobotState.errorCode
  "emergency_stop",
  "offline", // no telemetry for a few seconds; other state fields are the last known values
] as const;
export type RobotStatus = (typeof ROBOT_STATUSES)[number];

export const ROBOT_KINDS = ["amr", "tugger", "forklift"] as const;
export type RobotKind = (typeof ROBOT_KINDS)[number];

export const TASK_TYPES = ["tote_delivery", "cart_tow", "pallet_move"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_STATUSES = ["in_progress", "completed", "failed", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type TaskPhase = "to_pickup" | "loading" | "to_dropoff" | "unloading";

export const ALERT_TYPES = [
  "low_battery",
  "robot_offline",
  "obstacle_blocked",
  "localization_lost",
  "motor_overheat",
  "emergency_stop",
] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_SEVERITIES = ["critical", "warning"] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

/** active → acknowledged (by an operator) → resolved (when the condition clears). */
export const ALERT_STATUSES = ["active", "acknowledged", "resolved"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const COMMAND_TYPES = ["pause", "resume", "return_to_dock", "emergency_stop", "reset"] as const;
export type CommandType = (typeof COMMAND_TYPES)[number];

/** Statuses in which the server accepts each command; anything else gets 409. Use it to enable/disable controls. */
export const COMMAND_ALLOWED_STATUSES: Record<CommandType, readonly RobotStatus[]> = {
  pause: ["working", "returning", "idle"],
  resume: ["paused"],
  return_to_dock: ["working", "idle", "paused"],
  emergency_stop: ["working", "idle", "returning", "charging", "paused", "error"],
  reset: ["error", "emergency_stop"],
};

export type CommandStatus = "pending" | "completed" | "failed";

export const ROBOT_EVENT_TYPES = [
  "status_changed",
  "task_started",
  "task_completed",
  "task_failed",
  "task_cancelled",
  "command_issued",
  "command_completed",
  "command_failed",
  "connection_lost",
  "connection_restored",
  "alert_raised",
  "alert_resolved",
] as const;
export type RobotEventType = (typeof ROBOT_EVENT_TYPES)[number];

export const TELEMETRY_RANGES = ["5m", "15m", "1h"] as const;
export type TelemetryRange = (typeof TELEMETRY_RANGES)[number];

// ---------------------------------------------------------------------------------------------
// Sites
// ---------------------------------------------------------------------------------------------

export interface Site {
  id: string;
  name: string;
  location: { city: string; country: string; lat: number; lng: number };
  /** IANA zone, for showing site-local times. */
  timezone: string;
}

export interface SiteSummary extends Site {
  robotCount: number;
  byStatus: Record<RobotStatus, number>;
  /** Alerts that are not resolved yet (active + acknowledged). */
  openAlerts: number;
}

export interface SiteDetail extends SiteSummary {
  map: SiteMap;
}

export type ZoneType = "inbound" | "outbound" | "storage" | "packing" | "charging" | "restricted";

export interface Zone {
  id: string;
  name: string;
  type: ZoneType;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type WaypointType = "dock" | "rack" | "station" | "charger";

export interface Waypoint {
  id: string;
  name: string;
  type: WaypointType;
  x: number;
  y: number;
}

export interface SiteMap {
  width: number;
  height: number;
  zones: Zone[];
  waypoints: Waypoint[];
}

// ---------------------------------------------------------------------------------------------
// Robots
// ---------------------------------------------------------------------------------------------

export interface RobotModel {
  id: string;
  name: string;
  kind: RobotKind;
  maxSpeed: number;
  maxPayloadKg: number;
  batteryCapacityKWh: number;
}

export interface Robot {
  id: string;
  name: string;
  serialNumber: string;
  siteId: string;
  model: RobotModel;
  firmwareVersion: string;
  commissionedAt: string;
  /** Waypoint id of the charger the robot returns to. */
  homeChargerId: string;
}

/**
 * Live state of a robot. The same shape is returned by REST (`RobotSummary.state`) and pushed by
 * the stream (`telemetry` / `snapshot`), so a client can replace it by `robotId`.
 */
export interface RobotState {
  robotId: string;
  /** When the robot last reported. Stops advancing while the robot is offline. */
  ts: string;
  status: RobotStatus;
  /** 0–100 % */
  battery: number;
  pose: { x: number; y: number; heading: number };
  speed: number;
  /** Drive motor temperature. */
  temperature: number;
  /** Wi-Fi RSSI, roughly -35 (excellent) to -90 (unusable). */
  signal: number;
  task: TaskProgress | null;
  /** Set for `error` and `emergency_stop`, e.g. LOCALIZATION_LOST, REMOTE_ESTOP, BUMPER_CONTACT. */
  errorCode: string | null;
}

export interface TaskProgress {
  id: string;
  type: TaskType;
  phase: TaskPhase;
  /** 0–1 */
  progress: number;
  etaAt: string | null;
}

export interface RobotSummary extends Robot {
  state: RobotState;
  alerts: { open: number; highestSeverity: AlertSeverity | null };
}

export interface RobotDetail extends RobotSummary {
  site: Pick<Site, "id" | "name" | "timezone">;
  currentTask: Task | null;
  /** Unresolved alerts, newest first. */
  openAlerts: Alert[];
  lastHour: RobotStats;
}

export interface RobotStats {
  tasksCompleted: number;
  tasksFailed: number;
  distanceMeters: number;
  /** Share of the hour the robot was online, 0–1. */
  uptime: number;
  /** Share of online time spent working, 0–1. */
  utilization: number;
}

export interface RobotList {
  items: RobotSummary[];
  /** Number of robots matching the filters, before limit/offset. */
  total: number;
}

// ---------------------------------------------------------------------------------------------
// Telemetry history
// ---------------------------------------------------------------------------------------------

export interface TelemetryPoint {
  ts: string;
  status: RobotStatus;
  battery: number;
  x: number;
  y: number;
  heading: number;
  speed: number;
  temperature: number;
  signal: number;
}

export interface TelemetrySeries {
  robotId: string;
  range: TelemetryRange;
  from: string;
  to: string;
  /** Approximate spacing between points after downsampling. */
  intervalSeconds: number;
  /** Oldest first. Periods when the robot was offline have no points. */
  points: TelemetryPoint[];
}

// ---------------------------------------------------------------------------------------------
// Tasks, alerts, events, commands
// ---------------------------------------------------------------------------------------------

export interface Task {
  id: string;
  robotId: string;
  siteId: string;
  type: TaskType;
  status: TaskStatus;
  /** null once the task has ended. */
  phase: TaskPhase | null;
  pickup: { waypointId: string; name: string };
  dropoff: { waypointId: string; name: string };
  progress: number;
  startedAt: string;
  etaAt: string | null;
  endedAt: string | null;
  failureReason: string | null;
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  robotId: string;
  robotName: string;
  siteId: string;
  message: string;
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
}

export interface RobotEvent {
  id: string;
  ts: string;
  robotId: string;
  siteId: string;
  type: RobotEventType;
  message: string;
  taskId?: string;
  alertId?: string;
  commandId?: string;
  fromStatus?: RobotStatus;
  toStatus?: RobotStatus;
}

export interface Command {
  id: string;
  robotId: string;
  type: CommandType;
  status: CommandStatus;
  issuedAt: string;
  completedAt: string | null;
  error: string | null;
}

// ---------------------------------------------------------------------------------------------
// Fleet summary
// ---------------------------------------------------------------------------------------------

export interface FleetSummary {
  generatedAt: string;
  siteId: string | null;
  robots: { total: number; online: number; byStatus: Record<RobotStatus, number> };
  /** Over online robots. `low` is below 20 %, `critical` below 10 %. */
  battery: { average: number; low: number; critical: number };
  alerts: { open: number; unacknowledged: number; bySeverity: Record<AlertSeverity, number> };
  tasks: { inProgress: number; completedLastHour: number; failedLastHour: number };
  /** Share of online robot-time spent working over the last hour, 0–1. */
  utilizationLastHour: number;
}

// ---------------------------------------------------------------------------------------------
// Envelopes
// ---------------------------------------------------------------------------------------------

/** Cursor-paginated list, newest first. Pass `nextCursor` as `?cursor=` to get older items. */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

// ---------------------------------------------------------------------------------------------
// Stream (GET /api/stream, Server-Sent Events). The SSE event name is `type`, the JSON payload is `data`.
// ---------------------------------------------------------------------------------------------

export type StreamMessage =
  /** First message on every (re)connect: current state of every subscribed robot. */
  | { type: "snapshot"; data: { serverTime: string; robots: RobotState[] } }
  /** Once per second: robots whose state changed (all online robots, plus a robot once when it goes offline). */
  | { type: "telemetry"; data: { ts: string; robots: RobotState[] } }
  /** Alert created or updated (escalated, acknowledged, resolved). Upsert by id. */
  | { type: "alert"; data: Alert }
  /** Task started or ended. Live progress comes through `telemetry` (RobotState.task). */
  | { type: "task"; data: Task }
  | { type: "robot_event"; data: RobotEvent }
  /** Command lifecycle: pending → completed | failed. */
  | { type: "command"; data: Command };

export type StreamEventType = StreamMessage["type"];
export type StreamPayload<T extends StreamEventType> = Extract<StreamMessage, { type: T }>["data"];
