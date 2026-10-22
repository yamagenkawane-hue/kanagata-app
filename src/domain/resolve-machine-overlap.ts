import {calculateWorkMinutes, schedule, taskConflicts, type PlanData} from "./planning.ts";
import {ganttPeriod} from "./gantt-period.ts";

// Explicit priority selection also permits moving recorded actuals and fixed tasks.
export function resolveMachineOverlap(data:PlanData,winnerId:string,loserId:string){
 const winner=data.tasks.find(task=>task.id===winnerId),loser=data.tasks.find(task=>task.id===loserId);
 if(!winner||!loser||!winner.equipmentId||winner.equipmentId!==loser.equipmentId||!taskConflicts([winner,loser]).length)throw new Error("同じ機械で重複している工程を選択してください。");
 const delta=Date.parse(ganttPeriod(winner).end)-Date.parse(ganttPeriod(loser).start);
 const shift=(value:string)=>new Date(Date.parse(value)+delta).toISOString();
 const logs=data.logs.map(log=>log.taskId===loserId?{...log,start:shift(log.start),end:shift(log.end),calculatedMinutes:calculateWorkMinutes(shift(log.start),shift(log.end),log.breaks)}:{...log});
 let tasks=data.tasks.map(task=>task.id===loserId?{...task,earliestStart:shift(ganttPeriod(task).start),plannedStart:shift(task.plannedStart),plannedEnd:shift(task.plannedEnd),segments:task.segments.map(segment=>({start:shift(segment.start),end:shift(segment.end)})),actualStart:task.actualStart?shift(task.actualStart):undefined,actualEnd:task.actualEnd?shift(task.actualEnd):undefined}:{...task});
 // Preserve existing starts as lower bounds; never pull unrelated plans forward.
 tasks=tasks.map(task=>task.status==="pending"&&!task.fixed?{...task,earliestStart:new Date(Math.max(Date.parse(task.earliestStart),Date.parse(task.plannedStart))).toISOString()}:task);
 if(loser.status==="pending"&&!loser.fixed){
  const queue=tasks.filter(task=>task.equipmentId===loser.equipmentId&&task.status==="pending"&&task.id!==loserId).sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));
  const index=queue.findIndex(task=>task.id===winnerId);queue.splice(index<0?0:index+1,0,tasks.find(task=>task.id===loserId)!);
  tasks=tasks.map(task=>{const rank=queue.findIndex(item=>item.id===task.id);return rank<0?task:{...task,priority:rank+1};});
 }
 tasks=schedule({...data,logs,tasks:tasks.map(task=>task.id===winnerId?{...task,fixed:true}:task)},30).map(task=>task.id===winnerId?{...task,fixed:winner.fixed}:task);
 if(taskConflicts(tasks).some(pair=>pair.includes(winnerId)&&pair.includes(loserId)))throw new Error("優先した工程との重複を解消できませんでした。");
 return {data:{...data,tasks,logs},delta};
}
