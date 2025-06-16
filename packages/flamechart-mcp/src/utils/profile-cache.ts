import { stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { ProfileLoadResult, TraceSource } from '../types.js';

// In-memory cache for loaded profiles
interface CacheEntry {
  data: ProfileLoadResult;
  timestamp: number;
  fileModTime?: number; // For local files, track modification time
}

const profileCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes for remote URLs
const MAX_CACHE_SIZE = 50; // Maximum number of cached profiles

function getCacheKey(trace: TraceSource): string {
  // Normalize the trace source for consistent caching
  return trace.trim();
}

async function getFileModTime(filePath: string): Promise<number> {
  try {
    const stats = await stat(filePath);
    return stats.mtime.getTime();
  } catch {
    return 0;
  }
}

function cleanupCache(): void {
  if (profileCache.size <= MAX_CACHE_SIZE) {
    return;
  }

  // Remove oldest entries when cache gets too large
  const entries = Array.from(profileCache.entries());
  entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

  const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
  for (const [key] of toRemove) {
    profileCache.delete(key);
  }
}

async function isCacheValid(cacheEntry: CacheEntry, trace: TraceSource): Promise<boolean> {
  const now = Date.now();

  if (trace.startsWith('http://') || trace.startsWith('https://')) {
    // For remote URLs, use TTL-based cache
    return now - cacheEntry.timestamp < CACHE_TTL_MS;
  } else {
    // For local files, check if file has been modified
    if (!existsSync(trace)) {
      return false; // File no longer exists
    }

    const currentModTime = await getFileModTime(trace);
    return cacheEntry.fileModTime === currentModTime;
  }
}

export async function getCachedProfile(trace: TraceSource): Promise<ProfileLoadResult | null> {
  const cacheKey = getCacheKey(trace);
  const cacheEntry = profileCache.get(cacheKey);

  if (cacheEntry && (await isCacheValid(cacheEntry, trace))) {
    console.log(
      `📁 Using cached profile for: ${trace.length > 80 ? trace.slice(0, 80) + '...' : trace}`
    );
    return cacheEntry.data;
  }

  return null;
}

export async function setCachedProfile(
  trace: TraceSource,
  result: ProfileLoadResult
): Promise<void> {
  const cacheKey = getCacheKey(trace);

  const newCacheEntry: CacheEntry = {
    data: result,
    timestamp: Date.now(),
  };

  // For local files, store the modification time
  if (!trace.startsWith('http://') && !trace.startsWith('https://')) {
    newCacheEntry.fileModTime = await getFileModTime(trace);
  }

  profileCache.set(cacheKey, newCacheEntry);
  cleanupCache();

  console.log(`💾 Cached profile for: ${trace.length > 80 ? trace.slice(0, 80) + '...' : trace}`);
}
