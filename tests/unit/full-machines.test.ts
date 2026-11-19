import assert from "node:assert/strict";
import test from "node:test";
import {createDemo} from "../../src/domain/demo.ts";
import {at} from "../../src/domain/planning.ts";
import {fullMachines} from "../../src/domain/full-machines.ts";

test("availability follows the displayed days, completed actuals and individual machines",()=>{
  const data=createDemo(), day="2026-11-19", next="2026-11-20";
  const machine=data.equipment.find(e=>e.process==="wire")!;
  data.calendar={[day]:true,[next]:true};
  const task={...data.tasks[0],equipmentId:machine.id,status:"completed" as const,actualStart:at(day,530),actualEnd:at(day,1060)};
  data.tasks=[task];
  assert.deepEqual([...fullMachines(data,[day])],[machine.id]);
  assert.equal(fullMachines(data,[day,next]).size,0);
  task.actualEnd=at(day,1050);
  assert.equal(fullMachines(data,[day]).size,0);
  data.calendar[next]=false;
  assert.ok(fullMachines(data,[next]).has(machine.id));
  assert.equal(fullMachines(data,["2026-11-21"]).size,0);
});
