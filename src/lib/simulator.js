import { getCalendarDayLabel } from './calendar.js';

export function describeRosterDay(status) {
  if (!status || status.error) return { label: 'Sin diagrama disponible', detail: 'Configura o sincroniza el roster para calcular esta fecha.', progress: null };
  const day = Number(status.actualDay);
  const total = Number(status.totalPhaseDays);
  const valid = Number.isInteger(day) && Number.isInteger(total) && day >= 1 && total >= day;
  const phase = status.isWorking ? 'de trabajo'
    : ['medical', 'leave', 'unavailable'].includes(status.exceptionType) ? 'de ausencia'
      : status.exceptionType === 'vacation' ? 'de vacaciones' : 'de franco';
  return {
    label: getCalendarDayLabel(status),
    detail: valid ? `Día ${day} de ${total} ${phase}` : 'Día del ciclo no disponible',
    progress: valid ? Math.round(day / total * 100) : null,
  };
}
