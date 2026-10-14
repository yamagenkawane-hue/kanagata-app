import { schedule, type PlanData } from "./planning.ts";
import { taskChanges } from "./task-changes.ts";

export function adjustOverduePlans(data:PlanData,now:number){
 if(!Number.isFinite(now))throw new Error("現在日時を確認できません。");
 const protectedIds=new Set(data.tasks.filter(task=>task.fixed||task.status!=="pending"||task.actualStart||data.logs.some(log=>log.taskId===task.id)).map(task=>task.id));
 const overdue=data.tasks.filter(task=>!protectedIds.has(task.id)&&Number.isFinite(Date.parse(task.plannedEnd))&&Date.parse(task.plannedEnd)<=now);
 if(!overdue.length)return {data,changed:[],overdueIds:[] as string[]};
 const ids=new Set(overdue.map(task=>task.id));
 let tasks=data.tasks.map(task=>{
  if(protectedIds.has(task.id))return {...task,fixed:true};
  let start=Math.max(Date.parse(task.plannedStart),Date.parse(task.earliestStart));
  if(ids.has(task.id))start+= (Math.floor((now-Date.parse(task.plannedEnd))/3_600_000)+1)*3_600_000;
  if(!Number.isFinite(start))throw new Error("予定日時が不正です。");
  return {...task,earliestStart:new Date(start).toISOString()};
 });
 let computed=schedule({...data,tasks},30);
 for(let attempt=0;computed.some(task=>ids.has(task.id)&&Date.parse(task.plannedEnd)<=now);attempt++){
  if(attempt>=1000)throw new Error("遅れの調整を完了できません。会社カレンダーを確認してください。");
  const remaining=new Set(computed.filter(task=>ids.has(task.id)&&Date.parse(task.plannedEnd)<=now).map(task=>task.id));
  tasks=tasks.map(task=>remaining.has(task.id)?{...task,earliestStart:new Date(Date.parse(task.earliestStart)+3_600_000).toISOString()}:task);
  computed=schedule({...data,tasks},30);
 }
 const scheduled=computed.map(task=>{
  const old=data.tasks.find(item=>item.id===task.id)!;
  if(protectedIds.has(task.id))return old;
  return {...task,earliestStart:ids.has(task.id)?task.earliestStart:old.earliestStart};
 });
 const changed=scheduled.filter(task=>taskChanges(data.tasks.find(old=>old.id===task.id),task).length>0);
 return {data:{...data,tasks:scheduled},changed,overdueIds:[...ids]};
}
