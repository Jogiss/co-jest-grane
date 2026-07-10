import { searchSpotify, isSpotifyLimited, type SpotifySuggestion } from './spotify';
import { searchSongSuggestions as searchLocal, preloadSongSuggestions } from './songSuggestions';

export type SongSuggestion = SpotifySuggestion;

let combinedTimeout: ReturnType<typeof setTimeout> | null = null;

export async function searchSongs(query: string): Promise<{ spotify: SongSuggestion[]; local: SongSuggestion[] }> {
  if (!query || query.trim().length < 3) return { spotify: [], local: [] };
  const localResults = await searchLocal(query);
  let spotifyResults: SongSuggestion[] = [];
  if (!isSpotifyLimited()) {
    try { spotifyResults = await searchSpotify(query); } catch {}
  }
  return { spotify: spotifyResults, local: localResults };
}

export async function searchSongsFlat(query: string): Promise<SongSuggestion[]> {
  const { spotify, local } = await searchSongs(query);
  const spotifyTitles = new Set(spotify.map(r => `${r.title}|${r.artist}`.toLowerCase()));
  const uniqueLocal = local.filter(s => !spotifyTitles.has(`${s.title}|${s.artist}`.toLowerCase()));
  return [...spotify, ...uniqueLocal];
}

export function searchSongsDebounced(query: string, callback: (results: SongSuggestion[]) => void): void {
  if (combinedTimeout) clearTimeout(combinedTimeout);
  if (!query || query.trim().length < 3) { callback([]); return; }
  combinedTimeout = setTimeout(async () => {
    const results = await searchSongsFlat(query);
    callback(results);
  }, 700);
}

export { preloadSongSuggestions };
