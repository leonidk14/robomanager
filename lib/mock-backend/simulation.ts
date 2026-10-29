import "server-only";

import {
  COMMAND_ALLOWED_STATUSES,
  type Alert,
  type AlertSeverity,
  type AlertType,
  type Command,
  type CommandType,
  type Robot,
  type RobotEvent,
  type RobotEventType,
  type RobotKind,
  type RobotState,
  type RobotStatus,
  type SiteMap,
  type StreamMessage,
  type Task,
  type TaskStatus,
  type TelemetryPoint,
  type Waypoint,
} from "@/lib/api/types";
import { ApiError } from "./errors";
import { ROBOTS, SITES, TASK_RULES } from "./fixtures";
import { between, chance, createRng, pick, type Rng } from "./random";

export const TICK_MS = 1000;
export const HISTORY_MS = 60 * 60 * 1000;
/** A robot that has not reported for this long is shown as offline. */
const OFFLINE_AFTER_MS = 5000;

export const LOW_BATTERY = 20;
export const CRITICAL_BATTERY = 10;
const OVERHEAT_C = 70;
const AMBIENT_C = 26;
const DWELL_MS = 6000; // loading / unloading
const ACCELERATION = 0.6; // m/s²

// Batteries are deliberately fast (a full charge lasts ~25 min of work) so charging cycles show up during a dev session.
const DRAIN_WORKING: Record<RobotKind, number> = { amr: 0.06, tugger: 0.05, forklift: 0.07 }; // % per second
const DRAIN_IDLE = 0.008;
const CHARGE_RATE = 0.3;

// Per robot per second. With 26 robots this gives an incident every couple of minutes.
const P_DISCONNECT = 1 / 15_000;
const P_OBSTACLE = 1 / 4_000;
const P_LOCALIZATION_LOST = 1 / 30_000;
const P_OVERHEAT = 1 / 20_000;
const P_BUMPER_CONTACT = 1 / 60_000;
const P_COMMAND_NOT_ACKNOWLEDGED = 0.03;

const MAX_TASKS = 5_000;
const MAX_EVENTS = 20_000;
const MAX_ALERTS = 2_000;

/** Misconfigured robots that go to charge too late, so they regularly raise low-battery alerts. */
const LATE_CHARGERS = new Set(["rbt-005", "rbt-014", "rbt-023"]);

const FAULTS = {
  LOCALIZATION_LOST: { alert: "localization_lost", status: "error", text: "lost localization" },
  BUMPER_CONTACT: { alert: "emergency_stop", status: "emergency_stop", text: "emergency stop: bumper contact" },
  REMOTE_ESTOP: { alert: "emergency_stop", status: "emergency_stop", text: "emergency stop by operator" },
} satisfies Record<string, { alert: AlertType; status: RobotStatus; text: string }>;
type FaultCode = keyof typeof FAULTS;

const STATUS_TEXT: Record<RobotStatus, string> = {
  working: "working",
  idle: "idle",
  returning: "returning to its dock",
  charging: "charging",
  paused: "paused",
  error: "in an error state",
  emergency_stop: "emergency-stopped",
  offline: "offline",
};

interface Point {
  x: number;
  y: number;
}

export type Sample = Omit<TelemetryPoint, "ts"> & { t: number };

/** Internal per-robot state. Only `stateOf()` and the history samples leave the simulation. */
export interface SimRobot {
  readonly robot: Robot;
  readonly home: Waypoint;
  status: Exclude<RobotStatus, "offline">;
  x: number;
  y: number;
  heading: number;
  speed: number;
  battery: number;
  temperature: number;
  signal: number;
  readonly baseSignal: number;
  /** Battery level at which the robot heads to its charger after the current task. */
  readonly returnThreshold: number;
  task: Task | null;
  stops: { pickup: Waypoint; dropoff: Waypoint } | null;
  /** Estimated task duration at start, to turn the remaining time into progress. */
  taskEstimateSec: number;
  /** End of the current loading/unloading, or of the idle wait before the next task. */
  waitUntil: number;
  resumeTo: "working" | "returning" | "idle" | null;
  errorCode: FaultCode | null;
  recoverAt: number | null;
  blockedUntil: number | null;
  overheatUntil: number | null;
  pendingCommand: Command | null;
  connected: boolean;
  reconnectAt: number;
  /** Set by the server side once the robot has been silent for OFFLINE_AFTER_MS. */
  offline: boolean;
  lastSeenAt: number;
  /** Last state the robot reported. */
  reported: RobotState;
  readonly openAlerts: Map<AlertType, Alert>;
  readonly history: Sample[];
}

