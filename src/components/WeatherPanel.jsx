import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Droplets, MapPin, RefreshCw, Sun, Thermometer, Wind, X } from 'lucide-react';
import { fetchWeatherForecast, getWeatherDescription, getWeatherLocalParts } from '../lib/weather.js';

function WeatherIcon({ code, size = 22, className = '' }) {
  const Icon = code === 0 || code === 1 ? Sun : code === 2 ? CloudSun
    : [45, 48].includes(code) ? CloudFog : code >= 95 ? CloudLightning
      : [71, 73, 75, 77, 85, 86].includes(code) ? CloudSnow
        : [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code) ? CloudRain : Cloud;
  return <Icon size={size} className={className} aria-hidden="true"/>;
}

function shortDate(value, { weekday = true } = {}) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-AR', { ...(weekday ? { weekday: 'short' } : {}), day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
}

function metric(value, unit = '') {
  return value === null || value === undefined ? '—' : `${value}${unit}`;
}

function WeatherContent({ theme = 'dark', location = {}, onChangeLocation }) {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [requestCount, setRequestCount] = useState(0);
  const [referenceNow, setReferenceNow] = useState(() => Date.now());
  const triggerRef = useRef(null);
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  const titleId = useId();
  const light = theme === 'light';
  const name = location.name || location.label || 'Tu ubicación';
  const surface = light ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100';
  const muted = light ? 'text-slate-600' : 'text-slate-400';
  const secondary = light ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/70 border-slate-700';
  const current = forecast?.current;
  const localNow = getWeatherLocalParts(referenceNow, forecast);
  const days = (forecast?.days || []).filter((day) => !localNow || day.date >= localNow.date);
  const selected = days.find((day) => day.date === selectedDate) || days[0];
  const hours = (forecast?.hours || []).filter((hour) => hour.time.slice(0, 10) === selected?.date
    && (!localNow || selected?.date !== localNow.date || hour.time.slice(11, 13) >= localNow.time.slice(0, 2)));
  const fetched = getWeatherLocalParts(forecast?.cachedAt, forecast);
  const fetchedLabel = fetched ? `${shortDate(fetched.date, { weekday: false })}, ${fetched.time}` : null;
  const zoneLabel = forecast?.timezone ? forecast.timezone.replaceAll('_', ' ') : 'la ubicación seleccionada';

  useEffect(() => {
    let cancelled = false;
    fetchWeatherForecast(location.latitude, location.longitude, { forceRefresh: requestCount > 0 })
      .then((data) => {
        if (cancelled) return;
        setForecast(data);
        setError('');
        setReferenceNow(Date.now());
      })
      .catch((failure) => {
        if (cancelled) return;
        setError(failure?.message || 'No pudimos consultar el clima.');
        setForecast((previous) => previous && Date.now() - previous.cachedAt <= 6 * 3600000 ? { ...previous, cached: true, stale: true } : null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [location.latitude, location.longitude, requestCount]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const handleKeys = (event) => {
      if (event.key === 'Escape') { setOpen(false); return; }
      if (event.key !== 'Tab') return;
      const controls = [...(dialogRef.current?.querySelectorAll('button:not([disabled]), a[href], [tabindex="0"]') || [])];
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handleKeys);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeys);
      trigger?.focus();
    };
  }, [open]);

  const refresh = () => {
    if (loading) return;
    setLoading(true);
    setError('');
    setRequestCount((count) => count + 1);
    setReferenceNow(Date.now());
  };
  const showForecast = () => {
    setOpen(true);
    setReferenceNow(Date.now());
    if (forecast && Date.now() - forecast.cachedAt > 30 * 60000) refresh();
  };
  const changeLocation = () => { setOpen(false); onChangeLocation?.(); };

  return <>
    <button ref={triggerRef} type="button" onClick={showForecast} aria-haspopup="dialog" aria-expanded={open} aria-label={`Ver pronóstico de 7 días en ${name}`} className={`w-full min-h-36 rounded-2xl border p-4 flex flex-col justify-center items-center text-center shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${surface}`}>
      <WeatherIcon code={current?.weatherCode} size={25} className="text-amber-500 mb-2"/>
      <span className="text-2xl font-bold">{loading && !forecast ? '…' : current ? `${current.temp}°C` : 'Clima'}</span>
      <span className="text-xs font-bold mt-1 max-w-full truncate">{location.name || 'Sin ubicación'}</span>
      <span className={`text-[10px] mt-1 flex items-center gap-1 ${error || forecast?.stale ? 'text-amber-500' : muted}`}>{error ? 'No se pudo actualizar' : forecast?.stale ? 'Datos guardados' : current ? <><Wind size={10}/>{metric(current.windSpeed, ' km/h')}</> : 'Consulta el pronóstico'}</span>
      <span className="text-[10px] font-bold text-blue-500 mt-2 flex items-center">Ver 7 días <ChevronRight size={12}/></span>
    </button>
    {open && createPortal(
      <div className="fixed inset-0 z-[140] bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4" onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
        <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`w-full max-w-xl max-h-[92dvh] rounded-3xl border shadow-2xl overflow-hidden flex flex-col ${surface}`}>
          <header className={`shrink-0 flex justify-between gap-3 items-start border-b p-4 ${light ? 'border-slate-200' : 'border-slate-800'}`}>
            <div className="min-w-0"><h2 id={titleId} className="text-lg font-black">Tu pronóstico</h2><p className={`mt-1 text-xs leading-relaxed flex items-start gap-1.5 ${muted}`}><MapPin size={14} className="shrink-0 mt-0.5"/><span className="break-words">{location.label || name}</span></p></div>
            <button ref={closeRef} type="button" onClick={() => setOpen(false)} className="min-h-11 min-w-11 flex items-center justify-center rounded-xl hover:bg-slate-500/10" aria-label="Cerrar pronóstico"><X size={20}/></button>
          </header>
          <div className="overflow-y-auto overscroll-contain p-4 space-y-4">
            <div className="flex flex-wrap gap-2 justify-between items-center"><p className={`text-[11px] ${muted}`}>Hasta 7 días · horarios de {name}</p><div className="flex gap-2">{onChangeLocation && <button type="button" onClick={changeLocation} className={`min-h-11 px-3 rounded-xl border text-xs font-bold ${secondary}`}>Cambiar lugar</button>}<button type="button" onClick={refresh} disabled={loading} className={`min-h-11 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 ${secondary}`}><RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>{loading ? 'Cargando…' : 'Actualizar'}</button></div></div>
            {loading && !forecast && <p role="status" className={`py-8 text-center text-sm ${muted}`}>Consultando temperaturas, lluvia y viento…</p>}
            {error && <div role="alert" className={`rounded-xl p-3 text-sm ${light ? 'bg-amber-50 text-amber-900' : 'bg-amber-500/10 text-amber-200'}`}><p>{error}</p><button type="button" onClick={refresh} disabled={loading} className="min-h-11 font-bold underline">Reintentar</button></div>}
            {forecast?.stale && <div role="status" className={`rounded-xl p-3 text-xs leading-relaxed ${light ? 'bg-amber-50 text-amber-900' : 'bg-amber-500/10 text-amber-200'}`}>Mostramos datos guardados: no pudimos actualizar el pronóstico.{fetchedLabel && ` Última consulta: ${fetchedLabel} (hora de ${name}).`}</div>}
            {current && <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-950 to-slate-950 p-4 text-white"><div className="flex justify-between items-center gap-3"><div><p className="text-xs text-blue-200">Condición actual estimada</p><p className="text-4xl font-black mt-2">{current.temp}°</p><p className="text-sm mt-1">{getWeatherDescription(current.weatherCode)}</p></div><WeatherIcon code={current.weatherCode} size={47} className="text-blue-200"/></div><div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-blue-100"><span>Sensación {metric(current.apparentTemp, '°')}</span><span>Viento {metric(current.windSpeed, ' km/h')}</span><span>Ráfagas {metric(current.windGusts, ' km/h')}</span></div><p className="mt-3 text-[11px] text-blue-200">{current.observedAt ? `Dato de las ${current.observedAt.slice(11, 16)} del ${shortDate(current.observedAt.slice(0, 10), { weekday: false })} · hora de ${name}` : 'Hora del dato no informada por el proveedor'}</p></div>}
            {days.length > 0 && <>
              <div><h3 className="font-bold text-sm mb-2">Elige un día</h3><div className="flex overflow-x-auto gap-2 pb-2" role="group" aria-label="Días del pronóstico">{days.map((day) => <button key={day.date} type="button" onClick={() => setSelectedDate(day.date)} aria-pressed={selected?.date === day.date} aria-label={`${shortDate(day.date)}: ${getWeatherDescription(day.weatherCode)}, máxima ${metric(day.tempMax, ' grados')}, mínima ${metric(day.tempMin, ' grados')}`} className={`min-w-24 flex-shrink-0 rounded-2xl border px-3 py-3 flex flex-col items-center gap-2 text-xs ${selected?.date === day.date ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500' : secondary}`}><span className="capitalize font-bold">{day.date === localNow?.date ? 'Hoy' : shortDate(day.date).split(',')[0]}</span><span className={`text-[10px] ${muted}`}>{shortDate(day.date, { weekday: false })}</span><WeatherIcon code={day.weatherCode} size={23} className="text-blue-500"/><span className="font-black">{metric(day.tempMax, '°')} <span className={`font-normal ${muted}`}>{metric(day.tempMin, '°')}</span></span><span className={`flex items-center gap-1 ${muted}`}><Droplets size={11}/>{metric(day.precipitationProbability, '%')}</span></button>)}</div></div>
              {selected && <section aria-label={`Detalle del ${selected.date}`} className={`rounded-2xl border p-3 ${secondary}`}><h3 className="font-bold text-sm capitalize">{shortDate(selected.date)} · {getWeatherDescription(selected.weatherCode)}</h3><dl className="grid grid-cols-2 gap-3 mt-3 text-xs"><div><dt className={`flex items-center gap-1 ${muted}`}><Thermometer size={13}/>Máxima / mínima</dt><dd className="font-bold mt-1">{metric(selected.tempMax, '°')} / {metric(selected.tempMin, '°')}</dd></div><div><dt className={`flex items-center gap-1 ${muted}`}><Droplets size={13}/>Prob. de precipitación</dt><dd className="font-bold mt-1">{metric(selected.precipitationProbability, '%')}</dd></div><div><dt className={muted}>Precipitación total</dt><dd className="font-bold mt-1">{metric(selected.precipitation, ' mm')}</dd></div><div><dt className={muted}>Viento / ráfaga máxima</dt><dd className="font-bold mt-1">{metric(selected.windSpeed)} / {metric(selected.windGusts)} km/h</dd></div></dl></section>}
              <section aria-label="Pronóstico por hora"><h3 className="font-bold text-sm mb-2">Por hora {selected?.date === localNow?.date ? '· desde ahora' : ''}</h3>{hours.length ? <div className="flex overflow-x-auto gap-2 pb-2">{hours.map((hour, index) => <article key={`${hour.time}-${index}`} className={`min-w-28 flex-shrink-0 rounded-xl border p-3 text-center text-xs ${secondary}`}><p className="font-bold">{hour.time.slice(11, 16)}</p><WeatherIcon code={hour.weatherCode} size={22} className="mx-auto mt-2 text-blue-500"/><p className="text-lg font-black mt-1">{metric(hour.temp, '°')}</p><p className={`text-[10px] leading-snug max-w-28 mx-auto my-2 ${muted}`}>{getWeatherDescription(hour.weatherCode)}</p><p className="font-semibold text-blue-500">{metric(hour.precipitationProbability, '%')} · {metric(hour.precipitation, ' mm')}</p><p className={`mt-2 ${muted}`}>Viento {metric(hour.windSpeed, ' km/h')}</p><p className={`mt-1 text-[10px] ${muted}`}>Ráfagas {metric(hour.windGusts, ' km/h')}</p></article>)}</div> : <p className={`text-xs ${muted}`}>No hay detalle horario disponible para este período.</p>}</section>
              <p className={`text-[11px] leading-relaxed ${muted}`}>El porcentaje indica probabilidad de precipitación; los milímetros, la cantidad prevista. Las horas corresponden a {zoneLabel}.</p>
            </>}
            {forecast && <p className={`text-[11px] leading-relaxed ${muted}`}>{fetchedLabel ? `${forecast.cached ? 'Datos guardados · ' : ''}Consultado el ${fetchedLabel}, hora de ${name}.` : 'El proveedor no informó una zona horaria válida.'} La hora de consulta no es la hora de actualización del modelo.</p>}
            <p className={`text-[11px] leading-relaxed ${muted}`}>Fuente: <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">Open-Meteo</a>. Pronóstico basado en modelos meteorológicos; puede cambiar.</p>
          </div>
        </section>
      </div>, document.body,
    )}
  </>;
}

export default function WeatherPanel(props) {
  const locationKey = `${props.location?.latitude ?? 'none'}:${props.location?.longitude ?? 'none'}`;
  return <WeatherContent key={locationKey} {...props}/>;
}
