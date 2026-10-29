import { Suspense } from "react";

import { getRobots, getSites, type SiteOption } from "@/lib/data/robots";
import {
  parseRobotSearchParams,
  serializeRobotSearchParams,
  type RobotFilters,
  type SearchParamsRecord,
} from "@/lib/robots/search-params";

import { RobotsEmpty } from "./robots-empty";
import { RobotsErrorBoundary } from "./robots-error-boundary";
import { RobotsFiltersProvider } from "./robots-filters-provider";
import { RobotsPagination } from "./robots-pagination";
import { RobotsResults } from "./robots-results";
import { RobotsTable } from "./robots-table";
import { RobotsTableSkeleton } from "./robots-table-skeleton";
import { RobotsToolbar } from "./robots-toolbar";

export async function RobotsOverview({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const parsed = parseRobotSearchParams(await searchParams);
  const sites = await getSites();
  const unknownSite = parsed.filters.siteId !== null && !sites.some((site) => site.id === parsed.filters.siteId);
  const filters: RobotFilters = unknownSite ? { ...parsed.filters, siteId: null } : parsed.filters;
  const invalid = parsed.invalid || unknownSite;

  return (
    <RobotsFiltersProvider filters={filters} hasParams={parsed.hasParams}>
      <div className="flex flex-col gap-4">
        <RobotsToolbar sites={sites} />
        <RobotsResults>
          {/* Keyed by the query so a failed load is retried as soon as the filters change. */}
          <RobotsErrorBoundary key={serializeRobotSearchParams(filters)}>
            <Suspense fallback={<RobotsTableSkeleton />}>
              <RobotsData filters={filters} invalid={invalid} sites={sites} />
            </Suspense>
          </RobotsErrorBoundary>
        </RobotsResults>
      </div>
    </RobotsFiltersProvider>
  );
}

async function RobotsData({
  filters,
  invalid,
  sites,
}: {
  filters: RobotFilters;
  invalid: boolean;
  sites: SiteOption[];
}) {
  // An invalid URL shows no results instead of a guessed correction.
  if (invalid) {
    return <RobotsEmpty />;
  }

  const robots = await getRobots(filters);
  if (!robots.items.length) {
    return <RobotsEmpty />;
  }

  return (
    <div className="flex flex-col gap-4">
      <RobotsTable robots={robots.items} sites={sites} fetchedAt={robots.fetchedAt} />
      <RobotsPagination total={robots.total} />
    </div>
  );
}
