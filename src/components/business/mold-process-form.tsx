"use client";
import StartDateInput from "@/components/business/start-date-input";
import { useState } from "react";
import { enteredDuration } from "@/domain/duration";
import { at, fromLocalInput, localInput, type PlanData, type ProcessCode, type Task } from "@/domain/planning";

export default function MoldProcessForm({ data, startDate, onPreview, onClose }: { data: PlanData; startDate: string; onPreview: (data: PlanData, title: string) => void; onClose: () => void }) {
  const [productId, setProductId] = useState(data.products[0]?.id ?? "");
  const [process, setProcess] = useState<ProcessCode>("assembly");
  const [error, setError] = useState("");
  const exists = data.parts.some(part => part.productId === productId && part.scope === "mold" && !part.archived && part.processes?.includes(process));
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (!data.products.some(product => product.id === productId) || exists) throw new Error("金型を選択してください。登録済みの単体工程はガントから編集できます。");
      const form = new FormData(event.currentTarget);
      const equipmentId = "", workerId = String(form.get("worker"));
      if (!data.workers.some(item => item.id === workerId && item.active !== false)) throw new Error("担当者を選択してください。");
      const partId = crypto.randomUUID(), name = process === "assembly" ? "型組" : "トライ";
      const task: Task = { id: crypto.randomUUID(), partId, process, equipmentId, workerId, pressNo: String(form.get("pressNo") ?? "").trim(), duration: enteredDuration(process, Number(form.get("days"))), earliestStart: fromLocalInput(String(form.get("earliest"))), priority: 1, status: "pending", breakRun: false, overnight: false, fixed: false, plannedStart: "", plannedEnd: "", segments: [] };
      onPreview({ ...data, parts: [...data.parts, { id: partId, productId, scope: "mold", name, quantity: 1, drawingNumber: "", processes: [process] }], tasks: [...data.tasks, task] }, `${name}を金型単位で登録`);
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "入力を確認してください。"); }
  }
  return <div className="modal-overlay"><section className="modal" role="dialog" aria-modal="true" aria-label="金型単体工程を登録"><div className="panel-header"><h2>型組・トライを登録</h2><button className="icon-button" onClick={onClose} aria-label="閉じる">×</button></div>{error && <div className="inline-error" role="alert">{error}</div>}<form onSubmit={submit}><label>金型<select value={productId} onChange={event => setProductId(event.target.value)} required><option value="">選択してください</option>{data.products.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>工程<select value={process} onChange={event => setProcess(event.target.value as ProcessCode)}><option value="assembly">型組</option><option value="trial">トライ</option></select></label>{exists && <p role="status">この単体工程は登録済みです。ガントの編集ボタンから変更できます。</p>}<label>使用プレスNo<input name="pressNo" maxLength={40} placeholder="未定の場合は空欄" /></label><label>担当者<select name="worker" required>{data.workers.filter(item => item.active !== false).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>所要日数（日）<input name="days" type="number" min={1} step={1} defaultValue={1} required /></label><label>開始可能日時<StartDateInput name="earliest" defaultValue={localInput(at(startDate, 530))} required /></label><p className="help-text">1日＝実働7時間50分。型組は金型の加工終了後、トライは型組終了後に配置します。未登録の工程は待ちません。</p><div className="modal-actions"><button className="button" type="button" onClick={onClose}>取消</button><button className="button primary" disabled={exists || !productId}>日程を計算して確認</button></div></form></section></div>;
}
