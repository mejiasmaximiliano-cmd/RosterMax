import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar, CheckSquare, TrendingUp, User, 
  Settings, Target, Plus, Trash2, AlertCircle, ChevronRight,
  Briefcase, Home, Sun, Moon, Search, FileText,
  CheckCircle2, Circle, X, Award, Users,
  Plane, Thermometer, Zap, Wind,
  Share2, MapPin, Building2, Truck, BriefcaseBusiness,
  CloudOff, ShieldAlert, Download, Send, Smartphone,
  Megaphone, Bell, BellRing, Clock3, Link2, LogIn, LogOut,
  ExternalLink, MessageSquare, PauseCircle, Umbrella, Stethoscope,
  CalendarRange, WalletCards, Receipt, BarChart3, Activity, ChevronDown,
  ChevronUp, Filter, Clock, PiggyBank
} from 'lucide-react';
import { 
  signInAnonymously, onAuthStateChanged, getIdTokenResult,
  GoogleAuthProvider, signInWithPopup, linkWithPopup, signOut,
} from 'firebase/auth';
import { doc, setDoc, collection, onSnapshot, addDoc, deleteDoc, getDoc, runTransaction, serverTimestamp, writeBatch } from 'firebase/firestore';
import { APP_ID, auth, db } from './lib/firebase';
import {
  SCHEDULE_EXCEPTION_TYPES,
  addDaysToDate,
  getNextTransition,
  getStatusForDate,
  sanitizeSharedExceptions,
  validateRosterConfig,
  validateScheduleException,
} from './lib/roster';
import { createSyncCode, isValidSyncCode, normalizeSyncCode } from './lib/sync';
import { fetchCurrentWeather, searchWeatherLocations } from './lib/weather';
import { findRestCoincidences, groupCoincidenceWindows } from './lib/coincidences';
import { getTransitionReminder } from './lib/reminders';
import { getGoalProjection, getMonthlyBudgetSummary } from './lib/finance';
import { getAuthErrorMessage } from './lib/auth';
import { selectActiveCampaign, validateCampaign } from './lib/ads';
import { buildReciprocalFriendRecord, buildSyncedFriendRecord, findExistingConnection } from './lib/connections';
import { getNextRestWindow, getTaskSummary, sortTasks } from './lib/planning';
import { getAudienceSummary, getCampaignSummary } from './lib/analytics';
import OnboardingModal from './components/OnboardingModal';

const ONBOARDING_DISMISS_KEY = 'rostermax:onboarding-v2-dismissed';
const PUBLIC_APP_URL = import.meta.env.VITE_PUBLIC_APP_URL || 'https://rostermax.vercel.app';
const APP_VERSION = 'beta-0.4';

const EXCEPTION_LABELS = {
  vacation: 'Vacaciones',
  medical: 'Carpeta médica',
  leave: 'Permiso / licencia',
  extra_work: 'Trabajo extra',
  special_roster: 'Roster especial',
};

