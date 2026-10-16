import type {Task} from "./planning.ts";

export function ganttPeriod(task:Task){
 if(task.status==="completed"&&task.actualStart&&task.actualEnd&&Number.isFinite(Date.parse(task.actualStart))&&Date.parse(task.actualEnd)>Date.parse(task.actualStart))return {start:task.actualStart,end:task.actualEnd,actual:true};
 return {start:task.plannedStart,end:task.plannedEnd,actual:false};
}
