import { BatteryCharging, BatteryLow } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { CRITICAL_BATTERY_PERCENT, LOW_BATTERY_PERCENT, type RobotStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export function BatteryIndicator({ battery, status }: { battery: number; status: RobotStatus }) {
  const percent = Math.round(battery);
  const offline = status === "offline";
  // Offline values are stale, so they stay muted instead of signalling urgency.
  const critical = !offline && battery < CRITICAL_BATTERY_PERCENT;

  return (
    <div className={cn("flex items-center gap-2", offline && "text-muted-foreground")}>
      <Progress
        value={percent}
        aria-label="Battery"
        className={cn(
          "w-16",
          critical && "bg-destructive/20 *:data-[slot=progress-indicator]:bg-destructive",
          offline && "*:data-[slot=progress-indicator]:bg-muted-foreground",
        )}
      />
      <span className={cn("w-9 text-right tabular-nums", critical && "text-destructive")}>{percent}%</span>
      {status === "charging" ? (
        <BatteryCharging className="size-4" aria-label="Charging" />
      ) : (
        battery < LOW_BATTERY_PERCENT && (
          <BatteryLow className={cn("size-4", critical && "text-destructive")} aria-label="Low battery" />
        )
      )}
    </div>
  );
}
