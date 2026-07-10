import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';

export interface MovieSuggestion { title: string; originalTitle?: string; year?: string; poster?: string; }
export interface GameSuggestion { title: string; year?: string; poster?: string; platforms?: string[]; rating?: number; }

interface BajkaRow { title: string; title_pl: string; year: string | null; }

let bajkiCache: BajkaRow[] | null = null;
let bajkiLoading = false;
let movieSearchTimeout: ReturnType<typeof setTimeout> | null = null;

function normalizeForSearch(text: string): string {
  return text.toLowerCase().replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e').replace(/ł/g, 'l').replace(/ń/g, 'n').replace(/ó/g, 'o').replace(/ś/g, 's').replace(/ź/g, 'z').replace(/ż/g, 'z').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

async function loadBajki(): Promise<BajkaRow[]> {
  if (bajkiCache) return bajkiCache;
  if (bajkiLoading) { await new Promise(resolve => setTimeout(resolve, 200)); return bajkiCache || []; }
  bajkiLoading = true;
  try {
    const { data, error } = await supabase.from('bajki_suggestions').select('title, title_pl, year').order('title_pl');
    if (error) { console.error('Error loading bajki:', error); return []; }
    bajkiCache = data || [];
    return bajkiCache;
  } catch (e) { console.error('Error loading bajki:', e); return []; }
  finally { bajkiLoading = false; }
}

export async function searchMovies(query: string): Promise<MovieSuggestion[]> {
  if (!query || query.trim().length < 2) return [];
  const bajki = await loadBajki();
  const normalizedQuery = normalizeForSearch(query);
  const fuzzyIncludes = (text: string, q: string): boolean => {
    if (text.includes(q)) return true;
    const qWords = q.split(/\s+/).filter(w => w.length > 1);
    if (qWords.length === 0) return false;
    const tWords = text.split(/\s+/).filter(w => w.length > 1);
    return qWords.every(qw => tWords.some(tw => {
      if (tw === qw) return true;
      if (qw.length >= 3 && tw.startsWith(qw)) return true;
      if (qw.length >= 4 && Math.abs(tw.length - qw.length) <= 1) {
        let dist = 0;
        for (let i = 0; i < Math.min(tw.length, qw.length); i++) { if (tw[i] !== qw[i]) dist++; }
        dist += Math.abs(tw.length - qw.length);
        if (dist <= 1) return true;
      }
      return false;
    }));
  };
  return bajki.filter(b => {
    const normPl = normalizeForSearch(b.title_pl);
    const normEn = normalizeForSearch(b.title);
    return fuzzyIncludes(normPl, normalizedQuery) || fuzzyIncludes(normEn, normalizedQuery);
  }).slice(0, 8).map(b => ({ title: b.title_pl, originalTitle: b.title_pl !== b.title ? b.title : undefined, year: b.year || undefined }));
}

export function searchMoviesDebounced(query: string, callback: (results: MovieSuggestion[]) => void): void {
  if (movieSearchTimeout) clearTimeout(movieSearchTimeout);
  if (!query || query.trim().length < 2) { callback([]); return; }
  movieSearchTimeout = setTimeout(async () => { callback(await searchMovies(query)); }, 100);
}

const GAME_CACHE_TTL = 3 * 60 * 1000;
const gameCache = new Map<string, { results: GameSuggestion[]; expires: number }>();
let gameSearchTimeout: ReturnType<typeof setTimeout> | null = null;

export async function searchGames(query: string): Promise<GameSuggestion[]> {
  if (!query || query.trim().length < 2) return [];
  const cacheKey = query.toLowerCase().trim();
  const cached = gameCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.results;
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/rawg-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ query, limit: 8 }),
    });
    if (!response.ok) return [];
    const data = await response.json();
    const results: GameSuggestion[] = data.results || [];
    gameCache.set(cacheKey, { results, expires: Date.now() + GAME_CACHE_TTL });
    return results;
  } catch (e) { console.error('Game search error:', e); return []; }
}

export function searchGamesDebounced(query: string, callback: (results: GameSuggestion[]) => void): void {
  if (gameSearchTimeout) clearTimeout(gameSearchTimeout);
  if (!query || query.trim().length < 2) { callback([]); return; }
  gameSearchTimeout = setTimeout(async () => { callback(await searchGames(query)); }, 400);
}
