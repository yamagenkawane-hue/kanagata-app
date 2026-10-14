"use client";
import {useEffect,useRef} from "react";
import {adjustOverduePlans} from "@/domain/overdue-plans";
import {activePlan} from "@/domain/business";
import {businessRequest,mutateBusiness,SaveOutcomeUnknownError} from "@/lib/business/client";
import {type PlanData,dateKey,at,addDays} from "@/domain/planning";

type Options={data:PlanData;database:boolean;admin:boolean;blocked:boolean;onBusy:(value:boolean)=>void;onData:(data:PlanData)=>void;onNotice:(message:string)=>void;onError:(error:unknown)=>void;onDate:(day:string)=>void};
export function useOverdueAdjustment(options:Options){
 const latest=useRef(options);useEffect(()=>{latest.current=options;});
 const inFlight=useRef(false);const nextDue=useRef(0);const active=useRef(false);
 useEffect(()=>{
  active.current=options.admin;
  if(!options.admin)return;
  async function run(){
   const context=latest.current;if(!active.current||context.blocked||inFlight.current||Date.now()<nextDue.current)return;
   inFlight.current=true;nextDue.current=Date.now()+3_600_000;context.onBusy(true);let writing=false;
   try{
    let source=context.data;
    if(context.database){try{source=activePlan(await businessRequest(undefined));}catch{throw new Error("自動調整用の最新データを取得できませんでした。次の確認まで自動保存を停止します。");}}
    const now=Date.now();const result=adjustOverduePlans(source,now);
    let saved=source;
    if(result.changed.length){writing=true;saved=context.database?activePlan(await mutateBusiness("plan",source.revision,{parts:result.data.parts,tasks:result.data.tasks})):{...result.data,revision:source.revision+1};}
    if(!active.current)return;
    context.onData(saved);
    if(result.changed.length){const late=new Set(result.changed.filter(task=>{const part=saved.parts.find(p=>p.id===task.partId)!;const product=saved.products.find(p=>p.id===part.productId)!;return Date.parse(task.plannedEnd)>=Date.parse(at(addDays(product.dueDate,1),0));}).map(task=>saved.parts.find(part=>part.id===task.partId)!.productId));context.onNotice(`終了を過ぎた未着手予定を調整し、${result.changed.length}工程を${context.database?"自動保存":"デモに反映"}しました。${late.size?`納期超過 ${late.size}金型。`:""}`);context.onDate(dateKey(now));}
   }catch(error){if(active.current)context.onError(!writing&&error instanceof SaveOutcomeUnknownError?new Error("自動調整のデータ取得に失敗しました。"):error);}
   finally{inFlight.current=false;context.onBusy(false);}
  }
  void run();const timer=setInterval(()=>void run(),60_000);
  return()=>{active.current=false;clearInterval(timer);};
 },[options.admin,options.database]);
}
