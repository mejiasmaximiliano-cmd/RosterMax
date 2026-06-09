import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, CheckSquare, TrendingUp, User, 
  Settings, Target, Plus, Trash2, AlertCircle, ChevronRight,
  Briefcase, Home, Sun, Moon, CloudRain, Search, FileText,
  CheckCircle2, Circle, X, DollarSign, Award, Users, 
  Plane, Thermometer, PieChart, Zap, BarChart3, Calculator, 
  Share2, Info, MapPin, Building2, Truck, BriefcaseBusiness,
  CloudOff, ShieldAlert, Globe, Users2
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, onSnapshot, addDoc, deleteDoc } from 'firebase/firestore';

// --- 🚀 TU FIREBASE CONFIGURACIÓN REAL (PRODUCCIÓN) ---
const userFirebaseConfig = {
  apiKey: "AIzaSyC-YDie00IPgmhE4gOda8KiSjHTew595NA",
  authDomain: "rostermax-60242.firebaseapp.com",
  projectId: "rostermax-60242",
  storageBucket: "rostermax-60242.firebasestorage.app",
  messagingSenderId: "937600149125",
  appId: "1:937600149125:web:7d610cdb6e22b8118e6bec"
};

// Inteligencia de Entorno: Usa la BD de prueba aquí adentro, y TU BD real cuando lo exportes.
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : userFirebaseConfig;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Utilizamos un identificador base para tu proyecto
const appId = typeof __app_id !== 'undefined' ? __app_id : 'roster-max-production';

