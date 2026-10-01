import type { PlanData } from "@/domain/planning";
export async function mutateBusiness(operation:string,expected:number,payload:unknown,entity?:string,acceptOverlap=false):Promise<PlanData>{
 const response=await fetch("/api/business",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({operation,expected,payload,entity,acceptOverlap})});
 const result=await response.json();if(!response.ok)throw new Error(result.error??"保存できませんでした");return result.data;
}
