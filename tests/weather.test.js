import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchCurrentWeather, fetchWeatherForecast, getWeatherDescription, getWeatherLocalParts, searchWeatherLocations } from '../src/lib/weather.js';

const NOW = Date.parse('2026-09-14T12:00:00Z');
const KEY = 'rostermax:weather:0.000:0.000';
const CACHE_DATA = { temp: 17, apparentTemp: 15, windSpeed: 23, windGusts: 35, weatherCode: 2, observedAt: '2026-09-14T09:00' };
const CURRENT = { temperature_2m: 21.6, apparent_temperature: 20.1, wind_speed_10m: 12.4, wind_gusts_10m: 22.7, weather_code: 1, time: '2026-09-14T12:00' };

function setup(t, payload = { current: CURRENT }) {
  const storage = new Map();
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
  } });
  t.after(() => {
    if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });
  t.mock.method(Date, 'now', () => NOW);
  const network = t.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200, json: async () => payload }));
  return { storage, network };
}

test('acepta coordenadas cero y devuelve sólo números finitos en el clima', async (t) => {
  const { storage, network } = setup(t);
  const result = await fetchCurrentWeather(0, 0);
  assert.equal(result.temp, 22);
  assert.equal(result.apparentTemp, 20);
  assert.equal(result.windSpeed, 12);
  assert.equal(result.windGusts, 23);
  assert.equal(result.cachedAt, NOW);
  assert.equal(result.stale, false);
  assert.equal(new URL(network.mock.calls[0].arguments[0]).searchParams.get('latitude'), '0');
  assert.equal(JSON.parse(storage.get(KEY)).data.temp, 22);
});

test('rechaza null, blancos, booleanos, infinito y coordenadas fuera de rango antes de consultar', async (t) => {
  const { network } = setup(t);
  for (const [lat, lon] of [[null, 0], [0, null], ['', 0], [' ', 0], [false, 0], [[], 0], [NaN, 0], [Infinity, 0], [91, 0], [-91, 0], [0, 181], [0, -181]]) {
    await assert.rejects(fetchCurrentWeather(lat, lon), /ubicación climática válida/);
  }
  assert.equal(network.mock.callCount(), 0);
  assert.equal((await fetchCurrentWeather('0', '-180')).temp, 22);
});

test('usa una caché fresca validada sin hacer otra petición', async (t) => {
  const { storage, network } = setup(t);
  storage.set(KEY, JSON.stringify({ cachedAt: NOW - 10 * 60000, data: CACHE_DATA }));
  const result = await fetchCurrentWeather(0, 0);
  assert.equal(result.temp, 17);
  assert.equal(result.cached, true);
  assert.equal(result.stale, false);
  assert.equal(network.mock.callCount(), 0);
});

test('si la red falla usa datos validados de hasta seis horas, marcados obsoletos', async (t) => {
  const { storage, network } = setup(t);
  storage.set(KEY, JSON.stringify({ cachedAt: NOW - 2 * 3600000, data: CACHE_DATA }));
  network.mock.mockImplementation(async () => { throw new Error('Sin red'); });
  const result = await fetchCurrentWeather(0, 0);
  assert.equal(result.temp, 17);
  assert.equal(result.cached, true);
  assert.equal(result.stale, true);
  assert.equal(result.cachedAt, NOW - 2 * 3600000);
});

test('no usa cachés corruptas, futuras o demasiado antiguas como clima actual ni respaldo', async (t) => {
  const { storage, network } = setup(t);
  network.mock.mockImplementation(async () => { throw new Error('Sin red'); });
  const records = [
    'JSON roto',
    JSON.stringify({ cachedAt: NOW + 1, data: CACHE_DATA }),
    JSON.stringify({ cachedAt: NOW - 6 * 3600000 - 1, data: CACHE_DATA }),
    JSON.stringify({ cachedAt: String(NOW), data: CACHE_DATA }),
    JSON.stringify({ cachedAt: NOW, data: { temp: null } }),
    JSON.stringify({ cachedAt: NOW, data: { temp: '17' } }),
    JSON.stringify({ cachedAt: NOW, data: { windSpeed: 23 } }),
  ];
  for (const record of records) {
    storage.set(KEY, record);
    await assert.rejects(fetchCurrentWeather(0, 0), /Sin red/);
  }
});

