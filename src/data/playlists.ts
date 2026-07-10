export interface PredefinedPlaylist {
  id: string; name: string; emoji: string; description: string; url: string; color: string;
  tags?: string[]; locked?: boolean; beta?: boolean;
}

export const PREDEFINED_PLAYLISTS: PredefinedPlaylist[] = [
  { id: 'polskie-klasyki', name: 'Polskie Klasyki', emoji: '🇵🇱', description: 'Kultowe polskie piosenki', url: 'https://youtube.com/playlist?list=PLOLiss-l8XmQ', color: 'from-red-500/20 to-white/10', tags: ['polskie'] },
  { id: 'world-hits', name: 'World Hits', emoji: '🌍', description: 'Największe światowe przeboje', url: 'https://www.youtube.com/playlist?list=PL15B1E77BB5708555', color: 'from-blue-500/20 to-cyan-500/20', tags: ['zagraniczne'] },
  { id: 'polski-rap', name: 'Polski Rap', emoji: '🎤', description: 'Polskie rapowe hity', url: 'https://www.youtube.com/playlist?list=PL25Flg-Y3m27lqlxJmMRqsbYf1acVI2u0', color: 'from-gray-600/20 to-gray-900/20', tags: ['polskie'] },
  { id: 'bajki', name: 'Bajki', emoji: '🏰', description: 'Piosenki z bajek', url: 'https://www.youtube.com/playlist?list=PL25Flg-Y3m27CiK4aOrsT5ORjnd0zrVTQ', color: 'from-yellow-500/20 to-pink-500/20', tags: ['bajki'] },
  { id: 'disco-polo', name: 'Disco Polo', emoji: '💃', description: 'Największe hity Disco Polo', url: 'https://www.youtube.com/playlist?list=PL25Flg-Y3m25ez-QAr_uitMYUQYpfFEcL', color: 'from-pink-500/20 to-purple-500/20', tags: ['polskie'] },
  { id: 'rock-classics', name: 'Rock Classics', emoji: '🎸', description: 'Led Zeppelin, Queen, AC/DC...', url: 'https://www.youtube.com/playlist?list=PLS0_p-3xvct8', color: 'from-orange-500/20 to-red-600/20', tags: ['zagraniczne'] },
  { id: '90s-hits', name: 'Lata 90.', emoji: '📼', description: 'Zagraniczne hity z lat 90.', url: 'https://www.youtube.com/playlist?list=PL25Flg-Y3m26T4upyYRPsFAkf6uM8MIAB', color: 'from-purple-500/20 to-pink-500/20', tags: ['zagraniczne'] },
  { id: 'hity-radiowe', name: 'Hity Radiowe', emoji: '📻', description: 'Największe hity radiowe', url: 'https://www.youtube.com/playlist?list=PL25Flg-Y3m25Kx7sc8wOljJyMTqM_qAVz', color: 'from-amber-500/20 to-orange-500/20', tags: ['polskie', 'zagraniczne'] },
  { id: 'gaming-soundtracks', name: 'Gaming Soundtracks', emoji: '🎮', description: 'Muzyka z gier', url: '', color: 'from-green-500/20 to-cyan-500/20', tags: ['gry'], locked: true },
];

const JUNK_PHRASES: string[] = ['official video', 'official audio', 'official music video', 'official lyric video', 'official mv', 'official visualizer', 'music video', 'lyric video', 'lyrics video', 'video clip', 'visualizer', 'audio only', 'audio', 'full song', 'full version', 'extended version', 'radio edit', 'hd', 'full hd', 'hq', '4k', '1080p', '720p', 'remastered', 'remaster', 'live', 'live performance', 'acoustic', 'unplugged', 'cover', 'remix', 'bootleg', 'mashup', 'karaoke', 'instrumental', 'backing track', 'lyrics', 'with lyrics', 'lyric', 'napisy', 'napisy pl', 'teledysk', 'wideoklip', 'klip', 'tekst', 'tekst piosenki', 'slowa', 'piosenka', 'piosenka przewodnia', 'oficjalny teledysk', 'oficjalne wideo', 'oficjalny klip', 'oficjalne audio', 'wersja polska', 'po polsku', 'dubbing pl', 'dubbing', 'polish version', 'intro', 'intro pl', 'opening', 'opening theme', 'ending', 'ending theme', 'outro', 'czolowka', 'czołówka', 'soundtrack', 'original soundtrack', 'ost', 'game ost', 'game soundtrack', 'theme', 'theme song', 'main theme', 'song', 'produced by', 'production', 'produkcja'];
const SORTED_JUNK = [...JUNK_PHRASES].sort((a, b) => b.length - a.length);

