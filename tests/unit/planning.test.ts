import test from "node:test";
import assert from "node:assert/strict";
import { createDemo } from "../../src/domain/demo.ts";
import { at, calculateWorkMinutes, movePriority, schedule, taskConflicts, workMinutesByDay } from "../../src/domain/planning.ts";
import type { PlanData } from "../../src/domain/planning.ts";
function singlePart(): PlanData {
  const source = createDemo(); const part = source.parts[0];
  return { ...source, parts: [part], products: [source.products[0]], tasks: source.tasks.filter((task) => task.partId === part.id).map((task) => ({ ...task, status: "pending", actualStart: undefined, actualEnd: undefined, fixed: false, priority: 1 })) };
}
test("昼休みを交差した実績は60分", () => { assert.equal(calculateWorkMinutes(at("2026-09-30", 690), at("2026-09-30", 800)), 60); });
test("午後の10分休憩と半開区間を正しく扱う", () => { assert.equal(calculateWorkMinutes(at("2026-09-30", 890), at("2026-09-30", 920)), 20); assert.equal(calculateWorkMinutes(at("2026-09-30", 770), at("2026-09-30", 800)), 30); });
test("日またぎ実績を日本時間で分割する", () => {
  const log = { id: "x", taskId: "t", workerId: "w", start: at("2026-09-30", 1410), end: at("2026-10-01", 30), calculatedMinutes: 60, reason: "", breaks: [[720,770],[900,910]] as [number,number][], editedBy: "w" };
  assert.deepEqual(workMinutesByDay(log), [{ date: "2026-09-30", minutes: 30 }, { date: "2026-10-01", minutes: 30 }]);
});
test("終了が開始以前の実績を拒否する", () => { assert.throws(() => calculateWorkMinutes(at("2026-09-30", 600), at("2026-09-30", 600)), /終了時刻/); });
test("8:50開始の240分タスクは昼休みをまたぎ13:40終了", () => {
  const source = singlePart(); const tasks = schedule(source); assert.equal(tasks[0].plannedStart, at("2026-09-30",530)); assert.equal(tasks[0].plannedEnd, at("2026-09-30",820)); assert.equal(tasks[0].segments.length,2);
});
test("通常工程は会社休日を繰り越す", () => {
  const source = singlePart(); source.tasks[0].earliestStart=at("2026-10-02",1030); source.tasks[0].duration=120;
  const result=schedule(source); assert.equal(result[0].plannedEnd, at("2026-10-05",620));
});
test("夜間指定は休日も連続して動く", () => {
  const source=singlePart(); source.tasks[0].earliestStart=at("2026-10-02",1380); source.tasks[0].duration=120; source.tasks[0].overnight=true;
  assert.equal(schedule(source)[0].plannedEnd,at("2026-10-03",60));
});
test("飛び込み順位で設備の後続と後工程が移動し重複しない", () => {
  const source=createDemo(); const original=source.tasks.find((task)=>task.id==="a3-machining")!;
  const tasks=movePriority(source.tasks,"a5-machining",1); const result=schedule({...source,tasks});
  const a5=result.find((task)=>task.id==="a5-machining")!, a3=result.find((task)=>task.id==="a3-machining")!;
  assert.ok(new Date(a5.plannedEnd)<=new Date(a3.plannedStart)); assert.ok(new Date(a3.plannedEnd)>new Date(original.plannedEnd)); assert.equal(taskConflicts(result).length,0);
  for(const task of source.tasks.filter((item)=>item.status!=="pending")) assert.deepEqual(result.find((item)=>item.id===task.id),task);
});
test("固定予定を動かさず実績完了時刻から後工程を計算する", () => {
  const source=singlePart(); source.tasks=schedule(source); const first=source.tasks[0]; first.status="completed"; first.actualStart=first.plannedStart; first.actualEnd=at("2026-10-01",600);
  const result=schedule(source); assert.equal(result[0].plannedEnd, first.plannedEnd); assert.ok(new Date(result[1].plannedStart)>=new Date(first.actualEnd));
});
test("固定予定に先行工程が間に合わない場合を拒否する", () => {
  const source=singlePart(); source.tasks=schedule(source); source.tasks[1].fixed=true; source.tasks[0].duration=480; assert.throws(()=>schedule(source),/固定予定/);
});
test("未設定カレンダーと30分でない所要時間を拒否する", () => {
  const source=singlePart(); delete source.calendar["2026-09-30"]; assert.throws(()=>schedule(source),/カレンダーが未設定/);
  source.calendar["2026-09-30"]=true; source.tasks[0].duration=35; assert.throws(()=>schedule(source),/30分単位/);
});
test("計算は入力を変更せず、同じ入力で同じ結果となる", () => { const source=createDemo(); const snapshot=JSON.stringify(source); assert.deepEqual(schedule(source),schedule(source)); assert.equal(JSON.stringify(source),snapshot); });

test("早く完了した工程の元予定との重なりを設備重複と誤判定しない",()=>{
  const source=singlePart(); source.tasks=schedule(source); const first=source.tasks[0]; first.status="completed"; first.actualStart=first.plannedStart; first.actualEnd=at("2026-09-30", 720);
  const other={...source.tasks[1], id:"another", equipmentId:first.equipmentId, plannedStart:at("2026-09-30",770),plannedEnd:at("2026-09-30",800),segments:[{start:at("2026-09-30",770),end:at("2026-09-30",800)}]};
  assert.equal(taskConflicts([first,other]).length,0);
});

test("手動配置は空き時間へ移動せず、設備重複を検出する",async()=>{
  const {placeAtRequestedStart}=await import("../../src/domain/planning.ts"); const source=createDemo(); const target=source.tasks.find((task)=>task.id==="a5-machining")!;
  const manual=placeAtRequestedStart({...target,earliestStart:at("2026-09-30",850)},source.calendar);
  assert.equal(manual.plannedStart,at("2026-09-30",850));
  assert.ok(taskConflicts(source.tasks.map((task)=>task.id===target.id?manual:task)).length>0);
});
