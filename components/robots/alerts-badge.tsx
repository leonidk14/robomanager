import { CircleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { RobotSummary } from "@/lib/api/types";

export function AlertsBadge({ alerts }: { alerts: RobotSummary["alerts"] }) {
  if (!alerts.open) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <Badge variant={alerts.highestSeverity === "critical" ? "destructive" : "secondary"}>
      <CircleAlert data-icon="inline-start" aria-hidden />
      {alerts.open}
      <span className="sr-only">
        {alerts.open === 1 ? " open alert" : " open alerts"}, highest severity {alerts.highestSeverity}
      </span>
    </Badge>
  );
}
