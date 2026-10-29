"use client";

import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

import { useRobotFilters } from "./robots-filters-provider";

/** Shown for filters without matches, invalid URL params and pages past the end alike. */
export function RobotsEmpty() {
  const { resetFilters } = useRobotFilters();

  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchX />
        </EmptyMedia>
        <EmptyTitle>No robots match these filters</EmptyTitle>
        <EmptyDescription>Change the filters or reset them to see all robots.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" onClick={resetFilters}>
          Reset filters
        </Button>
      </EmptyContent>
    </Empty>
  );
}
