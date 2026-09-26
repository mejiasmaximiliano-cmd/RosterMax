const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const CACHE_DURATION_MS = 30 * 60 * 1000;
const MAX_STALE_MS = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12 * 1000;
const FORECAST_DAYS = 7;
const pendingForecasts = new Map();

const WEATHER_LABELS = {
  0: 'Despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nublado', 3: 'Nublado',
  45: 'Niebla', 48: 'Niebla con escarcha', 51: 'Llovizna leve', 53: 'Llovizna', 55: 'Llovizna intensa',
  56: 'Llovizna helada leve', 57: 'Llovizna helada intensa', 61: 'Lluvia leve', 63: 'Lluvia', 65: 'Lluvia intensa',
  66: 'Lluvia helada leve', 67: 'Lluvia helada intensa', 71: 'Nieve leve', 73: 'Nieve', 75: 'Nieve intensa',
  77: 'Nieve granulada', 80: 'Chaparrones leves', 81: 'Chaparrones', 82: 'Chaparrones fuertes',
  85: 'Chaparrones de nieve', 86: 'Chaparrones de nieve fuertes', 95: 'Tormenta', 96: 'Tormenta con granizo',
  97: 'Tormenta fuerte', 99: 'Tormenta con granizo fuerte',
};

export function getWeatherDescription(code) {
  return Number.isInteger(code) ? WEATHER_LABELS[code] || 'Sin descripción' : 'Sin descripción';
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function localWeatherTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value) || !validDate(value.slice(0, 10))) return null;
  return value;
}

function validTimezone(value) {
  if (typeof value !== 'string' || !value || value.length > 80) return null;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(0);
    return value;
  } catch { return null; }
}

function weatherTimezone(data) {
  return {
    timezone: validTimezone(data?.timezone),
    utcOffsetSeconds: Number.isInteger(data?.utcOffsetSeconds) && Math.abs(data.utcOffsetSeconds) <= 50400 ? data.utcOffsetSeconds : null,
  };
}

