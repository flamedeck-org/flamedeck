export interface Profile {
  sample_type?: ValueType[];
  sample?: Sample[];
  mapping?: Mapping[];
  location?: Location[];
  function?: Function[];
  string_table?: string[];
  drop_frames?: Long;
  keep_frames?: Long;
  time_nanos?: Long;
  duration_nanos?: Long;
  period_type?: ValueType;
  period?: Long;
  comment?: Long[];
  default_sample_type?: Long;
}

export function encodeProfile(message: Profile): Uint8Array {
  let bb = popByteBuffer();
  _encodeProfile(message, bb);
  return toUint8Array(bb);
}

function _encodeProfile(message: Profile, bb: ByteBuffer): void {
  // repeated ValueType sample_type = 1;
  let array$sample_type = message.sample_type;
  if (array$sample_type !== undefined) {
    for (let value of array$sample_type) {
      writeVarint32(bb, 10);
      let nested = popByteBuffer();
      _encodeValueType(value, nested);
      writeVarint32(bb, nested.limit);
      writeByteBuffer(bb, nested);
      pushByteBuffer(nested);
    }
  }

  // repeated Sample sample = 2;
  let array$sample = message.sample;
  if (array$sample !== undefined) {
    for (let value of array$sample) {
      writeVarint32(bb, 18);
      let nested = popByteBuffer();
      _encodeSample(value, nested);
      writeVarint32(bb, nested.limit);
      writeByteBuffer(bb, nested);
      pushByteBuffer(nested);
    }
  }

  // repeated Mapping mapping = 3;
  let array$mapping = message.mapping;
  if (array$mapping !== undefined) {
    for (let value of array$mapping) {
      writeVarint32(bb, 26);
      let nested = popByteBuffer();
      _encodeMapping(value, nested);
      writeVarint32(bb, nested.limit);
      writeByteBuffer(bb, nested);
      pushByteBuffer(nested);
    }
  }

  // repeated Location location = 4;
  let array$location = message.location;
  if (array$location !== undefined) {
    for (let value of array$location) {
      writeVarint32(bb, 34);
      let nested = popByteBuffer();
      _encodeLocation(value, nested);
      writeVarint32(bb, nested.limit);
      writeByteBuffer(bb, nested);
      pushByteBuffer(nested);
    }
  }

  // repeated Function function = 5;
  let array$function = message.function;
  if (array$function !== undefined) {
    for (let value of array$function) {
      writeVarint32(bb, 42);
      let nested = popByteBuffer();
      _encodeFunction(value, nested);
      writeVarint32(bb, nested.limit);
      writeByteBuffer(bb, nested);
      pushByteBuffer(nested);
    }
  }

  // repeated string string_table = 6;
  let array$string_table = message.string_table;
  if (array$string_table !== undefined) {
    for (let value of array$string_table) {
      writeVarint32(bb, 50);
      writeString(bb, value);
    }
  }

  // optional int64 drop_frames = 7;
  let $drop_frames = message.drop_frames;
  if ($drop_frames !== undefined) {
    writeVarint32(bb, 56);
    writeVarint64(bb, $drop_frames);
  }

  // optional int64 keep_frames = 8;
  let $keep_frames = message.keep_frames;
  if ($keep_frames !== undefined) {
    writeVarint32(bb, 64);
    writeVarint64(bb, $keep_frames);
  }

  // optional int64 time_nanos = 9;
  let $time_nanos = message.time_nanos;
  if ($time_nanos !== undefined) {
    writeVarint32(bb, 72);
    writeVarint64(bb, $time_nanos);
  }

  // optional int64 duration_nanos = 10;
  let $duration_nanos = message.duration_nanos;
  if ($duration_nanos !== undefined) {
    writeVarint32(bb, 80);
    writeVarint64(bb, $duration_nanos);
  }

  // optional ValueType period_type = 11;
  let $period_type = message.period_type;
  if ($period_type !== undefined) {
    writeVarint32(bb, 90);
    let nested = popByteBuffer();
    _encodeValueType($period_type, nested);
    writeVarint32(bb, nested.limit);
    writeByteBuffer(bb, nested);
    pushByteBuffer(nested);
  }

  // optional int64 period = 12;
  let $period = message.period;
  if ($period !== undefined) {
    writeVarint32(bb, 96);
    writeVarint64(bb, $period);
  }

  // repeated int64 comment = 13;
  let array$comment = message.comment;
  if (array$comment !== undefined) {
    let packed = popByteBuffer();
    for (let value of array$comment) {
      writeVarint64(packed, value);
    }
    writeVarint32(bb, 106);
    writeVarint32(bb, packed.offset);
    writeByteBuffer(bb, packed);
    pushByteBuffer(packed);
  }

  // optional int64 default_sample_type = 14;
  let $default_sample_type = message.default_sample_type;
  if ($default_sample_type !== undefined) {
    writeVarint32(bb, 112);
    writeVarint64(bb, $default_sample_type);
  }
}

export function decodeProfile(binary: Uint8Array): Profile {
  return _decodeProfile(wrapByteBuffer(binary));
}

