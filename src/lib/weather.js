const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const CACHE_DURATION_MS = 30 * 60 * 1000;

async function readJson(response) {
  if (!response.ok) throw new Error(`El servicio respondió con estado ${response.status}.`);
  return response.json();
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
  const data = await fetch(`${GEOCODING_URL}?${params}`);
  const payload = await readJson(data);

  return (payload.results || []).map((item) => ({
    id: item.id,
    name: item.name,
    label: [item.name, item.admin1, item.country].filter(Boolean).join(', '),
    latitude: item.latitude,
    longitude: item.longitude,
    timezone: item.timezone,
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
    return {
      data: cached.data,
      fresh: Date.now() - cached.cachedAt <= CACHE_DURATION_MS,
    };
  } catch {
    return null;
  }
}

function cacheWeather(latitude, longitude, data) {
  try {
    localStorage.setItem(getCacheKey(latitude, longitude), JSON.stringify({ cachedAt: Date.now(), data }));
  } catch {
    // El clima continúa funcionando aunque el navegador no permita almacenamiento local.
  }
}

export async function fetchCurrentWeather(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('Configura una ubicación climática válida.');
  }

  const cached = readCachedWeather(lat, lon);
  if (cached?.fresh) return { ...cached.data, cached: true, stale: false };

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m',
    timezone: 'auto',
  });
  try {
    const response = await fetch(`${FORECAST_URL}?${params}`);
    const payload = await readJson(response);
    if (!payload.current) throw new Error('No hay datos climáticos para esta ubicación.');

    const result = {
      temp: Math.round(payload.current.temperature_2m),
      apparentTemp: Math.round(payload.current.apparent_temperature),
      windSpeed: Math.round(payload.current.wind_speed_10m),
      windGusts: Math.round(payload.current.wind_gusts_10m),
      weatherCode: payload.current.weather_code,
      observedAt: payload.current.time,
      cached: false,
      stale: false,
    };
    cacheWeather(lat, lon, result);
    return result;
  } catch (error) {
    if (cached) return { ...cached.data, cached: true, stale: true };
    throw error;
  }
}
