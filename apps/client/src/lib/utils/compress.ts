// import { Pako } from 'pako'; // Removed as pako is imported dynamically

// Helper function to convert stream to ArrayBuffer
async function streamToArrayBuffer(stream: ReadableStream<Uint8Array>): Promise<ArrayBuffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
    }
  }
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result.buffer;
}

// Compresses data using CompressionStream or pako fallback
export async function gzipCompress(data: ArrayBuffer): Promise<ArrayBuffer> {
  if (typeof CompressionStream === 'function') {
    try {
      const cs = new CompressionStream('gzip');
      const writer = cs.writable.getWriter();
      writer.write(data);
      writer.close();
      return await streamToArrayBuffer(cs.readable);
    } catch (e) {
      console.warn('CompressionStream failed, falling back to pako.', e);
      // Fall through to pako if CompressionStream fails (e.g., unsupported format)
    }
  }

  console.log('Using pako for compression.');
  const { gzip } = await import('pako');
  // Type assertion needed because pako types might not align perfectly with ArrayBuffer
  const compressedData = gzip(new Uint8Array(data));
  return compressedData.buffer;
}

// Decompresses data using DecompressionStream or pako fallback
export async function gzipDecompress(data: ArrayBuffer): Promise<ArrayBuffer> {
  if (typeof DecompressionStream === 'function') {
    try {
      const ds = new DecompressionStream('gzip');
      const writer = ds.writable.getWriter();
      writer.write(data);
      writer.close();
      return await streamToArrayBuffer(ds.readable);
    } catch (e) {
      console.warn('DecompressionStream failed, falling back to pako.', e);
      // Fall through to pako if DecompressionStream fails
    }
  }

  console.log('Using pako for decompression.');
  const { ungzip } = await import('pako');
  // Type assertion needed because pako types might not align perfectly with ArrayBuffer
  const decompressedData = ungzip(new Uint8Array(data));
  return decompressedData.buffer;
}

// Type alias for Pako library if needed elsewhere, though dynamic import is preferred
// export type PakoType = typeof Pako; // Removed as pako is imported dynamically
