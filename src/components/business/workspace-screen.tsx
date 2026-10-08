import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PlanningBoard from "@/components/planning/planning-board";
import Management from "@/components/business/management";
import { businessContext, BusinessError, readPlanning } from "@/lib/business/server";
import { processCatalog } from "@/domain/planning";
export default async function WorkspaceScreen({section=[],productQuery}:{section?:string[];productQuery?:string}){
 let context;
 try{context=await businessContext();}catch(cause){if(cause instanceof BusinessError&&cause.status===401)redirect("/login");return <main className="login-screen"><section className="login-card"><h1>業務アカウントの設定が必要です</h1><p>{cause instanceof Error?cause.message:"接続できませんでした"}</p><Link className="button" href="/login">ログインへ</Link><Link className="demo-link" href="/demo">確認用デモ</Link></section></main>;}
 let data;
 try{data=await readPlanning(context.client);}catch(cause){return <main className="login-screen"><section className="login-card"><h1>DBの初期設定が必要です</h1><p>{cause instanceof Error?cause.message:"読み込めませんでした"}</p><p>初期SQLとBOM追加SQLを適用してください。設定手順はdocsにあります。</p><Link className="button" href="/workspace">再確認</Link><Link className="demo-link" href="/demo">確認用デモ</Link></section></main>;}
 const PROCESSES=processCatalog(data);const kind=section[0];
 if(kind==="bom-categories")redirect("/workspace/bom-names");
 if(!kind||kind==="process"||kind==="machines"){
  if(kind==="process"&&(!PROCESSES.some(x=>x.code===section[1])||section.length!==2))notFound();
  if(kind==="machines"&&(!data.equipment.some(x=>x.id===section[1])||section.length!==2))notFound();
  const title=kind==="process"?PROCESSES.find(x=>x.code===section[1])?.name:kind==="machines"?data.equipment.find(x=>x.id===section[1])?.name:"金型別 生産計画";
  return <><nav className="detail-breadcrumb"><Link href="/workspace">金型別計画</Link><span> / {title}</span><Link href="/workspace/actuals">実績一覧</Link><Link href="/workspace/bom">BOM設定</Link></nav><PlanningBoard key={`${data.revision}-${section.join("-")}`} initialDate={data.today??data.products[0]?.dueDate??"2026-10-01"} initialData={data} initialRole={context.role} basePath="/workspace" processFilter={kind==="process"?section[1]:""} machineFilter={kind==="machines"?section[1]:""} /></>;
 }
 if(!["products","bom","bom-names","equipment","users","calendar","actuals"].includes(kind)||section.length>2||(section.length===2&&kind!=="products"))notFound();
 if(section[1]&&!data.products.some(x=>x.id===section[1]))notFound();
 return <Management key={`${data.revision}-${section.join("-")}-${productQuery}`} initialData={data} role={context.role} section={kind} productId={kind==="products"?section[1]:productQuery} />;
}
