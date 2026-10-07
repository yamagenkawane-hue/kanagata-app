import test from "node:test";
import assert from "node:assert/strict";
import { taskChanges } from "../../src/domain/task-changes.ts";
import { createDemo } from "../../src/domain/demo.ts";
import { at } from "../../src/domain/planning.ts";

test("equivalent DB timestamps, property order and optional defaults are not schedule changes",()=>{
 const old=createDemo().tasks[0];const next={...old,manualOverride:false,pressNo:"",plannedStart:old.plannedStart.replace(".000Z","+00:00"),segments:[...old.segments].reverse().map(segment=>({end:segment.end.replace(".000Z","+00:00"),start:segment.start.replace(".000Z","+00:00")}))};
 assert.deepEqual(taskChanges(old,next),[]);
});
test("new, moved, priority-only and start-request-only changes are distinguished",()=>{
 const old=createDemo().tasks[0];assert.deepEqual(taskChanges(undefined,old),["新規登録"]);
 assert.ok(taskChanges(old,{...old,plannedStart:at("2026-10-07",530)}).includes("予定開始"));
 assert.deepEqual(taskChanges(old,{...old,priority:old.priority+1}),["加工順"]);
 assert.deepEqual(taskChanges(old,{...old,earliestStart:at("2026-10-07",530)}),["開始可能日時"]);
});
test("equivalent segment splits do not create rows, while actual work interval changes do",()=>{
 const old={...createDemo().tasks[0],plannedStart:at("2026-10-07",530),plannedEnd:at("2026-10-07",590),segments:[{start:at("2026-10-07",530),end:at("2026-10-07",590)}]};
 assert.deepEqual(taskChanges(old,{...old,segments:[{start:at("2026-10-07",530),end:at("2026-10-07",560)},{start:at("2026-10-07",560),end:at("2026-10-07",590)}]}),[]);
 assert.deepEqual(taskChanges(old,{...old,segments:[{start:at("2026-10-07",540),end:at("2026-10-07",590)}]}),["稼働区間"]);
});
