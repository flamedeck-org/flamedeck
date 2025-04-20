import {Profile, ProfileGroup} from '../speedscope-core/profile'

import {
  importFromChromeCPUProfile,
  importFromChromeTimeline,
  isChromeTimeline,
  importFromOldV8CPUProfile,
  isChromeTimelineObject,
} from './chrome'
import {importFromStackprof} from './stackprof'
import {importFromInstrumentsDeepCopy, importFromInstrumentsTrace} from './instruments'
import {importFromBGFlameGraph} from './bg-flamegraph'
import {importFromFirefox} from './firefox'
import {importSpeedscopeProfiles} from './file-format'
import {importFromV8ProfLog} from './v8proflog'
import {importFromLinuxPerf} from './linux-tools-perf'
import {importFromHaskell} from './haskell'
import {importFromSafari} from './safari'
import {ProfileDataSource, TextProfileDataSource, MaybeCompressedDataReader} from './importer-utils'
import {importAsPprofProfile} from './pprof'
import {decodeBase64} from '../speedscope-core/lib-utils'
import {importFromChromeHeapProfile} from './v8heapalloc'
import {isTraceEventFormatted, importTraceEvents} from './trace-event'
import {importFromCallgrind} from './callgrind'
import {importFromPapyrus} from './papyrus'

export async function importProfileGroupFromText(
  fileName: string,
  contents: string,
): Promise<ProfileGroup | null> {
  return await importProfileGroup(new TextProfileDataSource(fileName, contents))
}

export async function importProfileGroupFromBase64(
  fileName: string,
  b64contents: string,
): Promise<ProfileGroup | null> {
  return await importProfileGroup(
    MaybeCompressedDataReader.fromArrayBuffer(fileName, decodeBase64(b64contents).buffer),
  )
}

export async function importProfilesFromArrayBuffer(
  fileName: string,
  buffer: ArrayBuffer,
): Promise<ProfileGroup | null> {
  return importProfileGroup(MaybeCompressedDataReader.fromArrayBuffer(fileName, buffer))
}

async function importProfileGroup(dataSource: ProfileDataSource): Promise<ProfileGroup | null> {
  const fileName = await dataSource.name()

  try {
    const profileGroup = await _importProfileGroup(dataSource)
    if (profileGroup) {
      if (!profileGroup.name) {
        profileGroup.name = fileName
      }
      for (const profile of profileGroup.profiles) {
        if (profile && !profile.getName()) {
          profile.setName(fileName)
        }
      }
      return profileGroup
    }
    return null
  } catch (e) {
    console.error(`Failed to import profile group from ${fileName}:`, e);
    return null; 
  }
}

function toGroup(profile: Profile | null): ProfileGroup | null {
  if (!profile) return null
  return {name: profile.getName(), indexToView: 0, profiles: [profile]}
}

