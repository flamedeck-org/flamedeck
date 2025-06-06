// Define types for injected dependencies
export type InflateFn = (data: Uint8Array) => Uint8Array;
export type ParseJsonUint8ArrayFn = (data: Uint8Array) => unknown;
// Define the specific shape needed for the 'Long' library's isLong function
export type IsLongFn = (obj: any) => obj is { toNumber(): number };

// Define a structural type matching the parts of `typeof Long` we need
export interface LongType {
  ZERO: { toNumber(): number; isZero(): boolean }; // Add methods used in pprof.ts
  new (low: number, high: number, unsigned?: boolean): { toNumber(): number; isZero(): boolean };
  fromNumber(value: number, unsigned?: boolean): { toNumber(): number; isZero(): boolean };
  isLong: IsLongFn; // Reuse IsLongFn for consistency
}

// Interface for the dependency object
export interface ImporterDependencies {
  inflate: InflateFn;
  parseJsonUint8Array: ParseJsonUint8ArrayFn;
  LongType: LongType;
}

export interface ProfileDataSource {
  name(): Promise<string>;
  readAsArrayBuffer(): Promise<ArrayBuffer>;
  // Pass dependencies when reading as text
  readAsText(deps: Pick<ImporterDependencies, 'parseJsonUint8Array'>): Promise<TextFileContent>;
}

export interface TextFileContent {
  splitLines(): Iterable<string>;
  firstChunk(): string;
  // Pass dependencies when parsing JSON
  parseAsJSON(deps: Pick<ImporterDependencies, 'parseJsonUint8Array'>): unknown;
}

// V8 has a maximum string size. To support files whose contents exceeds that
// size, we provide an alternate string interface for text backed by a
// Uint8Array instead.
//
// We provide a simple splitLines() which returns simple strings under the
// assumption that most extremely large text profiles will be broken into many
// lines. This isn't true in the general case, but will be true for most common
// large files.
//
// See: https://github.com/v8/v8/blob/8b663818fc311217c2cdaaab935f020578bfb7a8/src/objects/string.h#L479-L483
//
// At time of writing (2021/03/27), the maximum string length in V8 is
//  32 bit systems: 2^28 - 16 = ~268M chars
//  64 bit systems: 2^29 - 24 = ~537M chars
//
// https://source.chromium.org/chromium/chromium/src/+/main:v8/include/v8-primitive.h;drc=cb88fe94d9044d860cc75c89e1bc270ab4062702;l=125
//
// We'll be conservative and feed in 2^27 bytes at a time (~134M chars
// assuming utf-8 encoding)
let TEXT_FILE_CHUNK_SIZE = 1 << 27;

export async function withMockedFileChunkSizeForTests(chunkSize: number, cb: () => unknown) {
  const original = TEXT_FILE_CHUNK_SIZE;
  TEXT_FILE_CHUNK_SIZE = chunkSize;
  try {
    await cb();
  } finally {
    TEXT_FILE_CHUNK_SIZE = original;
  }
}

function permissivelyParseJSONString(content: string) {
  // This code is similar to the code from here:
  // https://github.com/catapult-project/catapult/blob/27e047e0494df162022be6aa8a8862742a270232/tracing/tracing/extras/importer/trace_event_importer.html#L197-L208
  //
  //   If the event data begins with a [, then we know it should end with a ]. The
  //   reason we check for this is because some tracing implementations cannot
  //   guarantee that a ']' gets written to the trace file. So, we are forgiving
  //   and if this is obviously the case, we fix it up before throwing the string
  //   at JSON.parse.
  content = content.trim();
  if (content[0] === '[') {
    content = content.replace(/,\s*$/, '');
    if (content[content.length - 1] !== ']') {
      content += ']';
    }
  }
  return JSON.parse(content);
}

