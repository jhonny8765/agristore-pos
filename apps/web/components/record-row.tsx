"use client";
import type {ComponentProps} from 'react';

/** Keep native table semantics and the named button for keyboard activation. */
export function RecordRow({onOpen,className='',children,...props}:ComponentProps<'tr'>&{onOpen:()=>void}){
 return <tr {...props} className={`record-row ${className}`} onClick={event=>{
  if((event.target as Element).closest('button,a,input,select,textarea,label,summary,details,[role=button],[role=link]'))return;
  if(window.getSelection()?.toString())return;
  onOpen();
 }}>{children}</tr>;
}
