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

  // Try NEW format first (single mm_progress key with nested object)
  const savedProgress = localStorage.getItem('mm_progress');
  let parsedProgress: any = {};
  try { if (savedProgress) parsedProgress = JSON.parse(savedProgress); } catch {}

  // Check if new format (has completedDays key inside)
  if (parsedProgress.completedDays) {
    return {
      nickname: nick,
      progress: {
        completedDays: parsedProgress.completedDays || {},
        stats: parsedProgress.stats || { total: 0, wins: 0 },
        achievements: parsedProgress.achievements || [],
        dailyStreak: parsedProgress.dailyStreak || 0,
        lastDailyReward: parsedProgress.lastDailyReward || '',
        theme: parsedProgress.theme || 'indigo',
        autoPlayAfterGame: parsedProgress.autoPlayAfterGame ?? true,
        showStatsPanel: parsedProgress.showStatsPanel ?? true,
      },
    };
  }

  // OLD FORMAT — original code stored each piece under separate localStorage keys:
  // mm_progress = completedDays directly (flat object of day keys)
  // mm_stats = { total, wins }
  // mm_achievements = string[]
  // mm_daily_streak = number
  // mm_last_daily = string
  // mm_theme = string
  // mm_autoplay = boolean
  // mm_show_stats = boolean
  const oldCompletedDays = parsedProgress || {}; // mm_progress WAS the completedDays directly
  let oldStats = { total: 0, wins: 0 };
  try { const s = localStorage.getItem('mm_stats'); if (s) oldStats = JSON.parse(s); } catch {}
  let oldAchievements: string[] = [];
  try { const a = localStorage.getItem('mm_achievements'); if (a) oldAchievements = JSON.parse(a); } catch {}
  let oldStreak = 0;
  try { const s = localStorage.getItem('mm_daily_streak'); if (s) oldStreak = JSON.parse(s); } catch {}
  const oldLastDaily = localStorage.getItem('mm_last_daily') || '';
  const oldTheme = localStorage.getItem('mm_theme') || 'indigo';
  let oldAutoPlay = true;
  try { const a = localStorage.getItem('mm_autoplay'); if (a !== null) oldAutoPlay = JSON.parse(a); } catch {}
  let oldShowStats = true;
  try { const s = localStorage.getItem('mm_show_stats'); if (s !== null) oldShowStats = JSON.parse(s); } catch {}

  const progress: UserProgress = {
    completedDays: oldCompletedDays,
    stats: oldStats,
    achievements: oldAchievements,
    dailyStreak: oldStreak,
    lastDailyReward: oldLastDaily,
    theme: oldTheme,
    autoPlayAfterGame: oldAutoPlay,
    showStatsPanel: oldShowStats,
  };

  // Migrate: save in new format so next load is fast
  try { localStorage.setItem('mm_progress', JSON.stringify(progress)); } catch {}

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