test('la temperatura faltante o no finita produce un error, nunca NaN°C o cero inventado', async (t) => {
  const { network } = setup(t);
  for (const temperature of [null, undefined, NaN, Infinity, '22']) {
    network.mock.mockImplementation(async () => ({ ok: true, json: async () => ({ current: { ...CURRENT, temperature_2m: temperature } }) }));
    await assert.rejects(fetchCurrentWeather(0, 0), /temperatura válida/);
  }
});

test('datos secundarios ausentes se muestran como no disponibles conservando temperatura válida', async (t) => {
  setup(t, { current: { ...CURRENT, apparent_temperature: null, wind_speed_10m: -1, wind_gusts_10m: Infinity, weather_code: '1', time: null } });
  const result = await fetchCurrentWeather(0, 0);
  assert.equal(result.temp, 22);
  assert.equal(result.apparentTemp, null);
  assert.equal(result.windSpeed, null);
  assert.equal(result.windGusts, null);
  assert.equal(result.weatherCode, null);
  assert.equal(result.observedAt, null);
});

test('un error HTTP o una respuesta inválida permite el respaldo obsoleto validado', async (t) => {
  const { storage, network } = setup(t);
  storage.set(KEY, JSON.stringify({ cachedAt: NOW - 3600000, data: CACHE_DATA }));
  network.mock.mockImplementation(async () => ({ ok: false, status: 503 }));
  assert.equal((await fetchCurrentWeather(0, 0)).stale, true);
  network.mock.mockImplementation(async () => ({ ok: true, json: async () => ({ current: {} }) }));
  assert.equal((await fetchCurrentWeather(0, 0)).temp, 17);
  storage.clear();
  await assert.rejects(fetchCurrentWeather(0, 0), /temperatura válida/);
});

test('falla el almacenamiento local pero el clima online continúa funcionando', async (t) => {
  setup(t);
  t.mock.method(globalThis.localStorage, 'getItem', () => { throw new Error('Storage bloqueado'); });
  t.mock.method(globalThis.localStorage, 'setItem', () => { throw new Error('Sin espacio'); });
  assert.equal((await fetchCurrentWeather(0, 0)).temp, 22);
});

