import { useEffect, useRef } from 'react';
import { FAQ_GROUPS } from '../lib/helpContent';
import Modal from './Modal';

export default function HelpCenter({ theme, questionId, onClose, onNavigate, onStories }) {
  const target = useRef(null);
  useEffect(() => { const frame = requestAnimationFrame(() => { target.current?.scrollIntoView({ block: 'nearest' }); target.current?.querySelector('summary')?.focus({ preventScroll: true }); }); return () => cancelAnimationFrame(frame); }, [questionId]);
  const light = theme === 'light';
  const card = `rounded-2xl border p-4 ${light ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-700'}`;
  return <Modal title="Ayuda y cómo usar RosterMax" theme={theme} onClose={onClose}>
    <div className="space-y-5">
      <p className="text-sm">Respuestas sobre las funciones disponibles. Abrir una ayuda o usar “Ir a…” no guarda ni cambia tus datos.</p>
      <div className="flex flex-wrap gap-2"><button className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white" onClick={onStories}>Conocé RosterMax</button><button className="min-h-11 rounded-xl border border-blue-500 px-4 text-sm font-semibold" onClick={() => onNavigate('feedback')}>Reportar un problema</button></div>
      <h3 className="text-xl font-bold">Preguntas frecuentes</h3>
      {FAQ_GROUPS.map((group) => <section key={group.title} aria-label={group.title} className="space-y-2"><h4 className="font-bold">{group.title}</h4>{group.questions.map((question) => <details key={question.id} open={question.id === questionId || undefined} className={card} ref={question.id === questionId ? target : undefined}><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">{question.title}</summary><p className="mt-2 text-sm leading-relaxed">{question.answer}</p>{question.target && <button type="button" className="mt-3 min-h-11 rounded-xl border border-blue-500/40 px-3 text-sm font-bold" onClick={() => onNavigate(question.target)}>{question.action}</button>}</details>)}</section>)}
    </div>
  </Modal>;
}
