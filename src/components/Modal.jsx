import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useDiscardGuard } from '../lib/formGuard';

export default function Modal({ title, children, onClose, theme = 'dark', onKeyDown, footer }) {
  const ref = useRef(null);
  const titleId = useId();
  const guard = useDiscardGuard();
  const close = () => guard.request(onClose, ref.current);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = overflow; previous?.focus?.(); };
  }, []);
  return <>{createPortal(<dialog ref={ref} aria-labelledby={titleId} onKeyDown={onKeyDown} onCancel={(event) => { event.preventDefault(); close(); }} className={`fixed inset-0 m-auto w-[calc(100%-1rem)] max-w-4xl max-h-[94dvh] rounded-2xl border p-0 shadow-2xl backdrop:bg-slate-950/80 ${footer ? 'open:flex open:flex-col' : ''} ${theme === 'light' ? 'bg-white text-slate-900 border-slate-200' : 'bg-slate-900 text-slate-100 border-slate-700'}`}>
    <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b border-slate-500/20 bg-inherit p-4"><h2 id={titleId} className="text-xl font-black">{title}</h2><button type="button" autoFocus onClick={close} aria-label={`Cerrar ${title}`} className="grid min-h-11 min-w-11 place-items-center rounded-xl hover:bg-slate-500/10"><X size={20}/></button></header>
    <div data-dialog-body className={`p-4 sm:p-6 ${footer ? 'min-h-0 flex-1 overflow-y-auto' : ''}`}>{children}</div>
    {footer && <footer className="shrink-0 border-t border-slate-500/20 bg-inherit p-3 sm:px-6">{footer}</footer>}
  </dialog>, document.body)}{guard.open && <Modal title={guard.waiting ? 'Guardado en curso' : '¿Descartar cambios sin guardar?'} theme={theme} onClose={guard.keep}><p className="text-sm">{guard.waiting ? 'La escritura ya comenzó. Esperá la confirmación o recuperá conexión; cerrar no cancela ese envío.' : 'Esta edición todavía no está guardada. No se anulan los registros existentes.'}</p><div className="mt-4 flex flex-wrap gap-3"><button className="ux-button ux-secondary" onClick={guard.keep}>Seguir editando</button>{!guard.waiting && <button className="ux-button ux-danger" onClick={guard.discard}>Descartar edición</button>}</div></Modal>}</>;
}
