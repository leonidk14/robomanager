"use client";

import { BatteryLow, CircleAlert, RefreshCw, Search, TriangleAlert, X } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Toggle } from "@/components/ui/toggle";
import { ROBOT_KINDS, ROBOT_STATUSES } from "@/lib/api/types";
import type { SiteOption } from "@/lib/data/robots";
import { KIND_PRESENTATION, STATUS_PRESENTATION } from "@/lib/robots/presentation";

import { FacetedFilter } from "./faceted-filter";
import { useRobotFilters } from "./robots-filters-provider";

const SEARCH_DEBOUNCE_MS = 300;
const ALL_SITES = "all";

const STATUS_OPTIONS = ROBOT_STATUSES.map((status) => ({ value: status, ...STATUS_PRESENTATION[status] }));
const KIND_OPTIONS = ROBOT_KINDS.map((kind) => ({ value: kind, ...KIND_PRESENTATION[kind] }));

export function RobotsToolbar({ sites }: { sites: SiteOption[] }) {
  const { filters, setFilters, resetFilters, refresh, hasParams, isPending } = useRobotFilters();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchInput />
      <Select
        value={filters.siteId ?? ALL_SITES}
        onValueChange={(value) => setFilters({ siteId: value === ALL_SITES ? null : value })}
      >
        <SelectTrigger size="sm" aria-label="Site">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_SITES}>All sites</SelectItem>
          {sites.map((site) => (
            <SelectItem key={site.id} value={site.id}>
              {site.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FacetedFilter
        title="Status"
        options={STATUS_OPTIONS}
        selected={filters.status}
        onChange={(status) => setFilters({ status })}
      />
      <FacetedFilter
        title="Kind"
        options={KIND_OPTIONS}
        selected={filters.kind}
        onChange={(kind) => setFilters({ kind })}
      />
      <Toggle
        variant="outline"
        size="sm"
        pressed={filters.hasAlerts}
        onPressedChange={(hasAlerts) => setFilters({ hasAlerts })}
      >
        <CircleAlert data-icon="inline-start" />
        Open alerts
      </Toggle>
      <Toggle
        variant="outline"
        size="sm"
        pressed={filters.lowBattery}
        onPressedChange={(lowBattery) => setFilters({ lowBattery })}
      >
        <BatteryLow data-icon="inline-start" />
        Low battery
      </Toggle>
      <Toggle
        variant="outline"
        size="sm"
        pressed={filters.outdatedFirmware}
        onPressedChange={(outdatedFirmware) => setFilters({ outdatedFirmware })}
      >
        <TriangleAlert data-icon="inline-start" />
        Outdated firmware
      </Toggle>
      {hasParams && (
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          Reset
          <X data-icon="inline-end" />
        </Button>
      )}
      <Button variant="outline" size="sm" className="ml-auto" disabled={isPending} onClick={refresh}>
        {isPending ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
        Refresh
      </Button>
    </div>
  );
}

/** Keeps what the user types locally and applies it once they stop typing. */
function SearchInput() {
  const { filters, setFilters } = useRobotFilters();
  const [value, setValue] = useState(filters.q);
  const [syncedQ, setSyncedQ] = useState(filters.q);

  // Follow changes that don't come from typing here, e.g. Reset.
  if (filters.q !== syncedQ) {
    setSyncedQ(filters.q);
    if (filters.q !== value.trim()) {
      setValue(filters.q);
    }
  }

  // An Effect Event so the debounced update applies to the latest filters, not the ones from when typing started.
  const applySearch = useEffectEvent((q: string) => {
    if (q !== filters.q) {
      setFilters({ q });
    }
  });

  useEffect(() => {
    const timeout = setTimeout(() => applySearch(value.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [value]);

  return (
    <InputGroup className="w-full sm:w-64">
      <InputGroupInput
        type="search"
        placeholder="Search name, ID or serial…"
        aria-label="Search robots"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
    </InputGroup>
  );
}
