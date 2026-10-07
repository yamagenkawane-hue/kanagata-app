import type { Segment, Task } from "./planning.ts";

function instant(value:string):number|string {
 const parsed=Date.parse(value);return Number.isFinite(parsed)?parsed:value;
}
function intervals(task:Task):string {
 const segments:Segment[]=task.segments.length?task.segments:[{start:task.plannedStart,end:task.plannedEnd}];
 const sorted=segments.map(segment=>[Number(instant(segment.start)),Number(instant(segment.end))]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const merged:number[][]=[];
 for(const segment of sorted){const last=merged.at(-1);if(last&&segment[0]<=last[1])last[1]=Math.max(last[1],segment[1]);else merged.push([...segment]);}
 return JSON.stringify(merged);
}

// Compare saved scheduling values, rather than JSON property order, optional
// defaults or equivalent timestamp representations returned by the database.
export function taskChanges(before:Task|undefined,after:Task):string[] {
 if(!before)return ["新規登録"];
 const changes:string[]=[];
 for(const [field,label] of [["plannedStart","予定開始"],["plannedEnd","予定終了"],["earliestStart","開始可能日時"]] as const){
  if(instant(before[field])!==instant(after[field]))changes.push(label);
 }
 for(const [field,label] of [["equipmentId","設備"],["workerId","担当者"],["duration","所要時間・日数"]] as const){if(before[field]!==after[field])changes.push(label);}
 if((before.equipmentId||after.equipmentId)&&before.priority!==after.priority)changes.push("加工順");
 if((before.pressNo??"")!==(after.pressNo??""))changes.push("使用プレスNo");
 for(const [field,label] of [["fixed","予定固定"],["breakRun","休憩中稼働"],["overnight","夜間稼働"],["manualOverride","手動配置"]] as const){if(Boolean(before[field])!==Boolean(after[field]))changes.push(label);}
 if(intervals(before)!==intervals(after)&&!changes.includes("予定開始")&&!changes.includes("予定終了"))changes.push("稼働区間");
 return changes;
}
