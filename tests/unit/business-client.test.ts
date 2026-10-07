import test from "node:test";
import assert from "node:assert/strict";
import { businessRequest, SaveOutcomeUnknownError } from "../../src/lib/business/client.ts";

test("stalled save request times out and aborts",async()=>{
 let signal:AbortSignal|undefined;
 const request:typeof fetch=async(_url,options)=>{signal=options?.signal as AbortSignal;return new Promise(()=>{});};
 await assert.rejects(businessRequest({},request,10),SaveOutcomeUnknownError);
 assert.equal(signal?.aborted,true);
});
test("stalled response body also times out",async()=>{
 const request:typeof fetch=async()=>({ok:true,json:()=>new Promise(()=>{})}) as Response;
 await assert.rejects(businessRequest({},request,10),SaveOutcomeUnknownError);
});
test("successful response and revision conflict are preserved",async()=>{
 const data={tasks:[],revision:2};
 assert.deepEqual(await businessRequest({},async()=>Response.json({data}),100),data);
 await assert.rejects(businessRequest({},async()=>Response.json({error:"最新データで再計算してください"},{status:409}),100),/最新データ/);
});
test("network loss or invalid response requires checking the save outcome",async()=>{
 await assert.rejects(businessRequest({},async()=>{throw new Error("offline");},100),SaveOutcomeUnknownError);
 await assert.rejects(businessRequest({},async()=>new Response("<html>error</html>"),100),SaveOutcomeUnknownError);
});