const TASK_CATEGORY_LABELS = {
  personal: 'Personal',
  family: 'Familia',
  health: 'Salud',
  paperwork: 'Trámites',
  learning: 'Formación',
};

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
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
  return profile.displayName?.trim() || currentUser.displayName || 'Compañero RosterMax';
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
  // --- STATES ---
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState(() => getInviteCodeFromLocation() ? 'crew' : 'roster');
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState('dark'); 
  const [addMethod, setAddMethod] = useState(() => getInviteCodeFromLocation() ? 'sync' : 'manual');
  
  // States: UX, PWA, Admin & Auth
  const [toast, setToast] = useState('');
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [hasAdminClaim, setHasAdminClaim] = useState(false);
  const [hasAdminRecord, setHasAdminRecord] = useState(false);
  const isAdmin = hasAdminClaim || hasAdminRecord;
  const [installPrompt, setInstallPrompt] = useState(null);
  const [authMsg, setAuthMsg] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [showExistingAccountConfirm, setShowExistingAccountConfirm] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // Data States
  const [rosterConfig, setRosterConfig] = useState({ workDays: 14, restDays: 14, startDate: new Date().toISOString().split('T')[0] });
  const [userProfile, setUserProfile] = useState(DEFAULT_PROFILE);
  const [tasks, setTasks] = useState([]);
  const [goals, setGoals] = useState([]);
  const [logs, setLogs] = useState([]); 
  const [friends, setFriends] = useState([]); 
  const [scheduleExceptions, setScheduleExceptions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [financeSettings, setFinanceSettings] = useState({ monthlyIncome: 0, fixedCosts: 0, plannedSavings: 0, currency: 'ARS' });
  const [privacySettings, setPrivacySettings] = useState({ analyticsEnabled: false });
  const [activityMetrics, setActivityMetrics] = useState([]);
  const [campaignMetrics, setCampaignMetrics] = useState([]);
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
  const [taskFilter, setTaskFilter] = useState('open');
  const [showExceptionForm, setShowExceptionForm] = useState(false);
  const [exceptionType, setExceptionType] = useState('vacation');
  const [installDetected, setInstallDetected] = useState(() => (
    localStorage.getItem('rostermax:installed') === '1'
    || window.matchMedia?.('(display-mode: standalone)').matches
  ));
  const adContainerRef = useRef(null);

  // API States
  const [weatherData, setWeatherData] = useState({ temp: '--', loading: false, error: '' });
  const [weatherQuery, setWeatherQuery] = useState('');
  const [weatherOptions, setWeatherOptions] = useState([]);
  const [weatherSearching, setWeatherSearching] = useState(false);
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

  // --- MOTOR DE AUTENTICACIÓN ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const token = await getIdTokenResult(currentUser);
          setHasAdminClaim(token.claims.admin === true);
          setHasAdminRecord(false);
          setUser(currentUser);
          setAuthMsg('');
        } catch (error) {
          console.error('No se pudo validar la sesión.', error);
          setAuthMsg('No se pudo validar la sesión. Revisa tu conexión.');
        } finally {
          setLoading(false);
        }
      } else {
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error('No se pudo iniciar la sesión invitada.', error);
          setAuthMsg('No pudimos iniciar tu sesión. Reintenta con conexión.');
          setLoading(false);
        }
      }
    });
    return () => unsubscribe();
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
  }, [user]);

  // Publica únicamente el calendario compartible. Los motivos privados de
  // ausencias se eliminan antes de sincronizar con compañeros.
  useEffect(() => {
    if (!user || !syncCode) return;
    setDoc(getSyncCodeRef(syncCode), {
      ownerUid: user.uid,
      syncCode,
      name: getPublicName(user, userProfile),
      workDays: rosterConfig.workDays,
      restDays: rosterConfig.restDays,
      startDate: rosterConfig.startDate,
      exceptions: sanitizeSharedExceptions(scheduleExceptions),
      updatedAt: serverTimestamp(),
    }, { merge: true }).catch((error) => {
      console.error('No se pudo publicar el roster compartible.', error);
      setSyncState('error');
    });
  }, [user, syncCode, userProfile, rosterConfig.workDays, rosterConfig.restDays, rosterConfig.startDate, scheduleExceptions]);

  // --- BASE DE DATOS PRIVADA EN TIEMPO REAL ---
  useEffect(() => {
    if (!user) return;
    const logRealtimeError = (source) => (error) => console.error(`Error de lectura en ${source}.`, error);

    const unsubRoster = onSnapshot(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'roster'), (snapshot) => {
      if (snapshot.exists()) setRosterConfig(snapshot.data());
    }, logRealtimeError('roster'));
    const unsubProfile = onSnapshot(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'profile'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setUserProfile({ ...DEFAULT_PROFILE, ...data, weatherLocation: data.weatherLocation || DEFAULT_WEATHER_LOCATION });
      }
    }, logRealtimeError('perfil'));
    const unsubTheme = onSnapshot(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'theme'), (snapshot) => {
      if (snapshot.exists()) setTheme(snapshot.data().mode);
    }, logRealtimeError('tema'));
    const unsubReminders = onSnapshot(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'reminders'), (snapshot) => {
      if (snapshot.exists()) setReminderSettings({ enabled: false, leadDays: 1, ...snapshot.data() });
    }, logRealtimeError('recordatorios'));
    const unsubFinanceSettings = onSnapshot(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'finance'), (snapshot) => {
      if (snapshot.exists()) setFinanceSettings((current) => ({ ...current, ...snapshot.data() }));
    }, logRealtimeError('presupuesto'));
    const unsubPrivacy = onSnapshot(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'privacy'), (snapshot) => {
      if (snapshot.exists()) setPrivacySettings((current) => ({ ...current, ...snapshot.data() }));
    }, logRealtimeError('privacidad'));
    const unsubOnboarding = onSnapshot(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'onboarding'), (snapshot) => {
      const completed = snapshot.exists() && snapshot.data().completed === true;
      if (!completed && localStorage.getItem(ONBOARDING_DISMISS_KEY) !== '1') setShowOnboarding(true);
    }, logRealtimeError('guía inicial'));
    
    const unsubTasks = onSnapshot(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'tasks'), (s) => setTasks(s.docs.map(d => ({ id: d.id, ...d.data() }))), logRealtimeError('tareas'));
    const unsubGoals = onSnapshot(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'goals'), (s) => setGoals(s.docs.map(d => ({ id: d.id, ...d.data() }))), logRealtimeError('metas'));
    const unsubLogs = onSnapshot(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'logs'), (s) => setLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))), logRealtimeError('bitácora'));
    const unsubFriends = onSnapshot(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'friends'), (s) => setFriends(s.docs.map(d => ({ id: d.id, ...d.data() }))), logRealtimeError('compañeros'));
    const unsubExceptions = onSnapshot(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'schedule_exceptions'), (snapshot) => setScheduleExceptions(snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((left, right) => left.startDate.localeCompare(right.startDate))), logRealtimeError('cambios de roster'));
    const unsubExpenses = onSnapshot(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'expenses'), (snapshot) => setExpenses(snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((left, right) => String(right.date).localeCompare(String(left.date)))), logRealtimeError('gastos'));
    
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
    if (!user || !privacySettings.analyticsEnabled) return;
    const activityRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'activity', user.uid);
    runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(activityRef);
      transaction.set(activityRef, {
        ownerUid: user.uid,
        accountType: user.isAnonymous ? 'guest' : 'google',
        firstSeenAt: snapshot.exists() ? snapshot.data().firstSeenAt : serverTimestamp(),
        lastActiveAt: serverTimestamp(),
        lastActiveDay: getTodayDate(),
        installDetected,
        rosterConfigured: validateRosterConfig(rosterConfig).valid,
        profileComplete: Boolean(userProfile.displayName?.trim()),
        appVersion: APP_VERSION,
      });
    }).catch((error) => console.error('No se pudo actualizar la métrica anónima de actividad.', error));
  }, [user, privacySettings.analyticsEnabled, installDetected, rosterConfig, userProfile.displayName]);

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
      (snapshot) => setActivityMetrics(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      (error) => console.error('No se pudieron cargar las métricas de audiencia.', error),
    );
    const unsubscribeCampaigns = onSnapshot(
      collection(db, 'artifacts', APP_ID, 'public', 'data', 'campaign_metrics'),
      (snapshot) => setCampaignMetrics(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      (error) => console.error('No se pudieron cargar las métricas de campañas.', error),
    );
    return () => { unsubscribeActivity(); unsubscribeCampaigns(); };
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

  // --- CLIMA REAL ---
  useEffect(() => {
    let cancelled = false;
    const loadWeather = async () => {
      const location = userProfile.weatherLocation;
      if (!location?.latitude || !location?.longitude) {
        setWeatherData({ temp: '--', loading: false, error: 'Configura el clima' });
        return;
      }
      setWeatherData((current) => ({ ...current, loading: true, error: '' }));
      try {
        const weather = await fetchCurrentWeather(location.latitude, location.longitude);
        if (!cancelled) setWeatherData({ ...weather, loading: false, error: '' });
      } catch (error) {
        if (!cancelled) setWeatherData({ temp: '--', loading: false, error: error.message });
      }
    };
    loadWeather();
    return () => { cancelled = true; };
  }, [userProfile.weatherLocation]);

  // Las alertas web locales se muestran cuando el usuario abre la app dentro
  // de la ventana elegida. Las notificaciones con la app cerrada requerirán Push.
  useEffect(() => {
    if (!reminderSettings.enabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const reminder = getTransitionReminder(getTodayDate(), { ...rosterConfig, exceptions: scheduleExceptions }, reminderSettings.leadDays);
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
  }, [reminderSettings, rosterConfig, scheduleExceptions]);

  const effectiveRoster = useMemo(() => ({ ...rosterConfig, exceptions: scheduleExceptions }), [rosterConfig, scheduleExceptions]);
  const currentStatus = useMemo(() => getStatusForDate(getTodayDate(), effectiveRoster), [effectiveRoster]);
  const nextTransition = useMemo(() => getNextTransition(getTodayDate(), effectiveRoster), [effectiveRoster]);
  const targetStatus = useMemo(() => getStatusForDate(targetDate, effectiveRoster), [targetDate, effectiveRoster]);
  const upcomingCoincidences = useMemo(() => findRestCoincidences(
    getTodayDate(),
    effectiveRoster,
    displayFriends.filter((friend) => friend.syncAvailable !== false),
    { horizonDays: 120, maxResults: 40 },
  ), [effectiveRoster, displayFriends]);
  const groupedCoincidences = useMemo(() => groupCoincidenceWindows(upcomingCoincidences), [upcomingCoincidences]);
  const visibleCoincidences = showAllCoincidences ? groupedCoincidences : groupedCoincidences.slice(0, 3);
  const filteredFriends = useMemo(() => displayFriends
    .filter((friend) => friend.name?.toLowerCase().includes(crewSearch.trim().toLowerCase()))
    .sort((left, right) => String(left.name).localeCompare(String(right.name), 'es')), [displayFriends, crewSearch]);
  const visibleFriends = showAllFriends ? filteredFriends : filteredFriends.slice(0, 6);
  const nextRestWindow = useMemo(() => getNextRestWindow(getTodayDate(), effectiveRoster), [effectiveRoster]);
  const orderedTasks = useMemo(() => sortTasks(tasks), [tasks]);
  const taskSummary = useMemo(() => getTaskSummary(tasks, getTodayDate()), [tasks]);
  const visibleTasks = useMemo(() => orderedTasks.filter((task) => (
    taskFilter === 'all' || (taskFilter === 'done' ? task.completed : !task.completed)
  )), [orderedTasks, taskFilter]);
  const budgetSummary = useMemo(() => getMonthlyBudgetSummary(financeSettings, expenses, rosterConfig, getTodayDate().slice(0, 7)), [financeSettings, expenses, rosterConfig]);
  const audienceSummary = useMemo(() => getAudienceSummary(activityMetrics), [activityMetrics]);
  const currentAd = useMemo(
    () => selectActiveCampaign(ads, userProfile, getTodayDate()),
    [ads, userProfile],
  );
  const activeAdCount = useMemo(
    () => ads.filter((ad) => ad.active === true && (!ad.endDate || ad.endDate >= getTodayDate())).length,
    [ads],
  );

  useEffect(() => {
    if (!currentAd?.id || !privacySettings.analyticsEnabled || !adContainerRef.current || typeof IntersectionObserver === 'undefined') return undefined;
    const sessionKey = `rostermax:ad-view:${currentAd.id}`;
    if (sessionStorage.getItem(sessionKey) === '1') return undefined;
    let timer = null;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.intersectionRatio >= 0.5) {
        if (!timer) timer = setTimeout(() => {
          sessionStorage.setItem(sessionKey, '1');
          trackCampaignMetric(user, currentAd.id, 'view').catch((error) => console.error('No se pudo registrar la impresión.', error));
          observer.disconnect();
        }, 1000);
      } else if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }, { threshold: [0.5] });
    observer.observe(adContainerRef.current);
    return () => { if (timer) clearTimeout(timer); observer.disconnect(); };
  }, [currentAd, privacySettings.analyticsEnabled, user]);

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
    if (!validation.valid) {
      showToast(validation.error);
      return false;
    }
    try {
      await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'roster'), rosterData);
      showToast("Diagrama actualizado.");
      return true;
    } catch (error) {
      console.error('No se pudo actualizar el diagrama.', error);
      showToast('No se pudo guardar el diagrama.');
      return false;
    }
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

  const saveProfile = async (profileData) => {
    try {
      await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'profile'), {
        ...DEFAULT_PROFILE,
        ...profileData,
        displayName: String(profileData.displayName || '').trim().slice(0, 40),
        weatherLocation: profileData.weatherLocation || userProfile.weatherLocation || DEFAULT_WEATHER_LOCATION,
      });
      showToast("Perfil guardado.");
      return true;
    } catch (error) {
      console.error('No se pudo guardar el perfil.', error);
      showToast('No se pudo guardar el perfil.');
      return false;
    }
  };

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
    try {
      await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'onboarding'), {
        completed: true,
        version: 2,
        completedAt: serverTimestamp(),
      });
      localStorage.removeItem(ONBOARDING_DISMISS_KEY);
      setShowOnboarding(false);
      setActiveTab(destination);
      showToast('RosterMax está listo para usar.');
    } catch (error) {
      console.error('No se pudo completar la guía.', error);
      showToast('No se pudo guardar el avance de la guía.');
    }
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
          workDays: rosterConfig.workDays,
          restDays: rosterConfig.restDays,
          startDate: rosterConfig.startDate,
          exceptions: sanitizeSharedExceptions(scheduleExceptions),
          updatedAt: serverTimestamp(),
        }, { merge: true });

        const batch = writeBatch(db);
        if (!existingConnection) {
          batch.set(
            doc(db, 'artifacts', APP_ID, 'users', user.uid, 'friends', foundUser.ownerUid),
            { ...buildSyncedFriendRecord(foundUser, codeInput), createdAt: serverTimestamp() },
          );
        }
        batch.set(
          doc(db, 'artifacts', APP_ID, 'users', foundUser.ownerUid, 'friends', user.uid),
          {
            ...buildReciprocalFriendRecord({
              uid: user.uid,
              name: getPublicName(user, userProfile),
              syncCode,
              inviteCode: codeInput,
            }),
            createdAt: serverTimestamp(),
          },
        );
        await batch.commit();
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
    await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, collectionName), { ...fields, createdAt: serverTimestamp() });
    formElement.reset();
  };

  const toggleLog = async (log) => await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'logs', log.id), { ...log, resolved: !log.resolved });
  const toggleTask = async (task) => await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'tasks', task.id), { completed: !task.completed, updatedAt: serverTimestamp() }, { merge: true });

  const createScheduleException = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const validation = validateScheduleException({
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
      await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'schedule_exceptions'), {
        ...validation.exception,
        createdAt: serverTimestamp(),
      });
      formElement.reset();
      setExceptionType('vacation');
      setShowExceptionForm(false);
      showToast('Cambio temporal aplicado al calendario.');
    } catch (error) {
      console.error('No se pudo guardar el cambio temporal.', error);
      showToast('No se pudo guardar el cambio de roster.');
    }
  };

  const createRestTask = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const title = String(form.get('title') || '').trim().slice(0, 100);
    if (!title) return;
    try {
      await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'tasks'), {
        title,
        date: String(form.get('date') || ''),
        category: String(form.get('category') || 'personal'),
        priority: String(form.get('priority') || 'medium'),
        estimatedMinutes: Math.max(0, Number(form.get('estimatedMinutes') || 0)),
        completed: false,
        createdAt: serverTimestamp(),
      });
      formElement.reset();
      showToast('Plan agregado a tu próximo franco.');
    } catch (error) {
      console.error('No se pudo crear la tarea.', error);
      showToast('No se pudo agregar el plan.');
    }
  };

  const saveFinancePlan = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const plan = {
      monthlyIncome: Math.max(0, Number(form.get('monthlyIncome') || 0)),
      fixedCosts: Math.max(0, Number(form.get('fixedCosts') || 0)),
      plannedSavings: Math.max(0, Number(form.get('plannedSavings') || 0)),
      currency: String(form.get('currency') || 'ARS'),
      updatedAt: serverTimestamp(),
    };
    if (plan.fixedCosts + plan.plannedSavings > plan.monthlyIncome && plan.monthlyIncome > 0) {
      showToast('Los gastos fijos y el ahorro superan el ingreso mensual.');
      return;
    }
    await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'finance'), plan, { merge: true });
    showToast('Presupuesto mensual actualizado.');
  };

  const addExpense = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const amount = Number(form.get('amount'));
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('Ingresa un gasto mayor que cero.');
      return;
    }
    await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'expenses'), {
      amount,
      category: String(form.get('category') || 'otros'),
      note: String(form.get('note') || '').trim().slice(0, 80),
      date: String(form.get('date') || getTodayDate()),
      createdAt: serverTimestamp(),
    });
    formElement.reset();
    showToast('Gasto registrado.');
  };

  const toggleAnalytics = async () => {
    const nextValue = !privacySettings.analyticsEnabled;
    await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'privacy'), {
      analyticsEnabled: nextValue,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    if (!nextValue) {
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'activity', user.uid));
    }
    showToast(nextValue ? 'Métricas anónimas activadas.' : 'Métricas anónimas desactivadas.');
  };

  const createFinancialGoal = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const target = Number(form.get('target'));
    const monthlyPlan = Number(form.get('monthlyPlan'));
    if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(monthlyPlan) || monthlyPlan < 0) {
      showToast('Revisa los montos de la meta.');
      return;
    }
    try {
      await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'goals'), {
        title: String(form.get('title')).trim().slice(0, 80),
        target,
        monthlyPlan,
        current: 0,
        currency: form.get('currency'),
        createdAt: serverTimestamp(),
      });
      formElement.reset();
      showToast('Meta financiera creada.');
    } catch (error) {
      console.error('No se pudo crear la meta.', error);
      showToast('No se pudo crear la meta.');
    }
  };

  const addFunds = async (goal, amount) => {
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
        const nextAmount = Math.min(Number(data.target), Number(data.current || 0) + value);
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

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-emerald-500"></div></div>;

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
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-emerald-500 text-white px-5 py-2.5 rounded-full font-bold shadow-xl z-[100] text-sm animate-in slide-in-from-top-4 flex items-center">
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

            <div className={`rounded-2xl border p-5 ${cardClasses[theme]}`}>
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="font-bold flex items-center"><CalendarRange size={18} className="mr-2 text-indigo-500"/> Cambios temporales</h3><p className={`text-[10px] mt-1 ${textMuted}`}>Vacaciones, licencias o rosters especiales pisan sólo esas fechas. Después vuelves automáticamente a tu diagrama habitual.</p></div>
                <button type="button" onClick={() => setShowExceptionForm((value) => !value)} className="flex-shrink-0 rounded-xl bg-indigo-500 px-3 py-2 text-xs font-bold text-white">{showExceptionForm ? 'Cerrar' : 'Agregar'}</button>
              </div>

              {showExceptionForm && (
                <form onSubmit={createScheduleException} className={`mt-4 space-y-3 rounded-xl border p-4 ${theme === 'light' ? 'bg-indigo-50/60 border-indigo-100' : 'bg-indigo-500/5 border-indigo-500/20'}`}>
                  <select name="type" value={exceptionType} onChange={(event) => setExceptionType(event.target.value)} className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`}>
                    {Object.keys(SCHEDULE_EXCEPTION_TYPES).map((type) => <option key={type} value={type}>{EXCEPTION_LABELS[type]}</option>)}
                  </select>
                  <input name="label" type="text" maxLength="80" placeholder="Nota privada opcional" className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`}/>
                  <div className="grid grid-cols-2 gap-2">
                    <label className={`text-[10px] font-bold ${textMuted}`}>Desde<input name="startDate" type="date" defaultValue={getTodayDate()} className={`mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required/></label>
                    <label className={`text-[10px] font-bold ${textMuted}`}>Hasta<input name="endDate" type="date" defaultValue={addDaysToDate(getTodayDate(), 6)} className={`mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required/></label>
                  </div>
                  {exceptionType === 'special_roster' && <div className="space-y-2"><div className="grid grid-cols-2 gap-2"><input name="workDays" type="number" min="1" max="365" defaultValue="7" aria-label="Días de trabajo especiales" className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required/><input name="restDays" type="number" min="1" max="365" defaultValue="7" aria-label="Días de descanso especiales" className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required/></div><label className={`block text-[10px] font-bold ${textMuted}`}>Primera subida del roster especial<input name="cycleStartDate" type="date" defaultValue={getTodayDate()} className={`mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required/></label></div>}
                  <button className="w-full rounded-xl bg-indigo-500 py-2.5 text-sm font-bold text-white">Aplicar cambio temporal</button>
                </form>
              )}

              {scheduleExceptions.length === 0 ? <p className={`mt-4 text-xs text-center py-2 ${textMuted}`}>Tu roster sigue el diagrama habitual, sin cambios cargados.</p> : (
                <div className="mt-4 space-y-2 max-h-64 overflow-y-auto pr-1">
                  {scheduleExceptions.map((exception) => (
                    <div key={exception.id} className={`rounded-xl border p-3 flex items-center gap-3 ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/40 border-slate-700'}`}>
                      <div className="h-9 w-9 flex-shrink-0 rounded-lg bg-indigo-500/15 text-indigo-500 flex items-center justify-center"><ScheduleExceptionIcon type={exception.type}/></div>
                      <div className="min-w-0 flex-1"><p className="text-xs font-bold truncate">{exception.label || EXCEPTION_LABELS[exception.type]}</p><p className={`text-[10px] ${textMuted}`}>{formatShortDate(exception.startDate)} — {formatShortDate(exception.endDate)}{exception.type === 'special_roster' ? ` · ${exception.workDays}x${exception.restDays}` : ''}</p></div>
                      <button type="button" onClick={() => deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'schedule_exceptions', exception.id))} className="p-2 text-slate-400 hover:text-red-400" aria-label={`Eliminar ${EXCEPTION_LABELS[exception.type]}`}><Trash2 size={15}/></button>
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
               <div className={`rounded-2xl border p-4 ${cardClasses[theme]} flex flex-col justify-center items-center text-center`}>
                 <Thermometer size={24} className={`${theme === 'light' ? 'text-amber-500' : 'text-amber-500'} mb-2`}/>
                 <span className="text-2xl font-bold">{weatherData.loading ? '...' : `${weatherData.temp}°C`}</span>
                 <span className="text-xs font-bold mt-1 max-w-full truncate px-2" title={userProfile.weatherLocation?.label}>
                   {userProfile.weatherLocation?.name || 'Sin ubicación'}
                 </span>
                 {weatherData.error ? (
                   <span className="text-[9px] text-red-400 truncate max-w-full" title={weatherData.error}>{weatherData.error}</span>
                 ) : (
                   <span className={`text-[9px] ${textMuted} flex items-center gap-1`}>
                     <Wind size={9}/> {weatherData.windSpeed ?? '--'} km/h{weatherData.stale ? ' · guardado' : ''}
                   </span>
                 )}
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
                    <button onClick={() => deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'logs', log.id))} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2"><X size={16}/></button>
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
                  <button type="button" onClick={acceptPendingInvite} disabled={!pendingInvite.data || pendingInvite.loading || syncState !== 'ready'} className="py-2.5 rounded-xl bg-blue-500 text-white text-xs font-bold disabled:opacity-50">Aceptar y compartir</button>
                </div>
              </div>
            )}
            
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
                  {displayFriends.map(friend => {
                    const status = getStatusForDate(targetDate, friend);
                    if (!status || status.error) {
                      return (
                        <div key={friend.id} className={`p-3 rounded-lg border flex justify-between items-center ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/40 border-slate-700'}`}>
                          <span className="font-semibold text-sm">{friend.name}</span>
                          <span className="text-xs text-amber-500">Sin datos sincronizados</span>
                        </div>
                      );
                    }
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

            <div className={`rounded-2xl border p-5 ${cardClasses[theme]}`}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold flex items-center"><Zap size={17} className="mr-2 text-amber-500 fill-amber-500"/> Próximos francos juntos</h3>
                <span className={`text-[10px] font-bold ${textMuted}`}>120 días</span>
              </div>
              <p className={`text-[11px] mb-4 ${textMuted}`}>Calculados automáticamente con los diagramas disponibles.</p>
              {groupedCoincidences.length > 0 ? (
                <div className="space-y-2">
                  {visibleCoincidences.map((window) => (
                    <div key={`${window.startDate}-${window.endDate}`} className={`rounded-xl border p-3 ${theme === 'light' ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                      <div className="flex items-center justify-between gap-3"><p className="font-bold text-sm">{formatShortDate(window.startDate)}{window.endDate !== window.startDate ? ` — ${formatShortDate(window.endDate)}` : ''}</p><span className="text-xs font-black text-emerald-500 whitespace-nowrap">{window.days} {window.days === 1 ? 'día' : 'días'}</span></div>
                      <div className="flex flex-wrap gap-1.5 mt-2">{window.friends.map((friend) => <span key={friend.id} className={`text-[10px] font-bold px-2 py-1 rounded-full ${theme === 'light' ? 'bg-white text-emerald-700' : 'bg-slate-950/40 text-emerald-300'}`}>{friend.name}</span>)}</div>
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
                    <button onClick={() => deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'friends', friend.id))} className="text-slate-500 hover:text-red-400 p-2" aria-label={`Eliminar a ${friend.name}`}><Trash2 size={16}/></button>
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
        {activeTab === 'planner' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <HeaderTitle icon={CheckSquare} title="Planificador de Franco" colorClass="text-emerald-500" theme={theme} />

            <div className="rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 p-5 text-white shadow-xl shadow-emerald-900/20 relative overflow-hidden">
              <div className="absolute -right-6 -bottom-8 opacity-10"><Umbrella size={120}/></div>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100">Próximo descanso</p>
              {!nextRestWindow ? <p className="font-bold mt-2">Configura primero tu diagrama.</p> : <><p className="text-2xl font-black mt-1">{formatShortDate(nextRestWindow.startDate)} — {formatShortDate(nextRestWindow.endDate)}</p><p className="text-sm text-emerald-100">{nextRestWindow.days} {nextRestWindow.days === 1 ? 'día disponible' : 'días disponibles'} para avanzar en lo importante.</p></>}
              <div className="grid grid-cols-3 gap-2 mt-5 relative z-10"><div className="rounded-xl bg-white/10 p-2 text-center"><p className="text-xl font-black">{taskSummary.open}</p><p className="text-[9px] uppercase">Pendientes</p></div><div className="rounded-xl bg-white/10 p-2 text-center"><p className="text-xl font-black">{taskSummary.overdue}</p><p className="text-[9px] uppercase">Atrasados</p></div><div className="rounded-xl bg-white/10 p-2 text-center"><p className="text-xl font-black">{Math.round(taskSummary.minutesPending / 60)}h</p><p className="text-[9px] uppercase">Planificadas</p></div></div>
            </div>

            <form onSubmit={createRestTask} className={`rounded-2xl border p-5 space-y-3 ${cardClasses[theme]}`}>
              <div><h3 className="font-bold">Agregar un plan</h3><p className={`text-[10px] ${textMuted}`}>Ponle fecha, prioridad y tiempo estimado para no llenar el franco de más.</p></div>
              <input name="title" type="text" maxLength="100" placeholder="Ej. Turno médico, renovar carnet…" className={`w-full rounded-xl px-4 py-3 outline-none border ${inputBg}`} required/>
              <div className="grid grid-cols-2 gap-2">
                <input name="date" type="date" defaultValue={nextRestWindow?.startDate || getTodayDate()} className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required/>
                <select name="category" className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`}>{Object.entries(TASK_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                <select name="priority" className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`}><option value="high">Prioridad alta</option><option value="medium">Prioridad media</option><option value="low">Prioridad baja</option></select>
                <select name="estimatedMinutes" className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`}><option value="30">30 minutos</option><option value="60">1 hora</option><option value="120">2 horas</option><option value="240">4 horas</option><option value="480">1 día</option></select>
              </div>
              <button className="w-full rounded-xl bg-emerald-500 py-3 font-bold text-white shadow-lg shadow-emerald-500/20"><Plus size={17} className="inline mr-1"/> Agregar al franco</button>
            </form>

            <div>
              <div className="flex gap-2 mb-3">{[['open', 'Pendientes'], ['done', 'Hechos'], ['all', 'Todos']].map(([value, label]) => <button key={value} type="button" onClick={() => setTaskFilter(value)} className={`rounded-full px-3 py-1.5 text-xs font-bold border ${taskFilter === value ? 'bg-emerald-500 border-emerald-500 text-white' : inputBg}`}>{label}</button>)}</div>
              <div className="space-y-3">
                {visibleTasks.length === 0 && <div className={`rounded-2xl border p-6 text-center ${cardClasses[theme]}`}><CheckCircle2 size={28} className="mx-auto text-emerald-500 mb-2"/><p className="font-bold">Nada pendiente en esta vista</p><p className={`text-xs mt-1 ${textMuted}`}>Tu franco queda libre para descansar o agregar un objetivo.</p></div>}
                {visibleTasks.map(task => (
                  <div key={task.id} className={`rounded-2xl border p-4 transition-all ${task.completed ? 'opacity-60' : ''} ${cardClasses[theme]}`}>
                    <div className="flex items-start gap-3"><button type="button" onClick={() => toggleTask(task)} className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center ${task.completed ? 'bg-emerald-500 border-emerald-500' : 'border-slate-400'}`}>{task.completed && <CheckSquare size={14} className="text-white"/>}</button><div className="min-w-0 flex-1"><p className={`font-bold ${task.completed ? 'line-through' : ''}`}>{task.title}</p><div className={`flex flex-wrap gap-x-3 gap-y-1 text-[10px] mt-1 ${textMuted}`}><span><Calendar size={11} className="inline mr-1"/>{task.date ? formatShortDate(task.date) : 'Sin fecha'}</span><span>{TASK_CATEGORY_LABELS[task.category] || 'Personal'}</span>{Number(task.estimatedMinutes) > 0 && <span><Clock size={11} className="inline mr-1"/>{task.estimatedMinutes} min</span>}</div></div><button type="button" onClick={() => deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'tasks', task.id))} className="p-2 text-slate-400 hover:text-red-400" aria-label={`Eliminar ${task.title}`}><Trash2 size={16}/></button></div>
                    {!task.completed && task.priority === 'high' && <span className="mt-3 inline-block rounded-full bg-red-500/10 px-2 py-1 text-[9px] font-black uppercase text-red-400">Prioridad alta</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: WEALTH */}
        {activeTab === 'wealth' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <HeaderTitle icon={TrendingUp} title="Finanzas" colorClass="text-emerald-500" theme={theme} />

            <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-emerald-950 border border-emerald-500/30 p-5 text-white shadow-xl relative overflow-hidden">
              <div className="absolute -right-5 -top-4 opacity-10"><WalletCards size={110}/></div>
              <p className="text-[10px] uppercase font-black tracking-widest text-emerald-300">Disponible este mes</p><p className={`text-3xl font-black mt-1 ${budgetSummary.remaining < 0 ? 'text-red-400' : 'text-white'}`}>{formatAmount(budgetSummary.remaining, financeSettings.currency)}</p>
              <div className="grid grid-cols-3 gap-2 mt-5 relative z-10"><div className="rounded-xl bg-white/5 p-2"><p className="text-[9px] text-slate-400">Ahorrás</p><p className="font-black">{budgetSummary.savingsRate.toFixed(0)}%</p></div><div className="rounded-xl bg-white/5 p-2"><p className="text-[9px] text-slate-400">Gastos</p><p className="font-black truncate">{formatAmount(budgetSummary.variableSpent, financeSettings.currency)}</p></div><div className="rounded-xl bg-white/5 p-2"><p className="text-[9px] text-slate-400">Por día franco</p><p className="font-black truncate">{formatAmount(budgetSummary.dailyRestBudget, financeSettings.currency)}</p></div></div>
            </div>

            <form onSubmit={saveFinancePlan} className={`rounded-2xl border p-5 space-y-3 ${cardClasses[theme]}`}>
              <div><h3 className="font-bold flex items-center"><PiggyBank size={18} className="mr-2 text-emerald-500"/> Plan mensual</h3><p className={`text-[10px] mt-1 ${textMuted}`}>Separa primero gastos fijos y ahorro; RosterMax calcula cuánto queda para tus días de descanso.</p></div>
              <div className="grid grid-cols-2 gap-2"><input name="monthlyIncome" type="number" min="0" step="0.01" defaultValue={financeSettings.monthlyIncome} placeholder="Ingreso mensual" aria-label="Ingreso mensual" className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required/><select name="currency" defaultValue={financeSettings.currency} className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`}><option value="ARS">Pesos (ARS)</option><option value="USD">Dólares (USD)</option></select><input name="fixedCosts" type="number" min="0" step="0.01" defaultValue={financeSettings.fixedCosts} placeholder="Gastos fijos" aria-label="Gastos fijos" className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required/><input name="plannedSavings" type="number" min="0" step="0.01" defaultValue={financeSettings.plannedSavings} placeholder="Ahorro mensual" aria-label="Ahorro mensual" className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required/></div>
              <button className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-white">Guardar presupuesto</button>
            </form>

            <div className={`rounded-2xl border p-5 ${cardClasses[theme]}`}>
              <h3 className="font-bold flex items-center"><Receipt size={18} className="mr-2 text-blue-500"/> Gastos del mes</h3>
              <form onSubmit={addExpense} className="mt-3 space-y-2"><div className="grid grid-cols-2 gap-2"><input name="amount" type="number" min="0.01" step="0.01" placeholder="Monto" className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required/><select name="category" className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`}><option value="comida">Comida</option><option value="transporte">Transporte</option><option value="familia">Familia</option><option value="ocio">Ocio</option><option value="otros">Otros</option></select><input name="date" type="date" defaultValue={getTodayDate()} className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required/><input name="note" type="text" maxLength="80" placeholder="Nota opcional" className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`}/></div><button className="w-full rounded-xl border border-blue-500/30 py-2 text-xs font-bold text-blue-500">Registrar gasto</button></form>
              {expenses.length > 0 && <div className="mt-4 space-y-2 max-h-48 overflow-y-auto pr-1">{expenses.slice(0, 10).map((expense) => <div key={expense.id} className={`flex items-center justify-between rounded-xl p-3 ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-800/50'}`}><div className="min-w-0"><p className="text-xs font-bold truncate">{expense.note || expense.category}</p><p className={`text-[9px] ${textMuted}`}>{formatShortDate(expense.date)} · {expense.category}</p></div><div className="flex items-center gap-2"><span className="text-xs font-black text-red-400">− {formatAmount(expense.amount, financeSettings.currency)}</span><button type="button" onClick={() => deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'expenses', expense.id))} className="text-slate-400 hover:text-red-400"><X size={14}/></button></div></div>)}</div>}
            </div>

            <div className="space-y-4"><h3 className="font-bold flex items-center"><Target size={18} className="mr-2 text-indigo-500"/> Metas de ahorro</h3>
                <div className={`rounded-2xl border p-5 ${cardClasses[theme]}`}>
                  <form onSubmit={createFinancialGoal} className="space-y-3">
                    <div className="flex space-x-2">
                      <input name="title" type="text" placeholder="Ej. Cambio de auto" className={`flex-1 rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required />
                      <select name="currency" className={`w-20 rounded-xl px-2 py-2 text-sm outline-none border ${inputBg}`}>
                        <option value="USD">USD</option><option value="ARS">ARS</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input name="target" type="number" min="0.01" step="0.01" placeholder="Monto objetivo" aria-label="Monto objetivo" className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} required />
                      <input name="monthlyPlan" type="number" min="0" step="0.01" placeholder="Aporte mensual (opcional)" aria-label="Aporte mensual planificado" className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${inputBg}`} />
                    </div>
                    <button type="submit" className="w-full bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 font-bold py-2.5 rounded-xl border border-emerald-500/20 transition-colors">Crear Meta Financiera</button>
                  </form>
                </div>
                <div className="space-y-4">
                  {goals.map(goal => {
                    const projection = getGoalProjection(goal);
                    const progress = projection?.progress || 0;
                    const isUSD = goal.currency === 'USD';
                    return (
                      <div key={goal.id} className={`rounded-2xl border p-5 ${cardClasses[theme]} relative overflow-hidden group`}>
                        {progress >= 100 && <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg flex items-center z-10"><Award size={12} className="mr-1"/> LOGRADO</div>}
                        <div className="flex justify-between items-center mb-3"><span className="font-bold relative z-10 flex items-center">{goal.title} <span className="ml-2 text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">{goal.currency || 'USD'}</span></span><button onClick={() => deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'goals', goal.id))} className="text-slate-400 hover:text-red-400 opacity-70 transition-opacity relative z-10" aria-label={`Eliminar meta ${goal.title}`}><Trash2 size={14}/></button></div>
                        <div className="flex items-end justify-between mb-2 relative z-10"><div className="flex items-baseline space-x-1"><span className="text-2xl font-black">{formatAmount(goal.current, goal.currency)}</span><span className={`text-xs ${textMuted}`}>/ {formatAmount(goal.target, goal.currency)}</span></div><span className="text-xs font-bold text-emerald-500">{progress.toFixed(0)}%</span></div>
                        <div className={`h-2.5 w-full rounded-full overflow-hidden relative z-10 ${theme === 'light' ? 'bg-slate-200' : 'bg-slate-800'}`}><div className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min(progress, 100)}%` }}></div></div>
                        {projection?.monthsRemaining !== null && progress < 100 && (
                          <p className={`mt-2 text-[10px] ${textMuted}`}>Plan: {formatAmount(projection.monthlyPlan, goal.currency)} al mes · aproximadamente {projection.monthsRemaining} {projection.monthsRemaining === 1 ? 'mes' : 'meses'}.</p>
                        )}
                        {progress < 100 && (
                          <div className="mt-4 space-y-2 relative z-10">
                            <form onSubmit={async (event) => { event.preventDefault(); const formElement = event.currentTarget; const saved = await addFunds(goal, new FormData(formElement).get('amount')); if (saved) formElement.reset(); }} className="flex gap-2">
                              <input name="amount" type="number" min="0.01" step="0.01" placeholder="Registrar aporte" aria-label={`Aporte para ${goal.title}`} className={`min-w-0 flex-1 rounded-lg px-3 py-2 text-xs outline-none border ${inputBg}`} required/>
                              <button className="bg-emerald-500 text-white px-3 rounded-lg text-xs font-bold">Aportar</button>
                            </form>
                            <div className="flex space-x-2">
                              <button onClick={() => addFunds(goal, isUSD ? 100 : 10000)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${theme === 'light' ? 'bg-white border-emerald-200 text-emerald-600' : 'bg-slate-900 border-emerald-500/30 text-emerald-400'}`}>+ {isUSD ? 'USD 100' : 'ARS 10k'}</button>
                              <button onClick={() => addFunds(goal, goal.monthlyPlan || (isUSD ? 1000 : 100000))} className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${theme === 'light' ? 'bg-white border-emerald-200 text-emerald-600' : 'bg-slate-900 border-emerald-500/30 text-emerald-400'}`}>+ plan mensual</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            <div className={`rounded-xl border px-4 py-3 text-[10px] leading-relaxed ${theme === 'light' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-amber-500/10 border-amber-500/20 text-amber-200'}`}>RosterMax te ayuda a ordenar tu presupuesto y tus metas. No brinda recomendaciones de inversión ni reemplaza asesoramiento financiero profesional.</div>
          </div>
        )}

        {/* TAB 5: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            
            <div className="flex justify-between items-center mb-6">
              <HeaderTitle icon={Settings} title="Ajustes" colorClass="text-slate-400" theme={theme} />
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
              <div className="flex items-start justify-between gap-4"><div className="flex gap-3"><div className={`h-10 w-10 rounded-xl flex-shrink-0 flex items-center justify-center ${privacySettings.analyticsEnabled ? 'bg-blue-500/15 text-blue-500' : theme === 'light' ? 'bg-slate-100 text-slate-500' : 'bg-slate-800 text-slate-400'}`}><Activity size={19}/></div><div><h3 className="font-bold text-sm">Ayudar a mejorar RosterMax</h3><p className={`text-[10px] mt-1 leading-relaxed ${textMuted}`}>Comparte métricas técnicas y agregadas de uso. Nunca enviamos nombre, correo, empresa, ubicación, tareas, finanzas ni motivos de licencia.</p></div></div><button type="button" role="switch" aria-checked={privacySettings.analyticsEnabled} onClick={toggleAnalytics} className={`w-12 h-7 rounded-full p-1 flex-shrink-0 transition-colors ${privacySettings.analyticsEnabled ? 'bg-blue-500 justify-end' : 'bg-slate-600 justify-start'}`}><span className="block h-5 w-5 rounded-full bg-white shadow"/></button></div>
              <p className={`mt-3 text-[9px] ${textMuted}`}>{privacySettings.analyticsEnabled ? 'Activado. Puedes apagarlo cuando quieras y eliminaremos tu registro de medición.' : 'Desactivado por defecto. La app funciona igual sin compartir métricas.'}</p>
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

            <div className={`rounded-2xl border p-5 ${cardClasses[theme]}`}>
              <div className="flex items-start justify-between"><div><h3 className="font-bold flex items-center"><BarChart3 size={18} className="mr-2 text-blue-500"/> Audiencia medible</h3><p className={`text-[10px] mt-1 ${textMuted}`}>Datos propios de usuarios que aceptaron métricas. No son descargas de tienda ni incluyen información personal.</p></div><span className="rounded-full bg-blue-500/10 px-2 py-1 text-[9px] font-black text-blue-500">OPT-IN</span></div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className={`rounded-xl p-3 ${theme === 'light' ? 'bg-blue-50' : 'bg-blue-500/10'}`}><p className={`text-[9px] ${textMuted}`}>Usuarios medidos</p><p className="text-2xl font-black text-blue-500">{audienceSummary.measuredUsers}</p></div>
                <div className={`rounded-xl p-3 ${theme === 'light' ? 'bg-emerald-50' : 'bg-emerald-500/10'}`}><p className={`text-[9px] ${textMuted}`}>Activos 30 días</p><p className="text-2xl font-black text-emerald-500">{audienceSummary.activeMonth}</p></div>
                <div className={`rounded-xl p-3 ${theme === 'light' ? 'bg-indigo-50' : 'bg-indigo-500/10'}`}><p className={`text-[9px] ${textMuted}`}>Activos 7 días</p><p className="text-2xl font-black text-indigo-500">{audienceSummary.activeWeek}</p></div>
                <div className={`rounded-xl p-3 ${theme === 'light' ? 'bg-amber-50' : 'bg-amber-500/10'}`}><p className={`text-[9px] ${textMuted}`}>Activos 24 horas</p><p className="text-2xl font-black text-amber-500">{audienceSummary.activeDay}</p></div>
              </div>
              <div className={`grid grid-cols-3 gap-2 mt-2 text-center ${textMuted}`}><div className={`rounded-lg p-2 ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-800/50'}`}><p className="text-sm font-black">{audienceSummary.linkedAccounts}</p><p className="text-[8px] uppercase">Cuentas</p></div><div className={`rounded-lg p-2 ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-800/50'}`}><p className="text-sm font-black">{audienceSummary.installsDetected}</p><p className="text-[8px] uppercase">Instaladas</p></div><div className={`rounded-lg p-2 ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-800/50'}`}><p className="text-sm font-black">{audienceSummary.configuredRosters}</p><p className="text-[8px] uppercase">Configuradas</p></div></div>
            </div>

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
              <h3 className="font-bold mb-4">Campañas</h3>
              {ads.length === 0 ? <p className={`text-xs ${textMuted}`}>Todavía no creaste campañas.</p> : (
                <div className="space-y-3">
                  {ads.map((ad) => {
                    const metrics = getCampaignSummary(ad.id, campaignMetrics);
                    return <div key={ad.id} className={`rounded-xl border p-4 ${ad.active ? 'border-emerald-500/30' : theme === 'light' ? 'border-slate-200 opacity-60' : 'border-slate-700 opacity-60'}`}>
                      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-bold truncate">{ad.title}</p><p className={`text-[10px] ${textMuted}`}>{ad.company} · {ad.location}</p><p className={`text-[10px] mt-1 ${textMuted}`}>{ad.startDate || 'Sin fecha'} — {ad.endDate || 'Sin fecha'}</p></div><span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${ad.active ? 'bg-emerald-500/15 text-emerald-500' : 'bg-slate-500/15 text-slate-500'}`}>{ad.active ? 'Activa' : 'Pausada'}</span></div>
                      <div className={`grid grid-cols-4 gap-1 mt-3 rounded-xl p-2 text-center ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-800/50'}`}><div><p className="text-xs font-black">{metrics.reach}</p><p className={`text-[8px] ${textMuted}`}>Alcance</p></div><div><p className="text-xs font-black">{metrics.impressions}</p><p className={`text-[8px] ${textMuted}`}>Vistas</p></div><div><p className="text-xs font-black">{metrics.clicks}</p><p className={`text-[8px] ${textMuted}`}>Clics</p></div><div><p className="text-xs font-black">{metrics.ctr.toFixed(1)}%</p><p className={`text-[8px] ${textMuted}`}>CTR</p></div></div>
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
