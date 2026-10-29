import { Suspense } from "react";

import { RobotsOverview } from "./_components/robots-overview";
import { RobotsOverviewSkeleton } from "./_components/robots-overview-skeleton";

export default function RobotsPage(props: PageProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Robots</h1>
        <p className="text-muted-foreground">Overview of all robots across sites.</p>
      </header>
      {/* Search params are read inside the boundary, so the heading and skeleton form the static shell. */}
      <Suspense fallback={<RobotsOverviewSkeleton />}>
        <RobotsOverview searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
