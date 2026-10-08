"use client";
import { useState } from "react";
import { BOM_PROCESSES, type BomItem, type Product, type BomCategory, type BomName, type ProcessDefinition } from "@/domain/planning";
import { availableBomNames } from "@/domain/bom-names";
import { DEFAULT_BOM_CATEGORIES } from "@/domain/bom-categories";

export default function BomFields({ row, products, items, categories = DEFAULT_BOM_CATEGORIES, names = [], processes = BOM_PROCESSES }: { row: Partial<BomItem>; products: Product[]; items: BomItem[]; categories?: BomCategory[]; names?: BomName[];processes?:ProcessDefinition[] }) {
  const originalCategoryId = row.categoryId ?? categories.find(category => category.kind === (row.kind ?? "part") && (category.active || Boolean(row.id)))?.id;
  const [categoryId, setCategoryId] = useState(originalCategoryId ?? "");
  const kind = categories.find(category => category.id === categoryId)?.kind ?? row.kind ?? "part";
  const [productId, setProductId] = useState(row.productId ?? products.find(item => !item.archived)?.id ?? "");
  const [name, setName] = useState(row.name ?? "");
  const options = availableBomNames(names, items, productId, categoryId, kind, row.id);
  const legacyName = Boolean(row.id) && categoryId === originalCategoryId && row.name === name && name && !options.includes(name);
  return <>
    <label>区分<select name="categoryId" value={categoryId} required onChange={event => { setCategoryId(event.target.value); setName(""); }}><option value="">区分を選択</option>{categories.filter(category => category.active || (Boolean(row.id) && category.id === originalCategoryId)).map(category => <option key={category.id} value={category.id}>{category.name}{!category.active && "（停止中）"}</option>)}</select></label>
    <input type="hidden" name="kind" value={kind} />
    <label>名称<select name="name" value={name} onChange={event => setName(event.target.value)} required><option value="">名称を選択</option>{legacyName && <option value={name}>{name}（現在の登録）</option>}{options.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
    {!options.length && !legacyName && <p role="status">選択できる名称がありません。名称リストへ登録してください。プレートは同じ金型の登録済み名称を除外します。</p>}
    <label>金型<select name="productId" value={productId} onChange={event => { setProductId(event.target.value); setName(""); }} disabled={Boolean(row.id)} required>{products.filter(item => !item.archived || item.id === row.productId).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    {row.id && <input type="hidden" name="productId" value={productId} />}
    <label>必要数量<input name="quantity" type="number" min={1} defaultValue={row.quantity ?? 1} required /></label>
    {<fieldset><legend>必要工程</legend>{processes.map(item => {const mandatory=kind==="plate"&&["machining","grinding","wire"].includes(item.code);return <label className="checkbox" key={`${kind}-${item.code}`}><input name="processes" type="checkbox" value={item.code} defaultChecked={mandatory||row.processes?.includes(item.code)} disabled={mandatory||(item.active===false&&!row.processes?.includes(item.code))} />{mandatory&&<input type="hidden" name="processes" value={item.code} />}{item.name}{item.active===false&&"（停止中）"}</label>;})}</fieldset>}
    {kind === "plate" && <p className="help-text">プレートはマシニング・自動研磨・ワイヤーが必須です。追加工程は必要なものを選択します。型組・トライは金型単位で別途登録します。</p>}
  </>;
}
