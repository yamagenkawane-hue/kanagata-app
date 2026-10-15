import test from "node:test";
import assert from "node:assert/strict";
import {at,placeAtRequestedStart,type Task} from "../../src/domain/planning.ts";

test("three machining processes starting at 17:30 finish at 18:30, with no night flag",()=>{
 for(const process of ["machining","grinding","wire"]){
  const task:Task={id:"t",partId:"p",process,equipmentId:"m",workerId:"w",duration:60,earliestStart:at("2026-10-16",1050),plannedStart:"",plannedEnd:"",segments:[],priority:1,status:"pending",fixed:false,breakRun:false,overnight:false};
  const placed=placeAtRequestedStart(task,{"2026-10-16":true},30);
  assert.equal(placed.plannedEnd,at("2026-10-16",1110));assert.equal(placed.segments.length,1);
  const weekend=placeAtRequestedStart({...task,duration:480},{"2026-10-16":true},30);
  assert.equal(weekend.plannedEnd,at("2026-10-17",90));
  const holiday=placeAtRequestedStart({...task,earliestStart:at("2026-10-17",540)},{"2026-10-17":false,"2026-10-18":false,"2026-10-19":true},30);
  assert.equal(holiday.plannedStart,at("2026-10-19",540));
 }
});
