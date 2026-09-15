import { useEffect, useState } from 'react';
import { onIdTokenChanged, signInAnonymously, getIdTokenResult } from 'firebase/auth';
import { auth } from '../lib/firebase';

let guestSignIn;
function startGuestSession() {
  if (!guestSignIn) guestSignIn = signInAnonymously(auth).finally(() => { guestSignIn = null; });
  return guestSignIn;
}

export default function SessionGate({ children }) {
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const unsubscribe = onIdTokenChanged(auth, (user) => {
      if (!active) return;
      setError('');
      if (!user) {
        setSession(null);
        startGuestSession().catch(() => {
          if (active) setError('Necesitamos conexión para abrir una cuenta por primera vez. Si ya usabas este dispositivo, comprueba tu conexión e inténtalo de nuevo.');
        });
        return;
      }
      // La sesión persistida permite consultar datos locales incluso cuando
      // el token no puede renovarse. Firestore sigue validando los permisos.
      setSession({ user, admin: false });
      getIdTokenResult(user).then((token) => {
        if (active && auth.currentUser?.uid === user.uid) setSession({ user, admin: token.claims.admin === true });
      }).catch(() => { /* Los privilegios adicionales requieren validación. */ });
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  if (session) return children(session);
  return <main className="min-h-screen bg-slate-950 text-white grid place-items-center p-6"><div className="max-w-sm text-center space-y-4"><div className="mx-auto h-12 w-12 rounded-2xl bg-emerald-500 grid place-items-center text-2xl font-black">R</div><h1 className="text-xl font-bold">RosterMax</h1>{error ? <><p role="alert" className="text-sm text-slate-300">{error}</p><button className="rounded-xl bg-emerald-500 px-5 py-3 font-bold" onClick={() => window.location.reload()}>Volver a intentar</button></> : <p role="status" className="text-sm text-slate-300">Abriendo tu calendario…</p>}</div></main>;
}
