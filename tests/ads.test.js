import test from 'node:test';
import assert from 'node:assert/strict';
import { selectActiveCampaign, validateCampaign } from '../src/lib/ads.js';

test('valida fechas y enlaces seguros de campañas', () => {
  assert.equal(validateCampaign({ company: 'A', title: 'Oferta', location: 'Todos', url: 'http://example.com', startDate: '2026-08-01', endDate: '2026-08-10' }).valid, false);
  assert.equal(validateCampaign({ company: 'A', title: 'Oferta', location: 'Todos', url: 'https://example.com', startDate: '2026-08-10', endDate: '2026-08-01' }).valid, false);
  assert.equal(validateCampaign({ company: 'A', title: 'Oferta', location: 'Todos', url: 'https://example.com', startDate: '2026-08-01', endDate: '2026-08-10' }).valid, true);
});

test('elige una campaña vigente y compatible con la ubicación', () => {
  const campaigns = [
    { id: 'old', active: true, location: 'todos', startDate: '2026-07-01', endDate: '2026-07-31' },
    { id: 'local', active: true, location: 'neuquén', startDate: '2026-08-01', endDate: '2026-08-31' },
  ];
  assert.equal(selectActiveCampaign(campaigns, { location: 'Añelo', siteProvince: 'Neuquén' }, '2026-08-07').id, 'local');
});
