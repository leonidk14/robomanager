import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { ROBOT_COLUMNS } from "./robots-columns";

export function RobotsTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div aria-busy="true" className="overflow-hidden rounded-md border">
      <span className="sr-only">Loading robots…</span>
      <Table>
        <TableHeader>
          <TableRow>
            {ROBOT_COLUMNS.map((column) => (
              <TableHead key={column.key}>{column.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(rows).keys()].map((row) => (
            <TableRow key={row}>
              {ROBOT_COLUMNS.map((column) => (
                <TableCell key={column.key} className="h-14">
                  <Skeleton className="h-4 w-20" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
