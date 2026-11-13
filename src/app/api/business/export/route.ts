import {NextResponse} from "next/server";
import {businessContext,BusinessError,readPlanning} from "@/lib/business/server";

export async function GET(){
 const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
 try{
  const context=await businessContext();
  if(context.role!=="admin")throw new BusinessError("書き出しは管理者のみです",403);
  const data=await readPlanning(context.client);
  const exportedAt=new Date().toISOString();
  return NextResponse.json({format:"kanagata-planning-snapshot",version:1,exportedAt,data},{headers:{...headers,"Content-Disposition":`attachment; filename="kanagata-${exportedAt.slice(0,10)}-r${data.revision}.json"`}});
 }catch(cause){return NextResponse.json({error:cause instanceof BusinessError?cause.message:"書き出しに失敗しました。接続を確認してください。"},{status:cause instanceof BusinessError?cause.status:503,headers});}
}
