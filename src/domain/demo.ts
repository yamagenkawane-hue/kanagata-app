import { PLATE_NAMES } from "./plates.ts";
import { DEFAULT_BOM_CATEGORIES } from "./bom-categories.ts";
import { PROCESSES, addDays, at, renumber, schedule } from "./planning.ts";
import type { PlanData, Task } from "./planning.ts";

export function createDemo(): PlanData {
  const products = [
    { id: "p1", name: "ハウジング金型", customer: "東海精密工業（デモ）", dueDate: "2026-10-08", notes: "外観部の仕上がりを重点確認" },
    { id: "p2", name: "コネクター金型", customer: "山川部品（デモ）", dueDate: "2026-10-09", notes: "試作向け" },
    { id: "p3", name: "ブラケット金型", customer: "中央製作所（デモ）", dueDate: "2026-10-12", notes: "" },
  ];
  const parts = [
    { id: "a1", productId: "p1", name: "キャビティ", quantity: 1, drawingNumber: "DEMO-101" },
    { id: "a2", productId: "p1", name: "コア", quantity: 1, drawingNumber: "DEMO-102" },
    { id: "a3", productId: "p2", name: "固定側入子", quantity: 2, drawingNumber: "DEMO-201" },
    { id: "a4", productId: "p2", name: "可動側入子", quantity: 2, drawingNumber: "DEMO-202" },
    { id: "a5", productId: "p3", name: "パンチプレート", quantity: 1, drawingNumber: "DEMO-301" },
  ];
  const equipment = PROCESSES.flatMap((process, index) => Array.from({ length: index === 2 ? 4 : index < 3 ? 2 : 1 }, (_, machine) => ({ id: `${process.code}-${machine + 1}`, name: `${["MC", "研磨", "WIRE", "型組台", "トライ機"][index]}-${String(machine + 1).padStart(2, "0")}`, process: process.code })));
  const workers = ["田中", "佐藤", "鈴木", "高橋", "山本", "伊藤", "渡辺", "中村", "小林", "加藤"].map((name, index) => ({ id: `w${index + 1}`, name: `${name}（デモ）` }));
  const calendar: Record<string, boolean> = {};
  for (let index = -7; index < 120; index++) {
    const day = addDays("2026-09-30", index); const weekday = new Date(`${day}T12:00:00+09:00`).getUTCDay();
    calendar[day] = weekday !== 0 && weekday !== 6;
  }
  let tasks: Task[] = parts.flatMap((part, partIndex) => PROCESSES.map((process, index) => ({
    id: `${part.id}-${process.code}`, partId: part.id, process: process.code,
    equipmentId: `${process.code}-${index < 3 ? partIndex % 2 + 1 : 1}`, workerId: `w${(partIndex + index) % 10 + 1}`,
    duration: [240, 120, 180, 90, 60][index] + (partIndex % 2 ? 30 : 0), earliestStart: at("2026-09-30", 530),
    priority: partIndex + 1, status: "pending" as const, overnight: partIndex === 2 && index < 3,
    breakRun: false, fixed: false, plannedStart: "", plannedEnd: "", segments: [],
  })));
  for (const machine of equipment) tasks = renumber(tasks, machine.id);
  const bom = parts.map((part) => ({ id: `bom-${part.id}`, productId: part.productId, name: part.name, kind: part.id === "a5" ? "plate" as const : "part" as const, quantity: part.quantity, notes: "確認用サンプル", processes: PROCESSES.map((process) => process.code), archived: false }));
  const bomNames=[...PLATE_NAMES.map((name,index)=>({id:`plate-name-${index}`,categoryId:DEFAULT_BOM_CATEGORIES[0].id,name,active:true})),...bom.map(item=>({id:`name-${item.id}`,categoryId:DEFAULT_BOM_CATEGORIES.find(c=>c.kind===item.kind)!.id,name:item.name,active:true}))];
  const data: PlanData = { bomNames, categories:DEFAULT_BOM_CATEGORIES, products, bom, parts: parts.map(part => ({...part,bomId:`bom-${part.id}`,processes:PROCESSES.map(process=>process.code)})), equipment, workers, tasks, logs: [], calendar, revision: 1 };
  data.tasks = schedule(data);
  data.tasks = data.tasks.map((task) => task.id === "a1-machining" ? { ...task, status: "completed", actualStart: task.plannedStart, actualEnd: task.plannedEnd } : task.id === "a1-grinding" ? { ...task, status: "running", actualStart: task.plannedStart } : task);
  for (const machine of equipment) data.tasks = renumber(data.tasks, machine.id);
  return data;
}
