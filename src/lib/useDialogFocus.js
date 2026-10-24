import { useEffect, useRef } from 'react';

/** For legacy dialogs while they migrate to the native Modal component. */
export function useDialogFocus(ref, onClose) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const dialog = ref.current, previous = document.activeElement;
    if (!dialog) return undefined;
    const focusable = () => [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')].filter((el) => el.getClientRects().length);
    focusable()[0]?.focus();
    const keydown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current?.(); }
      if (event.key !== 'Tab') return;
      const list = focusable(), first = list[0], last = list.at(-1);
      if (!list.length) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener('keydown', keydown);
    return () => { dialog.removeEventListener('keydown', keydown); previous?.focus?.(); };
  }, [ref]);
}