type Listener = { onMessage: (message: StreamMessage) => void; onClose: () => void };

/**
 * In-memory fleet simulation. Robots pick tasks between waypoints, drain and charge their batteries and run
 * into random incidents; the simulation records tasks, alerts and events and pushes every change to subscribers.
 */
export class Simulation {
  readonly robots = new Map<string, SimRobot>();
  readonly tasks: Task[] = [];
  readonly events: RobotEvent[] = [];
  readonly alerts: Alert[] = [];
  /** Simulated time. Runs an hour behind while backfilling history, then follows the wall clock. */
  now: number;

  private lastTickAt: number;
  private seq = 0;
  private readonly rng: Rng;
  private readonly siteMaps = new Map<string, SiteMap>(SITES.map(({ site, map }) => [site.id, map]));
  private readonly listeners = new Set<Listener>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(seed: number) {
    this.rng = createRng(seed);
    const start = Date.now() - HISTORY_MS;
    this.now = this.lastTickAt = start;

    for (const robot of ROBOTS) {
      const home = this.siteMap(robot.siteId).waypoints.find((w) => w.id === robot.homeChargerId)!;
      const baseSignal = between(this.rng, -62, -45);
      const r: Omit<SimRobot, "reported"> = {
        robot,
        home,
        status: "idle",
        x: home.x,
        y: home.y,
        heading: 270,
        speed: 0,
        battery: between(this.rng, 35, 100),
        temperature: AMBIENT_C + between(this.rng, 0, 3),
        signal: baseSignal,
        baseSignal,
        returnThreshold: LATE_CHARGERS.has(robot.id) ? 16 : between(this.rng, 28, 34),
        task: null,
        stops: null,
        taskEstimateSec: 0,
        waitUntil: start + between(this.rng, 0, 20_000),
        resumeTo: null,
        errorCode: null,
        recoverAt: null,
        blockedUntil: null,
        overheatUntil: null,
        pendingCommand: null,
        connected: true,
        reconnectAt: 0,
        offline: false,
        lastSeenAt: start,
        openAlerts: new Map(),
        history: [],
      };
      this.robots.set(robot.id, { ...r, reported: describe(r) });
    }

    // Simulate the last hour up front so history, tasks and alerts exist from the first request.
    for (let t = start + TICK_MS; t <= Date.now(); t += TICK_MS) this.tick(t);
  }

  start() {
    this.interval ??= setInterval(() => this.tick(Date.now()), TICK_MS);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    for (const listener of this.listeners) listener.onClose();
    this.listeners.clear();
  }

  subscribe(onMessage: Listener["onMessage"], onClose: Listener["onClose"]) {
    const listener = { onMessage, onClose };
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  siteMap(siteId: string): SiteMap {
    const map = this.siteMaps.get(siteId);
    if (!map) throw ApiError.notFound(`Site ${siteId} not found`);
    return map;
  }

  robot(robotId: string): SimRobot {
    const r = this.robots.get(robotId);
    if (!r) throw ApiError.notFound(`Robot ${robotId} not found`);
    return r;
  }

  /** What the server knows about a robot: its last report, flagged offline once it has gone quiet. */
  stateOf(r: SimRobot): RobotState {
    return r.offline ? { ...r.reported, status: "offline" } : r.reported;
  }

  // -------------------------------------------------------------------------------------------
  // Operator actions
  // -------------------------------------------------------------------------------------------

  /** Validates and queues a command. The robot acknowledges it 0.3–1.5 s later; the outcome is streamed. */
  issueCommand(robotId: string, type: CommandType): Command {
    const r = this.robot(robotId);
    const blocker = commandBlocker(r, type);
    if (blocker) throw ApiError.conflict(blocker);
    if (r.pendingCommand && type !== "emergency_stop") {
      throw ApiError.conflict(`${r.robot.name} is still processing "${humanize(r.pendingCommand.type)}"`);
    }

    this.now = Date.now();
    const command: Command = {
      id: this.nextId("cmd"),
      robotId,
      type,
      status: "pending",
      issuedAt: iso(this.now),
      completedAt: null,
      error: null,
    };
    r.pendingCommand = command;
    this.event(r, "command_issued", `Operator sent "${humanize(type)}"`, { commandId: command.id });
    this.emit({ type: "command", data: command });
    this.later(between(this.rng, 300, 1500), () => this.executeCommand(r, command));
    return command;
  }

  acknowledgeAlert(alertId: string, by: string): Alert {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) throw ApiError.notFound(`Alert ${alertId} not found`);
    if (alert.status === "resolved") throw ApiError.conflict(`Alert ${alertId} is already resolved`);
    if (alert.status === "acknowledged") return alert;

    this.now = Date.now();
    alert.status = "acknowledged";
    alert.acknowledgedAt = iso(this.now);
    alert.acknowledgedBy = by;
    this.emit({ type: "alert", data: alert });
    return alert;
  }

