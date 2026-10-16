import {partProgress} from "@/domain/part-progress";
import {type PlanData,type Product} from "@/domain/planning";

export default function MoldSummary({data,product}:{data:PlanData;product:Product}){
 const bom=data.bom?.filter(item=>item.productId===product.id&&!item.archived)??[];
 const parts=data.parts.filter(part=>part.productId===product.id&&!part.archived&&part.scope!=="mold");
 const rows=bom.map(item=>{
  const lots=parts.filter(part=>part.bomId===item.id);
  const tasks=data.tasks.filter(task=>lots.some(part=>part.id===task.partId));
  const registered=lots.reduce((sum,part)=>sum+part.quantity,0);
  const status=partProgress(tasks,item.processes,data);
  return {id:item.id,name:item.name,status:registered<item.quantity&&tasks.length?`${status}（未登録数量あり）`:status};
 });
 for(const part of parts.filter(part=>!bom.some(item=>item.id===part.bomId))){const tasks=data.tasks.filter(task=>task.partId===part.id);rows.push({id:part.id,name:part.name,status:partProgress(tasks,part.processes??tasks.map(task=>task.process),data)});}
 return <section aria-label="金型詳細"><h2>金型詳細</h2><dl className="mold-summary"><div><dt>会社名</dt><dd>{product.customer||"未登録"}</dd></div><div><dt>納期</dt><dd>{product.dueDate.replaceAll("-","/")}</dd></div></dl><h2>プレート・パーツの進捗</h2><table className="management-table"><thead><tr><th>プレート・パーツ名</th><th>進捗</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{row.name}</td><td>{row.status}</td></tr>)}</tbody></table>{!rows.length&&<p className="help-text">プレート・パーツはまだ登録されていません。</p>}</section>;
}
