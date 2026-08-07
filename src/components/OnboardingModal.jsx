import { useState } from 'react';
import { Calendar, CheckCircle2, ChevronRight, ShieldCheck, Users, X } from 'lucide-react';

const steps = [
  { icon: ShieldCheck, label: 'Bienvenida' },
  { icon: Calendar, label: 'Tu roster' },
  { icon: Users, label: 'Tu perfil' },
];

export default function OnboardingModal({
  theme,
  rosterConfig,
  userProfile,
  onSaveRoster,
  onSaveProfile,
  onComplete,
  onSkip,
}) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const dark = theme !== 'light';
  const panel = dark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900';
  const muted = dark ? 'text-slate-400' : 'text-slate-500';
  const input = dark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900';

  const submitRoster = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    const saved = await onSaveRoster({
      workDays: Number(form.get('workDays')),
      restDays: Number(form.get('restDays')),
      startDate: form.get('startDate'),
    });
    setSaving(false);
    if (saved) setStep(2);
  };

  const submitProfile = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    const saved = await onSaveProfile({
      ...userProfile,
      displayName: String(form.get('displayName') || '').trim(),
      location: String(form.get('location') || '').trim(),
    });
    setSaving(false);
    if (saved) await onComplete('crew');
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-sm p-4 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className={`w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden ${panel}`}>
        <div className="h-1.5 bg-slate-800">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-2">
              {steps.map(({ icon: Icon, label }, index) => (
                <div key={label} className={`h-9 w-9 rounded-xl flex items-center justify-center ${index <= step ? 'bg-emerald-500 text-white' : dark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'}`} title={label}>
                  <Icon size={17}/>
                </div>
              ))}
            </div>
            <button type="button" onClick={onSkip} className={`p-2 rounded-lg ${muted}`} aria-label="Cerrar guía"><X size={18}/></button>
          </div>

          {step === 0 && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-emerald-500 mb-2">Tu roster, en un solo lugar</p>
                <h2 id="onboarding-title" className="text-3xl font-black leading-tight">Configuremos RosterMax en dos minutos.</h2>
                <p className={`mt-3 text-sm leading-relaxed ${muted}`}>Verás cuándo subes o bajas, podrás encontrar francos compartidos y planificar tus días libres sin entregar datos laborales sensibles.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className={`rounded-2xl p-4 ${dark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}><Calendar className="text-emerald-500 mb-2" size={20}/><p className="text-xs font-bold">Calendario automático</p></div>
                <div className={`rounded-2xl p-4 ${dark ? 'bg-blue-500/10' : 'bg-blue-50'}`}><Users className="text-blue-500 mb-2" size={20}/><p className="text-xs font-bold">Francos en común</p></div>
              </div>
              <button type="button" onClick={() => setStep(1)} className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold flex items-center justify-center">Comenzar <ChevronRight size={18} className="ml-1"/></button>
              <button type="button" onClick={onSkip} className={`w-full text-xs font-bold ${muted}`}>Lo haré más tarde</button>
            </div>
          )}

          {step === 1 && (
            <form onSubmit={submitRoster} className="space-y-4">
              <div><p className="text-xs font-black uppercase tracking-widest text-emerald-500 mb-2">Paso 1 de 2</p><h2 id="onboarding-title" className="text-2xl font-black">Configura tu diagrama</h2><p className={`text-sm mt-2 ${muted}`}>Indica una fecha conocida en la que comenzaste un ciclo de trabajo.</p></div>
              <div className="grid grid-cols-2 gap-3">
                <label className={`text-xs font-bold ${muted}`}>Días trabajando<input name="workDays" type="number" min="1" max="365" required defaultValue={rosterConfig.workDays} className={`mt-1.5 w-full rounded-xl border p-3 text-base outline-none ${input}`}/></label>
                <label className={`text-xs font-bold ${muted}`}>Días de franco<input name="restDays" type="number" min="1" max="365" required defaultValue={rosterConfig.restDays} className={`mt-1.5 w-full rounded-xl border p-3 text-base outline-none ${input}`}/></label>
              </div>
              <label className={`block text-xs font-bold ${muted}`}>Inicio conocido del ciclo<input name="startDate" type="date" required defaultValue={rosterConfig.startDate} className={`mt-1.5 w-full rounded-xl border p-3 text-base outline-none ${input}`} style={{ colorScheme: dark ? 'dark' : 'light' }}/></label>
              <button disabled={saving} className="w-full py-3.5 rounded-xl bg-emerald-500 text-white font-bold disabled:opacity-60">{saving ? 'Guardando…' : 'Guardar y continuar'}</button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={submitProfile} className="space-y-4">
              <div><p className="text-xs font-black uppercase tracking-widest text-blue-500 mb-2">Paso 2 de 2</p><h2 id="onboarding-title" className="text-2xl font-black">¿Cómo te verán?</h2><p className={`text-sm mt-2 ${muted}`}>Solo este nombre y tu diagrama se compartirán con quienes reciban tu invitación.</p></div>
              <label className={`block text-xs font-bold ${muted}`}>Nombre visible<input name="displayName" type="text" required maxLength="40" placeholder="Ej. Maxi" defaultValue={userProfile.displayName} className={`mt-1.5 w-full rounded-xl border p-3 text-base outline-none ${input}`}/></label>
              <label className={`block text-xs font-bold ${muted}`}>Zona o yacimiento (privado)<input name="location" type="text" maxLength="80" placeholder="Ej. Añelo" defaultValue={userProfile.location} className={`mt-1.5 w-full rounded-xl border p-3 text-base outline-none ${input}`}/></label>
              <div className={`rounded-xl p-3 flex gap-2 text-xs ${dark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}><CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0"/><span>Empresa, correo, provincias y finanzas nunca forman parte del enlace compartido.</span></div>
              <button disabled={saving} className="w-full py-3.5 rounded-xl bg-blue-500 text-white font-bold disabled:opacity-60">{saving ? 'Guardando…' : 'Terminar y añadir compañeros'}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
