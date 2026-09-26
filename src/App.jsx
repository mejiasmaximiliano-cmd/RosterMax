import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar, CheckSquare, TrendingUp, User, 
  Settings, Target, Plus, Trash2, AlertCircle, ChevronRight,
  Briefcase, Sun, Moon, Search, FileText,
  CheckCircle2, Circle, X, Users,
  Plane, Thermometer, Zap,
  Share2, MapPin, Building2, Truck, BriefcaseBusiness,
  CloudOff, ShieldAlert, Download, Send, Smartphone,
  Megaphone, Bell, BellRing, Clock3, Link2, LogIn, LogOut,
  ExternalLink, MessageSquare, PauseCircle, Umbrella, Stethoscope,
  CalendarRange, Activity, ChevronDown,
  ChevronUp, Filter, Clock, Pencil
} from 'lucide-react';
import { 
  GoogleAuthProvider, signInWithPopup, linkWithPopup, signOut, reauthenticateWithPopup,
} from 'firebase/auth';
import { doc, setDoc, collection, onSnapshot, addDoc, deleteDoc, getDoc, runTransaction, serverTimestamp, writeBatch } from 'firebase/firestore';
import { APP_ID, auth, db } from './lib/firebase';
import {
  SCHEDULE_EXCEPTION_TYPES,
  addDaysToDate,
  getLocalDate,
  getNextTransition,
  getStatusForDate,
  sanitizeSharedExceptions,
  validateRosterConfig,
  validateScheduleException,
} from './lib/roster';
import { createSyncCode, isValidSyncCode, normalizeSyncCode } from './lib/sync';
import { searchWeatherLocations } from './lib/weather';
import { findRestCoincidences, groupCoincidenceWindows } from './lib/coincidences';
import { getTransitionReminder } from './lib/reminders';
import { getAuthErrorMessage } from './lib/auth';
import { selectActiveCampaign, validateCampaign } from './lib/ads';
import { buildReciprocalFriendRecord, buildSyncedFriendRecord, findExistingConnection } from './lib/connections';
import { validateTask } from './lib/planning';
import { getAudienceSummary, getCampaignSummary } from './lib/analytics';
import OnboardingModal from './components/OnboardingModal';
import SessionGate from './components/SessionGate';
import { useToday } from './lib/useToday';
import RosterCalendar from './components/RosterCalendar';
import FinancePanel from './components/FinancePanel';
import DateSimulator from './components/DateSimulator';
import CeoAudiencePanel from './components/CeoAudiencePanel';
import WeatherPanel from './components/WeatherPanel';
import { fetchAccountCensus } from './lib/accountCensus';
import PlannerPanel from './components/PlannerPanel';
import { getCalendarDayLabel } from './lib/calendar';

const ONBOARDING_DISMISS_KEY = 'rostermax:onboarding-v2-dismissed';
const PUBLIC_APP_URL = import.meta.env.VITE_PUBLIC_APP_URL || 'https://rostermax.vercel.app';
const APP_VERSION = 'beta-0.6';

const EXCEPTION_LABELS = {
  vacation: 'Vacaciones',
  medical: 'Carpeta médica',
  leave: 'Permiso / licencia',
  extra_work: 'Trabajo extra',
  special_roster: 'Roster especial',
};



function getTodayDate() {
  return getLocalDate();
}

function getInviteCodeFromLocation() {
  if (typeof window === 'undefined') return '';
  const code = normalizeSyncCode(new URL(window.location.href).searchParams.get('sync'));
  return isValidSyncCode(code) ? code : '';
}

function formatShortDate(dateString) {
  if (!dateString) return '';
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${dateString}T00:00:00Z`));
}

function formatAmount(value, currency = 'USD') {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2, style: 'currency', currency })
    .format(Number(value) || 0);
}

const DEFAULT_WEATHER_LOCATION = {
  name: 'Neuquén',
  label: 'Ciudad de Neuquén, Provincia del Neuquén, Argentina',
  latitude: -38.95078,
  longitude: -68.0592,
};

const DEFAULT_PROFILE = {
  displayName: '',
  company: '',
  sector: 'Petróleo & Gas',
  location: 'Neuquén',
  transport: 'Vuelo',
  homeProvince: '',
  siteProvince: '',
  weatherLocation: DEFAULT_WEATHER_LOCATION,
};

function getPublicName(currentUser, profile) {
  return (profile.displayName?.trim() || currentUser.displayName || 'Compañero RosterMax').slice(0, 40);
}

function getSyncCodeRef(code) {
  return doc(db, 'artifacts', APP_ID, 'public', 'data', 'sync_codes', code);
}

async function trackCampaignMetric(currentUser, campaignId, type) {
  if (!currentUser || !campaignId || !['view', 'click'].includes(type)) return;
  const metricRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'campaign_metrics', `${campaignId}_${currentUser.uid}`);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(metricRef);
    const current = snapshot.exists() ? snapshot.data() : {};
    const views = Math.max(0, Number(current.views || 0)) + (type === 'view' ? 1 : 0);
    const clicks = Math.max(0, Number(current.clicks || 0)) + (type === 'click' ? 1 : 0);
    transaction.set(metricRef, {
      ownerUid: currentUser.uid,
      campaignId,
      views,
      clicks,
      firstViewAt: current.firstViewAt || serverTimestamp(),
      lastEventAt: serverTimestamp(),
    });
  });
}

function HeaderTitle({ icon: Icon, title, colorClass, theme }) {
  const cardClass = theme === 'light'
    ? 'bg-white border-slate-200 shadow-sm'
    : 'bg-slate-900/60 border-slate-800 backdrop-blur-xl';

  return (
    <div className="flex items-center space-x-3">
      <div className={`p-2.5 rounded-xl border ${cardClass} bg-opacity-50 shadow-sm`}>
        <Icon className={colorClass} size={22}/>
      </div>
      <h2 className={`text-2xl font-black tracking-tight ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
        {title}
      </h2>
    </div>
  );
}

function ScheduleExceptionIcon({ type, size = 18 }) {
  if (type === 'vacation') return <Umbrella size={size}/>;
  if (type === 'medical') return <Stethoscope size={size}/>;
  if (type === 'special_roster') return <CalendarRange size={size}/>;
  if (type === 'extra_work') return <Briefcase size={size}/>;
  return <Clock size={size}/>;
}

export default function App() {
  return <SessionGate>{({ user, admin }) => <SessionApp key={user.uid} user={user} hasAdminClaim={admin}/>}</SessionGate>;
}

