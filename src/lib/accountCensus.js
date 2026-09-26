const PROJECT_ID = 'rostermax-60242';
const DAY_MS = 86400000;
const ACCOUNT_FIELDS = 'users(providerUserInfo/providerId,disabled,createdAt,lastLoginAt,customAuth,emailLinkSignin),nextPageToken';
const COUNT_FIELDS = [
  'totalAccounts', 'registeredAccounts', 'guestAccounts', 'googleAccounts', 'disabledAccounts',
  'createdLast7Days', 'createdLast30Days', 'signInsLast24Hours', 'signInsLast7Days', 'signInsLast30Days',
];

function censusError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

export function summarizeAccountPage(users, now = new Date()) {
  const result = Object.fromEntries(COUNT_FIELDS.map((field) => [field, 0]));
  const nowMs = now.getTime();
  const within = (raw, days) => {
    const milliseconds = Number(raw);
    return Number.isFinite(milliseconds) && milliseconds > 0
      && milliseconds <= nowMs && nowMs - milliseconds <= days * DAY_MS;
  };
  for (const user of users) {
    if (!user || typeof user !== 'object' || Array.isArray(user)
      || (user.providerUserInfo !== undefined && !Array.isArray(user.providerUserInfo))) {
      throw censusError('census/invalid-response');
    }
    const providers = (user.providerUserInfo || []).map((provider) => provider?.providerId).filter(Boolean);
    const registered = providers.length > 0 || user.customAuth === true || user.emailLinkSignin === true;
    result.totalAccounts += 1;
    result[registered ? 'registeredAccounts' : 'guestAccounts'] += 1;
    if (providers.includes('google.com')) result.googleAccounts += 1;
    if (user.disabled === true) result.disabledAccounts += 1;
    if (within(user.createdAt, 7)) result.createdLast7Days += 1;
    if (within(user.createdAt, 30)) result.createdLast30Days += 1;
    if (within(user.lastLoginAt, 1)) result.signInsLast24Hours += 1;
    if (within(user.lastLoginAt, 7)) result.signInsLast7Days += 1;
    if (within(user.lastLoginAt, 30)) result.signInsLast30Days += 1;
  }
  return result;
}

/**
 * Admin-only Google OAuth access token stays in the caller's memory. The API
 * response explicitly excludes names, email addresses, UIDs and password data.
 * A failure, repeated pagination token or deadline rejects the entire census;
 * callers must retain the last completed snapshot instead of publishing zeros.
 * Account creation/login statistics are not app usage or install measurements.
 */
export async function fetchAccountCensus(accessToken, {
  fetchImpl = globalThis.fetch, now = new Date(), timeoutMs = 30000, maxPages = 1000, signal,
} = {}) {
  if (typeof accessToken !== 'string' || !accessToken) throw censusError('census/missing-token');
  if (!Number.isInteger(maxPages) || maxPages < 1 || !Number.isFinite(timeoutMs) || timeoutMs <= 0
    || !(now instanceof Date) || !Number.isFinite(now.getTime())) throw censusError('census/invalid-options');
  const controller = new AbortController();
  const aborted = () => controller.abort();
  let deadlineReached = false;
  const timeout = setTimeout(() => { deadlineReached = true; controller.abort(); }, timeoutMs);
  signal?.addEventListener('abort', aborted, { once: true });
  if (signal?.aborted) controller.abort();
  const totals = summarizeAccountPage([], now);
  const seenTokens = new Set();
  let nextPageToken;
  try {
    for (let page = 0; page < maxPages; page += 1) {
      if (controller.signal.aborted) throw censusError(deadlineReached ? 'census/timeout' : 'census/cancelled');
      const url = new URL(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:batchGet`);
      url.searchParams.set('maxResults', '1000');
      url.searchParams.set('fields', ACCOUNT_FIELDS);
      if (nextPageToken) url.searchParams.set('nextPageToken', nextPageToken);
      const response = await fetchImpl(url.toString(), {
        method: 'GET', headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
      });
      if (!response.ok) {
        if (response.status === 401) throw censusError('census/expired-token');
        if (response.status === 403) throw censusError('census/permission-denied');
        throw censusError('census/service-unavailable');
      }
      const data = await response.json();
      if (!data || typeof data !== 'object' || Array.isArray(data)
        || (data.users !== undefined && !Array.isArray(data.users))
        || (data.nextPageToken !== undefined && typeof data.nextPageToken !== 'string')) {
        throw censusError('census/invalid-response');
      }
      const counts = summarizeAccountPage(data.users || [], now);
      for (const field of COUNT_FIELDS) totals[field] += counts[field];
      nextPageToken = data.nextPageToken;
      if (!nextPageToken) {
        if (controller.signal.aborted) throw censusError(deadlineReached ? 'census/timeout' : 'census/cancelled');
        return { schemaVersion: 1, source: 'firebase-auth', projectId: PROJECT_ID, ...totals };
      }
      if (seenTokens.has(nextPageToken)) throw censusError('census/repeated-page');
      seenTokens.add(nextPageToken);
    }
    throw censusError('census/page-limit');
  } catch (error) {
    if (typeof error?.code === 'string' && error.code.startsWith('census/')) throw error;
    if (controller.signal.aborted) throw censusError(deadlineReached ? 'census/timeout' : 'census/cancelled');
    throw censusError('census/network-error');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', aborted);
  }
}
