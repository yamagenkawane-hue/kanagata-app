"use client";
import {useEffect,useRef,type ReactNode} from "react";
export default function PanScroll({children,initialOffset=0}:{children:ReactNode;initialOffset?:number}){
 const container=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(container.current)container.current.scrollLeft=initialOffset;},[initialOffset]);
 const pan=useRef<{id:number;x:number;scroll:number;moved:boolean}|null>(null);
 return <div ref={container} className="gantt-scroll pan-scroll" onPointerDown={event=>{
  if(event.button!==0||(event.target as HTMLElement).closest("button,input,select,a,.frozen"))return;
  pan.current={id:event.pointerId,x:event.clientX,scroll:event.currentTarget.scrollLeft,moved:false};event.currentTarget.setPointerCapture(event.pointerId);
 }} onPointerMove={event=>{const current=pan.current;if(!current||current.id!==event.pointerId)return;const delta=event.clientX-current.x;if(Math.abs(delta)>4)current.moved=true;if(current.moved){event.preventDefault();event.currentTarget.scrollLeft=current.scroll-delta;event.currentTarget.classList.add("panning");}}} onPointerUp={event=>{pan.current=null;event.currentTarget.classList.remove("panning");if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}} onPointerCancel={event=>{pan.current=null;event.currentTarget.classList.remove("panning");}}>{children}</div>;
}
