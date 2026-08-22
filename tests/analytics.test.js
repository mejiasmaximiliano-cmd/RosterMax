import test from 'node:test';
import assert from 'node:assert/strict';
import { getAudienceSummary, getCampaignSummary } from '../src/lib/analytics.js';

test('calcula audiencia activa sin mostrar identidades', () => {
  const now = new Date('2026-08-22T12:00:00Z');
  const summary = getAudienceSummary([
    { lastActiveAt: { seconds: Date.parse('2026-08-22T08:00:00Z') / 1000 }, accountType: 'google', installDetected: true, rosterConfigured: true },
    { lastActiveAt: { seconds: Date.parse('2026-08-17T08:00:00Z') / 1000 }, accountType: 'guest' },
  ], now);
  assert.deepEqual(summary, { measuredUsers: 2, activeDay: 1, activeWeek: 2, activeMonth: 2, linkedAccounts: 1, installsDetected: 1, configuredRosters: 1 });
});

test('calcula alcance, impresiones, clics y CTR de una campaña', () => {
  assert.deepEqual(getCampaignSummary('ad-1', [
    { campaignId: 'ad-1', views: 3, clicks: 1 },
    { campaignId: 'ad-1', views: 2, clicks: 0 },
    { campaignId: 'other', views: 100, clicks: 100 },
  ]), { reach: 2, impressions: 5, clicks: 1, ctr: 20 });
});
