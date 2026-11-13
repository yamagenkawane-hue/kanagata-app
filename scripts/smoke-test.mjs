import assert from "node:assert/strict";

// Read-only checks. This script never creates accounts, plans, or work logs.
const base=new URL(process.env.SMOKE_BASE_URL??"http://127.0.0.1:3000");
if(!["http:","https:"].includes(base.protocol)||base.username||base.password)throw new Error("SMOKE_BASE_URLを確認してください。");
async function request(path,options={}){
 return fetch(new URL(path,base),{redirect:"manual",...options,signal:AbortSignal.timeout(30_000)});
}
let failures=0;
async function check(name,run){try{await run();console.log(`PASS ${name}`);}catch(cause){failures++;console.error(`FAIL ${name}: ${cause.message}`);}}
await check("ログイン画面",async()=>{const response=await request("/login");assert.equal(response.status,200);assert.match(await response.text(),/生産管理 ログイン/);});
await check("DB画面は未ログインで入れない",async()=>{const response=await request("/workspace");assert.ok([303,307,308].includes(response.status));assert.equal(new URL(response.headers.get("location"),base).pathname,"/login");});
await check("運用確認は未ログインで入れない",async()=>{const response=await request("/workspace/readiness");assert.ok([303,307,308].includes(response.status));assert.equal(new URL(response.headers.get("location"),base).pathname,"/login");});
for(const path of ["/api/business","/api/business/export"]){await check(`${path} は未ログインで取得不可`,async()=>{const response=await request(path);assert.equal(response.status,401);assert.match(response.headers.get("cache-control"),/no-store/);});}
await check("別サイトからのログイン要求は拒否",async()=>{const response=await request("/api/auth/login",{method:"POST",headers:{Origin:"https://invalid.example","Content-Type":"application/json"},body:'{"userId":"admin","password":"admin"}'});assert.equal(response.status,403);});
await check("デモログインはDBセッションを発行しない",async()=>{const response=await request("/api/auth/login",{method:"POST",headers:{Origin:base.origin,"Content-Type":"application/json"},body:'{"userId":"admin","password":"admin"}'});assert.equal(response.status,200);assert.equal((await response.json()).demo,true);assert.equal(response.headers.get("set-cookie"),null);});
await check("デモ計画画面",async()=>{const response=await request("/demo");assert.equal(response.status,200);assert.match(await response.text(),/金型別 生産計画/);});
if(failures)process.exitCode=1;
console.log(`${8-failures}/8 checks passed`);
