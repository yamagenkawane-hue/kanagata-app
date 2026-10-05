import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { parseCalendarExcel } from "../../src/domain/calendar-excel.ts";
import { remainingQuantity, orderedProcesses, masterSchemas } from "../../src/domain/business.ts";
import { createDemo } from "../../src/domain/demo.ts";
import { schedule } from "../../src/domain/planning.ts";
test("selected processes skip unused stages while keeping the standard order",()=>{
 const data=createDemo();const part=data.parts[0];part.processes=["machining","wire"];data.parts=[part];data.tasks=data.tasks.filter(t=>t.partId===part.id&&part.processes!.includes(t.process));data.tasks=data.tasks.map(t=>({...t,status:"pending" as const,fixed:false}));const tasks=schedule(data);assert.equal(tasks.length,2);assert.ok(Date.parse(tasks[1].plannedStart)>=Date.parse(tasks[0].plannedEnd));assert.deepEqual(orderedProcesses(["wire","machining"]),["machining","wire"]);
});
test("quantity accounts for split batches and releases cancelled quantities",()=>{
 const data=createDemo();data.bom=[{id:"b",productId:"p1",name:"部品",kind:"part",quantity:4,notes:"",processes:["wire"],archived:false}];data.parts=[{id:"1",productId:"p1",bomId:"b",name:"部品",quantity:2,drawingNumber:""},{id:"2",productId:"p1",bomId:"b",name:"部品",quantity:1,drawingNumber:"",archived:true}];assert.equal(remainingQuantity(data,"b"),2);
});
test("BOM input requires at least one process",()=>{assert.equal(masterSchemas.bom.safeParse({productId:"11111111-1111-4111-8111-111111111111",name:"部品",kind:"part",quantity:1,notes:"",processes:[],archived:false}).success,false);});
async function workbook(rows:unknown[][]){const w=new ExcelJS.Workbook();const s=w.addWorksheet("会社カレンダー");for(const row of rows)s.addRow(row);return new Uint8Array(await w.xlsx.writeBuffer());}
test("Excel accepts normalized dates and explicit working day values",async()=>{const days=await parseCalendarExcel(await workbook([["日付","稼働日"],["2026/10/1",1],["2026-10-02","休日"]]));assert.deepEqual(days,[{date:"2026-10-01",working:true},{date:"2026-10-02",working:false}]);});
test("Excel rejects duplicate dates, invalid values and missing headers",async()=>{
 await assert.rejects(()=>parseCalendarExcel(Buffer.from("invalid")),/xlsx/);
 await assert.rejects(async()=>parseCalendarExcel(await workbook([["日付","稼働日"],["2026-10-01",1],["2026-10-01",0]])),/重複/);
 await assert.rejects(async()=>parseCalendarExcel(await workbook([["日付","稼働日"],["2026-02-30",1]])),/不正/);
 await assert.rejects(async()=>parseCalendarExcel(await workbook([["日付","稼働日"],["2026-10-01","不明"]])),/稼働日/);
 await assert.rejects(async()=>parseCalendarExcel(await workbook([["date","working"],["2026-10-01",1]])),/先頭行/);
});
