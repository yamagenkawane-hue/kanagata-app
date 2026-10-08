import test from "node:test";
import assert from "node:assert/strict";
import { createDemo } from "../../src/domain/demo.ts";
import { at, localInput, schedule, placeAtRequestedStart, taskConflicts } from "../../src/domain/planning.ts";

test("half-hour starts align all movable stages and preserve protected tasks",()=>{
 const data=createDemo();
 const protectedTasks=data.tasks.filter(task=>task.fixed||task.status!=="pending");
 const result=schedule(data,30);
 for(const task of result.filter(task=>!task.fixed&&task.status==="pending"))assert.ok(["00","30"].includes(localInput(task.plannedStart).slice(-2)));
 for(const task of protectedTasks)assert.deepEqual(result.find(item=>item.id===task.id),task);
 assert.equal(taskConflicts(result).length,0);
 assert.deepEqual(schedule({...data,tasks:result},30),result);
});

test("align first start after breaks but retain exact duration through continuation",()=>{
 const data=createDemo();const task={...data.tasks[0],process:"machining" as const,duration:60,earliestStart:at("2026-09-30",770),overnight:false,breakRun:false};
 const lunch=placeAtRequestedStart(task,data.calendar,30);
 assert.equal(lunch.plannedStart,at("2026-09-30",780));
 const afternoon=placeAtRequestedStart({...task,earliestStart:at("2026-09-30",910)},data.calendar,30);
 assert.equal(afternoon.plannedStart,at("2026-09-30",930));
 const crossing=placeAtRequestedStart({...task,duration:240,earliestStart:at("2026-09-30",530)},data.calendar,30);
 assert.equal(crossing.plannedStart,at("2026-09-30",540));
 assert.equal(crossing.plannedEnd,at("2026-09-30",830));
 assert.equal(crossing.segments[1].start,at("2026-09-30",770));
});