  /** Dev tool: puts a robot into the condition behind an alert type right now. */
  injectFault(robotId: string, type: AlertType) {
    const r = this.robot(robotId);
    const name = r.robot.name;
    if (!r.connected) throw ApiError.conflict(`${name} is offline`);
    this.now = Date.now();

    switch (type) {
      case "robot_offline":
        r.connected = false;
        r.reconnectAt = this.now + 60_000;
        return;
      case "low_battery":
        if (r.status === "charging") throw ApiError.conflict(`${name} is charging`);
        r.battery = Math.min(r.battery, 15);
        break;
      case "obstacle_blocked":
        if (r.task?.phase !== "to_pickup" && r.task?.phase !== "to_dropoff") {
          throw ApiError.conflict(`${name} is not driving to a stop`);
        }
        this.block(r, 45_000);
        break;
      case "motor_overheat":
        r.overheatUntil = this.now + 240_000;
        r.temperature = Math.max(r.temperature, OVERHEAT_C + 5);
        break;
      case "localization_lost":
      case "emergency_stop":
        if (r.status === "error" || r.status === "emergency_stop") throw ApiError.conflict(`${name} is already stopped`);
        this.halt(r, type === "localization_lost" ? "LOCALIZATION_LOST" : "BUMPER_CONTACT", true);
        break;
    }
    this.checkThresholds(r);
    this.publish(r);
  }

  // -------------------------------------------------------------------------------------------
  // Simulation loop
  // -------------------------------------------------------------------------------------------

  private tick(now: number) {
    const dt = Math.min(Math.max(now - this.lastTickAt, 0), 5 * TICK_MS) / 1000;
    this.now = this.lastTickAt = now;
    const changed: RobotState[] = [];
    for (const r of this.robots.values()) {
      if (this.step(r, dt)) changed.push(this.stateOf(r));
    }
    if (changed.length > 0) this.emit({ type: "telemetry", data: { ts: iso(now), robots: changed } });
  }

  /** Advances one robot. Returns true if its public state changed (it reported, or just went offline). */
  private step(r: SimRobot, dt: number): boolean {
    if (r.connected && chance(this.rng, P_DISCONNECT * dt)) {
      r.connected = false;
      r.reconnectAt = this.now + between(this.rng, 15_000, 120_000);
    }

    if (!r.connected) {
      if (this.now < r.reconnectAt) {
        // Robots halt when they lose the fleet connection, so only the battery and motor change meanwhile.
        r.speed = 0;
        this.updateVitals(r, dt);
        if (r.offline || this.now - r.lastSeenAt < OFFLINE_AFTER_MS) return false;
        r.offline = true;
        this.event(r, "connection_lost", `${r.robot.name} stopped reporting`);
        this.raiseAlert(r, "robot_offline", "warning", `${r.robot.name} lost connection to the fleet server`);
        return true;
      }
      r.connected = true;
      if (r.offline) {
        r.offline = false;
        this.event(r, "connection_restored", `${r.robot.name} is back online`);
        this.resolveAlert(r, "robot_offline");
      }
    }

    this.behave(r, dt);
    this.updateVitals(r, dt);
    this.checkThresholds(r);
    this.report(r);
    const { status, battery, pose, speed, temperature, signal } = r.reported;
    append(r.history, { t: this.now, status, battery, ...pose, speed, temperature, signal }, HISTORY_MS / TICK_MS);
    return true;
  }

