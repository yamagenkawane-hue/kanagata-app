"use client";
import {useState} from 'react';
import {addStagePlans,stageCandidates,stageEstimate} from '@/domain/bom-stage-plans';
import {at,bomProcessCatalog,fromLocalInput,localInput,type PlanData} from '@/domain/planning';


export default function BomStageForm({data,startDate,onPreview,onClose,onLegacy}:{data:PlanData;startDate:string;onPreview:(data:PlanData,title:string)=>void;onClose:()=>void;onLegacy:()=>void}){
 const [product,setProduct]=useState(data.products.find(p=>!p.archived)?.id??'');
 const [process,setProcess]=useState('machining');
 const [bulk,setBulk]=useState(true);
 const [selected,setSelected]=useState<string[]>([]);
 const [error,setError]=useState('');
 const [start,setStart]=useState(()=>localInput(at(startDate,540)));
 const candidates=stageCandidates(data,product,process,bulk);
 const reset=()=>{setSelected([]);setError('');};
 return <div className="modal-overlay"><section className="modal wide-modal" role="dialog" aria-modal="true" aria-label="BOMから工程別に予定を登録"><div className="panel-header"><h2>BOMから予定を登録</h2><button className="icon-button" onClick={onClose} aria-label="閉じる">×</button></div>
 <p>工程を選び、登録するプレートにチェックを入れてください。他の工程は後から個別に追加できます。</p><button type="button" className="button" onClick={onLegacy}>従来の全工程・数量指定で登録</button>
 {error&&<p className="inline-error" role="alert">{error}</p>}
 <form onSubmit={event=>{event.preventDefault();try{const form=new FormData(event.currentTarget);const candidate=addStagePlans(data,product,process,selected.map(key=>({key,duration:Number(form.get('duration-'+key))})),{equipmentId:String(form.get('equipment')),workerId:String(form.get('worker')),start:fromLocalInput(String(form.get('start'))),overnight:form.get('night')==='on'});onPreview(candidate,'工程別にBOM予定を登録');onClose();}catch(cause){setError(cause instanceof Error?cause.message:'入力を確認してください。');}}}>
 <div className="form-row"><label>金型<select value={product} onChange={e=>{setProduct(e.target.value);reset();}} required>{data.products.filter(p=>!p.archived).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>今回登録する工程<select value={process} onChange={e=>{setProcess(e.target.value);reset();}}>{bomProcessCatalog(data).map(p=><option key={p.code} value={p.code}>{p.name}</option>)}</select></label></div>
 <label className="checkbox"><input type="checkbox" checked={bulk} onChange={e=>{setBulk(e.target.checked);reset();}}/>プレートを一括登録（チェックを外すと1件ずつ選択）</label>
 {bulk&&<button type="button" className="button" onClick={()=>setSelected(selected.length===candidates.length?[]:candidates.map(c=>c.key))}>{selected.length===candidates.length?'全選択を解除':'対象をすべて選択'}</button>}
 <p className="help-text">登録済みの工程は表示されません。数量は既存の製作ロット、またはBOMの未登録数量です。所要時間はその数量全体の時間を指定します。</p>
 {!candidates.length&&<p>この工程に追加できる対象はありません。</p>}
 {candidates.map(entry=><div className="form-row" key={process+entry.key}><label className="checkbox"><input type="checkbox" checked={selected.includes(entry.key)} onChange={e=>setSelected(e.target.checked?(bulk?[...selected,entry.key]:[entry.key]):selected.filter(k=>k!==entry.key))}/>{entry.bom.name}（{entry.quantity}個・{entry.part?'既存ロット':'新規ロット'}）</label><label>所要時間（分）<input name={'duration-'+entry.key} type="number" min={30} max={525600} step={30} defaultValue={stageEstimate(entry,process,data)} disabled={!selected.includes(entry.key)} required/></label></div>)}
 <div className="form-row"><label>設備<select key={process} name="equipment" required>{data.equipment.filter(e=>e.active!==false&&e.process===process).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label><label>担当者<select name="worker" required>{data.workers.filter(w=>w.active!==false).map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label></div>
 <label>開始可能日時<input name="start" type="datetime-local" value={start} onChange={event=>setStart(event.target.value)} step={1800} required onClick={event=>{try{event.currentTarget.showPicker();}catch{ /* 手入力できるブラウザではそのまま入力 */ }}}/></label><p className="help-text">指定日時以降の設備の空き時間へ、選択したプレートを順に配置します。</p>
 {['machining','grinding','wire'].includes(process)&&<label className="checkbox"><input type="checkbox" name="night"/>勤務時間外・休日の加工開始を許可</label>}
 <div className="modal-actions"><button type="button" className="button" onClick={onClose}>取消</button><button className="button primary" disabled={!selected.length}>選択した{selected.length}件の日程を計算して確認</button></div>
 </form></section></div>;
}
