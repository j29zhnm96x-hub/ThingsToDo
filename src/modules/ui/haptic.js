/**
 * Haptic feedback utility.
 * Uses the Vibration API where available (Android).
 * On iOS Safari, haptic feedback is not available for web apps,
 * but we provide a no-op fallback.
 */

const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;

/**
 * Trigger a light impact haptic feedback.
 * Short, subtle vibration for button taps.
 */
export function hapticLight() {
  if (canVibrate) {
    navigator.vibrate(10);
  }
}

/**
 * Trigger a medium impact haptic feedback.
 * For more significant interactions.
 */
export function hapticMedium() {
  if (canVibrate) {
    navigator.vibrate(20);
  }
}

/**
 * Trigger a selection changed haptic feedback.
 * Very short tap for selection changes.
 */
export function hapticSelection() {
  if (canVibrate) {
    navigator.vibrate(5);
  }
}
