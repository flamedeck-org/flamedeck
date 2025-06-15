import type { ProfileType } from 'packages/speedscope-import/src';

// Function to get human-readable profile type name
export const getProfileTypeName = (profileType: ProfileType | string | undefined): string => {
  if (!profileType) return 'Unknown';

  const typeMap: Record<ProfileType | string, string> = {
    speedscope: 'Speedscope',
    pprof: 'pprof (Go/Protobuf)',
    'chrome-timeline': 'Chrome Timeline',
    'chrome-cpuprofile': 'Chrome CPU Profile',
    'chrome-cpuprofile-old': 'Chrome CPU Profile (Old)',
    'chrome-heap-profile': 'Chrome Heap Profile',
    stackprof: 'Stackprof (Ruby)',
    'instruments-deepcopy': 'Instruments Deep Copy (macOS)',
    'instruments-trace': 'Instruments Trace (macOS)',
    'linux-perf': 'Linux Perf',
    'collapsed-stack': 'Collapsed Stack',
    'v8-prof-log': 'V8 Log',
    firefox: 'Firefox Profile',
    safari: 'Safari Profile',
    haskell: 'Haskell GHC Profile',
    'trace-event': 'Trace Event',
    callgrind: 'Callgrind',
    papyrus: 'Papyrus (Skyrim)',
    unknown: 'Unknown',
  };

  return typeMap[profileType] || profileType; // Return mapped name or the original string if not in map
};
