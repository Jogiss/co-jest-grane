import { supabase } from '../lib/supabase';

export interface GameSuggestion { title: string; year?: string; }

// No built-in games - all loaded from Supabase game_suggestions table

let dbGames: string[] | null = null;
let loadingPromise: Promise<void> | null = null;

async function loadFromSupabase(): Promise<void> {
  if (dbGames !== null) return;
  if (loadingPromise) { await loadingPromise; return; }
  loadingPromise = (async () => {
    try {
      const { data, error } = await supabase.from('game_suggestions').select('title').order('title');
      if (!error && data && data.length > 0) dbGames = data.map((d: any) => d.title);
      else dbGames = [];
    } catch { dbGames = []; }
  })();
  await loadingPromise;
  loadingPromise = null;
}

function normalizeForSearch(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function getAllGames(): string[] {
  return dbGames || [];
}

export async function searchGamesLocal(query: string): Promise<GameSuggestion[]> {
  if (!query || query.trim().length < 2) return [];
  await loadFromSupabase();
  const normalized = normalizeForSearch(query);
  const words = normalized.split(' ').filter(w => w.length > 1);
  if (words.length === 0) return [];
  return getAllGames().filter(game => {
    const normGame = normalizeForSearch(game);
    return words.every(w => {
      if (normGame.includes(w)) return true;
      const textWords = normGame.split(/\s+/);
      return textWords.some(tw => {
        if (Math.abs(tw.length - w.length) > 1) return false;
        let dist = 0;
        const shorter = Math.min(tw.length, w.length);
        const longer = Math.max(tw.length, w.length);
        for (let i = 0; i < shorter; i++) { if (tw[i] !== w[i]) dist++; }
        dist += longer - shorter;
        return dist <= 1;
      });
    });
  }).slice(0, 12).map(game => ({ title: game }));
}

let gameSearchTimeout: ReturnType<typeof setTimeout> | null = null;

export function searchGamesLocalDebounced(query: string, callback: (results: GameSuggestion[]) => void): void {
  if (gameSearchTimeout) clearTimeout(gameSearchTimeout);
  if (!query || query.trim().length < 2) { callback([]); return; }
  gameSearchTimeout = setTimeout(async () => { callback(await searchGamesLocal(query)); }, 100);
}

export function preloadGameSuggestions(): void { loadFromSupabase(); }
