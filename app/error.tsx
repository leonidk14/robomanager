"use client";

import { useEffect } from "react";

import { LoadError } from "./_components/load-error";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <LoadError title="Couldn't load the page" error={error} onRetry={retry} />
    </main>
  );
}
