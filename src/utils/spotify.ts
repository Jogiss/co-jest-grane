import { SUPABASE_URL } from '../lib/supabase';

export interface SpotifySuggestion {
  title: string;
  artist: string;
  albumCover?: string;
}

const localCache = new Map<string, { results: SpotifySuggestion[], expires: number }>();
const CACHE_TTL = 10 * 60 * 1000;
let isRateLimited = false;
let rateLimitEnd = 0;
let pendingRequest: Promise<SpotifySuggestion[]> | null = null;
let lastQuery = '';

export function isSpotifyLimited(): boolean {
  if (isRateLimited && Date.now() > rateLimitEnd) isRateLimited = false;
  return isRateLimited;
}

function findInCache(query: string): SpotifySuggestion[] | null {
  const key = query.toLowerCase().trim();
  const exact = localCache.get(key);
  if (exact && exact.expires > Date.now()) return exact.results;
  for (const [cachedKey, cachedVal] of localCache) {
    if (cachedVal.expires < Date.now()) continue;
    if (cachedKey.startsWith(key) || key.startsWith(cachedKey)) {
      const filtered = cachedVal.results.filter(r => {
        const combined = `${r.title} ${r.artist}`.toLowerCase();
        return combined.includes(key);
      });
      if (filtered.length > 0) return filtered;
      if (key.length > cachedKey.length) continue;
      return cachedVal.results;
    }
  }
  return null;
}

export async function searchSpotify(query: string): Promise<SpotifySuggestion[]> {
  if (!query || query.trim().length < 3) return [];
  if (isRateLimited && Date.now() < rateLimitEnd) return [];
  const cached = findInCache(query);
  if (cached) return cached;
  if (pendingRequest && lastQuery === query.toLowerCase().trim()) return pendingRequest;
  lastQuery = query.toLowerCase().trim();
  pendingRequest = (async () => {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/spotify-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'search', query, limit: 8 })
      });
      if (!response.ok) return [];
      const data = await response.json();
      if (data.rate_limited) {
        isRateLimited = true;
        rateLimitEnd = Date.now() + (parseInt(data.retry_after || '60') * 1000);
        return [];
      }
      if (!data.tracks?.items) return [];
      const results: SpotifySuggestion[] = data.tracks.items.map((track: any) => ({
        title: track.name,
        artist: track.artists.map((a: any) => a.name).join(', '),
        albumCover: track.album?.images?.[2]?.url || track.album?.images?.[0]?.url
      }));
      const cacheKey = query.toLowerCase().trim();
      localCache.set(cacheKey, { results, expires: Date.now() + CACHE_TTL });
      if (localCache.size > 200) {
        const now = Date.now();
        for (const [k, v] of localCache) { if (v.expires < now) localCache.delete(k); }
      }
      return results;
    } catch (e) {
      console.error('Spotify search error:', e);
      return [];
    } finally {
      pendingRequest = null;
    }
  })();
  return pendingRequest;
}