async function _importProfileGroup(dataSource: ProfileDataSource): Promise<ProfileGroup | null> {
  const fileName = await dataSource.name()
  console.log(`[_importProfileGroup] Starting import for: ${fileName}`);

  const buffer = await dataSource.readAsArrayBuffer();
  console.log(`[_importProfileGroup] Read data source as ArrayBuffer (length: ${buffer.byteLength})`);

  // Temporarily disable pprof check if ArrayBuffer is empty but we expect text
  if (buffer.byteLength > 0) {
    try {
        const profile = importAsPprofProfile(buffer);
        if (profile) {
          console.log('[_importProfileGroup] Detected as protobuf encoded pprof file');
          return toGroup(profile);
        }
    } catch (pprofError) {
        console.warn('[_importProfileGroup] Pprof check failed (this might be expected):', pprofError);
    }
  }

  console.log(`[_importProfileGroup] Attempting to read data source as text`);
  const contents = await dataSource.readAsText();
  const firstChunk = contents.firstChunk().substring(0, 200); // Get first part for logging
  console.log(`[_importProfileGroup] Read data source as text (first chunk: ${firstChunk}... )`);

  // First pass: Check known file format names to infer the file type
  if (fileName.endsWith('.speedscope.json')) {
    console.log('[_importProfileGroup] Attempting import via filename: speedscope json file');
    return importSpeedscopeProfiles(contents.parseAsJSON() as FileFormat.File);
  } else if (/Trace-\d{8}T\d{6}/.exec(fileName)) {
    console.log('[_importProfileGroup] Attempting import via filename: Chrome Timeline Object');
    const parsed = contents.parseAsJSON() as { traceEvents?: unknown[] };
    if (!parsed || !Array.isArray(parsed.traceEvents)) {
        console.error('[_importProfileGroup] Failed to parse Chrome Timeline Object: traceEvents missing or not an array');
        return null;
    }
    return importFromChromeTimeline(parsed.traceEvents as any[], fileName); // Use any for now if TimelineEvent type causes issues
  } else if (fileName.endsWith('.chrome.json') || /Profile-\d{8}T\d{6}/.exec(fileName)) {
    console.log('[_importProfileGroup] Attempting import via filename: Chrome Timeline');
    const parsed = contents.parseAsJSON(); 
    return importFromChromeTimeline(parsed as TimelineEvent[], fileName);
  } else if (fileName.endsWith('.stackprof.json')) {
    console.log('Importing as stackprof profile');
    return toGroup(importFromStackprof(contents.parseAsJSON() as StackprofProfile));
  } else if (fileName.endsWith('.instruments.txt')) {
    console.log('Importing as Instruments.app deep copy');
    return toGroup(importFromInstrumentsDeepCopy(contents));
  } else if (fileName.endsWith('.linux-perf.txt')) {
    console.log('Importing as output of linux perf script')
    return importFromLinuxPerf(contents)
  } else if (fileName.endsWith('.collapsedstack.txt')) {
    console.log('Importing as collapsed stack format')
    return toGroup(importFromBGFlameGraph(contents))
  } else if (fileName.endsWith('.v8log.json')) {
    console.log('Importing as --prof-process v8 log');
    return toGroup(importFromV8ProfLog(contents.parseAsJSON() as V8LogProfile));
  } else if (fileName.endsWith('.heapprofile')) {
    console.log('Importing as Chrome Heap Profile');
    return toGroup(importFromChromeHeapProfile(contents.parseAsJSON() as HeapProfile));
  } else if (fileName.endsWith('-recording.json')) {
    console.log('Importing as Safari profile');
    return toGroup(importFromSafari(contents.parseAsJSON() as SafariProfile));
  } else if (fileName.startsWith('callgrind.')) {
    console.log('Importing as Callgrind profile');
    return importFromCallgrind(contents, fileName)
  } else {
      console.log('[_importProfileGroup] Filename did not match known patterns.');
  }

  // Second pass: Try to guess what file format it is based on structure
  console.log('[_importProfileGroup] Attempting import via content structure guessing.');
  let parsed: unknown;
  try {
    parsed = contents.parseAsJSON();
    console.log('[_importProfileGroup] Successfully parsed content as JSON for guessing.');
  } catch (e) {
    console.log('[_importProfileGroup] Failed to parse content as JSON. Trying non-JSON formats.', e);
    // Handle non-JSON formats below
    parsed = null; // Indicate parsing failed
  }

  if (parsed != null && typeof parsed === 'object') {
    // Add specific checks for Chrome formats first
    if ('nodes' in parsed && 'samples' in parsed && 'timeDeltas' in parsed) {
      console.log('[_importProfileGroup] Guessed format: Chrome CPU Profile');
      return toGroup(importFromChromeCPUProfile(parsed as CPUProfile));
    } else if (isChromeTimelineObject(parsed)) { // Check this before generic Timeline
      console.log('[_importProfileGroup] Guessed format: Chrome Timeline Object');
      return importFromChromeTimeline((parsed as { traceEvents: TimelineEvent[] }).traceEvents, fileName);
    } else if (isChromeTimeline(parsed)) {
      console.log('[_importProfileGroup] Guessed format: Chrome Timeline');
      return importFromChromeTimeline(parsed as TimelineEvent[], fileName);
    } else if (isTraceEventFormatted(parsed)) {
      console.log('Importing as Trace Event Format profile');
      return importTraceEvents(parsed as Trace);
    } else if ('head' in parsed && 'samples' in parsed && 'timestamps' in parsed) {
      console.log('Importing as Chrome CPU Profile (old format)');
      return toGroup(importFromOldV8CPUProfile(parsed as OldCPUProfile));
    } else if ('mode' in parsed && 'frames' in parsed && 'raw_timestamp_deltas' in parsed) {
      console.log('Importing as stackprof profile');
      return toGroup(importFromStackprof(parsed as StackprofProfile));
    } else if ('code' in parsed && 'functions' in parsed && 'ticks' in parsed) {
      console.log('Importing as --prof-process v8 log');
      return toGroup(importFromV8ProfLog(parsed as V8LogProfile));
    } else if ('head' in parsed && 'selfSize' in parsed.head) {
      console.log('Importing as Chrome Heap Profile');
      return toGroup(importFromChromeHeapProfile(parsed as HeapProfile));
    } else if ('rts_arguments' in parsed && 'initial_capabilities' in parsed) {
      console.log('Importing as Haskell GHC JSON Profile');
      return importFromHaskell(parsed as HaskellProfile);
    } else if ('recording' in parsed && typeof parsed.recording === 'object' && parsed.recording && 'sampleStackTraces' in parsed.recording) {
      console.log('Importing as Safari profile');
      return toGroup(importFromSafari(parsed as SafariProfile));
    } else {
         console.log('[_importProfileGroup] JSON structure did not match known profile types.');
    }

  } else if (!parsed) { // If JSON parsing failed earlier
    // Format is not JSON
    console.log('[_importProfileGroup] Trying non-JSON format detection.');
    const firstChunkContent = contents.firstChunk(); // Use already read chunk

    // If the first line is "# callgrind format", it's probably in Callgrind
    // Profile Format.
    if (
      /^# callgrind format/.exec(firstChunkContent) ||
      (/^events:/m.exec(firstChunkContent) && /^fn=/m.exec(firstChunkContent))
    ) {
      console.log('Importing as Callgrind profile')
      return importFromCallgrind(contents, fileName)
    }

    // If the first line contains "Symbol Name", preceded by a tab, it's probably
    // a deep copy from OS X Instruments.app
    if (/^[\w \t()]*\tSymbol Name/.exec(firstChunkContent)) {
      console.log('Importing as Instruments.app deep copy')
      return toGroup(importFromInstrumentsDeepCopy(contents))
    }

    if (/^(Stack_|Script_|Obj_)\S+ log opened \(PC\)\n/.exec(firstChunkContent)) {
      console.log('Importing as Papyrus profile')
      return toGroup(importFromPapyrus(contents))
    }

    const fromLinuxPerf = importFromLinuxPerf(contents)
    if (fromLinuxPerf) {
      console.log('Importing from linux perf script output')
      return fromLinuxPerf
    }

    const fromBGFlameGraph = importFromBGFlameGraph(contents)
    if (fromBGFlameGraph) {
      console.log('Importing as collapsed stack format')
      return toGroup(fromBGFlameGraph)
    }
  }

  console.log('[_importProfileGroup] Unrecognized format after all checks.');
  return null;
}
