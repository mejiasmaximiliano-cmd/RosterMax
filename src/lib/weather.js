const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const CACHE_DURATION_MS = 30 * 60 * 1000;
const MAX_STALE_MS = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12 * 1000;

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
    observedAt: typeof data.observedAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(data.observedAt) ? data.observedAt : null,
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
