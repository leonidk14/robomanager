"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAGE_SIZES, type PageSize } from "@/lib/robots/search-params";

import { useRobotFilters } from "./robots-filters-provider";

export function RobotsPagination({ total }: { total: number }) {
  const { filters, setFilters, isPending } = useRobotFilters();
  const { page, pageSize } = filters;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
      <p className="text-muted-foreground">
        Showing {from}–{to} of {total} robots
      </p>
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <span>Rows per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => setFilters({ pageSize: Number(value) as PageSize })}
          >
            <SelectTrigger size="sm" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span>
          Page {page} of {pageCount}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous page"
            disabled={isPending || page <= 1}
            onClick={() => setFilters({ page: page - 1 })}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next page"
            disabled={isPending || page >= pageCount}
            onClick={() => setFilters({ page: page + 1 })}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
