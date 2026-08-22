export function getAudienceSummary(activityDocs, now = new Date()) {
  const nowMs = now.getTime();
  const within = (timestamp, days) => {
    const seconds = Number(timestamp?.seconds || 0);
    return seconds > 0 && nowMs - seconds * 1000 <= days * 86400000;
  };
  const docs = activityDocs || [];
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

export function getCampaignSummary(campaignId, metricDocs) {
  const docs = (metricDocs || []).filter((item) => item.campaignId === campaignId);
  const impressions = docs.reduce((total, item) => total + Math.max(0, Number(item.views || 0)), 0);
  const clicks = docs.reduce((total, item) => total + Math.max(0, Number(item.clicks || 0)), 0);
  return {
    reach: docs.filter((item) => Number(item.views || 0) > 0).length,
    impressions,
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
  };
}
