const DAY_IN_MS = 24 * 60 * 60 * 1000;

function parseDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [year, month, day] = value.split('-').map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) return null;

  return timestamp;
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

export function addDaysToDate(dateStr, amount) {
  const timestamp = parseDateOnly(dateStr);
  if (timestamp === null || !Number.isInteger(amount)) return null;
  return new Date(timestamp + amount * DAY_IN_MS).toISOString().slice(0, 10);
}

export function validateRosterConfig(config) {
  const workDays = Number(config?.workDays);
  const restDays = Number(config?.restDays);
  const startDate = parseDateOnly(config?.startDate);

  if (!Number.isInteger(workDays) || workDays < 1 || workDays > 365) {
    return { valid: false, error: 'Los días de trabajo deben estar entre 1 y 365.' };
  }

  if (!Number.isInteger(restDays) || restDays < 1 || restDays > 365) {
    return { valid: false, error: 'Los días de descanso deben estar entre 1 y 365.' };
  }

  if (startDate === null) {
    return { valid: false, error: 'Selecciona una fecha válida de inicio de ciclo.' };
  }

  return { valid: true, workDays, restDays, startDate };
}

export function getStatusForDate(dateStr, config) {
  const targetDate = parseDateOnly(dateStr);
  if (targetDate === null) return { error: 'Fecha inválida' };

  const validation = validateRosterConfig(config);
  if (!validation.valid) return { error: validation.error };

  const { workDays, restDays, startDate } = validation;
  const diffDays = Math.round((targetDate - startDate) / DAY_IN_MS);
  const cycleLength = workDays + restDays;
  const dayInCycle = positiveModulo(diffDays, cycleLength);
  const isWorking = dayInCycle < workDays;
  const actualDay = isWorking ? dayInCycle + 1 : dayInCycle - workDays + 1;
  const totalPhaseDays = isWorking ? workDays : restDays;
  const daysLeftInPhase = totalPhaseDays - actualDay + 1;

  return {
    isWorking,
    actualDay,
    totalPhaseDays,
    daysLeftInPhase,
    daysUntilTransition: daysLeftInPhase,
  };
}

export function getNextTransition(dateStr, config) {
  const status = getStatusForDate(dateStr, config);
  if (status.error) return status;

  return {
    date: addDaysToDate(dateStr, status.daysUntilTransition),
    daysUntil: status.daysUntilTransition,
    nextStatus: status.isWorking ? 'rest' : 'work',
  };
}
