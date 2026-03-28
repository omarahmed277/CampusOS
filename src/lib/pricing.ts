
/**
 * Calculates workspace session price based on custom rounding rules:
 * - Rate: 10 EGP/hour
 * - Total time < 1h -> 10 EGP
 * - Remaining minutes <= 15m -> +0h
 * - Remaining minutes <= 37m -> +0.5h
 * - Remaining minutes > 37m -> +1h
 */
export function calculateSessionPrice(totalMinutes: number, ratePerHour: number = 10): number {
  if (totalMinutes <= 0) return 0;

  // Rule 1: Minimum 1 hour if less than 60 mins
  if (totalMinutes < 60) {
    return ratePerHour;
  }

  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  let extra = 0;

  if (remainingMinutes <= 15) {
    extra = 0;
  } else if (remainingMinutes <= 37) {
    extra = 0.5;
  } else {
    extra = 1;
  }

  return (hours + extra) * ratePerHour;
}
