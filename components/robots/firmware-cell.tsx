import { TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LATEST_FIRMWARE_VERSION } from "@/lib/api/types";

export function FirmwareCell({ version }: { version: string }) {
  if (version === LATEST_FIRMWARE_VERSION) {
    return <span className="tabular-nums">{version}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger aria-label={`Firmware ${version}, outdated`}>
        <Badge variant="outline">
          <TriangleAlert data-icon="inline-start" aria-hidden />
          {version}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>Latest is {LATEST_FIRMWARE_VERSION}</TooltipContent>
    </Tooltip>
  );
}
