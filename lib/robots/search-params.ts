import {
  ROBOT_KINDS,
  ROBOT_SORTS,
  ROBOT_STATUSES,
  type RobotKind,
  type RobotSort,
  type RobotStatus,
} from "@/lib/api/types";

// URL state of the robots list. Param names match `GET /api/robots`, so the same query works against the API.
// Safe to import from client and server code.

export const PAGE_SIZES = [10, 20, 50] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export const SORT_ORDERS = ["asc", "desc"] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

export interface RobotFilters {
  q: string;
  siteId: string | null;
  status: RobotStatus[];
  kind: RobotKind[];
  hasAlerts: boolean;
  lowBattery: boolean;
  outdatedFirmware: boolean;
  sort: RobotSort;
  order: SortOrder;
  /** 1-based. */
  page: number;
  pageSize: PageSize;
}

export const DEFAULT_ROBOT_FILTERS: RobotFilters = {
  q: "",
  siteId: null,
  status: [],
  kind: [],
  hasAlerts: false,
  lowBattery: false,
  outdatedFirmware: false,
  sort: "status",
  order: "asc",
  page: 1,
  pageSize: 20,
};

const PARAM_KEYS = Object.keys(DEFAULT_ROBOT_FILTERS) as (keyof RobotFilters)[];

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

export interface ParsedRobotSearchParams {
  /** Valid values from the URL; invalid ones fall back to their defaults. */
  filters: RobotFilters;
  /** Some known param had an invalid value. The list must then show no results instead of guessing. */
  invalid: boolean;
  /** The URL has at least one known param, valid or not. */
  hasParams: boolean;
}

/**
 * Strict parser: unknown values, repeated keys and malformed numbers mark the result invalid rather than being
 * dropped silently. Empty values count as absent (same as the API). Unknown keys are not ours and are ignored.
 */
export function parseRobotSearchParams(params: SearchParamsRecord): ParsedRobotSearchParams {
  const filters = { ...DEFAULT_ROBOT_FILTERS };
  let invalid = false;
  let hasParams = false;

  const read = (key: keyof RobotFilters): string | undefined => {
    const value = params[key];
    if (Array.isArray(value)) {
      hasParams = true;
      invalid = true;
      return undefined;
    }
    if (value) {
      hasParams = true;
    }
    return value || undefined;
  };

  const parse = <T>(key: keyof RobotFilters, parser: (value: string) => T | undefined): T | undefined => {
    const raw = read(key);
    if (raw === undefined) {
      return undefined;
    }
    const value = parser(raw);
    if (value === undefined) {
      invalid = true;
    }
    return value;
  };

  filters.q = read("q") ?? filters.q;
  filters.siteId = read("siteId") ?? filters.siteId;
  filters.status = parse("status", (raw) => parseList(raw, ROBOT_STATUSES)) ?? filters.status;
  filters.kind = parse("kind", (raw) => parseList(raw, ROBOT_KINDS)) ?? filters.kind;
  filters.hasAlerts = parse("hasAlerts", parseFlag) ?? filters.hasAlerts;
  filters.lowBattery = parse("lowBattery", parseFlag) ?? filters.lowBattery;
  filters.outdatedFirmware = parse("outdatedFirmware", parseFlag) ?? filters.outdatedFirmware;
  filters.sort = parse("sort", (raw) => parseOneOf(raw, ROBOT_SORTS)) ?? filters.sort;
  filters.order = parse("order", (raw) => parseOneOf(raw, SORT_ORDERS)) ?? filters.order;
  filters.page = parse("page", parsePage) ?? filters.page;
  filters.pageSize = parse("pageSize", parsePageSize) ?? filters.pageSize;

  return { filters, invalid, hasParams };
}

/** Query string without the leading `?`. Defaults are left out; lists keep their commas unescaped. */
export function serializeRobotSearchParams(filters: RobotFilters): string {
  const parts: string[] = [];
  for (const key of PARAM_KEYS) {
    const value = filters[key];
    const fallback = DEFAULT_ROBOT_FILTERS[key];
    if (Array.isArray(value)) {
      if (value.length) {
        parts.push(`${key}=${value.map(encodeURIComponent).join(",")}`);
      }
    } else if (value !== fallback && value !== null && value !== "") {
      parts.push(`${key}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.join("&");
}

function parseList<T extends string>(raw: string, allowed: readonly T[]): T[] | undefined {
  const values = raw.split(",");
  if (!values.every((value) => (allowed as readonly string[]).includes(value))) {
    return undefined;
  }
  // Canonical order, no duplicates.
  return allowed.filter((value) => values.includes(value));
}

function parseOneOf<T extends string>(raw: string, allowed: readonly T[]): T | undefined {
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : undefined;
}

function parseFlag(raw: string): true | undefined {
  return raw === "true" ? true : undefined;
}

function parsePage(raw: string): number | undefined {
  const page = Number(raw);
  return /^\d+$/.test(raw) && page >= 1 && Number.isSafeInteger(page) ? page : undefined;
}

function parsePageSize(raw: string): PageSize | undefined {
  return PAGE_SIZES.find((size) => String(size) === raw);
}
