import { PROCESSES, type ProcessDefinition, type Task } from "./planning.ts";
import {ganttPeriod} from "./gantt-period.ts";

export type GanttRow = { key: string; track: number; tasks: Task[] };

// Called within one mold. Display packing never modifies plans or machine priorities.
export function ganttRows(tasks: Task[],processes:readonly ProcessDefinition[]=PROCESSES): GanttRow[] {
  const buckets = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = JSON.stringify([task.process, task.equipmentId || null, task.equipmentId ? null : task.pressNo ?? ""]);
    const bucket = buckets.get(key) ?? []; bucket.push(task); buckets.set(key, bucket);
  }
  const rows: GanttRow[] = [];
  const ordered = [...buckets].sort(([,a],[,b]) => processes.findIndex(p=>p.code===a[0].process)-PROCESSES.findIndex(p=>p.code===b[0].process));
  for (const [key, bucket] of ordered) {
    const tracks: GanttRow[] = [];
    for (const task of [...bucket].sort((a,b)=>Date.parse(ganttPeriod(a).start)-Date.parse(ganttPeriod(b).start)||a.id.localeCompare(b.id))) {
      let row = tracks.find(row=>Date.parse(ganttPeriod(row.tasks.at(-1)!).end)<=Date.parse(ganttPeriod(task).start));
      if (!row) { row = { key: `${key}-${tracks.length}`, track: tracks.length, tasks: [] }; tracks.push(row); }
      row.tasks.push(task);
    }
    rows.push(...tracks);
  }
  return rows;
}
