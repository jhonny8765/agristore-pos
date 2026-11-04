"use client";
import {useCallback,useEffect,useState,type Dispatch,type SetStateAction} from 'react';

/** Repeated identical notifications still get a fresh three-second lifetime. */
export function useTransientMessage(duration=3000):[string,Dispatch<SetStateAction<string>>]{
 const [notice,setNotice]=useState({text:'',version:0});
 const setText=useCallback<Dispatch<SetStateAction<string>>>(next=>setNotice(old=>({text:typeof next==='function'?next(old.text):next,version:old.version+1})),[]);
 useEffect(()=>{if(!notice.text)return;const timer=setTimeout(()=>setNotice(old=>old.version===notice.version?{...old,text:''}:old),duration);return()=>clearTimeout(timer);},[notice,duration]);
 return [notice.text,setText];
}
