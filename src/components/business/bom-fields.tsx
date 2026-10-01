"use client";
import { useState } from "react";
import { PROCESSES, type BomItem, type Product } from "@/domain/planning";
import { availablePlates } from "@/domain/plates";

export default function BomFields({ row, products, items }: { row: Partial<BomItem>; products: Product[]; items: BomItem[] }) {
  const [kind, setKind] = useState(row.kind ?? "part");
  const [productId, setProductId] = useState(row.productId ?? products.find(item => !item.archived)?.id ?? "");
  const [name, setName] = useState(row.name ?? "");
  const options = availablePlates(items, productId, row.id);
  const legacyName = kind === "plate" && row.kind === "plate" && row.name === name && name && !options.includes(name);
  return <>
    <label>区分<select name="kind" value={kind} onChange={event => { setKind(event.target.value as "plate" | "part"); setName(""); }}><option value="plate">プレート（全5工程）</option><option value="part">パーツ（選択工程）</option></select></label>
    <label>名称{kind === "plate" ? <select name="name" value={name} onChange={event => setName(event.target.value)} required><option value="">プレートを選択</option>{legacyName && <option value={name}>{name}（現在の登録）</option>}{options.map(item => <option key={item} value={item}>{item}</option>)}</select> : <input name="name" value={name} onChange={event => setName(event.target.value)} required maxLength={120} />}</label>
    {kind === "plate" && !options.length && !legacyName && <p role="status">この金型には全種類のプレートが登録済みです。</p>}
    <label>金型<select name="productId" value={productId} onChange={event => { setProductId(event.target.value); setName(""); }} disabled={Boolean(row.id)} required>{products.filter(item => !item.archived || item.id === row.productId).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    {row.id && <input type="hidden" name="productId" value={productId} />}
    <label>必要数量<input name="quantity" type="number" min={1} defaultValue={row.quantity ?? 1} required /></label>
    {kind === "part" && <fieldset><legend>必要工程</legend>{PROCESSES.map(item => <label className="checkbox" key={item.code}><input name="processes" type="checkbox" value={item.code} defaultChecked={row.processes?.includes(item.code)} />{item.name}</label>)}</fieldset>}
    {kind === "plate" && <p className="help-text">プレートは全5工程を登録します。</p>}
  </>;
}
