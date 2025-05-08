import { differenceInDays, parseISO, format } from "date-fns";

// Define the structure of the return value for clarity
export type ExpirationStatus = {
  isExpiring: boolean;
  daysRemaining: number | null;
  expirationDate: Date | null;
  formattedExpirationDate: string | null;
};

// Define the warning threshold
const EXPIRATION_WARNING_THRESHOLD_DAYS = 100;

/**
 * Calculates the expiration status of a trace based on its expiry date.
 * @param expiresAt - The ISO string representation of the expiration date, or null/undefined.
 * @returns An object containing flags and details about the expiration status.
 */
export function getExpirationStatus(expiresAt: string | null | undefined): ExpirationStatus {
  if (!expiresAt) {
    // No expiration date set for this trace
    return {
      isExpiring: false,
      daysRemaining: null,
      expirationDate: null,
      formattedExpirationDate: null,
    };
  }

  try {
    const expirationDateObj = parseISO(expiresAt);
    const now = new Date();
    // Ensure we only calculate remaining days for dates in the future
    const daysRemaining = differenceInDays(expirationDateObj, now);

    // Show warning if within threshold OR if date has passed (until deletion)
    const isExpiring = daysRemaining <= EXPIRATION_WARNING_THRESHOLD_DAYS;
    const formattedDate = format(expirationDateObj, "MMM d, yyyy"); // Example format

    return {
      isExpiring,
      // Only return positive days remaining or 0
      daysRemaining: Math.max(0, daysRemaining),
      expirationDate: expirationDateObj,
      formattedExpirationDate: formattedDate,
    };
  } catch (error) {
    console.error("Error parsing expiresAt date:", expiresAt, error);
    // Handle potential invalid date format
    return {
      isExpiring: false, // Treat as non-expiring if date is invalid
      daysRemaining: null,
      expirationDate: null,
      formattedExpirationDate: null,
    };
  }
}
