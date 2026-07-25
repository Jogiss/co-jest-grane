import { supabase } from '../lib/supabase';

export interface SongSuggestion {
  title: string;
  artist: string;
  albumCover?: string;
}

let songsCache: { title: string; artist: string }[] | null = null;
let loadingPromise: Promise<void> | null = null;

function normalizeForSearch(text: string): string {
  return text.toLowerCase().replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e').replace(/ł/g, 'l').replace(/ń/g, 'n').replace(/ó/g, 'o').replace(/ś/g, 's').replace(/ź/g, 'z').replace(/ż/g, 'z').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').trim();
}

async function loadSongs(): Promise<void> {
  if (songsCache) return;
  if (loadingPromise) { await loadingPromise; return; }
  loadingPromise = (async () => {
    try {
      let allData: { title: string; artist: string }[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data: batch, error: batchErr } = await supabase.from('song_suggestions').select('title, artist').range(from, from + batchSize - 1).order('artist');
        if (batchErr || !batch || batch.length === 0) break;
        allData = allData.concat(batch);
        if (batch.length < batchSize) break;
        from += batchSize;
      }
      // Add from community_event_songs (active events)
      try {
        const { data: activeEvIds } = await supabase.from('community_events').select('id').eq('status', 'active');
        if (activeEvIds && activeEvIds.length > 0) {
          const ids = activeEvIds.map((e: any) => e.id);
          const { data: communityData } = await supabase.from('community_event_songs').select('title, artist').in('event_id', ids);
          if (communityData) {
            const existing = new Set(allData.map(d => `${d.title}|${d.artist}`.toLowerCase()));
            communityData.forEach((cd: any) => {
              const key = `${cd.title}|${cd.artist || ''}`.toLowerCase();
              if (cd.title && !existing.has(key)) { allData.push({ title: cd.title, artist: cd.artist || '' }); existing.add(key); }
            });
          }
        }
      } catch {}
      // Add from Piosenki (daily songs, piano, beat, reverse)
      try {
        const { data: piosenki } = await supabase.from('Piosenki').select('title, artist');
        if (piosenki) {
          const existing = new Set(allData.map(d => `${d.title}|${d.artist}`.toLowerCase()));
          piosenki.forEach((p: any) => {
            const key = `${p.title}|${p.artist || ''}`.toLowerCase();
            if (p.title && !existing.has(key)) { allData.push({ title: p.title, artist: p.artist || '' }); existing.add(key); }
          });
        }
      } catch {}
      // Add from event_songs (twórcy events)
      try {
        const { data: evSongs } = await supabase.from('event_songs').select('title, artist');
        if (evSongs) {
          const existing = new Set(allData.map(d => `${d.title}|${d.artist}`.toLowerCase()));
          evSongs.forEach((es: any) => {
            const key = `${es.title}|${es.artist || ''}`.toLowerCase();
            if (es.title && !existing.has(key)) { allData.push({ title: es.title, artist: es.artist || '' }); existing.add(key); }
          });
        }
      } catch {}
      songsCache = allData;
    } catch (e) { console.error('Error loading songs:', e); songsCache = []; }
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

export function preloadSongSuggestions(): void { loadSongs(); }