// Adjusted helper to take the parser function via deps
function permissivelyParseJSONUint8Array(
  byteArray: Uint8Array,
  deps: Pick<ImporterDependencies, 'parseJsonUint8Array'>
): unknown {
  let indexOfFirstNonWhitespaceChar = 0;
  for (let i = 0; i < byteArray.length; i++) {
    if (!/\s/.exec(String.fromCharCode(byteArray[i]))) {
      indexOfFirstNonWhitespaceChar = i;
      break;
    }
  }
  if (
    byteArray[indexOfFirstNonWhitespaceChar] === '['.charCodeAt(0) &&
    byteArray[byteArray.length - 1] !== ']'.charCodeAt(0)
  ) {
    // Strip trailing whitespace from the end of the array
    let trimmedLength = byteArray.length;
    while (trimmedLength > 0 && /\s/.exec(String.fromCharCode(byteArray[trimmedLength - 1]))) {
      trimmedLength--;
    }

    // Ignore trailing comma
    if (String.fromCharCode(byteArray[trimmedLength - 1]) === ',') {
      trimmedLength--;
    }

    if (String.fromCharCode(byteArray[trimmedLength - 1]) !== ']') {
      // Clone the array, ignoring any whitespace & trailing comma, then append a ']'
      //
      // Note: We could save a tiny bit of space here by avoiding copying the
      // leading whitespace, but it's a trivial perf boost and it complicates
      // the code.
      const newByteArray = new Uint8Array(trimmedLength + 1);
      newByteArray.set(byteArray.subarray(0, trimmedLength));
      newByteArray[trimmedLength] = ']'.charCodeAt(0);
      byteArray = newByteArray;
    }
  }
  return deps.parseJsonUint8Array(byteArray); // Use injected parser
}

export class BufferBackedTextFileContent implements TextFileContent {
  private chunks: string[] = [];
  private byteArray: Uint8Array;

  constructor(buffer: ArrayBuffer) {
    // Removed parser injection from constructor, will be passed to parseAsJSON
    const byteArray = (this.byteArray = new Uint8Array(buffer));

    let encoding: string = 'utf-8';
    if (byteArray.length > 2) {
      if (byteArray[0] === 0xff && byteArray[1] === 0xfe) {
        // UTF-16, Little Endian encoding
        encoding = 'utf-16le';
      } else if (byteArray[0] === 0xfe && byteArray[1] === 0xff) {
        // UTF-16, Big Endian encoding
        encoding = 'utf-16be';
      }
    }

    if (typeof TextDecoder !== 'undefined') {
      // If TextDecoder is available, we'll try to use it to decode the string.
      const decoder = new TextDecoder(encoding);

      for (let chunkNum = 0; chunkNum < buffer.byteLength / TEXT_FILE_CHUNK_SIZE; chunkNum++) {
        const offset = chunkNum * TEXT_FILE_CHUNK_SIZE;
        const view = new Uint8Array(
          buffer,
          offset,
          Math.min(buffer.byteLength - offset, TEXT_FILE_CHUNK_SIZE)
        );
        const chunk = decoder.decode(view, { stream: true });
        this.chunks.push(chunk);
      }
    } else {
      // JavaScript strings are UTF-16 encoded, but we're reading data from disk
      // that we're going to blindly assume it's ASCII encoded. This codepath
      // only exists for older browser support.

      console.warn('This browser does not support TextDecoder. Decoding text as ASCII.');
      this.chunks.push('');
      for (let i = 0; i < byteArray.length; i++) {
        this.chunks[this.chunks.length - 1] += String.fromCharCode(byteArray[i]);
        // The following line forces V8 to flatten the string for performance.
        // It's unusual syntax but part of the original Speedscope code.
        // @ts-expect-error
        (this.chunks[this.chunks.length - 1] as string) | 0; // Use string type assertion

        if (this.chunks[this.chunks.length - 1].length >= TEXT_FILE_CHUNK_SIZE) {
          this.chunks.push('');
        }
      }
    }
  }

