import { Cache } from "@raycast/api";

const cache = new Cache();

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * Get a value from cache. Returns `undefined` if missing or expired.
 */
export function getCached<T>(key: string): T | undefined {
  const raw = cache.get(key);
  if (!raw) return undefined;
  try {
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) {
      cache.remove(key);
      return undefined;
    }
    return entry.data;
  } catch {
    cache.remove(key);
    return undefined;
  }
}

/**
 * Store a value in cache with a TTL.
 */
export function setCached<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  const entry: CacheEntry<T> = { data, expiresAt: Date.now() + ttlMs };
  cache.set(key, JSON.stringify(entry));
  trackKey(key);
}

/**
 * Invalidate specific cache keys, or all keys matching a prefix.
 */
export function invalidateCache(...keys: string[]): void {
  for (const key of keys) {
    cache.remove(key);
    untrackKey(key);
  }
}

/** Cache keys used by the Jira module */
export const CACHE_KEYS = {
  activeSprint: "jira:activeSprint",
  sprintIssues: (sprintId: number) => `jira:sprintIssues:${sprintId}`,
} as const;

/**
 * Invalidate all Jira-related caches (sprint + issues).
 */
export function invalidateJiraCache(): void {
  // Remove sprint key
  cache.remove(CACHE_KEYS.activeSprint);
  // Remove any sprintIssues:* keys
  const issuePrefix = "jira:sprintIssues:";
  for (const key of allKeys()) {
    if (key.startsWith(issuePrefix)) {
      cache.remove(key);
    }
  }
}

/**
 * Return all cache keys currently stored.
 * Raycast's Cache doesn't expose an iterator, so we track keys ourselves.
 */
const KEY_INDEX = "__cache_key_index__";

function allKeys(): string[] {
  const raw = cache.get(KEY_INDEX);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

function trackKey(key: string): void {
  const keys = new Set(allKeys());
  keys.add(key);
  cache.set(KEY_INDEX, JSON.stringify([...keys]));
}

function untrackKey(key: string): void {
  const keys = new Set(allKeys());
  keys.delete(key);
  cache.set(KEY_INDEX, JSON.stringify([...keys]));
}
