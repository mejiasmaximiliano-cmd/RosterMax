import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { APP_ID, appEnvironment, db } from './firebase';

function useProtectedSnapshot(enabled, name, single = false) {
  const [value, setValue] = useState({ rows: null, state: 'loading', updatedAt: null });
  useEffect(() => {
    if (!enabled) return undefined;
    const ref = single ? doc(db, 'artifacts', APP_ID, 'admin_stats', name) : collection(db, 'artifacts', APP_ID, 'public', 'data', name);
    return onSnapshot(ref, { includeMetadataChanges: true }, (snapshot) => {
      if (snapshot.metadata.fromCache) { setValue((v) => ({ ...v, state: v.updatedAt ? 'stale' : 'loading' })); return; }
      const rows = single ? (snapshot.exists() ? snapshot.data() : null) : snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (single && rows && rows.projectId !== appEnvironment.projectId) { setValue((v) => ({ ...v, state: 'error' })); return; }
      setValue({ rows, state: 'ready', updatedAt: new Date() });
    }, () => setValue((v) => ({ ...v, state: 'error' })));
  }, [enabled, name, single]);
  return value;
}
export function useCeoData(enabled) {
  const activity = useProtectedSnapshot(enabled, 'activity');
  const campaigns = useProtectedSnapshot(enabled, 'campaign_metrics');
  const accounts = useProtectedSnapshot(enabled, 'accounts', true);
  return { activityMetrics: activity.rows || [], activityState: activity.state, activityUpdatedAt: activity.updatedAt,
    campaignMetrics: campaigns.rows || [], campaignState: campaigns.state, campaignUpdatedAt: campaigns.updatedAt,
    census: accounts.rows, censusState: accounts.state };
}
