import { at, localInput, overlaps, placeAtRequestedStart, type PlanData, type Task } from "./planning.ts";

export function availableStarts(day:string, task:Task, data:Pick<PlanData,"tasks"|"calendar">):string[] {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(task.duration) || task.duration<=0)return [];
 const busy=data.tasks.filter(item=>item.id!==task.id && item.equipmentId===task.equipmentId && Boolean(task.equipmentId)).flatMap(item=>item.status==="completed"&&item.actualStart&&item.actualEnd ? [{start:item.actualStart,end:item.actualEnd}] : item.segments.length?item.segments:[{start:item.plannedStart,end:item.plannedEnd}]);
 const result:string[]=[];
 for(let minute=0;minute<1440;minute+=30){
  const start=at(day,minute);
  // Skip occupied starts before allocating the full required duration.
  if(busy.some(segment=>overlaps(segment,{start,end:at(day,minute+1)})))continue;
  try{
   const placed=placeAtRequestedStart({...task,earliestStart:start},data.calendar);
   if(placed.plannedStart===start && !placed.segments.some(segment=>busy.some(other=>overlaps(segment,other))))result.push(localInput(start));
  }catch{ /* Missing calendar or invalid duration has no selectable start. */ }
 }
 return result;
}
