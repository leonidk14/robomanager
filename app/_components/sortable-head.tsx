"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { TableHead } from "@/components/ui/table";
import type { RobotSort } from "@/lib/api/types";

import { useRobotFilters } from "./robots-filters-provider";

export function SortableHead({ sort, children }: { sort: RobotSort; children: ReactNode }) {
  const { filters, setFilters } = useRobotFilters();
  const active = filters.sort === sort;
  const Icon = !active ? ArrowUpDown : filters.order === "asc" ? ArrowUp : ArrowDown;

  return (
    <TableHead aria-sort={active ? (filters.order === "asc" ? "ascending" : "descending") : "none"}>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2.5"
        onClick={() =>
          setFilters(active ? { order: filters.order === "asc" ? "desc" : "asc" } : { sort, order: "asc" })
        }
      >
        {children}
        <Icon data-icon="inline-end" aria-hidden className={active ? undefined : "text-muted-foreground"} />
      </Button>
    </TableHead>
  );
}
