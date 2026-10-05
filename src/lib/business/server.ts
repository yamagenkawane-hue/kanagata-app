import { createSupabaseServer } from "@/lib/supabase/server";
import type { PlanData } from "@/domain/planning";
export class BusinessError extends Error { constructor(message:string,public status=400){super(message);} }
export async function businessContext() {
 const client=await createSupabaseServer(); const auth=await client.auth.getUser();
 if (!auth.data.user) throw new BusinessError("ログインしてください",401);
 const result=await client.from("profiles").select("display_name,role,is_active").eq("user_id",auth.data.user.id).maybeSingle();
 if(result.error) throw new BusinessError("業務テーブルを作成してください。接続手順を確認してください",503);
 if(!result.data?.is_active) throw new BusinessError("有効な業務アカウントがありません",403);
 return {client,userId:auth.data.user.id,name:result.data.display_name as string,role:result.data.role as "admin"|"operator"};
}
export async function readPlanning(client:Awaited<ReturnType<typeof createSupabaseServer>>):Promise<PlanData> {
 const {data,error}=await client.rpc("read_planning");
 if(error) throw new BusinessError("DB読み込みに失敗しました。追加SQLの適用を確認してください",503);
 if(!data || !Array.isArray(data.tasks)) throw new BusinessError("DBの形式が不正です",503);
 const result=data as PlanData;
 result.tasks=result.tasks.map(t=>({...t,equipmentId:t.equipmentId??"",pressNo:t.pressNo??"",actualStart:t.actualStart??undefined,actualEnd:t.actualEnd??undefined}));
 result.parts=result.parts.map(p=>({...p,bomId:p.bomId??undefined}));
 result.logs=result.logs.map(l=>({...l,overrideMinutes:l.overrideMinutes??undefined}));
 return result;
}
