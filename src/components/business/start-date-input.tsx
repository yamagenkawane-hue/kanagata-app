"use client";

import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { availableStarts } from "@/domain/available-starts";

import { type PlanData, type Task } from "@/domain/planning";

type Props=Omit<ComponentProps<"input">,"type"|"onClick"> & {data?:PlanData;task?:Task};
export default function StartDateInput({data,task,...props}:Props) {
 const initial=String(props.defaultValue??"");
 const [day,setDay]=useState(initial.slice(0,10));const [chosen,setChosen]=useState(initial);
 const [criteria,setCriteria]=useState<Task|null>(null);const holder=useRef<HTMLSpanElement>(null);
 const timeInput=useRef<HTMLInputElement>(null);
 useEffect(()=>{
  const form=holder.current?.closest("form");if(!form||!data)return;
  function update(){
   const fields=new FormData(form!);
   const machine=form!.querySelector<HTMLSelectElement>('select[name="equipment"],select[name^="equipment-"]');
   const equipment=data!.equipment.find(item=>item.id===machine?.value);
   if(!equipment){setCriteria(null);return;}
   const code=equipment.process;const suffix=machine?.name==="equipment"?"":`-${code}`;
   const duration=Number(fields.get(`duration${suffix}`));
   setCriteria({...task,id:task?.id??"new-availability",partId:task?.partId??"",equipmentId:equipment.id,process:code,workerId:"",duration,earliestStart:"",priority:1,status:"pending",fixed:false,overnight:fields.get(suffix?`night${suffix}`:"overnight")==="on" || fields.get(`overnight${suffix}`)==="on",breakRun:fields.get(suffix?`break${suffix}`:"breakRun")==="on",plannedStart:"",plannedEnd:"",segments:[]});
  }
  update();form.addEventListener("input",update);form.addEventListener("change",update);
  return()=>{form.removeEventListener("input",update);form.removeEventListener("change",update);};
 },[data,task]);
 const options=useMemo(()=>data&&criteria?availableStarts(day,criteria,data):[],[data,criteria,day]);
 const valid=options.includes(chosen)?chosen:"";
 const ranges=useMemo(()=>{
  const result:{start:string;end:string}[]=[];
  for(const value of options){const last=result.at(-1);if(last&&Date.parse(value)-Date.parse(last.end)===60_000)last.end=value;else result.push({start:value,end:value});}
  return result;
 },[options]);
 useEffect(()=>{timeInput.current?.setCustomValidity(chosen&&!valid?"表示された時間帯から開始時刻を選んでください。":"");},[chosen,valid,criteria]);
 return <span ref={holder} style={{display:"grid",gap:8}}>{data&&criteria?<>
  <input key="available-day" aria-label="開始可能日" type="date" value={day} disabled={props.disabled} onChange={event=>{setDay(event.target.value);setChosen("");}} onClick={event=>{try{event.currentTarget.showPicker();}catch{}}} />
  <span className="available-time-panel"><span className="available-time-title">開始できる時間帯 · {data.equipment.find(item=>item.id===criteria.equipmentId)?.name}</span>
   <span className="available-time-ranges">{ranges.map(range=><button type="button" className="available-time-range" key={range.start} disabled={props.disabled} aria-pressed={Boolean(valid&&valid>=range.start&&valid<=range.end)} onClick={()=>setChosen(range.start)}>{range.start.slice(11)}{range.end!==range.start&&` 〜 ${range.end.slice(11)}`}</button>)}</span>
   {!ranges.length&&<span role="status">この日は開始できる時間帯がありません。別の日を選んでください。</span>}
   <span className="available-time-adjust"><span>開始時刻</span><input ref={timeInput} aria-label="開始時刻" type="time" step={60} value={chosen.slice(11)} required={props.required} disabled={props.disabled} onChange={event=>setChosen(event.target.value?`${day}T${event.target.value}`:"")} /></span>
   {chosen&&!valid&&<span className="inline-error" role="status">表示された時間帯から選択してください。</span>}
  </span>
  <input type="hidden" name={props.name} value={valid} />
  <small className="help-text">時間帯をクリックして選択。開始時刻は1分単位で調整できます。加工終了まで他の予定と重ならない候補です。</small>
 </>:<input key="native-datetime" {...props} type="datetime-local" onClick={event=>{const input=event.currentTarget;if(input.disabled||input.readOnly||typeof input.showPicker!=="function")return;try{input.showPicker();}catch{}}} />}</span>;
}
