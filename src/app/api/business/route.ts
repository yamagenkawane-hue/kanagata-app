import { NextResponse } from "next/server";
import { z } from "zod";
import { boundedBody, sameOrigin } from "@/lib/business/http";
import { actualSchema, masterSchemas, planSchema } from "@/domain/business";
import { businessContext, BusinessError, readPlanning } from "@/lib/business/server";
import { validatePlate } from "@/domain/plates";
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
   const entity=input.entity as keyof typeof masterSchemas; const payload=masterSchemas[entity].parse(input.payload);
   if(entity==="bom"){
    const bom=masterSchemas.bom.parse(payload);const data=await readPlanning(context.client);
    try{validatePlate(data.bom??[],bom);}catch(cause){throw new BusinessError(cause instanceof Error?cause.message:"プレートを確認してください");}
   }
   rpc="manage_entity";args={entity,payload,expected:input.expected};
  }else if(input.operation==="plan"){
   rpc="commit_plan";args={payload:planSchema.parse(input.payload),expected:input.expected,accept_overlap:input.acceptOverlap??false};
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
