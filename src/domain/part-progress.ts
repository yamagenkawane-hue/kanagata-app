import {processCatalog,type PlanData,type Task} from "./planning.ts";

export function partProgress(tasks:Task[],processes:string[],data:PlanData):string{
 if(!tasks.length)return "予定未登録";
 const catalog=processCatalog(data).filter(process=>processes.includes(process.code));
 const running=catalog.find(process=>tasks.some(task=>task.process===process.code&&task.status==="running"));
 if(running)return `${running.name} 作業中`;
 let last="";
 for(const process of catalog){
  const matches=tasks.filter(task=>task.process===process.code);
  if(matches.length&&matches.every(task=>task.status==="completed")){last=process.name;continue;}
  if(matches.some(task=>task.status==="completed"))return `${process.name} 一部完了`;
  break;
 }
 return last?`${last}完了`:"未着手";
}
