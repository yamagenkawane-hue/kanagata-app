import ExcelJS from "exceljs";
export function checkZipSize(bytes:Uint8Array){
 const buffer=Buffer.from(bytes);let total=0;let entries=0;
 for(let i=0;i<=buffer.length-46;i++){if(buffer.readUInt32LE(i)===0x02014b50){total+=buffer.readUInt32LE(i+24);entries++;if(total>12_000_000||entries>300)throw new Error("Excelの展開サイズが大きすぎます");i+=45+buffer.readUInt16LE(i+28)+buffer.readUInt16LE(i+30)+buffer.readUInt16LE(i+32);}}
 if(!entries)throw new Error("有効なxlsxファイルではありません");
}
export async function parseCalendarExcel(bytes:Uint8Array,fileName=""){
 checkZipSize(bytes);const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Uint8Array.from(bytes).buffer);const sheet=workbook.worksheets[0];
 if(!sheet||sheet.rowCount>2001)throw new Error("先頭シートは2000日以内にしてください");
 const header=sheet.getRow(1);let dateCol=0,workingCol=0;header.eachCell((cell,col)=>{if(cell.text.trim()==="日付")dateCol=col;if(cell.text.trim()==="稼働日")workingCol=col;});
 if(!dateCol||!workingCol)return parseMonthlyCalendar(sheet,fileName);
 const days:{date:string;working:boolean}[]=[];const seen=new Set<string>();
 for(let i=2;i<=sheet.rowCount;i++){const row=sheet.getRow(i);const value=row.getCell(dateCol).value;if(value===null&&row.getCell(workingCol).value===null)continue;let date:string;
  if(value instanceof Date)date=value.toISOString().slice(0,10);else if(typeof value==="string")date=value.trim().replaceAll("/","-").replace(/^(\d{4})-(\d{1,2})-(\d{1,2})$/,(_,y,m,d)=>`${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`);else throw new Error(`${i}行目の日付形式が不正です`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||seen.has(date))throw new Error(`${i}行目の日付が不正または重複しています`);
  const text=row.getCell(workingCol).text.trim();if(!["1","0","稼働","休日"].includes(text))throw new Error(`${i}行目の稼働日は1／0または稼働／休日にしてください`);
  seen.add(date);days.push({date,working:text==="1"||text==="稼働"});
 }
 if(!days.length)throw new Error("取り込む日付がありません");return days;
}

function parseMonthlyCalendar(sheet:ExcelJS.Worksheet,fileName:string){
 const months=new Map<number,ExcelJS.Cell>();const texts:string[]=[];
 if(sheet.columnCount>100)throw new Error("カレンダーの列数が多すぎます");
 sheet.eachRow(row=>row.eachCell(cell=>{const text=cell.text.trim();texts.push(text);const match=text.match(/^(\d{1,2})月$/);if(match){const month=Number(match[1]);if(month>=1&&month<=12){if(months.has(month))throw new Error("月の表示が重複しています");months.set(month,cell);}}}));
 if(months.size!==12)throw new Error("先頭行の「日付」「稼働日」一覧、または1月～12月の会社カレンダーが必要です");
 const yearMatch=fileName.match(/(?:^|\D)(20\d{2})(?!\d)/);
 if(!yearMatch)throw new Error("月別カレンダーのファイル名に対象年を入れてください（例：2026カレンダー.xlsx）");
 const year=Number(yearMatch[1]);const days:{date:string;working:boolean}[]=[];
 const weekdays=[["SUN","日","日曜","日曜日"],["MON","月","月曜","月曜日"],["TUE","火","火曜","火曜日"],["WED","水","水曜","水曜日"],["THU","木","木曜","木曜日"],["FRI","金","金曜","金曜日"],["SAT","土","土曜","土曜日"]];
 for(const [month,heading] of [...months].sort(([a],[b])=>a-b)){
  const row=Number(heading.row),col=Number(heading.col);const cells=new Map<string,ExcelJS.Cell>();const seen=new Set<number>();
  for(let offset=0;offset<7;offset++)if(!weekdays[offset].includes(sheet.getCell(row+1,col+offset).text.trim().toUpperCase()))throw new Error(`${month}月の曜日行を読み取れません（日曜始まりが必要です）`);
  const last=new Date(Date.UTC(year,month,0)).getUTCDate();const firstWeekday=new Date(Date.UTC(year,month-1,1)).getUTCDay();
  for(let r=row+2;r<row+8;r++)for(let c=col;c<col+7;c++){
   const cell=sheet.getCell(r,c);if(!cell.text.trim())continue;const day=Number(cell.text);
   if(!Number.isInteger(day)||day<1||day>last||seen.has(day)||c-col!==(firstWeekday+day-1)%7||r-row-2!==Math.floor((firstWeekday+day-1)/7))throw new Error(`${month}月の日付・配置が対象年と一致しません。欠落・重複・対象年を確認してください`);
   seen.add(day);cells.set(`${r},${c}`,cell);
  }
  if(seen.size!==last)throw new Error(`${month}月の日付が不足しています`);
  const visited=new Set<string>();const holidays=new Set<number>();
  const directions=[[-1,0,"top","bottom"],[1,0,"bottom","top"],[0,-1,"left","right"],[0,1,"right","left"]] as const;
  for(const key of cells.keys()){
   if(visited.has(key))continue;const pending=[key],group:ExcelJS.Cell[]=[];let open=false;
   while(pending.length){const pos=pending.pop()!;if(visited.has(pos))continue;visited.add(pos);const cell=cells.get(pos)!;group.push(cell);
    for(const [dr,dc,side,opposite] of directions){const next=`${Number(cell.row)+dr},${Number(cell.col)+dc}`,neighbor=cells.get(next);
     if(cell.border?.[side]?.style||neighbor?.border?.[opposite]?.style)continue;
     if(!neighbor)open=true;else if(!visited.has(next))pending.push(next);
    }
   }
   if(!open)for(const cell of group)holidays.add(Number(cell.text));
  }
  for(let day=1;day<=last;day++)days.push({date:`${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`,working:!holidays.has(day)});
 }
 const holidayCount=days.filter(day=>!day.working).length;
 const summary=texts.join(" ").match(/(?:営業|稼働)日\s*(\d+)日\s*[／/]\s*休日\s*(\d+)日/);
 if(!summary)throw new Error("月別カレンダーには「営業日252日／休日113日」のような年間合計が必要です。枠線の読取結果を照合します");
 if(Number(summary[1])!==days.length-holidayCount||Number(summary[2])!==holidayCount)throw new Error(`枠線から読み取った稼働${days.length-holidayCount}日・休日${holidayCount}日が年間合計と一致しません。休日の枠線を確認してください`);
 for(const text of texts){const note=text.match(/(20\d{2})年\s*(\d{1,2})\/(\d{1,2})\s*まで休み/);if(!note)continue;
  const noteYear=Number(note[1]),month=Number(note[2]),day=Number(note[3]);
  if(noteYear!==year+1||month!==1||day<1||day>31)throw new Error("翌年の年始休暇の注記を確認してください（翌年1月の日付に対応）");
  for(let d=1;d<=day;d++){const date=`${noteYear}-01-${String(d).padStart(2,"0")}`;if(!days.some(item=>item.date===date))days.push({date,working:false});}
 }
 return days;
}
