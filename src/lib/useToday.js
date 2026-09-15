import { useEffect, useState } from 'react';
import { getLocalDate } from './roster';

export function useToday() {
  const [today, setToday] = useState(() => getLocalDate());
  useEffect(() => {
    const update = () => setToday(getLocalDate());
    const interval = setInterval(update, 30000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return today;
}
