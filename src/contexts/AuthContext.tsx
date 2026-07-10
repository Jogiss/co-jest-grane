'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { auth, onAuthStateChanged } from '../lib/firebase';
import type { User } from '../lib/firebase';
import { supabase } from '../lib/supabase';

interface UserProgress {
  completedDays: Record<string, any>;
  stats: { total: number; wins: number };
  achievements: string[];
  dailyStreak: number;
  lastDailyReward: string;
  theme: string;
  autoPlayAfterGame: boolean;
  showStatsPanel: boolean;
}

interface AuthContextType {
  user: { email?: string | null; displayName?: string | null; uid: string } | null;
  loading: boolean;
  isAnonymous: boolean;
  userId: string;
  nickname: string;
  setNickname: (name: string) => void;
  progress: UserProgress;
  updateProgress: (updates: Partial<UserProgress>) => Promise<void>;
  syncProgressToCloud: () => Promise<void>;
  loadProgressFromCloud: () => Promise<void>;
  migrateOldData: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

function loadLocalProgress(): { progress: UserProgress; nickname: string } {
  if (typeof window === 'undefined') {
    return {
      nickname: '',
      progress: { completedDays: {}, stats: { total: 0, wins: 0 }, achievements: [], dailyStreak: 0, lastDailyReward: '', theme: 'indigo', autoPlayAfterGame: true, showStatsPanel: true },
    };
  }
  const savedNick = localStorage.getItem('mm_nickname');
  let nick = savedNick || '';
  if (!nick) {
    nick = `Gracz${Math.floor(10000 + Math.random() * 90000)}`;
    localStorage.setItem('mm_nickname', nick);
  }

  // Read ALL possible localStorage keys
  const savedProgress = localStorage.getItem('mm_progress');
  const savedStats = localStorage.getItem('mm_stats');
  const savedAchievements = localStorage.getItem('mm_achievements');
  const savedStreak = localStorage.getItem('mm_daily_streak');
  const savedLastDaily = localStorage.getItem('mm_last_daily');
  const savedTheme = localStorage.getItem('mm_theme');
  const savedAutoPlay = localStorage.getItem('mm_autoplay');
  const savedShowStats = localStorage.getItem('mm_show_stats');

  let parsedProgress: any = {};
  try { if (savedProgress) parsedProgress = JSON.parse(savedProgress); } catch {}

  // Determine completedDays from wherever they are
  let completedDays: Record<string, any> = {};
  let stats = { total: 0, wins: 0 };
  let achievements: string[] = [];
  let dailyStreak = 0;
  let lastDailyReward = '';
  let themeVal = 'indigo';
  let autoPlayAfterGame = true;
  let showStatsPanel = true;

  // NEW FORMAT: mm_progress = { completedDays: {...}, stats: {...}, ... }
  if (parsedProgress && parsedProgress.completedDays && Object.keys(parsedProgress.completedDays).length > 0) {
    completedDays = parsedProgress.completedDays;
    stats = parsedProgress.stats || stats;
    achievements = parsedProgress.achievements || achievements;
    dailyStreak = parsedProgress.dailyStreak || 0;
    lastDailyReward = parsedProgress.lastDailyReward || '';
    themeVal = parsedProgress.theme || 'indigo';
    autoPlayAfterGame = parsedProgress.autoPlayAfterGame ?? true;
    showStatsPanel = parsedProgress.showStatsPanel ?? true;
  }
  // OLD FORMAT: mm_progress = completedDays directly (keys like "2026-06-01-klasyczny-Polskie")
  else if (parsedProgress && typeof parsedProgress === 'object' && !parsedProgress.completedDays) {
    // Check if any key looks like a day key (contains dashes and status)
    const keys = Object.keys(parsedProgress);
    const looksLikeOldFormat = keys.length > 0 && keys.some(k => 
      (k.includes('-klasyczny-') || k.includes('-piano-') || k.includes('-beat-') || k.includes('-reverse-') || k.startsWith('event-'))
    );
    if (looksLikeOldFormat) {
      completedDays = parsedProgress;
    }
  }

  // Always read old separate keys and MERGE (they may have more recent data)
  try { if (savedStats) { const s = JSON.parse(savedStats); if (s.total > stats.total) stats = s; } } catch {}
  try { if (savedAchievements) { const a = JSON.parse(savedAchievements); if (a.length > achievements.length) achievements = a; } } catch {}
  try { if (savedStreak) { const s = JSON.parse(savedStreak); if (s > dailyStreak) dailyStreak = s; } } catch {}
  if (savedLastDaily && savedLastDaily > lastDailyReward) lastDailyReward = savedLastDaily;
  if (savedTheme) themeVal = savedTheme;
  try { if (savedAutoPlay !== null) autoPlayAfterGame = JSON.parse(savedAutoPlay); } catch {}
  try { if (savedShowStats !== null) showStatsPanel = JSON.parse(savedShowStats); } catch {}

  // Also check if old mm_progress had completedDays that new format missed
  if (Object.keys(completedDays).length === 0 && parsedProgress && typeof parsedProgress === 'object') {
    // Last resort: treat entire parsedProgress as completedDays if it has any keys
    const keys = Object.keys(parsedProgress).filter(k => k !== 'completedDays' && k !== 'stats' && k !== 'achievements' && k !== 'dailyStreak' && k !== 'lastDailyReward' && k !== 'theme' && k !== 'autoPlayAfterGame' && k !== 'showStatsPanel');
    if (keys.length > 0) {
      keys.forEach(k => { completedDays[k] = parsedProgress[k]; });
    }
  }

  const progress: UserProgress = {
    completedDays, stats, achievements, dailyStreak, lastDailyReward,
    theme: themeVal, autoPlayAfterGame, showStatsPanel,
  };

  // Save in new format + old format for compatibility
  try {
    localStorage.setItem('mm_progress', JSON.stringify(progress));
    localStorage.setItem('mm_stats', JSON.stringify(stats));
    localStorage.setItem('mm_achievements', JSON.stringify(achievements));
    localStorage.setItem('mm_daily_streak', JSON.stringify(dailyStreak));
    if (lastDailyReward) localStorage.setItem('mm_last_daily', lastDailyReward);
    localStorage.setItem('mm_theme', themeVal);
    localStorage.setItem('mm_autoplay', JSON.stringify(autoPlayAfterGame));
    localStorage.setItem('mm_show_stats', JSON.stringify(showStatsPanel));
  } catch {}

  return { nickname: nick, progress };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const localData = useRef(loadLocalProgress());
  const anonUidRef = useRef<string>('');

  useEffect(() => {
    if (!anonUidRef.current) {
      try {
        let uid = localStorage.getItem('mm_uid');
        if (!uid) { uid = 'uid_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36); localStorage.setItem('mm_uid', uid); }
        anonUidRef.current = uid;
      } catch { anonUidRef.current = 'uid_anon_' + Math.random().toString(36).substr(2, 12); }
    }
    // Try to recover completedDays from Supabase if local is empty
    const tryCloudRecovery = async () => {
      const uid = anonUidRef.current;
      if (!uid || Object.keys(localData.current.progress.completedDays).length > 0) return;
      try {
        const { data } = await supabase.from('user_progress').select('*').eq('user_id', uid).maybeSingle();
        if (data && data.progress_data && Object.keys(data.progress_data).length > 0) {
          const cloud: UserProgress = {
            completedDays: data.progress_data,
            stats: data.stats || localData.current.progress.stats,
            achievements: data.achievements || localData.current.progress.achievements,
            dailyStreak: data.daily_streak || localData.current.progress.dailyStreak,
            lastDailyReward: data.last_daily || localData.current.progress.lastDailyReward,
            theme: data.theme || localData.current.progress.theme,
            autoPlayAfterGame: data.settings?.autoPlayAfterGame ?? true,
            showStatsPanel: data.settings?.showStatsPanel ?? true,
          };
          setProgress(cloud);
          try { localStorage.setItem('mm_progress', JSON.stringify(cloud)); } catch {}
        }
      } catch {}
    };
    tryCloudRecovery();
  }, []);

  const [user, setUser] = useState<{ email?: string | null; displayName?: string | null; uid: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [nickname, setNicknameState] = useState(localData.current.nickname);
  const [progress, setProgress] = useState<UserProgress>(localData.current.progress);

  const userId = user?.uid || anonUidRef.current;
  const isAnonymous = !user;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        setUser({ email: firebaseUser.email, displayName: firebaseUser.displayName, uid: firebaseUser.uid });
        // Auto-load from Supabase cloud and merge with local
        try {
          // Try both Firebase UID and old anon UID
          const idsToTry = [firebaseUser.uid, anonUidRef.current].filter(Boolean);
          for (const uid of idsToTry) {
            const { data } = await supabase.from('user_progress').select('*').eq('user_id', uid).maybeSingle();
            if (data && data.progress_data) {
              const cloudDays = data.progress_data || {};
              const cloudStats = data.stats || { total: 0, wins: 0 };
              const cloudAchievements = data.achievements || [];
              // Merge: take whichever has more data
              setProgress(prev => {
                const localDaysCount = Object.keys(prev.completedDays).length;
                const cloudDaysCount = Object.keys(cloudDays).length;
                const mergedDays = cloudDaysCount > localDaysCount ? { ...prev.completedDays, ...cloudDays } : { ...cloudDays, ...prev.completedDays };
                const mergedStats = cloudStats.total > prev.stats.total ? cloudStats : prev.stats;
                const mergedAchievements = Array.from(new Set([...prev.achievements, ...cloudAchievements]));
                const merged: UserProgress = {
                  completedDays: mergedDays,
                  stats: mergedStats,
                  achievements: mergedAchievements,
                  dailyStreak: Math.max(prev.dailyStreak, data.daily_streak || 0),
                  lastDailyReward: prev.lastDailyReward > (data.last_daily || '') ? prev.lastDailyReward : (data.last_daily || ''),
                  theme: data.theme || prev.theme,
                  autoPlayAfterGame: data.settings?.autoPlayAfterGame ?? prev.autoPlayAfterGame,
                  showStatsPanel: data.settings?.showStatsPanel ?? prev.showStatsPanel,
                };
                saveProgressToLocalStorage(merged);
                return merged;
              });
              break; // Found data, stop trying other IDs
            }
          }
        } catch (e) { console.error('Cloud load error:', e); }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const setNickname = (name: string) => {
    const cleanName = name.slice(0, 15);
    setNicknameState(cleanName);
    if (typeof window !== 'undefined') localStorage.setItem('mm_nickname', cleanName);
  };

  const saveProgressToLocalStorage = (p: UserProgress) => {
    if (typeof window === 'undefined') return;
    try {
      // Save in NEW format (single key)
      localStorage.setItem('mm_progress', JSON.stringify(p));
      // Also save in OLD format for backwards compatibility
      localStorage.setItem('mm_stats', JSON.stringify(p.stats));
      localStorage.setItem('mm_achievements', JSON.stringify(p.achievements));
      localStorage.setItem('mm_daily_streak', JSON.stringify(p.dailyStreak));
      if (p.lastDailyReward) localStorage.setItem('mm_last_daily', p.lastDailyReward);
      localStorage.setItem('mm_theme', p.theme);
      localStorage.setItem('mm_autoplay', JSON.stringify(p.autoPlayAfterGame));
      localStorage.setItem('mm_show_stats', JSON.stringify(p.showStatsPanel));
    } catch {}
  };

  const updateProgress = async (updates: Partial<UserProgress>) => {
    const newProgress = { ...progress, ...updates };
    setProgress(newProgress);
    saveProgressToLocalStorage(newProgress);
    if (user) {
      try {
        const progressData = {
          user_id: user.uid, nickname, progress_data: newProgress.completedDays,
          stats: newProgress.stats, achievements: newProgress.achievements,
          daily_streak: newProgress.dailyStreak, last_daily: newProgress.lastDailyReward,
          theme: newProgress.theme, settings: { autoPlayAfterGame: newProgress.autoPlayAfterGame, showStatsPanel: newProgress.showStatsPanel },
          updated_at: new Date().toISOString(),
        };
        const { data: existing } = await supabase.from('user_progress').select('id').eq('user_id', user.uid).single();
        if (existing) await supabase.from('user_progress').update(progressData).eq('user_id', user.uid);
        else await supabase.from('user_progress').insert([progressData]);
      } catch (e) { console.error('Sync error:', e); }
    }
  };

  const syncProgressToCloud = async () => {
    if (!user) return;
    try {
      const progressData = {
        user_id: user.uid, nickname, progress_data: progress.completedDays,
        stats: progress.stats, achievements: progress.achievements,
        daily_streak: progress.dailyStreak, last_daily: progress.lastDailyReward,
        theme: progress.theme, settings: { autoPlayAfterGame: progress.autoPlayAfterGame, showStatsPanel: progress.showStatsPanel },
        updated_at: new Date().toISOString(),
      };
      const { data: existing } = await supabase.from('user_progress').select('id').eq('user_id', user.uid).single();
      if (existing) await supabase.from('user_progress').update(progressData).eq('user_id', user.uid);
      else await supabase.from('user_progress').insert([progressData]);
    } catch (e) { console.error('Sync error:', e); }
  };

  const loadProgressFromCloud = async () => {
    if (!user) return;
    try {
      const { data } = await supabase.from('user_progress').select('*').eq('user_id', user.uid).single();
      if (data) {
        const cloudProgress: UserProgress = {
          completedDays: data.progress_data || {}, stats: data.stats || { total: 0, wins: 0 },
          achievements: data.achievements || [], dailyStreak: data.daily_streak || 0,
          lastDailyReward: data.last_daily || '', theme: data.theme || 'indigo',
          autoPlayAfterGame: data.settings?.autoPlayAfterGame ?? true, showStatsPanel: data.settings?.showStatsPanel ?? true,
        };
        setProgress(cloudProgress);
        saveProgressToLocalStorage(cloudProgress);
      }
    } catch (e) { console.error('Load from cloud error:', e); }
  };

  const migrateOldData = async (): Promise<boolean> => {
    if (!user) return false;
    const oldUid = typeof window !== 'undefined' ? localStorage.getItem('mm_uid') : null;
    if (!oldUid || oldUid === user.uid) return false;
    try {
      const { data: oldLeaderboard } = await supabase.from('leaderboard_view').select('*').eq('user_id', oldUid).maybeSingle();
      if (oldLeaderboard) {
        const deltaPoints = oldLeaderboard.points || 0;
        if (deltaPoints > 0) {
          await supabase.from('game_results').insert([{ user_id: user.uid, nickname, points: deltaPoints, is_win: false, result_type: 'migration' }]);
        }
      }
      return true;
    } catch (e) { console.error('Migration error:', e); return false; }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAnonymous, userId, nickname, setNickname, progress, updateProgress, syncProgressToCloud, loadProgressFromCloud, migrateOldData }}>
      {children}
    </AuthContext.Provider>
  );
};
