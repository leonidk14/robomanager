import { Progress } from "@/components/ui/progress";
import type { RobotStatus, TaskProgress } from "@/lib/api/types";
import { TASK_PHASE_LABELS, TASK_TYPE_LABELS } from "@/lib/robots/presentation";
import { cn } from "@/lib/utils";

export function TaskCell({ task, status }: { task: TaskProgress | null; status: RobotStatus }) {
  if (!task) {
    return <span className="text-muted-foreground">—</span>;
  }

  const percent = Math.round(task.progress * 100);
  const offline = status === "offline";

  return (
    <div className={cn("flex flex-col gap-1", offline && "text-muted-foreground")}>
      <span>
        {TASK_TYPE_LABELS[task.type]} <span className="text-muted-foreground">· {TASK_PHASE_LABELS[task.phase]}</span>
      </span>
      <div className="flex items-center gap-2">
        <Progress
          value={percent}
          aria-label="Task progress"
          className={cn("w-24", offline && "*:data-[slot=progress-indicator]:bg-muted-foreground")}
        />
        <span className="text-xs text-muted-foreground tabular-nums">{percent}%</span>
      </div>
    </div>
  );
}
