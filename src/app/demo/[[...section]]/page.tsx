import { notFound } from "next/navigation";
import PlanningBoard from "@/components/planning/planning-board";
import Management from "@/components/business/management";
import { createDemo } from "@/domain/demo";
import { PROCESSES } from "@/domain/planning";
export default async function Page({params}:{params:Promise<{section?:string[]}>}){
 const {section=[]}=await params;const data=createDemo();const kind=section[0];
 if(!kind)return <PlanningBoard />;
 if(kind==="process"||kind==="machines"){
  if(section.length!==2||(kind==="process"?!PROCESSES.some(x=>x.code===section[1]):!data.equipment.some(x=>x.id===section[1])))notFound();
  return <PlanningBoard processFilter={kind==="process"?section[1]:""} machineFilter={kind==="machines"?section[1]:""} />;
 }
 if(!["products","bom","bom-names","equipment","users","calendar","actuals"].includes(kind)||section.length>2||(section.length===2&&kind!=="products"))notFound();
 if(section[1]&&!data.products.some(x=>x.id===section[1]))notFound();
 return <Management initialData={data} role="admin" section={kind} productId={section[1]} basePath="/demo" demo />;
}
