import { PROCESSES, type Task } from "./planning.ts";

export type GanttRow = { key: string; track: number; tasks: Task[] };

// Called within one mold. Display packing never modifies plans or machine priorities.
export function ganttRows(tasks: Task[]): GanttRow[] {
  const buckets = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = JSON.stringify([task.process, task.equipmentId || null, task.equipmentId ? null : task.pressNo ?? ""]);
    const bucket = buckets.get(key) ?? []; bucket.push(task); buckets.set(key, bucket);
  }
  const rows: GanttRow[] = [];
  const ordered = [...buckets].sort(([,a],[,b]) => PROCESSES.findIndex(p=>p.code===a[0].process)-PROCESSES.findIndex(p=>p.code===b[0].process));
  for (const [key, bucket] of ordered) {
    const tracks: GanttRow[] = [];
    for (const task of [...bucket].sort((a,b)=>Date.parse(a.plannedStart)-Date.parse(b.plannedStart)||a.id.localeCompare(b.id))) {
      let row = tracks.find(row=>Date.parse(row.tasks.at(-1)!.plannedEnd)<=Date.parse(task.plannedStart));
      if (!row) { row = { key: `${key}-${tracks.length}`, track: tracks.length, tasks: [] }; tracks.push(row); }
      row.tasks.push(task);
    }
    rows.push(...tracks);
  }
  return rows;
}
