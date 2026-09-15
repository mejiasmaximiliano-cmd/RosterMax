import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchCurrentWeather, searchWeatherLocations } from '../src/lib/weather.js';

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
