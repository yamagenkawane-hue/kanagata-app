import type { PlanData } from "@/domain/planning";
export async function mutateBusiness(operation:string,expected:number,payload:unknown,entity?:string,acceptOverlap=false):Promise<PlanData>{
 return businessRequest({operation,expected,payload,entity,acceptOverlap});
}

export class SaveOutcomeUnknownError extends Error {}

// Bound both the request and reading its body. A lost response does not prove
// the database rolled back, so callers must reload before submitting again.
export async function businessRequest(body:unknown,request:typeof fetch=fetch,timeoutMs=30_000):Promise<PlanData> {
 const controller=new AbortController();
 let timer:ReturnType<typeof setTimeout>|undefined;
 const uncertain=()=>new SaveOutcomeUnknownError("保存結果を確認できませんでした。画面を再読み込みして、登録内容を確認してから操作してください。");
 const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{reject(uncertain());controller.abort();},timeoutMs);});
 try {
  return await Promise.race([deadline,(async()=>{
   let response:Response;
   try {response=await request("/api/business",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:controller.signal});}
   catch {throw uncertain();}
   let result;
   try {result=await response.json();}catch {throw uncertain();}
   if(!response.ok)throw new Error(result.error??"保存できませんでした");
   if(!result.data || !Array.isArray(result.data.tasks))throw uncertain();
   return result.data as PlanData;
  })()]);
 }finally{clearTimeout(timer);}
}
