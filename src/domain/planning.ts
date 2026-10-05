import { validDuration } from "./duration.ts";
export const PROCESSES = [
  { code: "machining", name: "マシニング", color: "#d4a23b", tint: "#fff2ca" },
  { code: "grinding", name: "自動研磨", color: "#38a578", tint: "#dbf3e5" },
  { code: "wire", name: "ワイヤー", color: "#358cb2", tint: "#dcf0fa" },
  { code: "assembly", name: "型組", color: "#8772bb", tint: "#ece5fa" },
  { code: "trial", name: "トライ", color: "#d1785b", tint: "#fae5dc" },
] as const;
export type ProcessCode = (typeof PROCESSES)[number]["code"];
export type TaskStatus = "pending" | "running" | "completed";
export type Segment = { start: string; end: string };
export type Product = { archived?: boolean; id: string; name: string; customer: string; dueDate: string; notes: string };
export type BomCategory = { id: string; name: string; kind: "plate" | "part"; active: boolean };
export type BomName = { id: string; categoryId: string; name: string; active: boolean };
export type BomItem = { categoryId?: string; id: string; productId: string; name: string; kind: "plate" | "part"; quantity: number; notes: string; processes: ProcessCode[]; archived: boolean };
export type Part = { bomId?: string; processes?: ProcessCode[]; archived?: boolean; id: string; productId: string; name: string; quantity: number; drawingNumber: string };
export type Equipment = { active?: boolean; id: string; name: string; process: ProcessCode };
export type Worker = { role?: "admin" | "operator"; active?: boolean; id: string; name: string };
export type Task = {
  id: string; partId: string; process: ProcessCode; equipmentId: string; workerId: string;
  duration: number; earliestStart: string; priority: number; status: TaskStatus;
  overnight: boolean; breakRun: boolean; fixed: boolean; manualOverride?: boolean;
  plannedStart: string; plannedEnd: string; segments: Segment[];
  actualStart?: string; actualEnd?: string;
};
export type WorkLog = {
  id: string; taskId: string; workerId: string; start: string; end: string;
  calculatedMinutes: number; overrideMinutes?: number; reason: string; breaks: [number, number][];
  editedBy: string;
};
export type PlanData = {
  bomNames?: BomName[]; categories?: BomCategory[]; today?: string; bom?: BomItem[]; needsRecalculation?: boolean; products: Product[]; parts: Part[]; equipment: Equipment[]; workers: Worker[];
  tasks: Task[]; logs: WorkLog[]; calendar: Record<string, boolean>; revision: number;
};
export const BREAKS: [number, number][] = [[720, 770], [900, 910]];
const MINUTE = 60_000;
export function dateKey(value: string | number | Date): string {
  const timestamp = value instanceof Date ? value.getTime() : typeof value === "number" ? value : new Date(value).getTime();
  return new Date(timestamp + 9 * 60 * MINUTE).toISOString().slice(0, 10);
}
export function at(date: string, minutes: number): string {
  return new Date(new Date(`${date}T00:00:00+09:00`).getTime() + minutes * MINUTE).toISOString();
}
export function addDays(date: string, count: number): string {
  return dateKey(new Date(`${date}T00:00:00+09:00`).getTime() + count * 1440 * MINUTE);
}
export function localInput(value: string): string {
  return new Date(new Date(value).getTime() + 9 * 60 * MINUTE).toISOString().slice(0, 16);
}
export function fromLocalInput(value: string): string {
  const result = new Date(`${value}:00+09:00`);
  if (!Number.isFinite(result.getTime())) throw new Error("日時を正しく入力してください。");
  return result.toISOString();
}
export function timeLabel(value: string): string { return localInput(value).slice(11); }
export function dateTimeLabel(value: string): string { const text = localInput(value); return `${text.slice(5, 10).replace("-", "/")} ${text.slice(11)}`; }
export function minutesLabel(minutes: number): string { return `${Math.floor(minutes / 60)}時間${minutes % 60 ? `${minutes % 60}分` : ""}`; }
export function overlaps(a: Segment, b: Segment): boolean {
  return new Date(a.start).getTime() < new Date(b.end).getTime() && new Date(b.start).getTime() < new Date(a.end).getTime();
}
export function calculateWorkMinutes(start: string, end: string, breaks: [number, number][] = BREAKS): number {
  const startMs = new Date(start).getTime(); const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) throw new Error("終了時刻は開始時刻より後にしてください。");
  if (endMs - startMs > 366 * 1440 * MINUTE) throw new Error("作業期間が長すぎます。");
  let deducted = 0;
  for (let day = dateKey(start); day <= dateKey(end); day = addDays(day, 1)) {
    for (const [from, to] of breaks) {
      deducted += Math.max(0, Math.min(endMs, new Date(at(day, to)).getTime()) - Math.max(startMs, new Date(at(day, from)).getTime()));
    }
  }
  return Math.round((endMs - startMs - deducted) / MINUTE);
}
export function workMinutesByDay(log: WorkLog): { date: string; minutes: number }[] {
  const result: { date: string; minutes: number }[] = [];
  for (let day = dateKey(log.start); day <= dateKey(log.end); day = addDays(day, 1)) {
    const start = Math.max(new Date(log.start).getTime(), new Date(at(day, 0)).getTime());
    const end = Math.min(new Date(log.end).getTime(), new Date(at(addDays(day, 1), 0)).getTime());
    if (end > start) result.push({ date: day, minutes: calculateWorkMinutes(new Date(start).toISOString(), new Date(end).toISOString(), log.breaks) });
  }
  return result;
}
function workingWindows(day: string, task: Task, calendar: PlanData["calendar"]): Segment[] {
  if (task.overnight) return [{ start: at(day, 0), end: at(addDays(day, 1), 0) }];
  if (!(day in calendar)) throw new Error(`${day} の会社カレンダーが未設定です。`);
  if (!calendar[day]) return [];
  const intervals = task.breakRun ? [[530, 1060]] : [[530, 720], [770, 900], [910, 1060]];
  return intervals.map(([start, end]) => ({ start: at(day, start), end: at(day, end) }));
}
function allocate(task: Task, startMs: number, calendar: PlanData["calendar"], busy: Segment[]): Segment[] {
  let candidate = startMs;
  for (let attempt = 0; attempt < 1000; attempt++) {
    let remaining = task.duration; const segments: Segment[] = []; let blockedUntil: number | undefined;
    for (let offset = 0; offset < 366 && remaining > 0; offset++) {
      const day = addDays(dateKey(candidate), offset);
      for (const window of workingWindows(day, task, calendar)) {
        const start = Math.max(candidate, new Date(window.start).getTime()); const limit = new Date(window.end).getTime();
        if (limit <= start) continue;
        const end = Math.min(limit, start + remaining * MINUTE);
        const segment = { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
        const conflict = busy.filter((item) => overlaps(item, segment)).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0];
        if (conflict) { blockedUntil = new Date(conflict.end).getTime(); break; }
        segments.push(segment); remaining -= (end - start) / MINUTE;
        if (remaining === 0) return segments;
      }
      if (blockedUntil !== undefined) break;
    }
    if (blockedUntil !== undefined) { candidate = Math.max(candidate + MINUTE, blockedUntil); continue; }
    throw new Error("計算可能な稼働日が足りません。会社カレンダーを確認してください。");
  }
  throw new Error("空き時間を見つけられません。設備の固定予定を確認してください。");
}
export function renumber(tasks: Task[], equipmentId: string): Task[] {
  const queue = tasks.filter((task) => task.equipmentId === equipmentId && task.status === "pending").sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  const ranks = new Map(queue.map((task, index) => [task.id, index + 1]));
  return tasks.map((task) => ranks.has(task.id) ? { ...task, priority: ranks.get(task.id)! } : task);
}
export function movePriority(tasks: Task[], taskId: string, rank: number): Task[] {
  const task = tasks.find((item) => item.id === taskId);
  if (!task || task.status !== "pending") throw new Error("順位を変更できるのは未着手タスクだけです。");
  if (!Number.isInteger(rank) || rank < 1) throw new Error("順位は1以上の整数で入力してください。");
  const queue = tasks.filter((item) => item.id !== taskId && item.equipmentId === task.equipmentId && item.status === "pending").sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  queue.splice(Math.min(rank - 1, queue.length), 0, task);
  const ranks = new Map(queue.map((item, index) => [item.id, index + 1]));
  return tasks.map((item) => ranks.has(item.id) ? { ...item, priority: ranks.get(item.id)! } : item);
}
export function schedule(data: PlanData): Task[] {
  const tasks = data.tasks.map((task) => ({ ...task, segments: task.segments.map((item) => ({ ...item })) }));
  const byId = new Map(tasks.map((task) => [task.id, task])); const dependencies = new Map(tasks.map((task) => [task.id, new Set<string>()]));
  for (const part of data.parts) {
    const required = part.processes ?? PROCESSES.map((process) => process.code);
    const chain = PROCESSES.filter((process) => required.includes(process.code)).map((process) => tasks.find((task) => task.partId === part.id && task.process === process.code));
    if (chain.some((item) => !item)) throw new Error(`${part.name} の必要工程をすべて登録してください。`);
    for (let index = 1; index < chain.length; index++) dependencies.get(chain[index]!.id)!.add(chain[index - 1]!.id);
  }
  for (const equipment of data.equipment) {
    const queue = tasks.filter((task) => task.equipmentId === equipment.id && task.status === "pending" && !(task.fixed && task.manualOverride)).sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
    for (let index = 1; index < queue.length; index++) dependencies.get(queue[index].id)!.add(queue[index - 1].id);
  }
  const busy = new Map(data.equipment.map((item) => [item.id, [] as Segment[]]));
  for (const task of tasks) {
    const equipment = data.equipment.find((item) => item.id === task.equipmentId);
    if (!equipment || equipment.process !== task.process) throw new Error("工程に対応する設備を選択してください。");
    if (!data.workers.some((worker) => worker.id === task.workerId)) throw new Error("担当者を選択してください。");
    if (task.status === "pending" && !validDuration(task.process,task.duration)) throw new Error("所要時間・日数を正しく入力してください（時間は30分単位）。");
    if (task.overnight && (task.process === "assembly" || task.process === "trial")) throw new Error("型組・トライは夜間稼働を指定できません。");
    if (task.fixed || task.status !== "pending") {
      if (!task.plannedStart || !task.plannedEnd) throw new Error("固定予定の開始・終了を指定してください。");
      busy.get(task.equipmentId)!.push(...(task.status === "completed" && task.actualStart && task.actualEnd ? [{ start: task.actualStart, end: task.actualEnd }] : task.segments.length ? task.segments : [{ start: task.plannedStart, end: task.plannedEnd }]));
    }
  }
  const processed = new Set<string>();
  while (processed.size < tasks.length) {
    const ready = tasks.filter((task) => !processed.has(task.id) && [...dependencies.get(task.id)!].every((id) => processed.has(id))).sort((a, b) => a.id.localeCompare(b.id));
    if (!ready.length) throw new Error("設備の順番と工程順が循環しています。優先順位を変更してください。");
    for (const task of ready) {
      const previous = [...dependencies.get(task.id)!].map((id) => byId.get(id)!);
      const ends = previous.map((item) => new Date(item.status === "completed" && item.actualEnd ? item.actualEnd : item.plannedEnd).getTime());
      const earliest = Math.max(new Date(task.earliestStart).getTime(), ...ends);
      if (!Number.isFinite(earliest)) throw new Error("開始日時を入力してください。");
      if (task.fixed && task.status === "pending" && earliest > new Date(task.plannedStart).getTime()) throw new Error("固定予定より前に先行工程を終えられません。固定を解除するか順位を変更してください。");
      if (!task.fixed && task.status === "pending") {
        task.segments = allocate(task, earliest, data.calendar, busy.get(task.equipmentId)!);
        task.plannedStart = task.segments[0].start; task.plannedEnd = task.segments.at(-1)!.end;
        busy.get(task.equipmentId)!.push(...task.segments);
      }
      processed.add(task.id);
    }
  }
  return tasks;
}
export function taskConflicts(tasks: Task[]): [string, string][] {
  const result: [string, string][] = [];
  for (let i = 0; i < tasks.length; i++) for (let j = i + 1; j < tasks.length; j++) {
    const a = tasks[i], b = tasks[j];
    const occupiedA = a.status === "completed" && a.actualStart && a.actualEnd ? [{ start: a.actualStart, end: a.actualEnd }] : a.segments; const occupiedB = b.status === "completed" && b.actualStart && b.actualEnd ? [{ start: b.actualStart, end: b.actualEnd }] : b.segments; if (a.equipmentId === b.equipmentId && occupiedA.some((segment) => occupiedB.some((other) => overlaps(segment, other)))) result.push([a.id, b.id]);
  }
  return result;
}


export function placeAtRequestedStart(task: Task, calendar: PlanData["calendar"]): Task {
  if (!validDuration(task.process,task.duration)) throw new Error("所要時間・日数を正しく入力してください（時間は30分単位）。");
  const startMs = new Date(task.earliestStart).getTime();
  if (!Number.isFinite(startMs)) throw new Error("開始日時を入力してください。");
  const segments = allocate(task, startMs, calendar, []);
  return { ...task, plannedStart: segments[0].start, plannedEnd: segments.at(-1)!.end, segments };
}
