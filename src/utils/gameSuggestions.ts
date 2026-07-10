import { supabase } from '../lib/supabase';

export interface GameSuggestion { title: string; year?: string; }

const BUILTIN_GAMES: string[] = [
  'Grand Theft Auto V', 'GTA V', 'Mortal Kombat', 'The Last Of Us', 'Super Mario Bros',
  'Sea of Thieves', 'Resident Evil', 'Minecraft', 'Crash Bandicoot', 'Elden Ring',
  'Valorant', 'Wiedźmin 3', 'The Witcher 3', 'Tetris', 'GTA San Andreas',
  'Assassin\'s Creed IV Black Flag', 'Skyrim', 'Dying Light', 'Clash Royale',
  'Red Dead Redemption 2', 'Zelda', 'God of War', 'Forza Horizon', 'Undertale',
  'Among Us', 'Doom', 'Team Fortress 2', 'Terraria', 'Portal', 'Subnautica',
  'Hogwarts Legacy', 'Dark Souls 3', 'Hollow Knight', 'Outlast', 'Apex Legends',
  'Geometry Dash', 'Fortnite', 'League of Legends', 'Counter-Strike', 'CS2',
  'Overwatch 2', 'Rocket League', 'FIFA', 'Roblox', 'Cyberpunk 2077',
  'Halo Infinite', 'Fallout 4', 'The Sims 4', 'Stardew Valley', 'Cuphead',
  'Hades', 'Celeste', 'It Takes Two', 'Half-Life 2', 'Dota 2', 'PUBG',
  'Genshin Impact', 'Baldur\'s Gate 3', 'Phasmophobia', 'Dead by Daylight',
  'Five Nights at Freddy\'s', 'FNAF', 'Brawl Stars', 'Clash of Clans',
  'Need for Speed', 'Pokémon', 'Sonic', 'Pac-Man', 'Tomb Raider',
  'Rainbow Six Siege', 'Hitman', 'Mafia', 'Death Stranding',
  'Detroit: Become Human', 'Civilization', 'Age of Empires', 'StarCraft',
  'Cities Skylines', 'Rust', 'Valheim', 'Beat Saber', 'Life is Strange',
];

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
  const all = [...BUILTIN_GAMES];
  if (dbGames && dbGames.length > 0) all.push(...dbGames);
  const seen = new Set<string>();
  return all.filter(g => { const norm = normalizeForSearch(g); if (seen.has(norm)) return false; seen.add(norm); return true; });
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
