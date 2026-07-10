'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function DebugPage() {
  const [localKeys, setLocalKeys] = useState<Record<string, string>>({});
  const [supabaseData, setSupabaseData] = useState<any>(null);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [restoreJson, setRestoreJson] = useState('');
  const [restoreStatus, setRestoreStatus] = useState('');

  useEffect(() => {
    // Read ALL mm_ keys from localStorage
    const keys: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('mm_')) {
        const val = localStorage.getItem(key) || '';
        keys[key] = val.length > 500 ? val.substring(0, 500) + '...' : val;
      }
    }
    setLocalKeys(keys);
  }, []);

  const fetchSupabase = async () => {
    const uid = localStorage.getItem('mm_uid') || '';
    setSupabaseError(null);
    try {
      // Try user_progress
      const { data: up, error: upErr } = await supabase.from('user_progress').select('*').eq('user_id', uid).maybeSingle();
      
      // Try game_results
      const { data: gr, error: grErr } = await supabase.from('game_results').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(10);
      
      setSupabaseData({
        user_progress: up || (upErr ? `Error: ${upErr.message}` : 'No data'),
        game_results_count: gr?.length || 0,
        game_results_sample: gr?.slice(0, 3) || [],
        uid,
      });
    } catch (e: any) {
      setSupabaseError(e.message);
    }
  };

  const restoreCompletedDays = () => {
    try {
      const data = JSON.parse(restoreJson);
      // Check if it's completedDays directly or wrapped
      const days = data.completedDays || data;
      
      // Read current progress
      let current: any = {};
      try { current = JSON.parse(localStorage.getItem('mm_progress') || '{}'); } catch {}
      
      // If current is new format, merge
      if (current.completedDays !== undefined) {
        current.completedDays = { ...current.completedDays, ...days };
      } else {
        // Current is old format or empty - create new format
        const stats = (() => { try { return JSON.parse(localStorage.getItem('mm_stats') || '{}'); } catch { return { total: 0, wins: 0 }; } })();
        current = {
          completedDays: days,
          stats,
          achievements: (() => { try { return JSON.parse(localStorage.getItem('mm_achievements') || '[]'); } catch { return []; } })(),
          dailyStreak: (() => { try { return JSON.parse(localStorage.getItem('mm_daily_streak') || '0'); } catch { return 0; } })(),
          lastDailyReward: localStorage.getItem('mm_last_daily') || '',
          theme: localStorage.getItem('mm_theme') || 'indigo',
          autoPlayAfterGame: true,
          showStatsPanel: true,
        };
      }
      
      // Recalculate stats from completedDays
      const entries = Object.values(current.completedDays) as any[];
      const total = entries.filter(v => v?.status === 'won' || v?.status === 'lost').length;
      const wins = entries.filter(v => v?.status === 'won').length;
      current.stats = { total, wins };
      
      localStorage.setItem('mm_progress', JSON.stringify(current));
      localStorage.setItem('mm_stats', JSON.stringify(current.stats));
      
      setRestoreStatus(`✅ Przywrócono! ${Object.keys(days).length} wyzwań, ${total} zagranych, ${wins} wygranych. Odśwież stronę!`);
    } catch (e: any) {
      setRestoreStatus(`❌ Błąd: ${e.message}`);
    }
  };

  const exportAll = () => {
    const all: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('mm_')) {
        try { all[key] = JSON.parse(localStorage.getItem(key) || ''); } catch { all[key] = localStorage.getItem(key); }
      }
    }
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'co-jest-grane-backup.json'; a.click();
  };

  const showFullProgress = () => {
    const raw = localStorage.getItem('mm_progress') || '';
    try {
      const parsed = JSON.parse(raw);
      const days = parsed.completedDays || parsed;
      const count = Object.keys(days).length;
      alert(`mm_progress ma ${count} kluczy.\n\nPierwsze 5:\n${Object.keys(days).slice(0, 5).join('\n')}\n\nTyp: ${parsed.completedDays ? 'NOWY FORMAT (zagnieżdżony)' : 'STARY FORMAT (płaski)'}`);
    } catch {
      alert(`mm_progress RAW (${raw.length} znaków):\n${raw.substring(0, 300)}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 font-mono text-sm">
      <h1 className="text-3xl font-black mb-8 text-yellow-400">🔧 DEBUG — Co Jest Grane?</h1>
      
      <div className="space-y-8">
        {/* localStorage */}
        <section>
          <h2 className="text-xl font-bold text-green-400 mb-4">📦 localStorage (klucze mm_*)</h2>
          <div className="flex gap-3 mb-4">
            <button onClick={showFullProgress} className="bg-blue-600 px-4 py-2 rounded-lg font-bold">Pokaż mm_progress</button>
            <button onClick={exportAll} className="bg-purple-600 px-4 py-2 rounded-lg font-bold">Eksportuj wszystko</button>
          </div>
          <div className="bg-slate-900 p-4 rounded-xl overflow-auto max-h-96 border border-white/10">
            {Object.entries(localKeys).map(([key, val]) => (
              <div key={key} className="mb-3">
                <span className="text-yellow-300 font-bold">{key}</span>
                <span className="text-white/30"> ({val.length} znaków)</span>
                <pre className="text-white/60 text-xs mt-1 whitespace-pre-wrap break-all">{val}</pre>
              </div>
            ))}
          </div>
        </section>

        {/* Supabase */}
        <section>
          <h2 className="text-xl font-bold text-cyan-400 mb-4">☁️ Supabase (user_progress + game_results)</h2>
          <button onClick={fetchSupabase} className="bg-cyan-600 px-4 py-2 rounded-lg font-bold mb-4">Pobierz z Supabase</button>
          {supabaseError && <p className="text-red-400">❌ {supabaseError}</p>}
          {supabaseData && (
            <div className="bg-slate-900 p-4 rounded-xl overflow-auto max-h-96 border border-white/10">
              <pre className="text-white/70 text-xs whitespace-pre-wrap">{JSON.stringify(supabaseData, null, 2)}</pre>
            </div>
          )}
        </section>

        {/* Restore */}
        <section>
          <h2 className="text-xl font-bold text-orange-400 mb-4">🔄 Przywróć completedDays</h2>
          <p className="text-white/40 text-xs mb-3">
            Wklej JSON z completedDays (stary format lub nowy). Możesz wziąć z eksportu, z Supabase user_progress.progress_data, lub z kopii zapasowej.
          </p>
          <textarea 
            value={restoreJson} 
            onChange={e => setRestoreJson(e.target.value)}
            placeholder='{"2026-06-01-klasyczny-Polskie": {"status": "won", "attempt": 2, ...}, ...}'
            className="w-full bg-slate-900 border border-white/10 rounded-xl p-4 text-white text-xs h-40 focus:outline-none focus:border-orange-400"
          />
          <div className="flex gap-3 mt-3">
            <button onClick={restoreCompletedDays} className="bg-orange-600 px-4 py-2 rounded-lg font-bold">Przywróć</button>
          </div>
          {restoreStatus && <p className="mt-3 text-sm">{restoreStatus}</p>}
        </section>

        <a href="/" className="inline-block bg-white/10 px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-all">← Wróć do gry</a>
      </div>
    </div>
  );
}
