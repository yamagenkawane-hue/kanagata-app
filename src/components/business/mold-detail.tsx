import Link from "next/link";
import MoldSummary from "./mold-summary";
import type {PlanData,Product} from "@/domain/planning";

export default function MoldDetail({data,product,basePath}:{data:PlanData;product:Product;basePath:string}){
 return <main className="management-page"><header className="management-header"><Link href={basePath}>← ガントへ戻る</Link><span>金型詳細</span></header><div className="page-heading"><div><div className="eyebrow">MOLD DETAIL</div><h1>{product.name}</h1><p>会社名・納期・プレートごとの進捗を確認できます。</p></div></div><MoldSummary data={data} product={product} /></main>;
}
