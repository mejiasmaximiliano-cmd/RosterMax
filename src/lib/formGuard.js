import { useEffect, useState } from 'react';

// Transient UI only: never stored, sent or used as a write/operation identifier.
const baselines = new WeakMap();
export const readForm = (form) => form ? JSON.stringify([...form.elements].filter(el=>['INPUT','SELECT','TEXTAREA'].includes(el.tagName)&&!['submit','reset','button'].includes(el.type)).map((el,index)=>[el.name||String(index),el.type,el.type==='checkbox'||el.type==='radio'?el.checked:el.multiple?[...el.selectedOptions].map(option=>option.value):el.value])) : '';
const formsInside = (root) => root?.matches?.('form') ? [root] : [...(root?.querySelectorAll('form') || [])];
export function markFormSaved(form, values = readForm(form)) { if (form) baselines.set(form, values); }
export function formChanged(form) { return baselines.has(form) && baselines.get(form) !== readForm(form); }
export function containerChanged(root = document) { return formsInside(root).some(formChanged); }
export function useFormTracking() {
  useEffect(() => {
    const track = () => document.querySelectorAll('form').forEach(form => { if (!baselines.has(form)) markFormSaved(form); });
    track(); const observer = new MutationObserver(track); observer.observe(document.body,{childList:true,subtree:true});
    const reset = event => { const form=event.target; queueMicrotask(()=>markFormSaved(form)); };
    document.addEventListener('reset',reset,true);
    return () => { observer.disconnect(); document.removeEventListener('reset',reset,true); };
  },[]);
}
export function useDiscardGuard() {
  const [action,setAction] = useState(null);
  const [waiting,setWaiting] = useState(false);
  const request = (next,root = document) => {
    if(formsInside(root).some(form=>form.getAttribute?.('aria-busy')==='true')) { setAction(null); setWaiting(true); return; }
    setWaiting(false);
    if (!containerChanged(root)) { next(); return; }
    setAction(()=>()=>{ next(); requestAnimationFrame(()=>formsInside(root).forEach(form=>markFormSaved(form))); });
  };
  return { open:Boolean(action)||waiting, waiting, request, keep:()=>{setAction(null);setWaiting(false);}, discard:()=>{ const next=action; setAction(null); if(!waiting)next?.(); } };
}
