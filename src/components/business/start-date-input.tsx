"use client";

import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { availableStarts } from "@/domain/available-starts";

import { type PlanData, type Task } from "@/domain/planning";

type Props=Omit<ComponentProps<"input">,"type"|"onClick"> & {data?:PlanData;task?:Task};
export default function StartDateInput({data,task,...props}:Props) {
 const initial=String(props.defaultValue??"");
 const [day,setDay]=useState(initial.slice(0,10));const [chosen,setChosen]=useState(initial);
 const [criteria,setCriteria]=useState<Task|null>(null);const holder=useRef<HTMLSpanElement>(null);
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
 return <span ref={holder} style={{display:"grid",gap:8}}>{data&&criteria?<>
  <input aria-label="開始可能日" type="date" value={day} disabled={props.disabled} onChange={event=>{setDay(event.target.value);setChosen("");}} onClick={event=>{try{event.currentTarget.showPicker();}catch{}}} />
  <select name={props.name} aria-label="空いている開始時刻" required={props.required} disabled={props.disabled} value={valid} onChange={event=>setChosen(event.target.value)}>
   <option value="">{options.length?"空いている開始時刻を選択してください":"この日の開始候補はありません"}</option>
   {options.map(value=><option key={value} value={value}>{value.slice(11)}</option>)}
  </select>
  <small className="help-text">{data.equipment.find(item=>item.id===criteria.equipmentId)?.name}：所要時間が予定と重ならない開始時刻のみ表示。後工程と加工順は確認画面で再計算します。</small>
 </>:<input {...props} type="datetime-local" onClick={event=>{const input=event.currentTarget;if(input.disabled||input.readOnly||typeof input.showPicker!=="function")return;try{input.showPicker();}catch{}}} />}</span>;
}