// Open-Meteo ISO timestamps are already local to the requested location.
// Convert only real instants (fetch time / now), never those date-only values.
export function getWeatherLocalParts(timestamp, timezoneData) {
  if (!Number.isFinite(timestamp)) return null;
  const { timezone, utcOffsetSeconds } = weatherTimezone(timezoneData);
  if (timezone) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(timestamp);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` };
  }
  if (utcOffsetSeconds !== null) {
    const iso = new Date(timestamp + utcOffsetSeconds * 1000).toISOString();
    return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
  }
  return null;
}

async function readJson(response) {
  if (!response.ok) throw new Error(`El servicio respondió con estado ${response.status}.`);
  return response.json();
}

async function fetchJson(url) {
  const controller = new AbortController();
  let timeout;
  const deadline = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new Error('El servicio del clima tardó demasiado. Vuelve a intentarlo.'));
    }, REQUEST_TIMEOUT_MS);
  });
  try {
    // Include JSON/body reading in the deadline, not just receiving headers.
    return await Promise.race([fetch(url, { signal: controller.signal }).then(readJson), deadline]);
  } catch (error) {
    if (controller.signal.aborted) throw new Error('El servicio del clima tardó demasiado. Vuelve a intentarlo.', { cause: error });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function coordinate(value, limit) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

function finiteNumber(value, { nonnegative = false } = {}) {
  return typeof value === 'number' && Number.isFinite(value) && (!nonnegative || value >= 0) ? Math.round(value) : null;
}

function normalizedWeather(data) {
  if (!data || typeof data !== 'object' || finiteNumber(data.temp) === null) return null;
  return {
    temp: finiteNumber(data.temp),
    apparentTemp: finiteNumber(data.apparentTemp),
    windSpeed: finiteNumber(data.windSpeed, { nonnegative: true }),
    windGusts: finiteNumber(data.windGusts, { nonnegative: true }),
    weatherCode: Number.isInteger(data.weatherCode) && data.weatherCode >= 0 && data.weatherCode <= 99 ? data.weatherCode : null,
    observedAt: localWeatherTime(data.observedAt),
    ...weatherTimezone(data),
  };
}

export async function searchWeatherLocations(query, countryCode = 'AR') {
  const value = String(query || '').trim();
  if (value.length < 2) return [];

  const params = new URLSearchParams({
    name: value,
    count: '5',
    language: 'es',
    format: 'json',
    countryCode,
  });
  const payload = await fetchJson(`${GEOCODING_URL}?${params}`);
  if (!payload || typeof payload !== 'object' || (payload.results !== undefined && !Array.isArray(payload.results))) {
    throw new Error('No se pudo leer la búsqueda de ubicaciones.');
  }

  return (payload.results || []).filter((item) => item && typeof item.name === 'string' && item.name.trim() && coordinate(item.latitude, 90) !== null && coordinate(item.longitude, 180) !== null).map((item) => ({
    id: item.id,
    name: item.name,
    label: [item.name, item.admin1, item.country].filter(Boolean).join(', '),
    latitude: coordinate(item.latitude, 90),
    longitude: coordinate(item.longitude, 180),
    timezone: typeof item.timezone === 'string' ? item.timezone : null,
  }));
}

function getCacheKey(latitude, longitude) {
  return `rostermax:weather:${Number(latitude).toFixed(3)}:${Number(longitude).toFixed(3)}`;
}

function readCachedWeather(latitude, longitude) {
  try {
    const raw = localStorage.getItem(getCacheKey(latitude, longitude));
    if (!raw) return null;
    const cached = JSON.parse(raw);
    const data = normalizedWeather(cached?.data);
    if (!data || typeof cached.cachedAt !== 'number' || !Number.isFinite(cached.cachedAt)) return null;
    const age = Date.now() - cached.cachedAt;
    if (age < 0 || age > MAX_STALE_MS) return null;
    return {
      data,
      cachedAt: cached.cachedAt,
      fresh: age <= CACHE_DURATION_MS,
    };
  } catch {
    return null;
  }
}

function cacheWeather(latitude, longitude, data, cachedAt) {
  try {
    localStorage.setItem(getCacheKey(latitude, longitude), JSON.stringify({ cachedAt, data }));
  } catch {
    // El clima continúa funcionando aunque el navegador no permita almacenamiento local.
  }
}

export async function fetchCurrentWeather(latitude, longitude) {
  const lat = coordinate(latitude, 90);
  const lon = coordinate(longitude, 180);
  if (lat === null || lon === null) {
    throw new Error('Configura una ubicación climática válida.');
  }

  const cached = readCachedWeather(lat, lon);
  if (cached?.fresh) return { ...cached.data, cachedAt: cached.cachedAt, cached: true, stale: false };

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m',
    timezone: 'auto',
  });
  try {
    const payload = await fetchJson(`${FORECAST_URL}?${params}`);
    if (!payload?.current) throw new Error('No hay datos climáticos para esta ubicación.');

    const data = normalizedWeather({
      temp: payload.current.temperature_2m,
      apparentTemp: payload.current.apparent_temperature,
      windSpeed: payload.current.wind_speed_10m,
      windGusts: payload.current.wind_gusts_10m,
      weatherCode: payload.current.weather_code,
      observedAt: payload.current.time,
      timezone: payload.timezone,
      utcOffsetSeconds: payload.utc_offset_seconds,
    });
    if (!data) throw new Error('El servicio no entregó una temperatura válida.');
    const cachedAt = Date.now();
    cacheWeather(lat, lon, data, cachedAt);
    return { ...data, cachedAt, cached: false, stale: false };
  } catch (error) {
    if (cached && Date.now() - cached.cachedAt <= MAX_STALE_MS) return { ...cached.data, cachedAt: cached.cachedAt, cached: true, stale: true };
    throw error;
  }
}

function decimalNumber(value, { probability = false } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (probability && value > 100)) return null;
  return probability ? Math.round(value) : Math.round(value * 10) / 10;
}

function weatherCode(value) {
  return Number.isInteger(value) && WEATHER_LABELS[value] ? value : null;
}

function normalizedForecast(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.days)) return null;
  const days = data.days.slice(0, FORECAST_DAYS).filter((day) => day && validDate(day.date)).map((day) => ({
    date: day.date, tempMax: finiteNumber(day.tempMax), tempMin: finiteNumber(day.tempMin),
    weatherCode: weatherCode(day.weatherCode), precipitationProbability: decimalNumber(day.precipitationProbability, { probability: true }),
    precipitation: decimalNumber(day.precipitation), windSpeed: finiteNumber(day.windSpeed, { nonnegative: true }),
    windGusts: finiteNumber(day.windGusts, { nonnegative: true }),
  })).filter((day) => day.tempMin !== null || day.tempMax !== null);
  if (!days.length) return null;
  const dates = new Set(days.map((day) => day.date));
  const hours = (Array.isArray(data.hours) ? data.hours : []).slice(0, FORECAST_DAYS * 25).filter((hour) => hour && localWeatherTime(hour.time) && dates.has(hour.time.slice(0, 10))).map((hour) => ({
    time: hour.time, temp: finiteNumber(hour.temp), weatherCode: weatherCode(hour.weatherCode),
    precipitationProbability: decimalNumber(hour.precipitationProbability, { probability: true }), precipitation: decimalNumber(hour.precipitation),
    windSpeed: finiteNumber(hour.windSpeed, { nonnegative: true }), windGusts: finiteNumber(hour.windGusts, { nonnegative: true }),
  }));
  return { current: normalizedWeather(data.current), days, hours, ...weatherTimezone(data) };
}

function forecastFromPayload(payload) {
  const timezone = { timezone: payload?.timezone, utcOffsetSeconds: payload?.utc_offset_seconds };
  const daily = payload?.daily || {};
  const hourly = payload?.hourly || {};
  const current = payload?.current;
  return normalizedForecast({
    ...timezone,
    current: current ? {
      temp: current.temperature_2m, apparentTemp: current.apparent_temperature, windSpeed: current.wind_speed_10m,
      windGusts: current.wind_gusts_10m, weatherCode: current.weather_code, observedAt: current.time, ...timezone,
    } : null,
    days: (Array.isArray(daily.time) ? daily.time : []).map((date, index) => ({
      date, tempMax: daily.temperature_2m_max?.[index], tempMin: daily.temperature_2m_min?.[index],
      weatherCode: daily.weather_code?.[index], precipitationProbability: daily.precipitation_probability_max?.[index],
      precipitation: daily.precipitation_sum?.[index], windSpeed: daily.wind_speed_10m_max?.[index], windGusts: daily.wind_gusts_10m_max?.[index],
    })),
    hours: (Array.isArray(hourly.time) ? hourly.time : []).map((time, index) => ({
      time, temp: hourly.temperature_2m?.[index], weatherCode: hourly.weather_code?.[index],
      precipitationProbability: hourly.precipitation_probability?.[index], precipitation: hourly.precipitation?.[index],
      windSpeed: hourly.wind_speed_10m?.[index], windGusts: hourly.wind_gusts_10m?.[index],
    })),
  });
}

function readCachedForecast(key) {
  try {
    const cached = JSON.parse(localStorage.getItem(key));
    const data = normalizedForecast(cached?.data);
    if (!data || !Number.isFinite(cached?.cachedAt)) return null;
    const age = Date.now() - cached.cachedAt;
    if (age < 0 || age > MAX_STALE_MS) return null;
    const local = getWeatherLocalParts(Date.now(), data);
    // A cache from yesterday may still help offline, but cannot masquerade as
    // today's complete seven-day forecast or skip the next network refresh.
    const coversToday = !local || data.days[0].date === local.date;
    return { data, cachedAt: cached.cachedAt, fresh: age <= CACHE_DURATION_MS && coversToday };
  } catch { return null; }
}

/** Seven-day forecast with local location times. No station observation or
 * model-run update timestamp is claimed by this API. See open-meteo.com/en/docs.
 */
export async function fetchWeatherForecast(latitude, longitude, { forceRefresh = false } = {}) {
  const lat = coordinate(latitude, 90);
  const lon = coordinate(longitude, 180);
  if (lat === null || lon === null) throw new Error('Configura una ubicación climática válida.');
  const key = `rostermax:forecast:v1:${lat.toFixed(3)}:${lon.toFixed(3)}`;
  const cached = readCachedForecast(key);
  if (cached?.fresh && !forceRefresh) return { ...cached.data, cachedAt: cached.cachedAt, cached: true, stale: false };
  if (pendingForecasts.has(key)) return pendingForecasts.get(key);
  const request = (async () => {
    const params = new URLSearchParams({
      latitude: String(lat), longitude: String(lon), timezone: 'auto', forecast_days: String(FORECAST_DAYS),
      temperature_unit: 'celsius', wind_speed_unit: 'kmh', precipitation_unit: 'mm',
      current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max',
      hourly: 'temperature_2m,weather_code,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m',
    });
    try {
      const data = forecastFromPayload(await fetchJson(`${FORECAST_URL}?${params}`));
      if (!data) throw new Error('No hay un pronóstico extendido válido para esta ubicación.');
      const cachedAt = Date.now();
      try { localStorage.setItem(key, JSON.stringify({ cachedAt, data })); } catch { /* Storage is optional. */ }
      if (data.current) cacheWeather(lat, lon, data.current, cachedAt);
      return { ...data, cachedAt, cached: false, stale: false };
    } catch (error) {
      if (cached && Date.now() - cached.cachedAt <= MAX_STALE_MS) return { ...cached.data, cachedAt: cached.cachedAt, cached: true, stale: true };
      throw error;
    } finally {
      pendingForecasts.delete(key);
    }
  })();
  pendingForecasts.set(key, request);
  return request;
}
