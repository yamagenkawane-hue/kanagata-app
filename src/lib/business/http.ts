export function sameOrigin(request:Request):boolean{
 try{const origin=request.headers.get("origin");return Boolean(origin&&new URL(origin).host===request.headers.get("host")&&new URL(origin).protocol===new URL(request.url).protocol);}catch{return false;}
}
export async function boundedBody(request:Request,limit:number):Promise<Uint8Array>{
 if(Number(request.headers.get("content-length"))>limit)throw new Error("送信データが大きすぎます");
 const reader=request.body?.getReader();if(!reader)return new Uint8Array();const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new Error("送信データが大きすぎます");}chunks.push(value);}}finally{reader.releaseLock();}
 const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result;
}