function _decodeProfile(bb: ByteBuffer): Profile {
  let message: Profile = {} as any;

  end_of_message: while (!isAtEnd(bb)) {
    let tag = readVarint32(bb);

    switch (tag >>> 3) {
      case 0:
        break end_of_message;

      // repeated ValueType sample_type = 1;
      case 1: {
        let limit = pushTemporaryLength(bb);
        let values = message.sample_type || (message.sample_type = []);
        values.push(_decodeValueType(bb));
        bb.limit = limit;
        break;
      }

      // repeated Sample sample = 2;
      case 2: {
        let limit = pushTemporaryLength(bb);
        let values = message.sample || (message.sample = []);
        values.push(_decodeSample(bb));
        bb.limit = limit;
        break;
      }

      // repeated Mapping mapping = 3;
      case 3: {
        let limit = pushTemporaryLength(bb);
        let values = message.mapping || (message.mapping = []);
        values.push(_decodeMapping(bb));
        bb.limit = limit;
        break;
      }

      // repeated Location location = 4;
      case 4: {
        let limit = pushTemporaryLength(bb);
        let values = message.location || (message.location = []);
        values.push(_decodeLocation(bb));
        bb.limit = limit;
        break;
      }

      // repeated Function function = 5;
      case 5: {
        let limit = pushTemporaryLength(bb);
        let values = message.function || (message.function = []);
        values.push(_decodeFunction(bb));
        bb.limit = limit;
        break;
      }

      // repeated string string_table = 6;
      case 6: {
        let values = message.string_table || (message.string_table = []);
        values.push(readString(bb, readVarint32(bb)));
        break;
      }

      // optional int64 drop_frames = 7;
      case 7: {
        message.drop_frames = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // optional int64 keep_frames = 8;
      case 8: {
        message.keep_frames = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // optional int64 time_nanos = 9;
      case 9: {
        message.time_nanos = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // optional int64 duration_nanos = 10;
      case 10: {
        message.duration_nanos = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // optional ValueType period_type = 11;
      case 11: {
        let limit = pushTemporaryLength(bb);
        message.period_type = _decodeValueType(bb);
        bb.limit = limit;
        break;
      }

      // optional int64 period = 12;
      case 12: {
        message.period = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // repeated int64 comment = 13;
      case 13: {
        let values = message.comment || (message.comment = []);
        if ((tag & 7) === 2) {
          let outerLimit = pushTemporaryLength(bb);
          while (!isAtEnd(bb)) {
            values.push(readVarint64(bb, /* unsigned */ false));
          }
          bb.limit = outerLimit;
        } else {
          values.push(readVarint64(bb, /* unsigned */ false));
        }
        break;
      }

      // optional int64 default_sample_type = 14;
      case 14: {
        message.default_sample_type = readVarint64(bb, /* unsigned */ false);
        break;
      }

      default:
        skipUnknownField(bb, tag & 7);
    }
  }

  return message;
}

export interface ValueType {
  type?: Long;
  unit?: Long;
}

export function encodeValueType(message: ValueType): Uint8Array {
  let bb = popByteBuffer();
  _encodeValueType(message, bb);
  return toUint8Array(bb);
}

function _encodeValueType(message: ValueType, bb: ByteBuffer): void {
  // optional int64 type = 1;
  let $type = message.type;
  if ($type !== undefined) {
    writeVarint32(bb, 8);
    writeVarint64(bb, $type);
  }

  // optional int64 unit = 2;
  let $unit = message.unit;
  if ($unit !== undefined) {
    writeVarint32(bb, 16);
    writeVarint64(bb, $unit);
  }
}

export function decodeValueType(binary: Uint8Array): ValueType {
  return _decodeValueType(wrapByteBuffer(binary));
}

function _decodeValueType(bb: ByteBuffer): ValueType {
  let message: ValueType = {} as any;

  end_of_message: while (!isAtEnd(bb)) {
    let tag = readVarint32(bb);

    switch (tag >>> 3) {
      case 0:
        break end_of_message;

      // optional int64 type = 1;
      case 1: {
        message.type = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // optional int64 unit = 2;
      case 2: {
        message.unit = readVarint64(bb, /* unsigned */ false);
        break;
      }

      default:
        skipUnknownField(bb, tag & 7);
    }
  }

  return message;
}

export interface Sample {
  location_id?: Long[];
  value?: Long[];
  label?: Label[];
}

export function encodeSample(message: Sample): Uint8Array {
  let bb = popByteBuffer();
  _encodeSample(message, bb);
  return toUint8Array(bb);
}

function _encodeSample(message: Sample, bb: ByteBuffer): void {
  // repeated uint64 location_id = 1;
  let array$location_id = message.location_id;
  if (array$location_id !== undefined) {
    let packed = popByteBuffer();
    for (let value of array$location_id) {
      writeVarint64(packed, value);
    }
    writeVarint32(bb, 10);
    writeVarint32(bb, packed.offset);
    writeByteBuffer(bb, packed);
    pushByteBuffer(packed);
  }

  // repeated int64 value = 2;
  let array$value = message.value;
  if (array$value !== undefined) {
    let packed = popByteBuffer();
    for (let value of array$value) {
      writeVarint64(packed, value);
    }
    writeVarint32(bb, 18);
    writeVarint32(bb, packed.offset);
    writeByteBuffer(bb, packed);
    pushByteBuffer(packed);
  }

  // repeated Label label = 3;
  let array$label = message.label;
  if (array$label !== undefined) {
    for (let value of array$label) {
      writeVarint32(bb, 26);
      let nested = popByteBuffer();
      _encodeLabel(value, nested);
      writeVarint32(bb, nested.limit);
      writeByteBuffer(bb, nested);
      pushByteBuffer(nested);
    }
  }
}

export function decodeSample(binary: Uint8Array): Sample {
  return _decodeSample(wrapByteBuffer(binary));
}

function _decodeSample(bb: ByteBuffer): Sample {
  let message: Sample = {} as any;

  end_of_message: while (!isAtEnd(bb)) {
    let tag = readVarint32(bb);

    switch (tag >>> 3) {
      case 0:
        break end_of_message;

      // repeated uint64 location_id = 1;
      case 1: {
        let values = message.location_id || (message.location_id = []);
        if ((tag & 7) === 2) {
          let outerLimit = pushTemporaryLength(bb);
          while (!isAtEnd(bb)) {
            values.push(readVarint64(bb, /* unsigned */ true));
          }
          bb.limit = outerLimit;
        } else {
          values.push(readVarint64(bb, /* unsigned */ true));
        }
        break;
      }

      // repeated int64 value = 2;
      case 2: {
        let values = message.value || (message.value = []);
        if ((tag & 7) === 2) {
          let outerLimit = pushTemporaryLength(bb);
          while (!isAtEnd(bb)) {
            values.push(readVarint64(bb, /* unsigned */ false));
          }
          bb.limit = outerLimit;
        } else {
          values.push(readVarint64(bb, /* unsigned */ false));
        }
        break;
      }

      // repeated Label label = 3;
      case 3: {
        let limit = pushTemporaryLength(bb);
        let values = message.label || (message.label = []);
        values.push(_decodeLabel(bb));
        bb.limit = limit;
        break;
      }

      default:
        skipUnknownField(bb, tag & 7);
    }
  }

  return message;
}

export interface Label {
  key?: Long;
  str?: Long;
  num?: Long;
  num_unit?: Long;
}

export function encodeLabel(message: Label): Uint8Array {
  let bb = popByteBuffer();
  _encodeLabel(message, bb);
  return toUint8Array(bb);
}

function _encodeLabel(message: Label, bb: ByteBuffer): void {
  // optional int64 key = 1;
  let $key = message.key;
  if ($key !== undefined) {
    writeVarint32(bb, 8);
    writeVarint64(bb, $key);
  }

  // optional int64 str = 2;
  let $str = message.str;
  if ($str !== undefined) {
    writeVarint32(bb, 16);
    writeVarint64(bb, $str);
  }

  // optional int64 num = 3;
  let $num = message.num;
  if ($num !== undefined) {
    writeVarint32(bb, 24);
    writeVarint64(bb, $num);
  }

  // optional int64 num_unit = 4;
  let $num_unit = message.num_unit;
  if ($num_unit !== undefined) {
    writeVarint32(bb, 32);
    writeVarint64(bb, $num_unit);
  }
}

export function decodeLabel(binary: Uint8Array): Label {
  return _decodeLabel(wrapByteBuffer(binary));
}

function _decodeLabel(bb: ByteBuffer): Label {
  let message: Label = {} as any;

  end_of_message: while (!isAtEnd(bb)) {
    let tag = readVarint32(bb);

    switch (tag >>> 3) {
      case 0:
        break end_of_message;

      // optional int64 key = 1;
      case 1: {
        message.key = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // optional int64 str = 2;
      case 2: {
        message.str = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // optional int64 num = 3;
      case 3: {
        message.num = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // optional int64 num_unit = 4;
      case 4: {
        message.num_unit = readVarint64(bb, /* unsigned */ false);
        break;
      }

      default:
        skipUnknownField(bb, tag & 7);
    }
  }

  return message;
}

export interface Mapping {
  id?: Long;
  memory_start?: Long;
  memory_limit?: Long;
  file_offset?: Long;
  filename?: Long;
  build_id?: Long;
  has_functions?: boolean;
  has_filenames?: boolean;
  has_line_numbers?: boolean;
  has_inline_frames?: boolean;
}

export function encodeMapping(message: Mapping): Uint8Array {
  let bb = popByteBuffer();
  _encodeMapping(message, bb);
  return toUint8Array(bb);
}

function _encodeMapping(message: Mapping, bb: ByteBuffer): void {
  // optional uint64 id = 1;
  let $id = message.id;
  if ($id !== undefined) {
    writeVarint32(bb, 8);
    writeVarint64(bb, $id);
  }

  // optional uint64 memory_start = 2;
  let $memory_start = message.memory_start;
  if ($memory_start !== undefined) {
    writeVarint32(bb, 16);
    writeVarint64(bb, $memory_start);
  }

  // optional uint64 memory_limit = 3;
  let $memory_limit = message.memory_limit;
  if ($memory_limit !== undefined) {
    writeVarint32(bb, 24);
    writeVarint64(bb, $memory_limit);
  }

  // optional uint64 file_offset = 4;
  let $file_offset = message.file_offset;
  if ($file_offset !== undefined) {
    writeVarint32(bb, 32);
    writeVarint64(bb, $file_offset);
  }

  // optional int64 filename = 5;
  let $filename = message.filename;
  if ($filename !== undefined) {
    writeVarint32(bb, 40);
    writeVarint64(bb, $filename);
  }

  // optional int64 build_id = 6;
  let $build_id = message.build_id;
  if ($build_id !== undefined) {
    writeVarint32(bb, 48);
    writeVarint64(bb, $build_id);
  }

  // optional bool has_functions = 7;
  let $has_functions = message.has_functions;
  if ($has_functions !== undefined) {
    writeVarint32(bb, 56);
    writeByte(bb, $has_functions ? 1 : 0);
  }

  // optional bool has_filenames = 8;
  let $has_filenames = message.has_filenames;
  if ($has_filenames !== undefined) {
    writeVarint32(bb, 64);
    writeByte(bb, $has_filenames ? 1 : 0);
  }

  // optional bool has_line_numbers = 9;
  let $has_line_numbers = message.has_line_numbers;
  if ($has_line_numbers !== undefined) {
    writeVarint32(bb, 72);
    writeByte(bb, $has_line_numbers ? 1 : 0);
  }

  // optional bool has_inline_frames = 10;
  let $has_inline_frames = message.has_inline_frames;
  if ($has_inline_frames !== undefined) {
    writeVarint32(bb, 80);
    writeByte(bb, $has_inline_frames ? 1 : 0);
  }
}

export function decodeMapping(binary: Uint8Array): Mapping {
  return _decodeMapping(wrapByteBuffer(binary));
}

function _decodeMapping(bb: ByteBuffer): Mapping {
  let message: Mapping = {} as any;

  end_of_message: while (!isAtEnd(bb)) {
    let tag = readVarint32(bb);

    switch (tag >>> 3) {
      case 0:
        break end_of_message;

      // optional uint64 id = 1;
      case 1: {
        message.id = readVarint64(bb, /* unsigned */ true);
        break;
      }

      // optional uint64 memory_start = 2;
      case 2: {
        message.memory_start = readVarint64(bb, /* unsigned */ true);
        break;
      }

      // optional uint64 memory_limit = 3;
      case 3: {
        message.memory_limit = readVarint64(bb, /* unsigned */ true);
        break;
      }

      // optional uint64 file_offset = 4;
      case 4: {
        message.file_offset = readVarint64(bb, /* unsigned */ true);
        break;
      }

      // optional int64 filename = 5;
      case 5: {
        message.filename = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // optional int64 build_id = 6;
      case 6: {
        message.build_id = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // optional bool has_functions = 7;
      case 7: {
        message.has_functions = !!readByte(bb);
        break;
      }

      // optional bool has_filenames = 8;
      case 8: {
        message.has_filenames = !!readByte(bb);
        break;
      }

      // optional bool has_line_numbers = 9;
      case 9: {
        message.has_line_numbers = !!readByte(bb);
        break;
      }

      // optional bool has_inline_frames = 10;
      case 10: {
        message.has_inline_frames = !!readByte(bb);
        break;
      }

      default:
        skipUnknownField(bb, tag & 7);
    }
  }

  return message;
}

export interface Location {
  id?: Long;
  mapping_id?: Long;
  address?: Long;
  line?: Line[];
  is_folded?: boolean;
}

export function encodeLocation(message: Location): Uint8Array {
  let bb = popByteBuffer();
  _encodeLocation(message, bb);
  return toUint8Array(bb);
}

function _encodeLocation(message: Location, bb: ByteBuffer): void {
  // optional uint64 id = 1;
  let $id = message.id;
  if ($id !== undefined) {
    writeVarint32(bb, 8);
    writeVarint64(bb, $id);
  }

  // optional uint64 mapping_id = 2;
  let $mapping_id = message.mapping_id;
  if ($mapping_id !== undefined) {
    writeVarint32(bb, 16);
    writeVarint64(bb, $mapping_id);
  }

  // optional uint64 address = 3;
  let $address = message.address;
  if ($address !== undefined) {
    writeVarint32(bb, 24);
    writeVarint64(bb, $address);
  }

  // repeated Line line = 4;
  let array$line = message.line;
  if (array$line !== undefined) {
    for (let value of array$line) {
      writeVarint32(bb, 34);
      let nested = popByteBuffer();
      _encodeLine(value, nested);
      writeVarint32(bb, nested.limit);
      writeByteBuffer(bb, nested);
      pushByteBuffer(nested);
    }
  }

  // optional bool is_folded = 5;
  let $is_folded = message.is_folded;
  if ($is_folded !== undefined) {
    writeVarint32(bb, 40);
    writeByte(bb, $is_folded ? 1 : 0);
  }
}

export function decodeLocation(binary: Uint8Array): Location {
  return _decodeLocation(wrapByteBuffer(binary));
}

function _decodeLocation(bb: ByteBuffer): Location {
  let message: Location = {} as any;

  end_of_message: while (!isAtEnd(bb)) {
    let tag = readVarint32(bb);

    switch (tag >>> 3) {
      case 0:
        break end_of_message;

      // optional uint64 id = 1;
      case 1: {
        message.id = readVarint64(bb, /* unsigned */ true);
        break;
      }

      // optional uint64 mapping_id = 2;
      case 2: {
        message.mapping_id = readVarint64(bb, /* unsigned */ true);
        break;
      }

      // optional uint64 address = 3;
      case 3: {
        message.address = readVarint64(bb, /* unsigned */ true);
        break;
      }

      // repeated Line line = 4;
      case 4: {
        let limit = pushTemporaryLength(bb);
        let values = message.line || (message.line = []);
        values.push(_decodeLine(bb));
        bb.limit = limit;
        break;
      }

      // optional bool is_folded = 5;
      case 5: {
        message.is_folded = !!readByte(bb);
        break;
      }

      default:
        skipUnknownField(bb, tag & 7);
    }
  }

  return message;
}

export interface Line {
  function_id?: Long;
  line?: Long;
}

export function encodeLine(message: Line): Uint8Array {
  let bb = popByteBuffer();
  _encodeLine(message, bb);
  return toUint8Array(bb);
}

function _encodeLine(message: Line, bb: ByteBuffer): void {
  // optional uint64 function_id = 1;
  let $function_id = message.function_id;
  if ($function_id !== undefined) {
    writeVarint32(bb, 8);
    writeVarint64(bb, $function_id);
  }

  // optional int64 line = 2;
  let $line = message.line;
  if ($line !== undefined) {
    writeVarint32(bb, 16);
    writeVarint64(bb, $line);
  }
}

export function decodeLine(binary: Uint8Array): Line {
  return _decodeLine(wrapByteBuffer(binary));
}

function _decodeLine(bb: ByteBuffer): Line {
  let message: Line = {} as any;

  end_of_message: while (!isAtEnd(bb)) {
    let tag = readVarint32(bb);

    switch (tag >>> 3) {
      case 0:
        break end_of_message;

      // optional uint64 function_id = 1;
      case 1: {
        message.function_id = readVarint64(bb, /* unsigned */ true);
        break;
      }

      // optional int64 line = 2;
      case 2: {
        message.line = readVarint64(bb, /* unsigned */ false);
        break;
      }

      default:
        skipUnknownField(bb, tag & 7);
    }
  }

  return message;
}

export interface Function {
  id?: Long;
  name?: Long;
  system_name?: Long;
  filename?: Long;
  start_line?: Long;
}

export function encodeFunction(message: Function): Uint8Array {
  let bb = popByteBuffer();
  _encodeFunction(message, bb);
  return toUint8Array(bb);
}

function _encodeFunction(message: Function, bb: ByteBuffer): void {
  // optional uint64 id = 1;
  let $id = message.id;
  if ($id !== undefined) {
    writeVarint32(bb, 8);
    writeVarint64(bb, $id);
  }

  // optional int64 name = 2;
  let $name = message.name;
  if ($name !== undefined) {
    writeVarint32(bb, 16);
    writeVarint64(bb, $name);
  }

  // optional int64 system_name = 3;
  let $system_name = message.system_name;
  if ($system_name !== undefined) {
    writeVarint32(bb, 24);
    writeVarint64(bb, $system_name);
  }

  // optional int64 filename = 4;
  let $filename = message.filename;
  if ($filename !== undefined) {
    writeVarint32(bb, 32);
    writeVarint64(bb, $filename);
  }

  // optional int64 start_line = 5;
  let $start_line = message.start_line;
  if ($start_line !== undefined) {
    writeVarint32(bb, 40);
    writeVarint64(bb, $start_line);
  }
}

export function decodeFunction(binary: Uint8Array): Function {
  return _decodeFunction(wrapByteBuffer(binary));
}

function _decodeFunction(bb: ByteBuffer): Function {
  let message: Function = {} as any;

  end_of_message: while (!isAtEnd(bb)) {
    let tag = readVarint32(bb);

    switch (tag >>> 3) {
      case 0:
        break end_of_message;

      // optional uint64 id = 1;
      case 1: {
        message.id = readVarint64(bb, /* unsigned */ true);
        break;
      }

      // optional int64 name = 2;
      case 2: {
        message.name = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // optional int64 system_name = 3;
      case 3: {
        message.system_name = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // optional int64 filename = 4;
      case 4: {
        message.filename = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // optional int64 start_line = 5;
      case 5: {
        message.start_line = readVarint64(bb, /* unsigned */ false);
        break;
      }

      default:
        skipUnknownField(bb, tag & 7);
    }
  }

  return message;
}

export interface Long {
  low: number;
  high: number;
  unsigned: boolean;
}

interface ByteBuffer {
  bytes: Uint8Array;
  offset: number;
  limit: number;
}

function pushTemporaryLength(bb: ByteBuffer): number {
  let length = readVarint32(bb);
  let limit = bb.limit;
  bb.limit = bb.offset + length;
  return limit;
}

function skipUnknownField(bb: ByteBuffer, type: number): void {
  switch (type) {
    case 0:
      while (readByte(bb) & 0x80) {}
      break;
    case 2:
      skip(bb, readVarint32(bb));
      break;
    case 5:
      skip(bb, 4);
      break;
    case 1:
      skip(bb, 8);
      break;
    default:
      throw new Error('Unimplemented type: ' + type);
  }
}

function stringToLong(value: string): Long {
  return {
    low: value.charCodeAt(0) | (value.charCodeAt(1) << 16),
    high: value.charCodeAt(2) | (value.charCodeAt(3) << 16),
    unsigned: false,
  };
}

function longToString(value: Long): string {
  let low = value.low;
  let high = value.high;
  return String.fromCharCode(low & 0xffff, low >>> 16, high & 0xffff, high >>> 16);
}

// The code below was modified from https://github.com/protobufjs/bytebuffer.js
// which is under the Apache License 2.0.

let f32 = new Float32Array(1);
let f32_u8 = new Uint8Array(f32.buffer);

let f64 = new Float64Array(1);
let f64_u8 = new Uint8Array(f64.buffer);

function intToLong(value: number): Long {
  value |= 0;
  return {
    low: value,
    high: value >> 31,
    unsigned: value >= 0,
  };
}

let bbStack: ByteBuffer[] = [];

function popByteBuffer(): ByteBuffer {
  const bb = bbStack.pop();
  if (!bb) return { bytes: new Uint8Array(64), offset: 0, limit: 0 };
  bb.offset = bb.limit = 0;
  return bb;
}

function pushByteBuffer(bb: ByteBuffer): void {
  bbStack.push(bb);
}

function wrapByteBuffer(bytes: Uint8Array): ByteBuffer {
  return { bytes, offset: 0, limit: bytes.length };
}

function toUint8Array(bb: ByteBuffer): Uint8Array {
  let bytes = bb.bytes;
  let limit = bb.limit;
  return bytes.length === limit ? bytes : bytes.subarray(0, limit);
}

function skip(bb: ByteBuffer, offset: number): void {
  if (bb.offset + offset > bb.limit) {
    throw new Error('Skip past limit');
  }
  bb.offset += offset;
}

function isAtEnd(bb: ByteBuffer): boolean {
  return bb.offset >= bb.limit;
}

function grow(bb: ByteBuffer, count: number): number {
  let bytes = bb.bytes;
  let offset = bb.offset;
  let limit = bb.limit;
  let finalOffset = offset + count;
  if (finalOffset > bytes.length) {
    let newBytes = new Uint8Array(finalOffset * 2);
    newBytes.set(bytes);
    bb.bytes = newBytes;
  }
  bb.offset = finalOffset;
  if (finalOffset > limit) {
    bb.limit = finalOffset;
  }
  return offset;
}

function advance(bb: ByteBuffer, count: number): number {
  let offset = bb.offset;
  if (offset + count > bb.limit) {
    throw new Error('Read past limit');
  }
  bb.offset += count;
  return offset;
}

function readBytes(bb: ByteBuffer, count: number): Uint8Array {
  let offset = advance(bb, count);
  return bb.bytes.subarray(offset, offset + count);
}

function writeBytes(bb: ByteBuffer, buffer: Uint8Array): void {
  let offset = grow(bb, buffer.length);
  bb.bytes.set(buffer, offset);
}

function readString(bb: ByteBuffer, count: number): string {
  // Sadly a hand-coded UTF8 decoder is much faster than subarray+TextDecoder in V8
  let offset = advance(bb, count);
  let fromCharCode = String.fromCharCode;
  let bytes = bb.bytes;
  let invalid = '\uFFFD';
  let text = '';

  for (let i = 0; i < count; i++) {
    let c1 = bytes[i + offset],
      c2: number,
      c3: number,
      c4: number,
      c: number;

    // 1 byte
    if ((c1 & 0x80) === 0) {
      text += fromCharCode(c1);
    }

    // 2 bytes
    else if ((c1 & 0xe0) === 0xc0) {
      if (i + 1 >= count) text += invalid;
      else {
        c2 = bytes[i + offset + 1];
        if ((c2 & 0xc0) !== 0x80) text += invalid;
        else {
          c = ((c1 & 0x1f) << 6) | (c2 & 0x3f);
          if (c < 0x80) text += invalid;
          else {
            text += fromCharCode(c);
            i++;
          }
        }
      }
    }

    // 3 bytes
    else if ((c1 & 0xf0) == 0xe0) {
      if (i + 2 >= count) text += invalid;
      else {
        c2 = bytes[i + offset + 1];
        c3 = bytes[i + offset + 2];
        if (((c2 | (c3 << 8)) & 0xc0c0) !== 0x8080) text += invalid;
        else {
          c = ((c1 & 0x0f) << 12) | ((c2 & 0x3f) << 6) | (c3 & 0x3f);
          if (c < 0x0800 || (c >= 0xd800 && c <= 0xdfff)) text += invalid;
          else {
            text += fromCharCode(c);
            i += 2;
          }
        }
      }
    }

    // 4 bytes
    else if ((c1 & 0xf8) == 0xf0) {
      if (i + 3 >= count) text += invalid;
      else {
        c2 = bytes[i + offset + 1];
        c3 = bytes[i + offset + 2];
        c4 = bytes[i + offset + 3];
        if (((c2 | (c3 << 8) | (c4 << 16)) & 0xc0c0c0) !== 0x808080) text += invalid;
        else {
          c = ((c1 & 0x07) << 0x12) | ((c2 & 0x3f) << 0x0c) | ((c3 & 0x3f) << 0x06) | (c4 & 0x3f);
          if (c < 0x10000 || c > 0x10ffff) text += invalid;
          else {
            c -= 0x10000;
            text += fromCharCode((c >> 10) + 0xd800, (c & 0x3ff) + 0xdc00);
            i += 3;
          }
        }
      }
    } else text += invalid;
  }

  return text;
}

function writeString(bb: ByteBuffer, text: string): void {
  // Sadly a hand-coded UTF8 encoder is much faster than TextEncoder+set in V8
  let n = text.length;
  let byteCount = 0;

  // Write the byte count first
  for (let i = 0; i < n; i++) {
    let c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < n) {
      c = (c << 10) + text.charCodeAt(++i) - 0x35fdc00;
    }
    byteCount += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  writeVarint32(bb, byteCount);

  let offset = grow(bb, byteCount);
  let bytes = bb.bytes;

  // Then write the bytes
  for (let i = 0; i < n; i++) {
    let c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < n) {
      c = (c << 10) + text.charCodeAt(++i) - 0x35fdc00;
    }
    if (c < 0x80) {
      bytes[offset++] = c;
    } else {
      if (c < 0x800) {
        bytes[offset++] = ((c >> 6) & 0x1f) | 0xc0;
      } else {
        if (c < 0x10000) {
          bytes[offset++] = ((c >> 12) & 0x0f) | 0xe0;
        } else {
          bytes[offset++] = ((c >> 18) & 0x07) | 0xf0;
          bytes[offset++] = ((c >> 12) & 0x3f) | 0x80;
        }
        bytes[offset++] = ((c >> 6) & 0x3f) | 0x80;
      }
      bytes[offset++] = (c & 0x3f) | 0x80;
    }
  }
}

function writeByteBuffer(bb: ByteBuffer, buffer: ByteBuffer): void {
  let offset = grow(bb, buffer.limit);
  let from = bb.bytes;
  let to = buffer.bytes;

  // This for loop is much faster than subarray+set on V8
  for (let i = 0, n = buffer.limit; i < n; i++) {
    from[i + offset] = to[i];
  }
}

function readByte(bb: ByteBuffer): number {
  return bb.bytes[advance(bb, 1)];
}

function writeByte(bb: ByteBuffer, value: number): void {
  let offset = grow(bb, 1);
  bb.bytes[offset] = value;
}

function readFloat(bb: ByteBuffer): number {
  let offset = advance(bb, 4);
  let bytes = bb.bytes;

  // Manual copying is much faster than subarray+set in V8
  f32_u8[0] = bytes[offset++];
  f32_u8[1] = bytes[offset++];
  f32_u8[2] = bytes[offset++];
  f32_u8[3] = bytes[offset++];
  return f32[0];
}

function writeFloat(bb: ByteBuffer, value: number): void {
  let offset = grow(bb, 4);
  let bytes = bb.bytes;
  f32[0] = value;

  // Manual copying is much faster than subarray+set in V8
  bytes[offset++] = f32_u8[0];
  bytes[offset++] = f32_u8[1];
  bytes[offset++] = f32_u8[2];
  bytes[offset++] = f32_u8[3];
}

function readDouble(bb: ByteBuffer): number {
  let offset = advance(bb, 8);
  let bytes = bb.bytes;

  // Manual copying is much faster than subarray+set in V8
  f64_u8[0] = bytes[offset++];
  f64_u8[1] = bytes[offset++];
  f64_u8[2] = bytes[offset++];
  f64_u8[3] = bytes[offset++];
  f64_u8[4] = bytes[offset++];
  f64_u8[5] = bytes[offset++];
  f64_u8[6] = bytes[offset++];
  f64_u8[7] = bytes[offset++];
  return f64[0];
}

function writeDouble(bb: ByteBuffer, value: number): void {
  let offset = grow(bb, 8);
  let bytes = bb.bytes;
  f64[0] = value;

  // Manual copying is much faster than subarray+set in V8
  bytes[offset++] = f64_u8[0];
  bytes[offset++] = f64_u8[1];
  bytes[offset++] = f64_u8[2];
  bytes[offset++] = f64_u8[3];
  bytes[offset++] = f64_u8[4];
  bytes[offset++] = f64_u8[5];
  bytes[offset++] = f64_u8[6];
  bytes[offset++] = f64_u8[7];
}

function readInt32(bb: ByteBuffer): number {
  let offset = advance(bb, 4);
  let bytes = bb.bytes;
  return (
    bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)
  );
}

function writeInt32(bb: ByteBuffer, value: number): void {
  let offset = grow(bb, 4);
  let bytes = bb.bytes;
  bytes[offset] = value;
  bytes[offset + 1] = value >> 8;
  bytes[offset + 2] = value >> 16;
  bytes[offset + 3] = value >> 24;
}

function readInt64(bb: ByteBuffer, unsigned: boolean): Long {
  return {
    low: readInt32(bb),
    high: readInt32(bb),
    unsigned,
  };
}

function writeInt64(bb: ByteBuffer, value: Long): void {
  writeInt32(bb, value.low);
  writeInt32(bb, value.high);
}

function readVarint32(bb: ByteBuffer): number {
  let c = 0;
  let value = 0;
  let b: number;
  do {
    b = readByte(bb);
    if (c < 32) value |= (b & 0x7f) << c;
    c += 7;
  } while (b & 0x80);
  return value;
}

function writeVarint32(bb: ByteBuffer, value: number): void {
  value >>>= 0;
  while (value >= 0x80) {
    writeByte(bb, (value & 0x7f) | 0x80);
    value >>>= 7;
  }
  writeByte(bb, value);
}

function readVarint64(bb: ByteBuffer, unsigned: boolean): Long {
  let part0 = 0;
  let part1 = 0;
  let part2 = 0;
  let b: number;

  b = readByte(bb);
  part0 = b & 0x7f;
  if (b & 0x80) {
    b = readByte(bb);
    part0 |= (b & 0x7f) << 7;
    if (b & 0x80) {
      b = readByte(bb);
      part0 |= (b & 0x7f) << 14;
      if (b & 0x80) {
        b = readByte(bb);
        part0 |= (b & 0x7f) << 21;
        if (b & 0x80) {
          b = readByte(bb);
          part1 = b & 0x7f;
          if (b & 0x80) {
            b = readByte(bb);
            part1 |= (b & 0x7f) << 7;
            if (b & 0x80) {
              b = readByte(bb);
              part1 |= (b & 0x7f) << 14;
              if (b & 0x80) {
                b = readByte(bb);
                part1 |= (b & 0x7f) << 21;
                if (b & 0x80) {
                  b = readByte(bb);
                  part2 = b & 0x7f;
                  if (b & 0x80) {
                    b = readByte(bb);
                    part2 |= (b & 0x7f) << 7;
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return {
    low: part0 | (part1 << 28),
    high: (part1 >>> 4) | (part2 << 24),
    unsigned,
  };
}

function writeVarint64(bb: ByteBuffer, value: Long): void {
  let part0 = value.low >>> 0;
  let part1 = ((value.low >>> 28) | (value.high << 4)) >>> 0;
  let part2 = value.high >>> 24;

  // ref: src/google/protobuf/io/coded_stream.cc
  let size =
    part2 === 0
      ? part1 === 0
        ? part0 < 1 << 14
          ? part0 < 1 << 7
            ? 1
            : 2
          : part0 < 1 << 21
            ? 3
            : 4
        : part1 < 1 << 14
          ? part1 < 1 << 7
            ? 5
            : 6
          : part1 < 1 << 21
            ? 7
            : 8
      : part2 < 1 << 7
        ? 9
        : 10;

  let offset = grow(bb, size);
  let bytes = bb.bytes;

  switch (size) {
    case 10:
      bytes[offset + 9] = (part2 >>> 7) & 0x01;
    case 9:
      bytes[offset + 8] = size !== 9 ? part2 | 0x80 : part2 & 0x7f;
    case 8:
      bytes[offset + 7] = size !== 8 ? (part1 >>> 21) | 0x80 : (part1 >>> 21) & 0x7f;
    case 7:
      bytes[offset + 6] = size !== 7 ? (part1 >>> 14) | 0x80 : (part1 >>> 14) & 0x7f;
    case 6:
      bytes[offset + 5] = size !== 6 ? (part1 >>> 7) | 0x80 : (part1 >>> 7) & 0x7f;
    case 5:
      bytes[offset + 4] = size !== 5 ? part1 | 0x80 : part1 & 0x7f;
    case 4:
      bytes[offset + 3] = size !== 4 ? (part0 >>> 21) | 0x80 : (part0 >>> 21) & 0x7f;
    case 3:
      bytes[offset + 2] = size !== 3 ? (part0 >>> 14) | 0x80 : (part0 >>> 14) & 0x7f;
    case 2:
      bytes[offset + 1] = size !== 2 ? (part0 >>> 7) | 0x80 : (part0 >>> 7) & 0x7f;
    case 1:
      bytes[offset] = size !== 1 ? part0 | 0x80 : part0 & 0x7f;
  }
}

function readVarint32ZigZag(bb: ByteBuffer): number {
  let value = readVarint32(bb);

  // ref: src/google/protobuf/wire_format_lite.h
  return (value >>> 1) ^ -(value & 1);
}

function writeVarint32ZigZag(bb: ByteBuffer, value: number): void {
  // ref: src/google/protobuf/wire_format_lite.h
  writeVarint32(bb, (value << 1) ^ (value >> 31));
}

function readVarint64ZigZag(bb: ByteBuffer): Long {
  let value = readVarint64(bb, /* unsigned */ false);
  let low = value.low;
  let high = value.high;
  let flip = -(low & 1);

  // ref: src/google/protobuf/wire_format_lite.h
  return {
    low: ((low >>> 1) | (high << 31)) ^ flip,
    high: (high >>> 1) ^ flip,
    unsigned: false,
  };
}

function writeVarint64ZigZag(bb: ByteBuffer, value: Long): void {
  let low = value.low;
  let high = value.high;
  let flip = high >> 31;

  // ref: src/google/protobuf/wire_format_lite.h
  writeVarint64(bb, {
    low: (low << 1) ^ flip,
    high: ((high << 1) | (low >>> 31)) ^ flip,
    unsigned: false,
  });
}
