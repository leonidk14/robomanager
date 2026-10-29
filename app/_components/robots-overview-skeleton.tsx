import { Skeleton } from "@/components/ui/skeleton";

import { RobotsTableSkeleton } from "./robots-table-skeleton";

export function RobotsOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-full sm:w-64" />
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="ml-auto h-8 w-24" />
      </div>
      <RobotsTableSkeleton />
    </div>
  );
}
