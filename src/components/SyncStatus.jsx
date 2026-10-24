import { syncLabel } from '../lib/syncPresentation';
export default function SyncStatus({ pending, cached, offline, error }) {
  const label = syncLabel({pending,cached,offline,error});
  return <p role="status" className={`ux-sync ${error ? 'ux-sync-error' : pending || cached || offline ? 'ux-sync-pending' : ''}`}><span aria-hidden="true">{error ? '!' : pending || cached || offline ? '◷' : '✓'}</span><span>{label}</span></p>;
}