  private behave(r: SimRobot, dt: number) {
    switch (r.status) {
      case "error":
      case "emergency_stop":
        r.speed = 0;
        if (r.recoverAt !== null && this.now >= r.recoverAt) this.clearFault(r);
        break;
      case "paused":
        r.speed = 0;
        break;
      case "charging":
        r.speed = 0;
        if (r.battery >= 100) this.becomeIdle(r);
        break;
      case "returning":
        if (this.drive(r, r.home, dt)) this.setStatus(r, "charging");
        break;
      case "idle":
        r.speed = 0;
        if (r.battery < r.returnThreshold) this.setStatus(r, "returning");
        else if (this.now >= r.waitUntil) this.startTask(r);
        break;
      case "working":
        this.work(r, dt);
        break;
    }
  }

  private work(r: SimRobot, dt: number) {
    const task = r.task;
    const stops = r.stops;
    if (!task || !stops) return this.becomeIdle(r);

    if (r.blockedUntil !== null && this.now < r.blockedUntil) {
      r.speed = 0;
    } else {
      if (r.blockedUntil !== null) {
        r.blockedUntil = null;
        this.resolveAlert(r, "obstacle_blocked");
      }
      if (task.phase === "loading" || task.phase === "unloading") {
        r.speed = 0;
        if (this.now >= r.waitUntil) {
          if (task.phase === "unloading") {
            this.endTask(r, "completed");
            return this.becomeIdle(r);
          }
          task.phase = "to_dropoff";
        }
      } else if (this.drive(r, task.phase === "to_pickup" ? stops.pickup : stops.dropoff, dt)) {
        task.phase = task.phase === "to_pickup" ? "loading" : "unloading";
        r.waitUntil = this.now + DWELL_MS;
      } else if (chance(this.rng, P_OBSTACLE * dt)) {
        this.block(r, between(this.rng, 15_000, 60_000));
      }
    }
    this.updateProgress(r);

    if (r.battery < CRITICAL_BATTERY) {
      this.endTask(r, "failed", "Battery critically low");
      this.setStatus(r, "returning");
    } else if (chance(this.rng, P_LOCALIZATION_LOST * dt)) {
      this.halt(r, "LOCALIZATION_LOST", true);
    } else if (chance(this.rng, P_BUMPER_CONTACT * dt)) {
      this.halt(r, "BUMPER_CONTACT", true);
    } else if (r.overheatUntil === null && chance(this.rng, P_OVERHEAT * dt)) {
      r.overheatUntil = this.now + between(this.rng, 180_000, 360_000);
    }
  }