function SessionApp({ user, hasAdminClaim }) {
  // --- STATES ---
  const today = useToday();
  const [activeTab, setActiveTab] = useState(() => getInviteCodeFromLocation() ? 'crew' : 'roster');
  const [theme, setTheme] = useState('dark'); 
  const [addMethod, setAddMethod] = useState(() => getInviteCodeFromLocation() ? 'sync' : 'manual');
  
  // States: UX, PWA, Admin & Auth
  const [toast, setToast] = useState('');
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [hasAdminRecord, setHasAdminRecord] = useState(false);
  const isAdmin = hasAdminClaim || hasAdminRecord;
  const [installPrompt, setInstallPrompt] = useState(null);
  const [authMsg, setAuthMsg] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [showExistingAccountConfirm, setShowExistingAccountConfirm] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // Data States
  const [rosterConfig, setRosterConfig] = useState({ workDays: 14, restDays: 14, startDate: getTodayDate() });
  const [loaded, setLoaded] = useState({});
  const [rosterSaved, setRosterSaved] = useState(false);
  const [confirmed, setConfirmed] = useState({});
  const sharedReady = confirmed.roster && confirmed.profile && confirmed.exceptions;
  const [dataError, setDataError] = useState('');
  const [pendingWrites, setPendingWrites] = useState(0);
  const [userProfile, setUserProfile] = useState(DEFAULT_PROFILE);
  const [tasks, setTasks] = useState([]);
  const [goals, setGoals] = useState([]);
  const [logs, setLogs] = useState([]); 
  const [friends, setFriends] = useState([]); 
  const [scheduleExceptions, setScheduleExceptions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [financeSettings, setFinanceSettings] = useState({ currency: 'ARS' });
  const [privacySettings, setPrivacySettings] = useState({ analyticsEnabled: false });
  const [activityMetrics, setActivityMetrics] = useState([]);
  const [campaignMetrics, setCampaignMetrics] = useState([]);
  const [activityState, setActivityState] = useState('loading');
  const [campaignState, setCampaignState] = useState('loading');
  const [census, setCensus] = useState(null);
  const [censusState, setCensusState] = useState('loading');
  const [censusRefreshing, setCensusRefreshing] = useState(false);
  const [censusError, setCensusError] = useState('');
  const censusBusyRef = useRef(false);
  const [friendLiveData, setFriendLiveData] = useState({});
  const [syncCode, setSyncCode] = useState('');
  const [syncState, setSyncState] = useState('loading');
  const [pendingInviteCode, setPendingInviteCode] = useState(getInviteCodeFromLocation);
  const [pendingInvite, setPendingInvite] = useState(() => ({ loading: Boolean(getInviteCodeFromLocation()), data: null, error: '' }));
  const [reminderSettings, setReminderSettings] = useState({ enabled: false, leadDays: 1 });
  const [targetDate, setTargetDate] = useState('');
  const [ads, setAds] = useState([]);
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [crewSearch, setCrewSearch] = useState('');
  const [showAllFriends, setShowAllFriends] = useState(false);
  const [showAllCoincidences, setShowAllCoincidences] = useState(false);

  const [showExceptionForm, setShowExceptionForm] = useState(false);
  const [exceptionType, setExceptionType] = useState('vacation');
  const [editingException, setEditingException] = useState(null);
  const [exceptionBusy, setExceptionBusy] = useState(false);
  const [plannedDate, setPlannedDate] = useState('');
  const exceptionSectionRef = useRef(null);
  const [installDetected, setInstallDetected] = useState(() => (
    localStorage.getItem('rostermax:installed') === '1'
    || window.matchMedia?.('(display-mode: standalone)').matches
  ));
  const adContainerRef = useRef(null);

  // API States
  const [weatherQuery, setWeatherQuery] = useState('');
  const [weatherOptions, setWeatherOptions] = useState([]);
  const [weatherSearching, setWeatherSearching] = useState(false);
  // --- SISTEMA DE NOTIFICACIONES (TOAST) ---
  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  const refreshAccountCensus = async () => {
    if (!isAdmin || censusBusyRef.current) return;
    if (isOffline) { setCensusError('Conéctate a internet para actualizar el censo.'); return; }
    censusBusyRef.current = true;
    setCensusRefreshing(true);
    setCensusError('');
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/identitytoolkit');
      provider.setCustomParameters({ prompt: 'consent' });
      const result = await reauthenticateWithPopup(user, provider);
      // The OAuth access token is used in memory only, never persisted or logged.
      const accessToken = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
      const completedCensus = await fetchAccountCensus(accessToken);
      if (auth.currentUser?.uid !== user.uid) return;
      await setDoc(doc(db, 'artifacts', APP_ID, 'admin_stats', 'accounts'), {
        ...completedCensus, generatedAt: serverTimestamp(),
      });
      showToast('Censo actualizado. Se guardaron únicamente totales.');
    } catch (error) {
      const messages = {
        'census/permission-denied': 'Google no autorizó la lectura de las cuentas de Firebase. Usa la cuenta propietaria del proyecto y acepta el permiso solicitado.',
        'census/expired-token': 'La autorización de Google venció. Intenta actualizar de nuevo.',
        'census/timeout': 'La consulta tardó demasiado. Conservamos el último censo completo; vuelve a intentarlo.',
        'auth/user-mismatch': 'Selecciona la misma cuenta de Google con la que entraste al panel CEO.',
        'auth/popup-closed-by-user': 'Se cerró la autorización. El censo anterior sigue guardado.',
        'auth/popup-blocked': 'El navegador bloqueó la ventana. Permite ventanas emergentes o abre RosterMax en Chrome.',
        'permission-denied': 'No se pudo guardar el censo. Revisa los permisos privados del panel CEO.',
      };
      setCensusError(messages[error?.code] || 'No se pudo completar la actualización. Conservamos el último censo; revisa tu conexión y vuelve a intentarlo.');
    } finally {
      censusBusyRef.current = false;
      setCensusRefreshing(false);
    }
  };

  const savePrivate = async (promise, message) => {
    setPendingWrites((count) => count + 1);
    const completion = promise.then(() => {
      if (navigator.onLine) showToast(message);
      return true;
    }).catch((error) => {
      console.error('No se pudo guardar el cambio.', error);
      setDataError('Un cambio no pudo sincronizarse. Revisa tu conexión y vuelve a intentarlo.');
      return false;
    }).finally(() => setPendingWrites((count) => Math.max(0, count - 1)));
    if (!navigator.onLine) {
      showToast('Cambio en cola. Se enviará al recuperar conexión.');
      return true;
    }
    return completion;
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
    const handleAppInstalled = () => {
      localStorage.setItem('rostermax:installed', '1');
      setInstallDetected(true);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!user) return undefined;

    return onSnapshot(
      doc(db, 'artifacts', APP_ID, 'admins', user.uid),
      (snapshot) => setHasAdminRecord(snapshot.exists() && snapshot.data().active === true),
      (error) => {
        console.error('No se pudo comprobar el rol administrativo.', error);
        setHasAdminRecord(false);
      },
    );
  }, [user]);

  // VERIFICACIÓN PERMANENTE
  const isPermanentlyLinked = user && !user.isAnonymous && user.email;

  // --- CÓDIGO PRIVADO DE SINCRONIZACIÓN ---
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const ensureSyncCode = async () => {
      setSyncState('loading');
      try {
        const settingsRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'sync');
        const settingsSnapshot = await getDoc(settingsRef);
        let code = settingsSnapshot.exists() ? settingsSnapshot.data().code : '';

        if (!isValidSyncCode(code)) {
          for (let attempt = 0; attempt < 5; attempt += 1) {
            const candidate = createSyncCode();
            const existing = await getDoc(getSyncCodeRef(candidate));
            if (!existing.exists()) {
              code = candidate;
              break;
            }
          }
          if (!code) throw new Error('No se pudo generar un código único.');
          await setDoc(settingsRef, { code, createdAt: serverTimestamp() }, { merge: true });
        }

        if (!cancelled) {
          setSyncCode(code);
          setSyncState('ready');
        }
      } catch (error) {
        console.error('No se pudo preparar la sincronización.', error);
        if (!cancelled) setSyncState('error');
      }
    };

    ensureSyncCode();
    return () => { cancelled = true; };
  }, [user, isOffline]);

  // Publica únicamente el calendario compartible. Los motivos privados de
  // ausencias se eliminan antes de sincronizar con compañeros.
  useEffect(() => {
    if (!user || !syncCode || !sharedReady || !rosterSaved || isOffline) return;
    let cancelled = false;
    const publish = async () => {
      try {
        await setDoc(getSyncCodeRef(syncCode), {
          ownerUid: user.uid, syncCode, name: getPublicName(user, userProfile),
          workDays: Number(rosterConfig.workDays), restDays: Number(rosterConfig.restDays),
          startDate: rosterConfig.startDate,
          exceptions: sanitizeSharedExceptions(scheduleExceptions), updatedAt: serverTimestamp(),
        });
        if (!cancelled) setSyncState('ready');
      } catch (error) {
        console.error('No se pudo publicar el roster compartible.', error);
        if (!cancelled) setSyncState('error');
      }
    };
    publish();
    return () => { cancelled = true; };
  }, [user, syncCode, userProfile, rosterConfig.workDays, rosterConfig.restDays, rosterConfig.startDate, scheduleExceptions, sharedReady, rosterSaved, isOffline]);

  // --- BASE DE DATOS PRIVADA EN TIEMPO REAL ---
  useEffect(() => {
    if (!user) return;
    const logRealtimeError = (source) => (error) => {
      console.error(`Error de lectura en ${source}.`, error);
      setDataError(`No pudimos cargar ${source}. Reintenta con conexión antes de modificar tus datos.`);
    };
    const markLoaded = (key) => setLoaded((current) => ({ ...current, [key]: true }));
    const confirmShared = (key, snapshot) => {
      setConfirmed((current) => ({ ...current, [key]: !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites }));
    };

    const unsubRoster = onSnapshot(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'roster'), { includeMetadataChanges: true }, (snapshot) => {
      if (snapshot.exists()) setRosterConfig(snapshot.data());
      setRosterSaved(snapshot.exists() && validateRosterConfig(snapshot.data()).valid);
      markLoaded('roster');
      confirmShared('roster', snapshot);
    }, logRealtimeError('roster'));
    const unsubProfile = onSnapshot(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'profile'), { includeMetadataChanges: true }, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setUserProfile({ ...DEFAULT_PROFILE, ...data, weatherLocation: data.weatherLocation || DEFAULT_WEATHER_LOCATION });
      }
      markLoaded('profile');
      confirmShared('profile', snapshot);
    }, logRealtimeError('perfil'));
    const unsubTheme = onSnapshot(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'theme'), (snapshot) => {
      if (snapshot.exists()) setTheme(snapshot.data().mode);
    }, logRealtimeError('tema'));
    const unsubReminders = onSnapshot(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'reminders'), (snapshot) => {
      if (snapshot.exists()) setReminderSettings({ enabled: false, leadDays: 1, ...snapshot.data() });
    }, logRealtimeError('recordatorios'));
    const unsubFinanceSettings = onSnapshot(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'finance'), (snapshot) => {
      if (snapshot.exists()) setFinanceSettings((current) => ({ ...current, ...snapshot.data() }));
      markLoaded('finance');
    }, logRealtimeError('presupuesto'));
    const unsubPrivacy = onSnapshot(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'privacy'), (snapshot) => {
      if (snapshot.exists()) setPrivacySettings((current) => ({ ...current, ...snapshot.data() }));
      markLoaded('privacy');
    }, logRealtimeError('privacidad'));
    const unsubOnboarding = onSnapshot(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'onboarding'), (snapshot) => {
      const completed = snapshot.exists() && snapshot.data().completed === true;
      if (!completed && localStorage.getItem(ONBOARDING_DISMISS_KEY) !== '1') setShowOnboarding(true);
    }, logRealtimeError('guía inicial'));
    
    const unsubTasks = onSnapshot(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'tasks'), (s) => { setTasks(s.docs.map(d => ({ id: d.id, ...d.data() }))); markLoaded('tasks'); }, logRealtimeError('tareas'));
    const unsubGoals = onSnapshot(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'goals'), (s) => { setGoals(s.docs.map(d => ({ id: d.id, ...d.data() }))); markLoaded('goals'); }, logRealtimeError('metas'));
    const unsubLogs = onSnapshot(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'logs'), (s) => setLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))), logRealtimeError('bitácora'));
    const unsubFriends = onSnapshot(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'friends'), (s) => setFriends(s.docs.map(d => ({ id: d.id, ...d.data() }))), logRealtimeError('compañeros'));
    const unsubExceptions = onSnapshot(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'schedule_exceptions'), { includeMetadataChanges: true }, (snapshot) => {
      setScheduleExceptions(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
        .sort((left, right) => String(left.startDate).localeCompare(String(right.startDate))));
      markLoaded('exceptions');
      confirmShared('exceptions', snapshot);
    }, logRealtimeError('cambios de roster'));
    const unsubExpenses = onSnapshot(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'expenses'), (snapshot) => {
      setExpenses(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
        .sort((left, right) => String(right.date).localeCompare(String(left.date))));
      markLoaded('expenses');
    }, logRealtimeError('gastos'));
    
    const unsubAds = onSnapshot(collection(db, 'artifacts', APP_ID, 'public', 'data', 'ads'), (snapshot) => {
      setAds(snapshot.docs.map((adDoc) => ({ id: adDoc.id, ...adDoc.data() })));
    }, logRealtimeError('anuncios'));

    return () => { 
      unsubRoster(); 
      unsubProfile(); 
      unsubTheme(); 
      unsubReminders();
      unsubFinanceSettings();
      unsubPrivacy();
      unsubOnboarding();
      unsubTasks(); 
      unsubGoals(); 
      unsubLogs(); 
      unsubFriends(); 
      unsubExceptions();
      unsubExpenses();
      unsubAds(); 
    };
  }, [user]);

  // Métricas propias, agregadas en el panel CEO y desactivadas por defecto.
  // Nunca se envían nombres, correos, empresa, ubicación ni contenido privado.
  useEffect(() => {
    if (!user || !loaded.privacy || !loaded.roster || !loaded.profile || !privacySettings.analyticsEnabled || isOffline) return;
    const activityRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'activity', user.uid);
    let lastRecorded = 0;
    let recording = false;
    let cancelled = false;
    const recordVisibleActivity = async () => {
      if (cancelled || recording || document.visibilityState === 'hidden' || Date.now() - lastRecorded < 15 * 60000) return;
      recording = true;
      try { await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(activityRef);
      transaction.set(activityRef, {
        ownerUid: user.uid,
        accountType: user.isAnonymous ? 'guest' : 'google',
        firstSeenAt: snapshot.exists() ? snapshot.data().firstSeenAt : serverTimestamp(),
        lastActiveAt: serverTimestamp(),
        lastActiveDay: today,
        installDetected: Boolean(installDetected),
        rosterConfigured: rosterSaved,
        profileComplete: Boolean(userProfile.displayName?.trim()),
        appVersion: APP_VERSION,
      });
      }); lastRecorded = Date.now(); }
      catch { /* Optional measurement must never block the worker's app. */ }
      finally { recording = false; }
    };
    recordVisibleActivity();
    const interval = setInterval(recordVisibleActivity, 15 * 60000);
    window.addEventListener('focus', recordVisibleActivity);
    document.addEventListener('visibilitychange', recordVisibleActivity);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', recordVisibleActivity);
      document.removeEventListener('visibilitychange', recordVisibleActivity);
    };
  }, [user, privacySettings.analyticsEnabled, installDetected, rosterSaved, userProfile.displayName, today, loaded.privacy, loaded.roster, loaded.profile, isOffline]);

  useEffect(() => {
    if (!user || !isAdmin) return undefined;

    return onSnapshot(
      collection(db, 'artifacts', APP_ID, 'public', 'data', 'feedback'),
      (snapshot) => setFeedbackItems(snapshot.docs
        .map((feedbackDoc) => ({ id: feedbackDoc.id, ...feedbackDoc.data() }))
        .sort((left, right) => Number(right.createdAt?.seconds || 0) - Number(left.createdAt?.seconds || 0))),
      (error) => console.error('No se pudo cargar el feedback de beta.', error),
    );
  }, [user, isAdmin]);

  useEffect(() => {
    if (!user || !isAdmin) return undefined;
    const unsubscribeActivity = onSnapshot(
      collection(db, 'artifacts', APP_ID, 'public', 'data', 'activity'),
      { includeMetadataChanges: true },
      (snapshot) => { setActivityMetrics(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))); setActivityState(snapshot.metadata.fromCache ? 'loading' : 'ready'); },
      () => setActivityState('error'),
    );
    const unsubscribeCampaigns = onSnapshot(
      collection(db, 'artifacts', APP_ID, 'public', 'data', 'campaign_metrics'),
      { includeMetadataChanges: true },
      (snapshot) => { setCampaignMetrics(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))); setCampaignState(snapshot.metadata.fromCache ? 'loading' : 'ready'); },
      () => setCampaignState('error'),
    );
    const unsubscribeCensus = onSnapshot(
      doc(db, 'artifacts', APP_ID, 'admin_stats', 'accounts'),
      { includeMetadataChanges: true },
      (snapshot) => { setCensus(snapshot.exists() ? snapshot.data() : null); setCensusState(snapshot.metadata.fromCache ? 'loading' : 'ready'); },
      () => setCensusState('error'),
    );
    return () => { unsubscribeActivity(); unsubscribeCampaigns(); unsubscribeCensus(); };
  }, [user, isAdmin]);

  // Solo escucha los códigos que el usuario agregó explícitamente.
  useEffect(() => {
    const syncedFriends = friends.filter((friend) => friend.isSynced && isValidSyncCode(friend.syncCode));
    if (syncedFriends.length === 0) {
      return undefined;
    }

    const unsubscribers = syncedFriends.map((friend) => onSnapshot(
      getSyncCodeRef(friend.syncCode),
      (snapshot) => {
        setFriendLiveData((current) => ({
          ...current,
          [friend.syncCode]: snapshot.exists() ? snapshot.data() : null,
        }));
      },
      (error) => {
        console.error(`No se pudo sincronizar ${friend.syncCode}.`, error);
        setFriendLiveData((current) => ({ ...current, [friend.syncCode]: null }));
      },
    ));

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [friends]);

  // Un enlace de invitación nunca vincula automáticamente: muestra primero
  // quién comparte su roster y espera confirmación explícita.
  useEffect(() => {
    if (!user || !pendingInviteCode) return;
    let cancelled = false;

    getDoc(getSyncCodeRef(pendingInviteCode))
      .then((snapshot) => {
        if (cancelled) return;
        if (!snapshot.exists()) {
          setPendingInvite({ loading: false, data: null, error: 'La invitación no existe o venció.' });
          return;
        }
        setPendingInvite({ loading: false, data: snapshot.data(), error: '' });
      })
      .catch((error) => {
        console.error('No se pudo abrir la invitación.', error);
        if (!cancelled) setPendingInvite({ loading: false, data: null, error: 'No pudimos comprobar la invitación.' });
      });

    return () => { cancelled = true; };
  }, [user, pendingInviteCode]);

  // --- COMBINACIÓN DE DIAGRAMAS EN TIEMPO REAL ---
  const displayFriends = useMemo(() => {
    return friends.map((friend) => {
      if (friend.isSynced) {
        const liveData = friendLiveData[friend.syncCode];
        if (liveData) {
          return {
            ...friend,
            name: liveData.name || friend.name,
            workDays: liveData.workDays,
            restDays: liveData.restDays,
            startDate: liveData.startDate,
            exceptions: Array.isArray(liveData.exceptions) ? liveData.exceptions : [],
            syncAvailable: true,
          };
        }
        return { ...friend, syncAvailable: false };
      }
      return friend;
    });
  }, [friends, friendLiveData]);

  // Las alertas web locales se muestran cuando el usuario abre la app dentro
  // de la ventana elegida. Las notificaciones con la app cerrada requerirán Push.
  useEffect(() => {
    if (!reminderSettings.enabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (!rosterSaved || !loaded.exceptions) return;
    const reminder = getTransitionReminder(today, { ...rosterConfig, exceptions: scheduleExceptions }, reminderSettings.leadDays);
    if (!reminder) return;

    const notificationKey = `rostermax:notified:${reminder.id}`;
    if (localStorage.getItem(notificationKey) === '1') return;

    const notify = async () => {
      try {
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          await registration.showNotification(reminder.title, {
            body: reminder.body,
            icon: '/logo.svg',
            badge: '/favicon.svg',
            tag: reminder.id,
          });
        } else {
          new Notification(reminder.title, { body: reminder.body, icon: '/logo.svg', tag: reminder.id });
        }
        localStorage.setItem(notificationKey, '1');
      } catch (error) {
        console.error('No se pudo mostrar el recordatorio.', error);
      }
    };
    notify();
  }, [reminderSettings, rosterConfig, scheduleExceptions, today, rosterSaved, loaded.exceptions]);

  const effectiveRoster = useMemo(() => ({ ...rosterConfig, exceptions: scheduleExceptions }), [rosterConfig, scheduleExceptions]);
  const currentStatus = useMemo(() => rosterSaved ? getStatusForDate(today, effectiveRoster) : { error: 'Configura tu roster' }, [effectiveRoster, today, rosterSaved]);
  const nextTransition = useMemo(() => rosterSaved ? getNextTransition(today, effectiveRoster) : { error: 'Configura tu roster' }, [effectiveRoster, today, rosterSaved]);
  const targetStatus = useMemo(() => rosterSaved ? getStatusForDate(targetDate, effectiveRoster) : { error: 'Configura tu roster' }, [targetDate, effectiveRoster, rosterSaved]);
  const upcomingCoincidences = useMemo(() => rosterSaved ? findRestCoincidences(
    today,
    effectiveRoster,
    displayFriends.filter((friend) => friend.syncAvailable !== false),
    { horizonDays: 120, maxResults: 120 * Math.max(1, displayFriends.length) },
  ) : [], [effectiveRoster, displayFriends, today, rosterSaved]);
  const groupedCoincidences = useMemo(() => groupCoincidenceWindows(upcomingCoincidences), [upcomingCoincidences]);
  const visibleCoincidences = showAllCoincidences ? groupedCoincidences : groupedCoincidences.slice(0, 3);
  const filteredFriends = useMemo(() => displayFriends
    .filter((friend) => friend.name?.toLowerCase().includes(crewSearch.trim().toLowerCase()))
    .sort((left, right) => String(left.name).localeCompare(String(right.name), 'es')), [displayFriends, crewSearch]);
  const visibleFriends = showAllFriends ? filteredFriends : filteredFriends.slice(0, 6);

  const audienceSummary = useMemo(() => getAudienceSummary(activityMetrics), [activityMetrics]);
  const currentAd = useMemo(
    () => selectActiveCampaign(ads, userProfile, today),
    [ads, userProfile, today],
  );
  const activeAdCount = useMemo(
    () => ads.filter((ad) => ad.active === true && (!ad.endDate || ad.endDate >= today) && (!ad.startDate || ad.startDate <= today)).length,
    [ads, today],
  );

  useEffect(() => {
    if (activeTab !== 'roster' || !currentAd?.id || !privacySettings.analyticsEnabled || isOffline || !adContainerRef.current || typeof IntersectionObserver === 'undefined') return undefined;
    const sessionKey = `rostermax:ad-view:${user.uid}:${today}:${currentAd.id}`;
    if (sessionStorage.getItem(sessionKey) === '1') return undefined;
    let timer = null;
    let visible = false;
    let recording = false;
    const cancelTimer = () => { clearTimeout(timer); timer = null; };
    const schedule = () => {
      cancelTimer();
      if (!visible || document.visibilityState !== 'visible' || recording) return;
      timer = setTimeout(async () => {
        if (!visible || document.visibilityState !== 'visible') return;
        recording = true;
        try {
          await trackCampaignMetric(user, currentAd.id, 'view');
          sessionStorage.setItem(sessionKey, '1');
          observer.disconnect();
        } catch (error) {
          console.error('No se pudo registrar la impresión.', error);
          recording = false;
        }
      }, 1000);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.intersectionRatio >= 0.5;
      schedule();
    }, { threshold: [0.5] });
    observer.observe(adContainerRef.current);
    document.addEventListener('visibilitychange', schedule);
    return () => { cancelTimer(); observer.disconnect(); document.removeEventListener('visibilitychange', schedule); };
  }, [currentAd, privacySettings.analyticsEnabled, user, activeTab, isOffline, today, loaded.roster, loaded.profile, loaded.exceptions]);

  // --- HANDLERS ACCIONES PWA ---
  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  };

  const linkNewGoogleAccount = async () => {
    if (!user?.isAnonymous) return;
    setAuthBusy(true);
    setAuthMsg('');
    try {
      const provider = new GoogleAuthProvider();
      await linkWithPopup(user, provider);
      showToast('Cuenta guardada con Google.');
    } catch (error) {
      console.error('No se pudo vincular Google.', error);
      setAuthMsg(getAuthErrorMessage(error));
    } finally {
      setAuthBusy(false);
    }
  };

  const signIntoExistingGoogleAccount = async () => {
    setShowExistingAccountConfirm(false);
    setAuthBusy(true);
    setAuthMsg('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      showToast('Ingresaste a tu cuenta existente.');
    } catch (error) {
      console.error('No se pudo iniciar sesión con Google.', error);
      setAuthMsg(getAuthErrorMessage(error));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setActiveTab('roster');
      showToast('Sesión cerrada.');
    } catch (error) {
      console.error('No se pudo cerrar la sesión.', error);
      showToast('No se pudo cerrar la sesión.');
    }
  };

  const shareMyCode = async () => {
    if (!rosterSaved) { setShowOnboarding(true); showToast('Guarda tu roster antes de invitar.'); return; }
    if (!sharedReady || syncState !== 'ready') { showToast('Espera a que tu roster termine de sincronizarse.'); return; }
    if (!syncCode) {
      showToast('Tu código todavía se está preparando.');
      return;
    }
    const inviteUrl = new URL(PUBLIC_APP_URL);
    inviteUrl.searchParams.set('sync', syncCode);
    const shareData = {
      title: 'Mi roster en RosterMax',
      text: `¡Comparemos nuestros francos! Mi código es ${syncCode}. Al aceptar, ambos podremos ver nuestros rosters.`,
      url: inviteUrl.toString(),
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* El usuario canceló el diálogo. */ }
    } else {
      await navigator.clipboard?.writeText(inviteUrl.toString());
      showToast(`Enlace de invitación copiado.`);
    }
  };

  const shareApp = async () => {
    const shareData = { title: 'RosterMax', text: '¡Instala RosterMax! La app para gestionar nuestro diagrama.', url: PUBLIC_APP_URL };
    if (navigator.share) { try { await navigator.share(shareData); } catch { /* El usuario canceló el diálogo. */ } }
    else { showToast("Comparte tu enlace web."); }
  };

  // --- SUBMIT FORMULARIOS ---
  const saveRoster = async (rosterData) => {
    const validation = validateRosterConfig(rosterData);
    if (!validation.valid) { showToast(validation.error); return false; }
    return savePrivate(setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'roster'), rosterData), 'Diagrama actualizado.');
  };

  const updateRoster = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await saveRoster({
      workDays: Number(form.get('workDays')),
      restDays: Number(form.get('restDays')),
      startDate: form.get('startDate'),
    });
  };

  const saveProfile = async (profileData) => savePrivate(
    setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'profile'), {
      ...DEFAULT_PROFILE, ...profileData,
      displayName: String(profileData.displayName || '').trim().slice(0, 40),
      weatherLocation: profileData.weatherLocation || userProfile.weatherLocation || DEFAULT_WEATHER_LOCATION,
    }), 'Perfil guardado.',
  );

  const updateProfile = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await saveProfile({
      displayName: form.get('displayName'),
      company: form.get('company'),
      sector: form.get('sector'),
      location: form.get('location'),
      transport: form.get('transport'),
      homeProvince: form.get('homeProvince'),
      siteProvince: form.get('siteProvince'),
      weatherLocation: userProfile.weatherLocation || DEFAULT_WEATHER_LOCATION,
    });
  };

  const completeOnboarding = async (destination = 'roster') => {
    const saved = await savePrivate(setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'onboarding'), {
      completed: true, version: 2, completedAt: serverTimestamp(),
    }), 'Configuración guardada.');
    if (!saved) return;
    localStorage.removeItem(ONBOARDING_DISMISS_KEY);
    setShowOnboarding(false);
    setActiveTab(destination);
  };

  const skipOnboarding = () => {
    localStorage.setItem(ONBOARDING_DISMISS_KEY, '1');
    setShowOnboarding(false);
  };

  const reopenOnboarding = () => {
    localStorage.removeItem(ONBOARDING_DISMISS_KEY);
    setShowOnboarding(true);
  };

  const handleWeatherSearch = async () => {
    if (weatherQuery.trim().length < 2) {
      showToast('Escribe una ciudad o localidad cercana.');
      return;
    }
    setWeatherSearching(true);
    try {
      const options = await searchWeatherLocations(weatherQuery);
      setWeatherOptions(options);
      if (options.length === 0) showToast('No encontramos esa localidad en Argentina.');
    } catch (error) {
      console.error('Falló la búsqueda climática.', error);
      showToast('No pudimos buscar la ubicación climática.');
    } finally {
      setWeatherSearching(false);
    }
  };

  const selectWeatherLocation = (location) => {
    setUserProfile((profile) => ({ ...profile, weatherLocation: location }));
    setWeatherOptions([]);
    setWeatherQuery('');
    showToast(`Clima configurado para ${location.name}. Guarda el perfil.`);
  };

  const clearPendingInvite = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('sync');
    window.history.replaceState({}, '', url);
    setPendingInviteCode('');
    setPendingInvite({ loading: false, data: null, error: '' });
  };

  // --- MULTIJUGADOR: PROCESO REAL DE VINCULACIÓN ---
  const linkSyncCode = async (rawCode, { reciprocal = false } = {}) => {
    if (!navigator.onLine) { showToast('Conéctate para comprobar la invitación.'); return false; }
    if (!sharedReady) { showToast('Estamos cargando tu roster guardado. Espera un momento y vuelve a intentar.'); return false; }
    if (!rosterSaved) {
      showToast('Configura y guarda tu roster antes de compartirlo.');
      setShowOnboarding(true);
      return false;
    }
    const codeInput = normalizeSyncCode(rawCode);
    if (!isValidSyncCode(codeInput)) {
      showToast("El código debe tener el formato RM-XXXXXXXX.");
      return false;
    }

    try {
      const snapshot = await getDoc(getSyncCodeRef(codeInput));
      if (!snapshot.exists()) {
        showToast("Código inexistente o vencido.");
        return false;
      }
      const foundUser = snapshot.data();
      if (foundUser.ownerUid === user.uid) {
        showToast("No puedes sincronizarte contigo mismo.");
        return false;
      }
      const existingConnection = findExistingConnection(friends, foundUser.ownerUid, codeInput);
      if (existingConnection && !reciprocal) {
        showToast("Este compañero ya está en tu lista.");
        return false;
      }

      if (reciprocal) {
        if (syncState !== 'ready' || !isValidSyncCode(syncCode)) {
          showToast('Tu código todavía se está preparando. Inténtalo nuevamente.');
          return false;
        }

        // Garantiza que el roster del invitado exista antes de autorizar el
        // registro recíproco mediante las reglas de Firestore.
        await setDoc(getSyncCodeRef(syncCode), {
          ownerUid: user.uid,
          syncCode,
          name: getPublicName(user, userProfile),
          workDays: Number(rosterConfig.workDays),
          restDays: Number(rosterConfig.restDays),
          startDate: rosterConfig.startDate,
          exceptions: sanitizeSharedExceptions(scheduleExceptions),
          updatedAt: serverTimestamp(),
        });

        const ownRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'friends', foundUser.ownerUid);
        const reverseRef = doc(db, 'artifacts', APP_ID, 'users', foundUser.ownerUid, 'friends', user.uid);
        await runTransaction(db, async (transaction) => {
          const own = await transaction.get(ownRef);
          const reverse = await transaction.get(reverseRef);
          if (!own.exists()) transaction.set(ownRef, {
            ...buildSyncedFriendRecord(foundUser, codeInput), createdAt: serverTimestamp(),
          });
          if (!reverse.exists()) transaction.set(reverseRef, {
            ...buildReciprocalFriendRecord({
              uid: user.uid, name: getPublicName(user, userProfile), syncCode, inviteCode: codeInput,
            }),
            createdAt: serverTimestamp(),
          });
          // Migración de vínculos antiguos con IDs aleatorios a un único vínculo por cuenta.
          if (existingConnection && existingConnection.id !== foundUser.ownerUid) {
            transaction.delete(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'friends', existingConnection.id));
          }
        });
        showToast(`¡Listo! Tú y ${foundUser.name} ya comparten sus rosters.`);
      } else {
        await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'friends'), {
          ...buildSyncedFriendRecord(foundUser, codeInput),
          createdAt: serverTimestamp(),
        });
        showToast(`¡Sincronizado con ${foundUser.name}!`);
      }
      return true;
    } catch (error) {
      console.error('No se pudo guardar la vinculación.', error);
      showToast("Error al guardar vinculación.");
      return false;
    }
  };

  const handleSyncAdd = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const linked = await linkSyncCode(formElement.elements.syncCode.value, { reciprocal: true });
    if (linked) formElement.reset();
  };

  const acceptPendingInvite = async () => {
    const linked = await linkSyncCode(pendingInviteCode, { reciprocal: true });
    if (linked) clearPendingInvite();
  };

  const requestTurnReminders = async () => {
    if (typeof Notification === 'undefined') {
      showToast('Este navegador no admite alertas del sistema.');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showToast('Necesitamos permiso para mostrar alertas.');
      return;
    }
    await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'reminders'), {
      enabled: true,
      leadDays: reminderSettings.leadDays || 1,
      updatedAt: serverTimestamp(),
    });
    showToast('Alertas de cambio de turno activadas.');
  };

  const disableTurnReminders = async () => {
    await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'reminders'), {
      enabled: false,
      leadDays: reminderSettings.leadDays || 1,
      updatedAt: serverTimestamp(),
    });
    showToast('Alertas desactivadas.');
  };

  const updateReminderLeadDays = async (leadDays) => {
    await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'reminders'), {
      ...reminderSettings,
      leadDays: Number(leadDays),
      updatedAt: serverTimestamp(),
    });
  };

  const toggleTheme = async (newTheme) => {
    setTheme(newTheme);
    if(user) await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'theme'), { mode: newTheme });
  };

  const addGenericDoc = async (event, collectionName, fields) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const saved = await savePrivate(addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, collectionName), { ...fields, createdAt: serverTimestamp() }), 'Registro guardado.');
    if (saved) formElement.reset();
  };

  const toggleLog = async (log) => savePrivate(setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'logs', log.id), { resolved: !log.resolved }, { merge: true }), 'Registro actualizado.');


  const createScheduleException = async (event) => {
    event.preventDefault();
    if (exceptionBusy) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const validation = validateScheduleException({
      id: editingException?.id,
      type: form.get('type'),
      label: form.get('label'),
      startDate: form.get('startDate'),
      endDate: form.get('endDate'),
      workDays: Number(form.get('workDays')),
      restDays: Number(form.get('restDays')),
      cycleStartDate: form.get('cycleStartDate'),
    }, scheduleExceptions);
    if (!validation.valid) {
      showToast(validation.error);
      return;
    }
    try {
      setExceptionBusy(true);
      const saved = await savePrivate(editingException
        ? setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'schedule_exceptions', editingException.id), { ...validation.exception, updatedAt: serverTimestamp() }, { merge: true })
        : addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'schedule_exceptions'), { ...validation.exception, createdAt: serverTimestamp() }), 'Cambio temporal aplicado al calendario.');
      if (!saved) return;
      formElement.reset();
      setEditingException(null);
      setExceptionType('vacation');
      setShowExceptionForm(false);
    } catch (error) {
      console.error('No se pudo guardar el cambio temporal.', error);
      showToast('No se pudo guardar el cambio de roster.');
    } finally {
      setExceptionBusy(false);
    }
  };

  const saveRestTask = async (task) => {
    const validation = validateTask(task);
    if (!validation.valid) { showToast(validation.error); return false; }
    const data = { ...validation.task, updatedAt: serverTimestamp() };
    return savePrivate(task.id
      ? setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'tasks', task.id), data, { merge: true })
      : addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'tasks'), { ...data, createdAt: serverTimestamp() }),
    task.id ? 'Plan actualizado.' : 'Plan guardado.');
  };

  const saveFinancePlan = async ({ month, currency, monthlyIncome, fixedCosts, plannedSavings }) => {
    const legacyExpenseCurrency = financeSettings.legacyExpenseCurrency || financeSettings.currency || 'ARS';
    const monthlyPlans = {};
    if (!financeSettings.monthlyPlans && Object.hasOwn(financeSettings, 'monthlyIncome')) {
      monthlyPlans[today.slice(0, 7)] = { [legacyExpenseCurrency]: {
        monthlyIncome: Number(financeSettings.monthlyIncome || 0), fixedCosts: Number(financeSettings.fixedCosts || 0),
        plannedSavings: Number(financeSettings.plannedSavings || 0), currency: legacyExpenseCurrency,
      } };
    }
    monthlyPlans[month] = { ...monthlyPlans[month], [currency]: { monthlyIncome, fixedCosts, plannedSavings, currency } };
    return savePrivate(setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'finance'), {
      currency, legacyExpenseCurrency,
      monthlyPlans,
      updatedAt: serverTimestamp(),
    }, { merge: true }), 'Presupuesto del mes guardado.');
  };

  const addExpense = async (expense) => savePrivate(
    addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'expenses'), { ...expense, createdAt: serverTimestamp() }),
    'Gasto registrado.',
  );

  const toggleAnalytics = async () => {
    if (!loaded.privacy) return;
    const nextValue = !privacySettings.analyticsEnabled;
    const batch = writeBatch(db);
    batch.set(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'privacy'), {
      analyticsEnabled: nextValue, updatedAt: serverTimestamp(),
    }, { merge: true });
    if (!nextValue) batch.delete(doc(db, 'artifacts', APP_ID, 'public', 'data', 'activity', user.uid));
    await savePrivate(batch.commit(), nextValue ? 'Métricas opcionales activadas.' : 'Métricas desactivadas.');
  };

  const createFinancialGoal = async (goal) => savePrivate(
    addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'goals'), { ...goal, current: 0, createdAt: serverTimestamp() }),
    'Meta de ahorro creada.',
  );

  const addFunds = async (goal, amount) => {
    if (!navigator.onLine) {
      showToast('Conéctate para confirmar el saldo antes de registrar un aporte.');
      return false;
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      showToast('Ingresa un aporte mayor que cero.');
      return false;
    }
    const goalRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'goals', goal.id);
    try {
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(goalRef);
        if (!snapshot.exists()) throw new Error('La meta ya no existe.');
        const data = snapshot.data();
        const remaining = Math.round((Number(data.target) - Number(data.current || 0)) * 100) / 100;
        if (value > remaining) throw new Error('El aporte supera lo que falta para esta meta.');
        const nextAmount = Math.round((Number(data.current || 0) + value) * 100) / 100;
        transaction.set(goalRef, { current: nextAmount, updatedAt: serverTimestamp() }, { merge: true });
      });
      showToast(`Aporte de ${formatAmount(value, goal.currency)} registrado.`);
      return true;
    } catch (error) {
      console.error('No se pudo registrar el aporte.', error);
      showToast('No se pudo registrar el aporte.');
      return false;
    }
  };

  const submitBetaFeedback = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const message = String(form.get('message') || '').trim();
    if (message.length < 5) {
      showToast('Cuéntanos un poco más para poder ayudarte.');
      return;
    }
    try {
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'feedback'), {
        ownerUid: user.uid,
        name: getPublicName(user, userProfile),
        category: String(form.get('category') || 'idea').slice(0, 20),
        message: message.slice(0, 800),
        status: 'new',
        createdAt: serverTimestamp(),
      });
      formElement.reset();
      showToast('Gracias. Recibimos tu comentario de beta.');
    } catch (error) {
      console.error('No se pudo enviar el feedback.', error);
      showToast('No se pudo enviar el comentario.');
    }
  };

  // --- SMART AD ENGINE (CEO) ---
  const launchAd = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const validation = validateCampaign({
      company: form.get('adCompany'),
      title: form.get('adTitle'),
      location: form.get('adLocation'),
      cta: form.get('adCta'),
      url: form.get('adUrl'),
      startDate: form.get('adStartDate'),
      endDate: form.get('adEndDate'),
    });
    if (!validation.valid) {
      showToast(validation.error);
      return;
    }
    try {
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'ads'), {
        ...validation.campaign,
        active: true,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast('Campaña patrocinada publicada.');
      formElement.reset();
    } catch (error) {
      console.error('No se pudo publicar el anuncio.', error);
      showToast('No se pudo publicar la campaña. Revisa tu rol administrador.');
    }
  };

  const pauseAd = async (adId) => {
    try {
      await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'ads', adId), {
        active: false,
        pausedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      showToast('Campaña pausada.');
    } catch (error) {
      console.error('No se pudo pausar el anuncio.', error);
      showToast('No se pudo pausar la campaña.');
    }
  };

  // --- ESTILOS DE INTERFAZ ---
  const dynamicTheme = theme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100';
  const cardClasses = {
    dark: 'bg-slate-900/60 border-slate-800 backdrop-blur-xl',
    light: 'bg-white border-slate-200 shadow-sm'
  };
  const textMuted = theme === 'light' ? 'text-slate-500' : 'text-slate-400';
  const inputBg = theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-900' : 'bg-slate-950/50 border-slate-700 text-white';

  const getTransportIcon = (type) => {
    if (type === 'Vuelo') return <Plane size={24} className="mb-2"/>;
    if (type === 'Camioneta' || type === 'Auto Propio') return <Truck size={24} className="mb-2"/>;
    return <BriefcaseBusiness size={24} className="mb-2"/>; 
  };

  const shouldShowAd = Boolean(currentAd);

  if (!loaded.roster || !loaded.profile || !loaded.exceptions) return <main className="min-h-screen bg-slate-950 text-white grid place-items-center p-6"><div className="text-center space-y-4"><p role="status">{dataError || 'Cargando tu roster guardado…'}</p>{dataError && <button className="rounded-xl bg-emerald-500 px-4 py-3" onClick={() => window.location.reload()}>Volver a intentar</button>}</div></main>;

  return (
    <div className={`min-h-screen font-sans pb-24 transition-colors duration-500 ${dynamicTheme}`}>
      {showOnboarding && user && (
        <OnboardingModal
          theme={theme}
          rosterConfig={rosterConfig}
          userProfile={userProfile}
          onSaveRoster={saveRoster}
          onSaveProfile={saveProfile}
          onComplete={completeOnboarding}
          onSkip={skipOnboarding}
        />
      )}
      {showExistingAccountConfirm && (
        <div className="fixed inset-0 z-[130] bg-slate-950/80 backdrop-blur-sm p-4 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="existing-account-title">
          <div className={`w-full max-w-sm rounded-3xl border p-6 shadow-2xl ${cardClasses[theme]}`}>
            <div className="h-12 w-12 rounded-2xl bg-blue-500/15 text-blue-500 flex items-center justify-center mb-4"><LogIn size={24}/></div>
            <h2 id="existing-account-title" className="text-xl font-black">Ingresar a una cuenta existente</h2>
            <p className={`text-sm mt-3 leading-relaxed ${textMuted}`}>Verás los datos guardados en esa cuenta de Google. La información creada en esta sesión invitada no se combinará automáticamente.</p>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button type="button" onClick={() => setShowExistingAccountConfirm(false)} className={`rounded-xl border py-3 text-sm font-bold ${inputBg}`}>Cancelar</button>
              <button type="button" onClick={signIntoExistingGoogleAccount} className="rounded-xl bg-blue-500 py-3 text-sm font-bold text-white">Continuar</button>
            </div>
          </div>
        </div>
      )}
      
      {/* NOTIFICACIONES TOAST */}
      {toast && (
        <div role="status" className="fixed top-4 left-1/2 transform -translate-x-1/2 w-max max-w-[calc(100%-2rem)] bg-slate-800 border border-slate-600 text-white px-5 py-2.5 rounded-2xl font-semibold shadow-xl z-[150] text-sm flex items-center">
          <CheckCircle2 size={16} className="mr-2"/> {toast}
        </div>
      )}

      {isOffline && (
        <div className="bg-amber-500 text-slate-900 text-[10px] font-bold px-4 py-1.5 flex justify-center items-center uppercase tracking-widest z-50 relative">
          <CloudOff size={12} className="mr-2" /> Modo Sin Conexión
        </div>
      )}

      <header className={`sticky top-0 z-40 px-4 py-4 border-b backdrop-blur-md ${theme === 'light' ? 'bg-white/80 border-slate-200' : 'bg-slate-950/80 border-slate-800'}`}>
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2 select-none">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 relative">
              <span className="font-bold text-white">R</span>
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">RosterMax</h1>
          </div>
          <button onClick={() => setActiveTab('settings')} className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${theme === 'light' ? 'bg-white border-slate-300' : 'bg-slate-800 border-slate-700'} ${isAdmin ? 'ring-2 ring-amber-500 border-amber-500' : ''}`}>
            {isAdmin ? <ShieldAlert size={16} className="text-amber-500" /> : <User size={16} className={textMuted} />}
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
        {dataError && <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm"><p>{dataError}</p><button onClick={() => window.location.reload()} className="mt-2 underline font-bold">Volver a cargar</button></div>}
        {syncState === 'error' && <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-500">Tu roster está disponible aquí, pero no pudimos actualizar lo que ve tu equipo. Comprueba la conexión y recarga la app. No envíes nuevas invitaciones hasta sincronizar.</p>}
        {pendingWrites > 0 && <p role="status" className={`text-xs ${textMuted}`}>{isOffline ? 'Cambios pendientes de sincronización' : 'Sincronizando cambios…'}</p>}
        {!rosterSaved && <div className={`rounded-2xl border p-5 ${cardClasses[theme]}`}><h2 className="font-bold">Configura tu primer roster</h2><p className={`mt-2 text-sm ${textMuted}`}>Indica cuántos días trabajas, cuántos descansas y una subida conocida para calcular tus fechas.</p><button onClick={() => setShowOnboarding(true)} className="mt-3 bg-emerald-500 text-white rounded-xl px-4 py-3 font-bold">Configurar mi roster</button></div>}
        
        {installPrompt && (
          <div className={`border rounded-2xl p-4 flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-4 ${theme==='light'?'bg-emerald-50 border-emerald-200':'bg-emerald-500/20 border-emerald-500/30'}`}>
            <div><p className="font-bold text-emerald-500 text-sm flex items-center"><Download size={14} className="mr-1.5"/> Instalar RosterMax</p><p className={`text-xs mt-0.5 ${textMuted}`}>Añade la app a tu pantalla de inicio.</p></div>
            <button onClick={handleInstallClick} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-4 rounded-xl text-sm transition-colors shadow-lg shadow-emerald-500/30">Instalar</button>
          </div>
        )}

        {/* TAB 1: ROSTER */}
        {activeTab === 'roster' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {rosterSaved && <RosterCalendar config={effectiveRoster} today={today} theme={theme} tasks={tasks}
              onPlanDate={(date) => { setPlannedDate(date); setActiveTab('planner'); window.scrollTo({ top: 0 }); }}
              onManageExceptions={() => { setEditingException(null); setExceptionType('vacation'); setShowExceptionForm(true); exceptionSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}/>
            }
            <div className={`relative overflow-hidden rounded-3xl border p-6 ${cardClasses[theme]}`}>
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-emerald-500/20 blur-3xl"></div>
              <div className="flex items-center justify-between mb-4 relative z-10">
                <h2 className={`text-xs font-bold uppercase tracking-widest ${textMuted}`}>Estado Hoy</h2>
                <span className="text-xs font-bold rounded-full px-3 py-1 bg-blue-500/10 text-blue-500">{currentStatus.error ? 'Configura tu roster' : getCalendarDayLabel(currentStatus)}</span>
              </div>
              <div className="relative z-10">
                <div className="flex items-baseline space-x-2"><span className="text-6xl font-black">{currentStatus?.actualDay || 0}</span><span className={`text-xl font-medium ${textMuted}`}>/ {currentStatus?.totalPhaseDays || 0}</span></div>
                <p className={`mt-1 text-sm ${textMuted}`}>{currentStatus.error ? 'Todavía no hay un diagrama guardado.' : currentStatus.isOverride ? 'Día del cambio temporal.' : `Días ${currentStatus.isWorking ? 'trabajados' : 'de franco'} del ciclo.`}</p>
                {currentStatus?.isOverride && <p className="mt-2 inline-flex items-center rounded-full bg-indigo-500/15 px-3 py-1 text-[10px] font-bold text-indigo-400"><CalendarRange size={12} className="mr-1.5"/>{currentStatus.exceptionLabel || EXCEPTION_LABELS[currentStatus.exceptionType]}</p>}
              </div>
              <div className={`mt-6 h-2.5 w-full rounded-full overflow-hidden ${theme === 'light' ? 'bg-slate-200' : 'bg-slate-800/50'}`}>
                <div className={`h-full rounded-full transition-all duration-1000 ${currentStatus?.isWorking ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${((currentStatus?.actualDay || 0) / (currentStatus?.totalPhaseDays || 1)) * 100}%` }}></div>
              </div>
            </div>

            {!nextTransition?.error && (
              <div className={`rounded-2xl border p-4 flex items-center justify-between ${cardClasses[theme]}`}>
                <div className="flex items-center min-w-0">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center mr-3 flex-shrink-0 ${nextTransition.nextStatus === 'rest' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'}`}>
                    <Clock3 size={20}/>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold">Próxima {nextTransition.nextStatus === 'rest' ? 'bajada' : 'subida'}</p>
                    <p className={`text-xs ${textMuted}`}>{formatShortDate(nextTransition.date)} · en {nextTransition.daysUntil} {nextTransition.daysUntil === 1 ? 'día' : 'días'}</p>
                  </div>
                </div>
                {reminderSettings.enabled ? <BellRing size={18} className="text-emerald-500" aria-label="Alertas activadas"/> : <Bell size={18} className={textMuted} aria-label="Alertas desactivadas"/>}
              </div>
            )}

            <div ref={exceptionSectionRef} className={`scroll-mt-24 rounded-2xl border p-5 ${cardClasses[theme]}`}>
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="font-bold flex items-center"><CalendarRange size={18} className="mr-2 text-indigo-500"/> Cambios temporales</h3><p className={`text-[10px] mt-1 ${textMuted}`}>Vacaciones, licencias o rosters especiales pisan sólo esas fechas. Después vuelves automáticamente a tu diagrama habitual.</p></div>
                <button type="button" onClick={() => { setEditingException(null); setExceptionType('vacation'); setShowExceptionForm((value) => !value); }} className="flex-shrink-0 rounded-xl bg-indigo-500 px-3 py-3 text-xs font-bold text-white">{showExceptionForm ? 'Cerrar' : 'Agregar'}</button>
              </div>

              {showExceptionForm && (
                <form key={editingException?.id || 'new'} onSubmit={createScheduleException} className={`mt-4 space-y-3 rounded-xl border p-4 ${theme === 'light' ? 'bg-indigo-50/60 border-indigo-100' : 'bg-indigo-500/5 border-indigo-500/20'}`}>
                  <h4 className="font-bold">{editingException ? 'Editar cambio temporal' : 'Nuevo cambio temporal'}</h4>
                  <label className="block text-xs font-semibold">Tipo de cambio<select name="type" value={exceptionType} onChange={(event) => setExceptionType(event.target.value)} className={`mt-1 w-full rounded-xl px-3 py-3 text-sm border ${inputBg}`}>
                    {Object.keys(SCHEDULE_EXCEPTION_TYPES).map((type) => <option key={type} value={type}>{EXCEPTION_LABELS[type]}</option>)}
                  </select></label>
                  <label className="block text-xs font-semibold">Nota privada (opcional)<input name="label" type="text" maxLength="60" defaultValue={editingException?.label || ''} className={`mt-1 w-full rounded-xl px-3 py-3 text-sm border ${inputBg}`}/></label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs font-semibold min-w-0">Desde<input name="startDate" type="date" defaultValue={editingException?.startDate || today} className={`mt-1 w-full min-w-0 rounded-xl px-2 py-3 text-sm border ${inputBg}`} required/></label>
                    <label className="text-xs font-semibold min-w-0">Hasta<input name="endDate" type="date" defaultValue={editingException?.endDate || addDaysToDate(today, 6)} className={`mt-1 w-full min-w-0 rounded-xl px-2 py-3 text-sm border ${inputBg}`} required/></label>
                  </div>
                  {exceptionType === 'special_roster' && <div className="space-y-3"><div className="grid grid-cols-2 gap-2">
                    <label className="text-xs font-semibold">Trabajo (días)<input name="workDays" type="number" min="1" max="365" defaultValue={editingException?.workDays || 7} className={`mt-1 w-full rounded-xl px-3 py-3 border ${inputBg}`} required/></label>
                    <label className="text-xs font-semibold">Franco (días)<input name="restDays" type="number" min="1" max="365" defaultValue={editingException?.restDays || 7} className={`mt-1 w-full rounded-xl px-3 py-3 border ${inputBg}`} required/></label>
                  </div><label className="block text-xs font-semibold">Primera subida del roster especial<input name="cycleStartDate" type="date" defaultValue={editingException?.cycleStartDate || today} className={`mt-1 w-full rounded-xl px-3 py-3 text-sm border ${inputBg}`} required/></label></div>}
                  <p className={`text-xs ${textMuted}`}>El día siguiente a “Hasta” se retoma el ciclo original. Tus compañeros verán tu disponibilidad sin el motivo privado.</p>
                  <button disabled={exceptionBusy} className="w-full rounded-xl bg-indigo-500 py-3 text-sm font-bold text-white disabled:opacity-50">{exceptionBusy ? 'Guardando…' : editingException ? 'Guardar cambios' : 'Aplicar cambio temporal'}</button>
                </form>
              )}

              {scheduleExceptions.length === 0 ? <p className={`mt-4 text-xs text-center py-2 ${textMuted}`}>Tu roster sigue el diagrama habitual, sin cambios cargados.</p> : (
                <div className="mt-4 space-y-2 max-h-64 overflow-y-auto pr-1">
                  {scheduleExceptions.map((exception) => (
                    <div key={exception.id} className={`rounded-xl border p-3 flex items-center gap-3 ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/40 border-slate-700'}`}>
                      <div className="h-9 w-9 flex-shrink-0 rounded-lg bg-indigo-500/15 text-indigo-500 flex items-center justify-center"><ScheduleExceptionIcon type={exception.type}/></div>
                      <div className="min-w-0 flex-1"><p className="text-xs font-bold truncate">{exception.label || EXCEPTION_LABELS[exception.type]}</p><p className={`text-[10px] ${textMuted}`}>{formatShortDate(exception.startDate)} — {formatShortDate(exception.endDate)}{exception.type === 'special_roster' ? ` · ${exception.workDays}x${exception.restDays}` : ''}</p></div>
                      <button type="button" onClick={() => { setEditingException(exception); setExceptionType(exception.type); setShowExceptionForm(true); exceptionSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="min-h-11 min-w-11 grid place-items-center text-blue-500" aria-label={`Editar ${EXCEPTION_LABELS[exception.type]}`}><Pencil size={16}/></button>
                      <button type="button" onClick={() => { if (window.confirm('¿Eliminar este cambio temporal y volver al diagrama habitual en esas fechas?')) savePrivate(deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'schedule_exceptions', exception.id)), 'Cambio temporal eliminado.'); }} className="min-h-11 min-w-11 grid place-items-center text-slate-400 hover:text-red-400" aria-label={`Eliminar ${EXCEPTION_LABELS[exception.type]}`}><Trash2 size={16}/></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* MOTOR DE ANUNCIOS SMART */}
            {shouldShowAd && (
              <div ref={adContainerRef} className="bg-gradient-to-r from-blue-900 to-indigo-900 border border-blue-500/30 rounded-2xl p-4 flex items-center justify-between shadow-lg shadow-blue-900/20 overflow-hidden relative animate-in fade-in slide-in-from-top-4">
                 <div className="relative z-10 min-w-0">
                   <p className="text-[10px] uppercase font-black text-amber-400 mb-1 flex items-center"><Megaphone size={10} className="mr-1"/> Contenido patrocinado</p>
                   <p className="font-bold text-white text-sm">{currentAd.title}</p>
                   <p className="text-xs text-blue-200 mt-0.5">{currentAd.company}</p>
                 </div>
                 {currentAd.url && (
                   <a href={currentAd.url} target="_blank" rel="noopener noreferrer sponsored" onClick={() => privacySettings.analyticsEnabled && trackCampaignMetric(user, currentAd.id, 'click').catch((error) => console.error('No se pudo registrar el clic.', error))} className="ml-3 flex-shrink-0 bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded-xl px-3 py-2 text-xs font-bold relative z-10 flex items-center">{currentAd.cta || 'Ver oferta'}<ExternalLink size={12} className="ml-1.5"/></a>
                 )}
              </div>
            )}

            <div className={`grid grid-cols-2 gap-4`}>
               <WeatherPanel theme={theme} location={userProfile.weatherLocation} onChangeLocation={() => setActiveTab('settings')}/>
               <div className={`rounded-2xl border p-4 ${cardClasses[theme]} flex flex-col justify-center items-center text-center text-indigo-400`}>
                 {getTransportIcon(userProfile.transport)}
                 <span className={`text-sm font-bold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{nextTransition.error ? 'Sin fecha calculada' : `En ${nextTransition.daysUntil} días`}</span>
                 <span className={`text-[10px] uppercase font-bold mt-1`}>{userProfile.transport || 'Transporte'}</span><span className={`mt-1 text-[9px] ${textMuted}`}>Según tu roster. Confirma el traslado con tu empresa.</span>
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
                    <button onClick={() => savePrivate(deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'logs', log.id)), 'Nota eliminada.')} aria-label="Eliminar nota" className="text-slate-500 hover:text-red-400 min-h-11 min-w-11 grid place-items-center ml-2"><X size={16}/></button>
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
               <HeaderTitle icon={Users} title="Proyector de Equipo" colorClass="text-blue-500" theme={theme} />
            </div>

            {pendingInviteCode && (
              <div className={`rounded-2xl border p-5 ${theme === 'light' ? 'bg-blue-50 border-blue-200' : 'bg-blue-500/10 border-blue-500/30'}`}>
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-500 text-white flex items-center justify-center flex-shrink-0"><Link2 size={20}/></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black uppercase tracking-wider text-blue-500">Invitación recibida</p>
                    {pendingInvite.loading && <p className={`text-sm mt-1 ${textMuted}`}>Comprobando el enlace…</p>}
                    {pendingInvite.error && <p className="text-sm mt-1 text-red-400">{pendingInvite.error}</p>}
                    {pendingInvite.data && (
                      <><p className="font-black text-lg mt-1 truncate">{pendingInvite.data.name}</p><p className={`text-xs ${textMuted}`}>Comparte un roster {pendingInvite.data.workDays}x{pendingInvite.data.restDays}. Al aceptar, ambos podrán ver el roster del otro y encontrar francos coincidentes.</p></>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <button type="button" onClick={clearPendingInvite} className={`py-2.5 rounded-xl border text-xs font-bold ${inputBg}`}>Descartar</button>
                  <button type="button" onClick={acceptPendingInvite} disabled={!pendingInvite.data || pendingInvite.loading || syncState !== 'ready' || !sharedReady} className="py-2.5 rounded-xl bg-blue-500 text-white text-xs font-bold disabled:opacity-50">Aceptar y compartir</button>
                </div>
              </div>
            )}
            
            <DateSimulator theme={theme} today={today} date={targetDate} onDateChange={setTargetDate} ownStatus={targetStatus} friends={displayFriends}/>

            <div className={`rounded-2xl border p-5 ${cardClasses[theme]}`}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold flex items-center"><Zap size={17} className="mr-2 text-amber-500 fill-amber-500"/> Próximos francos juntos</h3>
                <span className={`text-[10px] font-bold ${textMuted}`}>120 días</span>
              </div>
              <p className={`text-[11px] mb-4 ${textMuted}`}>Calculados automáticamente con los diagramas disponibles.</p>
              {groupedCoincidences.length > 0 ? (
                <div className="space-y-2 max-h-[32rem] overflow-y-auto">
                  {visibleCoincidences.map((window) => (
                    <div key={`${window.startDate}-${window.endDate}`} className={`rounded-xl border p-3 ${theme === 'light' ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                      <div className="flex items-center justify-between gap-3"><p className="font-bold text-sm">{formatShortDate(window.startDate)}{window.endDate !== window.startDate ? ` — ${formatShortDate(window.endDate)}` : ''}</p><span className="text-xs font-black text-emerald-500 whitespace-nowrap">{window.days} {window.days === 1 ? 'día' : 'días'}</span></div>
                      <div className="flex flex-wrap gap-1.5 mt-2 max-h-24 overflow-y-auto">{window.friends.map((friend) => <span key={friend.id} className={`text-[10px] font-bold px-2 py-1 rounded-full ${theme === 'light' ? 'bg-white text-emerald-700' : 'bg-slate-950/40 text-emerald-300'}`}>{friend.name}</span>)}</div>
                    </div>
                  ))}
                  {groupedCoincidences.length > 3 && <button type="button" onClick={() => setShowAllCoincidences((value) => !value)} className={`w-full py-2 text-xs font-bold flex items-center justify-center ${textMuted}`}>{showAllCoincidences ? <ChevronUp size={14} className="mr-1"/> : <ChevronDown size={14} className="mr-1"/>}{showAllCoincidences ? 'Ver menos fechas' : `Ver ${groupedCoincidences.length - 3} fechas más`}</button>}
                </div>
              ) : (
                <div className={`rounded-xl p-4 text-center ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-800/50'}`}>
                  <p className="text-sm font-bold">Todavía no hay coincidencias calculables</p>
                  <p className={`text-[10px] mt-1 ${textMuted}`}>{displayFriends.length ? 'Revisa que los diagramas estén disponibles.' : 'Invita a un compañero para comparar automáticamente.'}</p>
                </div>
              )}
            </div>

            <button onClick={shareMyCode} disabled={syncState !== 'ready'} className={`w-full p-4 rounded-2xl border flex items-center justify-center space-x-2 transition-all active:scale-95 shadow-sm disabled:opacity-50 ${theme==='light'?'bg-blue-50 border-blue-200 text-blue-600':'bg-blue-500/10 border-blue-500/30 text-blue-400'}`}>
               <Smartphone size={18} />
               <span className="font-bold text-sm">{syncState === 'loading' ? 'Preparando código seguro…' : 'Enviar mi código a un contacto'}</span>
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
                  <form onSubmit={handleSyncAdd} className="space-y-4 animate-in fade-in">
                    <p className={`text-[11px] ${textMuted}`}>Al vincular el código, ambos compañeros compartirán su roster mínimo.</p>
                    <div className="relative"><input name="syncCode" type="text" placeholder="Ej. RM-AB12CD34" maxLength={11} className={`w-full rounded-xl px-4 py-3 text-sm outline-none border tracking-widest font-mono uppercase ${inputBg}`} required /><button type="submit" className="absolute right-2 top-2 bottom-2 bg-blue-500 hover:bg-blue-600 text-white px-4 rounded-lg font-bold transition-colors text-xs">Vincular</button></div>
                  </form>
                )}
              </div>
            </div>
            
            {displayFriends.length > 0 && (
              <div className={`rounded-2xl border p-4 ${cardClasses[theme]}`}>
                <div className="flex items-center justify-between gap-3 mb-3"><div><h3 className="font-bold">Mi equipo</h3><p className={`text-[10px] ${textMuted}`}>{displayFriends.length} {displayFriends.length === 1 ? 'compañero' : 'compañeros'} vinculados</p></div><Filter size={17} className="text-blue-500"/></div>
                {displayFriends.length > 6 && <div className="relative mb-3"><Search size={15} className={`absolute left-3 top-2.5 ${textMuted}`}/><input value={crewSearch} onChange={(event) => setCrewSearch(event.target.value)} placeholder="Buscar compañero…" className={`w-full rounded-xl pl-9 pr-3 py-2 text-sm outline-none border ${inputBg}`}/></div>}
                <div className="space-y-2 max-h-[26rem] overflow-y-auto pr-1">
                {visibleFriends.map(friend => (
                  <div key={friend.id} className={`flex justify-between items-center p-3 rounded-xl border ${cardClasses[theme]}`}>
                    <div><p className="font-bold text-sm flex items-center">{friend.name}{friend.isSynced && <Share2 size={12} className={`ml-1.5 ${friend.syncAvailable === false ? 'text-amber-400' : 'text-blue-400'}`}/>}</p><p className={`text-xs ${friend.syncAvailable === false ? 'text-amber-500' : textMuted}`}>{friend.syncAvailable === false ? 'Esperando datos compartidos' : `Esquema: ${friend.workDays}x${friend.restDays}`}</p></div>
                    <button onClick={() => { if (window.confirm('¿Quitar este compañero de tu lista? Esto no elimina tu código ni te quita de su equipo.')) savePrivate(deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'friends', friend.id)), 'Compañero quitado de tu lista.'); }} className="text-slate-500 hover:text-red-400 p-2" aria-label={`Eliminar a ${friend.name}`}><Trash2 size={16}/></button>
                  </div>
                ))}
                {filteredFriends.length === 0 && <p className={`text-xs text-center py-4 ${textMuted}`}>No encontramos ese compañero.</p>}
                </div>
                {filteredFriends.length > 6 && <button type="button" onClick={() => setShowAllFriends((value) => !value)} className="w-full mt-3 rounded-xl border border-blue-500/20 py-2.5 text-xs font-bold text-blue-500 flex items-center justify-center">{showAllFriends ? <ChevronUp size={14} className="mr-1"/> : <ChevronDown size={14} className="mr-1"/>}{showAllFriends ? 'Mostrar solo 6' : `Mostrar los ${filteredFriends.length}`}</button>}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PLANNER */}
        {activeTab === 'planner' && (loaded.tasks ? <PlannerPanel
          theme={theme} today={today} config={rosterSaved ? effectiveRoster : {}} tasks={tasks}
          initialDate={plannedDate} onSaveTask={saveRestTask}
          onToggleTask={(task) => savePrivate(setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'tasks', task.id), { completed: !task.completed }, { merge: true }), task.completed ? 'Plan pendiente.' : 'Plan completado.')}
          onDeleteTask={(id) => savePrivate(deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'tasks', id)), 'Plan eliminado.')}
        /> : <p role="status">Cargando tus planes…</p>)}

        {/* TAB 4: FINANZAS */}
        {activeTab === 'wealth' && (
          loaded.finance && loaded.goals && loaded.expenses ? <FinancePanel
            theme={theme} today={today} config={rosterSaved ? effectiveRoster : {}}
            settings={financeSettings} expenses={expenses} goals={goals}
            onSaveSettings={saveFinancePlan} onAddExpense={addExpense}
            onDeleteExpense={(id) => savePrivate(deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'expenses', id)), 'Gasto eliminado.')}
            onCreateGoal={createFinancialGoal} onAddFunds={addFunds}
            onDeleteGoal={(id) => savePrivate(deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'goals', id)), 'Meta eliminada.')}
          /> : <p role="status">Cargando tu presupuesto…</p>
        )}

        {/* TAB 5: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            
            <div className="flex justify-between items-center mb-6">
              <HeaderTitle icon={Settings} title={`Ajustes · ${APP_VERSION}`} colorClass="text-slate-400" theme={theme} />
              <button onClick={shareApp} className="flex items-center text-xs font-bold bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg shadow-lg shadow-indigo-500/30 transition-all active:scale-95"><Send size={14} className="mr-1.5"/> Invitar Colega</button>
            </div>
            
            {/* ESTADO DE CUENTA INTELIGENTE */}
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
                 {user.email && (
                   <div className={`mt-3 pt-3 border-t ${theme === 'light' ? 'border-emerald-200' : 'border-emerald-500/20'}`}>
                     <div className="flex items-center justify-between gap-3">
                       <p className={`text-xs font-bold flex items-center min-w-0 truncate ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}><User size={12} className="mr-1 flex-shrink-0"/> {user.email}</p>
                       <button type="button" onClick={handleSignOut} className="text-[10px] font-bold text-red-400 flex items-center whitespace-nowrap"><LogOut size={12} className="mr-1"/> Cerrar sesión</button>
                     </div>
                   </div>
                 )}
              </div>
            ) : (
              <div className={`rounded-2xl border p-5 ${cardClasses[theme]} border-amber-500/30 bg-amber-500/5`}>
                <h3 className="font-bold flex items-center mb-2"><AlertCircle size={18} className="mr-2 text-amber-500"/> Modo Invitado</h3>
                <p className={`text-[10px] mb-4 ${textMuted}`}>Guarda esta sesión por primera vez o ingresa a una cuenta que ya utilizaste en otro dispositivo.</p>
                <button onClick={linkNewGoogleAccount} disabled={authBusy} className="w-full flex items-center justify-center bg-white text-slate-900 border border-slate-200 font-bold py-2.5 rounded-xl transition-all shadow-sm active:scale-95 text-sm disabled:opacity-60">
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  {authBusy ? 'Conectando…' : 'Guardar con Google'}
                </button>
                <button type="button" onClick={() => setShowExistingAccountConfirm(true)} disabled={authBusy} className={`w-full mt-2 flex items-center justify-center border font-bold py-2.5 rounded-xl transition-all active:scale-95 text-sm disabled:opacity-60 ${theme === 'light' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-blue-500/10 border-blue-500/30 text-blue-300'}`}><LogIn size={16} className="mr-2"/> Ya tengo cuenta</button>
                {authMsg && <p className="text-[10px] mt-2 font-bold text-center text-amber-500">{authMsg}</p>}
              </div>
            )}

            <div className={`rounded-2xl border p-4 flex items-center justify-between ${cardClasses[theme]}`}>
               <div>
                 <p className="text-xs font-bold uppercase tracking-wider text-blue-500">Tu Código RosterMax</p>
                 <p className="font-mono text-lg tracking-widest mt-1">{syncState === 'loading' ? 'Preparando…' : syncCode || 'No disponible'}</p>
                 {syncState === 'error' && <p className="text-[9px] text-red-400 mt-1">Revisa la conexión o los permisos.</p>}
               </div>
               <button onClick={shareMyCode} disabled={syncState !== 'ready'} className={`p-2 rounded-lg border active:scale-90 transition-transform disabled:opacity-40 ${theme==='light'?'bg-slate-50 border-slate-200':'bg-slate-800 border-slate-700'}`}><Share2 size={18} className={textMuted}/></button>
            </div>

            <div className={`rounded-2xl border p-5 ${cardClasses[theme]}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${reminderSettings.enabled ? 'bg-emerald-500/15 text-emerald-500' : theme === 'light' ? 'bg-slate-100 text-slate-500' : 'bg-slate-800 text-slate-400'}`}>
                    {reminderSettings.enabled ? <BellRing size={19}/> : <Bell size={19}/>}
                  </div>
                  <div><h3 className="font-bold text-sm">Alertas de subida y bajada</h3><p className={`text-[10px] mt-1 leading-relaxed ${textMuted}`}>Te avisamos al abrir RosterMax cuando se acerca un cambio. Las alertas con la app cerrada llegarán en una fase Push posterior.</p></div>
                </div>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-3 mt-4">
                <select value={reminderSettings.leadDays} onChange={(event) => updateReminderLeadDays(event.target.value)} className={`rounded-xl px-3 py-2 text-xs border outline-none ${inputBg}`}>
                  <option value="1">Avisar 1 día antes</option>
                  <option value="2">Avisar 2 días antes</option>
                  <option value="3">Avisar 3 días antes</option>
                  <option value="7">Avisar 7 días antes</option>
                </select>
                {reminderSettings.enabled ? (
                  <button type="button" onClick={disableTurnReminders} className="rounded-xl px-3 py-2 text-xs font-bold border border-red-500/30 text-red-400">Desactivar</button>
                ) : (
                  <button type="button" onClick={requestTurnReminders} className="rounded-xl px-3 py-2 text-xs font-bold bg-emerald-500 text-white">Activar</button>
                )}
              </div>
            </div>

            <div className={`rounded-2xl border p-5 ${cardClasses[theme]}`}>
              <div className="flex items-start justify-between gap-4"><div className="flex gap-3"><div className={`h-10 w-10 rounded-xl flex-shrink-0 flex items-center justify-center ${privacySettings.analyticsEnabled ? 'bg-blue-500/15 text-blue-500' : theme === 'light' ? 'bg-slate-100 text-slate-500' : 'bg-slate-800 text-slate-400'}`}><Activity size={19}/></div><div><h3 className="font-bold text-sm">Ayudar a mejorar RosterMax</h3><p className={`text-[10px] mt-1 leading-relaxed ${textMuted}`}>Medición opcional vinculada a un identificador de cuenta. El panel muestra resultados agregados, sin nombre, correo, empresa, ubicación, tareas, finanzas ni motivos de licencia.</p></div></div><button type="button" role="switch" aria-checked={privacySettings.analyticsEnabled} onClick={toggleAnalytics} className={`w-12 h-7 rounded-full p-1 flex-shrink-0 transition-colors ${privacySettings.analyticsEnabled ? 'bg-blue-500 justify-end' : 'bg-slate-600 justify-start'}`}><span className="block h-5 w-5 rounded-full bg-white shadow"/></button></div>
              <p className={`mt-3 text-[9px] ${textMuted}`}>{privacySettings.analyticsEnabled ? 'Activado. Al apagarlo borramos tu registro de actividad y dejamos de medir. Los conteos publicitarios anteriores se conservan asociados a tu identificador.' : 'Desactivado por defecto. La app funciona igual sin compartir métricas.'}</p>
            </div>

            <button type="button" onClick={reopenOnboarding} className={`w-full rounded-2xl border p-4 flex items-center justify-between text-left ${cardClasses[theme]}`}>
              <div><p className="font-bold text-sm">Volver a ver la guía inicial</p><p className={`text-[10px] mt-0.5 ${textMuted}`}>Reconfigura tu diagrama y nombre paso a paso.</p></div>
              <ChevronRight size={18} className={textMuted}/>
            </button>

            <div className={`rounded-2xl border p-5 ${cardClasses[theme]}`}>
              <h3 className="font-bold flex items-center"><MessageSquare size={18} className="mr-2 text-blue-500"/> Feedback de la beta</h3>
              <p className={`text-[10px] mt-1 mb-4 ${textMuted}`}>Cuéntanos qué falló o qué función necesitas. No incluyas datos sensibles.</p>
              <form onSubmit={submitBetaFeedback} className="space-y-3">
                <select name="category" className={`w-full rounded-xl px-3 py-2 text-sm border outline-none ${inputBg}`} defaultValue="problem">
                  <option value="problem">Encontré un problema</option>
                  <option value="idea">Tengo una idea</option>
                  <option value="question">Tengo una duda</option>
                </select>
                <textarea name="message" minLength="5" maxLength="800" rows="3" placeholder="Describe brevemente lo que pasó…" className={`w-full rounded-xl px-3 py-2 text-sm border outline-none resize-none ${inputBg}`} required/>
                <button className="w-full rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 py-2.5 text-sm font-bold">Enviar comentario</button>
              </form>
            </div>

            <div className={`rounded-2xl border p-5 ${cardClasses[theme]}`}>
              <h3 className="font-bold flex items-center mb-4 text-indigo-400"><BriefcaseBusiness size={18} className="mr-2 text-indigo-500"/> Datos Laborales</h3>
              <form onSubmit={updateProfile} className="space-y-4">
                <div>
                  <label className={`block text-xs mb-1 ${textMuted} flex items-center`}><User size={12} className="mr-1"/> Nombre visible para compañeros</label>
                  <input name="displayName" type="text" placeholder="Ej. Maxi" defaultValue={userProfile.displayName} maxLength={40} className={`w-full rounded-lg px-3 py-2 outline-none border text-sm ${inputBg}`} />
                  <p className={`text-[9px] mt-1 ${textMuted}`}>No compartimos tu correo, empresa ni provincias mediante el código.</p>
                </div>
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
                <div className="grid grid-cols-2 gap-4 border-t pt-4 mt-2 border-inherit opacity-80">
                  <div><label className={`block text-[10px] uppercase font-bold mb-1 ${textMuted}`}>Prov. de Origen</label><input name="homeProvince" type="text" placeholder="Ej. Mendoza" defaultValue={userProfile.homeProvince} className={`w-full rounded-lg px-3 py-2 outline-none border text-sm ${inputBg}`} /></div>
                  <div><label className={`block text-[10px] uppercase font-bold mb-1 ${textMuted}`}>Prov. de Destino</label><input name="siteProvince" type="text" placeholder="Ej. Neuquén" defaultValue={userProfile.siteProvince} className={`w-full rounded-lg px-3 py-2 outline-none border text-sm ${inputBg}`} /></div>
                </div>
                <div className="border-t pt-4 mt-2 border-inherit">
                  <label className={`block text-xs font-bold mb-1 ${textMuted} flex items-center`}><Thermometer size={12} className="mr-1"/> Ubicación para el clima</label>
                  <p className={`text-[10px] mb-2 ${textMuted}`}>Busca una ciudad o localidad cercana al yacimiento y confirma la provincia.</p>
                  <div className="flex gap-2">
                    <input value={weatherQuery} onChange={(event) => setWeatherQuery(event.target.value)} type="search" placeholder="Ej. Añelo" className={`flex-1 min-w-0 rounded-lg px-3 py-2 outline-none border text-sm ${inputBg}`} />
                    <button type="button" onClick={handleWeatherSearch} disabled={weatherSearching} className="rounded-lg bg-blue-500 px-3 text-white text-xs font-bold disabled:opacity-50">{weatherSearching ? 'Buscando…' : 'Buscar'}</button>
                  </div>
                  {weatherOptions.length > 0 && (
                    <div className={`mt-2 rounded-xl border overflow-hidden ${theme === 'light' ? 'border-slate-200' : 'border-slate-700'}`}>
                      {weatherOptions.map((option) => (
                        <button key={option.id} type="button" onClick={() => selectWeatherLocation(option)} className={`w-full text-left p-3 text-xs border-b last:border-b-0 ${theme === 'light' ? 'bg-white border-slate-200 hover:bg-slate-50' : 'bg-slate-900 border-slate-700 hover:bg-slate-800'}`}>
                          <span className="font-bold block">{option.name}</span>
                          <span className={textMuted}>{option.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className={`mt-3 rounded-lg p-3 flex items-start gap-2 ${theme === 'light' ? 'bg-blue-50 text-blue-700' : 'bg-blue-500/10 text-blue-300'}`}>
                    <MapPin size={14} className="mt-0.5 flex-shrink-0"/>
                    <div><p className="text-[10px] font-bold">Ubicación seleccionada</p><p className="text-[10px]">{userProfile.weatherLocation?.label || 'Sin configurar'}</p></div>
                  </div>
                </div>
                <button type="submit" className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2.5 rounded-xl transition-all text-sm mt-2 shadow-lg shadow-indigo-500/20 active:scale-95">Guardar Perfil</button>
              </form>
            </div>
            
            <div className={`rounded-2xl border p-5 ${cardClasses[theme]}`}>
              <h3 className="font-bold flex items-center mb-4"><Calendar size={18} className="mr-2 text-emerald-500"/> Configuración de Diagrama</h3>
              <form onSubmit={updateRoster} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={`block text-xs mb-1 ${textMuted}`}>Días Trabajo</label><input name="workDays" type="number" min="1" max="365" required defaultValue={rosterConfig.workDays} className={`w-full rounded-lg px-3 py-2 outline-none border ${inputBg}`} /></div>
                  <div><label className={`block text-xs mb-1 ${textMuted}`}>Días Descanso</label><input name="restDays" type="number" min="1" max="365" required defaultValue={rosterConfig.restDays} className={`w-full rounded-lg px-3 py-2 outline-none border ${inputBg}`} /></div>
                </div>
                <div><label className={`block text-xs mb-1 ${textMuted}`}>Inicio conocido de un ciclo de trabajo</label><input name="startDate" type="date" required defaultValue={rosterConfig.startDate} className={`w-full rounded-lg px-3 py-2 outline-none border ${inputBg}`} style={{ colorScheme: theme === 'light' ? 'light' : 'dark' }} /><p className={`text-[9px] mt-1 ${textMuted}`}>Puede ser una subida pasada o futura; calcularemos todo el calendario en ambos sentidos.</p></div>
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
            <div className="mb-6"><HeaderTitle icon={ShieldAlert} title="Centro de Mando" colorClass="text-amber-500" theme={theme} /></div>

            <div className={`rounded-2xl border p-5 ${cardClasses[theme]} border-l-4 border-l-emerald-500`}>
              <p className="font-bold text-emerald-500 flex items-center"><ShieldAlert size={18} className="mr-2"/> Propietario verificado</p>
              <p className={`text-xs mt-2 ${textMuted}`}>El acceso se valida mediante un registro privado en Firestore. Ningún usuario puede darse permisos desde la aplicación.</p>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className={`rounded-xl p-3 ${theme === 'light' ? 'bg-amber-50' : 'bg-amber-500/10'}`}><p className={`text-[10px] ${textMuted}`}>Campañas activas</p><p className="text-2xl font-black text-amber-500">{activeAdCount}</p></div>
                <div className={`rounded-xl p-3 ${theme === 'light' ? 'bg-blue-50' : 'bg-blue-500/10'}`}><p className={`text-[10px] ${textMuted}`}>Feedback recibido</p><p className="text-2xl font-black text-blue-500">{feedbackItems.length}</p></div>
              </div>
            </div>

            <CeoAudiencePanel theme={theme} census={census} censusState={censusState} activityState={activityState} audience={audienceSummary} refreshing={censusRefreshing} refreshError={censusError} onRefresh={refreshAccountCensus} today={today}/>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
              <h3 className="font-bold flex items-center mb-1 text-amber-500"><Megaphone size={18} className="mr-2"/> Nueva campaña patrocinada</h3>
              <p className={`text-[10px] mb-4 ${textMuted}`}>Para la beta, tú cargas y pausas cada campaña. La segmentación se evalúa en el dispositivo y no entrega datos del trabajador al anunciante.</p>
              <form onSubmit={launchAd} className="space-y-3">
                <input name="adCompany" type="text" maxLength="80" placeholder="Empresa (Ej. Hilux Service)" className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required />
                <input name="adTitle" type="text" maxLength="120" placeholder="Oferta (Ej. 20% en mantenimiento)" className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required />
                <div className="grid grid-cols-2 gap-2">
                  <input name="adLocation" type="text" maxLength="80" placeholder="Zona o Todos" className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required />
                  <input name="adCta" type="text" maxLength="30" defaultValue="Ver oferta" aria-label="Texto del botón" className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required />
                </div>
                <input name="adUrl" type="url" placeholder="https://comercio.com/oferta" className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required />
                <div className="grid grid-cols-2 gap-2">
                  <label className={`text-[10px] font-bold ${textMuted}`}>Desde<input name="adStartDate" type="date" defaultValue={getTodayDate()} className={`mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required /></label>
                  <label className={`text-[10px] font-bold ${textMuted}`}>Hasta<input name="adEndDate" type="date" defaultValue={addDaysToDate(getTodayDate(), 30)} className={`mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required /></label>
                </div>
                <button type="submit" className="w-full bg-amber-500 text-slate-900 font-bold py-3 rounded-xl text-sm hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20 active:scale-95">Publicar campaña</button>
              </form>
            </div>

            <div className={`rounded-2xl border p-5 ${cardClasses[theme]}`}>
              <h3 className="font-bold mb-2">Campañas</h3><p className={`text-[10px] mb-4 ${textMuted}`}>Eventos enviados desde la app por cuentas que aceptaron medir. Alcance = cuentas con vistas, no personas verificadas. Datos orientativos, sin auditoría antifraude.</p>
              {ads.length === 0 ? <p className={`text-xs ${textMuted}`}>Todavía no creaste campañas.</p> : (
                <div className="space-y-3">
                  {ads.map((ad) => {
                    const metrics = campaignState === 'ready' ? getCampaignSummary(ad.id, campaignMetrics) : { reach: '—', impressions: '—', clicks: '—', ctr: null };
                    return <div key={ad.id} className={`rounded-xl border p-4 ${ad.active ? 'border-emerald-500/30' : theme === 'light' ? 'border-slate-200 opacity-60' : 'border-slate-700 opacity-60'}`}>
                      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-bold truncate">{ad.title}</p><p className={`text-[10px] ${textMuted}`}>{ad.company} · {ad.location}</p><p className={`text-[10px] mt-1 ${textMuted}`}>{ad.startDate || 'Sin fecha'} — {ad.endDate || 'Sin fecha'}</p></div><span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${ad.active ? 'bg-emerald-500/15 text-emerald-500' : 'bg-slate-500/15 text-slate-500'}`}>{ad.active ? 'Activa' : 'Pausada'}</span></div>
                      <div className={`grid grid-cols-4 gap-1 mt-3 rounded-xl p-2 text-center ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-800/50'}`}><div><p className="text-xs font-black">{metrics.reach}</p><p className={`text-[8px] ${textMuted}`}>Cuentas</p></div><div><p className="text-xs font-black">{metrics.impressions}</p><p className={`text-[8px] ${textMuted}`}>Vistas</p></div><div><p className="text-xs font-black">{metrics.clicks}</p><p className={`text-[8px] ${textMuted}`}>Clics</p></div><div><p className="text-xs font-black">{metrics.ctr === null ? '—' : `${metrics.ctr.toFixed(1)}%`}</p><p className={`text-[8px] ${textMuted}`}>CTR</p></div></div>
                      {campaignState !== 'ready' && <p role="status" className="mt-2 text-xs text-amber-500">{campaignState === 'error' ? 'No se pudieron leer las métricas de campañas.' : 'Cargando métricas…'}</p>}
                      {ad.active && <button type="button" onClick={() => pauseAd(ad.id)} className="mt-3 w-full rounded-lg border border-red-500/20 text-red-400 py-2 text-xs font-bold flex items-center justify-center"><PauseCircle size={14} className="mr-1.5"/> Pausar campaña</button>}
                    </div>;
                  })}
                </div>
              )}
            </div>

            <div className={`rounded-2xl border p-5 mb-10 ${cardClasses[theme]}`}>
              <h3 className="font-bold flex items-center mb-4"><MessageSquare size={18} className="mr-2 text-blue-500"/> Comentarios de beta</h3>
              {feedbackItems.length === 0 ? <p className={`text-xs ${textMuted}`}>Todavía no recibiste comentarios.</p> : (
                <div className="space-y-3">
                  {feedbackItems.slice(0, 20).map((item) => (
                    <div key={item.id} className={`rounded-xl p-3 ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-800/50'}`}><div className="flex justify-between gap-2"><p className="text-xs font-bold">{item.name || 'Usuario beta'}</p><span className="text-[9px] uppercase text-blue-500 font-bold">{item.category}</span></div><p className={`text-xs mt-2 whitespace-pre-wrap ${textMuted}`}>{item.message}</p></div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      <nav className={`fixed bottom-0 w-full border-t pb-safe z-40 ${theme === 'light' ? 'bg-white/90 border-slate-200' : 'bg-slate-950/90 border-slate-800'}`}>
        <div className="max-w-md mx-auto px-2 py-3 flex justify-between items-center">
          <button onClick={() => setActiveTab('roster')} className={`flex-1 flex flex-col items-center space-y-1 transition-colors ${activeTab === 'roster' ? 'text-emerald-500' : textMuted}`}><Calendar size={20} /><span className="text-[9px] font-bold">Roster</span></button>
          <button onClick={() => setActiveTab('crew')} className={`flex-1 flex flex-col items-center space-y-1 transition-colors ${activeTab === 'crew' ? 'text-blue-500' : textMuted}`}><Users size={20} /><span className="text-[9px] font-bold">Equipo</span></button>
          <button onClick={() => { setPlannedDate(''); setActiveTab('planner'); }} className={`flex-1 flex flex-col items-center space-y-1 transition-colors ${activeTab === 'planner' ? 'text-emerald-500' : textMuted}`}><CheckSquare size={20} /><span className="text-[9px] font-bold">Franco</span></button>
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
