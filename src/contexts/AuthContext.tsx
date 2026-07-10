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
  const savedProgress = localStorage.getItem('mm_progress');
  const savedNick = localStorage.getItem('mm_nickname');
  let nick = savedNick || '';
  if (!nick) {
    nick = `Gracz${Math.floor(10000 + Math.random() * 90000)}`;
    localStorage.setItem('mm_nickname', nick);
  }
  let parsedProgress: any = {};
  try { if (savedProgress) parsedProgress = JSON.parse(savedProgress); } catch {}
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
    try { localStorage.setItem('mm_progress', JSON.stringify(p)); } catch {}
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
