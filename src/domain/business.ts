import { z } from "zod";
import { PROCESSES, type PlanData } from "./planning.ts";
const processCode = z.enum(["machining", "grinding", "wire", "assembly", "trial"]);
const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value, "日付が不正です");
const instant = z.string().refine(value => Number.isFinite(Date.parse(value)), "日時が不正です");
const text = z.string().trim().min(1).max(120);
export const masterSchemas = {
 product: z.object({ id: uuid.optional(), name:text, customer:z.string().max(120), dueDate:date, notes:z.string().max(2000), archived:z.boolean() }),
 bom: z.object({ categoryId:uuid.optional(), id:uuid.optional(), productId:uuid, name:text, kind:z.enum(["plate","part"]), quantity:z.number().int().min(1).max(1000000), notes:z.string().max(2000), processes:z.array(processCode).min(1).max(5), archived:z.boolean() }),
 category: z.object({ id:uuid.optional(), name:text, kind:z.enum(["plate","part"]), active:z.boolean() }),
 bomName: z.object({ id:uuid.optional(), categoryId:uuid, name:text, active:z.boolean() }),
 equipment:z.object({ id:uuid.optional(), name:text, process:processCode, active:z.boolean() }),
 part:z.object({ id:uuid, name:text, quantity:z.number().int().positive(), archived:z.boolean() }),
 user:z.object({ id:uuid, name:text, role:z.enum(["admin","operator"]), active:z.boolean() }),
 calendar:z.object({ days:z.array(z.object({date,working:z.boolean(),label:z.string().max(120).optional()})).min(1).max(2000) }),
};
export const actualSchema = z.object({ id:uuid.optional(), taskId:uuid, workerId:uuid, start:instant, end:instant, status:z.enum(["pending","running","completed"]), overrideMinutes:z.number().int().min(0).max(44640).nullable().optional(), reason:z.string().max(2000), acceptOverlap:z.boolean() });
export const planSchema = z.object({
 parts:z.array(z.object({id:uuid,productId:uuid,bomId:uuid.optional(),name:text,quantity:z.number().int().positive(),processes:z.array(processCode).optional(),drawingNumber:z.string().optional()})).max(2000),
 tasks:z.array(z.object({id:uuid,partId:uuid,process:processCode,equipmentId:uuid,workerId:uuid,duration:z.number().int().min(30).max(525600).refine(n=>n%30===0),earliestStart:instant,plannedStart:instant,plannedEnd:instant,priority:z.number().int().positive(),breakRun:z.boolean(),overnight:z.boolean(),fixed:z.boolean(),manualOverride:z.boolean().optional(),status:z.enum(["pending","running","completed"]),segments:z.array(z.object({start:instant,end:instant})).min(1).max(1000)})).max(10000),
});
export function activePlan(data:PlanData):PlanData {
 const products=data.products.filter(x=>!x.archived); const ids=new Set(products.map(x=>x.id)); const parts=data.parts.filter(x=>!x.archived&&ids.has(x.productId)); const partIds=new Set(parts.map(x=>x.id)); const tasks=data.tasks.filter(x=>partIds.has(x.partId)); const taskIds=new Set(tasks.map(x=>x.id));
 return {...data,products,parts,tasks,logs:data.logs.filter(x=>taskIds.has(x.taskId))};
}
export function remainingQuantity(data:PlanData,bomId:string):number {
 const item=data.bom?.find(x=>x.id===bomId); return item ? item.quantity-data.parts.filter(x=>x.bomId===bomId&&!x.archived).reduce((n,x)=>n+x.quantity,0) : 0;
}
export function orderedProcesses(selected:string[]) { return PROCESSES.filter(x=>selected.includes(x.code)).map(x=>x.code); }
