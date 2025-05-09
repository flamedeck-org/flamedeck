import * as profileProto from './profile.proto.js';
import type { FrameInfo, Profile } from '../speedscope-core/profile.ts';
import { StackListProfileBuilder } from '../speedscope-core/profile.ts';
import { lastOf } from '../speedscope-core/lib-utils.ts';
import { TimeFormatter, ByteFormatter } from '../speedscope-core/value-formatters.ts';
import type { ImporterDependencies } from './importer-utils.ts';

const perftools = (profileProto as any).perftools;

interface SampleType {
  type: string;
  unit: string;
}

// Find the index of the SampleType which should be used as our default
function getSampleTypeIndex(profile: perftools.profiles.Profile): number {
  const dflt = profile.defaultSampleType;
  const sampleTypes = profile.sampleType;
  const fallback = sampleTypes.length - 1;

  // string_table[0] will always be empty-string, so we can assume dflt === 0 is just the proto
  // empty-value, and means no defaultSampleType was specified.
  if (!dflt || !+dflt) {
    return fallback;
  }

  const idx = sampleTypes.findIndex((e) => e.type === dflt);
  if (idx === -1) {
    return fallback;
  }
  return idx;
}

export function importAsPprofProfile(
  rawProfile: ArrayBuffer,
  deps: Pick<ImporterDependencies, 'isLong'>
): Profile | null {
  if (rawProfile.byteLength === 0) return null;

  let protoProfile: perftools.profiles.Profile;
  try {
    protoProfile = perftools.profiles.Profile.decode(new Uint8Array(rawProfile));
  } catch (e) {
    return null;
  }

  function i32(n: number | { toNumber(): number }): number {
    if (deps.isLong(n)) {
      return n.toNumber();
    }
    return n as number;
  }

  function stringVal(key: number | { toNumber(): number }): string | null {
    return protoProfile.stringTable[i32(key)] || null;
  }

  const frameInfoByFunctionID = new Map<number, FrameInfo>();

  function frameInfoForFunction(f: perftools.profiles.IFunction): FrameInfo | null {
    const { name, filename, startLine } = f;

    const nameString = (name != null && stringVal(name)) || '(unknown)';
    const fileNameString = filename != null ? stringVal(filename) : null;
    const line = startLine != null ? +startLine : null;

    const key = `${nameString}:${fileNameString}:${line}`;

    const frameInfo: FrameInfo = {
      key,
      name: nameString,
    };

    if (fileNameString != null) {
      frameInfo.file = fileNameString;
    }

    if (line != null) {
      frameInfo.line = line;
    }

    return frameInfo;
  }

  for (const f of protoProfile.function) {
    if (f.id) {
      const frameInfo = frameInfoForFunction(f);
      if (frameInfo != null) {
        frameInfoByFunctionID.set(i32(f.id), frameInfo);
      }
    }
  }

  function frameInfoForLocation(location: perftools.profiles.ILocation): FrameInfo | null {
    const { line } = location;
    if (line == null || line.length === 0) return null;

    // From a comment on profile.proto:
    //
    //   Multiple line indicates this location has inlined functions,
    //   where the last entry represents the caller into which the
    //   preceding entries were inlined.
    //
    //   E.g., if memcpy() is inlined into printf:
    //      line[0].function_name == "memcpy"
    //      line[1].function_name == "printf"
    //
    // Let's just take the last line then
    const lastLine = lastOf(line);
    if (lastLine == null) return null;

    if (lastLine.functionId != null && deps.isLong(lastLine.functionId)) {
      const funcFrame = frameInfoByFunctionID.get(i32(lastLine.functionId));

      const lineNumber = deps.isLong(lastLine.line) ? lastLine.line.toNumber() : lastLine.line;

      if (lineNumber != null && lineNumber > 0 && funcFrame != null) {
        funcFrame.line = lineNumber;
      }
      return funcFrame || null;
    } else {
      return null;
    }
  }

  const frameByLocationID = new Map<number, FrameInfo>();

  for (const l of protoProfile.location) {
    if (l.id != null) {
      const frameInfo = frameInfoForLocation(l);
      if (frameInfo) {
        frameByLocationID.set(i32(l.id), frameInfo);
      }
    }
  }

  const sampleTypes: SampleType[] = protoProfile.sampleType.map((type) => ({
    type: (type.type != null && stringVal(type.type)) || 'samples',
    unit: (type.unit != null && stringVal(type.unit)) || 'count',
  }));

  const sampleTypeIndex = getSampleTypeIndex(protoProfile);

  if (sampleTypeIndex < 0 || sampleTypeIndex >= sampleTypes.length) {
    return null;
  }

  const sampleType = sampleTypes[sampleTypeIndex];

  const profileBuilder = new StackListProfileBuilder();

  switch (sampleType.unit) {
    case 'nanoseconds':
    case 'microseconds':
    case 'milliseconds':
    case 'seconds':
      profileBuilder.setValueFormatter(new TimeFormatter(sampleType.unit));
      break;

    case 'bytes':
      profileBuilder.setValueFormatter(new ByteFormatter());
      break;
  }

  for (const s of protoProfile.sample) {
    const stack = s.locationId ? s.locationId.map((l) => frameByLocationID.get(i32(l))) : [];
    stack.reverse();

    if (s.value == null || s.value.length <= sampleTypeIndex) {
      return null;
    }

    const value = s.value[sampleTypeIndex];
    profileBuilder.appendSampleWithWeight(stack.filter((f) => f != null) as FrameInfo[], +value);
  }

  return profileBuilder.build();
}
