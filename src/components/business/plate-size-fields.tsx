"use client";
import {useState} from "react";
import type {BomItem,Product} from "@/domain/planning";

export default function PlateSizeFields({row,product,name}:{row:Partial<BomItem>;product?:Product;name:string}){
 const existing=row.name===name;
 const [width,setWidth]=useState<string|number>(existing?row.widthMm??product?.plateWidthMm??"":product?.plateWidthMm??"");
 const [length,setLength]=useState<string|number>(existing?row.lengthMm??product?.plateLengthMm??"":product?.plateLengthMm??"");
 const [ownWidth,setOwnWidth]=useState(Boolean(existing&&row.individualWidth));
 const [ownLength,setOwnLength]=useState(Boolean(existing&&row.individualLength));
 const special=/^(SB|DS1|DS2)|ストリッパーバッキング/.test(name);
 return <><p className="help-text">共通サイズ：{product?.plateWidthMm??"未設定"} × {product?.plateLengthMm??"未設定"} mm。個別指定していない寸法を保存すると、同じ金型の共通サイズも更新します。</p><div className="form-row"><label>幅（mm）<input name="widthMm" type="number" min="0.1" max="10000" step="0.1" value={width} required={ownWidth} onChange={event=>{setWidth(event.target.value);if(special)setOwnWidth(true);}} /></label><label>長さ（mm）<input name="lengthMm" type="number" min="0.1" max="10000" step="0.1" value={length} required={ownLength} onChange={event=>{setLength(event.target.value);if(special)setOwnLength(true);}} /></label></div><div className="form-row"><label className="checkbox"><input name="individualWidth" type="checkbox" checked={ownWidth} onChange={event=>{setOwnWidth(event.target.checked);if(!event.target.checked)setWidth(product?.plateWidthMm??"");}} />幅をこのプレートだけ個別指定</label><label className="checkbox"><input name="individualLength" type="checkbox" checked={ownLength} onChange={event=>{setOwnLength(event.target.checked);if(!event.target.checked)setLength(product?.plateLengthMm??"");}} />長さをこのプレートだけ個別指定</label></div>{special&&<p className="help-text">SBは複数枚時の小さい寸法を手入力できます。DS1・DS2は幅だけ修正し、長さは共通サイズのまま使用できます。寸法の縮小・拡大量は自動推測しません。</p>}</>;
}
