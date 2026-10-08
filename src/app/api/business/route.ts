import { NextResponse } from "next/server";
import { z } from "zod";
import { boundedBody, sameOrigin } from "@/lib/business/http";
import { actualSchema, masterSchemas, planSchema } from "@/domain/business";
import { businessContext, BusinessError, readPlanning } from "@/lib/business/server";
import { validatePlate } from "@/domain/plates";
import { processCatalog } from "@/domain/planning";
const headers={"Cache-Control":"private, no-store"};
function errorResponse(cause:unknown){
 if(cause instanceof z.ZodError) return NextResponse.json({error:cause.issues.map(x=>x.message).join(" / ")},{status:400,headers});
 if(cause instanceof BusinessError) return NextResponse.json({error:cause.message},{status:cause.status,headers});
 return NextResponse.json({error:"処理に失敗しました。接続と入力を確認してください"},{status:500,headers});
}
export async function GET(){try{const context=await businessContext();return NextResponse.json({data:await readPlanning(context.client),role:context.role,userId:context.userId},{headers});}catch(cause){return errorResponse(cause);}}
export async function POST(request:Request){
 try{
  if(!sameOrigin(request)) throw new BusinessError("許可されていない要求です",403);
  let raw:string;try{raw=new TextDecoder().decode(await boundedBody(request,5_000_000));}catch{throw new BusinessError("送信データが大きすぎます",413);}
  let parsed:unknown;try{parsed=JSON.parse(raw);}catch{throw new BusinessError("JSONの形式が不正です");}
  const input=z.object({operation:z.enum(["master","plan","actual","deleteActual","seed"]),expected:z.number().int().positive(),entity:z.string().optional(),payload:z.unknown(),acceptOverlap:z.boolean().optional()}).parse(parsed);
  const context=await businessContext();
  if(input.operation!=="actual"&&context.role!=="admin")throw new BusinessError("管理者のみ操作できます",403);
  let rpc:string; let args:Record<string,unknown>;
  if(input.operation==="master"){
   if(!input.entity || !Object.hasOwn(masterSchemas,input.entity))throw new BusinessError("操作対象が不正です");
   const entity=input.entity as keyof typeof masterSchemas; let payload=masterSchemas[entity].parse(input.payload);
   if(entity==="process"){
    const data=await readPlanning(context.client);
    if(!data.processes)throw new BusinessError("工程追加のDB設定が必要です。SupabaseのSQL Editorで 202610080001_custom_processes.sql を実行してください。",503);
   }
   if(entity==="bom"){
    const bom=masterSchemas.bom.parse(payload);const data=await readPlanning(context.client);
    if(bom.categoryId){const category=data.categories?.find(item=>item.id===bom.categoryId);if(!category)throw new BusinessError("BOM区分の追加SQLを適用し、有効な区分を選択してください");bom.kind=category.kind;payload=bom;}
    const catalog=processCatalog(data);const previous=data.bom?.find(item=>item.id===bom.id);
    if(new Set(bom.processes).size!==bom.processes.length||bom.processes.some(code=>!catalog.some(process=>process.code===code&&(process.active!==false||previous?.processes.includes(code)))))throw new BusinessError("有効な登録済み工程を選択してください。");
    const categoryId=bom.categoryId??data.categories?.find(item=>item.kind===bom.kind)?.id;
    const names=data.bomNames?.filter(item=>item.categoryId===categoryId&&item.active).map(item=>item.name);
    try{validatePlate(data.bom??[],bom,names);}catch(cause){throw new BusinessError(cause instanceof Error?cause.message:"プレートを確認してください");}
   }
   rpc="manage_entity";args={entity,payload,expected:input.expected};
  }else if(input.operation==="plan"){
   const payload=planSchema.parse(input.payload);
   if(payload.tasks.some(task=>!task.equipmentId && (task.process==="assembly"||task.process==="trial"))){
    const schema=await context.client.from("tasks").select("press_no").limit(0);
    if(schema.error?.code==="42703"||schema.error?.code==="PGRST204")throw new BusinessError("型組・トライのDB設定が未完了です。SupabaseのSQL Editorで 202610050005_press_no.sql を実行し、画面を再読み込みしてください。",503);
    if(schema.error)throw new BusinessError("型組・トライのDB設定を確認できませんでした。接続を確認してください。",503);
   }
   rpc="commit_plan";args={payload,expected:input.expected,accept_overlap:input.acceptOverlap??false};
  }else if(input.operation==="actual"){
   rpc="save_actual";args={payload:actualSchema.parse(input.payload),expected:input.expected,remove_log:false};
  }else if(input.operation==="deleteActual"){
   rpc="save_actual";args={payload:z.object({id:z.string().uuid()}).parse(input.payload),expected:input.expected,remove_log:true};
  }else {rpc="seed_test_data";args={expected:input.expected};}
  const result=await context.client.rpc(rpc,args);
  if(result.error)throw new BusinessError(result.error.message,result.error.code==="40001"?409:result.error.code==="42501"?403:400);
  return NextResponse.json({data:await readPlanning(context.client)},{headers});
 }catch(cause){return errorResponse(cause);}
}