  /** Moves straight towards `target` without overshooting. Returns true on arrival. */
  private drive(r: SimRobot, target: Point, dt: number): boolean {
    const dx = target.x - r.x;
    const dy = target.y - r.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.01) {
      r.speed = 0;
      return true;
    }
    const cruise = r.robot.model.maxSpeed * (r.overheatUntil === null ? 0.9 : 0.45);
    r.speed = Math.min(cruise * between(this.rng, 0.95, 1), r.speed + ACCELERATION * dt, distance / dt);
    const step = r.speed * dt;
    r.x += (dx / distance) * step;
    r.y += (dy / distance) * step;
    r.heading = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    if (distance - step >= 0.01) return false;
    r.x = target.x;
    r.y = target.y;
    return true;
  }

  private updateVitals(r: SimRobot, dt: number) {
    if (r.status === "charging") {
      r.battery = Math.min(100, r.battery + CHARGE_RATE * dt);
    } else {
      const busy = r.status === "working" || r.status === "returning";
      r.battery = Math.max(0, r.battery - (busy ? DRAIN_WORKING[r.robot.model.kind] : DRAIN_IDLE) * dt);
    }

    if (r.overheatUntil !== null && this.now >= r.overheatUntil) r.overheatUntil = null;
    const load = r.speed / r.robot.model.maxSpeed;
    const targetTemperature = AMBIENT_C + 22 * load + (r.overheatUntil === null ? 0 : 48);
    r.temperature += (targetTemperature - r.temperature) * Math.min(1, 0.03 * dt) + between(this.rng, -0.15, 0.15);

    r.signal += (r.baseSignal - r.signal) * 0.1 + between(this.rng, -2.5, 2.5);
    r.signal = Math.min(-35, Math.max(-90, r.signal));
  }

  /** Raises, escalates and resolves the alerts that follow from battery level and temperature. */
  private checkThresholds(r: SimRobot) {
    const name = r.robot.name;
    const lowBattery = r.openAlerts.get("low_battery");
    if (r.status === "charging") {
      this.resolveAlert(r, "low_battery");
    } else if (lowBattery?.severity === "warning" && r.battery < CRITICAL_BATTERY) {
      lowBattery.severity = "critical";
      lowBattery.message = `${name} battery critically low (${Math.round(r.battery)} %)`;
      this.emit({ type: "alert", data: lowBattery });
    } else if (!lowBattery && r.battery < LOW_BATTERY) {
      const critical = r.battery < CRITICAL_BATTERY;
      const message = `${name} battery ${critical ? "critically low" : "low"} (${Math.round(r.battery)} %)`;
      this.raiseAlert(r, "low_battery", critical ? "critical" : "warning", message);
    }

    if (r.temperature > OVERHEAT_C) {
      const message = `${name} drive motor at ${Math.round(r.temperature)} °C, speed limited`;
      this.raiseAlert(r, "motor_overheat", "warning", message);
    } else if (r.temperature < OVERHEAT_C - 10) {
      this.resolveAlert(r, "motor_overheat");
    }
  }

  // -------------------------------------------------------------------------------------------
  // Tasks, faults, commands
  // -------------------------------------------------------------------------------------------

  private startTask(r: SimRobot) {
    const rule = TASK_RULES[r.robot.model.kind];
    const waypoints = this.siteMap(r.robot.siteId).waypoints;
    const pickup = pick(this.rng, waypoints.filter((w) => rule.from.includes(w.type)));
    const dropoff = pick(this.rng, waypoints.filter((w) => rule.to.includes(w.type) && w.id !== pickup.id));
    const task: Task = {
      id: this.nextId("tsk"),
      robotId: r.robot.id,
      siteId: r.robot.siteId,
      type: rule.type,
      status: "in_progress",
      phase: "to_pickup",
      pickup: { waypointId: pickup.id, name: pickup.name },
      dropoff: { waypointId: dropoff.id, name: dropoff.name },
      progress: 0,
      startedAt: iso(this.now),
      etaAt: null,
      endedAt: null,
      failureReason: null,
    };
    r.task = task;
    r.stops = { pickup, dropoff };
    r.taskEstimateSec = this.remainingSeconds(r);
    this.updateProgress(r);
    append(this.tasks, task, MAX_TASKS);
    this.event(r, "task_started", `Started ${humanize(task.type)}: ${pickup.name} → ${dropoff.name}`, { taskId: task.id });
    this.emit({ type: "task", data: task });
    this.setStatus(r, "working");
  }

  private endTask(r: SimRobot, status: Exclude<TaskStatus, "in_progress">, reason: string | null = null) {
    const task = r.task;
    if (!task) return;
    task.status = status;
    task.phase = null;
    task.etaAt = null;
    task.endedAt = iso(this.now);
    task.failureReason = reason;
    if (status === "completed") task.progress = 1;
    r.task = null;
    r.stops = null;
    r.blockedUntil = null;
    this.resolveAlert(r, "obstacle_blocked");
    const message = `${capitalize(humanize(task.type))} ${status}${reason ? `: ${reason}` : ""}`;
    this.event(r, `task_${status}`, message, { taskId: task.id });
    this.emit({ type: "task", data: task });
  }

  private updateProgress(r: SimRobot) {
    if (!r.task) return;
    const remaining = this.remainingSeconds(r);
    r.task.etaAt = iso(this.now + remaining * 1000);
    r.task.progress = round(Math.max(r.task.progress, 1 - remaining / r.taskEstimateSec), 3);
  }

  /** Rough time left on the current task at cruise speed, ignoring incidents. */
  private remainingSeconds(r: SimRobot): number {
    const { pickup, dropoff } = r.stops!;
    const cruise = r.robot.model.maxSpeed * 0.9;
    const dwell = DWELL_MS / 1000;
    const dwellLeft = Math.max(0, r.waitUntil - this.now) / 1000;
    const haul = distance(pickup, dropoff) / cruise;
    switch (r.task!.phase) {
      case "to_pickup":
        return distance(r, pickup) / cruise + haul + 2 * dwell;
      case "loading":
        return dwellLeft + haul + dwell;
      case "to_dropoff":
        return distance(r, dropoff) / cruise + dwell;
      default:
        return dwellLeft;
    }
  }

  private becomeIdle(r: SimRobot) {
    this.setStatus(r, "idle");
    r.waitUntil = this.now + between(this.rng, 2000, 8000);
  }

  private block(r: SimRobot, durationMs: number) {
    r.blockedUntil = this.now + durationMs;
    r.speed = 0;
    const destination = r.task?.phase === "to_pickup" ? r.task.pickup : r.task?.dropoff;
    this.raiseAlert(r, "obstacle_blocked", "warning", `${r.robot.name} is blocked on the way to ${destination?.name}`);
  }

  /** Stops the robot in a fault state and fails its task. */
  private halt(r: SimRobot, code: FaultCode, autoRecover: boolean) {
    const fault = FAULTS[code];
    r.speed = 0;
    r.errorCode = code;
    r.resumeTo = null;
    // Nobody walks over to reset robots in the simulation, so random faults clear themselves after a few minutes.
    r.recoverAt = autoRecover ? this.now + between(this.rng, 300_000, 480_000) : null;
    this.setStatus(r, fault.status);
    this.endTask(r, "failed", capitalize(fault.text));
    this.raiseAlert(r, fault.alert, "critical", `${r.robot.name} stopped: ${fault.text}`);
  }

  private clearFault(r: SimRobot) {
    r.errorCode = null;
    r.recoverAt = null;
    this.resolveAlert(r, "localization_lost");
    this.resolveAlert(r, "emergency_stop");
    this.becomeIdle(r);
  }

  private executeCommand(r: SimRobot, command: Command) {
    this.now = Date.now();
    if (r.pendingCommand === command) r.pendingCommand = null;
    const error =
      !r.connected || chance(this.rng, P_COMMAND_NOT_ACKNOWLEDGED)
        ? `${r.robot.name} did not acknowledge the command`
        : commandBlocker(r, command.type);

    if (!error) {
      switch (command.type) {
        case "pause":
          r.resumeTo = r.status as NonNullable<SimRobot["resumeTo"]>;
          r.speed = 0;
          this.setStatus(r, "paused");
          break;
        case "resume":
          this.setStatus(r, r.resumeTo ?? "idle");
          r.resumeTo = null;
          break;
        case "return_to_dock":
          r.resumeTo = null;
          this.endTask(r, "cancelled", "Recalled to dock by operator");
          this.setStatus(r, "returning");
          break;
        case "emergency_stop":
          this.halt(r, "REMOTE_ESTOP", false);
          break;
        case "reset":
          this.clearFault(r);
          break;
      }
    }

    command.status = error ? "failed" : "completed";
    command.completedAt = iso(this.now);
    command.error = error;
    const label = `"${humanize(command.type)}"`;
    this.event(r, error ? "command_failed" : "command_completed", error ? `${label} failed: ${error}` : `${label} completed`, {
      commandId: command.id,
    });
    this.emit({ type: "command", data: command });
    if (!error) this.publish(r);
  }

  // -------------------------------------------------------------------------------------------
  // Alerts, events, publishing
  // -------------------------------------------------------------------------------------------

  private raiseAlert(r: SimRobot, type: AlertType, severity: AlertSeverity, message: string) {
    if (r.openAlerts.has(type)) return;
    const alert: Alert = {
      id: this.nextId("alr"),
      type,
      severity,
      status: "active",
      robotId: r.robot.id,
      robotName: r.robot.name,
      siteId: r.robot.siteId,
      message,
      createdAt: iso(this.now),
      acknowledgedAt: null,
      acknowledgedBy: null,
      resolvedAt: null,
    };
    r.openAlerts.set(type, alert);
    append(this.alerts, alert, MAX_ALERTS);
    this.emit({ type: "alert", data: alert });
    this.event(r, "alert_raised", message, { alertId: alert.id });
  }

  private resolveAlert(r: SimRobot, type: AlertType) {
    const alert = r.openAlerts.get(type);
    if (!alert) return;
    r.openAlerts.delete(type);
    alert.status = "resolved";
    alert.resolvedAt = iso(this.now);
    this.emit({ type: "alert", data: alert });
    this.event(r, "alert_resolved", `${capitalize(humanize(type))} resolved`, { alertId: alert.id });
  }

  private setStatus(r: SimRobot, status: SimRobot["status"]) {
    if (r.status === status) return;
    const from = r.status;
    r.status = status;
    this.event(r, "status_changed", `Status changed: ${humanize(from)} → ${humanize(status)}`, {
      fromStatus: from,
      toStatus: status,
    });
  }

  private event(
    r: SimRobot,
    type: RobotEventType,
    message: string,
    refs: Pick<RobotEvent, "taskId" | "alertId" | "commandId" | "fromStatus" | "toStatus"> = {},
  ) {
    const event: RobotEvent = {
      id: this.nextId("evt"),
      ts: iso(this.now),
      robotId: r.robot.id,
      siteId: r.robot.siteId,
      type,
      message,
      ...refs,
    };
    append(this.events, event, MAX_EVENTS);
    this.emit({ type: "robot_event", data: event });
  }

  private report(r: SimRobot) {
    r.lastSeenAt = this.now;
    r.reported = describe(r);
  }

  /** Reports a robot outside the regular tick (after a command or injected fault) so clients see it at once. */
  private publish(r: SimRobot) {
    if (!r.connected) return;
    this.report(r);
    this.emit({ type: "telemetry", data: { ts: iso(this.now), robots: [this.stateOf(r)] } });
  }

  private emit(message: StreamMessage) {
    for (const listener of this.listeners) {
      try {
        listener.onMessage(message);
      } catch (error) {
        console.error("[mock-backend] stream listener failed", error);
      }
    }
  }

  private later(delayMs: number, fn: () => void) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      fn();
    }, delayMs);
    this.timers.add(timer);
  }

  private nextId(prefix: string) {
    return `${prefix}-${++this.seq}`;
  }
}

