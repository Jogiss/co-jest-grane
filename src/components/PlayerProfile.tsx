'use client';

import React, { useState, useMemo } from 'react';
import { X, Trophy, Target, Flame, BarChart3, Award, Music2, Piano, Drum, RotateCcw, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import type { GameMode, Category } from '../constants/songs';

interface CompletedDay { status: 'won' | 'lost' | 'playing'; attempt: number; history: any[]; feedback: any; partialPoints?: number; }

interface PlayerProfileProps {
  nickname: string; stats: { total: number; wins: number }; completedDays: Record<string, CompletedDay>;
  dailyStreak: number; theme: { primary: string; text: string; border: string; gradient: string; };
  playerRank: number | null; playerPoints: number; pinnedAchievements?: string[];
  onPinAchievement?: (achievementIds: string[]) => void; onClose: () => void;
}

type ProfileTab = 'overview' | 'modes' | 'categories' | 'achievements';

const ACHIEVEMENTS = [
  { id: 'first_win', name: 'Pierwsza Wygrana', desc: 'Wygraj swoją pierwszą grę', icon: '🎉', check: (s: any) => s.wins >= 1 },
  { id: 'wins_10', name: 'Dziesięć!', desc: 'Wygraj 10 gier', icon: '🔟', check: (s: any) => s.wins >= 10 },
  { id: 'wins_25', name: 'Ćwierć setki', desc: 'Wygraj 25 gier', icon: '💪', check: (s: any) => s.wins >= 25 },
  { id: 'wins_50', name: 'Pół setki', desc: 'Wygraj 50 gier', icon: '🏆', check: (s: any) => s.wins >= 50 },
  { id: 'wins_100', name: 'Setka!', desc: 'Wygraj 100 gier', icon: '💯', check: (s: any) => s.wins >= 100 },
  { id: 'perfect', name: 'Bezbłędny', desc: 'Zgadnij w 1 próbie', icon: '⚡', check: (s: any) => s.firstTryWins >= 1 },
  { id: 'perfect_5', name: 'Mistrz intuicji', desc: 'Zgadnij w 1 próbie 5 razy', icon: '🧠', check: (s: any) => s.firstTryWins >= 5 },
  { id: 'streak_3', name: 'Dobra passa', desc: 'Wygraj 3 gry z rzędu', icon: '🔥', check: (s: any) => s.bestStreak >= 3 },
  { id: 'streak_7', name: 'Nie do zdarcia', desc: 'Wygraj 7 gier z rzędu', icon: '💎', check: (s: any) => s.bestStreak >= 7 },
  { id: 'streak_15', name: 'Legenda', desc: 'Wygraj 15 gier z rzędu', icon: '👑', check: (s: any) => s.bestStreak >= 15 },
  { id: 'daily_3', name: 'Stały bywalec', desc: 'Seria 3 dni', icon: '📅', check: (s: any) => s.dailyStreak >= 3 },
  { id: 'daily_7', name: 'Tygodniowy wojownik', desc: 'Seria 7 dni', icon: '🗓️', check: (s: any) => s.dailyStreak >= 7 },
  { id: 'daily_30', name: 'Miesiąc non-stop', desc: 'Seria 30 dni', icon: '🏅', check: (s: any) => s.dailyStreak >= 30 },
  { id: 'games_10', name: 'Rozgrzewka', desc: 'Zagraj 10 gier', icon: '🎮', check: (s: any) => s.total >= 10 },
  { id: 'games_50', name: 'Weteran', desc: 'Zagraj 50 gier', icon: '🎖️', check: (s: any) => s.total >= 50 },
  { id: 'all_modes', name: 'Wszechstronny', desc: 'Wygraj w każdym trybie', icon: '🌟', check: (s: any) => s.modesWon >= 4 },
  { id: 'all_cats', name: 'Eksplorator', desc: 'Wygraj w każdej kategorii', icon: '🗺️', check: (s: any) => s.catsWon >= 4 },
  { id: 'klasyczny_15', name: 'Klasyk', desc: 'Wygraj 15 razy w trybie Klasycznym', icon: '🎵', check: (s: any) => s.modeWins?.klasyczny >= 15 },
  { id: 'klasyczny_50', name: 'Meloman', desc: 'Wygraj 50 razy w trybie Klasycznym', icon: '🎼', check: (s: any) => s.modeWins?.klasyczny >= 50 },
  { id: 'piano_15', name: 'Pianista', desc: 'Wygraj 15 razy w trybie Piano', icon: '🎹', check: (s: any) => s.modeWins?.piano >= 15 },
  { id: 'piano_50', name: 'Wirtuoz', desc: 'Wygraj 50 razy w trybie Piano', icon: '🎶', check: (s: any) => s.modeWins?.piano >= 50 },
  { id: 'beat_15', name: 'Beatboxer', desc: 'Wygraj 15 razy w trybie Tylko Bit', icon: '🥁', check: (s: any) => s.modeWins?.beat >= 15 },
  { id: 'beat_50', name: 'Król Rytmu', desc: 'Wygraj 50 razy w trybie Tylko Bit', icon: '💥', check: (s: any) => s.modeWins?.beat >= 50 },
  { id: 'reverse_15', name: 'Odwrócony', desc: 'Wygraj 15 razy w trybie Od Tyłu', icon: '🔄', check: (s: any) => s.modeWins?.reverse >= 15 },
  { id: 'reverse_50', name: 'Mistrz Rewersu', desc: 'Wygraj 50 razy w trybie Od Tyłu', icon: '⏪', check: (s: any) => s.modeWins?.reverse >= 50 },
  { id: 'bajki_25', name: 'Bajkowy Świat', desc: 'Wygraj 25 gier w kategorii Bajki', icon: '🏰', check: (s: any) => s.catWins?.Bajki >= 25 },
  { id: 'bajki_50', name: 'Mistrz Bajek', desc: 'Wygraj 50 gier w kategorii Bajki', icon: '👸', check: (s: any) => s.catWins?.Bajki >= 50 },
  { id: 'bajki_100', name: 'Bajkowa Legenda', desc: 'Wygraj 100 gier w kategorii Bajki', icon: '🧙', check: (s: any) => s.catWins?.Bajki >= 100 },
  { id: 'gry_25', name: 'Gamer', desc: 'Wygraj 25 gier w kategorii Gry', icon: '🎮', check: (s: any) => s.catWins?.Gry >= 25 },
  { id: 'gry_50', name: 'Pro Gamer', desc: 'Wygraj 50 gier w kategorii Gry', icon: '🕹️', check: (s: any) => s.catWins?.Gry >= 50 },
  { id: 'gry_100', name: 'Legenda Gamingu', desc: 'Wygraj 100 gier w kategorii Gry', icon: '🏆', check: (s: any) => s.catWins?.Gry >= 100 },
  { id: 'polskie_50', name: 'Patriota', desc: 'Wygraj 50 gier w kategorii Polskie', icon: '🇵🇱', check: (s: any) => s.catWins?.Polskie >= 50 },
  { id: 'polskie_100', name: 'Polski Ekspert', desc: 'Wygraj 100 gier w kategorii Polskie', icon: '🦅', check: (s: any) => s.catWins?.Polskie >= 100 },
  { id: 'zagraniczne_50', name: 'Globtrotter', desc: 'Wygraj 50 gier w kategorii Zagraniczne', icon: '🌍', check: (s: any) => s.catWins?.Zagraniczne >= 50 },
  { id: 'zagraniczne_100', name: 'Światowy Ekspert', desc: 'Wygraj 100 gier w kategorii Zagraniczne', icon: '🗺️', check: (s: any) => s.catWins?.Zagraniczne >= 100 },
  { id: 'wins_200', name: 'Dwusetka!', desc: 'Wygraj 200 gier', icon: '🔥', check: (s: any) => s.wins >= 200 },
  { id: 'wins_500', name: 'Pół tysiąca!', desc: 'Wygraj 500 gier', icon: '💎', check: (s: any) => s.wins >= 500 },
  { id: 'games_100', name: 'Setka gier', desc: 'Zagraj 100 gier', icon: '🎲', check: (s: any) => s.total >= 100 },
  { id: 'games_250', name: 'Nałogowiec', desc: 'Zagraj 250 gier', icon: '🤯', check: (s: any) => s.total >= 250 },
  { id: 'games_500', name: 'Pół tysiąca gier!', desc: 'Zagraj 500 gier', icon: '🏅', check: (s: any) => s.total >= 500 },
  { id: 'streak_30', name: 'Miesięczna passa', desc: 'Wygraj 30 gier z rzędu', icon: '💫', check: (s: any) => s.bestStreak >= 30 },
  { id: 'sigma', name: 'SIGMA', desc: 'Wygraj 1000 gier. Szacunek.', icon: '🐺', check: (s: any) => s.wins >= 1000 },
  { id: 'top100', name: 'Top 100', desc: 'Wejdź do Top 100 rankingu', icon: '📊', check: (s: any) => s.rank !== null && s.rank <= 100 },
  { id: 'top10', name: 'Top 10', desc: 'Wejdź do Top 10 rankingu', icon: '🏅', check: (s: any) => s.rank !== null && s.rank <= 10 },
  { id: 'top3', name: 'Top 3', desc: 'Wejdź na podium rankingu', icon: '🥉', check: (s: any) => s.rank !== null && s.rank <= 3 },
  { id: 'top2', name: 'Top 2', desc: 'Zajmij 2. miejsce w rankingu', icon: '🥈', check: (s: any) => s.rank !== null && s.rank <= 2 },
  { id: 'top1', name: 'Numer 1!', desc: 'Zajmij 1. miejsce w rankingu', icon: '🥇', check: (s: any) => s.rank !== null && s.rank <= 1 },
  { id: 'first_event', name: 'Stwórz event', desc: 'Stwórz swój pierwszy event', icon: '✨', check: (s: any) => s.eventsCreated >= 1 },
  { id: 'events_done_1', name: 'Eventowicz', desc: 'Ukończ 1 event', icon: '🎪', check: (s: any) => s.eventsCompleted >= 1 },
  { id: 'events_done_3', name: 'Fan eventów', desc: 'Ukończ 3 eventy', icon: '🎭', check: (s: any) => s.eventsCompleted >= 3 },
  { id: 'events_done_10', name: 'Eventowy weteran', desc: 'Ukończ 10 eventów', icon: '🎡', check: (s: any) => s.eventsCompleted >= 10 },
  { id: 'events_done_20', name: 'Eventomaniak', desc: 'Ukończ 20 eventów', icon: '🎠', check: (s: any) => s.eventsCompleted >= 20 },
  { id: 'events_done_50', name: 'Mistrz eventów', desc: 'Ukończ 50 eventów', icon: '🏟️', check: (s: any) => s.eventsCompleted >= 50 },
  { id: 'events_done_100', name: 'Legenda eventów', desc: 'Ukończ 100 eventów', icon: '🌟', check: (s: any) => s.eventsCompleted >= 100 },
];

const MODE_LABELS: Record<string, { label: string; icon: any }> = {
  'klasyczny': { label: 'Klasyczny', icon: Music2 }, 'piano': { label: 'Piano', icon: Piano },
  'beat': { label: 'Tylko Bit', icon: Drum }, 'reverse': { label: 'Od Tyłu', icon: RotateCcw },
};

const PlayerProfile: React.FC<PlayerProfileProps> = ({ nickname, stats, completedDays, dailyStreak, theme, playerRank, playerPoints, pinnedAchievements = [], onPinAchievement, onClose }) => {
  const [tab, setTab] = useState<ProfileTab>('overview');
  const [pinMode, setPinMode] = useState(false);
  const [tempPinned, setTempPinned] = useState<string[]>(pinnedAchievements);

  const computed = useMemo(() => {
    const entries = Object.entries(completedDays);
    const finished = entries.filter(([, v]) => v.status !== 'playing');
    const won = finished.filter(([, v]) => v.status === 'won');
    const lost = finished.filter(([, v]) => v.status === 'lost');
    const winRate = finished.length > 0 ? Math.round((won.length / finished.length) * 100) : 0;
    const avgAttempt = won.length > 0 ? (won.reduce((sum, [, v]) => sum + v.attempt, 0) / won.length).toFixed(1) : '-';
    const firstTryWins = won.filter(([, v]) => v.attempt === 1).length;
    const attemptDist = [0, 0, 0, 0, 0, 0, 0];
    won.forEach(([, v]) => { if (v.attempt >= 1 && v.attempt <= 6) attemptDist[v.attempt - 1]++; });
    lost.forEach(() => attemptDist[6]++);
    let bestStreak = 0; let currentStreak = 0;
    const sorted = [...finished].sort(([a], [b]) => a.localeCompare(b));
    sorted.forEach(([, v]) => { if (v.status === 'won') { currentStreak++; bestStreak = Math.max(bestStreak, currentStreak); } else { currentStreak = 0; } });
    const modeStats: Record<string, { total: number; wins: number; avgAttempt: string }> = {};
    (['klasyczny', 'piano', 'beat', 'reverse'] as GameMode[]).forEach(mode => {
      const modeEntries = finished.filter(([key]) => key.includes(`-${mode}-`));
      const modeWins = modeEntries.filter(([, v]) => v.status === 'won');
      modeStats[mode] = { total: modeEntries.length, wins: modeWins.length, avgAttempt: modeWins.length > 0 ? (modeWins.reduce((s, [, v]) => s + v.attempt, 0) / modeWins.length).toFixed(1) : '-' };
    });
    const catStats: Record<string, { total: number; wins: number; avgAttempt: string }> = {};
    (['Polskie', 'Zagraniczne', 'Bajki', 'Gry'] as Category[]).forEach(cat => {
      const catEntries = finished.filter(([key]) => key.endsWith(`-${cat}`));
      const catWins = catEntries.filter(([, v]) => v.status === 'won');
      catStats[cat] = { total: catEntries.length, wins: catWins.length, avgAttempt: catWins.length > 0 ? (catWins.reduce((s, [, v]) => s + v.attempt, 0) / catWins.length).toFixed(1) : '-' };
    });
    const modesWon = Object.values(modeStats).filter(m => m.wins > 0).length;
    const catsWon = (['Polskie', 'Zagraniczne', 'Bajki', 'Gry'] as Category[]).filter(cat => finished.some(([key, v]) => key.endsWith(`-${cat}`) && v.status === 'won')).length;
    const modeWins: Record<string, number> = {};
    (['klasyczny', 'piano', 'beat', 'reverse'] as GameMode[]).forEach(mode => { modeWins[mode] = modeStats[mode]?.wins || 0; });
    const catWins: Record<string, number> = {};
    (['Polskie', 'Zagraniczne', 'Bajki', 'Gry'] as Category[]).forEach(cat => { catWins[cat] = catStats[cat]?.wins || 0; });
    let eventsCreated = 0;
    try { eventsCreated = parseInt(localStorage.getItem('mm_events_created') || '0'); } catch {}
    const eventKeys = Object.keys(completedDays).filter(k => k.startsWith('event-'));
    const eventGroups: Record<string, string[]> = {};
    eventKeys.forEach(k => { const wp = k.replace('event-', ''); const ld = wp.lastIndexOf('-'); if (ld === -1) return; const slug = wp.substring(0, ld); if (!eventGroups[slug]) eventGroups[slug] = []; eventGroups[slug].push(k); });
    let eventsCompleted = 0;
    Object.values(eventGroups).forEach(keys => { if (keys.length < 5) return; const allDone = keys.every(k => { const s = completedDays[k]; return s && (s.status === 'won' || s.status === 'lost'); }); if (allDone) eventsCompleted++; });
    return { winRate, avgAttempt, firstTryWins, attemptDist, bestStreak, modeStats, catStats, modesWon, catsWon, modeWins, catWins, total: stats.total, wins: stats.wins, dailyStreak, rank: playerRank, eventsCreated, eventsCompleted };
  }, [completedDays, stats, dailyStreak, playerRank]);

  const unlockedCount = ACHIEVEMENTS.filter(a => a.check(computed)).length;
  const tabs: { id: ProfileTab; label: string; icon: any }[] = [
    { id: 'overview', label: 'Ogólne', icon: BarChart3 }, { id: 'modes', label: 'Tryby', icon: Music2 },
    { id: 'categories', label: 'Kategorie', icon: Target }, { id: 'achievements', label: 'Osiągnięcia', icon: Award },
  ];

  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-white/10 w-full max-w-lg rounded-[2rem] shadow-2xl relative max-h-[90vh] overflow-hidden flex flex-col">
        <div className={`bg-gradient-to-br ${theme.gradient} to-slate-900 p-6 pb-4 relative`}>
          <button onClick={onClose} className="absolute right-5 top-5 text-white/40 hover:text-white"><X size={24} /></button>
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-16 h-16 rounded-full ${theme.primary} flex items-center justify-center text-white text-2xl font-black shadow-lg`}>{nickname.charAt(0).toUpperCase()}</div>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">{nickname}</h2>
              <div className="flex items-center gap-3 mt-1">
                {playerRank && <span className="text-yellow-500 text-sm font-bold flex items-center gap-1"><Trophy size={14} /> #{playerRank}</span>}
                <span className={`${theme.text} text-sm font-bold`}>{playerPoints.toLocaleString()} pkt</span>
              </div>
              {pinnedAchievements.length > 0 && <div className="flex items-center gap-1 mt-1.5">{pinnedAchievements.slice(0, 3).map(id => { const a = ACHIEVEMENTS.find(x => x.id === id); return a ? <span key={id} title={a.name} className="text-lg bg-white/10 rounded-lg px-1.5 py-0.5">{a.icon}</span> : null; })}</div>}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-black/30 rounded-xl p-2 text-center"><div className="text-lg font-black text-white">{stats.total}</div><div className="text-[8px] text-white/40 uppercase font-bold">Gier</div></div>
            <div className="bg-black/30 rounded-xl p-2 text-center"><div className="text-lg font-black text-green-400">{stats.wins}</div><div className="text-[8px] text-white/40 uppercase font-bold">Wygranych</div></div>
            <div className="bg-black/30 rounded-xl p-2 text-center"><div className="text-lg font-black text-yellow-400">{computed.winRate}%</div><div className="text-[8px] text-white/40 uppercase font-bold">Skuteczność</div></div>
            <div className="bg-black/30 rounded-xl p-2 text-center"><div className="text-lg font-black text-orange-400 flex items-center justify-center gap-1"><Flame size={14}/>{dailyStreak}</div><div className="text-[8px] text-white/40 uppercase font-bold">Seria</div></div>
          </div>
        </div>
        <div className="flex border-b border-white/10 px-2">{tabs.map(t => (<button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 py-3 text-[10px] md:text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all border-b-2 ${tab === t.id ? `${theme.text} border-current` : 'text-white/30 border-transparent hover:text-white/50'}`}><t.icon size={14} />{t.label}</button>))}</div>
        <div className="overflow-y-auto p-5 flex-1">
          {tab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center"><div className="text-2xl font-black text-white">{computed.avgAttempt}</div><div className="text-[9px] text-white/40 uppercase font-bold">Średnia próba</div></div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center"><div className="text-2xl font-black text-white flex items-center justify-center gap-1">{computed.bestStreak} <Flame size={16} className="text-orange-500" /></div><div className="text-[9px] text-white/40 uppercase font-bold">Najlepsza seria</div></div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center"><div className="text-2xl font-black text-yellow-400">{computed.firstTryWins}</div><div className="text-[9px] text-white/40 uppercase font-bold">Z 1 próby</div></div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center"><div className="text-2xl font-black text-white">{unlockedCount}/{ACHIEVEMENTS.length}</div><div className="text-[9px] text-white/40 uppercase font-bold">Osiągnięcia</div></div>
              </div>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5"><p className="text-[10px] uppercase tracking-widest text-white/40 mb-3 font-bold text-center">Rozkład prób</p><div className="space-y-1.5">{computed.attemptDist.map((count, i) => { const maxVal = Math.max(...computed.attemptDist, 1); const label = i === 6 ? 'X' : (i + 1).toString(); return (<div key={i} className="flex items-center gap-2"><span className="text-[10px] font-bold text-white/40 w-3">{label}</span><div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden"><div className={`h-full ${i === 6 ? 'bg-red-500' : theme.primary} rounded-full`} style={{ width: `${(count / maxVal) * 100}%` }} /></div><span className="text-[10px] text-white/40 w-5 text-right">{count}</span></div>); })}</div></div>
            </div>
          )}
          {tab === 'modes' && (<div className="space-y-3">{Object.entries(computed.modeStats).map(([mode, data]) => { const modeInfo = MODE_LABELS[mode]; const Icon = modeInfo?.icon || Music2; const winRate = data.total > 0 ? Math.round((data.wins / data.total) * 100) : 0; return (<div key={mode} className="bg-white/5 p-4 rounded-2xl border border-white/5"><div className="flex items-center justify-between mb-3"><div className="flex items-center gap-3"><Icon size={20} className={theme.text} /><span className="text-white font-bold">{modeInfo?.label || mode}</span></div>{data.total > 0 && <span className={`text-xs font-bold ${winRate >= 60 ? 'text-green-400' : winRate >= 30 ? 'text-yellow-400' : 'text-red-400'}`}>{winRate}%</span>}</div>{data.total > 0 ? (<div className="grid grid-cols-3 gap-2"><div className="text-center"><div className="text-sm font-black text-white">{data.total}</div><div className="text-[8px] text-white/30 uppercase">Gier</div></div><div className="text-center"><div className="text-sm font-black text-green-400">{data.wins}</div><div className="text-[8px] text-white/30 uppercase">Wygranych</div></div><div className="text-center"><div className="text-sm font-black text-white">{data.avgAttempt}</div><div className="text-[8px] text-white/30 uppercase">Śr. próba</div></div></div>) : (<p className="text-white/20 text-xs text-center italic">Brak gier</p>)}</div>); })}</div>)}
          {tab === 'categories' && (<div className="space-y-3">{Object.entries(computed.catStats).map(([cat, data]) => { const winRate = data.total > 0 ? Math.round((data.wins / data.total) * 100) : 0; return (<div key={cat} className="bg-white/5 p-4 rounded-2xl border border-white/5"><div className="flex items-center justify-between mb-3"><span className="text-white font-bold">{cat}</span>{data.total > 0 && <span className={`text-xs font-bold ${winRate >= 60 ? 'text-green-400' : winRate >= 30 ? 'text-yellow-400' : 'text-red-400'}`}>{winRate}%</span>}</div>{data.total > 0 ? (<div className="grid grid-cols-3 gap-2"><div className="text-center"><div className="text-sm font-black text-white">{data.total}</div><div className="text-[8px] text-white/30 uppercase">Gier</div></div><div className="text-center"><div className="text-sm font-black text-green-400">{data.wins}</div><div className="text-[8px] text-white/30 uppercase">Wygranych</div></div><div className="text-center"><div className="text-sm font-black text-white">{data.avgAttempt}</div><div className="text-[8px] text-white/30 uppercase">Śr. próba</div></div></div>) : (<p className="text-white/20 text-xs text-center italic">Brak gier</p>)}</div>); })}</div>)}
          {tab === 'achievements' && (<div className="space-y-2"><p className="text-center text-white/40 text-xs mb-1">Odblokowano <span className={`font-bold ${theme.text}`}>{unlockedCount}</span> z {ACHIEVEMENTS.length}</p>{onPinAchievement && <div className="text-center mb-3"><button onClick={() => setPinMode(!pinMode)} className={`text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border transition-all ${pinMode ? `${theme.primary} border-white/20 text-white` : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}>{pinMode ? '✓ Gotowe' : '📌 Przypnij odznaki (max 3)'}</button>{pinMode && tempPinned.length > 0 && <div className="flex items-center justify-center gap-2 mt-2"><span className="text-white/30 text-[9px]">Przypięte:</span>{tempPinned.map(id => { const a = ACHIEVEMENTS.find(x => x.id === id); return a ? <span key={id} className="text-lg">{a.icon}</span> : null; })}<button onClick={() => { setTempPinned([]); onPinAchievement([]); }} className="text-red-400/50 hover:text-red-400 text-[9px] ml-1">Wyczyść</button></div>}</div>}{ACHIEVEMENTS.map(a => { const unlocked = a.check(computed); const isPinned = tempPinned.includes(a.id); return (<button key={a.id} disabled={!unlocked && !isPinned} onClick={() => { if (!pinMode || !unlocked) return; let next: string[]; if (isPinned) next = tempPinned.filter(x => x !== a.id); else if (tempPinned.length >= 3) next = [...tempPinned.slice(1), a.id]; else next = [...tempPinned, a.id]; setTempPinned(next); onPinAchievement?.(next); }} className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${isPinned ? 'bg-yellow-500/10 border-yellow-500/30 ring-1 ring-yellow-500/30' : unlocked ? 'bg-white/5 border-white/10' : 'bg-black/20 border-white/5 opacity-40'} ${pinMode && unlocked ? 'cursor-pointer hover:bg-white/10' : ''}`}><span className="text-2xl">{a.icon}</span><div className="flex-1 min-w-0"><p className={`text-sm font-bold ${unlocked ? 'text-white' : 'text-white/40'}`}>{a.name}</p><p className="text-[10px] text-white/30">{a.desc}</p></div>{isPinned ? <span className="text-yellow-400 text-xs font-bold">📌</span> : unlocked ? <ChevronRight size={16} className="text-green-500" /> : <span className="text-[10px] text-white/20 font-bold">🔒</span>}</button>); })}</div>)}
        </div>
      </div>
    </motion.div>
  );
};

export default PlayerProfile;
