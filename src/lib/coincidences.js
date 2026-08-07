import { addDaysToDate, getStatusForDate, validateRosterConfig } from './roster.js';

function closeWindow(windows, current, friend) {
  if (!current) return;
  windows.push({
    friendId: friend.id || friend.syncCode || friend.name,
    friendName: friend.name || 'Compañero',
    startDate: current.startDate,
    endDate: current.endDate,
    days: current.days,
  });
}

export function findRestCoincidences(startDate, ownConfig, friends, options = {}) {
  const horizonDays = Number.isInteger(options.horizonDays) ? options.horizonDays : 120;
  const maxResults = Number.isInteger(options.maxResults) ? options.maxResults : 8;

  if (!addDaysToDate(startDate, 0) || !validateRosterConfig(ownConfig).valid) return [];

  const windows = [];
  for (const friend of friends || []) {
    if (!validateRosterConfig(friend).valid) continue;

    let current = null;
    for (let offset = 0; offset < horizonDays; offset += 1) {
      const date = addDaysToDate(startDate, offset);
      const ownStatus = getStatusForDate(date, ownConfig);
      const friendStatus = getStatusForDate(date, friend);
      const coincide = !ownStatus.error && !friendStatus.error
        && !ownStatus.isWorking && !friendStatus.isWorking;

      if (coincide) {
        current = current
          ? { ...current, endDate: date, days: current.days + 1 }
          : { startDate: date, endDate: date, days: 1 };
      } else if (current) {
        closeWindow(windows, current, friend);
        current = null;
      }
    }
    closeWindow(windows, current, friend);
  }

  return windows
    .sort((left, right) => left.startDate.localeCompare(right.startDate) || right.days - left.days)
    .slice(0, maxResults);
}
