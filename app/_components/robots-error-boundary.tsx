"use client";

import { catchError, type ErrorInfo } from "next/error";

import { LoadError } from "./load-error";

/** Contains a failed robots load to the results area, so the toolbar above stays usable. */
export const RobotsErrorBoundary = catchError((_props: object, { error, retry }: ErrorInfo) => (
  <LoadError title="Couldn't load robots" error={error} onRetry={retry} />
));
