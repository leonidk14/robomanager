import { CircleAlert } from "lucide-react";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function LoadError({ title, error, onRetry }: { title: string; error: unknown; onRetry: () => void }) {
  return (
    <Alert variant="destructive">
      <CircleAlert />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{error instanceof Error ? error.message : "Something went wrong."}</AlertDescription>
      <AlertAction>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </AlertAction>
    </Alert>
  );
}
