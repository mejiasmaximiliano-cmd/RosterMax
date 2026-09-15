import test from 'node:test';
import assert from 'node:assert/strict';
import { findRestCoincidences, groupCoincidenceWindows } from '../src/lib/coincidences.js';

const ownRoster = { workDays: 2, restDays: 2, startDate: '2026-01-01' };

test('agrupa días consecutivos de franco compartido', () => {
  const results = findRestCoincidences('2026-01-01', ownRoster, [
    { id: 'ana', name: 'Ana', ...ownRoster },
  ], { horizonDays: 8 });

  assert.deepEqual(results.slice(0, 2), [
    { friendId: 'ana', friendName: 'Ana', startDate: '2026-01-03', endDate: '2026-01-04', days: 2 },
    { friendId: 'ana', friendName: 'Ana', startDate: '2026-01-07', endDate: '2026-01-08', days: 2 },
  ]);
});

test('omite compañeros sin un roster válido', () => {
  const results = findRestCoincidences('2026-01-01', ownRoster, [
    { id: 'bad', name: 'Sin datos', workDays: 0, restDays: 2, startDate: '' },
  ]);
  assert.deepEqual(results, []);
});

test('agrupa compañeros que coinciden durante las mismas fechas', () => {
  const grouped = groupCoincidenceWindows([
    { friendId: 'a', friendName: 'Ana', startDate: '2026-08-25', endDate: '2026-08-31', days: 7 },
    { friendId: 'b', friendName: 'Bruno', startDate: '2026-08-25', endDate: '2026-08-31', days: 7 },
  ]);
  assert.equal(grouped.length, 1);
  assert.deepEqual(grouped[0].friends.map((friend) => friend.name), ['Ana', 'Bruno']);
});

test('una carpeta médica propia o una ausencia privada de compañero no se ofrece como franco compartido', () => {
  const own = { ...ownRoster, exceptions: [{ type: 'medical', mode: 'rest', startDate: '2026-01-03', endDate: '2026-01-03' }] };
  const friend = { id: 'ana', name: 'Ana', ...ownRoster, exceptions: [{ type: 'unavailable', mode: 'rest', startDate: '2026-01-04', endDate: '2026-01-04' }] };
  assert.deepEqual(findRestCoincidences('2026-01-01', own, [friend], { horizonDays: 4 }), []);
});

test('agrupa todos los miembros de un equipo de veinte personas sin cortar una fecha a la mitad', () => {
  const friends = Array.from({ length: 20 }, (_, i) => ({ ...ownRoster, id: String(i), name: `Colega ${i}` }));
  const windows = findRestCoincidences('2026-01-01', ownRoster, friends, { horizonDays: 8, maxResults: 960 });
  assert.deepEqual(groupCoincidenceWindows(windows).map((window) => window.friends.length), [20, 20]);
});
