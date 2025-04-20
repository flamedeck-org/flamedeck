import React, { useState, useEffect } from 'react';
import { 
  importProfilesFromArrayBuffer,
  importProfileGroupFromText 
} from '@/lib/speedscope-import'; // Import the main entry points
import { ProfileGroup } from '@/lib/speedscope-import/profile'; // Import the type

interface SpeedscopeViewerProps {
  traceData: string | ArrayBuffer; // Or the specific type expected after fetching
  fileName: string;
}

const SpeedscopeViewer: React.FC<SpeedscopeViewerProps> = ({ traceData, fileName }) => {
  const [profileGroup, setProfileGroup] = useState<ProfileGroup | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (traceData && fileName) {
      setProfileGroup(null);
      setError(null);

      const importerPromise = 
        traceData instanceof ArrayBuffer
          ? importProfilesFromArrayBuffer(fileName, traceData)
          : importProfileGroupFromText(fileName, traceData);

      importerPromise
        .then(loadedProfileGroup => {
          if (loadedProfileGroup && loadedProfileGroup.profiles.length > 0) {
             setProfileGroup(loadedProfileGroup);
          } else if (loadedProfileGroup) {
             setError('Could not parse the profile file. The format might be unsupported or the file corrupted.');
          }
        })
        .catch(err => {
          setError(`An error occurred during import: ${err instanceof Error ? err.message : String(err)}`);
        });
    }
  }, [traceData, fileName]);

  // Render logic based on profileGroup and error state
  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center p-4 border border-red-500 bg-red-100 text-red-700">
        <p>Error loading profile: {error}</p>
      </div>
    );
  }

  if (!profileGroup) {
    // Show loading state or initial placeholder if profileGroup is null and no error
    return (
      <div className="h-full w-full flex items-center justify-center p-4 border border-gray-300">
        <p>Parsing profile...</p> {/* Or a spinner */}
      </div>
    );
  }

  // TODO: Replace placeholder with actual Speedscope UI rendering
  // using the loaded profileGroup data.
  return (
    <div className="h-full w-full border border-green-500 p-2.5">
      <h2>Speedscope Viewer Placeholder (Loaded!)</h2>
      <p>Profile Name: {profileGroup.name}</p>
      <p>Number of Profiles: {profileGroup.profiles.length}</p>
      <p>Weight Unit: {profileGroup.profiles[0]?.getWeightUnit()}</p>
      {/* Placeholder for actual Speedscope UI (Toolbar, Flamegraph, etc.) */}
    </div>
  );
};

export default SpeedscopeViewer; 