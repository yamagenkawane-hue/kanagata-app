import test from "node:test";
import assert from "node:assert/strict";
import {partProgress} from "../../src/domain/part-progress.ts";
import {createDemo} from "../../src/domain/demo.ts";

test("plate progress shows the latest consecutively completed required process",()=>{
 const data=createDemo(),source=data.tasks[0];const codes=["machining","grinding","wire"];
 const tasks=codes.map((process,index)=>({...source,id:String(index),process,status:index===0?"completed" as const:"pending" as const}));
 assert.equal(partProgress(tasks,codes,data),"マシニング完了");
 assert.equal(partProgress([],codes,data),"予定未登録");
 assert.equal(partProgress(tasks.map(task=>({...task,status:"pending"})),codes,data),"未着手");
 assert.equal(partProgress([...tasks,{...tasks[0],id:"other",status:"pending"}],codes,data),"マシニング 一部完了");
 assert.equal(partProgress(tasks.map(task=>({...task,status:"completed"})),codes,data),"ワイヤー完了");
});
