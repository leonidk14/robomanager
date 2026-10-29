import "server-only";

import { connection, type NextRequest } from "next/server";
import { ApiError } from "./errors";
import type { PageQuery } from "./queries";

/**
 * Wraps a mock API handler: renders it per request (the data is live), injects artificial latency and
 * failures, and turns thrown ApiErrors into JSON error responses.
 */
export function route<Context>(handler: (request: NextRequest, context: Context) => Response | Promise<Response>) {
  return async (request: NextRequest, context: Context): Promise<Response> => {
    await connection();
    try {
      await injectChaos(request.nextUrl.searchParams);
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ApiError) return error.toResponse();
      console.error("[mock-backend]", error);
      return new ApiError(500, "internal_error", "Unexpected mock backend error").toResponse();
    }
  };
}

/**
 * For exercising loading and error states: `?_latency=800` or `?_latency=200-1500` (ms) delays the response,
 * `?_fail=0.3` fails 30 % of requests with 503. MOCK_LATENCY_MS and MOCK_FAIL_RATE apply the same to every request.
 */
async function injectChaos(params: URLSearchParams) {
  const latency = params.get("_latency") ?? process.env.MOCK_LATENCY_MS;
  if (latency) {
    const [min, max = min] = latency.split("-").map(Number);
    const ms = min + Math.random() * (max - min);
    if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
  }
  const failRate = Number(params.get("_fail") ?? process.env.MOCK_FAIL_RATE ?? 0);
  if (Math.random() < failRate) throw new ApiError(503, "unavailable", "Injected failure (_fail / MOCK_FAIL_RATE)");
}

export function expectOneOf<T extends string>(value: unknown, name: string, allowed: readonly T[]): T {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) return value as T;
  throw ApiError.badRequest(`Invalid ${name} ${JSON.stringify(value)}, expected one of: ${allowed.join(", ")}`);
}

export function oneOf<T extends string>(params: URLSearchParams, name: string, allowed: readonly T[]): T | undefined {
  const value = params.get(name);
  return value ? expectOneOf(value, name, allowed) : undefined;
}

/** Comma-separated list, e.g. `?status=error,offline`. */
export function listOf<T extends string>(params: URLSearchParams, name: string, allowed: readonly T[]): T[] | undefined {
  const value = params.get(name);
  return value ? value.split(",").map((item) => expectOneOf(item.trim(), name, allowed)) : undefined;
}

export function integer(params: URLSearchParams, name: string, min: number, max: number): number | undefined {
  const raw = params.get(name);
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw ApiError.badRequest(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

export function pageQuery(params: URLSearchParams): PageQuery {
  return { limit: integer(params, "limit", 1, 200) ?? 50, cursor: params.get("cursor") ?? undefined };
}

/** Parses an optional JSON object body; an empty body reads as `{}`. */
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text) return {};
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw ApiError.badRequest("Body must be valid JSON");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw ApiError.badRequest("Body must be a JSON object");
  }
  return body as Record<string, unknown>;
}