test('cancela una consulta que se cuelga después de 12 segundos sin depender de la red', async (t) => {
  const { network } = setup(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  network.mock.mockImplementation((_url, options) => { signal = options.signal; return new Promise(() => {}); });
  const result = assert.rejects(fetchCurrentWeather(0, 0), /tardó demasiado/);
  t.mock.timers.tick(12000);
  await result;
  assert.equal(signal.aborted, true);
});

test('el timeout también cubre un cuerpo JSON que nunca termina de llegar', async (t) => {
  const { network } = setup(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let readingBody = false;
  network.mock.mockImplementation(async () => ({ ok: true, json: () => { readingBody = true; return new Promise(() => {}); } }));
  const result = assert.rejects(fetchCurrentWeather(0, 0), /tardó demasiado/);
  await Promise.resolve();
  assert.equal(readingBody, true);
  t.mock.timers.tick(12000);
  await result;
});

test('la búsqueda omite ubicaciones sin coordenadas válidas y conserva coordenada cero', async (t) => {
  const { network } = setup(t, { results: [
    { id: 1, name: 'Ciudad válida', latitude: 0, longitude: 0, admin1: 'Región', country: 'País', timezone: 'UTC' },
    { id: 2, name: 'Sin latitud', latitude: null, longitude: 4 },
    { id: 3, name: 'Fuera del mapa', latitude: 120, longitude: 4 },
    null,
  ] });
  assert.deepEqual(await searchWeatherLocations('a'), []);
  assert.equal(network.mock.callCount(), 0);
  const locations = await searchWeatherLocations('ciudad');
  assert.equal(locations.length, 1);
  assert.equal(locations[0].latitude, 0);
  assert.equal(locations[0].label, 'Ciudad válida, Región, País');
});

test('la búsqueda maneja resultados vacíos y errores de formato, con el mismo timeout', async (t) => {
  const { network } = setup(t, {});
  assert.deepEqual(await searchWeatherLocations('ciudad'), []);
  network.mock.mockImplementation(async () => ({ ok: true, json: async () => ({ results: 'inválido' }) }));
  await assert.rejects(searchWeatherLocations('ciudad'), /búsqueda de ubicaciones/);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  network.mock.mockImplementation(() => new Promise(() => {}));
  const result = assert.rejects(searchWeatherLocations('ciudad'), /tardó demasiado/);
  t.mock.timers.tick(12000);
  await result;
});

function forecastPayload() {
  const days = Array.from({ length: 7 }, (_, index) => `2026-09-${14 + index}`);
  const hours = days.flatMap((date) => [`${date}T00:00`, `${date}T09:00`, `${date}T12:00`, `${date}T18:00`]);
  return {
    timezone: 'America/Argentina/Buenos_Aires', utc_offset_seconds: -10800,
    current: { ...CURRENT, time: '2026-09-14T09:00' },
    daily: {
      time: days, temperature_2m_max: days.map(() => 24.8), temperature_2m_min: days.map(() => 8.2),
      weather_code: [1, 2, 61, 3, 45, 95, 0], precipitation_probability_max: [0, 20, 90, 30, 5, 75, 0],
      precipitation_sum: [0, 0.2, 12.7, 0, 0, 4.5, 0], wind_speed_10m_max: days.map(() => 22), wind_gusts_10m_max: days.map(() => 40),
    },
    hourly: {
      time: hours, temperature_2m: hours.map(() => 18.7), weather_code: hours.map(() => 2),
      precipitation_probability: hours.map(() => 10), precipitation: hours.map(() => 0.4),
      wind_speed_10m: hours.map(() => 17.4), wind_gusts_10m: hours.map(() => 28.2),
    },
  };
}

test('pronóstico solicita siete días en unidades explícitas y conserva lluvia decimal y horas del lugar', async (t) => {
  const { network } = setup(t, forecastPayload());
  const result = await fetchWeatherForecast(0, 0);
  const params = new URL(network.mock.calls[0].arguments[0]).searchParams;
  assert.equal(params.get('forecast_days'), '7');
  assert.equal(params.get('timezone'), 'auto');
  assert.equal(params.get('temperature_unit'), 'celsius');
  assert.equal(params.get('precipitation_unit'), 'mm');
  assert.equal(params.get('wind_speed_unit'), 'kmh');
  assert.equal(params.get('latitude'), '0');
  assert.equal(result.days.length, 7);
  assert.equal(result.days[0].tempMax, 25);
  assert.equal(result.days[0].precipitationProbability, 0);
  assert.equal(result.days[2].precipitation, 12.7);
  assert.equal(result.hours[0].time, '2026-09-14T00:00');
  assert.equal(result.hours[0].precipitation, 0.4);
  assert.equal(result.current.observedAt, '2026-09-14T09:00');
  assert.deepEqual(getWeatherLocalParts(result.cachedAt, result), { date: '2026-09-14', time: '09:00' });
});

test('pronóstico reutiliza caché fresca, actualiza al pedirlo y comparte la condición actual con API anterior', async (t) => {
  const { network } = setup(t, forecastPayload());
  await fetchWeatherForecast(0, 0);
  assert.equal((await fetchWeatherForecast(0, 0)).cached, true);
  assert.equal((await fetchCurrentWeather(0, 0)).temp, 22);
  assert.equal(network.mock.callCount(), 1);
  assert.equal((await fetchWeatherForecast(0, 0, { forceRefresh: true })).cached, false);
  assert.equal(network.mock.callCount(), 2);
});

test('pronóstico sin red usa respaldo de hasta seis horas y no altera su hora de consulta', async (t) => {
  const { network } = setup(t, forecastPayload());
  await fetchWeatherForecast(0, 0);
  Date.now.mock.mockImplementation(() => NOW + 2 * 3600000);
  network.mock.mockImplementation(async () => { throw new Error('Sin red'); });
  const saved = await fetchWeatherForecast(0, 0);
  assert.equal(saved.cached, true);
  assert.equal(saved.stale, true);
  assert.equal(saved.cachedAt, NOW);
  Date.now.mock.mockImplementation(() => NOW + 6 * 3600000 + 1);
  await assert.rejects(fetchWeatherForecast(0, 0), /Sin red/);
});

test('cambiar de día en el lugar fuerza actualización aunque la caché tenga menos de treinta minutos', async (t) => {
  const { network } = setup(t, forecastPayload());
  Date.now.mock.mockImplementation(() => Date.parse('2026-09-15T02:55:00Z'));
  await fetchWeatherForecast(0, 0);
  Date.now.mock.mockImplementation(() => Date.parse('2026-09-15T03:05:00Z'));
  await fetchWeatherForecast(0, 0);
  assert.equal(network.mock.callCount(), 2);
});

test('pronóstico rechaza coordenadas vacías y no presenta datos diarios malformados como válidos', async (t) => {
  const { network, storage } = setup(t, forecastPayload());
  await assert.rejects(fetchWeatherForecast(null, 0), /ubicación climática válida/);
  await assert.rejects(fetchWeatherForecast(0, ''), /ubicación climática válida/);
  assert.equal(network.mock.callCount(), 0);
  for (const daily of [undefined, {}, { time: ['2026-02-30'], temperature_2m_max: [20] }, { time: ['2026-09-14'], temperature_2m_max: [null], temperature_2m_min: ['18'] }]) {
    storage.clear();
    network.mock.mockImplementation(async () => ({ ok: true, json: async () => ({ ...forecastPayload(), daily }) }));
    await assert.rejects(fetchWeatherForecast(0, 0), /pronóstico extendido válido/);
  }
});

test('pronóstico marca variables faltantes o fuera de rango como no disponibles, nunca como cero', async (t) => {
  const payload = forecastPayload();
  payload.daily.precipitation_probability_max[1] = 150;
  payload.daily.precipitation_sum[1] = -1;
  payload.daily.wind_speed_10m_max[1] = null;
  payload.hourly.time[0] = '2026-09-14T30:15';
  payload.hourly.precipitation[1] = null;
  setup(t, payload);
  const result = await fetchWeatherForecast(0, 0);
  assert.equal(result.days[1].precipitationProbability, null);
  assert.equal(result.days[1].precipitation, null);
  assert.equal(result.days[1].windSpeed, null);
  assert.equal(result.hours.some((hour) => hour.time.includes('30:15')), false);
  assert.equal(result.hours[0].precipitation, null);
});

test('fecha y hora de consulta corresponden a la zona del clima, no a la zona del teléfono', () => {
  const instant = Date.parse('2026-09-14T02:30:00Z');
  assert.deepEqual(getWeatherLocalParts(instant, { timezone: 'America/Argentina/Buenos_Aires' }), { date: '2026-09-13', time: '23:30' });
  assert.deepEqual(getWeatherLocalParts(instant, { timezone: 'Asia/Tokyo' }), { date: '2026-09-14', time: '11:30' });
  assert.deepEqual(getWeatherLocalParts(instant, { timezone: 'Inválida', utcOffsetSeconds: 0 }), { date: '2026-09-14', time: '02:30' });
  assert.equal(getWeatherLocalParts(instant, {}), null);
});

test('pronóstico comparte solicitudes simultáneas para la misma ubicación', async (t) => {
  const { network } = setup(t, forecastPayload());
  const [first, second] = await Promise.all([fetchWeatherForecast(0, 0), fetchWeatherForecast(0, 0)]);
  assert.equal(network.mock.callCount(), 1);
  assert.deepEqual(first, second);
});

test('timeout del pronóstico cubre un cuerpo JSON congelado y aborta la solicitud', async (t) => {
  const { network } = setup(t, forecastPayload());
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  network.mock.mockImplementation(async (_url, options) => {
    signal = options.signal;
    return { ok: true, json: () => new Promise(() => {}) };
  });
  const result = assert.rejects(fetchWeatherForecast(0, 0), /tardó demasiado/);
  await Promise.resolve();
  t.mock.timers.tick(12000);
  await result;
  assert.equal(signal.aborted, true);
});

test('la descripción meteorológica no confunde cero con ausencia y reconoce tormentas fuertes', () => {
  assert.equal(getWeatherDescription(0), 'Despejado');
  assert.equal(getWeatherDescription(null), 'Sin descripción');
  assert.equal(getWeatherDescription(97), 'Tormenta fuerte');
});
