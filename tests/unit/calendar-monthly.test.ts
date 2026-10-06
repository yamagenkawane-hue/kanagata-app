import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { parseCalendarExcel } from "../../src/domain/calendar-excel.ts";

async function calendar(year=2026,change?: (sheet:ExcelJS.Worksheet)=>void){
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet("印刷用");let total=0,holidays=0;
 for(let month=1;month<=12;month++){
  const row=[14,24,33,43][Math.floor((month-1)/3)],col=[1,9,17][(month-1)%3];
  sheet.getCell(row,col).value=`${month}月`;
  ["SUN","MON","TUE","WED","THU","FRI","SAT"].forEach((day,index)=>sheet.getCell(row+1,col+index).value=day);
  const last=new Date(Date.UTC(year,month,0)).getUTCDate(),first=new Date(Date.UTC(year,month-1,1)).getUTCDay();
  const off=new Set<string>();
  for(let day=1;day<=last;day++){
   const r=row+2+Math.floor((first+day-1)/7),c=col+(first+day-1)%7;
   sheet.getCell(r,c).value=day;total++;
   if([0,6].includes((first+day-1)%7)||(month===1&&day<=4)||(month===5&&day>=3&&day<=6)){off.add(`${r},${c}`);holidays++;}
  }
  for(const key of off){const [r,c]=key.split(",").map(Number);sheet.getCell(r,c).border={top:off.has(`${r-1},${c}`)?undefined:{style:"thin"},bottom:off.has(`${r+1},${c}`)?undefined:{style:"thin"},left:off.has(`${r},${c-1}`)?undefined:{style:"thin"},right:off.has(`${r},${c+1}`)?undefined:{style:"thin"}};}
 }
 sheet.getCell("A53").value=`※営業日${total-holidays}日／休日${holidays}日`;
 sheet.getCell("N53").value=`〔 ${year+1}年 1/3まで休み 〕`;
 change?.(sheet);
 return {bytes:new Uint8Array(await book.xlsx.writeBuffer()),total,holidays};
}

test("month grids read connected holiday outlines and next-year holiday notes",async()=>{
 const input=await calendar();const days=await parseCalendarExcel(input.bytes,"2026カレンダー.xlsx");
 const current=days.filter(day=>day.date.startsWith("2026"));
 assert.equal(current.length,365);assert.equal(current.filter(day=>!day.working).length,input.holidays);
 assert.equal(days.find(day=>day.date==="2026-05-05")!.working,false);
 assert.equal(days.find(day=>day.date==="2026-05-07")!.working,true);
 assert.deepEqual(days.slice(-3),[1,2,3].map(day=>({date:`2027-01-0${day}`,working:false})));
});

test("leap year and shifted grid position are recognized",async()=>{
 const input=await calendar(2028);const days=await parseCalendarExcel(input.bytes,"2028カレンダー.xlsx");
 assert.equal(days.filter(day=>day.date.startsWith("2028")).length,366);
 assert.ok(days.some(day=>day.date==="2028-02-29"));
});

test("missing year, mismatched year, missing dates, wrong totals and damaged outlines fail safely",async()=>{
 const input=await calendar();
 await assert.rejects(()=>parseCalendarExcel(input.bytes,"カレンダー.xlsx"),/対象年/);
 await assert.rejects(()=>parseCalendarExcel(input.bytes,"2027カレンダー.xlsx"),/対象年/);
 const missing=await calendar(2026,sheet=>{sheet.getCell("E16").value=null;});
 await assert.rejects(()=>parseCalendarExcel(missing.bytes,"2026.xlsx"),/不足/);
 const totals=await calendar(2026,sheet=>{sheet.getCell("A53").value="営業日1日／休日364日";});
 await assert.rejects(()=>parseCalendarExcel(totals.bytes,"2026.xlsx"),/一致しません/);
 const border=await calendar(2026,sheet=>{sheet.getCell("E16").border={};});
 await assert.rejects(()=>parseCalendarExcel(border.bytes,"2026.xlsx"),/一致しません/);
});
