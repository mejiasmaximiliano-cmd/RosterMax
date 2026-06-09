import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, CheckSquare, TrendingUp, User, 
  Settings, Target, Plus, Trash2, AlertCircle, ChevronRight,
  Briefcase, Home, Sun, Moon, Search, FileText,
  CheckCircle2, Circle, X, DollarSign, Award, Users, 
  Plane, Thermometer, Zap, Calculator, 
  Share2, MapPin, Building2, Truck, BriefcaseBusiness,
  CloudOff, ShieldAlert, Globe, Users2, Download, Send, Smartphone, LineChart,
  Megaphone
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, 
  GoogleAuthProvider, signInWithRedirect, getRedirectResult, 
  linkWithRedirect, signInWithCredential
} from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, onSnapshot, addDoc, deleteDoc, getDocs } from 'firebase/firestore';

// --- 🚀 FIREBASE CONFIGURACIÓN ---
const firebaseConfig = {
  apiKey: "AIzaSyC-YDie00IPgmhE4gOda8KiSjHTew595NA",
  authDomain: "rostermax-60242.firebaseapp.com",
  projectId: "rostermax-60242",
  storageBucket: "rostermax-60242.firebasestorage.app",
  messagingSenderId: "937600149125",
  appId: "1:937600149125:web:7d610cdb6e22b8118e6bec"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'roster-max-production';

export default function App() {
  // --- STATES ---
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('roster'); 
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState('dark'); 
  const [premiumView, setPremiumView] = useState(false); 
  const [addMethod, setAddMethod] = useState('manual');
  
  // States: UX, PWA, Admin & Auth
  const [toast, setToast] = useState('');
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminVault, setShowAdminVault] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [vaultError, setVaultError] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [authMsg, setAuthMsg] = useState('');
  const [realUserCount, setRealUserCount] = useState(0);
  
  // Data States
  const [rosterConfig, setRosterConfig] = useState({ workDays: 14, restDays: 14, startDate: new Date().toISOString().split('T')[0] });
  const [userProfile, setUserProfile] = useState({ company: '', sector: 'Petróleo & Gas', location: 'Neuquén', transport: 'Vuelo' });
  const [tasks, setTasks] = useState([]);
  const [goals, setGoals] = useState([]);
  const [logs, setLogs] = useState([]); 
  const [friends, setFriends] = useState([]); 
  const [targetDate, setTargetDate] = useState('');
  const [calcInvestment, setCalcInvestment] = useState({ amount: 1000, years: 5 });
  const [currentAd, setCurrentAd] = useState(null);

  // API States
  const [weatherData, setWeatherData] = useState({ temp: '--', loading: false });
  const [marketData, setMarketData] = useState({ 
    SPY: { price: '...', change: '...' }, 
    XLE: { price: '...', change: '...' },
    YPF: { price: '...', change: '...' },
    PAM: { price: '...', change: '...' }
  });

  // --- SISTEMA DE NOTIFICACIONES (TOAST) ---
  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  // --- ESCUDO ANTI-AMNESIA & PWA ---
  useEffect(() => {
    document.body.classList.add('overscroll-none');
    
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // --- MOTOR DE AUTENTICACIÓN GOOGLE ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) setAuthMsg("Cuenta blindada con éxito.");
      } catch (error) {
        if (error.code === 'auth/credential-already-in-use') {
          try {
            await signInWithCredential(auth, error.credential);
            setAuthMsg("Sesión recuperada exitosamente.");
          } catch (e) { setAuthMsg("Error al recuperar sesión."); }
        } else {
          setAuthMsg("Error al vincular: " + error.message);
        }
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setLoading(false);
        setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users_registry', currentUser.uid), {
          lastLogin: new Date().toISOString()
        }, { merge: true }).catch(()=>{});
      } else {
        try { await signInAnonymously(auth); } catch (err) { console.error(err); }
      }
    });
    return () => unsubscribe();
  }, []);

  // VERIFICACIÓN ABSOLUTA DE SEGURIDAD (Si tiene email, NO es invitado)
  const isPermanentlyLinked = user && !user.isAnonymous && user.email;

  // --- BASE DE DATOS (SYNC PRIVADO Y PÚBLICO) ---
  useEffect(() => {
    if (!user) return;
    const unsubRoster = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'roster'), (d) => { if (d.exists()) setRosterConfig(d.data()); });
    const unsubProfile = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile'), (d) => { if (d.exists()) setUserProfile(d.data()); });
    const unsubTheme = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'theme'), (d) => { if (d.exists()) setTheme(d.data().mode); });
    const unsubTasks = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'tasks'), (s) => setTasks(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubGoals = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'goals'), (s) => setGoals(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubLogs = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'logs'), (s) => setLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubFriends = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'friends'), (s) => setFriends(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    // Escucha Global de Anuncios
    const unsubAds = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'ads', 'campaign'), (d) => { 
      if (d.exists() && d.data().active) setCurrentAd(d.data()); 
      else setCurrentAd(null);
    }, (err) => console.log("Permisos públicos de Ads pendientes."));

    return () => { unsubRoster(); unsubProfile(); unsubTheme(); unsubTasks(); unsubGoals(); unsubLogs(); unsubFriends(); unsubAds(); };
  }, [user]);

  // --- OBTENER TOTAL DE USUARIOS (CEO) ---
  useEffect(() => {
    if (!isAdmin) return;
    const fetchUsers = async () => {
      try {
        const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'users_registry'));
        setRealUserCount(snap.size);
      } catch (e) { console.log("Error contando usuarios"); }
    };
    fetchUsers();
  }, [isAdmin]);

  // --- MOTOR CLIMÁTICO REAL (Open-Meteo) ---
  useEffect(() => {
    const fetchWeather = async () => {
      if (!userProfile.location) return;
      setWeatherData({ temp: '--', loading: true });
      try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(userProfile.location)}&count=1&language=es`);
        const geoData = await geoRes.json();
        if (geoData.results && geoData.results.length > 0) {
          const { latitude, longitude } = geoData.results[0];
          const wxRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
          const wxData = await wxRes.json();
          setWeatherData({ temp: Math.round(wxData.current_weather.temperature), loading: false });
        } else {
          setWeatherData({ temp: '--', loading: false });
        }
      } catch (error) { setWeatherData({ temp: '--', loading: false }); }
    };
    fetchWeather();
  }, [userProfile.location]);

  // --- MOTOR FINANCIERO (Wall Street & Merval) ---
  useEffect(() => {
    if (activeTab !== 'wealth' || !premiumView) return;
    const fetchMarkets = async () => {
      const fetchTicker = async (symbol) => {
        try {
          const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d`)}`);
          const data = await res.json();
          const parsed = JSON.parse(data.contents);
          const meta = parsed.chart.result[0].meta;
          const price = meta.regularMarketPrice;
          const prevClose = meta.chartPreviousClose || meta.previousClose || price; 
          
          if (!price) throw new Error("No data");
          
          const changePercent = (((price - prevClose) / prevClose) * 100).toFixed(2);
          return { price: price.toFixed(2), change: changePercent > 0 ? `+${changePercent}%` : `${changePercent}%`, isUp: changePercent >= 0 };
        } catch (error) {
          return { price: 'N/A', change: '--', isUp: true }; 
        }
      };
      
      const spyData = await fetchTicker('SPY');
      const xleData = await fetchTicker('XLE');
      const ypfData = await fetchTicker('YPF'); 
      const pamData = await fetchTicker('PAM'); 
      
      setMarketData({ SPY: spyData, XLE: xleData, YPF: ypfData, PAM: pamData });
    };
    fetchMarkets();
  }, [activeTab, premiumView]);

  // --- LÓGICA: CALCULADORA DE FECHAS ---
  const getStatusForDate = (dateStr, config) => {
    if (!dateStr || !config.startDate) return null;
    const start = new Date(config.startDate);
    const target = new Date(dateStr);
    start.setUTCHours(0,0,0,0); target.setUTCHours(0,0,0,0);
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

  // --- HANDLERS AUTH & SHARE ---
  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  };

  const linkWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      if (user && user.isAnonymous) {
        await linkWithRedirect(user, provider);
      } else {
        await signInWithRedirect(auth, provider);
      }
    } catch (error) { showToast("Error de conexión con Google."); }
  };

  const shareMyCode = async () => {
    const myCode = `RM-${user?.uid?.substring(0, 5).toUpperCase() || 'XXXXX'}`;
    const shareData = { title: 'Mi Código RosterMax', text: `¡Agrégame a tu equipo en RosterMax usando mi código: ${myCode}` };
    if (navigator.share) { try { await navigator.share(shareData); } catch (err) {} } 
    else { showToast(`Tu código es: ${myCode} (Copiado)`); }
  };

  const shareApp = async () => {
    const shareData = { title: 'RosterMax', text: '¡Instala RosterMax! La app para gestionar nuestro diagrama.', url: window.location.origin };
    if (navigator.share) { try { await navigator.share(shareData); } catch (err) {} } 
    else { showToast("Comparte tu enlace web."); }
  };

  // --- HANDLERS FORMULARIOS ---
  const updateRoster = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'roster'), {
      workDays: parseInt(fd.get('workDays')), restDays: parseInt(fd.get('restDays')), startDate: fd.get('startDate')
    });
    showToast("Diagrama actualizado.");
  };

  const updateProfile = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile'), {
      company: fd.get('company'), sector: fd.get('sector'), location: fd.get('location'), transport: fd.get('transport')
    });
    showToast("Perfil guardado.");
  };

  const toggleTheme = async (newTheme) => {
    setTheme(newTheme);
    if(user) await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'theme'), { mode: newTheme });
  };

  const addGenericDoc = async (e, collectionName, fields) => {
    e.preventDefault();
    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, collectionName), { ...fields, createdAt: new Date().toISOString() });
    e.target.reset();
  };

  const toggleLog = async (log) => await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'logs', log.id), { ...log, resolved: !log.resolved });
  const toggleTask = async (task) => await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id), { ...task, completed: !task.completed });
  const addFunds = async (goal, amount) => {
    const newAmount = (goal.current || 0) + amount;
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'goals', goal.id), { ...goal, current: newAmount > goal.target ? goal.target : newAmount });
  };

  // --- SMART AD ENGINE (CEO) ---
  const launchAd = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'ads', 'campaign'), {
        company: fd.get('adCompany'),
        title: fd.get('adTitle'),
        location: fd.get('adLocation').toLowerCase(),
        active: true,
        updatedAt: new Date().toISOString()
      });
      showToast("¡Campaña activada con éxito!");
      e.target.reset();
    } catch (err) {
      showToast("Error: Revisa las Reglas de Firebase.");
    }
  };

  const deleteAd = async () => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'ads', 'campaign'));
      showToast("Campaña eliminada permanentemente.");
    } catch (err) { showToast("Error al eliminar campaña."); }
  };

  // --- BÓVEDA CEO ---
  const [clickCount, setClickCount] = useState(0);
  const handleLogoClick = () => {
    setClickCount(prev => prev + 1);
    if (clickCount + 1 >= 3) { setShowAdminVault(true); setClickCount(0); }
    setTimeout(() => setClickCount(0), 2000); 
  };
  const handleVaultSubmit = (e) => {
    e.preventDefault();
    if (adminPassword === 'admin123') { setIsAdmin(true); setShowAdminVault(false); setActiveTab('admin'); setAdminPassword(''); setVaultError(false); } 
    else { setVaultError(true); }
  };

  // --- UI THEMES CLÁSICOS ---
  const dynamicTheme = theme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100';
  const cardClasses = {
    dark: 'bg-slate-900/60 border-slate-800 backdrop-blur-xl',
    light: 'bg-white border-slate-200 shadow-sm'
  };
  const textMuted = theme === 'light' ? 'text-slate-500' : 'text-slate-400';
  const inputBg = theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950/50 border-slate-700 text-white';

  const getTransportIcon = (type) => {
    if (type === 'Vuelo') return <Plane size={24} className="mb-2"/>;
    if (type === 'Camioneta' || type === 'Auto Propio') return <Truck size={24} className="mb-2"/>;
    return <BriefcaseBusiness size={24} className="mb-2"/>; 
  };

  const HeaderTitle = ({ icon: Icon, title, colorClass }) => (
    <div className="flex items-center space-x-3">
      <div className={`p-2.5 rounded-xl border ${cardClasses[theme]} bg-opacity-50 shadow-sm`}><Icon className={colorClass} size={22}/></div>
      <h2 className="text-2xl font-black tracking-tight">{title}</h2>
    </div>
  );

  const shouldShowAd = currentAd && (currentAd.location === 'todos' || currentAd.location.includes(userProfile.location?.toLowerCase()));

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-emerald-500"></div></div>;

  return (
    <div className={`min-h-screen font-sans pb-24 transition-colors duration-500 ${dynamicTheme}`}>
      
      {/* NOTIFICACIONES TOAST */}
      {toast && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-emerald-500 text-white px-5 py-2.5 rounded-full font-bold shadow-xl z-[100] text-sm animate-in slide-in-from-top-4 flex items-center">
          <CheckCircle2 size={16} className="mr-2"/> {toast}
        </div>
      )}

      {isOffline && (
        <div className="bg-amber-500 text-slate-900 text-[10px] font-bold px-4 py-1.5 flex justify-center items-center uppercase tracking-widest z-50 relative">
          <CloudOff size={12} className="mr-2" /> Modo Sin Conexión
        </div>
      )}

      {showAdminVault && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-sm animate-in zoom-in-95 shadow-2xl text-white">
            <div className="flex justify-between items-center mb-4"><h3 className="font-black text-amber-500 flex items-center"><ShieldAlert className="mr-2"/> Autenticación CEO</h3><button onClick={() => setShowAdminVault(false)} className="text-slate-500 hover:text-white"><X size={20}/></button></div>
            <form onSubmit={handleVaultSubmit}>
              <input type="password" autoFocus placeholder="Clave de acceso" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className={`w-full rounded-xl px-4 py-3 mb-2 outline-none border bg-slate-950 text-white ${vaultError ? 'border-red-500' : 'border-slate-700'}`} />
              <button type="submit" className="w-full mt-2 bg-amber-500 text-slate-900 font-bold py-3 rounded-xl hover:bg-amber-400">Entrar a Bóveda</button>
            </form>
          </div>
        </div>
      )}

      <header className={`sticky top-0 z-40 px-4 py-4 border-b backdrop-blur-md ${theme === 'light' ? 'bg-white/80 border-slate-200' : 'bg-slate-950/80 border-slate-800'}`}>
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2 cursor-pointer select-none" onClick={handleLogoClick}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 relative">
              <span className="font-bold text-white">R</span>
              {clickCount > 0 && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping"></span>}
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">RosterMax</h1>
          </div>
          <button onClick={() => setActiveTab('settings')} className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${theme === 'light' ? 'bg-white border-slate-300' : 'bg-slate-800 border-slate-700'} ${isAdmin ? 'ring-2 ring-amber-500 border-amber-500' : ''}`}>
            {isAdmin ? <ShieldAlert size={16} className="text-amber-500" /> : <User size={16} className={textMuted} />}
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
        
        {installPrompt && (
          <div className={`border rounded-2xl p-4 flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-4 ${theme==='light'?'bg-emerald-50 border-emerald-200':'bg-emerald-500/20 border-emerald-500/30'}`}>
            <div><p className="font-bold text-emerald-500 text-sm flex items-center"><Download size={14} className="mr-1.5"/> Instalar RosterMax</p><p className={`text-xs mt-0.5 ${textMuted}`}>Añade la app a tu pantalla de inicio.</p></div>
            <button onClick={handleInstallClick} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-4 rounded-xl text-sm transition-colors shadow-lg shadow-emerald-500/30">Instalar</button>
          </div>
        )}

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

            {/* MOTOR DE ANUNCIOS SMART */}
            {shouldShowAd && (
              <div className="bg-gradient-to-r from-blue-900 to-indigo-900 border border-blue-500/30 rounded-2xl p-4 flex items-center justify-between shadow-lg shadow-blue-900/20 cursor-pointer overflow-hidden relative animate-in fade-in slide-in-from-top-4">
                 <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                 <div className="relative z-10">
                   <p className="text-[10px] uppercase font-black text-amber-400 mb-1 flex items-center"><Target size={10} className="mr-1"/> Sponsor {userProfile.location}</p>
                   <p className="font-bold text-white text-sm">{currentAd.title}</p>
                   <p className="text-xs text-blue-200 mt-0.5">{currentAd.company}</p>
                 </div>
                 <ChevronRight className="text-blue-400 relative z-10"/>
              </div>
            )}

            <div className={`grid grid-cols-2 gap-4`}>
               <div className={`rounded-2xl border p-4 ${cardClasses[theme]} flex flex-col justify-center items-center text-center`}>
                 <Thermometer size={24} className={`${theme === 'light' ? 'text-amber-500' : 'text-amber-500'} mb-2`}/>
                 <span className="text-2xl font-bold">{weatherData.loading ? '...' : `${weatherData.temp}°C`}</span>
                 <span className={`text-xs font-bold mt-1 max-w-full truncate px-2`} title={userProfile.location || 'Sin Ubicación'}>{userProfile.location || 'Ubicación...'}</span>
                 <span className={`text-[9px] ${textMuted}`}>Clima Real</span>
               </div>
               <div className={`rounded-2xl border p-4 ${cardClasses[theme]} flex flex-col justify-center items-center text-center text-indigo-400`}>
                 {getTransportIcon(userProfile.transport)}
                 <span className={`text-sm font-bold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>En {currentStatus?.daysLeftInPhase || 0} días</span>
                 <span className={`text-[10px] uppercase font-bold mt-1`}>{userProfile.transport || 'Transporte'}</span>
               </div>
            </div>

            <div className={`rounded-2xl border p-5 ${cardClasses[theme]}`}>
              <div className="flex flex-col mb-4">
                <div className="flex items-center"><FileText size={18} className="text-indigo-500 mr-2" /><h3 className="font-bold">Bitácora de Relevo</h3></div>
                <p className={`text-[10px] mt-1 ${textMuted}`}>Anota pendientes, herramientas o novedades para tu relevo.</p>
              </div>
              <form onSubmit={(e) => addGenericDoc(e, 'logs', { content: e.target.elements.log.value, resolved: false })} className="mb-4">
                <div className="flex space-x-2"><input name="log" type="text" placeholder="Ej. Dejar orden firmada..." className={`flex-1 rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required/><button type="submit" className="bg-indigo-500 text-white p-2 rounded-xl"><Plus size={20}/></button></div>
              </form>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {logs.map(log => (
                  <div key={log.id} className={`p-3 rounded-lg border text-sm flex items-start group transition-all duration-300 ${log.resolved ? 'opacity-50' : ''} ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/40 border-slate-700'}`}>
                    <button onClick={() => toggleLog(log)} className="mr-3 mt-0.5 flex-shrink-0 transition-transform active:scale-90">{log.resolved ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Circle size={18} className={textMuted} />}</button>
                    <span className={`flex-1 transition-all ${log.resolved ? 'line-through opacity-50' : ''}`}>{log.content}</span>
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
            <div className="mb-6">
               <HeaderTitle icon={Users} title="Proyector de Equipo" colorClass="text-blue-500" />
            </div>
            
            <div className={`rounded-2xl border p-5 ${cardClasses[theme]} border-l-4 border-l-blue-500 relative overflow-hidden`}>
              <div className="absolute -right-4 -top-4 opacity-10"><Search size={80} className="text-blue-500"/></div>
              <h3 className="font-bold flex items-center mb-1"><Search size={18} className="mr-2 text-blue-500"/> Simulador de Fechas</h3>
              <p className={`text-[11px] mb-4 ${textMuted} relative z-10`}>Selecciona una fecha para cruzar tu diagrama con el de tus compañeros.</p>
              <input type="date" onChange={(e) => setTargetDate(e.target.value)} className={`w-full rounded-xl px-4 py-3 outline-none border ${inputBg} mb-4 relative z-10`} style={{ colorScheme: theme === 'light' ? 'light' : 'dark' }} />
              
              {targetDate && (
                <div className="space-y-2 relative z-10">
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

            <button onClick={shareMyCode} className={`w-full p-4 rounded-2xl border flex items-center justify-center space-x-2 transition-all active:scale-95 shadow-sm ${theme==='light'?'bg-blue-50 border-blue-200 text-blue-600':'bg-blue-500/10 border-blue-500/30 text-blue-400'}`}>
               <Smartphone size={18} />
               <span className="font-bold text-sm">Enviar mi código a un contacto</span>
            </button>

            <div className={`rounded-2xl border overflow-hidden ${cardClasses[theme]}`}>
              <div className="flex border-b border-inherit">
                 <button onClick={() => setAddMethod('manual')} className={`flex-1 py-3 text-sm font-bold transition-colors ${addMethod === 'manual' ? 'bg-blue-500/10 text-blue-500 border-b-2 border-b-blue-500' : textMuted}`}>Carga Manual</button>
                 <button onClick={() => setAddMethod('sync')} className={`flex-1 py-3 text-sm font-bold transition-colors ${addMethod === 'sync' ? 'bg-blue-500/10 text-blue-500 border-b-2 border-b-blue-500' : textMuted}`}>Vincular (Sync)</button>
              </div>
              <div className="p-5">
                {addMethod === 'manual' ? (
                  <form onSubmit={(e) => addGenericDoc(e, 'friends', { name: e.target.elements.name.value, workDays: parseInt(e.target.elements.w.value), restDays: parseInt(e.target.elements.r.value), startDate: e.target.elements.start.value, isSynced: false })} className="space-y-3 animate-in fade-in">
                    <input name="name" type="text" placeholder="Nombre" className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required />
                    <div className="flex space-x-2"><input name="w" type="number" placeholder="Trabajo" className={`flex-1 rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required /><input name="r" type="number" placeholder="Descanso" className={`flex-1 rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required /></div>
                    <div><label className={`block text-xs mb-1 ${textMuted}`}>Última subida del compañero</label><input name="start" type="date" className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required style={{ colorScheme: theme === 'light' ? 'light' : 'dark' }} /></div>
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl transition-colors mt-2">Guardar Manualmente</button>
                  </form>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); showToast("La sincronización P2P está en fase Beta."); }} className="space-y-4 animate-in fade-in">
                    <div className="relative"><input name="syncCode" type="text" placeholder="Ej. RM-XXXXX" className={`w-full rounded-xl px-4 py-3 text-sm outline-none border tracking-widest font-mono uppercase ${inputBg}`} required /><button type="submit" className="absolute right-2 top-2 bottom-2 bg-blue-500 hover:bg-blue-600 text-white px-4 rounded-lg font-bold transition-colors text-xs">Vincular</button></div>
                  </form>
                )}
              </div>
            </div>
            
            {friends.length > 0 && (
              <div className="space-y-2">
                {friends.map(friend => (
                  <div key={friend.id} className={`flex justify-between items-center p-3 rounded-xl border ${cardClasses[theme]}`}>
                    <div><p className="font-bold text-sm flex items-center">{friend.name}{friend.isSynced && <Share2 size={12} className="ml-1.5 text-blue-400"/>}</p><p className={`text-xs ${textMuted}`}>Esquema: {friend.workDays}x{friend.restDays}</p></div>
                    <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'friends', friend.id))} className="text-slate-500 hover:text-red-400 p-2"><Trash2 size={16}/></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PLANNER */}
        {activeTab === 'planner' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="mb-6">
               <HeaderTitle icon={CheckSquare} title="Planificador de Franco" colorClass="text-emerald-500" />
            </div>
            <form onSubmit={(e) => addGenericDoc(e, 'tasks', { title: e.target.elements.title.value, completed: false })} className="flex space-x-2">
              <input name="title" type="text" placeholder="Ej. Turno médico..." className={`flex-1 rounded-xl px-4 py-3 outline-none border shadow-sm ${inputBg}`} required/>
              <button type="submit" className="bg-emerald-500 hover:bg-emerald-400 text-white p-3 rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95"><Plus size={24}/></button>
            </form>
            <div className="space-y-3">
              {tasks.map(task => (
                <div key={task.id} className={`flex items-center justify-between p-4 rounded-xl border group transition-all ${task.completed ? 'opacity-60' : ''} ${cardClasses[theme]}`}>
                  <div className="flex items-center space-x-3 overflow-hidden cursor-pointer flex-1" onClick={() => toggleTask(task)}><div className={`flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${task.completed ? 'bg-emerald-500 border-emerald-500' : 'border-slate-400'}`}>{task.completed && <CheckSquare size={14} className="text-white" />}</div><span className={`truncate font-medium transition-all ${task.completed ? 'line-through opacity-50' : ''}`}>{task.title}</span></div>
                  <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id))} className="text-slate-400 hover:text-red-400 p-2 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: WEALTH */}
        {activeTab === 'wealth' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="flex justify-between items-center mb-6">
              <HeaderTitle icon={TrendingUp} title="Finanzas" colorClass="text-emerald-500" />
              <button onClick={() => setPremiumView(!premiumView)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center ${premiumView ? 'bg-indigo-500 text-white border-indigo-500 shadow-lg shadow-indigo-500/30' : (theme === 'light' ? 'bg-white text-indigo-500 border-indigo-200' : 'bg-slate-900 text-indigo-400 border-indigo-500/30')}`}>
                 {premiumView ? <Target size={14} className="mr-1"/> : <LineChart size={14} className="mr-1"/>} {premiumView ? 'Ver Mis Metas' : 'Inversiones PRO'}
              </button>
            </div>

            {!premiumView ? (
              <div className="space-y-6 animate-in fade-in">
                <div className={`rounded-2xl border p-5 ${cardClasses[theme]}`}>
                  <form onSubmit={(e) => { e.preventDefault(); addGenericDoc(e, 'goals', { title: e.target.elements.title.value, target: parseFloat(e.target.elements.target.value), current: 0, currency: e.target.elements.currency.value }); }} className="space-y-3">
                    <div className="flex space-x-2">
                      <input name="title" type="text" placeholder="Ej. Cambio de auto" className={`flex-1 rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required />
                      <select name="currency" className={`w-20 rounded-xl px-2 py-2 text-sm outline-none border ${inputBg}`}>
                        <option value="USD">USD</option><option value="ARS">ARS</option>
                      </select>
                    </div>
                    <input name="target" type="number" placeholder="Monto objetivo final" className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required />
                    <button type="submit" className="w-full bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 font-bold py-2.5 rounded-xl border border-emerald-500/20 transition-colors">Crear Meta Financiera</button>
                  </form>
                </div>
                <div className="space-y-4">
                  {goals.map(goal => {
                    const progress = goal.target > 0 ? (goal.current / goal.target) * 100 : 0;
                    const isUSD = goal.currency === 'USD';
                    return (
                      <div key={goal.id} className={`rounded-2xl border p-5 ${cardClasses[theme]} relative overflow-hidden group`}>
                        {progress >= 100 && <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg flex items-center z-10"><Award size={12} className="mr-1"/> LOGRADO</div>}
                        <div className="flex justify-between items-center mb-3"><span className="font-bold relative z-10 flex items-center">{goal.title} <span className="ml-2 text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">{goal.currency || 'USD'}</span></span><button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'goals', goal.id))} className="text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity relative z-10"><Trash2 size={14}/></button></div>
                        <div className="flex items-end justify-between mb-2 relative z-10"><div className="flex items-baseline space-x-1"><span className="text-2xl font-black">{goal.current.toLocaleString()}</span><span className={`text-xs ${textMuted}`}>/ {goal.target.toLocaleString()}</span></div><span className="text-xs font-bold text-emerald-500">{progress.toFixed(0)}%</span></div>
                        <div className={`h-2.5 w-full rounded-full overflow-hidden relative z-10 ${theme === 'light' ? 'bg-slate-200' : 'bg-slate-800'}`}><div className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min(progress, 100)}%` }}></div></div>
                        {progress < 100 && (
                          <div className="mt-4 flex space-x-2 relative z-10">
                            <button onClick={() => addFunds(goal, isUSD ? 100 : 10000)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${theme === 'light' ? 'bg-white border-emerald-200 text-emerald-600' : 'bg-slate-900 border-emerald-500/30 text-emerald-400'}`}>+ {isUSD ? '$100' : '$10k'}</button>
                            <button onClick={() => addFunds(goal, isUSD ? 1000 : 100000)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${theme === 'light' ? 'bg-white border-emerald-200 text-emerald-600' : 'bg-slate-900 border-emerald-500/30 text-emerald-400'}`}>+ {isUSD ? '$1k' : '$100k'}</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-in slide-in-from-left-4">
                 <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl p-5 text-white shadow-xl border border-indigo-500/30 relative overflow-hidden">
                    <div className="absolute right-0 top-0 opacity-10"><TrendingUp size={100} /></div>
                    <h3 className="font-black text-lg mb-1 flex items-center"><LineChart size={18} className="mr-2 text-indigo-400"/> Mercado USA (Wall Street)</h3>
                    <p className="text-[10px] text-indigo-200 mb-4 opacity-80">Datos aproximados (Yahoo Finance).</p>
                    <div className="space-y-3 relative z-10">
                      <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10 flex justify-between items-center">
                        <div><p className="font-bold text-sm">S&P 500 (SPY)</p><p className="text-[10px] text-indigo-300">Las 500 empresas top</p></div>
                        <div className="text-right">
                          <p className="font-black">${marketData.SPY.price}</p>
                          <p className={`text-[10px] font-bold ${marketData.SPY.isUp ? 'text-emerald-400' : 'text-red-400'}`}>{marketData.SPY.change}</p>
                        </div>
                      </div>
                      <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10 flex justify-between items-center">
                        <div><p className="font-bold text-sm">Energía (XLE)</p><p className="text-[10px] text-indigo-300">Sector Petrolero Global</p></div>
                        <div className="text-right">
                          <p className="font-black">${marketData.XLE.price}</p>
                          <p className={`text-[10px] font-bold ${marketData.XLE.isUp ? 'text-emerald-400' : 'text-red-400'}`}>{marketData.XLE.change}</p>
                        </div>
                      </div>
                    </div>
                 </div>

                 <div className="bg-gradient-to-br from-cyan-900 to-slate-900 rounded-2xl p-5 text-white shadow-xl border border-cyan-500/30 relative overflow-hidden">
                    <h3 className="font-black text-lg mb-1 flex items-center"><Globe size={18} className="mr-2 text-cyan-400"/> Mercado Argentino (ADRs)</h3>
                    <p className="text-[10px] text-cyan-200 mb-4 opacity-80">Cotizaciones en USD.</p>
                    <div className="space-y-3 relative z-10">
                      <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10 flex justify-between items-center">
                        <div><p className="font-bold text-sm">YPF S.A. (YPF)</p><p className="text-[10px] text-cyan-300">Petróleo y Gas Estatal</p></div>
                        <div className="text-right">
                          <p className="font-black">${marketData.YPF.price}</p>
                          <p className={`text-[10px] font-bold ${marketData.YPF.isUp ? 'text-emerald-400' : 'text-red-400'}`}>{marketData.YPF.change}</p>
                        </div>
                      </div>
                      <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10 flex justify-between items-center">
                        <div><p className="font-bold text-sm">Pampa Energía (PAM)</p><p className="text-[10px] text-cyan-300">Generación y Gas</p></div>
                        <div className="text-right">
                          <p className="font-black">${marketData.PAM.price}</p>
                          <p className={`text-[10px] font-bold ${marketData.PAM.isUp ? 'text-emerald-400' : 'text-red-400'}`}>{marketData.PAM.change}</p>
                        </div>
                      </div>
                    </div>
                 </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            
            <div className="flex justify-between items-center mb-6">
              <HeaderTitle icon={Settings} title="Ajustes" colorClass="text-slate-400" />
              <button onClick={shareApp} className="flex items-center text-xs font-bold bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg shadow-lg shadow-indigo-500/30 transition-all active:scale-95"><Send size={14} className="mr-1.5"/> Invitar Colega</button>
            </div>
            
            {/* ESTADO DE CUENTA INTELIGENTE (VERIFICACIÓN SEGURA) */}
            {isPermanentlyLinked ? (
              <div className={`rounded-2xl border p-5 ${theme === 'light' ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500/10 border-emerald-500/30'} flex flex-col shadow-sm`}>
                 <div className="flex items-center justify-between">
                   <div>
                     <p className="font-bold text-emerald-500 text-sm flex items-center"><ShieldAlert size={16} className="mr-1.5"/> Cuenta Blindada</p>
                     <p className={`text-[10px] mt-0.5 ${textMuted}`}>Datos seguros en la nube de Google.</p>
                   </div>
                   <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                     <CheckCircle2 size={16} className="text-emerald-500"/>
                   </div>
                 </div>
                 <div className={`mt-3 pt-3 border-t ${theme === 'light' ? 'border-emerald-200' : 'border-emerald-500/20'}`}>
                   <p className="text-xs font-bold text-slate-500 flex items-center"><User size={12} className="mr-1"/> {user.email}</p>
                 </div>
              </div>
            ) : (
              <div className={`rounded-2xl border p-5 ${cardClasses[theme]} border-amber-500/30 bg-amber-500/5`}>
                <h3 className="font-bold flex items-center mb-2"><AlertCircle size={18} className="mr-2 text-amber-500"/> Modo Invitado</h3>
                <p className={`text-[10px] mb-4 ${textMuted}`}>Si borras el historial, perderás tus datos. Vincula tu cuenta para hacer un respaldo en la nube.</p>
                <button onClick={linkWithGoogle} className="w-full flex items-center justify-center bg-white text-slate-900 border border-slate-200 font-bold py-2.5 rounded-xl transition-all shadow-sm active:scale-95 text-sm">
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Continuar con Google
                </button>
                {authMsg && <p className="text-[10px] mt-2 font-bold text-center text-amber-500">{authMsg}</p>}
              </div>
            )}

            <div className={`rounded-2xl border p-4 flex items-center justify-between ${cardClasses[theme]}`}>
               <div><p className={`text-xs font-bold uppercase tracking-wider text-blue-500`}>Tu Código RosterMax</p><p className="font-mono text-lg tracking-widest mt-1">RM-{user?.uid?.substring(0, 5).toUpperCase() || 'XXXXX'}</p></div>
               <button onClick={shareMyCode} className={`p-2 rounded-lg border active:scale-90 transition-transform ${theme==='light'?'bg-slate-50 border-slate-200':'bg-slate-800 border-slate-700'}`}><Share2 size={18} className={textMuted}/></button>
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
                <button type="submit" className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2.5 rounded-xl transition-all text-sm mt-2 shadow-lg shadow-indigo-500/20 active:scale-95">Guardar Perfil</button>
              </form>
            </div>
            
            <div className={`rounded-2xl border p-5 ${cardClasses[theme]}`}>
              <h3 className="font-bold flex items-center mb-4"><Calendar size={18} className="mr-2 text-emerald-500"/> Configuración de Diagrama</h3>
              <form onSubmit={updateRoster} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={`block text-xs mb-1 ${textMuted}`}>Días Trabajo</label><input name="workDays" type="number" defaultValue={rosterConfig.workDays} className={`w-full rounded-lg px-3 py-2 outline-none border ${inputBg}`} /></div>
                  <div><label className={`block text-xs mb-1 ${textMuted}`}>Días Descanso</label><input name="restDays" type="number" defaultValue={rosterConfig.restDays} className={`w-full rounded-lg px-3 py-2 outline-none border ${inputBg}`} /></div>
                </div>
                <div><label className={`block text-xs mb-1 ${textMuted}`}>Última subida a yacimiento</label><input name="startDate" type="date" defaultValue={rosterConfig.startDate} className={`w-full rounded-lg px-3 py-2 outline-none border ${inputBg}`} style={{ colorScheme: theme === 'light' ? 'light' : 'dark' }} /></div>
                <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-500/30 transition-all active:scale-95">Actualizar Diagrama</button>
              </form>
            </div>

            <div className={`rounded-2xl border p-5 space-y-4 mb-10 ${cardClasses[theme]}`}>
              <h3 className="font-bold flex items-center"><Sun size={18} className="mr-2 text-amber-500"/> Apariencia de Interfaz</h3>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => toggleTheme('light')} className={`p-4 rounded-xl border flex items-center justify-center gap-2 transition-all ${theme === 'light' ? 'bg-emerald-50 border-emerald-500 text-emerald-600 shadow-sm' : inputBg}`}><Sun size={20} /> <span className="text-sm font-semibold">Claro</span></button>
                <button onClick={() => toggleTheme('dark')} className={`p-4 rounded-xl border flex items-center justify-center gap-2 transition-all ${theme === 'dark' ? 'bg-slate-800 border-emerald-500 text-emerald-400 shadow-sm' : inputBg}`}><Moon size={20} /> <span className="text-sm font-semibold">Oscuro</span></button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: ADMIN DASHBOARD (CEO) */}
        {activeTab === 'admin' && isAdmin && (
          <div className="space-y-6 animate-in zoom-in-95 duration-300">
             <div className="mb-6">
                <HeaderTitle icon={ShieldAlert} title="Centro de Mando" colorClass="text-amber-500" />
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div className={`rounded-2xl border p-5 ${cardClasses[theme]} border-t-4 border-t-blue-500`}>
                  <Users2 size={24} className="text-blue-500 mb-2"/>
                  <span className="text-3xl font-black">{realUserCount}</span>
                  <p className={`text-[10px] uppercase font-bold tracking-widest ${textMuted} mt-1`}>Cuentas Creadas</p>
                </div>
                <div className={`rounded-2xl border p-5 ${cardClasses[theme]} border-t-4 border-t-emerald-500`}>
                  <Megaphone size={24} className="text-emerald-500 mb-2"/>
                  <span className="text-3xl font-black">{currentAd ? '1' : '0'}</span>
                  <p className={`text-[10px] uppercase font-bold tracking-widest ${textMuted} mt-1`}>Anuncios Activos</p>
                </div>
             </div>

             <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 mb-10">
               <h3 className="font-bold flex items-center mb-4 text-amber-500"><Target size={18} className="mr-2"/> Smart Ad Engine</h3>
               
               {/* VISTA DE LA CAMPAÑA ACTIVA (NUEVO) */}
               {currentAd ? (
                 <div className="bg-slate-900 border border-amber-500/50 p-4 rounded-xl mb-6 shadow-lg shadow-amber-500/10">
                    <div className="flex items-center justify-between mb-2">
                       <p className="text-[10px] uppercase tracking-widest text-amber-500 font-bold flex items-center"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span> Al Aire</p>
                    </div>
                    <p className="font-bold text-white text-lg">{currentAd.title}</p>
                    <p className="text-sm text-slate-400 mb-4">{currentAd.company} • Objetivo: {currentAd.location}</p>
                    <button onClick={deleteAd} className="w-full flex items-center justify-center bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20 font-bold py-2 rounded-lg text-sm transition-colors"><Trash2 size={16} className="mr-2"/> Detener y Eliminar</button>
                 </div>
               ) : (
                 <p className="text-xs text-slate-400 mb-6 italic border-l-2 border-slate-600 pl-3">No hay campañas activas en este momento.</p>
               )}

               <form onSubmit={launchAd} className="space-y-3 pt-2 border-t border-amber-500/20">
                 <p className="text-xs text-amber-500 font-bold mb-2">{currentAd ? 'Reemplazar con Nueva Campaña:' : 'Crear Nueva Campaña:'}</p>
                 <input name="adCompany" type="text" placeholder="Empresa (Ej. Hilux Service)" className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required />
                 <input name="adTitle" type="text" placeholder="Título (Ej. 20% Off Pastillas)" className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required />
                 <input name="adLocation" type="text" placeholder="Locación Objetivo (Ej. Neuquén, o 'Todos')" className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required />
                 <button type="submit" className="w-full mt-4 bg-amber-500 text-slate-900 font-bold py-3 rounded-xl text-sm hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20 active:scale-95">{currentAd ? 'Reemplazar Campaña' : 'Lanzar Campaña'}</button>
               </form>
             </div>
          </div>
        )}

      </main>

      <nav className={`fixed bottom-0 w-full border-t pb-safe z-40 ${theme === 'light' ? 'bg-white/90 border-slate-200' : 'bg-slate-950/90 border-slate-800'} backdrop-blur-xl`}>
        <div className="max-w-md mx-auto px-2 py-3 flex justify-between items-center">
          <button onClick={() => setActiveTab('roster')} className={`flex-1 flex flex-col items-center space-y-1 transition-colors ${activeTab === 'roster' ? 'text-emerald-500' : textMuted}`}><Calendar size={20} /><span className="text-[9px] font-bold">Roster</span></button>
          <button onClick={() => setActiveTab('crew')} className={`flex-1 flex flex-col items-center space-y-1 transition-colors ${activeTab === 'crew' ? 'text-blue-500' : textMuted}`}><Users size={20} /><span className="text-[9px] font-bold">Equipo</span></button>
          <button onClick={() => setActiveTab('planner')} className={`flex-1 flex flex-col items-center space-y-1 transition-colors ${activeTab === 'planner' ? 'text-emerald-500' : textMuted}`}><CheckSquare size={20} /><span className="text-[9px] font-bold">Franco</span></button>
          <button onClick={() => setActiveTab('wealth')} className={`flex-1 flex flex-col items-center space-y-1 transition-colors ${activeTab === 'wealth' ? 'text-emerald-500' : textMuted}`}><TrendingUp size={20} /><span className="text-[9px] font-bold">Finanzas</span></button>
          <button onClick={() => setActiveTab('settings')} className={`flex-1 flex flex-col items-center space-y-1 transition-colors ${activeTab === 'settings' ? 'text-emerald-500' : textMuted}`}><Settings size={20} /><span className="text-[9px] font-bold">Ajustes</span></button>
          
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
