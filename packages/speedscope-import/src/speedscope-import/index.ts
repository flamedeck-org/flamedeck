import type { Profile, ProfileGroup } from '@flamedeck/speedscope-core/profile.ts';

import {
  importFromChromeCPUProfile,
  importFromChromeTimeline,
  isChromeTimeline,
  importFromOldV8CPUProfile,
  isChromeTimelineObject,
} from './chrome.ts';
import { importFromStackprof } from './stackprof.ts';
import { importFromInstrumentsDeepCopy, importFromInstrumentsTrace } from './instruments.ts';
import { importFromBGFlameGraph } from './bg-flamegraph.ts';
import { importFromFirefox } from './firefox.ts';
import { importSpeedscopeProfiles } from './file-format.ts';
import { importFromV8ProfLog } from './v8proflog.ts';
import { importFromLinuxPerf } from './linux-tools-perf.ts';
import { importFromHaskell } from './haskell.ts';
import { importFromSafari } from './safari.ts';
import type { ProfileDataSource, ImporterDependencies } from './importer-utils.ts';
import { TextProfileDataSource, MaybeCompressedDataReader } from './importer-utils.ts';
import { importAsPprofProfile } from './pprof.ts';
import { decodeBase64 } from './utils.ts';
import { importFromChromeHeapProfile } from './v8heapalloc.ts';
import { isTraceEventFormatted, importTraceEvents } from './trace-event.ts';
import { importFromCallgrind } from './callgrind.ts';
import { importFromPapyrus } from './papyrus.ts';

// Define the possible profile types - based on the import functions available
export type ProfileType =
  | 'speedscope'
  | 'pprof' // Protocol buffer format
  | 'chrome-timeline' // Includes "chrome.json" and "Trace-..." named files
  | 'chrome-cpuprofile' // nodes, samples, timeDeltas
  | 'chrome-cpuprofile-old' // head, samples, timestamps
  | 'chrome-heap-profile' // .heapprofile, head.selfSize
  | 'stackprof' // .stackprof.json
  | 'instruments-deepcopy' // .instruments.txt
  | 'instruments-trace' // Directory import
  | 'linux-perf' // perf script output
  | 'collapsed-stack' // .collapsedstack.txt, specific format
  | 'v8-prof-log' // .v8log.json
  | 'firefox' // Firefox profile format
  | 'safari' // Safari profile format
  | 'haskell' // Haskell GHC JSON profile
  | 'trace-event' // Generic trace event format
  | 'callgrind' // callgrind format
  | 'papyrus' // Papyrus log format
  | 'unknown'; // Default/fallback

// Interface for the return type of import functions
interface ImportResult {
  profileGroup: ProfileGroup | null;
  profileType: ProfileType;
}

export async function importProfileGroupFromText(
  fileName: string,
  contents: string,
  deps: ImporterDependencies
): Promise<ImportResult> {
  return await _importProfileGroup(new TextProfileDataSource(fileName, contents), deps);
}

export async function importProfileGroupFromBase64(
  fileName: string,
  b64contents: string,
  deps: ImporterDependencies
): Promise<ImportResult | null> {
  return await importProfileGroup(
    MaybeCompressedDataReader.fromArrayBuffer(fileName, decodeBase64(b64contents).buffer, deps),
    deps
  );
}

export async function importProfilesFromFile(
  file: File,
  deps: ImporterDependencies
): Promise<ImportResult | null> {
  return importProfileGroup(MaybeCompressedDataReader.fromFile(file, deps), deps);
}

export async function importProfilesFromArrayBuffer(
  fileName: string,
  buffer: ArrayBuffer,
  deps: ImporterDependencies
): Promise<ImportResult> {
  const dataSource = MaybeCompressedDataReader.fromArrayBuffer(fileName, buffer, deps);
  return await _importProfileGroup(dataSource, deps);
}

async function importProfileGroup(
  dataSource: ProfileDataSource,
  deps: ImporterDependencies
): Promise<ImportResult | null> {
  const fileName = await dataSource.name();

  const result = await _importProfileGroup(dataSource, deps);
  if (result && result.profileGroup) {
    if (!result.profileGroup.name) {
      result.profileGroup.name = fileName;
    }
    for (const profile of result.profileGroup.profiles) {
      if (profile && !profile.getName()) {
        profile.setName(fileName);
      }
    }
    return result;
  }
  return { profileGroup: null, profileType: result?.profileType ?? 'unknown' };
}

function toGroup(profile: Profile | null): ProfileGroup | null {
  if (!profile) return null;
  return { name: profile.getName(), indexToView: 0, profiles: [profile] };
}

