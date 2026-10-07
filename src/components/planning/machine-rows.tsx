"use client";
import Link from "next/link";
import { ganttRows } from "@/domain/gantt-rows";
import { BREAKS, PROCESSES, dateTimeLabel, timeLabel, type PlanData, type Task } from "@/domain/planning";

export default function MachineRows({tasks,data,days,dayWidth,timelineWidth,windowStart,windowEnd,selectedId,conflicts,basePath,onSelect,onList}:{tasks:Task[];data:PlanData;days:string[];dayWidth:number;timelineWidth:number;windowStart:number;windowEnd:number;selectedId:string|null;conflicts:Set<string>;basePath:string;onSelect:(id:string)=>void;onList:(ids:string[])=>void}){
 return ganttRows(tasks).map(row=>{
  const first=row.tasks[0],process=PROCESSES.find(item=>item.code===first.process)!;
  const workers=[...new Set(row.tasks.map(task=>data.workers.find(worker=>worker.id===task.workerId)?.name.replace("（デモ）","")??"未設定"))];
  const ranks=row.tasks.filter(task=>task.status==="pending"&&task.equipmentId).map(task=>task.priority).sort((a,b)=>a-b).join(", ");
  return <div key={row.key} className={`gantt-row ${row.tasks.some(task=>task.id===selectedId)?"row-selected":""}`}><div className="frozen task-columns"><span className="process-name"><i style={{background:process.color}}/><span className="gantt-task-name"><Link href={`${basePath}/process/${process.code}`}><strong>{process.name}</strong></Link><small>{row.tasks.length}件{row.track>0?"（補助行）":""}</small></span><button className="task-edit-button" onClick={()=>onList(row.tasks.map(task=>task.id))} aria-label={`${process.name}の加工予定を選択`}>予定一覧</button></span><span>{first.equipmentId?<Link href={`${basePath}/machines/${first.equipmentId}`}>{data.equipment.find(item=>item.id===first.equipmentId)?.name}</Link>:first.pressNo||"未定"}</span><span title={workers.join(" / ")}>{workers.length===1?workers[0]:"複数"}</span><span title={ranks||"加工順なし"}><b className="priority-badge machine-priorities">{ranks||"—"}</b></span></div><div className="timeline-row" style={{width:timelineWidth}}><div className="day-backgrounds">{days.map(day=><div key={day} className={`day-background ${!data.calendar[day]?"off-day":""}`} style={{width:dayWidth,backgroundSize:`${dayWidth/48}px 100%`}}><div className="off-hours before" style={{width:`${530/1440*100}%`}}/><div className="off-hours after" style={{left:`${1060/1440*100}%`,width:`${380/1440*100}%`}}/>{BREAKS.map(([from,to])=><div key={from} className="break-time" style={{left:`${from/1440*100}%`,width:`${(to-from)/1440*100}%`}}/>)}</div>)}</div>{row.tasks.map(task=>{
    const part=data.parts.find(item=>item.id===task.partId)!;
    const start=Math.max(windowStart,Date.parse(task.plannedStart)),end=Math.min(windowEnd,Date.parse(task.plannedEnd));
    if(end<=start)return null;
    const left=(start-windowStart)/(windowEnd-windowStart)*timelineWidth,width=(end-start)/(windowEnd-windowStart)*timelineWidth;
    return <button key={task.id} className={`task-bar ${task.status} ${task.fixed?"fixed-bar":""}`} title={`${part.name} / ${process.name} / ${task.status==="completed"?"完了":task.status==="running"?"作業中":"未着手"}\n${dateTimeLabel(task.plannedStart)} ～ ${dateTimeLabel(task.plannedEnd)}\n担当：${data.workers.find(item=>item.id===task.workerId)?.name??"未設定"}${task.equipmentId?` / 加工順：${task.priority}`:""}`} aria-label={`${part.name}の${process.name}を編集 ${dateTimeLabel(task.plannedStart)}から${dateTimeLabel(task.plannedEnd)}`} style={{left,width:Math.max(width,7),background:process.tint,borderColor:process.color}} onClick={()=>onSelect(task.id)}><span>{task.status==="completed"?"✓ ":""}{part.name}</span>{width>110&&<small>{timeLabel(task.plannedStart)}–{timeLabel(task.plannedEnd)}</small>}{task.fixed&&<b>固定</b>}{task.overnight&&<b>夜間</b>}{conflicts.has(task.id)&&<b>⚠</b>}</button>;
  })}</div></div>;
 });
}