export function cleanYouTubeTitle(rawTitle: string): string {
  let title = rawTitle.trim();
  // Remove parentheses, brackets, pipe
  title = title.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').replace(/\|.*$/g, '');
  // Remove "prod. XYZ", "prod XYZ", "produkcja XYZ"  
  title = title.replace(/\s*(?:prod\.?|produkcja|production)\s+.+$/gi, '');
  // Remove feat./ft. sections
  title = title.replace(/\s*(?:feat\.?|ft\.?|featuring)\s+.*/gi, '');
  // Remove junk phrases
  for (const phrase of SORTED_JUNK) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|\\s)(${escaped})(?:$|\\s)`, 'gi');
    title = title.replace(regex, ' ');
  }
  title = title.replace(/\(\s*\)/g, '').replace(/\[\s*\]/g, '').replace(/\s*[-–—]\s*$/, '').replace(/\s+/g, ' ').trim();
  return title || rawTitle.trim();
}

export interface TitleVariants { titleParts: string[]; artistParts: string[]; }

export function getTitleVariants(rawTitle: string): TitleVariants {
  const cleaned = cleanYouTubeTitle(rawTitle);
  const titleParts: string[] = [];
  const artistParts: string[] = [];
  const separators = [' - ', ' – ', ' — '];
  let splitFound = false;
  for (const sep of separators) {
    if (cleaned.includes(sep)) {
      const parts = cleaned.split(sep).map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        artistParts.push(parts[0]);
        let titleRaw = parts.slice(1).join(sep).trim();
        // Extract feat/ft artists from title part
        const featMatch = titleRaw.match(/(?:feat|ft|fit|featuring)\.?\s+(.+)/i);
        if (featMatch) {
          const featArtists = featMatch[1].split(/[,&]/).map(a => a.trim()).filter(a => a.length > 2);
          // Remove prod from feat artists
          const cleanFeat = featArtists.map(a => a.replace(/\s*(?:prod|produkcja|production)\.?\s+.*/i, '').trim()).filter(a => a.length > 2);
          artistParts.push(...cleanFeat);
          titleRaw = titleRaw.replace(/\s*(?:feat|ft|fit|featuring)\.?\s+.+/i, '').trim();
        }
        // Extract prod artists
        const prodMatch = titleRaw.match(/(?:prod|produkcja|production)\.?\s+(.+)/i);
        if (prodMatch) {
          const prodArtists = prodMatch[1].split(/[,&]/).map(a => a.trim()).filter(a => a.length > 2);
          artistParts.push(...prodArtists);
          titleRaw = titleRaw.replace(/\s*(?:prod|produkcja|production)\.?\s+.+/i, '').trim();
        }
        if (titleRaw.length > 1) titleParts.push(titleRaw);
        // Also handle comma-separated parts in title (e.g. "Title, feat Artist")
        if (titleRaw.includes(',')) {
          const commaParts = titleRaw.split(',').map(p => p.trim()).filter(Boolean);
          if (commaParts.length > 1 && commaParts[0].length > 1) titleParts.push(commaParts[0]);
        }
      }
      splitFound = true; break;
    }
  }
  if (!splitFound) {
    // No separator found - try to extract prod from the whole string
    let t = cleaned;
    const pm = t.match(/(?:prod|produkcja|production)\.?\s+(.+)/i);
    if (pm) {
      artistParts.push(...pm[1].split(/[,&]/).map(a => a.trim()).filter(a => a.length > 2));
      t = t.replace(/\s*(?:prod|produkcja|production)\.?\s+.+/i, '').trim();
    }
    if (t.length > 1) titleParts.push(t);
  }
  return { titleParts: [...new Set(titleParts.filter(v => v.length > 1))], artistParts: [...new Set(artistParts.filter(v => v.length > 1))] };
}

export const PLAYLIST_CATEGORIES = [
  { id: 'all' as const, label: 'Wszystkie', emoji: '🎵' },
  { id: 'polskie' as const, label: 'Polskie', emoji: '🇵🇱' },
  { id: 'zagraniczne' as const, label: 'Zagraniczne', emoji: '🌍' },
  { id: 'bajki' as const, label: 'Bajki', emoji: '🎬' },
  { id: 'gry' as const, label: 'Gry', emoji: '🎮' },
];

export type PlaylistCategory = typeof PLAYLIST_CATEGORIES[number]['id'];