async function _importProfileGroup(
  dataSource: ProfileDataSource,
  deps: ImporterDependencies
): Promise<ImportResult> {
  const fileName = await dataSource.name();
  let profileGroup: ProfileGroup | null = null;
  let profileType: ProfileType = 'unknown';

  // Try binary formats first
  try {
    const buffer = await dataSource.readAsArrayBuffer();
    const pprofProfile = importAsPprofProfile(buffer, deps);
    if (pprofProfile) {
      console.log('Importing as protobuf encoded pprof file');
      profileGroup = toGroup(pprofProfile);
      profileType = 'pprof';
      return { profileGroup, profileType };
    }
  } catch (e) {
    console.warn('Failed to read or parse as binary (pprof):', e);
  }

  let contents: any;
  try {
    contents = await dataSource.readAsText(deps);
  } catch (e) {
    console.error('Failed to read data source as text:', e);
    return { profileGroup: null, profileType: 'unknown' };
  }
  const firstChunk = contents.firstChunk ? contents.firstChunk() : contents.substring(0, 1024);

  // First pass: Check known file format names to infer the file type
  if (fileName.endsWith('.speedscope.json')) {
    profileType = 'speedscope';
    console.log(`Importing as ${profileType}`);
    try {
      profileGroup = importSpeedscopeProfiles(contents.parseAsJSON(deps));
    } catch (e) {
      console.error(e);
    }
  } else if (/Trace-\d{8}T\d{6}/.exec(fileName)) {
    profileType = 'chrome-timeline';
    console.log(`Importing as ${profileType} (Object)`);
    try {
      profileGroup = importFromChromeTimeline(contents.parseAsJSON(deps).traceEvents, fileName);
    } catch (e) {
      console.error(e);
    }
  } else if (fileName.endsWith('.chrome.json') || /Profile-\d{8}T\d{6}/.exec(fileName)) {
    profileType = 'chrome-timeline';
    console.log(`Importing as ${profileType}`);
    try {
      profileGroup = importFromChromeTimeline(contents.parseAsJSON(deps), fileName);
    } catch (e) {
      console.error(e);
    }
  } else if (fileName.endsWith('.stackprof.json')) {
    profileType = 'stackprof';
    console.log(`Importing as ${profileType}`);
    try {
      profileGroup = toGroup(importFromStackprof(contents.parseAsJSON(deps)));
    } catch (e) {
      console.error(e);
    }
  } else if (fileName.endsWith('.instruments.txt')) {
    profileType = 'instruments-deepcopy';
    console.log(`Importing as ${profileType}`);
    try {
      profileGroup = toGroup(importFromInstrumentsDeepCopy(contents));
    } catch (e) {
      console.error(e);
    }
  } else if (fileName.endsWith('.linux-perf.txt')) {
    profileType = 'linux-perf';
    console.log(`Importing as ${profileType}`);
    try {
      profileGroup = importFromLinuxPerf(contents);
    } catch (e) {
      console.error(e);
    }
  } else if (fileName.endsWith('.collapsedstack.txt') || fileName.endsWith('.folded')) {
    profileType = 'collapsed-stack';
    console.log(`Importing as ${profileType}`);
    try {
      profileGroup = toGroup(importFromBGFlameGraph(contents));
    } catch (e) {
      console.error(e);
    }
  } else if (fileName.endsWith('.v8log.json')) {
    profileType = 'v8-prof-log';
    console.log(`Importing as ${profileType}`);
    try {
      profileGroup = toGroup(importFromV8ProfLog(contents.parseAsJSON(deps)));
    } catch (e) {
      console.error(e);
    }
  } else if (fileName.endsWith('.heapprofile')) {
    profileType = 'chrome-heap-profile';
    console.log(`Importing as ${profileType}`);
    try {
      profileGroup = toGroup(importFromChromeHeapProfile(contents.parseAsJSON(deps)));
    } catch (e) {
      console.error(e);
    }
  } else if (fileName.endsWith('-recording.json')) {
    profileType = 'safari';
    console.log(`Importing as ${profileType}`);
    try {
      profileGroup = toGroup(importFromSafari(contents.parseAsJSON(deps)));
    } catch (e) {
      console.error(e);
    }
  } else if (fileName.startsWith('callgrind.')) {
    profileType = 'callgrind';
    console.log(`Importing as ${profileType}`);
    try {
      profileGroup = importFromCallgrind(contents, fileName);
    } catch (e) {
      console.error(e);
    }
  }

  // If found by filename, return
  if (profileGroup) return { profileGroup, profileType };

  // Second pass: Try to guess what file format it is based on structure
  let parsed: any;
  try {
    parsed = contents.parseAsJSON(deps);
  } catch (e) {}

  if (parsed) {
    if (parsed['$schema'] === 'https://www.speedscope.app/file-format-schema.json') {
      profileType = 'speedscope';
      console.log(`Importing as ${profileType}`);
      profileGroup = importSpeedscopeProfiles(parsed);
    } else if (parsed['systemHost'] && parsed['systemHost']['name'] == 'Firefox') {
      profileType = 'firefox';
      console.log(`Importing as ${profileType}`);
      profileGroup = toGroup(importFromFirefox(parsed));
    } else if (isChromeTimeline(parsed)) {
      profileType = 'chrome-timeline';
      console.log(`Importing as ${profileType}`);
      profileGroup = importFromChromeTimeline(parsed, fileName);
    } else if (isChromeTimelineObject(parsed)) {
      profileType = 'chrome-timeline';
      console.log(`Importing as ${profileType} (Object)`);
      profileGroup = importFromChromeTimeline(parsed.traceEvents, fileName);
    } else if ('nodes' in parsed && 'samples' in parsed && 'timeDeltas' in parsed) {
      profileType = 'chrome-cpuprofile';
      console.log(`Importing as ${profileType}`);
      profileGroup = toGroup(importFromChromeCPUProfile(parsed));
    } else if (isTraceEventFormatted(parsed)) {
      profileType = 'trace-event';
      console.log(`Importing as ${profileType}`);
      profileGroup = importTraceEvents(parsed);
    } else if ('head' in parsed && 'samples' in parsed && 'timestamps' in parsed) {
      profileType = 'chrome-cpuprofile-old';
      console.log(`Importing as ${profileType}`);
      profileGroup = toGroup(importFromOldV8CPUProfile(parsed));
    } else if ('mode' in parsed && 'frames' in parsed && 'raw_timestamp_deltas' in parsed) {
      profileType = 'stackprof';
      console.log(`Importing as ${profileType}`);
      profileGroup = toGroup(importFromStackprof(parsed));
    } else if ('code' in parsed && 'functions' in parsed && 'ticks' in parsed) {
      profileType = 'v8-prof-log';
      console.log(`Importing as ${profileType}`);
      profileGroup = toGroup(importFromV8ProfLog(parsed));
    } else if ('head' in parsed && 'selfSize' in parsed['head']) {
      profileType = 'chrome-heap-profile';
      console.log(`Importing as ${profileType}`);
      profileGroup = toGroup(importFromChromeHeapProfile(parsed));
    } else if ('rts_arguments' in parsed && 'initial_capabilities' in parsed) {
      profileType = 'haskell';
      console.log(`Importing as ${profileType}`);
      profileGroup = importFromHaskell(parsed);
    } else if ('recording' in parsed && 'sampleStackTraces' in parsed.recording) {
      profileType = 'safari';
      console.log(`Importing as ${profileType}`);
      profileGroup = toGroup(importFromSafari(parsed));
    }
  } else {
    // Format is not JSON, check text formats

    if (
      /^# callgrind format/.exec(firstChunk) ||
      (/^events:/m.exec(firstChunk) && /^fn=/m.exec(firstChunk))
    ) {
      profileType = 'callgrind';
      console.log(`Importing as ${profileType}`);
      profileGroup = importFromCallgrind(contents, fileName);
    } else if (/^[\w \t\(\)]*\tSymbol Name/.exec(firstChunk)) {
      profileType = 'instruments-deepcopy';
      console.log(`Importing as ${profileType}`);
      profileGroup = toGroup(importFromInstrumentsDeepCopy(contents));
    } else if (/^(Stack_|Script_|Obj_)\S+ log opened \(PC\)\n/.exec(firstChunk)) {
      profileType = 'papyrus';
      console.log(`Importing as ${profileType}`);
      profileGroup = toGroup(importFromPapyrus(contents));
    } else {
      const fromLinuxPerfGroup = importFromLinuxPerf(contents);
      if (fromLinuxPerfGroup) {
        profileType = 'linux-perf';
        console.log(`Importing as ${profileType}`);
        profileGroup = fromLinuxPerfGroup;
      } else {
        const fromBGFlameGraphProfile = importFromBGFlameGraph(contents);
        if (fromBGFlameGraphProfile) {
          profileType = 'collapsed-stack';
          console.log(`Importing as ${profileType}`);
          profileGroup = toGroup(fromBGFlameGraphProfile);
        }
      }
    }
  }

  // If still not identified, profileType remains 'unknown'
  if (!profileGroup) {
    console.warn(`Failed to identify profile format for ${fileName}`);
  }

  return { profileGroup, profileType };
}

export async function importFromFileSystemDirectoryEntry(
  entry: FileSystemDirectoryEntry,
  deps: ImporterDependencies
) {
  console.log('Importing as Instruments Trace Directory');
  return importFromInstrumentsTrace(entry, deps);
}
