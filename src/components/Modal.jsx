import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({ title, children, onClose, theme = 'dark' }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = overflow; previous?.focus?.(); };
  }, []);
  return createPortal(<dialog ref={ref} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }} className={`fixed inset-0 m-auto w-[calc(100%-1rem)] max-w-4xl max-h-[94dvh] rounded-2xl border p-0 shadow-2xl backdrop:bg-slate-950/80 ${theme === 'light' ? 'bg-white text-slate-900 border-slate-200' : 'bg-slate-900 text-slate-100 border-slate-700'}`}>
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-500/20 bg-inherit p-4"><h2 id={titleId} className="text-xl font-black">{title}</h2><button type="button" autoFocus onClick={onClose} aria-label={`Cerrar ${title}`} className="grid min-h-11 min-w-11 place-items-center rounded-xl hover:bg-slate-500/10"><X size={20}/></button></header>
    <div className="p-4 sm:p-6">{children}</div>
  </dialog>, document.body);
}
