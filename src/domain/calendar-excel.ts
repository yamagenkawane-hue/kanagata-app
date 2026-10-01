import ExcelJS from "exceljs";
export function checkZipSize(bytes:Uint8Array){
 const buffer=Buffer.from(bytes);let total=0;let entries=0;
 for(let i=0;i<=buffer.length-46;i++){if(buffer.readUInt32LE(i)===0x02014b50){total+=buffer.readUInt32LE(i+24);entries++;if(total>12_000_000||entries>300)throw new Error("Excelの展開サイズが大きすぎます");i+=45+buffer.readUInt16LE(i+28)+buffer.readUInt16LE(i+30)+buffer.readUInt16LE(i+32);}}
 if(!entries)throw new Error("有効なxlsxファイルではありません");
}
export async function parseCalendarExcel(bytes:Uint8Array){
 checkZipSize(bytes);const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Uint8Array.from(bytes).buffer);const sheet=workbook.worksheets[0];
 if(!sheet||sheet.rowCount>2001)throw new Error("先頭シートは2000日以内にしてください");
 const header=sheet.getRow(1);let dateCol=0,workingCol=0;header.eachCell((cell,col)=>{if(cell.text.trim()==="日付")dateCol=col;if(cell.text.trim()==="稼働日")workingCol=col;});
 if(!dateCol||!workingCol)throw new Error("先頭行に「日付」「稼働日」列が必要です。テンプレートを確認してください");
 const days:{date:string;working:boolean}[]=[];const seen=new Set<string>();
 for(let i=2;i<=sheet.rowCount;i++){const row=sheet.getRow(i);const value=row.getCell(dateCol).value;if(value===null&&row.getCell(workingCol).value===null)continue;let date:string;
  if(value instanceof Date)date=value.toISOString().slice(0,10);else if(typeof value==="string")date=value.trim().replaceAll("/","-").replace(/^(\d{4})-(\d{1,2})-(\d{1,2})$/,(_,y,m,d)=>`${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`);else throw new Error(`${i}行目の日付形式が不正です`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||seen.has(date))throw new Error(`${i}行目の日付が不正または重複しています`);
  const text=row.getCell(workingCol).text.trim();if(!["1","0","稼働","休日"].includes(text))throw new Error(`${i}行目の稼働日は1／0または稼働／休日にしてください`);
  seen.add(date);days.push({date,working:text==="1"||text==="稼働"});
 }
 if(!days.length)throw new Error("取り込む日付がありません");return days;
}