export default function App() {
  // --- STATES ---
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('roster'); 
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState('dark'); 
  const [premiumView, setPremiumView] = useState(false); 
  const [addMethod, setAddMethod] = useState('manual');
  
  // Offline & Admin States
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [isAdmin, setIsAdmin] = useState(false); // Bóveda de CEO
  const [showAdminVault, setShowAdminVault] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [vaultError, setVaultError] = useState(false);
  
  // Data States
  const [rosterConfig, setRosterConfig] = useState({ workDays: 14, restDays: 14, startDate: new Date().toISOString().split('T')[0] });
  const [userProfile, setUserProfile] = useState({ company: '', sector: 'Petróleo & Gas', location: 'Neuquén', transport: 'Vuelo' });
  const [tasks, setTasks] = useState([]);
  const [goals, setGoals] = useState([]);
  const [logs, setLogs] = useState([]); 
  const [friends, setFriends] = useState([]); 
  const [targetDate, setTargetDate] = useState('');
  const [calcInvestment, setCalcInvestment] = useState({ amount: 1000, years: 5 });

  // --- GLOBAL LISTENERS (OFFLINE MODE) ---
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // --- AUTHENTICATION ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Intenta usar el token del entorno si existe (Canvas)
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          // Fallback para cuando estés en producción (Netlify)
          await signInAnonymously(auth);
        }
      } catch (error) { 
        console.error("Auth error:", error);
        // Fallback de seguridad por si hay mismatch de tokens
        try {
          await signInAnonymously(auth);
        } catch (fallbackError) {
          console.error("Fallback error:", fallbackError);
        }
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- DATA FETCHING ---
  useEffect(() => {
    if (!user) return;
    
    const unsubRoster = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'roster'), (docSnap) => {
      if (docSnap.exists()) setRosterConfig(docSnap.data());
      else setDoc(docSnap.ref, rosterConfig);
    }, console.error);

    const unsubProfile = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile'), (docSnap) => {
      if (docSnap.exists()) setUserProfile(docSnap.data());
      else setDoc(docSnap.ref, userProfile);
    }, console.error);

    const unsubTheme = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'theme'), (docSnap) => {
      if (docSnap.exists()) setTheme(docSnap.data().mode);
    }, console.error);

    const unsubTasks = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'tasks'), 
      (snap) => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() }))), console.error);
      
    const unsubGoals = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'goals'), 
      (snap) => setGoals(snap.docs.map(d => ({ id: d.id, ...d.data() }))), console.error);

    const unsubLogs = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'logs'), 
      (snap) => setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))), console.error);

    const unsubFriends = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'friends'), 
      (snap) => setFriends(snap.docs.map(d => ({ id: d.id, ...d.data() }))), console.error);

    return () => { unsubRoster(); unsubProfile(); unsubTheme(); unsubTasks(); unsubGoals(); unsubLogs(); unsubFriends(); };
  }, [user]);

  // --- LOGIC: DATE CALCULATOR ENGINE ---
  const getStatusForDate = (dateStr, config) => {
    if (!dateStr || !config.startDate) return null;
    const start = new Date(config.startDate);
    const target = new Date(dateStr);
    start.setUTCHours(0,0,0,0);
    target.setUTCHours(0,0,0,0);

    const diffTime = target.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { error: "Fecha pasada" };

    const cycleLength = config.workDays + config.restDays;
    const dayInCycle = diffDays % cycleLength;

    const isWorking = dayInCycle < config.workDays;
    const actualDay = isWorking ? dayInCycle + 1 : (dayInCycle - config.workDays) + 1;
    const daysLeftInPhase = isWorking ? config.workDays - dayInCycle : cycleLength - dayInCycle;

    return { isWorking, actualDay, totalPhaseDays: isWorking ? config.workDays : config.restDays, daysLeftInPhase };
  };

  const currentStatus = useMemo(() => getStatusForDate(new Date().toISOString().split('T')[0], rosterConfig), [rosterConfig]);
  const targetStatus = useMemo(() => getStatusForDate(targetDate, rosterConfig), [targetDate, rosterConfig]);

  // --- LOGIC: LIFE BALANCE STATS ---
  const lifeBalanceStats = useMemo(() => {
    const cycle = rosterConfig.workDays + rosterConfig.restDays;
    const workPercent = (rosterConfig.workDays / cycle) * 100;
    const restPercent = (rosterConfig.restDays / cycle) * 100;
    const estimatedWorkDaysYear = Math.round((workPercent / 100) * 365);
    const estimatedRestDaysYear = Math.round((restPercent / 100) * 365);
    return { workPercent, restPercent, estimatedWorkDaysYear, estimatedRestDaysYear };
  }, [rosterConfig]);

  // --- EASTER EGG: BÓVEDA CEO ---
  const [clickCount, setClickCount] = useState(0);
  const handleLogoClick = () => {
    setClickCount(prev => prev + 1);
    if (clickCount + 1 === 5) {
      setShowAdminVault(true);
      setClickCount(0);
    }
    // Resetea el contador rápido si no hace 5 clics seguidos
    setTimeout(() => setClickCount(0), 3000); 
  };

  const handleVaultSubmit = (e) => {
    e.preventDefault();
    if (adminPassword === 'admin123') { // Contraseña inicial maestra
      setIsAdmin(true);
      setShowAdminVault(false);
      setActiveTab('admin');
      setAdminPassword('');
      setVaultError(false);
    } else {
      setVaultError(true);
    }
  };

  // --- HANDLERS ---
  const updateRoster = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'roster'), {
      workDays: parseInt(fd.get('workDays')), restDays: parseInt(fd.get('restDays')), startDate: fd.get('startDate')
    });
  };

  const updateProfile = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile'), {
      company: fd.get('company'), sector: fd.get('sector'), location: fd.get('location'), transport: fd.get('transport')
    });
  };

  const toggleTheme = async (newTheme) => {
    setTheme(newTheme);
    if(user) await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'theme'), { mode: newTheme });
  };

  const addGenericDoc = async (e, collectionName, fields) => {
    e.preventDefault();
    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, collectionName), {
      ...fields, createdAt: new Date().toISOString()
    });
    e.target.reset();
  };
  
  const handleSyncAdd = async (e) => {
      e.preventDefault();
      const code = e.target.elements.syncCode.value;
      if(!code) return;
      alert(`Código ${code} válido. Sincronizando datos... (Simulado)`);
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'friends'), {
        name: "Compañero (Sync)", workDays: 14, restDays: 14, startDate: new Date().toISOString().split('T')[0], isSynced: true, createdAt: new Date().toISOString()
      });
      e.target.reset();
  };

  const toggleLog = async (log) => await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'logs', log.id), { ...log, resolved: !log.resolved });
  const toggleTask = async (task) => await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id), { ...task, completed: !task.completed });
  const addFunds = async (goal, amount) => {
    const newAmount = (goal.current || 0) + amount;
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'goals', goal.id), { ...goal, current: newAmount > goal.target ? goal.target : newAmount });
  };

  // --- UI THEMES ---
  const themeClasses = {
    dark: 'bg-slate-950 text-slate-100',
    light: 'bg-slate-100 text-slate-900',
    weather: 'bg-gradient-to-br from-cyan-900 via-blue-900 to-indigo-950 text-white animate-pulse'
  };
  const cardClasses = {
    dark: 'bg-slate-900/60 border-slate-800 backdrop-blur-xl',
    light: 'bg-white/70 border-slate-200 backdrop-blur-xl shadow-sm',
    weather: 'bg-white/10 border-white/20 backdrop-blur-md'
  };
  const textMuted = theme === 'light' ? 'text-slate-500' : 'text-slate-400';
  const inputBg = theme === 'light' ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-950/50 border-slate-700 text-white';

  const getTransportIcon = (type) => {
    if (type === 'Vuelo') return <Plane size={24} className="text-indigo-400 mb-2"/>;
    if (type === 'Camioneta' || type === 'Auto Propio') return <Truck size={24} className="text-indigo-400 mb-2"/>;
    return <BriefcaseBusiness size={24} className="text-indigo-400 mb-2"/>; 
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-emerald-500"></div></div>;

  return (
    <div className={`min-h-screen font-sans pb-24 transition-colors duration-500 ${themeClasses[theme]}`}>
      
      {/* OFFLINE INDICATOR */}
      {isOffline && (
        <div className="bg-amber-500 text-slate-900 text-[10px] font-bold px-4 py-1.5 flex justify-center items-center uppercase tracking-widest z-50 relative">
          <CloudOff size={12} className="mr-2" /> Trabajando sin conexión (Datos guardados localmente)
        </div>
      )}

      {/* CEO VAULT MODAL (Easter Egg) */}
      {showAdminVault && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-sm animate-in zoom-in-95 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-amber-500 flex items-center"><ShieldAlert className="mr-2"/> Autenticación CEO</h3>
              <button onClick={() => setShowAdminVault(false)} className="text-slate-500 hover:text-white"><X size={20}/></button>
            </div>
            <p className="text-sm text-slate-400 mb-4">Ingresa tu contraseña de acceso administrativo.</p>
            <form onSubmit={handleVaultSubmit}>
              <input 
                type="password" 
                autoFocus
                placeholder="Contraseña" 
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className={`w-full rounded-xl px-4 py-3 mb-2 outline-none border bg-slate-950 text-white ${vaultError ? 'border-red-500' : 'border-slate-700 focus:border-amber-500'}`} 
              />
              {vaultError && <p className="text-xs text-red-500 mb-4">Contraseña incorrecta.</p>}
              <button type="submit" className="w-full mt-2 bg-amber-500 text-slate-900 font-bold py-3 rounded-xl hover:bg-amber-400 transition-colors">Desbloquear Bóveda</button>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <header className={`sticky top-0 z-40 px-4 py-4 border-b ${theme === 'light' ? 'bg-white/80 border-slate-200' : 'bg-slate-950/80 border-slate-800'} backdrop-blur-md`}>
        <div className="max-w-md mx-auto flex justify-between items-center">
          {/* THE SECRET BUTTON IS THE LOGO/TITLE CONTAINER */}
          <div className="flex items-center space-x-2 cursor-pointer select-none" onClick={handleLogoClick}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20"><span className="font-bold text-white">R</span></div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">RosterMax</h1>
          </div>
          <button onClick={() => setActiveTab('settings')} className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${theme === 'light' ? 'border-slate-300' : 'border-slate-700 bg-slate-800'} ${isAdmin ? 'ring-2 ring-amber-500 border-amber-500' : ''}`}>
            {isAdmin ? <ShieldAlert size={16} className="text-amber-500" /> : <User size={16} className={textMuted} />}
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
        
        {/* TAB 1: ROSTER */}
        {activeTab === 'roster' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`relative overflow-hidden rounded-3xl border p-6 ${cardClasses[theme]}`}>
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-emerald-500/20 blur-3xl"></div>
              <div className="flex items-center justify-between mb-4 relative z-10">
                <h2 className={`text-xs font-bold uppercase tracking-widest ${textMuted}`}>Estado Hoy</h2>
                {currentStatus?.error ? <span className="text-xs text-red-400">Configura tu fecha</span> : currentStatus?.isWorking ? <span className="flex items-center text-xs font-bold px-3 py-1 bg-amber-500/20 text-amber-500 rounded-full"><Briefcase size={12} className="mr-1.5" /> En Yacimiento</span> : <span className="flex items-center text-xs font-bold px-3 py-1 bg-emerald-500/20 text-emerald-500 rounded-full"><Home size={12} className="mr-1.5" /> De Franco</span>}
              </div>
              <div className="relative z-10">
                <div className="flex items-baseline space-x-2"><span className="text-6xl font-black">{currentStatus?.actualDay || 0}</span><span className={`text-xl font-medium ${textMuted}`}>/ {currentStatus?.totalPhaseDays || 0}</span></div>
                <p className={`mt-1 text-sm ${textMuted}`}>Días {currentStatus?.isWorking ? 'trabajados' : 'descansados'} del ciclo.</p>
              </div>
              <div className={`mt-6 h-2.5 w-full rounded-full overflow-hidden ${theme === 'light' ? 'bg-slate-200' : 'bg-slate-800/50'}`}>
                <div className={`h-full rounded-full transition-all duration-1000 ${currentStatus?.isWorking ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${((currentStatus?.actualDay || 0) / (currentStatus?.totalPhaseDays || 1)) * 100}%` }}></div>
              </div>
            </div>

            {/* Inyección Dinámica de Anuncios (Smart Ad Engine Mock) */}
            {userProfile.location?.toLowerCase().includes('neuquén') && (
              <div className="bg-gradient-to-r from-blue-900 to-indigo-900 border border-blue-500/30 rounded-2xl p-4 flex items-center justify-between shadow-lg shadow-blue-900/20 cursor-pointer overflow-hidden relative">
                 <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                 <div className="relative z-10">
                   <p className="text-[10px] uppercase font-black text-amber-400 mb-1 flex items-center"><Target size={10} className="mr-1"/> Sponsor Exclusivo Vaca Muerta</p>
                   <p className="font-bold text-white text-sm">20% Off Service Amarok/Hilux</p>
                   <p className="text-xs text-blue-200 mt-0.5">En Neuquén Capital.</p>
                 </div>
                 <ChevronRight className="text-blue-400 relative z-10"/>
              </div>
            )}

            <div className={`grid grid-cols-2 gap-4`}>
               <div className={`rounded-2xl border p-4 ${cardClasses[theme]} flex flex-col justify-center items-center text-center`}>
                 <Thermometer size={24} className="text-amber-500 mb-2"/>
                 <span className="text-2xl font-bold">14°C</span>
                 <span className={`text-xs font-bold mt-1 max-w-full truncate px-2`} title={userProfile.location || 'Sin Ubicación'}>{userProfile.location || 'Ubicación...'}</span>
                 <span className={`text-[9px] ${textMuted}`}>Pronóstico Local</span>
               </div>
               <div className={`rounded-2xl border p-4 ${cardClasses[theme]} flex flex-col justify-center items-center text-center`}>
                 {getTransportIcon(userProfile.transport)}
                 <span className="text-sm font-bold">En {currentStatus?.daysLeftInPhase} días</span>
                 <span className={`text-[10px] uppercase font-bold mt-1 text-indigo-400`}>{userProfile.transport || 'Transporte'}</span>
               </div>
            </div>

            <div className={`rounded-2xl border p-5 ${cardClasses[theme]}`}>
              <div className="flex items-center mb-4"><FileText size={18} className="text-indigo-500 mr-2" /><h3 className="font-bold">Bitácora de Relevo</h3></div>
              <form onSubmit={(e) => addGenericDoc(e, 'logs', { content: e.target.elements.log.value, resolved: false })} className="mb-4">
                <div className="flex space-x-2"><input name="log" type="text" placeholder="Ej. Dejar orden firmada..." className={`flex-1 rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required/><button type="submit" className="bg-indigo-500 text-white p-2 rounded-xl"><Plus size={20}/></button></div>
              </form>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {logs.map(log => (
                  <div key={log.id} className={`p-3 rounded-lg border text-sm flex items-start group transition-all duration-300 ${log.resolved ? 'opacity-50' : ''} ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/40 border-slate-700'}`}>
                    <button onClick={() => toggleLog(log)} className="mr-3 mt-0.5 flex-shrink-0 transition-transform active:scale-90">{log.resolved ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Circle size={18} className={textMuted} />}</button>
                    <span className={`flex-1 transition-all ${log.resolved ? 'line-through text-slate-500' : ''}`}>{log.content}</span>
                    <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'logs', log.id))} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2"><X size={16}/></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CREW */}
        {activeTab === 'crew' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div><h2 className="text-2xl font-bold flex items-center">Tu Equipo <Users className="ml-2 text-blue-500" size={24}/></h2><p className={`text-sm ${textMuted}`}>Organiza salidas cruzando diagramas.</p></div>
            <div className={`rounded-2xl border p-5 ${cardClasses[theme]} border-l-4 border-l-blue-500 relative overflow-hidden`}>
              <div className="absolute -right-4 -top-4 opacity-10"><Search size={80} className="text-blue-500"/></div>
              <h3 className="font-bold flex items-center mb-1"><Search size={18} className="mr-2 text-blue-500"/> Proyector de Equipo</h3>
              <p className={`text-[11px] mb-4 ${textMuted} relative z-10`}>Selecciona una fecha para ver tu estado y el de tus compañeros.</p>
              <input type="date" onChange={(e) => setTargetDate(e.target.value)} className={`w-full rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 border ${inputBg} mb-4 relative z-10`} style={{ colorScheme: theme === 'light' ? 'light' : 'dark' }} />
              {targetDate && (
                <div className="space-y-2 relative z-10">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Estado el {new Date(targetDate).toLocaleDateString()}:</h4>
                  {targetStatus && (
                    <div className={`p-3 rounded-lg border flex justify-between items-center shadow-sm ${targetStatus.isWorking ? (theme==='light'?'bg-amber-50 border-amber-200':'bg-amber-500/10 border-amber-500/30') : (theme==='light'?'bg-emerald-50 border-emerald-200':'bg-emerald-500/10 border-emerald-500/30')}`}>
                      <span className="font-semibold text-sm flex items-center"><User size={14} className="mr-1.5 opacity-70"/> Tú</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${targetStatus.isWorking ? 'text-amber-600 bg-amber-500/20' : 'text-emerald-600 bg-emerald-500/20'}`}>{targetStatus.isWorking ? 'Trabajando' : 'De Franco 🎉'}</span>
                    </div>
                  )}
                  {friends.map(friend => {
                    const status = getStatusForDate(targetDate, friend);
                    if (!status) return null;
                    const isCoincidence = !targetStatus?.isWorking && !status.isWorking;
                    return (
                      <div key={friend.id} className={`p-3 rounded-lg border flex justify-between items-center transition-all ${status.isWorking ? (theme==='light'?'bg-slate-50 border-slate-200':'bg-slate-800/40 border-slate-700') : (isCoincidence ? (theme==='light'?'bg-emerald-100 border-emerald-300 shadow-md':'bg-emerald-500/20 border-emerald-500 shadow-md shadow-emerald-500/10') : (theme==='light'?'bg-emerald-50 border-emerald-200':'bg-emerald-500/10 border-emerald-500/30'))}`}>
                        <span className="font-semibold text-sm flex items-center">{friend.name} {isCoincidence && <Zap size={14} className="ml-1 text-yellow-500 fill-yellow-500 animate-pulse"/>}{friend.isSynced && <Share2 size={12} className="ml-1.5 text-blue-400" title="Sincronizado"/>}</span>
                        <span className={`text-xs font-bold px-2 py-1 rounded ${status.isWorking ? 'text-slate-500' : (isCoincidence ? 'text-emerald-700 bg-emerald-400/30' : 'text-emerald-500')}`}>{status.isWorking ? 'Trabajando' : (isCoincidence ? '¡COINCIDEN!' : 'De Franco')}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className={`rounded-2xl border overflow-hidden ${cardClasses[theme]}`}>
              <div className="flex border-b border-inherit">
                 <button onClick={() => setAddMethod('manual')} className={`flex-1 py-3 text-sm font-bold transition-colors ${addMethod === 'manual' ? 'bg-blue-500/10 text-blue-500 border-b-2 border-b-blue-500' : textMuted}`}>Carga Manual</button>
                 <button onClick={() => setAddMethod('sync')} className={`flex-1 py-3 text-sm font-bold transition-colors ${addMethod === 'sync' ? 'bg-blue-500/10 text-blue-500 border-b-2 border-b-blue-500' : textMuted}`}>Vincular (Sync)</button>
              </div>
              <div className="p-5">
                {addMethod === 'manual' ? (
                  <form onSubmit={(e) => addGenericDoc(e, 'friends', { name: e.target.elements.name.value, workDays: parseInt(e.target.elements.w.value), restDays: parseInt(e.target.elements.r.value), startDate: e.target.elements.start.value, isSynced: false })} className="space-y-3 animate-in fade-in">
                    <input name="name" type="text" placeholder="Nombre (ej. Juan Pérez)" className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required />
                    <div className="flex space-x-2"><input name="w" type="number" placeholder="Días Trabajo" className={`flex-1 rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required /><input name="r" type="number" placeholder="Días Descanso" className={`flex-1 rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required /></div>
                    <div><label className={`block text-xs mb-1 ${textMuted}`}>Última subida</label><input name="start" type="date" className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required style={{ colorScheme: theme === 'light' ? 'light' : 'dark' }} /></div>
                    <button type="submit" className="w-full bg-slate-800 text-white hover:bg-slate-700 font-bold py-2.5 rounded-xl border border-slate-700 transition-colors mt-2">Guardar Manualmente</button>
                  </form>
                ) : (
                  <form onSubmit={handleSyncAdd} className="space-y-4 animate-in fade-in">
                    <div className="relative"><input name="syncCode" type="text" placeholder="Ej. RM-8X492A" className={`w-full rounded-xl px-4 py-3 text-sm outline-none border tracking-widest font-mono uppercase ${inputBg}`} required /><button type="submit" className="absolute right-2 top-2 bottom-2 bg-blue-500 hover:bg-blue-600 text-white px-4 rounded-lg font-bold transition-colors text-xs">Vincular</button></div>
                  </form>
                )}
              </div>
            </div>
            <div className="space-y-2">
               {friends.map(friend => (
                 <div key={friend.id} className={`flex justify-between items-center p-3 rounded-xl border ${cardClasses[theme]}`}>
                   <div><p className="font-bold text-sm flex items-center">{friend.name}{friend.isSynced && <Share2 size={12} className="ml-1.5 text-blue-400"/>}</p><p className={`text-xs ${textMuted}`}>Esquema: {friend.workDays}x{friend.restDays}</p></div>
                   <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'friends', friend.id))} className="text-slate-500 hover:text-red-400 p-2"><Trash2 size={16}/></button>
                 </div>
               ))}
            </div>
          </div>
        )}

        {/* TAB 3: PLANNER */}
        {activeTab === 'planner' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div><h2 className="text-2xl font-bold">Planificador de Franco</h2><p className={`text-sm ${textMuted}`}>Organiza tus días libres.</p></div>
            <form onSubmit={(e) => addGenericDoc(e, 'tasks', { title: e.target.elements.title.value, completed: false })} className="flex space-x-2">
              <input name="title" type="text" placeholder="Ej. Turno médico..." className={`flex-1 rounded-xl px-4 py-3 outline-none border shadow-sm ${inputBg}`} required/>
              <button type="submit" className="bg-emerald-500 hover:bg-emerald-400 text-white p-3 rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95"><Plus size={24}/></button>
            </form>
            <div className="space-y-3">
              {tasks.map(task => (
                <div key={task.id} className={`flex items-center justify-between p-4 rounded-xl border group transition-all ${task.completed ? 'opacity-60' : ''} ${cardClasses[theme]}`}>
                  <div className="flex items-center space-x-3 overflow-hidden cursor-pointer flex-1" onClick={() => toggleTask(task)}><div className={`flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${task.completed ? 'bg-emerald-500 border-emerald-500' : 'border-slate-400'}`}>{task.completed && <CheckSquare size={14} className="text-white" />}</div><span className={`truncate font-medium transition-all ${task.completed ? 'line-through text-slate-500' : ''}`}>{task.title}</span></div>
                  <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id))} className="text-slate-400 hover:text-red-400 p-2 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: WEALTH */}
        {activeTab === 'wealth' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="flex justify-between items-end">
              <div><h2 className="text-2xl font-bold flex items-center">Finanzas <TrendingUp className="ml-2 text-emerald-500" size={24}/></h2><p className={`text-sm ${textMuted}`}>Protege tu capital.</p></div>
              <button onClick={() => setPremiumView(!premiumView)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center ${premiumView ? 'bg-indigo-500 text-white border-indigo-500 shadow-lg shadow-indigo-500/30' : (theme === 'light' ? 'bg-white text-indigo-500 border-indigo-200' : 'bg-slate-900 text-indigo-400 border-indigo-500/30')}`}>
                 {premiumView ? <Target size={14} className="mr-1"/> : <BarChart3 size={14} className="mr-1"/>} {premiumView ? 'Ver Metas' : 'Inversiones PRO'}
              </button>
            </div>
            {!premiumView ? (
              <div className="space-y-6 animate-in fade-in">
                <div className={`rounded-2xl border p-5 ${cardClasses[theme]}`}>
                  <form onSubmit={(e) => { e.preventDefault(); addGenericDoc(e, 'goals', { title: e.target.elements.title.value, target: parseFloat(e.target.elements.target.value), current: 0 }); }} className="space-y-3">
                    <div className="flex space-x-2"><input name="title" type="text" placeholder="Ej. Terreno" className={`flex-1 rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required /><input name="target" type="number" placeholder="$" className={`w-24 rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required /></div>
                    <button type="submit" className="w-full bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 font-bold py-2 rounded-xl border border-emerald-500/20 transition-colors">Crear Meta</button>
                  </form>
                </div>
                <div className="space-y-4">
                  {goals.map(goal => {
                    const progress = goal.target > 0 ? (goal.current / goal.target) * 100 : 0;
                    return (
                      <div key={goal.id} className={`rounded-2xl border p-5 ${cardClasses[theme]} relative overflow-hidden group`}>
                        {progress >= 100 && <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg flex items-center z-10"><Award size={12} className="mr-1"/> LOGRADO</div>}
                        <div className="flex justify-between items-center mb-3"><span className="font-bold relative z-10">{goal.title}</span><button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'goals', goal.id))} className="text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity relative z-10"><Trash2 size={14}/></button></div>
                        <div className="flex items-end justify-between mb-2 relative z-10"><div className="flex items-baseline space-x-1"><DollarSign size={14} className="text-emerald-500"/><span className="text-2xl font-black">{goal.current}</span><span className={`text-xs ${textMuted}`}>/ {goal.target}</span></div><span className="text-xs font-bold text-emerald-500">{progress.toFixed(0)}%</span></div>
                        <div className={`h-2.5 w-full rounded-full overflow-hidden relative z-10 ${theme === 'light' ? 'bg-slate-200' : 'bg-slate-800'}`}><div className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min(progress, 100)}%` }}></div></div>
                        {progress < 100 && (
                          <div className="mt-4 flex space-x-2 relative z-10">
                            <button onClick={() => addFunds(goal, 100)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${theme === 'light' ? 'bg-white border-emerald-200 text-emerald-600' : 'bg-slate-900 border-emerald-500/30 text-emerald-400'}`}>+ $100</button>
                            <button onClick={() => addFunds(goal, 1000)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${theme === 'light' ? 'bg-white border-emerald-200 text-emerald-600' : 'bg-slate-900 border-emerald-500/30 text-emerald-400'}`}>+ $1k</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-in slide-in-from-left-4">
                 <div className="bg-gradient-to-br from-indigo-600 to-blue-800 rounded-2xl p-5 text-white shadow-xl shadow-indigo-900/20 relative overflow-hidden">
                    <div className="absolute right-0 top-0 opacity-10"><TrendingUp size={100} /></div>
                    <h3 className="font-black text-lg mb-1 flex items-center"><Award size={18} className="mr-2 text-yellow-400"/> Portafolios Recomendados</h3>
                    <p className="text-xs text-indigo-100 mb-4 opacity-80">Rendimientos históricos en USD.</p>
                    <div className="space-y-3 relative z-10">
                      <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20 flex justify-between items-center"><div><p className="font-bold text-sm">S&P 500 (SPY)</p><p className="text-[10px] text-indigo-200">Riesgo Moderado</p></div><div className="text-right"><p className="font-black text-emerald-400">+10.5%</p><p className="text-[10px] text-indigo-200">Anualizado</p></div></div>
                      <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20 flex justify-between items-center"><div><p className="font-bold text-sm">ETF Energía (XLE)</p><p className="text-[10px] text-indigo-200">Sectorial / Alto Riesgo</p></div><div className="text-right"><p className="font-black text-emerald-400">+14.2%</p><p className="text-[10px] text-indigo-200">Anualizado</p></div></div>
                    </div>
                 </div>
                 <div className={`rounded-2xl border p-5 ${cardClasses[theme]}`}>
                   <h3 className="font-bold flex items-center mb-4"><Calculator size={18} className="mr-2 text-indigo-500"/> Simulador de Inversión</h3>
                   <div className="space-y-4">
                     <div><label className={`block text-xs mb-1 ${textMuted}`}>Inversión Mensual (USD)</label><input type="range" min="100" max="5000" step="100" value={calcInvestment.amount} onChange={(e)=>setCalcInvestment({...calcInvestment, amount: parseInt(e.target.value)})} className="w-full accent-indigo-500" /><p className="text-right font-bold text-indigo-500">${calcInvestment.amount}</p></div>
                     <div><label className={`block text-xs mb-1 ${textMuted}`}>Años invirtiendo</label><input type="range" min="1" max="20" value={calcInvestment.years} onChange={(e)=>setCalcInvestment({...calcInvestment, years: parseInt(e.target.value)})} className="w-full accent-indigo-500" /><p className="text-right font-bold text-indigo-500">{calcInvestment.years} años</p></div>
                     <div className={`p-4 rounded-xl mt-4 text-center border ${theme === 'light' ? 'bg-indigo-50 border-indigo-100' : 'bg-indigo-500/10 border-indigo-500/20'}`}><p className={`text-xs ${textMuted}`}>Si inviertes al 10% anual, tendrías aprox:</p><p className="text-3xl font-black text-indigo-500 mt-1">${Math.round(calcInvestment.amount * 12 * (((Math.pow(1 + 0.10, calcInvestment.years) - 1) / 0.10))).toLocaleString('en-US')}</p></div>
                   </div>
                 </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: SETTINGS & PROFILE */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-2xl font-bold">Perfil & Estadísticas</h2>
            
            <div className={`rounded-2xl border p-4 flex items-center justify-between ${cardClasses[theme]}`}>
               <div><p className={`text-xs font-bold uppercase tracking-wider text-blue-500`}>Tu Código RosterMax</p><p className="font-mono text-lg tracking-widest mt-1">RM-{user?.uid?.substring(0, 5).toUpperCase() || 'XXXXX'}</p></div>
               <button className={`p-2 rounded-lg border ${theme==='light'?'bg-white border-slate-200':'bg-slate-800 border-slate-700'}`}><Share2 size={18} className={textMuted}/></button>
            </div>

            <div className={`rounded-2xl border p-5 ${cardClasses[theme]}`}>
              <h3 className="font-bold flex items-center mb-4 text-indigo-400"><BriefcaseBusiness size={18} className="mr-2 text-indigo-500"/> Datos Laborales</h3>
              <form onSubmit={updateProfile} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={`block text-xs mb-1 ${textMuted} flex items-center`}><Building2 size={12} className="mr-1"/> Empresa</label><input name="company" type="text" defaultValue={userProfile.company} className={`w-full rounded-lg px-3 py-2 outline-none border text-sm ${inputBg}`} /></div>
                  <div><label className={`block text-xs mb-1 ${textMuted} flex items-center`}><Target size={12} className="mr-1"/> Rubro</label>
                    <select name="sector" defaultValue={userProfile.sector} className={`w-full rounded-lg px-3 py-2 outline-none border text-sm ${inputBg}`}>
                      <option value="Petróleo & Gas">Petróleo & Gas</option><option value="Minería">Minería</option><option value="Logística">Logística</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={`block text-xs mb-1 ${textMuted} flex items-center`}><MapPin size={12} className="mr-1"/> Yacimiento</label><input name="location" type="text" defaultValue={userProfile.location} className={`w-full rounded-lg px-3 py-2 outline-none border text-sm ${inputBg}`} /></div>
                  <div><label className={`block text-xs mb-1 ${textMuted} flex items-center`}><Truck size={12} className="mr-1"/> Transporte</label>
                    <select name="transport" defaultValue={userProfile.transport} className={`w-full rounded-lg px-3 py-2 outline-none border text-sm ${inputBg}`}>
                      <option value="Vuelo">Vuelo</option><option value="Micro">Micro</option><option value="Camioneta">Camioneta</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="w-full bg-indigo-500 text-white font-bold py-2.5 rounded-xl transition-all text-sm mt-2">Guardar Perfil Laboral</button>
              </form>
            </div>
            
            <div className={`rounded-2xl border p-5 ${cardClasses[theme]}`}>
              <h3 className="font-bold flex items-center mb-4"><Calendar size={18} className="mr-2 text-emerald-500"/> Configuración de Diagrama</h3>
              <form onSubmit={updateRoster} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={`block text-xs mb-1 ${textMuted}`}>Días Trabajo</label><input name="workDays" type="number" defaultValue={rosterConfig.workDays} className={`w-full rounded-lg px-3 py-2 outline-none border ${inputBg}`} /></div>
                  <div><label className={`block text-xs mb-1 ${textMuted}`}>Días Descanso</label><input name="restDays" type="number" defaultValue={rosterConfig.restDays} className={`w-full rounded-lg px-3 py-2 outline-none border ${inputBg}`} /></div>
                </div>
                <div><label className={`block text-xs mb-1 ${textMuted}`}>Última subida</label><input name="start" type="date" defaultValue={rosterConfig.startDate} className={`w-full rounded-lg px-3 py-2 outline-none border ${inputBg}`} style={{ colorScheme: theme === 'light' ? 'light' : 'dark' }} /></div>
                <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-500/30 transition-all">Actualizar Roster</button>
              </form>
            </div>

            <div className={`rounded-2xl border p-5 space-y-4 mb-10 ${cardClasses[theme]}`}>
              <h3 className="font-bold flex items-center"><Sun size={18} className="mr-2 text-amber-500"/> Apariencia</h3>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => toggleTheme('light')} className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${theme === 'light' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600' : inputBg}`}><Sun size={20} /> <span className="text-xs font-semibold">Claro</span></button>
                <button onClick={() => toggleTheme('dark')} className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${theme === 'dark' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : inputBg}`}><Moon size={20} /> <span className="text-xs font-semibold">Oscuro</span></button>
                <button onClick={() => toggleTheme('weather')} className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${theme === 'weather' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : inputBg}`}><CloudRain size={20} /> <span className="text-xs font-semibold">Vivo</span></button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: ADMIN DASHBOARD (CEO) */}
        {activeTab === 'admin' && isAdmin && (
          <div className="space-y-6 animate-in zoom-in-95 duration-300">
             <div>
               <h2 className="text-2xl font-black text-amber-500 flex items-center"><ShieldAlert className="mr-2"/> Centro de Mando</h2>
               <p className={`text-sm ${textMuted}`}>Métricas globales de tu negocio.</p>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div className={`rounded-2xl border p-5 ${cardClasses[theme]} border-t-4 border-t-blue-500`}>
                  <Users2 size={24} className="text-blue-500 mb-2"/>
                  <span className="text-3xl font-black">5,204</span>
                  <p className={`text-[10px] uppercase font-bold tracking-widest ${textMuted} mt-1`}>Usuarios Activos</p>
                </div>
                <div className={`rounded-2xl border p-5 ${cardClasses[theme]} border-t-4 border-t-emerald-500`}>
                  <DollarSign size={24} className="text-emerald-500 mb-2"/>
                  <span className="text-3xl font-black">$12.4k</span>
                  <p className={`text-[10px] uppercase font-bold tracking-widest ${textMuted} mt-1`}>Proyección Mensual</p>
                </div>
             </div>

             <div className={`rounded-2xl border p-5 ${cardClasses[theme]}`}>
                <h3 className="font-bold flex items-center mb-4"><Globe size={18} className="mr-2 text-indigo-500"/> Demografía Principal</h3>
                <div className="space-y-3">
                  <div><div className="flex justify-between text-sm mb-1"><span>Neuquén (Vaca Muerta)</span><span className="font-bold text-indigo-400">45%</span></div><div className="h-1.5 w-full bg-slate-800 rounded-full"><div className="h-full bg-indigo-500 rounded-full" style={{width: '45%'}}></div></div></div>
                  <div><div className="flex justify-between text-sm mb-1"><span>Salta (Puna Minera)</span><span className="font-bold text-indigo-400">30%</span></div><div className="h-1.5 w-full bg-slate-800 rounded-full"><div className="h-full bg-indigo-500 rounded-full" style={{width: '30%'}}></div></div></div>
                  <div><div className="flex justify-between text-sm mb-1"><span>Santa Cruz (Golfo SJ)</span><span className="font-bold text-indigo-400">15%</span></div><div className="h-1.5 w-full bg-slate-800 rounded-full"><div className="h-full bg-indigo-500 rounded-full" style={{width: '15%'}}></div></div></div>
                </div>
             </div>

             <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 mb-10">
               <h3 className="font-bold flex items-center mb-4 text-amber-500"><Target size={18} className="mr-2"/> Smart Ad Engine</h3>
               <form onSubmit={(e) => { e.preventDefault(); alert("En modo producción, esto inyectará el banner a la base de datos para los usuarios en " + e.target.elements.adLocation.value); }} className="space-y-3">
                 <input name="adCompany" type="text" placeholder="Empresa (Ej. Hilux Service)" className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required />
                 <input name="adTitle" type="text" placeholder="Título (Ej. 20% Off Pastillas)" className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required />
                 <input name="adLocation" type="text" placeholder="Locación Objetivo (Ej. Neuquén)" className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required />
                 <button type="submit" className="w-full mt-4 bg-amber-500 text-slate-900 font-bold py-2 rounded-xl text-sm hover:bg-amber-400 transition-colors">Lanzar Campaña Segmentada</button>
               </form>
             </div>
          </div>
        )}

      </main>

      {/* BOTTOM NAVIGATION */}
      <nav className={`fixed bottom-0 w-full border-t pb-safe z-40 ${theme === 'light' ? 'bg-white/90 border-slate-200' : 'bg-slate-950/90 border-slate-800'} backdrop-blur-xl`}>
        <div className="max-w-md mx-auto px-2 py-3 flex justify-between items-center">
          <button onClick={() => setActiveTab('roster')} className={`flex-1 flex flex-col items-center space-y-1 transition-colors ${activeTab === 'roster' ? 'text-emerald-500' : textMuted}`}><Calendar size={20} /><span className="text-[9px] font-bold">Roster</span></button>
          <button onClick={() => setActiveTab('crew')} className={`flex-1 flex flex-col items-center space-y-1 transition-colors ${activeTab === 'crew' ? 'text-blue-500' : textMuted}`}><Users size={20} /><span className="text-[9px] font-bold">Equipo</span></button>
          <button onClick={() => setActiveTab('planner')} className={`flex-1 flex flex-col items-center space-y-1 transition-colors ${activeTab === 'planner' ? 'text-emerald-500' : textMuted}`}><CheckSquare size={20} /><span className="text-[9px] font-bold">Franco</span></button>
          <button onClick={() => setActiveTab('wealth')} className={`flex-1 flex flex-col items-center space-y-1 transition-colors ${activeTab === 'wealth' ? 'text-emerald-500' : textMuted}`}><TrendingUp size={20} /><span className="text-[9px] font-bold">Finanzas</span></button>
          <button onClick={() => setActiveTab('settings')} className={`flex-1 flex flex-col items-center space-y-1 transition-colors ${activeTab === 'settings' ? 'text-emerald-500' : textMuted}`}><User size={20} /><span className="text-[9px] font-bold">Perfil</span></button>
          
          {isAdmin && (
            <button onClick={() => setActiveTab('admin')} className={`flex-1 flex flex-col items-center space-y-1 transition-colors ${activeTab === 'admin' ? 'text-amber-500' : textMuted}`}>
              <ShieldAlert size={20} className={activeTab === 'admin' ? 'fill-amber-500/20' : ''}/>
              <span className="text-[9px] font-bold">CEO</span>
            </button>
          )}
        </div>
      </nav>

    </div>
  );
}