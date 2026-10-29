import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { RobotStatus } from "@/lib/api/types";
import { STATUS_PRESENTATION } from "@/lib/robots/presentation";

export function RobotStatusBadge({ status, errorCode }: { status: RobotStatus; errorCode: string | null }) {
  const { label, variant, icon: Icon } = STATUS_PRESENTATION[status];
  const badge = (
    <Badge variant={variant}>
      <Icon data-icon="inline-start" aria-hidden />
      {label}
    </Badge>
  );

  if (!errorCode) {
    return badge;
  }
  return (
    <Tooltip>
      <TooltipTrigger aria-label={`${label}: ${errorCode}`}>{badge}</TooltipTrigger>
      <TooltipContent>{errorCode}</TooltipContent>
    </Tooltip>
  );
}
