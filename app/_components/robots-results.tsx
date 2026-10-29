"use client";

import type { ReactNode } from "react";

import { useRobotFilters } from "./robots-filters-provider";
import { RobotsTableSkeleton } from "./robots-table-skeleton";

/** Swaps the server-rendered results for skeleton rows while new data for a filter change or refresh is loading. */
export function RobotsResults({ children }: { children: ReactNode }) {
  const { isPending } = useRobotFilters();
  return isPending ? <RobotsTableSkeleton /> : children;
}
