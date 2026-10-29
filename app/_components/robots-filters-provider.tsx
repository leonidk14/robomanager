"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, use, useOptimistic, useTransition, type ReactNode } from "react";

import { DEFAULT_ROBOT_FILTERS, serializeRobotSearchParams, type RobotFilters } from "@/lib/robots/search-params";

interface RobotFiltersContextValue {
  /** Current filters, already reflecting a navigation that is still in flight. */
  filters: RobotFilters;
  /** The URL has filter params (valid or not), so there is something to reset. */
  hasParams: boolean;
  /** A filter change or refresh is waiting for the server. */
  isPending: boolean;
  /** Applies a change. Anything other than a page change starts again from page 1. */
  setFilters: (patch: Partial<RobotFilters>) => void;
  resetFilters: () => void;
  refresh: () => void;
}

const RobotFiltersContext = createContext<RobotFiltersContextValue | null>(null);

/**
 * URL-driven state of the robots list. The server parses the URL and renders the matching page; this provider writes
 * changes back to the URL. Values come from the server as props, so no `useSearchParams` (and no extra Suspense
 * boundary) is needed, and `useOptimistic` keeps the controls responsive until the new page arrives.
 */
export function RobotsFiltersProvider({
  filters: serverFilters,
  hasParams: serverHasParams,
  children,
}: {
  filters: RobotFilters;
  hasParams: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [filters, setOptimisticFilters] = useOptimistic(serverFilters);
  const [hasParams, setOptimisticHasParams] = useOptimistic(serverHasParams);

  const navigate = (next: RobotFilters) => {
    const query = serializeRobotSearchParams(next);
    startTransition(() => {
      setOptimisticFilters(next);
      setOptimisticHasParams(query !== "");
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  };

  const value: RobotFiltersContextValue = {
    filters,
    hasParams,
    isPending,
    setFilters: (patch) => navigate({ ...filters, page: 1, ...patch }),
    resetFilters: () => navigate(DEFAULT_ROBOT_FILTERS),
    refresh: () => startTransition(() => router.refresh()),
  };

  return <RobotFiltersContext value={value}>{children}</RobotFiltersContext>;
}

export function useRobotFilters(): RobotFiltersContextValue {
  const context = use(RobotFiltersContext);
  if (!context) {
    throw new Error("useRobotFilters must be used inside <RobotsFiltersProvider>");
  }
  return context;
}
