import Link from "next/link";
import LogoutButton from "@/app/workspace/logout-button";
import MoldSummary from "./mold-summary";
import type {PlanData,Product} from "@/domain/planning";

export default function MoldDetail({data,product,basePath}:{data:PlanData;product:Product;basePath:string}){
 return <main className="management-page"><header className="management-header"><Link href={basePath}>← ガントへ戻る</Link><Link href={`${basePath}/products`}>金型管理へ</Link><Link href={`${basePath}/bom?product=${product.id}`}>BOM設定へ</Link><span>金型詳細</span>{basePath==="/workspace"&&<LogoutButton />}</header><MoldSummary data={data} product={product} /></main>;
}
