export function getGoalProjection(goal) {
  const target = Number(goal?.target);
  const current = Number(goal?.current || 0);
  const monthlyPlan = Number(goal?.monthlyPlan || 0);

  if (!Number.isFinite(target) || target <= 0) return null;

  const remaining = Math.max(0, target - Math.max(0, current));
  const progress = Math.min(100, (Math.max(0, current) / target) * 100);
  const monthsRemaining = remaining === 0
    ? 0
    : monthlyPlan > 0 ? Math.ceil(remaining / monthlyPlan) : null;

  return { remaining, progress, monthsRemaining, monthlyPlan };
}
