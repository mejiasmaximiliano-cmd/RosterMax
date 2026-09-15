import { addDaysToDate, getStatusForDate, isRestAvailable, validateRosterConfig } from './roster.js';

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
  const dates = Array.from({ length: Math.max(0, Math.min(732, horizonDays)) }, (_, offset) => addDaysToDate(startDate, offset));
  const ownRest = new Map(dates.map((date) => [date, isRestAvailable(getStatusForDate(date, ownConfig))]));
  for (const friend of friends || []) {
    if (!validateRosterConfig(friend).valid) continue;

    let current = null;
    for (const date of dates) {
      const friendStatus = getStatusForDate(date, friend);
      const coincide = ownRest.get(date) && isRestAvailable(friendStatus);

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

export function groupCoincidenceWindows(windows) {
  const groups = new Map();
  for (const window of windows || []) {
    const key = `${window.startDate}:${window.endDate}`;
    const current = groups.get(key) || {
      startDate: window.startDate,
      endDate: window.endDate,
      days: window.days,
      friends: [],
    };
    if (!current.friends.some((friend) => friend.id === window.friendId)) {
      current.friends.push({ id: window.friendId, name: window.friendName });
    }
    groups.set(key, current);
  }
  return Array.from(groups.values())
    .sort((left, right) => left.startDate.localeCompare(right.startDate) || right.friends.length - left.friends.length);
}
