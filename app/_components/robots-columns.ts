import type { RobotSort } from "@/lib/api/types";

/** Columns of the robots table, shared by the table and its skeleton. `sort` marks the server-sortable ones. */
export const ROBOT_COLUMNS: { key: string; label: string; sort?: RobotSort }[] = [
  { key: "robot", label: "Robot", sort: "name" },
  { key: "site", label: "Site" },
  { key: "model", label: "Model" },
  { key: "status", label: "Status", sort: "status" },
  { key: "battery", label: "Battery", sort: "battery" },
  { key: "task", label: "Current task" },
  { key: "alerts", label: "Alerts" },
  { key: "firmware", label: "Firmware" },
  { key: "lastSeen", label: "Last seen", sort: "lastSeen" },
];
