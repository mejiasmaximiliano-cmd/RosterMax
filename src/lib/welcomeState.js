export function welcomeState({ themeKnown, onboardingKnown, rosterSaved, profileStored, completed, rosterConfirmed, profileConfirmed, anonymous, legacyDismissed }) {
  const ready = Boolean(themeKnown && onboardingKnown && (rosterSaved || profileStored || completed || (rosterConfirmed && profileConfirmed)));
  return { ready, automatic: ready && anonymous === true && !rosterSaved && !profileStored && !completed && !legacyDismissed };
}
