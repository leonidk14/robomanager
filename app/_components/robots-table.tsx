import { AlertsBadge } from "@/components/robots/alerts-badge";
import { BatteryIndicator } from "@/components/robots/battery-indicator";
import { FirmwareCell } from "@/components/robots/firmware-cell";
import { RobotStatusBadge } from "@/components/robots/robot-status-badge";
import { TaskCell } from "@/components/robots/task-cell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { RobotSummary } from "@/lib/api/types";
import type { SiteOption } from "@/lib/data/robots";
import { formatRelative, formatSiteTime, KIND_PRESENTATION } from "@/lib/robots/presentation";

import { ROBOT_COLUMNS } from "./robots-columns";
import { SortableHead } from "./sortable-head";

/** Read-only overview: rows have no links or actions. Rendered on the server; only the sort headers are interactive. */
export function RobotsTable({
  robots,
  sites,
  fetchedAt,
}: {
  robots: RobotSummary[];
  sites: SiteOption[];
  fetchedAt: string;
}) {
  const siteById = new Map(sites.map((site) => [site.id, site]));

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {ROBOT_COLUMNS.map((column) =>
              column.sort ? (
                <SortableHead key={column.key} sort={column.sort}>
                  {column.label}
                </SortableHead>
              ) : (
                <TableHead key={column.key}>{column.label}</TableHead>
              ),
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {robots.map((robot) => {
            const site = siteById.get(robot.siteId);
            const kind = KIND_PRESENTATION[robot.model.kind];
            return (
              <TableRow key={robot.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{robot.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{robot.serialNumber}</span>
                  </div>
                </TableCell>
                <TableCell>{site?.name ?? robot.siteId}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <kind.icon className="size-4 text-muted-foreground" aria-hidden />
                    <div className="flex flex-col">
                      <span>{robot.model.name}</span>
                      <span className="text-xs text-muted-foreground">{kind.label}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <RobotStatusBadge status={robot.state.status} errorCode={robot.state.errorCode} />
                </TableCell>
                <TableCell>
                  <BatteryIndicator battery={robot.state.battery} status={robot.state.status} />
                </TableCell>
                <TableCell>
                  <TaskCell task={robot.state.task} status={robot.state.status} />
                </TableCell>
                <TableCell>
                  <AlertsBadge alerts={robot.alerts} />
                </TableCell>
                <TableCell>
                  <FirmwareCell version={robot.firmwareVersion} />
                </TableCell>
                <TableCell>
                  <Tooltip>
                    <TooltipTrigger>
                      <time dateTime={robot.state.ts}>{formatRelative(robot.state.ts, fetchedAt)}</time>
                    </TooltipTrigger>
                    <TooltipContent>{formatSiteTime(robot.state.ts, site?.timezone ?? "UTC")}</TooltipContent>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
