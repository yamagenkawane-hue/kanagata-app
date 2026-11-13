import {activePlan, remainingQuantity} from "./business.ts";
import {addDays, processCatalog, taskConflicts, type PlanData} from "./planning.ts";

export type ReadinessCheck={id:string;label:string;status:"ok"|"warning"|"blocked";message:string};
export function pilotReadiness(source:PlanData,today:string):ReadinessCheck[]{
 const data=activePlan(source);
 const missingDays=Array.from({length:31},(_,index)=>addDays(today,index)).filter(day=>!Object.hasOwn(data.calendar,day));
 const incomplete=data.parts.filter(part=>{const expected=part.processes??processCatalog(data).map(process=>process.code);return expected.some(code=>!data.tasks.some(task=>task.partId===part.id&&task.process===code));});
 const overlaps=taskConflicts(data.tasks).length;
 const activeBom=(source.bom??[]).filter(item=>!item.archived&&data.products.some(product=>product.id===item.productId));
 const invalidQuantity=activeBom.filter(item=>remainingQuantity(source,item.id)<0).length;
 const missingSizes=activeBom.filter(item=>item.kind==="plate"&&(!item.widthMm||!item.lengthMm)).length;
 const missingMachines=["machining","grinding","wire"].filter(code=>!data.equipment.some(machine=>machine.active!==false&&machine.process===code));
 const admins=data.workers.filter(worker=>worker.active!==false&&worker.role==="admin").length;
 const operators=data.workers.filter(worker=>worker.active!==false&&worker.role==="operator").length;
 return [
  {id:"database",label:"DB読み込み",status:"ok",message:`改訂番号 ${data.revision}／金型 ${data.products.length}件／工程 ${data.tasks.length}件`},
  {id:"calendar",label:"本日から31日間の会社カレンダー",status:missingDays.length?"blocked":"ok",message:missingDays.length?`未設定 ${missingDays.length}日（最初：${missingDays[0]}）。会社カレンダーから取り込んでください。`:`${today} ～ ${addDays(today,30)} は設定済みです。`},
  {id:"calendar-horizon",label:"3か月先のカレンダー",status:Object.hasOwn(data.calendar,addDays(today,90))?"ok":"warning",message:`最終設定日：${Object.keys(data.calendar).sort().at(-1)??"未設定"}。長期予定の作成前に対象期間を確認してください。`},
  {id:"machines",label:"加工機械",status:missingMachines.length?"blocked":"ok",message:missingMachines.length?`有効な機械がない工程：${missingMachines.map(code=>processCatalog(data).find(process=>process.code===code)?.name).join("・")}`:`主要3工程の機械は登録済み。ワイヤー ${data.equipment.filter(machine=>machine.process==="wire"&&machine.active!==false).length}台。`},
  {id:"overlaps",label:"設備の時間重複",status:overlaps?"blocked":"ok",message:overlaps?`${overlaps}件。ガントの優先確認で解消してください。`:"重複はありません。"},
  {id:"processes",label:"登録済みロットの必要工程",status:incomplete.length?"blocked":"ok",message:incomplete.length?`${incomplete.length}ロットで工程が不足しています。`:"必要工程に欠落はありません。"},
  {id:"quantity",label:"BOM数量",status:invalidQuantity?"blocked":"ok",message:invalidQuantity?`${invalidQuantity}項目で必要数量を超えています。`:"必要数量の超過はありません。"},
  {id:"sizes",label:"プレート寸法",status:missingSizes?"warning":"ok",message:missingSizes?`${missingSizes}項目が未設定。概算予定の自動登録前に入力してください。`:"登録済みプレートの寸法は入力済みです。"},
  {id:"accounts",label:"利用者の役割",status:admins?operators?"ok":"warning":"blocked",message:`有効な管理者 ${admins}名／担当者 ${operators}名。担当者の権限も確認してから運用してください。`},
 ];
}
