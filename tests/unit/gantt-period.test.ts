import test from "node:test";
import assert from "node:assert/strict";
import {createDemo} from "../../src/domain/demo.ts";
import {ganttPeriod} from "../../src/domain/gantt-period.ts";
import {ganttRows} from "../../src/domain/gantt-rows.ts";
import {at} from "../../src/domain/planning.ts";

test("completed gantt uses exact actual timestamps while preserving original plan",()=>{
 const source=createDemo().tasks[0];
 const task={...source,status:"completed" as const,actualStart:at("2026-10-16",601),actualEnd:at("2026-10-16",647)};
 assert.deepEqual(ganttPeriod(task),{start:task.actualStart,end:task.actualEnd,actual:true});
 assert.equal(task.plannedStart,source.plannedStart);
 assert.equal(ganttPeriod({...task,actualEnd:undefined}).actual,false);
 assert.equal(ganttPeriod({...task,status:"pending"}).actual,false);
});
test("row packing uses actual periods to avoid overlapping completed bars",()=>{
 const source=createDemo().tasks[0];
 const a={...source,id:"actual-a",status:"completed" as const,actualStart:at("2026-10-16",600),actualEnd:at("2026-10-16",660)};
 const b={...a,id:"actual-b",actualStart:at("2026-10-16",630),actualEnd:at("2026-10-16",690),plannedStart:at("2026-10-17",540),plannedEnd:at("2026-10-17",600)};
 assert.equal(ganttRows([a,b]).length,2);
 assert.equal(ganttRows([a,{...b,actualStart:a.actualEnd}]).length,1);
});
