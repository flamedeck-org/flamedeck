import {
  type Profile as PerfToolsIProfile,
  type Location as PerfToolsILocation,
  type Function as PerfToolsIFunction,
  type Long as PerfToolsILong,
  decodeProfile,
} from './profile.proto.ts';
import type { FrameInfo, Profile } from '@flamedeck/speedscope-core/profile.ts';
import { StackListProfileBuilder } from '@flamedeck/speedscope-core/profile.ts';
import { lastOf } from '@flamedeck/speedscope-core/lib-utils.ts';
import { TimeFormatter, ByteFormatter } from '@flamedeck/speedscope-core/value-formatters.ts';
import type { ImporterDependencies, LongType } from './importer-utils.ts';

interface SampleTypeSpec {
  type: string;
  unit: string;
}

// Helper to convert proto Long interface to Long class instance if needed
function toLongClass(
  val: number | PerfToolsILong | any | undefined | null,
  deps: Pick<ImporterDependencies, 'LongType'>
): any {
  const LongClass = deps.LongType;
  if (val == null) return LongClass.ZERO;
  if (LongClass.isLong(val)) return val;
  if (typeof val === 'number') return LongClass.fromNumber(val);
  if (typeof val === 'object' && 'low' in val && 'high' in val && 'unsigned' in val) {
    return new LongClass(val.low, val.high, val.unsigned);
  }
  if (typeof val === 'object' && typeof (val as any).toNumber === 'function') {
    return LongClass.fromNumber((val as any).toNumber());
  }
  console.warn('toLongClass received unexpected type:', typeof val, val);
  return LongClass.ZERO;
}

function getSampleTypeIndex(
  profile: PerfToolsIProfile,
  deps: Pick<ImporterDependencies, 'LongType'>
): number {
  const dfltProto = profile.default_sample_type;
  const sampleTypesProto = profile.sample_type || [];
  const fallback = sampleTypesProto.length > 0 ? sampleTypesProto.length - 1 : 0;

  if (!sampleTypesProto.length) return 0;

  if (!dfltProto) {
    return fallback;
  }
  const dfltLong = toLongClass(dfltProto, deps);
  if (dfltLong.isZero()) return fallback;

  const dfltTypeString = String(dfltLong.toNumber());

  const idx = sampleTypesProto.findIndex((e) => {
    if (e.type == null) return false;
    const typeLong = toLongClass(e.type, deps);
    return String(typeLong.toNumber()) === dfltTypeString;
  });

  if (idx === -1) {
    return fallback;
  }
  return idx;
}

