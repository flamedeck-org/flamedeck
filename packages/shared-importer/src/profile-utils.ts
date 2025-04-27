// packages/shared-importer/src/profile-utils.ts

// Define minimal interfaces needed for duration calculation
// Ensures we don't depend on client-specific complex types here.
interface MinimalProfile {
    getTotalWeight(): number;
    getWeightUnit(): 'nanoseconds' | 'microseconds' | 'milliseconds' | 'seconds' | 'bytes' | 'none' | string; // Add string for safety
}

interface MinimalProfileGroup {
    profiles: MinimalProfile[];
}

/**
 * Calculates the duration of a profile group in milliseconds.
 * Assumes the duration is determined by the first profile in the group.
 * Relies on the profile object having getTotalWeight and getWeightUnit methods.
 *
 * @param profileGroup An object conforming to MinimalProfileGroup.
 * @returns The duration in milliseconds, or null if the unit is not time-based or group is empty.
 */
export function getDurationMsFromProfileGroup(profileGroup: MinimalProfileGroup): number | null {
  if (!profileGroup || !profileGroup.profiles || profileGroup.profiles.length === 0) {
    return null; // Or handle this case as appropriate
  }

  // Use optional chaining for safer access
  const firstProfile = profileGroup.profiles[0];
  if (!firstProfile) {
      return null;
  }
  
  // Check if methods exist (basic runtime check for safety)
  if (typeof firstProfile.getTotalWeight !== 'function' || typeof firstProfile.getWeightUnit !== 'function') {
      console.error("Profile object missing required methods for duration calculation.");
      return null; 
  }

  const totalWeight = firstProfile.getTotalWeight();
  const weightUnit = firstProfile.getWeightUnit();
  let durationMs: number | null = null;

  switch (weightUnit) {
    case 'nanoseconds':
      durationMs = totalWeight / 1_000_000;
      break;
    case 'microseconds':
      durationMs = totalWeight / 1_000;
      break;
    case 'milliseconds':
      durationMs = totalWeight;
      break;
    case 'seconds':
      durationMs = totalWeight * 1_000;
      break;
    // If unit is 'bytes' or 'none', durationMs remains null
  }
  
  // Return rounded integer if duration is calculated, otherwise null
  return durationMs !== null ? Math.round(durationMs) : null;
} 