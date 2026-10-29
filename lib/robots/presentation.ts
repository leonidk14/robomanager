import {
  Activity,
  BatteryCharging,
  Clock,
  Forklift,
  OctagonX,
  Package,
  Pause,
  TriangleAlert,
  Truck,
  Undo2,
  WifiOff,
  type LucideIcon,
} from "lucide-react";

import type { RobotKind, RobotStatus, TaskPhase, TaskType } from "@/lib/api/types";

// Labels, badge variants and icons for robot data. Safe to import from client and server code.

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

/** Badge variant by severity: faults stand out, offline is the quietest. */
export const STATUS_PRESENTATION: Record<RobotStatus, { label: string; variant: BadgeVariant; icon: LucideIcon }> = {
  working: { label: "Working", variant: "default", icon: Activity },
  idle: { label: "Idle", variant: "secondary", icon: Clock },
  returning: { label: "Returning", variant: "secondary", icon: Undo2 },
  charging: { label: "Charging", variant: "secondary", icon: BatteryCharging },
  paused: { label: "Paused", variant: "secondary", icon: Pause },
  error: { label: "Error", variant: "destructive", icon: TriangleAlert },
  emergency_stop: { label: "Emergency stop", variant: "destructive", icon: OctagonX },
  offline: { label: "Offline", variant: "outline", icon: WifiOff },
};

export const KIND_PRESENTATION: Record<RobotKind, { label: string; icon: LucideIcon }> = {
  amr: { label: "AMR", icon: Package },
  tugger: { label: "Tugger", icon: Truck },
  forklift: { label: "Forklift", icon: Forklift },
};

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  tote_delivery: "Tote delivery",
  cart_tow: "Cart tow",
  pallet_move: "Pallet move",
};

export const TASK_PHASE_LABELS: Record<TaskPhase, string> = {
  to_pickup: "To pickup",
  loading: "Loading",
  to_dropoff: "To drop-off",
  unloading: "Unloading",
};

const UNITS: [limitSeconds: number, unitSeconds: number, suffix: string][] = [
  [60, 1, "s"],
  [60 * 60, 60, "min"],
  [24 * 60 * 60, 60 * 60, "h"],
  [Infinity, 24 * 60 * 60, "d"],
];

/** "just now", "45 s ago", "3 min ago", "2 h ago", "4 d ago". */
export function formatRelative(ts: string, now: string): string {
  const seconds = Math.max(0, (Date.parse(now) - Date.parse(ts)) / 1000);
  if (seconds < 10) {
    return "just now";
  }
  const [, unit, suffix] = UNITS.find(([limit]) => seconds < limit)!;
  return `${Math.floor(seconds / unit)} ${suffix} ago`;
}

/** Exact time in the site's timezone, e.g. "29 Oct 2026, 14:02:11 CET". */
export function formatSiteTime(ts: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone,
    timeZoneName: "short",
  }).format(new Date(ts));
}