export function importAsPprofProfile(
  rawProfile: ArrayBuffer,
  deps: Pick<ImporterDependencies, 'LongType'>
): Profile | null {
  if (rawProfile.byteLength === 0) return null;

  let protoProfile: PerfToolsIProfile;
  try {
    protoProfile = decodeProfile(new Uint8Array(rawProfile)) as PerfToolsIProfile;
  } catch (e) {
    console.error('Failed to decode pprof profile:', e);
    return null;
  }

  function i32(n: number | PerfToolsILong | any | undefined | null): number {
    return toLongClass(n, deps).toNumber();
  }

  function stringVal(key: number | PerfToolsILong | any | undefined | null): string | null {
    if (key == null) return null;
    const stringTable = protoProfile.string_table || [];
    const index = i32(key);
    return stringTable[index] || null;
  }

  const frameInfoByFunctionID = new Map<number, FrameInfo>();

  const functions = protoProfile.function || [];
  for (const f of functions) {
    if (f.id != null) {
      const frameInfo = frameInfoForFunction(f as PerfToolsIFunction, stringVal, i32);
      if (frameInfo != null) {
        frameInfoByFunctionID.set(i32(f.id), frameInfo);
      }
    }
  }

  function frameInfoForFunction(
    f: PerfToolsIFunction,
    getStringVal: typeof stringVal,
    getI32: typeof i32
  ): FrameInfo | null {
    const { name, filename, start_line } = f;

    const nameString = (name != null && getStringVal(name)) || '(unknown)';
    const fileNameString = filename != null ? getStringVal(filename) : null;
    const line = start_line != null ? getI32(start_line) : null;

    const key = `${nameString}:${fileNameString}:${line ?? 'unknown'}`;

    const frameInfo: FrameInfo = {
      key,
      name: nameString,
    };

    if (fileNameString != null) {
      frameInfo.file = fileNameString;
    }

    if (line != null && line > 0) {
      frameInfo.line = line;
    }

    return frameInfo;
  }

  function frameInfoForLocation(
    location: PerfToolsILocation,
    getStringVal: typeof stringVal,
    getI32: typeof i32
  ): FrameInfo | null {
    const { line: linesArray } = location;
    if (linesArray == null || linesArray.length === 0) return null;

    const lastLineProto = lastOf(linesArray);
    if (lastLineProto == null) return null;

    if (lastLineProto.function_id != null) {
      const funcId = getI32(lastLineProto.function_id);
      const funcFrame = frameInfoByFunctionID.get(funcId);

      const lineNumber = lastLineProto.line != null ? getI32(lastLineProto.line) : null;

      if (lineNumber != null && lineNumber > 0 && funcFrame != null) {
        return { ...funcFrame, line: lineNumber };
      }
      return funcFrame || null;
    } else {
      return null;
    }
  }

  const frameByLocationID = new Map<number, FrameInfo>();
  const locations = protoProfile.location || [];
  for (const l of locations) {
    if (l.id != null) {
      const frameInfo = frameInfoForLocation(l as PerfToolsILocation, stringVal, i32);
      if (frameInfo) {
        frameByLocationID.set(i32(l.id), frameInfo);
      }
    }
  }

  const sample_types_proto = protoProfile.sample_type || [];
  const resolvedSampleTypes: SampleTypeSpec[] = sample_types_proto.map((typeProto) => ({
    type: (typeProto.type != null && stringVal(typeProto.type)) || 'samples',
    unit: (typeProto.unit != null && stringVal(typeProto.unit)) || 'count',
  }));

  const currentSampleTypeIndex = getSampleTypeIndex(protoProfile, deps);

  if (
    currentSampleTypeIndex < 0 ||
    (resolvedSampleTypes.length > 0 && currentSampleTypeIndex >= resolvedSampleTypes.length)
  ) {
    if (resolvedSampleTypes.length === 0 && (protoProfile.sample || []).length > 0) {
      // continue if no types but samples exist, default to index 0 for values
    } else {
      console.warn('Invalid sample type index or no sample types.');
      return null;
    }
  }

  const currentSampleType =
    resolvedSampleTypes.length > 0
      ? resolvedSampleTypes[currentSampleTypeIndex]
      : { type: 'samples', unit: 'count' };

  const profileBuilder = new StackListProfileBuilder();

  switch (currentSampleType.unit) {
    case 'nanoseconds':
    case 'microseconds':
    case 'milliseconds':
    case 'seconds':
      profileBuilder.setValueFormatter(new TimeFormatter(currentSampleType.unit));
      break;
    case 'bytes':
      profileBuilder.setValueFormatter(new ByteFormatter());
      break;
  }
  const samples = protoProfile.sample || [];
  for (const s of samples) {
    const location_ids = s.location_id || [];
    const stack = location_ids.map((locId) => frameByLocationID.get(i32(locId)));
    stack.reverse();

    const values = s.value || [];
    const valueIndexToUse = resolvedSampleTypes.length > 0 ? currentSampleTypeIndex : 0;

    if (values.length <= valueIndexToUse) {
      continue;
    }

    const rawValue = values[valueIndexToUse];
    if (rawValue == null) continue;

    const numericValue = i32(rawValue);

    profileBuilder.appendSampleWithWeight(
      stack.filter((f) => f != null) as FrameInfo[],
      numericValue
    );
  }

  return profileBuilder.build();
}
