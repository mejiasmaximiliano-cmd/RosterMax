const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function parseDateOnly(value) {
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

export const SCHEDULE_EXCEPTION_TYPES = {
  vacation: { label: 'Vacaciones', mode: 'rest' },
  medical: { label: 'Carpeta médica', mode: 'rest' },
  leave: { label: 'Licencia / permiso', mode: 'rest' },
  extra_work: { label: 'Trabajo extra', mode: 'work' },
  special_roster: { label: 'Roster especial', mode: 'cycle' },
};

export function validateScheduleException(input, existing = []) {
  const type = String(input?.type || '');
  const definition = SCHEDULE_EXCEPTION_TYPES[type];
  const startDate = String(input?.startDate || '');
  const endDate = String(input?.endDate || '');
  const label = String(input?.label || definition?.label || '').trim().slice(0, 60);

  if (!definition) return { valid: false, error: 'Selecciona un tipo de cambio válido.' };
  if (parseDateOnly(startDate) === null || parseDateOnly(endDate) === null || startDate > endDate) {
    return { valid: false, error: 'Revisa las fechas del cambio de roster.' };
  }

  const overlaps = (existing || []).some((item) => (
    item.id !== input?.id && startDate <= item.endDate && endDate >= item.startDate
  ));
  if (overlaps) return { valid: false, error: 'Ya existe otro cambio de roster en esas fechas.' };

  const result = { type, mode: definition.mode, label, startDate, endDate };
  if (definition.mode === 'cycle') {
    const special = validateRosterConfig({
      workDays: Number(input?.workDays),
      restDays: Number(input?.restDays),
      startDate: input?.cycleStartDate || startDate,
    });
    if (!special.valid) return special;
    result.workDays = special.workDays;
    result.restDays = special.restDays;
    result.cycleStartDate = String(input?.cycleStartDate || startDate);
  }

  return { valid: true, exception: result };
}

export function sanitizeSharedExceptions(exceptions) {
  return (exceptions || [])
    .filter((item) => SCHEDULE_EXCEPTION_TYPES[item?.type] && parseDateOnly(item.startDate) !== null && parseDateOnly(item.endDate) !== null)
    .slice(0, 30)
    .map((item) => {
      const shared = {
        type: item.type,
        mode: SCHEDULE_EXCEPTION_TYPES[item.type].mode,
        startDate: item.startDate,
        endDate: item.endDate,
      };
      if (shared.mode === 'cycle') {
        shared.workDays = Number(item.workDays);
        shared.restDays = Number(item.restDays);
        shared.cycleStartDate = item.cycleStartDate || item.startDate;
      }
      return shared;
    });
}

function getBaseStatus(targetDate, config) {
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

  return { isWorking, actualDay, totalPhaseDays, daysLeftInPhase, daysUntilTransition: daysLeftInPhase };
}

export function findScheduleException(dateStr, exceptions) {
  return (exceptions || []).find((item) => (
    parseDateOnly(item?.startDate) !== null
    && parseDateOnly(item?.endDate) !== null
    && item.startDate <= dateStr
    && item.endDate >= dateStr
  )) || null;
}

export function getStatusForDate(dateStr, config) {
  const targetDate = parseDateOnly(dateStr);
  if (targetDate === null) return { error: 'Fecha inválida' };

  const baseStatus = getBaseStatus(targetDate, config);
  if (baseStatus.error) return baseStatus;

  const exception = findScheduleException(dateStr, config?.exceptions);
  if (!exception) return baseStatus;

  if (exception.mode === 'cycle' || exception.type === 'special_roster') {
    const specialStatus = getBaseStatus(targetDate, {
      workDays: exception.workDays,
      restDays: exception.restDays,
      startDate: exception.cycleStartDate || exception.startDate,
    });
    if (specialStatus.error) return baseStatus;
    return { ...specialStatus, isOverride: true, exceptionType: exception.type, exceptionLabel: exception.label || 'Roster especial' };
  }

  const isWorking = exception.mode === 'work' || exception.type === 'extra_work';
  const startTimestamp = parseDateOnly(exception.startDate);
  const endTimestamp = parseDateOnly(exception.endDate);
  const actualDay = Math.round((targetDate - startTimestamp) / DAY_IN_MS) + 1;
  const totalPhaseDays = Math.round((endTimestamp - startTimestamp) / DAY_IN_MS) + 1;
  const daysLeftInPhase = totalPhaseDays - actualDay + 1;
  return {
    isWorking,
    actualDay,
    totalPhaseDays,
    daysLeftInPhase,
    daysUntilTransition: daysLeftInPhase,
    isOverride: true,
    exceptionType: exception.type,
    exceptionLabel: exception.label || SCHEDULE_EXCEPTION_TYPES[exception.type]?.label || 'Cambio temporal',
  };
}

export function getNextTransition(dateStr, config) {
  const status = getStatusForDate(dateStr, config);
  if (status.error) return status;

  for (let offset = 1; offset <= 732; offset += 1) {
    const nextDate = addDaysToDate(dateStr, offset);
    const nextStatus = getStatusForDate(nextDate, config);
    if (!nextStatus.error && nextStatus.isWorking !== status.isWorking) {
      return { date: nextDate, daysUntil: offset, nextStatus: nextStatus.isWorking ? 'work' : 'rest' };
    }
  }
  return { error: 'No se encontró el próximo cambio de roster.' };
}