  splitLines(): Iterable<string> {
    const iterator = function* (this: BufferBackedTextFileContent) {
      let lineBuffer: string = '';
      for (const chunk of this.chunks) {
        const fragments = chunk.split('\n');
        for (let i = 0; i < fragments.length; i++) {
          if (i === 0) lineBuffer += fragments[i];
          else {
            yield lineBuffer;
            lineBuffer = fragments[i];
          }
        }
      }

      yield lineBuffer;
    };

    return {
      [Symbol.iterator]: iterator.bind(this),
    };
  }

  firstChunk(): string {
    return this.chunks[0] || '';
  }

  parseAsJSON(deps: Pick<ImporterDependencies, 'parseJsonUint8Array'>): unknown {
    if (this.chunks.length === 1) {
      return permissivelyParseJSONString(this.chunks[0]);
    }
    // Call the adjusted helper, passing the injected parser dependency
    return permissivelyParseJSONUint8Array(this.byteArray, deps);
  }
}

export class StringBackedTextFileContent implements TextFileContent {
  constructor(private s: string) {}

  splitLines(): string[] {
    return this.s.split('\n');
  }

  firstChunk(): string {
    return this.s;
  }

  parseAsJSON(deps: Pick<ImporterDependencies, 'parseJsonUint8Array'>): unknown {
    return permissivelyParseJSONString(this.s);
  }
}

export class TextProfileDataSource implements ProfileDataSource {
  constructor(
    private fileName: string,
    private contents: string
  ) {}
  async name() {
    return this.fileName;
  }

  async readAsArrayBuffer() {
    return new ArrayBuffer(0);
  }

  async readAsText(
    deps: Pick<ImporterDependencies, 'parseJsonUint8Array'>
  ): Promise<TextFileContent> {
    return new StringBackedTextFileContent(this.contents);
  }
}

export class MaybeCompressedDataReader implements ProfileDataSource {
  private uncompressedData: Promise<ArrayBuffer>;

  constructor(
    private namePromise: Promise<string>,
    maybeCompressedDataPromise: Promise<ArrayBuffer>,
    deps: Pick<ImporterDependencies, 'inflate'> // Accept deps object
  ) {
    this.uncompressedData = maybeCompressedDataPromise.then(async (fileData: ArrayBuffer) => {
      try {
        // Use the injected inflate function via deps
        const result = deps.inflate(new Uint8Array(fileData)).buffer;
        return result;
      } catch (e) {
        // If inflate fails, assume it wasn't compressed
        return fileData;
      }
    });
  }

  async name(): Promise<string> {
    return await this.namePromise;
  }

  async readAsArrayBuffer(): Promise<ArrayBuffer> {
    return await this.uncompressedData;
  }

  // Pass only necessary deps
  async readAsText(
    deps: Pick<ImporterDependencies, 'parseJsonUint8Array'>
  ): Promise<TextFileContent> {
    const buffer = await this.readAsArrayBuffer();
    // No need to pass parser to BufferBackedTextFileContent constructor anymore
    return new BufferBackedTextFileContent(buffer);
  }

  // Accept full deps object for creating instance
  static fromFile(file: File, deps: ImporterDependencies): MaybeCompressedDataReader {
    const maybeCompressedDataPromise: Promise<ArrayBuffer> = new Promise((resolve) => {
      const reader = new FileReader();
      reader.addEventListener('loadend', () => {
        if (!(reader.result instanceof ArrayBuffer)) {
          throw new Error('Expected reader.result to be an instance of ArrayBuffer');
        }
        resolve(reader.result);
      });
      reader.readAsArrayBuffer(file);
    });
    return new MaybeCompressedDataReader(
      Promise.resolve(file.name),
      maybeCompressedDataPromise,
      deps
    );
  }

  // Accept full deps object for creating instance
  static fromArrayBuffer(
    name: string,
    buffer: ArrayBuffer,
    deps: ImporterDependencies
  ): MaybeCompressedDataReader {
    return new MaybeCompressedDataReader(Promise.resolve(name), Promise.resolve(buffer), deps);
  }
}
