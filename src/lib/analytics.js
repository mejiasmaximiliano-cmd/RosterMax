const DAY_IN_MS = 86400000;

function timestampMillis(value) {
  if (!value || typeof value.seconds !== 'number' || !Number.isFinite(value.seconds)) return null;
  const milliseconds = value.seconds * 1000;
  return milliseconds > 0 ? milliseconds : null;
}

function nonNegativeCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

/**
 * Voluntary, pseudonymous activity: documents are associated with Firebase UIDs.
 * The dashboard reports a sample, not total users, downloads or unique people.
 * Rolling windows exclude future or malformed timestamps from old clients.
 */
export function getAudienceSummary(activityDocs, now = new Date()) {
  const nowMs = now.getTime();
  const within = (timestamp, days) => {
    const activeMs = timestampMillis(timestamp);
    return activeMs !== null && activeMs <= nowMs && nowMs - activeMs <= days * DAY_IN_MS;
  };
  const docs = Array.isArray(activityDocs) ? activityDocs.filter((item) => item && typeof item === 'object') : [];
  return {
    measuredUsers: docs.length,
    activeDay: docs.filter((item) => within(item.lastActiveAt, 1)).length,
    activeWeek: docs.filter((item) => within(item.lastActiveAt, 7)).length,
    activeMonth: docs.filter((item) => within(item.lastActiveAt, 30)).length,
    linkedAccounts: docs.filter((item) => item.accountType === 'google').length,
    installsDetected: docs.filter((item) => item.installDetected === true).length,
    configuredRosters: docs.filter((item) => item.rosterConfigured === true).length,
  };
}

/**
 * Client-reported campaign totals from consenting accounts. Reach counts accounts
 * with a recorded view; it is not audited human reach. CTR may exceed 100% when a
 * person clicks repeatedly; it is never clamped or presented as a conversion rate.
 */
export function getCampaignSummary(campaignId, metricDocs) {
  const docs = (Array.isArray(metricDocs) ? metricDocs : []).filter((item) => item?.campaignId === campaignId);
  const impressions = docs.reduce((total, item) => total + nonNegativeCount(item.views), 0);
  const clicks = docs.reduce((total, item) => total + nonNegativeCount(item.clicks), 0);
  return {
    reach: docs.filter((item) => nonNegativeCount(item.views) > 0).length,
    impressions,
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
  };
}