function commandBlocker(r: SimRobot, type: CommandType): string | null {
  if (r.offline) return `${r.robot.name} is offline`;
  if (COMMAND_ALLOWED_STATUSES[type].includes(r.status)) return null;
  return `"${humanize(type)}" is not possible while ${r.robot.name} is ${STATUS_TEXT[r.status]}`;
}

function describe(r: Omit<SimRobot, "reported">): RobotState {
  return {
    robotId: r.robot.id,
    ts: iso(r.lastSeenAt),
    status: r.status,
    battery: round(r.battery, 1),
    pose: { x: round(r.x, 2), y: round(r.y, 2), heading: round(r.heading, 1) },
    speed: round(r.speed, 2),
    temperature: round(r.temperature, 1),
    signal: Math.round(r.signal),
    task: r.task && {
      id: r.task.id,
      type: r.task.type,
      phase: r.task.phase!,
      progress: r.task.progress,
      etaAt: r.task.etaAt,
    },
    errorCode: r.errorCode,
  };
}

/** Appends and trims the oldest items in chunks, so the array stays bounded without shifting on every push. */
function append<T>(items: T[], item: T, limit: number) {
  items.push(item);
  if (items.length > limit * 1.1) items.splice(0, items.length - limit);
}

const iso = (ms: number) => new Date(ms).toISOString();
const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const humanize = (value: string) => value.replaceAll("_", " ");
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

// One simulation per server process, shared by every route handler and kept across dev hot reloads.
// Changes to this file therefore need a dev server restart (or POST /api/dev/reset) to take effect.
const globalStore = globalThis as typeof globalThis & { __robomanagerSimulation?: Simulation };

export function getSimulation(): Simulation {
  return (globalStore.__robomanagerSimulation ??= createSimulation());
}

export function resetSimulation(seed?: number): Simulation {
  globalStore.__robomanagerSimulation?.stop();
  return (globalStore.__robomanagerSimulation = createSimulation(seed));
}

function createSimulation(seed = Number(process.env.MOCK_SEED) || 42) {
  const simulation = new Simulation(seed);
  simulation.start();
  return simulation;
}
