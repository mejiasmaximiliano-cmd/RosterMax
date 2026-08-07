function normalizeText(value) {
  return String(value || '').trim();
}

export function normalizeCampaign(input) {
  return {
    company: normalizeText(input.company).slice(0, 80),
    title: normalizeText(input.title).slice(0, 120),
    location: normalizeText(input.location).toLowerCase().slice(0, 80),
    cta: normalizeText(input.cta || 'Ver oferta').slice(0, 30),
    url: normalizeText(input.url).slice(0, 500),
    startDate: normalizeText(input.startDate),
    endDate: normalizeText(input.endDate),
  };
}

export function validateCampaign(input) {
  const campaign = normalizeCampaign(input);
  if (!campaign.company || !campaign.title || !campaign.location) {
    return { valid: false, error: 'Completa empresa, título y zona objetivo.' };
  }
  if (!/^https:\/\//i.test(campaign.url)) {
    return { valid: false, error: 'El enlace debe comenzar con https://.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(campaign.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(campaign.endDate)) {
    return { valid: false, error: 'Selecciona fechas válidas para la campaña.' };
  }
  if (campaign.startDate > campaign.endDate) {
    return { valid: false, error: 'La fecha de finalización debe ser posterior al inicio.' };
  }
  return { valid: true, campaign };
}

export function selectActiveCampaign(campaigns, profile, today) {
  const locations = [profile?.location, profile?.siteProvince, profile?.homeProvince]
    .map((value) => normalizeText(value).toLowerCase())
    .filter(Boolean);

  return (campaigns || [])
    .filter((campaign) => campaign.active === true)
    .filter((campaign) => !campaign.startDate || campaign.startDate <= today)
    .filter((campaign) => !campaign.endDate || campaign.endDate >= today)
    .filter((campaign) => campaign.location === 'todos' || locations.some((location) => location.includes(campaign.location)))
    .sort((left, right) => Number(right.updatedAt?.seconds || 0) - Number(left.updatedAt?.seconds || 0))[0] || null;
}
