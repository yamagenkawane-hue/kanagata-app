import test from "node:test";
import assert from "node:assert/strict";
import { availableStarts } from "../../src/domain/available-starts.ts";
import { at, type Task } from "../../src/domain/planning.ts";
const day="2026-10-07";
const task:Task={id:"new",partId:"p",process:"machining",equipmentId:"MC1",workerId:"w",duration:60,earliestStart:at(day,530),priority:1,status:"pending",overnight:false,breakRun:false,fixed:false,plannedStart:at(day,530),plannedEnd:at(day,590),segments:[{start:at(day,530),end:at(day,590)}]};
const calendar={[day]:true,"2026-10-08":true};
test("occupied times and starts with insufficient free processing time are excluded",()=>{
 const busy={...task,id:"busy",plannedStart:at(day,590),plannedEnd:at(day,650),segments:[{start:at(day,590),end:at(day,650)}]};
 const slots=availableStarts(day,task,{tasks:[busy],calendar});
 assert.ok(!slots.includes(`${day}T08:50`));assert.ok(!slots.includes(`${day}T09:00`));assert.ok(!slots.includes(`${day}T09:30`));assert.ok(slots.includes(`${day}T11:00`));
});
test("other machines and the task being edited do not block selection",()=>{
 const slots=availableStarts(day,task,{tasks:[task,{...task,id:"other",equipmentId:"MC2"}],calendar});
 assert.ok(slots.includes(`${day}T09:00`));assert.ok(!slots.includes(`${day}T12:00`));assert.ok(!slots.includes(`${day}T12:50`));assert.ok(slots.includes(`${day}T13:00`));
 assert.ok(slots.every(value=>["00","30"].includes(value.slice(-2))));
});
test("holiday, night operation and cross-day conflicts follow scheduling rules",()=>{
 assert.deepEqual(availableStarts(day,task,{tasks:[],calendar:{[day]:false}}),[]);
 const night={...task,overnight:true,duration:120};
 const next={...task,id:"next",segments:[{start:at("2026-10-08",0),end:at("2026-10-08",60)}]};
 const slots=availableStarts(day,night,{tasks:[next],calendar:{}});
 assert.ok(slots.includes(`${day}T22:00`));assert.ok(!slots.includes(`${day}T23:00`));
});
