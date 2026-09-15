import test from 'node:test';
import assert from 'node:assert/strict';
import { getAudienceSummary, getCampaignSummary } from '../src/lib/analytics.js';

test('calcula la muestra de audiencia con ventanas móviles sin devolver identidades', () => {
  const now = new Date('2026-08-22T12:00:00Z');
  const summary = getAudienceSummary([
    { lastActiveAt: { seconds: Date.parse('2026-08-22T08:00:00Z') / 1000 }, accountType: 'google', installDetected: true, rosterConfigured: true },
    { lastActiveAt: { seconds: Date.parse('2026-08-17T08:00:00Z') / 1000 }, accountType: 'guest' },
  ], now);
  assert.deepEqual(summary, { measuredUsers: 2, activeDay: 1, activeWeek: 2, activeMonth: 2, linkedAccounts: 1, installsDetected: 1, configuredRosters: 1 });
});

test('no cuenta actividad futura o corrupta dentro de las ventanas activas', () => {
  const now = new Date('2026-09-13T12:00:00Z');
  const seconds = now.getTime() / 1000;
  const summary = getAudienceSummary([
    { lastActiveAt: { seconds: seconds + 1 } },
    { lastActiveAt: { seconds: seconds - 86400 } },
    { lastActiveAt: { seconds: seconds - 7 * 86400 } },
    { lastActiveAt: { seconds: seconds - 30 * 86400 } },
    { lastActiveAt: { seconds: seconds - 30 * 86400 - 1 } },
    { lastActiveAt: { seconds: 'invalid' } },
    { lastActiveAt: { seconds: Infinity } },
    null,
  ], now);
  assert.equal(summary.measuredUsers, 7);
  assert.equal(summary.activeDay, 1);
  assert.equal(summary.activeWeek, 2);
  assert.equal(summary.activeMonth, 3);
});

test('calcula alcance, impresiones, clics y CTR de una campaña', () => {
  assert.deepEqual(getCampaignSummary('ad-1', [
    { campaignId: 'ad-1', views: 3, clicks: 1 },
    { campaignId: 'ad-1', views: 2, clicks: 0 },
    { campaignId: 'other', views: 100, clicks: 100 },
  ]), { reach: 2, impressions: 5, clicks: 1, ctr: 20 });
});

test('ignora contadores malformados sin convertirlos en impresiones ni contaminar sumas', () => {
  assert.deepEqual(getCampaignSummary('ad-1', [
    { campaignId: 'ad-1', views: 2, clicks: 1 },
    { campaignId: 'ad-1', views: -5, clicks: NaN },
    { campaignId: 'ad-1', views: Infinity, clicks: -1 },
    { campaignId: 'ad-1', views: '200', clicks: 1.5 },
    null,
  ]), { reach: 1, impressions: 2, clicks: 1, ctr: 50 });
});

test('no equipara clics con ventas y conserva CTR superior a 100 por clics repetidos', () => {
  assert.deepEqual(getCampaignSummary('ad-1', [
    { campaignId: 'ad-1', views: 1, clicks: 3 },
  ]), { reach: 1, impressions: 1, clicks: 3, ctr: 300 });
  assert.deepEqual(getCampaignSummary('ad-1', [{ campaignId: 'ad-1', views: 0, clicks: 1 }]), {
    reach: 0, impressions: 0, clicks: 1, ctr: 0,
  });
});
