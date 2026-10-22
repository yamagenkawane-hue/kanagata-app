import { PROCESSES, type ProcessDefinition, type Task } from "./planning.ts";
import {ganttPeriod} from "./gantt-period.ts";

export type GanttRow = { key: string; track: number; tasks: Task[] };

// One row per process/resource. Conflicts are resolved by explicit priority choice.
export function ganttRows(tasks: Task[],processes:readonly ProcessDefinition[]=PROCESSES): GanttRow[] {
  const buckets = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = JSON.stringify([task.process, task.equipmentId || null, task.equipmentId ? null : task.pressNo ?? ""]);
    const bucket = buckets.get(key) ?? []; bucket.push(task); buckets.set(key, bucket);
  }
  const rows: GanttRow[] = [];
  const ordered = [...buckets].sort(([,a],[,b]) => processes.findIndex(p=>p.code===a[0].process)-processes.findIndex(p=>p.code===b[0].process));
  for (const [key, bucket] of ordered) {
    rows.push({key:`${key}-0`,track:0,tasks:[...bucket].sort((a,b)=>Date.parse(ganttPeriod(a).start)-Date.parse(ganttPeriod(b).start)||a.id.localeCompare(b.id))});
  }
  return rows;
}
