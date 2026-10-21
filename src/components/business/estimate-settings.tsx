"use client";
import {DEFAULT_ESTIMATES} from "@/domain/estimates";
import type {PlanData} from "@/domain/planning";
export default function EstimateSettingsForm({data,disabled,onSave}:{data:PlanData;disabled:boolean;onSave:(value:unknown)=>void}){
 const settings=data.estimates??DEFAULT_ESTIMATES;
 return <details className="setup-tools"><summary>プレートの概算加工時間を設定</summary><p>1日8時間換算の初期値です。変更は今後の概算計算に使用し、登録済み予定には自動適用しません。</p><form onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);onSave(Object.fromEntries(Object.keys(settings).map(key=>[key,Number(form.get(key))])));}}><fieldset disabled={disabled}><div className="form-row">{([['machiningMinutes','マシニング（分／枚）'],['grindingMinutes','自動研磨・通常（分／枚）'],['largeGrindingMinutes','自動研磨・大判（分／枚）'],['wireMinutes','ワイヤー（分／枚）']] as const).map(([key,label])=><label key={key}>{label}<input name={key} type="number" min={30} max={10080} step={30} defaultValue={settings[key]} required /></label>)}</div><label>大判とする長辺の境界（mm・この値を超える場合）<input name="largeThresholdMm" type="number" min="0.1" max="10000" step="0.1" defaultValue={settings.largeThresholdMm} required /></label><button className="button primary">概算設定を保存</button></fieldset></form></details>;
}
