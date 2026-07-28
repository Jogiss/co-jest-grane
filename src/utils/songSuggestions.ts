import { supabase } from '../lib/supabase';

export interface SongSuggestion {
  title: string;
  artist: string;
  albumCover?: string;
}

let songsCache: { title: string; artist: string }[] | null = null;
let loadingPromise: Promise<void> | null = null;
let lastLoadTime = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes cache

function normalizeForSearch(text: string): string {
  return text.toLowerCase().replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e').replace(/ł/g, 'l').replace(/ń/g, 'n').replace(/ó/g, 'o').replace(/ś/g, 's').replace(/ź/g, 'z').replace(/ż/g, 'z').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').trim();
}

async function loadSongs(): Promise<void> {
  // Use cache if fresh
  if (songsCache && Date.now() - lastLoadTime < CACHE_TTL) return;
  if (loadingPromise) { await loadingPromise; return; }
  loadingPromise = (async () => {
    try {
      const existing = new Set<string>();
      const allData: { title: string; artist: string }[] = [];

      const addUnique = (items: any[]) => {
        items.forEach((item: any) => {
          const key = `${item.title}|${item.artist || ''}`.toLowerCase();
          if (item.title && !existing.has(key)) { allData.push({ title: item.title, artist: item.artist || '' }); existing.add(key); }
        });
      };

      // 1. song_suggestions - main table (paginated)
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data: batch } = await supabase.from('song_suggestions').select('title, artist').range(from, from + batchSize - 1);
        if (!batch || batch.length === 0) break;
        addUnique(batch);
        if (batch.length < batchSize) break;
        from += batchSize;
      }

      // 2. Piosenki (daily/piano/beat/reverse) - EXCLUDE Bajki/Gry to avoid mixing with dedicated suggestions
      try {
        const { data } = await supabase.from('Piosenki').select('*');
        if (data) addUnique(data.filter((p: any) => {
          const cat = (p.category || '').toString().trim().toLowerCase();
          return cat !== 'bajki' && cat !== 'bajka' && cat !== 'cartoons' && cat !== 'filmy' && cat !== 'movies' && cat !== 'gry' && cat !== 'gra' && cat !== 'games' && cat !== 'game';
        }).map((p: any) => ({ title: p.title, artist: p.artist || '' })));
      } catch {}

      // 3. event_songs (twórcy events) - usually small
      try { const { data } = await supabase.from('event_songs').select('title, artist'); if (data) addUnique(data); } catch {}

      // 4. community_event_songs (only active) - load IDs first (small), then songs
      try {
        const { data: ids } = await supabase.from('community_events').select('id').eq('status', 'active');
        if (ids && ids.length > 0) {
          const { data } = await supabase.from('community_event_songs').select('title, artist').in('event_id', ids.map((e: any) => e.id));
          if (data) addUnique(data);
        }
      } catch {}

      songsCache = allData;
      lastLoadTime = Date.now();
    } catch (e) { console.error('Error loading songs:', e); if (!songsCache) songsCache = []; }
  })();
  await loadingPromise;
  loadingPromise = null;
}

export async function searchSongSuggestions(query: string): Promise<SongSuggestion[]> {
  if (!query || query.trim().length < 2) return [];
  await loadSongs();
  if (!songsCache || songsCache.length === 0) return [];
  const normalizedQuery = normalizeForSearch(query);
  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 1);
  if (queryWords.length === 0) return [];
  const results = songsCache.filter(song => {
    const combined = normalizeForSearch(`${song.title} ${song.artist}`);
    return queryWords.every(word => {
      if (combined.includes(word)) return true;
      if (word.length >= 3) {
        const textWords = combined.split(/\s+/);
        if (textWords.some(tw => tw.startsWith(word))) return true;
      }
      return false;
    });
  }).slice(0, 30).map(song => ({ title: song.title, artist: song.artist }));
  const seen = new Set<string>();
  return results.filter(r => { const key = `${r.title}|${r.artist}`.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 15);
}

// DON'T preload on startup - load lazily when user starts typing
export function preloadSongSuggestions(): void {
  // No-op: load on first search instead of on page load
}
