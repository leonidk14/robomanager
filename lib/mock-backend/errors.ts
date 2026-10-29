import type { ApiErrorBody } from "@/lib/api/types";

/** Thrown anywhere in the mock backend; the route wrapper turns it into a JSON error response. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }

  static badRequest(message: string) {
    return new ApiError(400, "bad_request", message);
  }

  static notFound(message: string) {
    return new ApiError(404, "not_found", message);
  }

  static conflict(message: string) {
    return new ApiError(409, "conflict", message);
  }

  toResponse() {
    const body: ApiErrorBody = { error: { code: this.code, message: this.message } };
    return Response.json(body, { status: this.status });
  }
}
