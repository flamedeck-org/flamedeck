import { importProfileGroupFromText, importProfilesFromArrayBuffer } from '@/lib/speedscope-import';
import { exportProfileGroup } from '@/lib/speedscope-import/file-format';
import { ProfileGroup } from '@/lib/speedscope-core/profile';

/**
 * Calculates the duration of a profile group in milliseconds.
 * Assumes the duration is determined by the first profile in the group.
 *
 * @param profileGroup The ProfileGroup object.
 * @returns The duration in milliseconds, or null if the unit is not time-based.
 */
function getDurationMsFromProfileGroup(profileGroup: ProfileGroup): number | null {
  if (!profileGroup || profileGroup.profiles.length === 0) {
    return null; // Or handle this case as appropriate
  }

  const firstProfile = profileGroup.profiles[0];
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
  return durationMs;
}

interface ProcessedTraceData {
  processedFile: File;
  durationMs: number | null;
}

/**
 * Processes a raw trace file using Speedscope import/export functions.
 * Reads the file, attempts to parse it, calculates duration,
 * exports it to the standard Speedscope JSON format, and returns
 * a new File object ready for upload along with the duration.
 *
 * @param originalFile The raw trace file selected by the user.
 * @returns An object containing the processed File and the duration in ms.
 * @throws If the file cannot be read or parsed by Speedscope importers.
 */
export async function processAndPrepareTraceUpload(originalFile: File): Promise<ProcessedTraceData> {
  // 1. Read file content
  const fileContent = await originalFile.arrayBuffer(); // Read as ArrayBuffer first

  // 2. Attempt to import using Speedscope functions
  let profileGroup: ProfileGroup | null = null;
  try {
    // Try ArrayBuffer import first (handles binary formats like .perf)
    profileGroup = await importProfilesFromArrayBuffer(originalFile.name, fileContent);
  } catch (arrayBufferError) {
    // If ArrayBuffer fails, try reading as text and using text import
    console.warn("Importing as ArrayBuffer failed, trying as text:", arrayBufferError);
    try {
      const fileText = await originalFile.text();
      profileGroup = await importProfileGroupFromText(originalFile.name, fileText);
    } catch (textError) {
      console.error("Importing as text also failed:", textError);
      throw new Error(`Failed to parse profile: Neither binary nor text import succeeded. Original error: ${textError instanceof Error ? textError.message : String(textError)}`);
    }
  }

  if (!profileGroup || profileGroup.profiles.length === 0) {
    throw new Error('Could not parse the profile file. The format might be unsupported or the file corrupted.');
  }

  // 3. Extract duration using the helper function
  const durationMs = getDurationMsFromProfileGroup(profileGroup);

  // 4. Export the ProfileGroup to Speedscope JSON format
  const exportedProfile = exportProfileGroup(profileGroup);
  const jsonString = JSON.stringify(exportedProfile);

  // 5. Create a Blob from the JSON string
  const blob = new Blob([jsonString], { type: 'application/json' });

  // 6. Generate new filename
  const originalFilename = originalFile.name;
  const baseName = originalFilename.substring(0, originalFilename.lastIndexOf('.')) || originalFilename;
  const newFilename = `${baseName}.speedscope.json`;

  // 7. Create the final File object
  const processedFile = new File([blob], newFilename, { type: blob.type });

  return { processedFile, durationMs };
} 