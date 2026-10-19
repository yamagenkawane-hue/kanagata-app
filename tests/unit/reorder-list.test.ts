import test from "node:test";
import assert from "node:assert/strict";
import {createDemo} from "../../src/domain/demo.ts";
import {reorderList} from "../../src/domain/reorder-list.ts";
import {taskConflicts} from "../../src/domain/planning.ts";

test("list insertion changes machine order and gantt times without mutating input",()=>{
 const data=createDemo();const before=structuredClone(data);
 const result=reorderList(data,"a5-machining","a3-machining",false);
 const a=result.tasks.find(task=>task.id==="a5-machining")!,b=result.tasks.find(task=>task.id==="a3-machining")!;
 assert.ok(a.priority<b.priority);assert.ok(Date.parse(a.plannedEnd)<=Date.parse(b.plannedStart));
 assert.equal(taskConflicts(result.tasks).length,0);assert.deepEqual(data,before);
 const after=reorderList(result,a.id,b.id,true);
 assert.ok(after.tasks.find(task=>task.id===a.id)!.priority>after.tasks.find(task=>task.id===b.id)!.priority);
 for(const task of data.tasks.filter(task=>task.fixed||task.status!=="pending"))assert.deepEqual(result.tasks.find(item=>item.id===task.id),task);
});
test("list cannot reorder completed, fixed or different machine tasks",()=>{
 const data=createDemo();const source=data.tasks.find(task=>task.id==="a5-machining")!;
 for(const patch of [{fixed:true},{status:"completed" as const},{actualStart:source.plannedStart}])assert.throws(()=>reorderList({...data,tasks:data.tasks.map(task=>task.id===source.id?{...task,...patch}:task)},source.id,"a3-machining",false));
 assert.throws(()=>reorderList(data,source.id,"a2-machining",false));
});
