import { importProfileGroupFromText, importProfilesFromArrayBuffer, type ImporterDependencies } from '@trace-view-pilot/shared-importer';
import { exportProfileGroup } from '@trace-view-pilot/shared-importer';
import { ProfileGroup } from '@/lib/speedscope-core/profile';
import { ProfileType } from '@trace-view-pilot/shared-importer'; // Assuming ProfileType will be exported from index.ts
import * as pako from 'pako'; // Import pako for client-side use
import { JSON_parse } from 'uint8array-json-parser'; // Import parser for client-side use
import Long from 'long'; // Import Long for client-side

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
  profileType: ProfileType;
}

/**
 * Processes a raw trace file using Speedscope import/export functions.
 * Reads the file, attempts to parse it using the actual speedscope importers,
 * captures the detected profile type from the importer, calculates duration,
 * exports it to the standard Speedscope JSON format, and returns
 * a new File object ready for upload along with the duration and detected type.
 *
 * @param originalFile The raw trace file selected by the user.
 * @returns An object containing the processed File, the duration in ms, and the detected profile type.
 * @throws If the file cannot be read or parsed by Speedscope importers.
 */
export async function processAndPrepareTraceUpload(originalFile: File): Promise<ProcessedTraceData> {
  let importResult: { profileGroup: ProfileGroup | null; profileType: ProfileType } | null = null;
  
  // Create the dependencies object for the client environment
  const importerDeps: ImporterDependencies = {
    inflate: pako.inflate,
    parseJsonUint8Array: JSON_parse,
    isLong: Long.isLong
  };

  // Try importing via ArrayBuffer first
  try {
    const fileContent = await originalFile.arrayBuffer();
    // Pass the dependencies object
    importResult = await importProfilesFromArrayBuffer(originalFile.name, fileContent, importerDeps);
  } catch (e) {
    console.warn("Reading or importing as ArrayBuffer failed, will try text.", e);
    // Let it proceed to text import
  }

  // If ArrayBuffer import didn't succeed or wasn't attempted, try text import
  if (!importResult?.profileGroup) {
     console.log("Attempting import via text content.");
     try {
        const fileText = await originalFile.text();
        // Pass the dependencies object
        const textImportResult = await importProfileGroupFromText(originalFile.name, fileText, importerDeps);
        // Only use text result if it successfully found a profile group
        if (textImportResult?.profileGroup) {
            importResult = textImportResult;
        } else if (!importResult) {
            // If binary also failed, set a default failure state
             importResult = { profileGroup: null, profileType: 'unknown' };
        }
     } catch(e) {
         console.error("Importing as text failed:", e);
         if (!importResult) {
             // If binary also failed, set a default failure state
             importResult = { profileGroup: null, profileType: 'unknown' };
         }
         // Potentially throw here if both fail definitively
         // throw new Error(`Failed to parse profile: Both binary and text import methods failed. Error: ${e instanceof Error ? e.message : String(e)}`);
     }
  }


  if (!importResult?.profileGroup) {
    // Throw error only if *both* methods failed to produce a profile group
    console.error("Failed to import profile group from file:", originalFile.name);
    throw new Error('Could not parse the profile file. The format might be unsupported or the file corrupted.');
  }

  const { profileGroup, profileType } = importResult;

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

  return { processedFile, durationMs, profileType }; // Return detected type from importer
} 