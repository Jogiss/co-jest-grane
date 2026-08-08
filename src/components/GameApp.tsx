'use client';

import React, { useState, useEffect } from 'react';
import { audioEngine } from '../utils/audioEngine';
import { Song, Category, GameMode } from '../constants/songs';
import { Music, Play, RotateCcw, Volume2, Piano, Drum, ArrowLeft, VolumeX, CheckCircle, XCircle, Settings, HelpCircle, X, Lock, ChevronLeft, ChevronRight, Music2, Clock, Gift, Flame, User, Award, LogIn, Cloud, CloudOff, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';
import { MovieSuggestion, GameSuggestion, searchMoviesDebounced, searchGamesDebounced } from '../utils/suggestions';
import { searchGamesLocalDebounced, preloadGameSuggestions } from '../utils/gameSuggestions';
import { SongSuggestion, searchSongsDebounced, preloadSongSuggestions } from '../utils/songSearch';
import { COUNTRIES, COUNTRY_CONTINENTS } from '../data/countries';
import PlayerProfile from './PlayerProfile';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import MultiplayerMode from './MultiplayerMode';
import CommunityEvents from './CommunityEvents';

type GameView = 'menu' | 'mode_select' | 'category_select' | 'calendar' | 'playing' | 'result';
type Theme = 'indigo' | 'emerald' | 'rose' | 'amber' | 'cyan' | 'purple' | 'red' | 'lime' | 'sky' | 'pink' | 'orange' | 'teal';

const ATTEMPT_TIMES = [0.5, 1, 3, 5, 8, 20];
const MAX_GUESS_LENGTH = 100;
const DAILY_REWARD_BASE = 25;
const WEEKLY_BONUS = 100;

const GameAppWrapper: React.FC = () => {
  return (
    <AuthProvider>
      <GameAppInner />
    </AuthProvider>
  );
};

const GameAppInner: React.FC = () => {
  const { user, userId, nickname, setNickname, progress, updateProgress } = useAuth();
  const userIdRef = React.useRef(userId);
  React.useEffect(() => { userIdRef.current = userId; }, [userId]);
  const nicknameRef = React.useRef(nickname);
  React.useEffect(() => { nicknameRef.current = nickname; }, [nickname]);

  const [view, setView] = useState<GameView>('menu');
  const [gameMode, setGameMode] = useState<GameMode>('piano');
  const [currentCategory, setCurrentCategory] = useState<Category>('Polskie');
  const [songs, setSongs] = useState<Song[]>([]);
  const [activeEventSlug, setActiveEventSlug] = useState<string | null>(null);
  const [activeEventName, setActiveEventName] = useState<string>('');
  const [activeEventNum, setActiveEventNum] = useState<number>(1);
  const activeEventSongsRef = React.useRef<any[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [theme, setTheme] = useState<Theme>('indigo');
  const [showSettings, setShowSettings] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showMultiplayer, setShowMultiplayer] = useState(() => {
    try { const params = new URLSearchParams(window.location.search); return !!params.get('join'); } catch { return false; }
  });
  const [showWelcome, setShowWelcome] = useState(() => {
    try { return !localStorage.getItem('mm_welcomed'); } catch { return true; }
  });
  const [showCommunity, setShowCommunity] = useState(false);
  const [welcomeNick, setWelcomeNick] = useState('');
  const [guessTitle, setGuessTitle] = useState('');
  const [guessArtist, setGuessArtist] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [volume, setVolume] = useState(() => {
    try {
      const saved = localStorage.getItem('mm_volume');
      const v = saved ? parseFloat(saved) : 0.5;
      audioEngine.setVolume(v);
      return v;
    } catch { return 0.5; }
  });
  const updateVolume = (val: number) => {
    setVolume(val);
    audioEngine.setVolume(val);
    try { localStorage.setItem('mm_volume', String(val)); } catch {}
  };
  const [feedback, setFeedback] = useState<{ title: boolean, artist: boolean }>({ title: false, artist: false });
  const [closeHint, setCloseHint] = useState<{ show: boolean, type: 'title' | 'artist' | 'both' | null }>({ show: false, type: null });
  const [history, setHistory] = useState<{title: string, artist: string, status: 'correct' | 'partial' | 'wrong' | 'skipped'}[]>([]);
  const stats = progress.stats;
  const completedDays = progress.completedDays;
  const dailyStreak = progress.dailyStreak;
  const lastDailyReward = progress.lastDailyReward;
  const showStatsPanel = progress.showStatsPanel;
  const autoPlayAfterGame = progress.autoPlayAfterGame;
  const unlockedAchievements = progress.achievements;
  const [showDailyReward, setShowDailyReward] = useState(false);
  const [partialPointsEarned, setPartialPointsEarned] = useState(0);
  const [spotifySuggestions, setSpotifySuggestions] = useState<SongSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [movieSuggestions, setMovieSuggestions] = useState<MovieSuggestion[]>([]);
  const [gameSuggestions, setGameSuggestions] = useState<GameSuggestion[]>([]);
  const [countrySuggestions, setCountrySuggestions] = useState<string[]>([]);
  const [expandedMode, setExpandedMode] = useState<GameMode | null>(null);

  const themeConfig: Record<Theme, { primary: string; text: string; border: string; shadow: string; gradient: string; hover: string }> = {
    indigo: { primary: 'bg-indigo-600', text: 'text-indigo-400', border: 'border-indigo-500', shadow: 'shadow-indigo-500/20', gradient: 'from-indigo-950', hover: 'hover:bg-indigo-500' },
    emerald: { primary: 'bg-emerald-600', text: 'text-emerald-400', border: 'border-emerald-500', shadow: 'shadow-emerald-500/20', gradient: 'from-emerald-950', hover: 'hover:bg-emerald-500' },
    rose: { primary: 'bg-rose-600', text: 'text-rose-400', border: 'border-rose-500', shadow: 'shadow-rose-500/20', gradient: 'from-rose-950', hover: 'hover:bg-rose-500' },
    amber: { primary: 'bg-amber-600', text: 'text-amber-400', border: 'border-amber-500', shadow: 'shadow-amber-500/20', gradient: 'from-amber-950', hover: 'hover:bg-amber-500' },
    cyan: { primary: 'bg-cyan-600', text: 'text-cyan-400', border: 'border-cyan-500', shadow: 'shadow-cyan-500/20', gradient: 'from-cyan-950', hover: 'hover:bg-cyan-500' },
    purple: { primary: 'bg-purple-600', text: 'text-purple-400', border: 'border-purple-500', shadow: 'shadow-purple-500/20', gradient: 'from-purple-950', hover: 'hover:bg-purple-500' },
    red: { primary: 'bg-red-600', text: 'text-red-400', border: 'border-red-500', shadow: 'shadow-red-500/20', gradient: 'from-red-950', hover: 'hover:bg-red-500' },
    lime: { primary: 'bg-lime-600', text: 'text-lime-400', border: 'border-lime-500', shadow: 'shadow-lime-500/20', gradient: 'from-lime-950', hover: 'hover:bg-lime-500' },
    sky: { primary: 'bg-sky-600', text: 'text-sky-400', border: 'border-sky-500', shadow: 'shadow-sky-500/20', gradient: 'from-sky-950', hover: 'hover:bg-sky-500' },
    pink: { primary: 'bg-pink-600', text: 'text-pink-400', border: 'border-pink-500', shadow: 'shadow-pink-500/20', gradient: 'from-pink-950', hover: 'hover:bg-pink-500' },
    orange: { primary: 'bg-orange-600', text: 'text-orange-400', border: 'border-orange-500', shadow: 'shadow-orange-500/20', gradient: 'from-orange-950', hover: 'hover:bg-orange-500' },
    teal: { primary: 'bg-teal-600', text: 'text-teal-400', border: 'border-teal-500', shadow: 'shadow-teal-500/20', gradient: 'from-teal-950', hover: 'hover:bg-teal-500' },
  };

  const currentTheme = themeConfig[theme];
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [gameStatus, setGameStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [streak, setStreak] = useState(0);
  const [nickError, setNickError] = useState<string | null>(null);
  const [globalStats, setGlobalStats] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [leaderboard, setLeaderboard] = useState<{username: string, score: number, rank: number, odwiedza: string, wins: number, total_games: number}[]>([]);
  const [leaderboardTab, setLeaderboardTab] = useState<10 | 100 | 500>(10);
  const [topPlayers, setTopPlayers] = useState<{nickname: string, points: number}[]>([]);
  const [activeModal, setActiveModal] = useState<'none' | 'tos' | 'privacy' | 'contact' | 'leaderboard' | 'howtoplay' | 'feedback'>('none');
  const [showProfile, setShowProfile] = useState(false);
  const [pinnedAchievements, setPinnedAchievements] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('mm_pinned_achievements') || '[]'); } catch { return []; }
  });
  const handlePinAchievement = (ids: string[]) => {
    setPinnedAchievements(ids);
    localStorage.setItem('mm_pinned_achievements', JSON.stringify(ids));
  };
  const [newsItems, setNewsItems] = useState<{ id: number; tresc: string; emoji: string; created_at: string }[]>([]);
  const [newsExpanded, setNewsExpanded] = useState(false);
  const [globalAlert, setGlobalAlert] = useState<{ id: number; tresc: string; emoji: string; typ: string } | null>(null);
  const [globalAlertDismissed, setGlobalAlertDismissed] = useState(false);
  const [_globalAlertShownThisSession, setGlobalAlertShownThisSession] = useState(false);

  interface GameEvent {
    id: number;
    name: string;
    description: string;
    emoji: string;
    slug: string;
    aktywny: boolean;
    created_at: string;
    color?: string;
  }
  interface EventSong {
    id: number;
    event_slug: string;
    title: string;
    artist: string;
    category: string;
    audio_url: string;
    preview_start: number;
    youtube_url?: string;
    date?: string;
    label?: string;
  }
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [eventTotalSongs, setEventTotalSongs] = useState<Record<string, number>>({});
  const [showEvents, setShowEvents] = useState(false);
  const [eventFilter, setEventFilter] = useState<'all' | 'done' | 'started' | 'new'>('all');
  const [selectedEvent, setSelectedEvent] = useState<GameEvent | null>(null);
  const [eventSongs, setEventSongs] = useState<EventSong[]>([]);
  const [playerRank, setPlayerRank] = useState<number | null>(null);
  const [playerPoints, setPlayerPoints] = useState(0);
  const [achievementPopup, setAchievementPopup] = useState<{ name: string, icon: string } | null>(null);
  const [viewingPlayer, setViewingPlayer] = useState<{ nickname: string, points: number, wins: number, total_games: number, rank: number, odwiedza: string } | null>(null);
  const [onlinePlayers, setOnlinePlayers] = useState(1);
  const [ankietaLink, setAnkietaLink] = useState<string | null>(null);

  useEffect(() => {
    if (progress.theme && progress.theme in themeConfig) setTheme(progress.theme as Theme);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.theme]);

  const getTodayDate = () => {
    const now = new Date(); const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];
  };

  const claimDailyReward = async () => {
    const today = getTodayDate();
    const now = new Date();
    const localNow = new Date(now.getTime() - (now.getTimezoneOffset() * 60 * 1000));
    const localYesterday = new Date(localNow.getTime() - 24 * 60 * 60 * 1000);
    const yesterday = localYesterday.toISOString().split('T')[0];
    let newStreak = 1;
    if (lastDailyReward === yesterday) newStreak = dailyStreak + 1;
    else if (lastDailyReward === today) { setShowDailyReward(false); return; }
    const isWeeklyBonus = newStreak > 0 && newStreak % 7 === 0;
    const reward = DAILY_REWARD_BASE + (isWeeklyBonus ? WEEKLY_BONUS : 0);
    await updateProgress({ dailyStreak: newStreak, lastDailyReward: today });
    setShowDailyReward(false);
    const currentId = userIdRef.current; const currentNick = nicknameRef.current;
    if (currentId) {
      try {
        await supabase.from('game_results').insert([{
          user_id: currentId,
          nickname: currentNick.trim(),
          points: reward,
          is_win: false,
          result_type: 'daily_reward',
        }]);
      } catch (e) { console.error("Daily reward save error:", e); }
    }
    audioEngine.playUiSuccess();
    confetti({ particleCount: 50, spread: 40, origin: { y: 0.3, x: 0.9 } });
    setTimeout(() => fetchPlayerRank(), 500);
  };

  const fetchGlobalStats = async (songId: string) => {
    try {
      const counts = [0, 0, 0, 0, 0, 0, 0];
      // 1. Read aggregated data (1 row per song — fast!)
      const { data: agg } = await supabase.from('wyniki_aggregate').select('a1,a2,a3,a4,a5,a6,ax').eq('song_id', songId).maybeSingle();
      if (agg) { counts[0]=agg.a1||0; counts[1]=agg.a2||0; counts[2]=agg.a3||0; counts[3]=agg.a4||0; counts[4]=agg.a5||0; counts[5]=agg.a6||0; counts[6]=agg.ax||0; }
      // 2. Add fresh (non-aggregated) wyniki on top
      const { data: fresh } = await supabase.from('wyniki').select('attempt').eq('song_id', songId).limit(200);
      if (fresh) fresh.forEach((r: any) => { const idx = (r.attempt === 0 || r.attempt === 7) ? 6 : r.attempt - 1; if (idx >= 0 && idx <= 6) counts[idx]++; });
      setGlobalStats(counts);
    } catch { setGlobalStats([0, 0, 0, 0, 0, 0, 0]); }
  };

  const oldAnonUid = typeof window !== 'undefined' ? (localStorage.getItem('mm_uid') || '') : '';
  const allMyIds = [userId, oldAnonUid].filter(Boolean);

  const containsBannedWord = (text: string): boolean => {
    const BANNED_WORDS = ['cwel','kurwa','kurw','chuj','chuja','cipa','cipka','jebac','jebać','jebany','pierdol','szmata','dziwka','suka','pedal','pedał','frajer','nigger','niger','nigga','hitler','nazi','heil','faggot','retard','fuck','shit','bitch','asshole','dick','pussy','whore','slut','kurwy','chuje','pierdole','jeban','wypierdal','spierdalaj','debil','idiota','pojeb'];
    const normalized = normalizeText(text);
    const compact = normalized.replace(/\s+/g, '');
    const separatorsCollapsed = text.toLowerCase().replace(/[^a-zA-Z0-9ąćęłńóśźż]/g, '').replace(/ą/g,'a').replace(/ć/g,'c').replace(/ę/g,'e').replace(/ł/g,'l').replace(/ń/g,'n').replace(/ó/g,'o').replace(/ś/g,'s').replace(/ź/g,'z').replace(/ż/g,'z');
    return BANNED_WORDS.some(word => { const banned = normalizeText(word); const bannedCompact = banned.replace(/\s+/g, ''); return normalized.includes(banned) || compact.includes(bannedCompact) || separatorsCollapsed.includes(bannedCompact); });
  };

  // Rate limiting - max 10 results per minute
  const resultTimestampsRef = React.useRef<number[]>([]);
  const isRateLimited = (): boolean => {
    const now = Date.now();
    resultTimestampsRef.current = resultTimestampsRef.current.filter(t => now - t < 60000);
    if (resultTimestampsRef.current.length >= 10) return true;
    resultTimestampsRef.current.push(now);
    return false;
  };

  const recordResultGlobal = async (songId: string, attemptNum: number, partialPts: number = 0) => {
    if (isRateLimited()) { console.warn('Rate limited - too many results'); return; }
    const currentUserId = userIdRef.current; const currentNick = nicknameRef.current;
    try {
      const dbAttempt = (attemptNum === 0 || attemptNum > 6) ? 7 : attemptNum;
      await supabase.from('wyniki').insert([{ song_id: songId, attempt: dbAttempt }]);
      let cleanNick = currentNick.trim();
      if (!cleanNick || containsBannedWord(cleanNick)) { cleanNick = `Gracz${Math.floor(10000 + Math.random() * 90000)}`; setNickname(cleanNick); }
      const basePoints = (attemptNum >= 1 && attemptNum <= 6) ? [100, 80, 60, 40, 20, 10][attemptNum - 1] : 0;
      const totalPoints = basePoints + partialPts;
      const isWin = attemptNum >= 1 && attemptNum <= 6;
      if (!currentUserId) return;
      await supabase.from('game_results').insert([{
        user_id: currentUserId,
        nickname: cleanNick,
        song_id: songId,
        attempt: dbAttempt,
        points: totalPoints,
        is_win: isWin,
        result_type: 'game',
      }]);
      setTimeout(() => fetchPlayerRank(), 500);
    } catch (e) { console.error("[POINTS] Database save error:", e); }
  };

  const isMyLeaderboardEntry = (entryUserId: string): boolean => allMyIds.includes(entryUserId);

  const fetchPlayerRank = async () => {
    const currentUid = userIdRef.current; const anonUid = typeof window !== 'undefined' ? (localStorage.getItem('mm_uid') || '') : '';
    const myIds = [currentUid, anonUid].filter(Boolean);
    if (myIds.length === 0) return;
    try {
      for (const id of myIds) {
        const { data } = await supabase.from('leaderboard_view').select('points, wins, total_games').eq('user_id', id).maybeSingle();
        if (data) {
          setPlayerPoints(data.points || 0);
          const { count } = await supabase.from('leaderboard_view').select('*', { count: 'exact', head: true }).gt('points', data.points || 0);
          setPlayerRank((count || 0) + 1);
          return;
        }
      }
      setPlayerPoints(0); setPlayerRank(null);
    } catch { /* noop */ }
  };

  const ACHIEVEMENT_DEFS = [
    { id: 'first_win', name: 'Pierwsza Wygrana', icon: '🎉', check: (s: any) => s.wins >= 1 },
    { id: 'wins_10', name: 'Dziesięć!', icon: '🔟', check: (s: any) => s.wins >= 10 },
    { id: 'wins_25', name: 'Ćwierć setki', icon: '💪', check: (s: any) => s.wins >= 25 },
    { id: 'wins_50', name: 'Pół setki', icon: '🏆', check: (s: any) => s.wins >= 50 },
    { id: 'wins_100', name: 'Setka!', icon: '💯', check: (s: any) => s.wins >= 100 },
    { id: 'perfect', name: 'Bezbłędny', icon: '⚡', check: (s: any) => s.firstTryWins >= 1 },
    { id: 'perfect_5', name: 'Mistrz intuicji', icon: '🧠', check: (s: any) => s.firstTryWins >= 5 },
    { id: 'streak_3', name: 'Dobra passa', icon: '🔥', check: (s: any) => s.bestStreak >= 3 },
    { id: 'streak_7', name: 'Nie do zdarcia', icon: '💎', check: (s: any) => s.bestStreak >= 7 },
    { id: 'streak_15', name: 'Legenda', icon: '👑', check: (s: any) => s.bestStreak >= 15 },
    { id: 'daily_3', name: 'Stały bywalec', icon: '📅', check: (s: any) => s.dailyStreak >= 3 },
    { id: 'daily_7', name: 'Tygodniowy wojownik', icon: '🗓️', check: (s: any) => s.dailyStreak >= 7 },
    { id: 'games_10', name: 'Rozgrzewka', icon: '🎮', check: (s: any) => s.total >= 10 },
    { id: 'games_50', name: 'Weteran', icon: '🎖️', check: (s: any) => s.total >= 50 },
    { id: 'all_modes', name: 'Wszechstronny', icon: '🌟', check: (s: any) => s.modesWon >= 4 },
    { id: 'all_cats', name: 'Eksplorator', icon: '🗺️', check: (s: any) => s.catsWon >= 4 },
  ];

  const computeAchievementData = () => {
    const entries = Object.entries(completedDays);
    const finished = entries.filter(([, v]) => v.status !== 'playing');
    const won = finished.filter(([, v]) => v.status === 'won');
    const firstTryWins = won.filter(([, v]) => v.attempt === 1).length;
    let bestStreak = 0; let cur = 0;
    const sorted = [...finished].sort(([a], [b]) => a.localeCompare(b));
    sorted.forEach(([, v]) => { if (v.status === 'won') { cur++; bestStreak = Math.max(bestStreak, cur); } else { cur = 0; } });
    const modesWon = (['klasyczny', 'piano', 'beat', 'reverse']).filter(mode => finished.some(([key, v]) => key.includes(`-${mode}-`) && v.status === 'won')).length;
    const catsWon = (['Polskie', 'Zagraniczne', 'Bajki', 'Gry']).filter(cat => finished.some(([key, v]) => key.endsWith(`-${cat}`) && v.status === 'won')).length;
    return { total: stats.total, wins: stats.wins, firstTryWins, bestStreak, dailyStreak, modesWon, catsWon, rank: playerRank };
  };

  const checkNewAchievements = async () => {
    const data = computeAchievementData();
    const currentlyUnlocked = ACHIEVEMENT_DEFS.filter(a => a.check(data)).map(a => a.id);
    const newOnes = currentlyUnlocked.filter(id => !unlockedAchievements.includes(id));
    if (newOnes.length > 0) {
      const firstNew = ACHIEVEMENT_DEFS.find(a => a.id === newOnes[0]);
      if (firstNew) { setAchievementPopup({ name: firstNew.name, icon: firstNew.icon }); audioEngine.playUiSuccess(); setTimeout(() => setAchievementPopup(null), 4000); }
      await updateProgress({ achievements: currentlyUnlocked });
    }
  };

  const openProfile = () => { fetchPlayerRank(); setShowProfile(true); };

  const fetchLeaderboard = async (tab: 10 | 100 | 500 = 10) => {
    try {
      const ranges: Record<number, { from: number; to: number }> = { 10: { from: 0, to: 10 }, 100: { from: 10, to: 100 }, 500: { from: 100, to: 500 } };
      const range = ranges[tab];
      const { data, error } = await supabase.from('leaderboard_view').select('nickname, points, user_id, wins, total_games').order('points', { ascending: false }).range(range.from, range.to - 1);
      if (error) { setLeaderboard([]); return; }
      if (data) setLeaderboard(data.map((d: any, i: number) => ({ username: d.nickname, score: d.points, rank: range.from + i + 1, odwiedza: d.user_id, wins: d.wins || 0, total_games: d.total_games || 0 })));
      else setLeaderboard([]);
    } catch { setLeaderboard([]); }
  };

  useEffect(() => {
    setTimeout(() => { const today = getTodayDate(); if (lastDailyReward !== today) setShowDailyReward(true); }, 1000);
    const savedUid = userId || (typeof window !== 'undefined' ? localStorage.getItem('mm_uid') : null) || 'anon';
    const channel = supabase.channel('online-players', { config: { presence: { key: savedUid } } });
    channel.on('presence', { event: 'sync' }, () => { const state = channel.presenceState(); setOnlinePlayers(Object.keys(state).length); });
    channel.subscribe(async (status) => { if (status === 'SUBSCRIBED') await channel.track({ online_at: new Date().toISOString() }); });
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, lastDailyReward]);

  const updateNickname = (newName: string) => { setNickname(newName.slice(0, 15)); setNickError(null); };

  const handleNicknameBlur = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) { setNickname(`Gracz${Math.floor(1000 + Math.random() * 9000)}`); setNickError(null); return; }
    if (containsBannedWord(trimmed)) { setNickError('Nick zawiera niedozwolone słowa!'); return; }
    const { data } = await supabase.from('leaderboard_view').select('user_id').eq('nickname', trimmed).neq('user_id', userId).limit(1);
    if (data && data.length > 0) setNickError('Ten nick jest już zajęty!');
    else setNickError(null);
  };

  const toggleStatsPanel = async () => { await updateProgress({ showStatsPanel: !showStatsPanel }); };

  const saveSession = async (status: 'won' | 'lost' | 'playing', currentAttempt: number, currentHistory: any[], currentFeedback: any, partialPts: number = 0) => {
    if (!currentSong) return;
    const dayKey = activeEventSlug ? currentSong.id : `${currentSong.date}-${currentSong.mode}-${currentSong.category}`;
    if (completedDays[dayKey] && completedDays[dayKey].status !== 'playing') return;
    let newStats = { ...stats };
    if (status !== 'playing' && (!completedDays[dayKey] || completedDays[dayKey].status === 'playing')) {
      newStats = { total: stats.total + 1, wins: status === 'won' ? stats.wins + 1 : stats.wins };
    }
    const newCompletedDays = { ...completedDays, [dayKey]: { status, attempt: currentAttempt, history: currentHistory, feedback: status !== 'playing' ? { title: true, artist: true } : currentFeedback, partialPoints: partialPts } };
    await updateProgress({ stats: newStats, completedDays: newCompletedDays });
  };

  useEffect(() => {
    const fetchSongs = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.from('Piosenki').select('*');
        if (error) setErrorMessage(`Błąd Supabase: ${error.message}`);
        else if (data) {
          const mappedSongs = data.map((s: any, index: number) => {
            const rawCat = (s.category || "").trim().toLowerCase();
            let normalizedCat: Category = 'Polskie';
            if (rawCat === 'zagraniczne' || rawCat === 'foreign') normalizedCat = 'Zagraniczne';
            if (rawCat === 'bajki' || rawCat === 'cartoons' || rawCat === 'filmy' || rawCat === 'movies') normalizedCat = 'Bajki';
            if (rawCat === 'gry' || rawCat === 'games') normalizedCat = 'Gry';
            const rawMode = (s.mode || "piano").trim().toLowerCase();
            let normalizedMode: GameMode = 'piano';
            if (rawMode === 'beat' || rawMode === 'bity') normalizedMode = 'beat';
            else if (rawMode === 'reverse' || rawMode === 'od tylu') normalizedMode = 'reverse';
            else if (rawMode === 'klasyczny') normalizedMode = 'klasyczny';
            let rawDate = (s.date || s.data || s.created_at || '').toString().split('T')[0].split(' ')[0].trim();
            const normalizedDate = rawDate.replace(/\./g, '-');
            return { id: s.id ? s.id.toString() : `song-${index}`, title: s.title || "Nieznany tytuł", artist: s.artist || "Nieznany artysta", category: normalizedCat, mode: normalizedMode, audioUrl: (s.audio_url || "").trim(), previewStart: isNaN(Number(s.preview_start)) ? 0 : Number(s.preview_start), date: normalizedDate || undefined, gatunek: s.gatunek || undefined, youtubeUrl: s.youtube_url || undefined };
          });
          setSongs(mappedSongs);
        }
      } catch (err: any) { setErrorMessage(`Błąd krytyczny: ${err.message}`); }
      finally { setIsLoading(false); }
    };
    fetchSongs();
    const fetchNews = async () => { try { const { data } = await supabase.from('aktualnosci').select('*').eq('aktywny', true).order('created_at', { ascending: false }).limit(5); if (data && data.length > 0) setNewsItems(data); } catch {} };
    fetchNews();
    const fetchGlobalAlert = async () => {
      try {
        const { data } = await supabase.from('global_alerts').select('*').eq('aktywny', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (data) { setGlobalAlert(data); setGlobalAlertDismissed(false); setGlobalAlertShownThisSession(true); }
      } catch {}
    };
    fetchGlobalAlert();
    const fetchTop3 = async () => { try { const { data } = await supabase.from('leaderboard_view').select('nickname, points').order('points', { ascending: false }).limit(3); if (data) setTopPlayers(data.map((d: any) => ({ nickname: d.nickname, points: d.points }))); } catch {} };
    fetchTop3();
    preloadSongSuggestions(); preloadGameSuggestions();
    const fetchEvents = async () => {
      try {
        const { data } = await supabase.from('events').select('*').eq('aktywny', true).order('created_at', { ascending: false });
        if (data) {
          setEvents(data);
          const songCounts: Record<string, number> = {};
          for (const ev of data) {
            try {
              const { count } = await supabase.from('event_songs').select('*', { count: 'exact', head: true }).eq('event_slug', ev.slug);
              songCounts[ev.slug] = count || 0;
            } catch { songCounts[ev.slug] = 0; }
          }
          setEventTotalSongs(songCounts);
        }
      } catch {}
    };
    fetchEvents();
    // Fetch ankieta link from Supabase table 'ankieta'
    const fetchAnkieta = async () => {
      try {
        const { data, error } = await supabase.from('ankieta').select('link, aktywna').eq('aktywna', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (data?.link) setAnkietaLink(data.link);
        if (error) console.error('Ankieta fetch error:', error.message);
      } catch (e) { console.error('Ankieta error:', e); }
    };
    fetchAnkieta();
    setTimeout(() => fetchPlayerRank(), 2000);
    setTimeout(() => checkNewAchievements(), 3000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);
  const [activeInterval, setActiveInterval] = useState<any>(null);
  const playTimeoutRef = React.useRef<any>(null);

  const ytPlayerRef = React.useRef<any>(null);
  const [ytReady, setYtReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.YT && window.YT.Player) { setYtReady(true); return; }
    window.onYouTubeIframeAPIReady = () => setYtReady(true);
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  }, []);

  const destroyYtPlayer = () => {
    if (ytPlayerRef.current) { try { ytPlayerRef.current.destroy(); } catch {} ytPlayerRef.current = null; }
  };

  const extractVideoId = (url: string): string | null => {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  };

  const [resultPlaying, setResultPlaying] = useState(false);
  const [resultCurrentTime, setResultCurrentTime] = useState(0);
  const [resultDuration, setResultDuration] = useState(0);
  const resultBufferRef = React.useRef<AudioBuffer | null>(null);
  const resultSourceRef = React.useRef<AudioBufferSourceNode | null>(null);
  const resultStartTimeRef = React.useRef(0);
  const resultOffsetRef = React.useRef(0);
  const resultAnimRef = React.useRef<number | null>(null);

  const stopResultPlayer = () => {
    if (resultSourceRef.current) { try { resultSourceRef.current.stop(); } catch {} resultSourceRef.current = null; }
    if (resultAnimRef.current) { cancelAnimationFrame(resultAnimRef.current); resultAnimRef.current = null; }
    setResultPlaying(false);
  };

  const playResultAudio = async () => {
    if (!currentSong || !autoPlayAfterGame) return;
    const hasDirectAudio = currentSong.audioUrl && currentSong.audioUrl.length > 5;
    if (hasDirectAudio) {
      try {
        audioEngine.stopAll();
        stopResultPlayer();
        resultBufferRef.current = await audioEngine.loadFromUrl(currentSong.audioUrl);
        setResultDuration(resultBufferRef.current.duration);
        const buffer = resultBufferRef.current;
        const ctx = (audioEngine as any).context as AudioContext;
        if (!ctx || !buffer) return;
        if (ctx.state === 'suspended') ctx.resume();
        const gainNode = (audioEngine as any).gainNode as GainNode;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(gainNode);
        const offset = Math.max(0, currentSong.previewStart || 0);
        source.start(0, offset);
        resultSourceRef.current = source;
        resultStartTimeRef.current = ctx.currentTime;
        resultOffsetRef.current = offset;
        setResultCurrentTime(offset);
        setResultPlaying(true);
        source.onended = () => { resultSourceRef.current = null; setResultPlaying(false); if (resultAnimRef.current) { cancelAnimationFrame(resultAnimRef.current); resultAnimRef.current = null; } };
        const tick = () => { if (!resultSourceRef.current) return; const elapsed = ctx.currentTime - resultStartTimeRef.current; const pos = resultOffsetRef.current + elapsed; setResultCurrentTime(Math.min(pos, buffer.duration)); if (pos < buffer.duration) resultAnimRef.current = requestAnimationFrame(tick); };
        resultAnimRef.current = requestAnimationFrame(tick);
      } catch (e) { console.error('Auto-play error:', e); }
    }
  };

  useEffect(() => {
    if (view === 'result') { stopMusic(); playResultAudio(); setTimeout(() => checkNewAchievements(), 1500); setNavCooldown(true); setTimeout(() => setNavCooldown(false), 1500); }
    if (view !== 'result' && view !== 'playing') { stopMusic(); audioEngine.stopAll(); stopResultPlayer(); resultBufferRef.current = null; setResultCurrentTime(0); setResultDuration(0); }
    if (view === 'menu') { stopMusic(); stopResultPlayer(); destroyYtPlayer(); audioEngine.stopAll(); clearEventState(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const stopMusic = () => {
    audioEngine.stopAll(); setIsPlaying(false); setPlayProgress(0);
    if (activeInterval) { clearInterval(activeInterval); setActiveInterval(null); }
    if (playTimeoutRef.current) { clearTimeout(playTimeoutRef.current); playTimeoutRef.current = null; }
    if (ytPlayerRef.current) { try { ytPlayerRef.current.stopVideo(); } catch {} }
    destroyYtPlayer();
  };

  const playMusic = async () => {
    if (!currentSong) return;
    if (isPlaying) { stopMusic(); return; }
    const hasDirectAudio = currentSong.audioUrl && currentSong.audioUrl.length > 5;
    const hasYouTube = currentSong.youtubeUrl && extractVideoId(currentSong.youtubeUrl);
    if (!hasDirectAudio && !hasYouTube) { setErrorMessage("Brak źródła audio"); return; }
    setIsPlaying(true); setErrorMessage(null); setPlayProgress(0);
    const duration = ATTEMPT_TIMES[attempt]; const startTime = Date.now();
    const interval = setInterval(() => { const elapsed = (Date.now() - startTime) / 1000; setPlayProgress(Math.min((elapsed / duration) * 100, 100)); if (elapsed >= duration) { clearInterval(interval); setActiveInterval(null); } }, 50);
    setActiveInterval(interval);
    if (hasDirectAudio) {
      try {
        if (gameMode === 'reverse') { const buffer = await audioEngine.loadFromUrl(currentSong.audioUrl); await audioEngine.playFromBuffer(buffer, { reverse: true, startTime: currentSong.previewStart, duration }); }
        else await audioEngine.playSimple(currentSong.audioUrl, duration, currentSong.previewStart);
      } catch (e: any) { setErrorMessage(e.message || "Błąd ładowania dźwięku."); clearInterval(interval); setIsPlaying(false); }
      if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
      playTimeoutRef.current = setTimeout(() => { setIsPlaying(false); setPlayProgress(0); setActiveInterval(null); playTimeoutRef.current = null; }, duration * 1000);
    } else if (hasYouTube && ytReady) {
      const videoId = extractVideoId(currentSong.youtubeUrl!)!;
      const startSec = currentSong.previewStart || 0;
      destroyYtPlayer();
      try {
        ytPlayerRef.current = new window.YT!.Player('yt-game-player', {
          height: '1', width: '1', videoId,
          playerVars: { autoplay: 1, controls: 0, start: startSec, playsinline: 1, modestbranding: 1, rel: 0 },
          events: {
            onReady: (e: any) => {
              e.target.setVolume(volume * 100);
              e.target.playVideo();
              if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
              playTimeoutRef.current = setTimeout(() => {
                try { e.target.pauseVideo(); } catch {}
                setIsPlaying(false); setPlayProgress(0); setActiveInterval(null);
                playTimeoutRef.current = null;
              }, duration * 1000);
            },
            onError: () => { setErrorMessage("Nie udało się odtworzyć z YouTube"); clearInterval(interval); setIsPlaying(false); },
          },
        });
      } catch { setErrorMessage("Błąd YouTube playera"); clearInterval(interval); setIsPlaying(false); }
    } else {
      setErrorMessage("Odtwarzacz YouTube nie jest gotowy. Odśwież stronę."); clearInterval(interval); setIsPlaying(false);
    }
  };

  const clearEventState = () => { setActiveEventSlug(null); setActiveEventName(''); setActiveEventNum(1); activeEventSongsRef.current = []; };
  const exitToMenu = () => { stopMusic(); stopResultPlayer(); destroyYtPlayer(); audioEngine.playUiClick(); clearEventState(); setView('menu'); };
  const pendingCommunityEventRef = React.useRef<string | null>(null);

  const goToCalendar = () => {
    stopMusic(); stopResultPlayer(); destroyYtPlayer(); audioEngine.playUiClick();
    if (activeEventSlug?.startsWith('community-')) {
      const communityId = activeEventSlug.replace('community-', '');
      pendingCommunityEventRef.current = communityId;
      clearEventState();
      setView('menu');
      setShowCommunity(true);
    }
    else if (activeEventSlug) { clearEventState(); setView('menu'); setShowEvents(true); }
    else setView('calendar');
  };

  const toggleResultPlayback = async () => {
    if (!currentSong) return;
    if (resultPlaying) { stopResultPlayer(); return; }
    try {
      audioEngine.stopAll();
      stopResultPlayer();
      if (!resultBufferRef.current) {
        resultBufferRef.current = await audioEngine.loadFromUrl(currentSong.audioUrl);
        setResultDuration(resultBufferRef.current.duration);
      }
      const buffer = resultBufferRef.current;
      const ctx = (audioEngine as any).context as AudioContext;
      if (!ctx || !buffer) return;
      if (ctx.state === 'suspended') ctx.resume();
      const gainNode = (audioEngine as any).gainNode as GainNode;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gainNode);
      const offset = resultCurrentTime >= resultDuration - 0.5 ? 0 : resultCurrentTime;
      source.start(0, offset);
      resultSourceRef.current = source;
      resultStartTimeRef.current = ctx.currentTime;
      resultOffsetRef.current = offset;
      setResultPlaying(true);
      source.onended = () => { resultSourceRef.current = null; setResultPlaying(false); if (resultAnimRef.current) { cancelAnimationFrame(resultAnimRef.current); resultAnimRef.current = null; } };
      const tick = () => { if (!resultSourceRef.current) return; const elapsed = ctx.currentTime - resultStartTimeRef.current; const pos = resultOffsetRef.current + elapsed; setResultCurrentTime(Math.min(pos, buffer.duration)); if (pos < buffer.duration) resultAnimRef.current = requestAnimationFrame(tick); };
      resultAnimRef.current = requestAnimationFrame(tick);
    } catch (e) { console.error('Result playback error:', e); }
  };

  const seekResultAudio = (time: number) => {
    stopResultPlayer();
    setResultCurrentTime(time);
  };

  const toggleAutoPlay = async () => { await updateProgress({ autoPlayAfterGame: !autoPlayAfterGame }); };

  const normalizeText = (text: string) => {
    if (!text) return "";
    return text.toLowerCase().replace(/ą/g,'a').replace(/ć/g,'c').replace(/ę/g,'e').replace(/ł/g,'l').replace(/ń/g,'n').replace(/ó/g,'o').replace(/ś/g,'s').replace(/ź/g,'z').replace(/ż/g,'z').normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s]/g,"").replace(/\s+/g," ").trim();
  };

  const getLevenshteinDistance = (a: string, b: string): number => {
    const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) { const cost = a[i-1] === b[j-1] ? 0 : 1; matrix[i][j] = Math.min(matrix[i-1][j]+1, matrix[i][j-1]+1, matrix[i-1][j-1]+cost); }
    return matrix[a.length][b.length];
  };

  // ORIGINAL fuzzy match — 1 typo tolerance, guess must cover whole target
  const isFuzzyMatch = (guess: string, targets: string[]): boolean => {
    const normGuess = normalizeText(guess);
    return targets.some(target => {
      const normTarget = normalizeText(target);
      if (normGuess === normTarget) return true;
      if (normGuess.length < normTarget.length - 1) return false;
      const distance = getLevenshteinDistance(normGuess, normTarget);
      return distance <= 1;
    });
  };

  // CLOSE match for "BLISKO!" hint — improved with startsWith
  const isCloseMatch = (guess: string, targets: string[]): boolean => {
    const normGuess = normalizeText(guess);
    const guessWords = normGuess.split(' ').filter(w => w.length > 2);
    return targets.some(target => {
      const normTarget = normalizeText(target);
      const targetWords = normTarget.split(' ').filter(w => w.length > 2);
      if (targetWords.length === 0) return false;
      const matchingWords = targetWords.filter(tWord =>
        guessWords.some(gw =>
          gw === tWord ||
          getLevenshteinDistance(gw, tWord) <= 1 ||
          (gw.length >= 4 && tWord.startsWith(gw)) ||
          (tWord.length >= 4 && gw.startsWith(tWord))
        )
      );
      const matchRatio = matchingWords.length / targetWords.length;
      if (matchRatio > 0.5 && matchRatio < 1) return true;
      if (matchRatio >= 1 && targetWords.length < (guessWords.length > 0 ? guessWords.length : 999)) return true;
      // startsWith for single words: "teletub" → "teletubisie"
      if (normGuess.length >= 4 && normTarget.length >= 4) {
        if (normTarget.startsWith(normGuess) || normGuess.startsWith(normTarget)) return true;
      }
      const distance = getLevenshteinDistance(normGuess, normTarget);
      if (distance >= 2 && distance <= Math.max(2, Math.floor(normTarget.length * 0.25))) return true;
      return false;
    });
  };

  const effectiveCategory = activeEventSlug ? (currentSong?.category || currentCategory) : currentCategory;
  const isTitleOnlyMode = gameMode === 'klasyczny' && (effectiveCategory === 'Bajki' || effectiveCategory === 'Gry' || effectiveCategory === 'Inne' || effectiveCategory === 'Kraj');

  // Search event songs locally for suggestions — sorted ALPHABETICALLY to prevent spoiling event order
  const searchEventSongsLocal = (query: string, cat: string): { movies: MovieSuggestion[], games: GameSuggestion[], songs: SongSuggestion[] } => {
    const q = query.toLowerCase().trim();
    if (q.length < 2) return { movies: [], games: [], songs: [] };
    const evSongs = activeEventSongsRef.current;
    if (!evSongs || evSongs.length === 0) return { movies: [], games: [], songs: [] };
    const matched = evSongs.filter((s: any) => {
      const title = (s.title || '').toLowerCase();
      const artist = (s.artist || '').toLowerCase();
      return title.includes(q) || artist.includes(q) || q.split(' ').some((w: string) => w.length > 2 && (title.includes(w) || artist.includes(w)));
    }).sort((a: any, b: any) => (a.title || '').localeCompare(b.title || ''));
    if (cat === 'Bajki') return { movies: matched.map((s: any) => ({ title: s.title })), games: [], songs: [] };
    if (cat === 'Gry') return { movies: [], games: matched.map((s: any) => ({ title: s.title })), songs: [] };
    return { movies: [], games: [], songs: matched.map((s: any) => ({ title: s.title, artist: s.artist || '' })) };
  };

  const handleGuessInput = (value: string) => {
    const cleaned = value.replace(/[,;|\/\\&]/g, '').slice(0, MAX_GUESS_LENGTH);
    setGuessTitle(cleaned);
    setSpotifySuggestions([]); setMovieSuggestions([]); setGameSuggestions([]); setCountrySuggestions([]);
    const effectiveCat = activeEventSlug ? (currentSong?.category || currentCategory) : currentCategory;

    // Kraj — show all countries immediately, filter by input
    if (effectiveCat === 'Kraj') {
      const q = cleaned.trim().toLowerCase();
      const filtered = q.length === 0 ? COUNTRIES : COUNTRIES.filter(c => c.toLowerCase().includes(q));
      setCountrySuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
      return;
    }

    if (cleaned.trim().length >= 2) {
      const evResults = activeEventSlug ? searchEventSongsLocal(cleaned, effectiveCat) : { movies: [], games: [], songs: [] };

      if (effectiveCat === 'Bajki') {
        searchMoviesDebounced(cleaned, (results: MovieSuggestion[]) => {
          const combined = [...evResults.movies];
          const existingTitles = new Set(combined.map(m => m.title.toLowerCase()));
          results.forEach(r => { if (!existingTitles.has(r.title.toLowerCase())) combined.push(r); });
          setMovieSuggestions(combined);
          setShowSuggestions(combined.length > 0);
        });
      }
      else if (effectiveCat === 'Gry') {
        searchGamesLocalDebounced(cleaned, (localResults: GameSuggestion[]) => {
          const combined = [...evResults.games];
          const existingTitles = new Set(combined.map(g => g.title.toLowerCase()));
          localResults.forEach(r => { if (!existingTitles.has(r.title.toLowerCase())) combined.push(r); });
          setGameSuggestions(combined);
          setShowSuggestions(combined.length > 0);
        });
        searchGamesDebounced(cleaned, (rawgResults: GameSuggestion[]) => { if (rawgResults.length > 0) { setGameSuggestions(prev => { const existingTitles = new Set(prev.map(g => g.title.toLowerCase())); const unique = rawgResults.filter(g => !existingTitles.has(g.title.toLowerCase())); return [...prev, ...unique]; }); setShowSuggestions(true); } });
      }
      else if (effectiveCat === 'Inne') {
        // Inne — event songs + global song suggestions
        if (cleaned.trim().length >= 3) {
          searchSongsDebounced(cleaned, (results: SongSuggestion[]) => {
            const combined = [...evResults.songs];
            const existingKeys = new Set(combined.map(s => `${s.title}|${s.artist}`.toLowerCase()));
            results.forEach(r => { if (!existingKeys.has(`${r.title}|${r.artist}`.toLowerCase())) combined.push(r); });
            setSpotifySuggestions(combined);
            setShowSuggestions(combined.length > 0);
          });
        } else {
          setSpotifySuggestions(evResults.songs);
          setShowSuggestions(evResults.songs.length > 0);
        }
      }
      else if (cleaned.trim().length >= 3) {
        searchSongsDebounced(cleaned, (results: SongSuggestion[]) => {
          const combined = [...evResults.songs];
          const existingKeys = new Set(combined.map(s => `${s.title}|${s.artist}`.toLowerCase()));
          results.forEach(r => { if (!existingKeys.has(`${r.title}|${r.artist}`.toLowerCase())) combined.push(r); });
          setSpotifySuggestions(combined);
          setShowSuggestions(combined.length > 0);
        });
      }
      else {
        setSpotifySuggestions(evResults.songs);
        setShowSuggestions(evResults.songs.length > 0);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (suggestion: SongSuggestion) => { setGuessTitle(`${suggestion.title} ${suggestion.artist}`.slice(0, MAX_GUESS_LENGTH)); setShowSuggestions(false); setSpotifySuggestions([]); };
  const selectMovieSuggestion = (suggestion: MovieSuggestion) => { setGuessTitle(suggestion.title.slice(0, MAX_GUESS_LENGTH)); setShowSuggestions(false); setMovieSuggestions([]); };
  const selectGameSuggestion = (suggestion: GameSuggestion) => { setGuessTitle(suggestion.title.slice(0, MAX_GUESS_LENGTH)); setShowSuggestions(false); setGameSuggestions([]); };
  const sanitizeGuessForCheck = (input: string): string => input.replace(/\s+/g, ' ').trim();

  const [navCooldown, setNavCooldown] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<string>('');

  const startEventGame = (eventSlug: string, eventSong: any, challengeNum: number) => {
    if (navCooldown) return; setNavCooldown(true); setTimeout(() => setNavCooldown(false), 800);
    stopMusic(); stopResultPlayer(); destroyYtPlayer(); audioEngine.stopAll();
    setGameStatus('playing'); setAttempt(0); setHistory([]); setGuessTitle(''); setGuessArtist('');
    setFeedback({ title: false, artist: false }); setPartialPointsEarned(0); setCloseHint({ show: false, type: null });
    setShowSuggestions(false); setSpotifySuggestions([]); setErrorMessage(null);
    setActiveEventSlug(eventSlug);
    setActiveEventNum(challengeNum);
    // Determine event name - twórcy vs społeczność
    if (eventSlug.startsWith('community-')) {
      // Community event - name comes from onPlayEvent callback, already set via activeEventName or use generic
      // Don't overwrite if already set by community callback
      if (!activeEventName || activeEventName === 'Event') {
        setActiveEventName('Event Społeczności');
      }
    } else {
      // Twórca event - find in events list
      const ev = events.find(e => e.slug === eventSlug);
      setActiveEventName(ev?.name || 'Event Twórcy');
    }
    // Only update songs ref if we have songs AND they belong to current event slug
    // This prevents mixing songs between different event types
    if (eventSongs.length > 0) {
      // Check if these songs actually belong to this event
      const firstSongKey = `event-${eventSlug}-${eventSongs[0]?.id}`;
      const belongsToThisEvent = eventSlug.startsWith('community-') || firstSongKey.includes(eventSlug);
      if (belongsToThisEvent) {
        activeEventSongsRef.current = eventSongs;
      }
    }
    const rawCat = (eventSong.category || 'muzyka').toLowerCase();
    let cat: Category = 'Polskie';
    if (rawCat === 'zagraniczne' || rawCat === 'foreign') cat = 'Zagraniczne';
    else if (rawCat === 'bajka' || rawCat === 'bajki' || rawCat === 'cartoon') cat = 'Bajki';
    else if (rawCat === 'gra' || rawCat === 'gry' || rawCat === 'game') cat = 'Gry';
    else if (rawCat === 'inne' || rawCat === 'other') cat = 'Inne';
    else if (rawCat === 'kraj' || rawCat === 'country') cat = 'Kraj';
    setCurrentCategory(cat);
    setGameMode('klasyczny');
    const song: Song = {
      id: `event-${eventSlug}-${eventSong.id}`,
      title: eventSong.title,
      artist: eventSong.artist || '',
      category: cat,
      mode: 'klasyczny',
      audioUrl: (eventSong.audio_url || eventSong.audioUrl || '').trim(),
      previewStart: Number(eventSong.preview_start || eventSong.start_time_seconds || eventSong.previewStart) || 0,
      date: eventSong.date || undefined,
      gatunek: eventSong.label || undefined,
      youtubeUrl: eventSong.youtube_url || undefined,
    };
    destroyYtPlayer();
    const dayKey = `event-${eventSlug}-${eventSong.id}`;
    const saved = completedDays[dayKey];
    setCurrentSong(song); fetchGlobalStats(song.id); audioEngine.playUiClick();
    setShowEvents(false);
    if (saved) {
      if (saved.status === 'playing') { setAttempt(saved.attempt); setHistory(saved.history); setFeedback(saved.feedback); setPartialPointsEarned(saved.partialPoints || 0); }
      else { const safeTitle = song.title.split(',').map(t => t.trim()).filter(Boolean)[0] || song.title; const safeArtist = song.artist.split(',').map(a => a.trim()).filter(Boolean)[0] || song.artist; setAttempt(saved.attempt - 1); setGameStatus(saved.status); setHistory(saved.history); setFeedback({ title: true, artist: true }); setGuessTitle(safeTitle); setGuessArtist(safeArtist); setPartialPointsEarned(saved.partialPoints || 0); }
    }
    setView('playing');
  };

  const startDailyGame = (date: string) => {
    if (navCooldown) return; setNavCooldown(true); setTimeout(() => setNavCooldown(false), 800);
    clearEventState();
    stopMusic(); stopResultPlayer(); destroyYtPlayer(); audioEngine.stopAll(); setGameStatus('playing'); setAttempt(0); setHistory([]); setGuessTitle(''); setGuessArtist(''); setFeedback({ title: false, artist: false }); setPartialPointsEarned(0); setCloseHint({ show: false, type: null }); setShowSuggestions(false); setSpotifySuggestions([]); setErrorMessage(null);
    const dailySong = songs.find(s => (s.date === date || (!s.date && date === new Date().toISOString().split('T')[0])) && s.category === currentCategory && s.mode === gameMode);
    if (!dailySong) return;
    const dayKey = `${date}-${gameMode}-${currentCategory}`;
    const saved = completedDays[dayKey];
    setCurrentSong(dailySong); fetchGlobalStats(dailySong.id); audioEngine.playUiClick();
    if (saved) {
      if (saved.status === 'playing') { setAttempt(saved.attempt); setHistory(saved.history); setFeedback(saved.feedback); setPartialPointsEarned(saved.partialPoints || 0); }
      else { const safeTitle = dailySong.title.split(',').map(t => t.trim()).filter(Boolean)[0] || dailySong.title; const safeArtist = dailySong.artist.split(',').map(a => a.trim()).filter(Boolean)[0] || dailySong.artist; setAttempt(saved.attempt - 1); setGameStatus(saved.status); setHistory(saved.history); setFeedback({ title: true, artist: true }); setGuessTitle(safeTitle); setGuessArtist(safeArtist); setPartialPointsEarned(saved.partialPoints || 0); }
    }
    setView('playing');
  };

  const handleSkip = () => {
    if (!currentSong || gameStatus !== 'playing') return;
    const updatedHistory = [...history, { title: "POMINIĘTO", artist: "", status: 'skipped' as const }];
    setHistory(updatedHistory);
    if (attempt < 5) { setAttempt(prev => prev + 1); setGuessTitle(''); setGuessArtist(''); saveSession('playing', attempt + 1, updatedHistory, feedback, partialPointsEarned); }
    else { setGameStatus('lost'); saveSession('lost', attempt + 1, updatedHistory, feedback, partialPointsEarned); if (currentSong) recordResultGlobal(currentSong.id, 7, partialPointsEarned); setTimeout(() => setView('result'), 2000); }
  };

  const handleGuess = () => {
    if (!currentSong || gameStatus !== 'playing') return;
    const combinedGuess = sanitizeGuessForCheck(`${guessTitle} ${guessArtist}`);
    if (!combinedGuess && !feedback.title && !feedback.artist) { handleSkip(); return; }
    const dbTitles = currentSong.title.split(',').map(t => t.trim()).filter(Boolean);
    const dbArtists = currentSong.artist.split(',').map(a => a.trim()).filter(Boolean);
    let isTitleNowCorrect = !!feedback.title; let isArtistNowCorrect = !!feedback.artist; let newPartialPoints = partialPointsEarned;
    if (isTitleOnlyMode) isArtistNowCorrect = true;
    if (!isTitleNowCorrect) { isTitleNowCorrect = dbTitles.some(t => normalizeText(combinedGuess).includes(normalizeText(t)) || isFuzzyMatch(combinedGuess, [t])); if (isTitleNowCorrect && !feedback.title) newPartialPoints += 30; }
    if (!isArtistNowCorrect && !isTitleOnlyMode) { isArtistNowCorrect = dbArtists.some(a => normalizeText(combinedGuess).includes(normalizeText(a)) || isFuzzyMatch(combinedGuess, [a])); if (isArtistNowCorrect && !feedback.artist) newPartialPoints += 20; }
    setPartialPointsEarned(newPartialPoints);
    const updatedFeedback = { title: isTitleNowCorrect, artist: isArtistNowCorrect };
    setFeedback(updatedFeedback);
    const isTitleClose = !isTitleNowCorrect && isCloseMatch(combinedGuess, dbTitles);
    const isArtistClose = !isArtistNowCorrect && !isTitleOnlyMode && isCloseMatch(combinedGuess, dbArtists);
    if (isTitleClose || isArtistClose) setCloseHint({ show: true, type: isTitleClose && isArtistClose ? 'both' : (isTitleClose ? 'title' : 'artist') });
    else setCloseHint({ show: false, type: null });
    const displayTitle = isTitleNowCorrect ? dbTitles[0] : (guessTitle || "???");
    const displayArtist = isTitleOnlyMode ? "" : (isArtistNowCorrect ? dbArtists[0] : (guessArtist || "???"));
    if (isTitleNowCorrect && isArtistNowCorrect) {
      const finalHistory = [...history, { title: `${displayTitle} — ${displayArtist}`, artist: "", status: 'correct' as const }];
      setHistory(finalHistory); setGameStatus('won'); setStreak(prev => prev + 1);
      saveSession('won', attempt + 1, finalHistory, { title: true, artist: true }, newPartialPoints);
      if (currentSong) recordResultGlobal(currentSong.id, attempt + 1, newPartialPoints);
      audioEngine.playUiSuccess(); confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      setTimeout(() => setView('result'), 2000); return;
    }
    const isPartiallyCorrect = isTitleOnlyMode ? false : (isTitleNowCorrect || isArtistNowCorrect);
    const historyDisplay = isTitleOnlyMode
      ? (guessTitle || "???")
      : (isPartiallyCorrect ? `${displayTitle} — ${displayArtist}` : (guessTitle || "???"));
    const updatedHistory = [...history, { title: historyDisplay, artist: "", status: (isPartiallyCorrect ? 'partial' : 'wrong') as 'partial' | 'wrong' }];
    setHistory(updatedHistory);
    if (attempt < 5) { setAttempt(prev => prev + 1); setGuessTitle(''); setGuessArtist(''); saveSession('playing', attempt + 1, updatedHistory, updatedFeedback, newPartialPoints); if (!isPartiallyCorrect) audioEngine.playUiError(); }
    else { setGameStatus('lost'); setStreak(0); saveSession('lost', attempt + 1, updatedHistory, updatedFeedback, newPartialPoints); if (currentSong) recordResultGlobal(currentSong.id, 7, newPartialPoints); audioEngine.playUiError(); setTimeout(() => setView('result'), 2000); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleGuess(); };

  // Suppress unused variable warnings
  void streak; void _globalAlertShownThisSession;

  const MODE_DEFS = [
    { id: 'klasyczny' as GameMode, icon: Music2, label: 'Daily Song', desc: 'Oryginalne brzmienie piosenki', daily: true, categories: ['Polskie', 'Zagraniczne', 'Bajki', 'Gry'] as Category[] },
    { id: 'piano' as GameMode, icon: Piano, label: 'Piano', desc: 'Wersja na pianinie', daily: false, categories: ['Polskie', 'Zagraniczne'] as Category[] },
    { id: 'beat' as GameMode, icon: Drum, label: 'Tylko Bit', desc: 'Sam rytm utworu', daily: false, categories: ['Polskie', 'Zagraniczne'] as Category[] },
    { id: 'reverse' as GameMode, icon: RotateCcw, label: 'Od Tyłu', desc: 'Piosenka puszczona wspak', daily: false, categories: ['Polskie', 'Zagraniczne'] as Category[] },
  ];

  const handleModeClick = (modeId: GameMode) => { if (expandedMode === modeId) setExpandedMode(null); else { setExpandedMode(modeId); audioEngine.playUiClick(); } };

  const handleCategoryClick = (modeId: GameMode, cat: Category) => {
    stopMusic(); clearEventState(); setGameMode(modeId); setCurrentCategory(cat); audioEngine.playUiClick();
    if (modeId === 'klasyczny') {
      const now = new Date(); const offset = now.getTimezoneOffset();
      const localToday = new Date(now.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];
      const dayKey = `${localToday}-${modeId}-${cat}`;
      const saved = completedDays[dayKey];
      const todaySong = songs.find(s => s.date === localToday && s.category === cat && s.mode === modeId);
      if (todaySong && (!saved || saved.status === 'playing')) {
        setGameStatus('playing'); setAttempt(0); setHistory([]); setGuessTitle(''); setGuessArtist(''); setFeedback({ title: false, artist: false }); setPartialPointsEarned(0); setCloseHint({ show: false, type: null }); setShowSuggestions(false); setSpotifySuggestions([]); setErrorMessage(null);
        if (saved && saved.status === 'playing') { setAttempt(saved.attempt); setHistory(saved.history); setFeedback(saved.feedback); setPartialPointsEarned(saved.partialPoints || 0); }
        setCurrentSong(todaySong); fetchGlobalStats(todaySong.id); setView('playing'); return;
      }
    }
    setView('calendar');
  };

  // ===== SIMPLIFIED RENDER FOR BUILD =====
  // The full render functions are below

  return (
    <div className={`min-h-screen bg-slate-950 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] ${currentTheme.gradient} via-slate-950 to-black flex items-center justify-center overflow-x-hidden font-sans text-slate-100`}>
      <AnimatePresence>
        {globalAlert && !globalAlertDismissed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-900 border-2 border-yellow-500/50 w-full max-w-lg rounded-3xl p-8 shadow-[0_0_60px_rgba(250,204,21,0.2)] text-center relative">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg ${globalAlert.typ === 'error' ? 'bg-red-600' : globalAlert.typ === 'warning' ? 'bg-yellow-600' : 'bg-indigo-600'}`}>
                {globalAlert.typ === 'error' ? <AlertTriangle size={40} className="text-white" /> : <span className="text-4xl">{globalAlert.emoji || '📢'}</span>}
              </div>
              <h2 className="text-2xl font-black text-white mb-2 uppercase">{globalAlert.typ === 'error' ? 'UWAGA!' : globalAlert.typ === 'warning' ? 'WAŻNE!' : 'KOMUNIKAT'}</h2>
              <p className="text-white/70 text-sm leading-relaxed mb-6 whitespace-pre-line">{globalAlert.tresc}</p>
              <button onClick={() => setGlobalAlertDismissed(true)} className={`w-full py-4 rounded-2xl font-black text-lg transition-all ${globalAlert.typ === 'error' ? 'bg-red-600 hover:bg-red-500' : globalAlert.typ === 'warning' ? 'bg-yellow-600 hover:bg-yellow-500' : `${currentTheme.primary} ${currentTheme.hover}`} text-white`}>ROZUMIEM</button>
            </motion.div>
          </motion.div>
        )}
        {showWelcome && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-slate-900 border border-white/10 w-full max-w-sm rounded-3xl p-8 shadow-2xl text-center">
              <div className={`w-20 h-20 rounded-full ${currentTheme.primary} flex items-center justify-center text-white text-4xl mx-auto mb-4 shadow-lg`}>🎵</div>
              <h2 className="text-2xl font-black text-white mb-2">Witaj w Co Jest Grane!</h2>
              <p className="text-white/40 text-sm mb-6">Zgaduj piosenki po fragmencie i rywalizuj z innymi!</p>
              <div className="mb-4">
                <label className="text-white/40 text-xs font-bold uppercase tracking-widest block mb-2">Twój nick w grze</label>
                <input type="text" value={welcomeNick} onChange={(e) => setWelcomeNick(e.target.value.slice(0, 15))} placeholder="Wpisz nick..." maxLength={15} autoFocus className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-center text-lg placeholder:text-white/20 focus:border-white/30 focus:outline-none" onKeyDown={(e) => { if (e.key === 'Enter' && welcomeNick.trim().length >= 2) { setNickname(welcomeNick.trim()); localStorage.setItem('mm_welcomed', '1'); setShowWelcome(false); } }} />
                <p className="text-white/20 text-[9px] mt-2">Min. 2 znaki, widoczny w rankingu</p>
              </div>
              <button onClick={() => { if (welcomeNick.trim().length >= 2) setNickname(welcomeNick.trim()); localStorage.setItem('mm_welcomed', '1'); setShowWelcome(false); }} className={`w-full ${currentTheme.primary} ${currentTheme.hover} text-white py-3 rounded-xl font-bold text-lg transition-all`}>{welcomeNick.trim().length >= 2 ? 'ZACZYNAMY!' : 'POMIŃ'}</button>
            </motion.div>
          </motion.div>
        )}
        {showSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-[2rem] p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => setShowSettings(false)} className="absolute right-6 top-6 text-white/40 hover:text-white"><X size={24} /></button>
              <h2 className="text-3xl font-black text-white mb-6 flex items-center gap-2"><Settings className={currentTheme.text} /> USTAWIENIA</h2>
              <div className="space-y-6">
                <section>
                  <h3 className="text-white/40 text-xs font-bold uppercase tracking-widest mb-3">Kolorystyka</h3>
                  <div className="grid grid-cols-4 gap-3">{(['indigo','emerald','rose','amber','cyan','purple','red','lime','sky','pink','orange','teal'] as Theme[]).map(t => (<button key={t} onClick={() => setTheme(t)} className={`h-12 rounded-xl transition-all border-2 ${theme === t ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'} ${themeConfig[t].primary}`} />))}</div>
                </section>
                <section><button onClick={toggleStatsPanel} className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border ${showStatsPanel ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>{showStatsPanel ? 'Licznik gier widoczny' : 'Licznik gier ukryty'}</button></section>
                <section>
                  <h3 className="text-white/40 text-xs font-bold uppercase tracking-widest mb-3">Konto</h3>
                  <button onClick={() => { setShowSettings(false); setShowAuthModal(true); }} className={`w-full py-3 rounded-xl text-sm font-bold border flex items-center justify-center gap-2 transition-all ${user ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}>{user ? <><Cloud size={16} />Zalogowano</> : <><LogIn size={16} />Zaloguj się</>}</button>
                </section>
                <section>
                  <h3 className="text-white/40 text-xs font-bold uppercase tracking-widest mb-3">Muzyka po grze</h3>
                  <button onClick={toggleAutoPlay} className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border flex items-center justify-center gap-2 ${autoPlayAfterGame ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>{autoPlayAfterGame ? <><Volume2 size={14}/> Auto-odtwarzanie włączone</> : <><VolumeX size={14}/> Auto-odtwarzanie wyłączone</>}</button>
                  <p className="text-white/30 text-[9px] mt-2 text-center">Po zakończeniu wyzwania automatycznie puści fragment piosenki</p>
                </section>
                <section>
                  <h3 className="text-white/40 text-xs font-bold uppercase tracking-widest mb-3">O mnie</h3>
                  <div className={`bg-gradient-to-br ${currentTheme.gradient} to-transparent border ${currentTheme.border}/20 p-5 rounded-2xl`}>
                    <p className="text-sm text-white italic leading-relaxed">&quot;Zwykły chłopak ze zwykłego miasta z kreatywną głową. Pseudonim Jogis, miło cię tu widzieć :)&quot;</p>
                  </div>
                </section>
                <button onClick={async () => { await updateProgress({ theme }); audioEngine.playUiSuccess(); setShowSettings(false); }} className={`w-full ${currentTheme.primary} ${currentTheme.hover} text-white py-4 rounded-2xl font-black text-lg transition-all uppercase`}>Zapisz ustawienia</button>
              </div>
            </div>
          </motion.div>
        )}
        {showAuthModal && <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} theme={currentTheme} />}
        {showMultiplayer && <MultiplayerMode userId={userId} nickname={nickname} theme={currentTheme} onClose={() => setShowMultiplayer(false)} />}
        {showCommunity && <CommunityEvents isOpen={showCommunity} onClose={() => { setShowCommunity(false); pendingCommunityEventRef.current = null; }} userId={userId} nickname={nickname} isAdmin={!!user && (user.email === 'jogisek@interia.pl' || user.email === 'kamillejzak@interia.pl')} theme={currentTheme} initialEventId={pendingCommunityEventRef.current} onInitialEventHandled={() => { pendingCommunityEventRef.current = null; }}
          onPlayEvent={(communityEvent, specificSong, specificIndex, allSongs) => {
            (async () => {
              try {
                let sorted: any[];
                if (allSongs && allSongs.length > 0) { sorted = allSongs; }
                else {
                  const { data: csongs } = await supabase.from('community_event_songs').select('*').eq('event_id', communityEvent.id).order('order_index');
                  if (!csongs || csongs.length === 0) return;
                  sorted = [...csongs].sort((a: any, b: any) => (a.date || a.id).toString().localeCompare((b.date || b.id).toString()));
                }
                // Inject event category into each song so startEventGame knows the category
                const eventCat = communityEvent.category === 'cartoon' ? 'bajki' : communityEvent.category === 'game' ? 'gry' : communityEvent.category === 'music' ? 'muzyka' : communityEvent.category === 'other' ? 'inne' : communityEvent.category === 'country' ? 'kraj' : communityEvent.category;
                const songsWithCat = sorted.map((s: any) => ({ ...s, category: s.category || eventCat }));
                setEventSongs(songsWithCat);
                activeEventSongsRef.current = songsWithCat;
                // Set community event name BEFORE calling startEventGame
                setActiveEventName(communityEvent.title || 'Event Społeczności');
                const target = specificSong ? { ...specificSong, category: (specificSong as any).category || eventCat } : songsWithCat[0];
                const idx = specificIndex || (songsWithCat.indexOf(songsWithCat.find((s: any) => s.id === target.id) || songsWithCat[0]) + 1);
                setShowCommunity(false);
                // Increment play count
                try { await supabase.from('community_events').update({ play_count: (communityEvent.play_count || 0) + 1 }).eq('id', communityEvent.id); } catch {}
                startEventGame(`community-${communityEvent.id}`, target, idx);
              } catch (e) { console.error('Play community event error:', e); }
            })();
          }}
        />}
        {showEvents && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-slate-950 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-yellow-950/30 via-slate-950 to-black overflow-y-auto">
            <div className="min-h-screen flex flex-col items-center py-8 px-4">
              {selectedEvent ? (
                <div className="w-full max-w-3xl space-y-6">
                  <button onClick={() => { setSelectedEvent(null); setEventSongs([]); }} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/10 px-4 py-2.5 rounded-xl transition-all group"><ArrowLeft size={16} className="text-white/60 group-hover:text-white" /><span className="text-white/60 group-hover:text-white text-xs font-bold uppercase tracking-wider">Powrót</span></button>
                  <div className="text-center relative">
                    <span className="text-6xl mb-4 block">{selectedEvent.emoji}</span>
                    <h2 className="text-3xl font-black text-white uppercase">{selectedEvent.name}</h2>
                    <p className="text-white/40 text-sm mt-2 max-w-md mx-auto">{selectedEvent.description}</p>
                  </div>
                  {eventSongs.length === 0 ? (
                    <div className="text-center py-16"><span className="text-5xl mb-4 block">🔜</span><p className="text-white/30 text-lg font-bold">Wyzwania pojawią się wkrótce!</p></div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                      {(() => {
                        const nowE = new Date(); const offE = nowE.getTimezoneOffset();
                        const todayE = new Date(nowE.getTime() - (offE * 60 * 1000)).toISOString().split('T')[0];
                        const sorted = [...eventSongs].sort((a, b) => (a.date || a.id.toString()).localeCompare(b.date || b.id.toString()));
                        return sorted.map((song, i) => {
                          const hasDate = !!song.date;
                          const isFuture = hasDate && song.date! > todayE;
                          const isToday = hasDate && song.date === todayE;
                          const dayKey = `event-${selectedEvent.slug}-${song.id}`;
                          const session = completedDays[dayKey];
                          return (
                            <button key={song.id} disabled={isFuture} onClick={() => startEventGame(selectedEvent.slug, song, i + 1)}
                              className={`relative p-3 md:p-4 rounded-2xl border transition-all flex flex-col items-center ${isFuture ? 'bg-white/[0.02] border-white/5 opacity-30 cursor-not-allowed' : session?.status === 'won' ? 'bg-green-500/20 border-green-500/40' : session?.status === 'lost' ? 'bg-red-500/20 border-red-500/40' : isToday ? 'bg-yellow-500/20 border-yellow-500/50' : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'}`}>
                              {isFuture && <Lock size={12} className="text-white/20 absolute top-1.5 right-1.5" />}
                              {session && !isFuture && <div className="absolute -top-1.5 -right-1.5 z-10">{session.status === 'won' ? <CheckCircle size={14} className="text-green-500" /> : session.status === 'playing' ? <Clock size={14} className="text-yellow-500" /> : <XCircle size={14} className="text-red-500" />}</div>}
                              {isToday && !session && <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[6px] font-black px-2 py-0.5 rounded-full uppercase z-20 animate-pulse">Dziś!</div>}
                              {hasDate && <span className="text-[7px] uppercase font-bold text-white/25">{song.date!.split('-')[2]}.{song.date!.split('-')[1]}</span>}
                              {song.label && <span className="text-[9px] text-center leading-tight text-white/50 mt-0.5">{song.label}</span>}
                              <span className={`text-xl font-black leading-none mt-1 ${isToday ? 'text-yellow-400' : session?.status === 'won' ? 'text-green-400' : 'text-white/30'}`}>#{i + 1}</span>
                            </button>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full max-w-3xl space-y-8">
                  <div className="flex items-center justify-between gap-3">
                    <button onClick={() => setShowEvents(false)} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/10 px-4 py-2.5 rounded-xl transition-all group"><ArrowLeft size={16} className="text-white/60 group-hover:text-white" /><span className="text-white/60 group-hover:text-white text-xs font-bold uppercase tracking-wider">Powrót do menu</span></button>
                    {/* Top-right: Ankieta + Zaproponuj */}
                    <div className="flex gap-2">
                      {ankietaLink && (
                        <a href={ankietaLink} target="_blank" rel="noopener noreferrer" className="bg-gradient-to-r from-red-500 to-pink-600 text-white px-5 py-3 rounded-2xl font-black text-sm flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all animate-pulse">
                          🗳️ GŁOSUJ NA EVENT
                        </a>
                      )}
                      <a href="https://forms.gle/JaXiML4prXRw2myu7" target="_blank" rel="noopener noreferrer" className="bg-white/10 border border-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all">
                        💡 Zaproponuj
                      </a>
                    </div>
                  </div>
                  <div className="text-center"><span className="text-5xl mb-3 block">🎪</span><h2 className="text-4xl font-black text-white uppercase">EVENTY</h2><p className="text-white/40 text-sm mt-2">Specjalne wyzwania tematyczne</p></div>
                  <div className="flex gap-2 flex-wrap">
                    {(['all', 'new', 'started', 'done'] as const).map(f => (<button key={f} onClick={() => setEventFilter(f)} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${eventFilter === f ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-white/5 text-white/30 hover:bg-white/10 border border-white/5'}`}>{f === 'all' ? 'Wszystkie' : f === 'done' ? '✅ Ukończone' : f === 'started' ? '⏳ Zaczęte' : '🆕 Nowe'}</button>))}
                  </div>
                  {events.length === 0 ? (
                    <div className="text-center py-16"><span className="text-5xl mb-4 block">🔜</span><p className="text-white/30 text-lg font-bold">Brak aktywnych eventów</p></div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {events.filter(ev => {
                        if (eventFilter === 'all') return true;
                        const total = eventTotalSongs[ev.slug] || 0;
                        const played = Object.keys(completedDays).filter(k => k.startsWith(`event-${ev.slug}-`) && (completedDays[k]?.status === 'won' || completedDays[k]?.status === 'lost')).length;
                        if (eventFilter === 'done') return total > 0 && played >= total;
                        if (eventFilter === 'started') return played > 0 && played < total;
                        if (eventFilter === 'new') return played === 0;
                        return true;
                      }).map(ev => {
                        const evTotal = eventTotalSongs[ev.slug] || 0;
                        const evPlayedKeys = Object.keys(completedDays).filter(k => k.startsWith(`event-${ev.slug}-`));
                        const evPlayed = evPlayedKeys.filter(k => { const s = completedDays[k]; return s && (s.status === 'won' || s.status === 'lost'); }).length;
                        const evWon = evPlayedKeys.filter(k => completedDays[k]?.status === 'won').length;
                        const evDone = evTotal > 0 && evPlayed >= evTotal;
                        const evPct = evTotal > 0 ? Math.round((evWon / evTotal) * 100) : 0;
                        return (
                        <button key={ev.id} onClick={async () => { setSelectedEvent(ev); try { const { data } = await supabase.from('event_songs').select('*').eq('event_slug', ev.slug).order('id'); if (data) setEventSongs(data); } catch {} }}
                          className={`relative bg-gradient-to-br ${evDone ? 'from-green-500/10 to-emerald-500/5 border-green-500/30 hover:border-green-500/50' : ev.color ? '' : 'from-yellow-500/10 to-orange-500/5 border-yellow-500/20 hover:border-yellow-500/40'} border rounded-3xl p-6 text-left transition-all group overflow-hidden`}
                          style={!evDone && ev.color ? { background: `linear-gradient(135deg, ${ev.color}15, ${ev.color}05)`, borderColor: `${ev.color}30` } : undefined}>
                          {evTotal > 0 && <div className={`absolute top-3 right-3 text-[10px] font-black px-2.5 py-1 rounded-full border z-20 ${evDone ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>{evPlayed}/{evTotal}</div>}
                          <span className="text-4xl mb-3 block">{ev.emoji}</span>
                          <h3 className="text-white font-black text-xl">{ev.name}</h3>
                          <p className="text-white/40 text-sm mt-2 line-clamp-2">{ev.description}</p>
                          <div className="flex items-center gap-2 mt-3 flex-wrap">
                            <span className="text-[9px] text-white/20">{new Date(ev.created_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}</span>
                            <span className="text-[9px] text-white/20">by Jogis</span>
                            {evPlayed > 0 && !evDone && <span className="text-[9px] text-yellow-400/60 font-bold">{evWon}W {evPlayed - evWon}L • {evPlayed > 0 ? Math.round((evWon / evPlayed) * 100) : 0}%</span>}
                            {evDone && <span className="bg-green-500/20 text-green-400 text-[8px] font-black px-2 py-0.5 rounded-full border border-green-500/30">✅ Ukończony</span>}
                            {evDone && <span className="text-[8px] text-green-400/70 font-bold">{evWon}W {evPlayed - evWon}L • {evPct}%</span>}
                          </div>
                        </button>);
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
        {achievementPopup && (
          <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }} className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[130]">
            <div className="bg-gradient-to-r from-yellow-600 to-amber-600 border-2 border-yellow-400/50 rounded-2xl px-6 py-4 shadow-[0_0_40px_rgba(250,204,21,0.4)] flex items-center gap-4">
              <span className="text-4xl">{achievementPopup.icon}</span>
              <div><p className="text-yellow-100 text-[10px] font-bold uppercase tracking-widest">Nowe osiągnięcie!</p><p className="text-white font-black text-lg">{achievementPopup.name}</p></div>
              <Award size={24} className="text-yellow-200 ml-2" />
            </div>
          </motion.div>
        )}
        {showProfile && <PlayerProfile nickname={nickname} stats={stats} completedDays={completedDays} dailyStreak={dailyStreak} theme={currentTheme} playerRank={playerRank} playerPoints={playerPoints} pinnedAchievements={pinnedAchievements} onPinAchievement={handlePinAchievement} onClose={() => setShowProfile(false)} />}
        {showDailyReward && (
          <motion.div initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 100 }} className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-[100]">
            <button onClick={claimDailyReward} className="bg-gradient-to-r from-yellow-600 to-amber-600 border-2 border-yellow-400/50 rounded-2xl p-4 shadow-[0_0_30px_rgba(250,204,21,0.3)] flex items-center gap-3 group">
              <Gift size={32} className="text-yellow-200" />
              <div className="text-left"><p className="text-yellow-100 text-xs font-bold uppercase tracking-wider">Codzienna nagroda</p><p className="text-white font-black text-lg leading-tight">+{DAILY_REWARD_BASE} PKT</p></div>
              <ChevronRight size={20} className="text-yellow-200/60" />
            </button>
          </motion.div>
        )}
        {activeModal !== 'none' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-slate-900 border border-white/10 w-full max-w-2xl rounded-[2rem] p-8 max-h-[80vh] overflow-y-auto relative">
              <button onClick={() => setActiveModal('none')} className="absolute right-6 top-6 text-white/40 hover:text-white"><X /></button>
              {activeModal === 'howtoplay' && (
                <div className="space-y-6">
                  <h2 className="text-3xl font-black text-white mb-6 flex items-center gap-3"><HelpCircle className={currentTheme.text} /> JAK GRAĆ?</h2>
                  <div className="space-y-4">
                    <div className="bg-white/5 p-5 rounded-2xl border border-white/10"><h3 className="text-lg font-bold text-white mb-2">1. Posłuchaj fragmentu</h3><p className="text-white/60 text-sm">Kliknij Play, aby odsłuchać krótki fragment. Z każdą próbą fragment jest dłuższy!</p></div>
                    <div className="bg-white/5 p-5 rounded-2xl border border-white/10"><h3 className="text-lg font-bold text-white mb-2">2. Zgadnij tytuł i wykonawcę</h3><p className="text-white/60 text-sm">Wpisz tytuł piosenki i nazwę artysty. Za każde trafienie dostajesz punkty!</p></div>
                    <div className="bg-white/5 p-5 rounded-2xl border border-white/10"><h3 className="text-lg font-bold text-white mb-2">3. Masz 6 prób</h3><p className="text-white/60 text-sm">Im szybciej zgadniesz, tym więcej punktów!</p></div>
                    <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 p-5 rounded-2xl border border-yellow-500/30"><h3 className="text-lg font-bold text-yellow-400 mb-2">💡 Punktacja</h3><div className="text-white/70 text-sm space-y-1"><p>• <span className="text-green-400 font-bold">+100 do +10 pkt</span> za pełne zgadnięcie</p><p>• <span className="text-yellow-400 font-bold">+30 pkt</span> za sam tytuł</p><p>• <span className="text-yellow-400 font-bold">+20 pkt</span> za samego wykonawcę</p><p>• <span className="text-orange-400 font-bold">+25 pkt</span> codzienna nagroda!</p></div></div>
                  </div>
                </div>
              )}
              {activeModal === 'leaderboard' && (
                <div className="w-full">
                  {viewingPlayer ? (
                    <div className="space-y-5">
                      <button onClick={() => setViewingPlayer(null)} className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm font-bold"><ArrowLeft size={16}/> Powrót</button>
                      <div className="text-center">
                        <div className={`w-20 h-20 rounded-full ${currentTheme.primary} flex items-center justify-center text-white text-3xl font-black mx-auto mb-3`}>{viewingPlayer.nickname.charAt(0).toUpperCase()}</div>
                        <h3 className="text-2xl font-black text-white uppercase">{viewingPlayer.nickname}</h3>
                        <p className="text-yellow-500 font-bold text-sm mt-1">🏆 #{viewingPlayer.rank}</p>
                      </div>
                      <div className={`bg-gradient-to-r ${currentTheme.gradient} to-transparent border ${currentTheme.border}/30 rounded-2xl p-5 text-center`}>
                        <p className="text-white/40 text-[9px] uppercase font-bold tracking-widest mb-1">Łączne punkty</p>
                        <p className="text-3xl font-black text-white">{viewingPlayer.points.toLocaleString()}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center"><p className="text-xl font-black text-white">{viewingPlayer.total_games}</p><p className="text-[8px] text-white/40 uppercase font-bold mt-0.5">Gier</p></div>
                        <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center"><p className="text-xl font-black text-green-400">{viewingPlayer.wins}</p><p className="text-[8px] text-white/40 uppercase font-bold mt-0.5">Wygranych</p></div>
                        <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center"><p className={`text-xl font-black ${viewingPlayer.total_games > 0 ? (viewingPlayer.wins / viewingPlayer.total_games * 100) >= 60 ? 'text-green-400' : (viewingPlayer.wins / viewingPlayer.total_games * 100) >= 30 ? 'text-yellow-400' : 'text-red-400' : 'text-white/40'}`}>{viewingPlayer.total_games > 0 ? Math.round((viewingPlayer.wins / viewingPlayer.total_games) * 100) : 0}%</p><p className="text-[8px] text-white/40 uppercase font-bold mt-0.5">Skuteczność</p></div>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                        <p className="text-lg font-black text-white">{viewingPlayer.total_games > 0 ? (viewingPlayer.total_games - viewingPlayer.wins) : 0}</p>
                        <p className="text-[8px] text-white/40 uppercase font-bold mt-0.5">Przegranych</p>
                      </div>
                      {isMyLeaderboardEntry(viewingPlayer.odwiedza) && (<div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-center"><p className="text-green-400 text-xs font-bold">✨ To Twój profil!</p></div>)}
                    </div>
                  ) : (
                    <>
                      <h2 className="text-3xl font-black text-white mb-4 text-center uppercase">🏆 RANKING GRACZY</h2>
                      <div className="flex justify-center gap-2 mb-4">{([10, 100, 500] as const).map(tab => (<button key={tab} onClick={() => { setLeaderboardTab(tab); fetchLeaderboard(tab); }} className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${leaderboardTab === tab ? `${currentTheme.primary} text-white` : 'bg-white/10 text-white/50 hover:bg-white/20'}`}>TOP {tab}</button>))}</div>
                      <div className="space-y-2 max-w-sm mx-auto max-h-[50vh] overflow-y-auto pr-2">
                        {leaderboard.length === 0 ? <div className="text-center py-8 text-white/20 italic font-bold">Ładowanie...</div> : leaderboard.map(entry => (
                          <button key={entry.rank} onClick={() => setViewingPlayer({ nickname: entry.username, points: entry.score, wins: entry.wins, total_games: entry.total_games, rank: entry.rank, odwiedza: entry.odwiedza })}
                            className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all ${isMyLeaderboardEntry(entry.odwiedza) ? `${currentTheme.primary} border-white shadow-xl` : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                            <div className="flex items-center gap-3">
                              <span className={`text-xs font-black w-8 ${entry.rank <= 3 ? 'text-yellow-500' : 'text-white/40'}`}>{entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}</span>
                              <span className="font-bold text-white text-sm">{entry.username}</span>
                              {isMyLeaderboardEntry(entry.odwiedza) && <span className="text-[8px] bg-white/20 text-white/60 px-1.5 py-0.5 rounded-full font-bold">TY</span>}
                            </div>
                            <div className="text-right"><div className="text-lg font-black text-white leading-none">{entry.score.toLocaleString()}</div><div className="text-[8px] uppercase font-black text-white/30">pkt</div></div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
              {activeModal === 'contact' && (<div className="text-center"><h2 className="text-3xl font-black text-white mb-6">KONTAKT</h2><div className="bg-white/5 p-8 rounded-3xl border border-white/10 text-center"><p className="text-white/40 text-sm mb-4 uppercase font-bold tracking-widest">Masz pytanie lub sugestię?</p><a href="mailto:jogisek@interia.pl" className={`text-2xl font-black ${currentTheme.text} hover:scale-105 transition-transform block mb-4`}>jogisek@interia.pl</a></div></div>)}
              {activeModal === 'tos' && (<div className="space-y-4"><h2 className="text-3xl font-black text-white mb-6">REGULAMIN</h2><p className="text-white/40 text-xs mb-4">Ostatnia aktualizacja: 5.06.2026</p><div className="space-y-4 text-white/70 text-sm leading-relaxed">
<div className="bg-white/5 p-4 rounded-xl"><h3 className="font-bold text-white mb-2">§1. Postanowienia ogólne</h3><p>1.1. Serwis &quot;Co Jest Grane?&quot; jest darmową grą muzyczną online dostępną pod adresem co-jest-grane.pl, stworzoną w celach rozrywkowych i edukacyjnych.</p><p className="mt-2">1.2. Właścicielem i administratorem Serwisu jest Jogis (kontakt: jogisek@interia.pl).</p><p className="mt-2">1.3. Korzystanie z Serwisu jest bezpłatne i nie wymaga rejestracji.</p></div>
<div className="bg-white/5 p-4 rounded-xl"><h3 className="font-bold text-white mb-2">§2. Zasady korzystania</h3><p>2.1. Użytkownik zobowiązuje się do korzystania z Serwisu zgodnie z obowiązującym prawem i zasadami fair play.</p><p className="mt-2">2.2. Zabrania się: używania wulgarnych lub obraźliwych pseudonimów, prób manipulowania wynikami lub rankingiem, nadużywania systemów punktowych, używania automatycznych narzędzi (botów).</p><p className="mt-2">2.3. Administrator zastrzega sobie prawo do usunięcia konta lub zresetowania wyników w przypadku naruszenia regulaminu.</p></div>
<div className="bg-white/5 p-4 rounded-xl"><h3 className="font-bold text-white mb-2">§3. Konta i dane</h3><p>3.1. Logowanie możliwe jest przez konto Google lub adres e-mail (Firebase Authentication).</p><p className="mt-2">3.2. Postępy niezalogowanych użytkowników zapisywane są lokalnie w przeglądarce (localStorage).</p><p className="mt-2">3.3. Użytkownik może w dowolnym momencie usunąć swoje dane kontaktując się z administratorem.</p></div>
<div className="bg-white/5 p-4 rounded-xl"><h3 className="font-bold text-white mb-2">§4. Własność intelektualna</h3><p>4.1. Fragmenty muzyczne wykorzystywane w grze służą wyłącznie celom edukacyjnym i rozrywkowym w ramach dozwolonego użytku.</p><p className="mt-2">4.2. Wszystkie prawa do utworów muzycznych należą do ich właścicieli.</p></div>
<div className="bg-white/5 p-4 rounded-xl"><h3 className="font-bold text-white mb-2">§5. Odpowiedzialność</h3><p>5.1. Serwis udostępniany jest w stanie &quot;as is&quot;. Administrator nie gwarantuje ciągłej dostępności.</p><p className="mt-2">5.2. Administrator zastrzega prawo do modyfikacji, zawieszenia lub zakończenia działania Serwisu.</p></div>
<div className="bg-white/5 p-4 rounded-xl"><h3 className="font-bold text-white mb-2">§6. Postanowienia końcowe</h3><p>6.1. Regulamin może zostać zmieniony w dowolnym momencie. O istotnych zmianach użytkownicy zostaną poinformowani.</p><p className="mt-2">6.2. Korzystanie z Serwisu po wprowadzeniu zmian oznacza ich akceptację.</p></div>
</div></div>)}
              {activeModal === 'privacy' && (<div className="space-y-4"><h2 className="text-3xl font-black text-white mb-6">POLITYKA PRYWATNOŚCI</h2><p className="text-white/40 text-xs mb-4">Ostatnia aktualizacja: 5.06.2026</p><div className="space-y-4 text-white/70 text-sm leading-relaxed">
<div className="bg-white/5 p-4 rounded-xl"><h3 className="font-bold text-white mb-2">1. Administrator danych</h3><p>Administratorem danych osobowych jest Jogis. Kontakt: jogisek@interia.pl</p></div>
<div className="bg-white/5 p-4 rounded-xl"><h3 className="font-bold text-white mb-2">2. Jakie dane zbieramy?</h3><ul className="list-disc list-inside mt-2 space-y-1"><li>Pseudonim (nick) wybrany przez użytkownika</li><li>Postępy w grze (wyniki, statystyki, osiągnięcia)</li><li>Adres e-mail (tylko przy rejestracji konta)</li><li>Identyfikator sesji (anonimowy UUID)</li></ul><p className="mt-2">Nie zbieramy danych wrażliwych ani nie profilujemy użytkowników w celach marketingowych.</p></div>
<div className="bg-white/5 p-4 rounded-xl"><h3 className="font-bold text-white mb-2">3. Cel przetwarzania</h3><ul className="list-disc list-inside mt-2 space-y-1"><li>Zapewnienie funkcjonalności gry (zapis postępów, ranking)</li><li>Synchronizacja postępów między urządzeniami</li><li>Wyświetlanie pseudonimu w rankingu</li></ul></div>
<div className="bg-white/5 p-4 rounded-xl"><h3 className="font-bold text-white mb-2">4. Przechowywanie danych</h3><ul className="list-disc list-inside mt-2 space-y-1"><li><strong>Supabase</strong> (baza danych) — serwery w UE</li><li><strong>Firebase Authentication</strong> (Google) — uwierzytelnianie</li><li><strong>localStorage</strong> przeglądarki — dane lokalne</li></ul></div>
<div className="bg-white/5 p-4 rounded-xl"><h3 className="font-bold text-white mb-2">5. Cookies i analityka</h3><p>Serwis wykorzystuje Google Analytics do zbierania anonimowych statystyk odwiedzin.</p></div>
<div className="bg-white/5 p-4 rounded-xl"><h3 className="font-bold text-white mb-2">6. Prawa użytkownika</h3><ul className="list-disc list-inside mt-2 space-y-1"><li>Dostęp do swoich danych</li><li>Sprostowanie nieprawidłowych danych</li><li>Usunięcie danych (&quot;prawo do bycia zapomnianym&quot;)</li><li>Przeniesienie danych</li></ul><p className="mt-2">Kontakt: jogisek@interia.pl</p></div>
</div></div>)}
              {activeModal === 'feedback' && (<div className="space-y-6">
<h2 className="text-3xl font-black text-white mb-2 text-center">ZGŁOSZENIA</h2>
<p className="text-white/40 text-sm text-center">Wyślij nam swoją sugestię lub zgłoszenie!</p>
<div className="space-y-3">
  <a href="https://forms.gle/rSpeXtN6xMw5Hy9M8" target="_blank" rel="noopener noreferrer" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl flex items-center gap-4 hover:bg-white/10 transition-all group"><span className="text-3xl">🎵</span><div className="flex-1"><p className="text-white font-bold group-hover:text-green-400 transition-colors">Zaproponuj piosenkę</p><p className="text-white/40 text-xs">Masz pomysł na piosenkę do gry? Zgłoś ją!</p></div><ChevronRight size={20} className="text-white/20 ml-auto" /></a>
  <a href="https://forms.gle/rSpeXtN6xMw5Hy9M8" target="_blank" rel="noopener noreferrer" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl flex items-center gap-4 hover:bg-white/10 transition-all group"><span className="text-3xl">🐛</span><div className="flex-1"><p className="text-white font-bold group-hover:text-red-400 transition-colors">Zgłoś błąd</p><p className="text-white/40 text-xs">Coś nie działa? Znalazłeś buga? Daj znać!</p></div><ChevronRight size={20} className="text-white/20 ml-auto" /></a>
  <a href="https://forms.gle/rSpeXtN6xMw5Hy9M8" target="_blank" rel="noopener noreferrer" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl flex items-center gap-4 hover:bg-white/10 transition-all group"><span className="text-3xl">💡</span><div className="flex-1"><p className="text-white font-bold group-hover:text-yellow-400 transition-colors">Sugestia / pomysł</p><p className="text-white/40 text-xs">Masz pomysł na nową funkcję lub ulepszenie?</p></div><ChevronRight size={20} className="text-white/20 ml-auto" /></a>
  <a href="https://forms.gle/i2sR9uNLzmkdyeac9" target="_blank" rel="noopener noreferrer" className="w-full bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/20 p-5 rounded-2xl flex items-center gap-4 hover:bg-orange-500/20 transition-all group"><span className="text-3xl">🔄</span><div className="flex-1"><p className="text-white font-bold group-hover:text-orange-400 transition-colors">Przywrócenie punktów</p><p className="text-white/40 text-xs">Straciłeś punkty? Wypełnij formularz!</p></div><ChevronRight size={20} className="text-white/20 ml-auto" /></a>
</div>
</div>)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fixed UI elements */}
      <div className="fixed top-8 left-8 z-40 flex flex-col gap-2">
        <div className="flex gap-2">
          <button onClick={() => setShowSettings(true)} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all text-white/50 hover:text-white"><Settings size={24} /></button>
          <button onClick={openProfile} className={`p-3 ${currentTheme.primary} hover:opacity-90 rounded-2xl border border-white/10 transition-all text-white shadow-lg`}><User size={24} /></button>
          <button onClick={() => setShowAuthModal(true)} className={`p-3 ${user ? 'bg-green-600' : 'bg-white/5'} hover:opacity-90 rounded-2xl border border-white/10 transition-all text-white shadow-lg`}>{user ? <Cloud size={24} /> : <LogIn size={24} />}</button>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-xl border border-white/10"><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span><span className="text-[10px] font-bold text-white/50">{onlinePlayers + 10} graczy online</span></div>
        {/* Social media icons */}
        <div className="flex gap-2">
          <a href="https://www.tiktok.com/@co_jest_grane_pl" target="_blank" rel="noopener noreferrer" className="p-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl hover:bg-white/10 transition-all text-white/40 hover:text-cyan-400"><svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.9-.32-1.98-.23-2.8.2-1.2.64-1.81 1.92-1.85 3.22-.03.81.3 1.63.84 2.22.69.73 1.76 1.03 2.72.91 1.05-.1 1.99-.73 2.47-1.66.47-.93.46-2.04.46-3.07V.02z"/></svg></a>
          <a href="https://www.youtube.com/@co_jest_grane_pl/featured" target="_blank" rel="noopener noreferrer" className="p-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl hover:bg-white/10 transition-all text-white/40 hover:text-red-500"><svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg></a>
        </div>
      </div>

      {/* Back to menu button - visible during result, positioned below other buttons */}
      {view === 'result' && (
        <button onClick={exitToMenu} className="fixed top-28 left-4 md:top-32 md:left-8 z-50 flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 px-4 py-2.5 rounded-xl transition-all group shadow-lg">
          <ArrowLeft size={16} className="text-white/60 group-hover:text-white" />
          <span className="text-white/60 group-hover:text-white text-xs font-bold uppercase tracking-wider">Menu</span>
        </button>
      )}

      <div className="fixed top-4 right-4 md:top-8 md:right-8 z-40 flex flex-col items-end gap-2 max-w-[200px]">
        <div className={`px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-[8px] md:text-[10px] font-black tracking-widest ${currentTheme.text}`}>ALPHA v1.5</div>
        {showStatsPanel && (<div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-2 md:p-3 flex gap-3 md:gap-4 shadow-2xl"><div className="text-center"><div className="text-[8px] md:text-[9px] uppercase font-black text-white/30 tracking-tighter">Gry</div><div className="text-xs md:text-sm font-black text-white leading-none">{stats.total}</div></div><div className="w-[1px] bg-white/10 self-stretch" /><div className="text-center"><div className="text-[8px] md:text-[9px] uppercase font-black text-white/30 tracking-tighter">Wygrane</div><div className="text-xs md:text-sm font-black text-green-500 leading-none">{stats.wins}</div></div></div>)}
        {newsItems.length > 0 && view === 'menu' && (
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl overflow-hidden w-full">
            <button onClick={() => setNewsExpanded(!newsExpanded)} className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 transition-all">
              <span className="text-sm">📢</span><span className="text-white/50 text-[9px] font-bold uppercase tracking-widest flex-1 text-left">Aktualności</span>
              <ChevronRight size={12} className={`text-white/20 transition-transform duration-200 ${newsExpanded ? 'rotate-90' : ''}`} />
            </button>
            <AnimatePresence>{newsExpanded && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="px-2 pb-2 space-y-1.5 max-h-48 overflow-y-auto">{newsItems.map(item => (
                  <div key={item.id} className="flex gap-2 items-start bg-white/5 rounded-lg px-2.5 py-2"><span className="text-xs shrink-0 mt-0.5">{item.emoji}</span><div className="min-w-0 flex-1"><p className="text-white/60 text-[10px] leading-relaxed">{item.tresc}</p></div></div>
                ))}</div>
              </motion.div>
            )}</AnimatePresence>
          </div>
        )}
        {topPlayers.length > 0 && view === 'menu' && (
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl overflow-hidden w-full">
            <div className="px-3 py-2.5 flex items-center gap-2"><span className="text-sm">🏆</span><span className="text-white/50 text-[9px] font-bold uppercase tracking-widest flex-1">Top 3</span></div>
            <div className="px-2 pb-2 space-y-1">{topPlayers.map((p, i) => (<div key={i} className="flex items-center gap-2 bg-white/5 rounded-lg px-2.5 py-1.5"><span className="text-xs shrink-0">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span><span className="text-white/60 text-[10px] font-bold flex-1 truncate">{p.nickname}</span><span className="text-white/30 text-[9px] font-mono">{p.points.toLocaleString()}</span></div>))}</div>
            <button onClick={() => { setLeaderboardTab(10); fetchLeaderboard(10); setViewingPlayer(null); setActiveModal('leaderboard'); }} className={`w-full py-2 text-[9px] font-bold uppercase tracking-widest ${currentTheme.text} hover:bg-white/5 transition-all border-t border-white/5`}>Zobacz ranking →</button>
          </div>
        )}
        {/* Moje projekty 4fun */}
        {view === 'menu' && (
          <div className="w-full space-y-2">
            <p className="text-white/40 text-[9px] font-bold uppercase tracking-widest px-1 flex items-center gap-1.5"><span>🚀</span> Moje projekty 4fun</p>
            <a href="https://serioxd.netlify.app" target="_blank" rel="noopener noreferrer" className="block group">
              <div className="bg-gradient-to-r from-slate-500/10 to-zinc-500/10 border border-white/10 hover:border-white/30 rounded-2xl p-3 flex items-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98]">
                <div className="bg-gradient-to-br from-slate-700 to-zinc-800 p-2.5 rounded-xl shrink-0 shadow-lg group-hover:scale-110 transition-transform"><span className="text-lg">🔒</span></div>
                <div className="flex-1 min-w-0"><p className="text-white font-bold text-xs">Sekretna strona</p><p className="text-white/40 text-[9px] truncate">Tylko nieliczni dają radę wejść</p></div>
                <ChevronRight size={14} className="text-white/20 group-hover:text-white/50 transition-colors shrink-0" />
              </div>
            </a>
            <a href="https://fate-game.netlify.app" target="_blank" rel="noopener noreferrer" className="block group">
              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 hover:border-purple-500/40 rounded-2xl p-3 flex items-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98]">
                <div className="bg-gradient-to-br from-purple-600 to-pink-600 p-2.5 rounded-xl shrink-0 shadow-lg group-hover:scale-110 transition-transform"><span className="text-lg">🎭</span></div>
                <div className="flex-1 min-w-0"><p className="text-white font-bold text-xs group-hover:text-purple-400 transition-colors">FateGame</p><p className="text-white/40 text-[9px] truncate">Gra decyzyjna — Twoje wybory!</p></div>
                <ChevronRight size={14} className="text-white/20 group-hover:text-purple-400 transition-colors shrink-0" />
              </div>
            </a>
          </div>
        )}
      </div>

      {/* Bottom buttons */}
      <div className="fixed bottom-4 left-4 md:bottom-8 md:left-8 z-40 flex flex-col gap-2">
        <a href="https://buymeacoffee.com/jogis" target="_blank" rel="noopener noreferrer" className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-3 transition-all flex items-center gap-2 text-white shadow-lg hover:scale-105" title="Może piwko?">
          <span className="text-lg">🍺</span><span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Może piwko?</span>
        </a>
        <button onClick={() => setActiveModal('feedback')} className="bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-3 transition-all flex items-center gap-2 text-white/50 hover:text-white shadow-lg"><span className="text-lg">📝</span><span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Zgłoszenia</span></button>
      </div>

      {/* Bottom left corner */}
      <div className="fixed bottom-4 left-4 md:bottom-8 md:left-8 z-40 flex flex-col gap-2">
        <a href="https://buymeacoffee.com/jogis" target="_blank" rel="noopener noreferrer" className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-3 transition-all flex items-center gap-2 text-white shadow-lg hover:scale-105" title="Może piwko?">
          <span className="text-lg">🍺</span>
          <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Może piwko?</span>
        </a>
        <button onClick={() => setActiveModal('feedback')} className="bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-3 transition-all flex items-center gap-2 text-white/50 hover:text-white shadow-lg"><span className="text-lg">📝</span><span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Zgłoszenia</span></button>
      </div>

      <main className="relative z-10 w-full flex flex-col items-center py-10 min-h-screen">
        <div className="flex-1 w-full flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div key={view} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full flex flex-col items-center">
              {isLoading ? (
                <div className="flex flex-col items-center gap-4"><div className={`w-12 h-12 border-4 ${currentTheme.border} border-t-transparent rounded-full animate-spin`} /><div className={`${currentTheme.text} font-black text-2xl`}>ŁADOWANIE...</div></div>
              ) : errorMessage && view === 'menu' ? (
                <div className="bg-red-500/20 border border-red-500 text-red-100 p-8 rounded-[2rem] text-center max-w-md mx-4"><h2 className="text-2xl font-black mb-4">Ups! Coś poszło nie tak</h2><p className="mb-6 opacity-80">{errorMessage}</p><button onClick={() => window.location.reload()} className="bg-white text-red-600 px-6 py-2 rounded-full font-bold">Odśwież stronę</button></div>
              ) : (
                <>
                  {view === 'menu' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-6 relative w-full max-w-4xl px-4">
                      <div className="absolute -top-24 -left-24 opacity-10 blur-3xl w-64 h-64 bg-indigo-500 rounded-full animate-pulse" />
                      <div className="flex items-center gap-4 relative z-10">
                        <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }} className={`${currentTheme.primary} p-4 md:p-5 rounded-full shadow-[0_0_40px_rgba(0,0,0,0.4)]`}><Music size={40} className="text-white" /></motion.div>
                        <div><h1 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter leading-none uppercase">CO JEST <span className={currentTheme.text}>GRANE?</span></h1><p className="text-white/30 font-bold tracking-[0.2em] uppercase text-[10px] md:text-xs mt-1">Zgadnij piosenkę po fragmencie</p></div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-2xl relative z-10 items-stretch">
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex-1 flex items-center gap-3">
                          <User size={16} className="text-white/30 shrink-0" />
                          <input type="text" value={nickname} onChange={(e) => updateNickname(e.target.value)} onBlur={handleNicknameBlur} placeholder="Twój nick..." className="w-full bg-transparent border-none outline-none font-bold text-white text-sm placeholder:text-white/20" />
                          {nickError && <span className="text-red-400 text-[8px] font-bold shrink-0">!</span>}
                          <span title={user ? "Synchronizacja" : "Zaloguj się"}>{user ? <Cloud size={14} className="text-green-400 shrink-0" /> : <CloudOff size={14} className="text-white/20 shrink-0" />}</span>
                        </div>
                        {dailyStreak > 0 && (<div className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500/20 to-yellow-500/20 py-2 px-4 rounded-2xl border border-orange-500/30 shrink-0"><Flame className="text-orange-500" size={14} /><span className="text-white/80 text-xs font-bold">{dailyStreak} dni serii</span></div>)}
                      </div>
                      {nickError && <p className="text-red-400 text-[10px] font-bold -mt-2 relative z-10">{nickError}</p>}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl relative z-10">
                        {MODE_DEFS.map(m => {
                          const isExpanded = expandedMode === m.id; const Icon = m.icon;
                          return (
                            <motion.div key={m.id} layout className="flex flex-col">
                              <motion.button layout onClick={() => handleModeClick(m.id)} className={`relative p-5 md:p-6 rounded-2xl border transition-all text-left group overflow-hidden ${isExpanded ? `${currentTheme.primary} border-white/20 shadow-lg` : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                                {m.daily && <span className="absolute top-3 right-3 text-[8px] bg-yellow-500 text-black px-2 py-0.5 rounded-full font-black uppercase tracking-wider animate-pulse">🔥 Daily</span>}
                                {!m.daily && <span className="absolute top-3 right-3 text-[8px] bg-white/10 text-white/40 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Nie daily</span>}
                                <div className="flex items-center gap-4"><div className={`p-3 rounded-xl ${isExpanded ? 'bg-white/20' : 'bg-white/5'} transition-all group-hover:scale-110`}><Icon size={28} className={isExpanded ? 'text-white' : currentTheme.text} /></div><div className="flex-1 min-w-0"><h3 className="text-xl font-black text-white">{m.label}</h3><p className={`text-xs mt-0.5 ${isExpanded ? 'text-white/60' : 'text-white/30'}`}>{m.desc}</p></div><ChevronRight size={20} className={`text-white/30 transition-transform ${isExpanded ? 'rotate-90' : ''}`} /></div>
                              </motion.button>
                              <AnimatePresence>{isExpanded && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden"><div className="pt-2 pb-1 space-y-2">{m.categories.map(cat => (<button key={cat} onClick={() => handleCategoryClick(m.id, cat)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all active:scale-[0.98]"><span className={`w-2 h-2 rounded-full ${currentTheme.primary}`} /><span className="text-white font-bold text-sm flex-1 text-left">{cat}</span><ChevronRight size={14} className="text-white/20" /></button>))}</div></motion.div>)}</AnimatePresence>
                            </motion.div>
                          );
                        })}
                      </div>
                      {/* Community */}
                      <button onClick={() => setShowCommunity(true)} className="w-full max-w-2xl relative z-10 group">
                        <div className="bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 border border-indigo-500/30 hover:border-indigo-500/50 rounded-2xl p-4 flex items-center gap-4 transition-all hover:scale-[1.01] active:scale-[0.99]"><div className="bg-gradient-to-br from-indigo-600 to-cyan-600 p-3 rounded-xl shrink-0 shadow-lg group-hover:scale-110 transition-transform"><span className="text-2xl">🌍</span></div><div className="flex-1 min-w-0 text-left"><p className="text-white font-bold text-sm flex items-center gap-2">SPOŁECZNOŚĆ <span className="text-[8px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">NEW</span></p><p className="text-white/40 text-xs">Twórz własne eventy i graj w eventy innych!</p></div><ChevronRight size={18} className="text-white/20 group-hover:text-cyan-400 transition-colors shrink-0" /></div>
                      </button>
                      {/* Events + Ankieta bubble */}
                      <div className="w-full max-w-2xl relative z-10 flex items-center gap-3">
                        <button onClick={() => { setShowEvents(true); setSelectedEvent(null); }} className="flex-1 group">
                          <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 hover:border-yellow-500/50 rounded-2xl p-4 flex items-center gap-4 transition-all hover:scale-[1.01] active:scale-[0.99]"><div className="bg-gradient-to-br from-yellow-500 to-orange-600 p-3 rounded-xl shrink-0 shadow-lg group-hover:scale-110 transition-transform"><span className="text-2xl">🎪</span></div><div className="flex-1 min-w-0 text-left"><p className="text-white font-bold text-sm flex items-center gap-2">EVENTY TWÓRCY {events.length > 0 && <span className="bg-green-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase animate-pulse">{events.length} aktywne</span>}</p><p className="text-white/40 text-xs">Specjalne wyzwania tematyczne!</p></div><ChevronRight size={18} className="text-white/20 group-hover:text-yellow-400 transition-colors shrink-0" /></div>
                        </button>
                        {/* Bubble RIGHT of the card */}
                        {ankietaLink && (
                          <a href={ankietaLink} target="_blank" rel="noopener noreferrer" className="shrink-0 bg-gradient-to-br from-red-500 to-pink-600 text-white text-[9px] font-black px-3 py-3 rounded-2xl shadow-lg flex flex-col items-center gap-1 hover:scale-105 transition-transform">
                            <span className="text-lg">🗳️</span>
                            <span className="leading-tight text-center">Zagłosuj<br/>na event!</span>
                          </a>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-2xl relative z-10">
                        <button onClick={() => setActiveModal('howtoplay')} className={`flex-1 ${currentTheme.primary} ${currentTheme.hover} text-white py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg`}><HelpCircle size={18} /> JAK GRAĆ?</button>
                        <button onClick={() => { setLeaderboardTab(10); fetchLeaderboard(10); setViewingPlayer(null); setActiveModal('leaderboard'); }} className="flex-1 bg-white/10 border border-white/10 text-white py-3.5 rounded-2xl font-bold text-sm hover:bg-white/20 transition-all flex items-center justify-center gap-2">🏆 RANKING</button>
                      </div>
                      {/* Multiplayer */}
                      <button onClick={() => setShowMultiplayer(true)} className="w-full max-w-2xl relative z-10 group">
                        <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 hover:border-purple-500/50 rounded-2xl p-4 flex items-center gap-4 transition-all hover:scale-[1.01] active:scale-[0.99]"><div className="bg-gradient-to-br from-purple-600 to-pink-600 p-3 rounded-xl shrink-0 shadow-lg group-hover:scale-110 transition-transform"><span className="text-2xl">⚔️</span></div><div className="flex-1 min-w-0 text-left"><p className="text-white font-bold text-sm flex items-center gap-2 flex-wrap">MULTIPLAYER<span className="text-[8px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">BETA</span></p><p className="text-white/40 text-xs">Graj grupowo lub 1v1 ze znajomymi!</p></div><ChevronRight size={18} className="text-white/20 group-hover:text-purple-400 transition-colors shrink-0" /></div>
                      </button>
                    </motion.div>
                  )}

                  {view === 'calendar' && (
                    <div className="flex flex-col items-center gap-6 w-full max-w-2xl px-4">
                      <button onClick={() => setView('menu')} className="self-start flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 px-4 py-2.5 rounded-xl transition-all group"><ArrowLeft size={18} className="text-white/60 group-hover:text-white" /><span className="text-white/60 group-hover:text-white text-xs font-bold uppercase tracking-wider">Powrót do menu</span></button>
                      <div className="text-center"><h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-widest">Wybierz Wyzwanie</h2><p className={`${currentTheme.text} font-bold mt-2 uppercase tracking-tighter text-sm`}>{gameMode === 'klasyczny' ? 'Daily Song' : gameMode} • {currentCategory}</p></div>
                      {(() => {
                        const now = new Date(); const offset = now.getTimezoneOffset();
                        const localToday = new Date(now.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];
                        const modeSongs = songs.filter(s => s.mode === gameMode && s.category === currentCategory);
                        const allDates = Array.from(new Set(modeSongs.map(s => s.date || localToday))).sort();
                        const months = new Map<string, string[]>();
                        allDates.forEach(date => { const mk = date.substring(0, 7); if (!months.has(mk)) months.set(mk, []); months.get(mk)!.push(date); });
                        const monthKeys = Array.from(months.keys()).sort();
                        const currentMonthKey = localToday.substring(0, 7);
                        const activeMonth = calendarMonth && months.has(calendarMonth) ? calendarMonth : (months.has(currentMonthKey) ? currentMonthKey : monthKeys[monthKeys.length - 1] || '');
                        const activeDates = months.get(activeMonth) || [];
                        const globalStartIndex = allDates.indexOf(activeDates[0] || '');
                        const monthNames: Record<string, string> = { '01': 'Styczeń', '02': 'Luty', '03': 'Marzec', '04': 'Kwiecień', '05': 'Maj', '06': 'Czerwiec', '07': 'Lipiec', '08': 'Sierpień', '09': 'Wrzesień', '10': 'Październik', '11': 'Listopad', '12': 'Grudzień' };
                        const getMonthLabel = (key: string) => { const [year, month] = key.split('-'); return `${monthNames[month] || month} ${year}`; };
                        const activeMonthIdx = monthKeys.indexOf(activeMonth);
                        const prevMonth = monthKeys[activeMonthIdx - 1]; const nextMonth = monthKeys[activeMonthIdx + 1];
                        return (
                          <>
                            {monthKeys.length > 0 && (<div className="flex items-center gap-3 w-full justify-center"><button disabled={!prevMonth} onClick={() => prevMonth && setCalendarMonth(prevMonth)} className={`p-2 rounded-xl border border-white/10 transition-all ${!prevMonth ? 'opacity-0' : 'hover:bg-white/10 text-white/40 hover:text-white'}`}><ChevronLeft size={18} /></button><div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-2.5 min-w-[180px] text-center"><span className="text-white font-bold text-sm">{getMonthLabel(activeMonth)}</span></div><button disabled={!nextMonth} onClick={() => nextMonth && setCalendarMonth(nextMonth)} className={`p-2 rounded-xl border border-white/10 transition-all ${!nextMonth ? 'opacity-0' : 'hover:bg-white/10 text-white/40 hover:text-white'}`}><ChevronRight size={18} /></button></div>)}
                            {activeDates.length === 0 ? (<div className="bg-white/5 p-8 rounded-3xl border border-white/10 text-center w-full"><p className="text-white/40 mb-2 font-bold uppercase tracking-widest">Brak wyzwań</p></div>) : (
                              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2.5 w-full">
                                {activeDates.map((date, index) => {
                                  const globalIndex = globalStartIndex + index; const dayKey = `${date}-${gameMode}-${currentCategory}`; const session = completedDays[dayKey]; const isToday = date === localToday; const isFuture = date > localToday; const dayNum = date.split('-')[2];
                                  const songForDate = modeSongs.find(s => s.date === date);
                                  const gatunek = songForDate?.gatunek;
                                  return (<button key={date} disabled={isFuture} onClick={() => startDailyGame(date)} className={`relative p-3 md:p-4 rounded-2xl border transition-all flex flex-col items-center group ${isFuture ? 'bg-white/5 border-white/5 opacity-30 cursor-not-allowed' : session?.status === 'won' ? 'bg-green-500/15 border-green-500/40 hover:bg-green-500/25' : session?.status === 'lost' ? 'bg-red-500/15 border-red-500/40 hover:bg-red-500/25' : isToday ? `${currentTheme.primary} border-white/50 shadow-[0_0_15px_rgba(255,255,255,0.15)]` : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                                    {isFuture && <Lock size={12} className="text-white/20 absolute top-1 right-1" />}
                                    {session && !isFuture && (<div className="absolute -top-1.5 -right-1.5 z-10">{session.status === 'won' ? <CheckCircle size={12} className="text-green-500" /> : session.status === 'playing' ? <Clock size={12} className="text-yellow-500" /> : <XCircle size={12} className="text-red-500" />}</div>)}
                                    {isToday && !session && <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[6px] font-black px-1.5 py-0.5 rounded-full uppercase z-20 animate-pulse">Nowe</div>}
                                    <span className={`text-[8px] uppercase font-bold ${isToday ? 'text-white/80' : 'text-white/20'}`}>{dayNum}.{date.split('-')[1]}</span>
                                    <span className={`text-lg md:text-xl font-black leading-none mt-0.5 ${isToday ? 'text-white' : session ? 'text-white/70' : 'text-white/40'}`}>#{globalIndex + 1}</span>
                                    {gatunek && <span className={`text-[7px] mt-0.5 uppercase font-bold tracking-wider ${isToday ? 'text-white/50' : 'text-white/15'}`}>{gatunek}</span>}
                                  </button>);
                                })}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {view === 'playing' && currentSong && (() => {
                    // Compute nav for playing view
                    const nowP = new Date(); const offP = nowP.getTimezoneOffset();
                    const localTodayP = new Date(nowP.getTime() - (offP * 60 * 1000)).toISOString().split('T')[0];
                    const modeSongsP = songs.filter(s => s.mode === gameMode && s.category === currentCategory);
                    const sortedDatesP = Array.from(new Set(modeSongsP.map(s => s.date || localTodayP))).sort();
                    let currentIndexP = currentSong?.date ? sortedDatesP.indexOf(currentSong.date) : -1;
                    if (currentIndexP === -1) { const ms = modeSongsP.find(s => s.id === currentSong?.id); if (ms?.date) currentIndexP = sortedDatesP.indexOf(ms.date); }
                    const challengeNumberP = currentIndexP !== -1 ? currentIndexP + 1 : '?';
                    const prevDateP = currentIndexP > 0 ? sortedDatesP[currentIndexP - 1] : undefined;
                    const nextDateP = currentIndexP >= 0 && currentIndexP < sortedDatesP.length - 1 ? sortedDatesP[currentIndexP + 1] : undefined;
                    const isNextAvailP = nextDateP && nextDateP <= localTodayP;
                    const pEvSongs = activeEventSongsRef.current;
                    const pEvIdx = activeEventSlug ? activeEventNum - 1 : -1;
                    const pEvSorted = activeEventSlug ? [...pEvSongs].sort((a: any, b: any) => (a.date || a.id.toString()).localeCompare(b.date || b.id.toString())) : [];
                    const pEvPrev = pEvIdx > 0 ? pEvSorted[pEvIdx - 1] : null;
                    const pEvNext = pEvIdx >= 0 && pEvIdx < pEvSorted.length - 1 ? pEvSorted[pEvIdx + 1] : null;
                    const pEvNextAvail = pEvNext && (!pEvNext.date || pEvNext.date <= localTodayP);
                    const pHasPrev = activeEventSlug ? !!pEvPrev : !!prevDateP;
                    const pHasNext = activeEventSlug ? !!pEvNextAvail : !!isNextAvailP;
                    return (
                    <div className="flex items-center justify-center w-full max-w-7xl px-4 relative">
                      {/* Side nav buttons - visible ONLY during active playing, hidden after game ends */}
                      {gameStatus === 'playing' && (<>
                        <button disabled={!pHasPrev || navCooldown} onClick={() => { if (activeEventSlug && pEvPrev) startEventGame(activeEventSlug, pEvPrev, pEvIdx); else if (prevDateP) startDailyGame(prevDateP); }} className={`fixed left-2 md:left-6 lg:left-[calc(50%-28rem)] top-[45%] z-30 px-3 py-4 md:px-4 md:py-5 rounded-2xl bg-white/[0.07] hover:bg-white/15 backdrop-blur-md border border-white/10 flex flex-col items-center justify-center gap-1 shadow-lg transition-all ${!pHasPrev || navCooldown ? 'opacity-0 pointer-events-none' : ''}`}>
                          <ChevronLeft size={22} className="text-white/50" />
                          <span className="text-[8px] font-black text-white/40 uppercase tracking-wider">Poprzednie</span>
                        </button>
                        <button disabled={!pHasNext || navCooldown} onClick={() => { if (activeEventSlug && pEvNext) startEventGame(activeEventSlug, pEvNext, pEvIdx + 2); else if (nextDateP && isNextAvailP) startDailyGame(nextDateP); }} className={`fixed right-2 md:right-6 lg:right-[calc(50%-28rem)] top-[45%] z-30 px-3 py-4 md:px-4 md:py-5 rounded-2xl bg-white/[0.07] hover:bg-white/15 backdrop-blur-md border border-white/10 flex flex-col items-center justify-center gap-1 shadow-lg transition-all ${!pHasNext || navCooldown ? 'opacity-0 pointer-events-none' : ''}`}>
                          <ChevronRight size={22} className="text-white/50" />
                          <span className="text-[8px] font-black text-white/40 uppercase tracking-wider">Następne</span>
                        </button>
                      </>)}
                    <div className="flex flex-col items-center gap-6 w-full max-w-xl z-10 py-4 px-4">
                      <div id="yt-game-player" className="hidden" />
                      <div className="w-full flex justify-between items-center mb-2 gap-2">
                        <button onClick={goToCalendar} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/10 px-3 py-2 rounded-xl transition-all group"><ArrowLeft size={16} className="text-white/60 group-hover:text-white" /><span className="text-white/60 group-hover:text-white text-[10px] md:text-xs font-bold uppercase tracking-wider">Powrót</span></button>
                        <button onClick={exitToMenu} className="flex items-center gap-2 hover:opacity-80 transition-opacity group"><div className={`${currentTheme.primary} p-1.5 rounded-lg`}><Music size={14} className="text-white" /></div><span className="text-white/40 group-hover:text-white text-[10px] md:text-xs font-black uppercase tracking-tight transition-colors">Co Jest Grane?</span></button>
                        <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl shrink-0">{volume === 0 ? <VolumeX size={14}/> : <Volume2 size={14}/>}<input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => updateVolume(parseFloat(e.target.value))} className="w-16 md:w-20 h-1 accent-white" /></div>
                      </div>
                      <div className="w-full flex gap-2 mb-4">{[0,1,2,3,4,5].map(idx => (<div key={idx} className={`h-3 flex-1 rounded-full transition-all ${idx < attempt ? (activeEventSlug ? 'bg-yellow-500/40' : 'bg-white/30') : idx === attempt ? (activeEventSlug ? 'bg-yellow-500 animate-pulse' : `${currentTheme.primary} animate-pulse`) : 'bg-white/10'}`} />))}</div>
                      {activeEventSlug ? (
                        <>
                          <div className={`bg-gradient-to-r ${activeEventSlug.startsWith('community-') ? 'from-indigo-500/20 to-cyan-500/20 border-indigo-500/30' : 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30'} border rounded-2xl px-5 py-2 mb-2`}>
                            <span className={`${activeEventSlug.startsWith('community-') ? 'text-indigo-400' : 'text-yellow-400'} text-[9px] font-black uppercase tracking-widest`}>{activeEventSlug.startsWith('community-') ? '🌍' : '🎪'} {activeEventName}</span>
                          </div>
                          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} key={`event-${activeEventNum}`} className="text-3xl font-black uppercase tracking-[0.2em] text-white mb-2">WYZWANIE #{activeEventNum}</motion.div>
                          <div className={`${activeEventSlug.startsWith('community-') ? 'text-indigo-400/70' : 'text-yellow-400/70'} text-xs font-bold uppercase tracking-widest mb-2`}>{activeEventSlug.startsWith('community-') ? 'Społeczność' : 'Event Twórcy'} • {activeEventName}</div>
                        </>
                      ) : (
                        <>
                          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} key={challengeNumberP} className="text-3xl font-black uppercase tracking-[0.2em] text-white mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">WYZWANIE #{challengeNumberP}</motion.div>
                          <div className={`${currentTheme.text} text-xs font-bold uppercase tracking-widest mb-2`}>{currentCategory} • {gameMode === 'klasyczny' ? 'Daily' : gameMode}</div>
                        </>
                      )}
                      {currentSong?.gatunek && <span className="inline-block bg-white/10 border border-white/10 text-white/60 text-[10px] font-bold px-3 py-1 rounded-full mb-3 uppercase tracking-wider">{currentSong.gatunek}</span>}
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={playMusic} className={`w-40 h-40 rounded-full flex items-center justify-center transition-all shadow-2xl ${isPlaying ? (activeEventSlug ? 'bg-gradient-to-br from-yellow-500 to-orange-600 ring-8 ring-yellow-500/20 text-white' : `${currentTheme.primary} ring-8 ring-white/10 text-white`) : (activeEventSlug ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-slate-900 shadow-[0_0_30px_rgba(250,204,21,0.3)]' : 'bg-white text-slate-900')}`}>{isPlaying ? <Volume2 size={60} className="animate-pulse" /> : <Play size={60} fill="currentColor" className="ml-2" />}</motion.button>
                      <div className="w-64 space-y-2 mt-4"><div className={`text-center text-[10px] font-black tracking-widest ${currentTheme.text}`}>{isPlaying ? 'ODTWARZANIE...' : `${ATTEMPT_TIMES[attempt]} SEKUND`}</div><div className="h-2 w-full bg-white/10 rounded-full overflow-hidden"><motion.div className="h-full bg-white shadow-[0_0_10px_#fff]" style={{ width: `${playProgress}%` }} /></div></div>
                      {partialPointsEarned > 0 && gameStatus === 'playing' && <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl px-4 py-2 text-yellow-400 text-sm font-bold mt-4">+{partialPointsEarned} PKT</div>}
                      <AnimatePresence>{closeHint.show && gameStatus === 'playing' && (<motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="bg-gradient-to-r from-orange-500/30 to-yellow-500/30 border border-orange-400/50 rounded-2xl px-6 py-3 text-center"><p className="text-orange-300 font-black text-lg">🔥 BLISKO!</p></motion.div>)}</AnimatePresence>
                      <div className="w-full space-y-3 mt-4">
                        {history.length > 0 && (<div className="max-h-40 overflow-y-auto space-y-1 pr-1" ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}><div className="space-y-1">{history.map((h, i) => {
                          // For Kraj category: show continent hint
                          const guessContinent = effectiveCategory === 'Kraj' && h.title !== 'POMINIĘTO' ? COUNTRY_CONTINENTS[h.title] : null;
                          const correctContinent = effectiveCategory === 'Kraj' && currentSong ? COUNTRY_CONTINENTS[currentSong.title.split(',')[0].trim()] : null;
                          const continentMatch = guessContinent && correctContinent && guessContinent === correctContinent;
                          return (<div key={i} className={`p-2 rounded-lg flex justify-between items-center text-xs border ${h.status === 'correct' ? 'bg-green-500/20 border-green-500 text-green-200' : h.status === 'partial' ? 'bg-yellow-500/20 border-yellow-500 text-yellow-200' : h.status === 'skipped' ? 'bg-white/5 border-white/10 text-white/40' : 'bg-red-500/20 border-red-500 text-red-200'}`}>
                            <div className="flex-1 min-w-0">
                              <span className="font-bold truncate block">{h.title}</span>
                              {guessContinent && h.status !== 'correct' && h.status !== 'skipped' && (
                                <span className={`text-[9px] ${continentMatch ? 'text-green-400' : 'text-white/30'}`}>{continentMatch ? '✅' : '🌍'} {guessContinent}</span>
                              )}
                            </div>
                            {h.status === 'correct' || h.status === 'partial' ? <CheckCircle size={14} className="shrink-0" /> : h.status === 'skipped' ? null : <XCircle size={14} className="shrink-0" />}
                          </div>);
                        })}</div></div>)}
                        <div className="flex gap-2">
                          <div className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${feedback.title ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 text-white/20 border border-white/5'}`}>{feedback.title && <CheckCircle size={12} />}{isTitleOnlyMode ? 'Nazwa' : 'Tytuł'}</div>
                          {!isTitleOnlyMode && <div className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${feedback.artist ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 text-white/20 border border-white/5'}`}>{feedback.artist && <CheckCircle size={12} />}Wykonawca</div>}
                        </div>
                        <div className="bg-white/5 border-2 rounded-2xl transition-all p-1 border-white/10 focus-within:border-white/30">
                          <div className="flex items-center px-4 py-3"><input type="text" placeholder={isTitleOnlyMode ? (effectiveCategory === 'Gry' ? "🎮 Wpisz nazwę gry..." : effectiveCategory === 'Kraj' ? "🌍 Wpisz nazwę kraju..." : effectiveCategory === 'Inne' ? "🌟 Wpisz odpowiedź..." : "🎬 Wpisz nazwę bajki/filmu...") : "🎵 Wpisz tytuł i wykonawcę..."} value={guessTitle} onChange={(e) => handleGuessInput(e.target.value)} onKeyDown={(e) => { handleKeyDown(e); if (e.key === 'Enter') setShowSuggestions(false); }} onFocus={() => { if (effectiveCategory === 'Kraj') { handleGuessInput(guessTitle); } else if (spotifySuggestions.length > 0 || movieSuggestions.length > 0 || gameSuggestions.length > 0 || countrySuggestions.length > 0) setShowSuggestions(true); }} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} disabled={feedback.title && feedback.artist} maxLength={MAX_GUESS_LENGTH} className="w-full bg-transparent outline-none text-lg font-bold text-white placeholder:text-white/20" /></div>
                          {showSuggestions && spotifySuggestions.length > 0 && gameStatus === 'playing' && effectiveCategory !== 'Bajki' && effectiveCategory !== 'Gry' && effectiveCategory !== 'Kraj' && (
                            <div className="mx-2 mb-1 bg-slate-800 border border-white/10 rounded-xl overflow-hidden max-h-56 overflow-y-auto">{spotifySuggestions.map((s, i) => (<button key={i} onClick={() => selectSuggestion(s)} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/10 transition-all text-left border-b border-white/5 last:border-0"><div className="min-w-0"><p className="text-white text-xs font-bold truncate">{s.title}</p><p className="text-white/40 text-[10px] truncate">{s.artist}</p></div></button>))}</div>
                          )}
                          {showSuggestions && movieSuggestions.length > 0 && gameStatus === 'playing' && effectiveCategory === 'Bajki' && (
                            <div className="mx-2 mb-1 bg-slate-800 border border-white/10 rounded-xl overflow-hidden max-h-56 overflow-y-auto">{movieSuggestions.map((s, i) => (<button key={i} onClick={() => selectMovieSuggestion(s)} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/10 transition-all text-left border-b border-white/5 last:border-0"><div className="min-w-0"><p className="text-white text-xs font-bold truncate">{s.title}</p></div></button>))}</div>
                          )}
                          {showSuggestions && gameSuggestions.length > 0 && gameStatus === 'playing' && effectiveCategory === 'Gry' && (
                            <div className="mx-2 mb-1 bg-slate-800 border border-white/10 rounded-xl overflow-hidden max-h-56 overflow-y-auto">{gameSuggestions.map((s, i) => (<button key={i} onClick={() => selectGameSuggestion(s)} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/10 transition-all text-left border-b border-white/5 last:border-0"><div className="min-w-0 flex-1"><p className="text-white text-xs font-bold truncate">{s.title}</p></div></button>))}</div>
                          )}
                          {showSuggestions && countrySuggestions.length > 0 && gameStatus === 'playing' && effectiveCategory === 'Kraj' && (
                            <div className="mx-2 mb-1 bg-slate-800 border border-white/10 rounded-xl overflow-hidden max-h-56 overflow-y-auto"><div className="px-3 py-2 border-b border-white/5 text-[10px] uppercase tracking-widest font-bold text-white/30">🌍 Kraje</div>{countrySuggestions.map((c, i) => (<button key={i} onClick={() => { setGuessTitle(c); setShowSuggestions(false); setCountrySuggestions([]); }} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/10 transition-all text-left border-b border-white/5 last:border-0"><div className="min-w-0"><p className="text-white text-xs font-bold truncate">🏳️ {c}</p></div></button>))}</div>
                          )}
                        </div>
                        {gameStatus === 'playing' ? (<div className="flex gap-3"><button onClick={handleSkip} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-5 rounded-2xl font-black text-xl transition-all border border-white/10">SKIP</button><button onClick={handleGuess} disabled={!guessTitle || (feedback.title && feedback.artist)} className={`flex-[2] py-5 rounded-2xl font-black text-xl shadow-xl transition-all ${currentTheme.primary} ${currentTheme.hover} text-white disabled:opacity-30`}>SPRAWDŹ ({attempt + 1}/6)</button></div>) : (<button onClick={() => setView('result')} className="w-full py-5 rounded-2xl font-black text-xl shadow-xl transition-all bg-white text-slate-950 hover:scale-105 active:scale-95">ZOBACZ WYNIK</button>)}
                      </div>
                    </div>
                    </div>
                  );})()}

                  {view === 'result' && currentSong && (() => {
                    const nowR = new Date(); const offR = nowR.getTimezoneOffset();
                    const localTodayR = new Date(nowR.getTime() - (offR * 60 * 1000)).toISOString().split('T')[0];
                    const modeSongsR = songs.filter(s => s.category === currentCategory && s.mode === gameMode);
                    const sortedDatesR = Array.from(new Set(modeSongsR.map(s => s.date || localTodayR))).sort((a, b) => a.localeCompare(b));
                    // Find current song index - try exact date match first, fallback to finding by song id
                    let currentIndexR = currentSong?.date ? sortedDatesR.indexOf(currentSong.date) : -1;
                    if (currentIndexR === -1) {
                      // Try to find the song's date another way
                      const matchingSong = modeSongsR.find(s => s.id === currentSong?.id);
                      if (matchingSong?.date) currentIndexR = sortedDatesR.indexOf(matchingSong.date);
                    }
                    const prevDateR = currentIndexR > 0 ? sortedDatesR[currentIndexR - 1] : undefined;
                    const nextDateR = currentIndexR >= 0 && currentIndexR < sortedDatesR.length - 1 ? sortedDatesR[currentIndexR + 1] : undefined;
                    const isNextAvailR = nextDateR && nextDateR <= localTodayR;
                    // Event navigation
                    const rEvSongs = activeEventSongsRef.current;
                    const rEvIdx = activeEventSlug ? activeEventNum - 1 : -1;
                    const rEvSorted = activeEventSlug ? [...rEvSongs].sort((a: any, b: any) => (a.date || a.id.toString()).localeCompare(b.date || b.id.toString())) : [];
                    const rEvPrev = rEvIdx > 0 ? rEvSorted[rEvIdx - 1] : null;
                    const rEvNext = rEvIdx >= 0 && rEvIdx < rEvSorted.length - 1 ? rEvSorted[rEvIdx + 1] : null;
                    const rEvNextAvail = rEvNext && (!rEvNext.date || rEvNext.date <= localTodayR);
                    const rHasPrev = activeEventSlug ? !!rEvPrev : !!prevDateR;
                    const rHasNext = activeEventSlug ? !!rEvNextAvail : !!isNextAvailR;
                    const challengeNumR = activeEventSlug ? activeEventNum : (currentIndexR !== -1 ? currentIndexR + 1 : '?');
                    return (
                    <div className="flex items-center justify-center w-full max-w-7xl px-4 relative">
                      {/* Side nav buttons in result */}
                      <button disabled={!rHasPrev || navCooldown} onClick={() => { if (activeEventSlug && rEvPrev) startEventGame(activeEventSlug, rEvPrev, rEvIdx); else if (prevDateR) startDailyGame(prevDateR); }} className={`fixed left-2 md:left-6 lg:left-[calc(50%-28rem)] top-[45%] z-30 px-3 py-4 md:px-4 md:py-5 rounded-2xl bg-white/[0.07] hover:bg-white/15 backdrop-blur-md border border-white/10 flex flex-col items-center justify-center gap-1 shadow-lg transition-all ${!rHasPrev || navCooldown ? 'opacity-0 pointer-events-none' : ''}`}>
                        <ChevronLeft size={22} className="text-white/50" />
                        <span className="text-[8px] font-black text-white/40 uppercase tracking-wider">Poprzednie</span>
                      </button>
                      <button disabled={!rHasNext || navCooldown} onClick={() => { if (activeEventSlug && rEvNext) startEventGame(activeEventSlug, rEvNext, rEvIdx + 2); else if (nextDateR && isNextAvailR) startDailyGame(nextDateR); }} className={`fixed right-2 md:right-6 lg:right-[calc(50%-28rem)] top-[45%] z-30 px-3 py-4 md:px-4 md:py-5 rounded-2xl bg-white/[0.07] hover:bg-white/15 backdrop-blur-md border border-white/10 flex flex-col items-center justify-center gap-1 shadow-lg transition-all ${!rHasNext || navCooldown ? 'opacity-0 pointer-events-none' : ''}`}>
                        <ChevronRight size={22} className="text-white/50" />
                        <span className="text-[8px] font-black text-white/40 uppercase tracking-wider">Następne</span>
                      </button>
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white/10 backdrop-blur-3xl p-6 md:p-8 rounded-[2.5rem] border border-white/20 text-center shadow-2xl max-w-md lg:max-w-lg xl:max-w-xl w-full mx-auto relative z-10 my-4">
                      {gameStatus === 'won' ? (
                        <><CheckCircle size={60} className="text-green-500 mx-auto mb-4" /><h2 className="text-2xl md:text-3xl font-black text-white mb-1 leading-none uppercase italic">WYZWANIE #{challengeNumR}</h2><p className={`${currentTheme.text} font-bold text-sm uppercase tracking-widest`}>Zgadłeś w {attempt + 1} próbie</p><p className="text-yellow-500 font-black text-lg animate-bounce mt-1">+{(attempt < 6 ? [100, 80, 60, 40, 20, 10][attempt] : 0) + partialPointsEarned} PKT!</p></>
                      ) : (
                        <><XCircle size={60} className="text-red-500 mx-auto mb-4" /><h2 className="text-2xl md:text-3xl font-black text-white mb-1 leading-none uppercase italic">WYZWANIE #{challengeNumR}</h2><p className="text-white/40 mb-2 font-bold text-sm uppercase tracking-widest">Wszystkie próby wykorzystane</p>{partialPointsEarned > 0 && <p className="text-yellow-500 font-bold text-lg mb-4">+{partialPointsEarned} PKT</p>}</>
                      )}
                      <div className="bg-white/5 p-4 rounded-3xl mb-6 border border-white/10"><p className="text-[10px] uppercase tracking-widest text-white/40 mb-4 font-bold text-center">Rozkład odpowiedzi</p><div className="space-y-2">{globalStats.map((count, i) => { const label = i === 6 ? 'X' : (i+1).toString(); const maxVal = Math.max(...globalStats, 1); const isCurrent = i === attempt && gameStatus === 'won'; const isCurrentFail = i === 6 && gameStatus === 'lost'; return (<div key={i} className="flex items-center gap-3"><span className={`text-[10px] font-bold w-3 ${(isCurrent || isCurrentFail) ? currentTheme.text : 'text-white/40'}`}>{label}</span><div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden"><div className={`h-full ${(isCurrent || isCurrentFail) ? currentTheme.primary : 'bg-white/20'} rounded-full`} style={{ width: `${(count / maxVal) * 100}%` }} /></div><span className="text-[10px] text-white/40 w-4">{count}</span></div>); })}</div></div>
                      <div className="bg-white/5 p-5 rounded-3xl mb-8 border border-white/10">
                        <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2 font-black">Odpowiedź:</p>
                        <p className="text-lg md:text-xl font-black text-white leading-tight mb-1">{currentSong.title}</p>
                        <p className={`${currentTheme.text} text-sm font-bold uppercase tracking-tighter`}>{currentSong.artist}</p>
                        {currentSong.youtubeUrl ? (
                          <a href={currentSong.youtubeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-xl hover:bg-red-500/30 transition-all group">
                            <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24" className="text-red-500"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                            <span className="text-red-400 text-xs font-bold group-hover:text-red-300">Posłuchaj na YouTube</span>
                          </a>
                        ) : (
                          <div className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-white/5 border border-white/5 rounded-xl opacity-30 cursor-not-allowed">
                            <span className="text-white/20 text-xs font-bold">YouTube niedostępny</span>
                          </div>
                        )}
                      </div>
                      {/* Audio player - direct audio */}
                      {currentSong.audioUrl && currentSong.audioUrl.length > 5 && (
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-3 mb-4">
                          <div className="flex items-center gap-3">
                            <button onClick={toggleResultPlayback} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 ${resultPlaying ? `${currentTheme.primary} text-white` : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                              {resultPlaying ? <span>⏸</span> : <Play size={16} fill="currentColor" className="ml-0.5" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <input type="range" min={0} max={resultDuration || 1} step={0.1} value={resultCurrentTime} onChange={(e) => seekResultAudio(parseFloat(e.target.value))} className="w-full h-1.5 accent-white cursor-pointer" />
                              <div className="flex justify-between mt-1"><span className="text-[9px] text-white/30 font-mono">{Math.floor(resultCurrentTime / 60)}:{String(Math.floor(resultCurrentTime % 60)).padStart(2, '0')}</span><span className="text-[9px] text-white/30 font-mono">{Math.floor(resultDuration / 60)}:{String(Math.floor(resultDuration % 60)).padStart(2, '0')}</span></div>
                            </div>
                          </div>
                        </div>
                      )}
                      {/* YouTube embed - show for ALL songs with youtubeUrl */}
                      {currentSong.youtubeUrl && (() => {
                        const vidMatch = currentSong.youtubeUrl!.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
                        const vidId = vidMatch ? vidMatch[1] : null;
                        if (!vidId) return null;
                        return (
                          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden mb-4">
                            <iframe width="100%" height="200" src={`https://www.youtube.com/embed/${vidId}?start=${currentSong.previewStart || 0}`} allow="autoplay; encrypted-media" allowFullScreen className="w-full" title="YouTube player" />
                          </div>
                        );
                      })()}
                      <div className="space-y-3">
                        <button onClick={goToCalendar} className="w-full bg-white text-slate-950 py-4 rounded-2xl font-black text-base hover:scale-[1.02] active:scale-95 transition-all shadow-xl uppercase">Wybierz wyzwanie</button>
                        <button onClick={exitToMenu} className="w-full bg-white/10 border border-white/10 text-white py-3 rounded-2xl font-bold text-xs hover:bg-white/20 transition-all uppercase tracking-widest">Strona główna</button>
                      </div>
                    </motion.div>
                    </div>
                  );})()}

                  {(view === 'mode_select' || view === 'category_select') && (() => { setView('menu'); return null; })()}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        <footer className="mt-12 py-8 flex flex-col items-center gap-6">
          <div className="flex gap-6">
            <a href="https://www.youtube.com/@Jogiss" target="_blank" rel="noopener noreferrer" className="hover:scale-125 transition-all text-white/40 hover:text-red-500"><svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg></a>
            <a href="https://www.instagram.com/jxgis_" target="_blank" rel="noopener noreferrer" className="hover:scale-125 transition-all text-white/40 hover:text-pink-500"><svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg></a>
            <a href="https://tiktok.com/@jogisek" target="_blank" rel="noopener noreferrer" className="hover:scale-125 transition-all text-white/40 hover:text-cyan-400"><svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.9-.32-1.98-.23-2.8.2-1.2.64-1.81 1.92-1.85 3.22-.03.81.3 1.63.84 2.22.69.73 1.76 1.03 2.72.91 1.05-.1 1.99-.73 2.47-1.66.47-.93.46-2.04.46-3.07V.02z"/></svg></a>
            <a href="https://discord.gg/7djmtfA" target="_blank" rel="noopener noreferrer" className="hover:scale-125 transition-all text-white/40 hover:text-indigo-400"><svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.373-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg></a>
          </div>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[9px] font-bold uppercase tracking-widest text-white/20">
            <button onClick={() => setActiveModal('tos')} className="hover:text-white transition-colors">Regulamin</button><span>•</span>
            <button onClick={() => setActiveModal('privacy')} className="hover:text-white transition-colors">Polityka Prywatności</button><span>•</span>
            <button onClick={() => setActiveModal('contact')} className="hover:text-white transition-colors">Kontakt</button>
          </div>
          <p className="text-[10px] text-white/10 font-black uppercase tracking-[0.2em]">Created by Jogis</p>
        </footer>
      </main>
    </div>
  );
};

export default GameAppWrapper;
