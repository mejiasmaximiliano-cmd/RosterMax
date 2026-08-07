import { getNextTransition } from './roster.js';

export function getTransitionReminder(dateStr, config, leadDays = 1) {
  const transition = getNextTransition(dateStr, config);
  if (transition.error) return null;

  const safeLeadDays = Math.min(7, Math.max(1, Number(leadDays) || 1));
  if (transition.daysUntil > safeLeadDays) return null;

  const isGoingToRest = transition.nextStatus === 'rest';
  const timing = transition.daysUntil === 1 ? 'mañana' : `en ${transition.daysUntil} días`;
  return {
    id: `${transition.date}-${transition.nextStatus}`,
    date: transition.date,
    title: isGoingToRest ? `Tu franco comienza ${timing}` : `Tu subida es ${timing}`,
    body: isGoingToRest
      ? 'Revisa tus planes y pendientes para aprovechar el descanso.'
      : 'Revisa transporte, equipo y bitácora antes de volver al roster.',
  };
}
