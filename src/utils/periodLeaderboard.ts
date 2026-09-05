// ============================================================
// LEKKI RANKING OKRESOWY (tydzień / miesiąc)
// ------------------------------------------------------------
// Dlaczego to NIE zaleje Supabase (w przeciwieństwie do game_results):
//  • 1 WIERSZ na gracza na okres (upsert = nadpisanie, nie dopisywanie)
//    → 1000 graczy = ~1000 wierszy/tydzień, a nie setki tysięcy
//  • zapis maks. raz na 60 s i tylko gdy punkty faktycznie się zmieniły
//  • odczyt = TOP 10 (limit 10 wierszy) + jeden lekki COUNT na moją pozycję
//  • stare okresy kasuje jeden CRON/SQL (patrz sql/SQL_PERIOD_LEADERBOARD.sql)
// Punkty liczone są LOKALNIE z completedDays — baza to tylko "tablica wyników".
// ============================================================

import { supabase } from '../lib/supabase';

const BASE_POINTS = [100, 80, 60, 40, 20, 10];

export interface PeriodKeys { week: string; month: string; }
export type PeriodType = 'week' | 'month';

export interface TopEntry {
  user_id: string;
  nickname: string;
  points: number;
  games: number;
}

/** Klucze okresów: ISO-tydzień '2026-W24' oraz miesiąc '2026-06'. */
export function getPeriodKeys(d: Date = new Date()): PeriodKeys {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return {
    week: `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`,
    month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
  };
}

/** Ładna etykieta okresu do UI. */
export function getPeriodLabel(type: PeriodType, d: Date = new Date()): string {
  if (type === 'week') {
    const day = d.getDay() || 7;
    const monday = new Date(d); monday.setDate(d.getDate() - day + 1);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const f = (x: Date) => `${x.getDate()}.${String(x.getMonth() + 1).padStart(2, '0')}`;
    return `${f(monday)} – ${f(sunday)}`;
  }
  return d.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
}

interface DayLike {
  status?: string;
  attempt?: number;
  partialPoints?: number;
  ts?: number;
}

/** Zapisuje odebraną nagrodę dzienną, żeby liczyła się do rankingu okresowego. */
export function recordDailyReward(dateISO: string, points: number): void {
  try {
    const raw = JSON.parse(localStorage.getItem('mm_daily_rewards') || '[]');
    const list: { date: string; points: number }[] = Array.isArray(raw) ? raw : [];
    if (list.some(r => r.date === dateISO)) return; // 1 nagroda dziennie
    list.push({ date: dateISO, points });
    // trzymamy tylko ostatnie 70 dni — localStorage się nie rozdmucha
    const cutoff = new Date(Date.now() - 70 * 86400000).toISOString().split('T')[0];
    localStorage.setItem('mm_daily_rewards', JSON.stringify(list.filter(r => r.date >= cutoff)));
  } catch {}
}

function readDailyRewards(): { date: string; points: number }[] {
  try {
    const raw = JSON.parse(localStorage.getItem('mm_daily_rewards') || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}

/** Punkty w bieżącym tygodniu/miesiącu, policzone lokalnie z completedDays. */
export function computeLocalPeriodPoints(completedDays: Record<string, DayLike>) {
  const cur = getPeriodKeys(new Date());
  const week = { points: 0, games: 0 };
  const month = { points: 0, games: 0 };

  // Nagrody dzienne (+25, +125 co 7 dni) też liczą się do rankingu
  for (const r of readDailyRewards()) {
    const when = new Date(`${r.date}T12:00:00`);
    if (isNaN(when.getTime())) continue;
    const k = getPeriodKeys(when);
    if (k.week === cur.week) week.points += r.points || 0;
    if (k.month === cur.month) month.points += r.points || 0;
  }

  for (const [key, v] of Object.entries(completedDays || {})) {
    if (!v || (v.status !== 'won' && v.status !== 'lost')) continue;

    // Kiedy zagrane: ts (nowe wpisy) → fallback: data z klucza dziennego
    let when: Date | null = null;
    if (typeof v.ts === 'number' && v.ts > 0) when = new Date(v.ts);
    else {
      const m = key.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) when = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00`);
    }
    if (!when || isNaN(when.getTime())) continue;

    let pts = v.partialPoints || 0;
    if (v.status === 'won') {
      const idx = Math.min(Math.max(v.attempt || 1, 1), 6) - 1;
      pts += BASE_POINTS[idx];
    }

    const k = getPeriodKeys(when);
    if (k.week === cur.week) { week.points += pts; week.games += 1; }
    if (k.month === cur.month) { month.points += pts; month.games += 1; }
  }

  return { week, month, keys: cur };
}

// --- throttling zapisu -------------------------------------------------
let lastSyncAt = 0;
let lastHash = '';
const MIN_SYNC_INTERVAL = 60_000; // maks. 1 zapis na minutę

/** Upsert 2 wierszy (tydzień + miesiąc). Cichy no-op gdy nic się nie zmieniło. */
export async function syncPeriodScores(
  userId: string,
  nickname: string,
  completedDays: Record<string, DayLike>,
  force = false
): Promise<void> {
  const nick = (nickname || '').trim();
  if (!userId || nick.length < 2) return;

  const { week, month, keys } = computeLocalPeriodPoints(completedDays);
  if (week.points <= 0 && month.points <= 0) return;

  const hash = `${userId}|${keys.week}:${week.points}|${keys.month}:${month.points}|${nick}`;
  if (hash === lastHash) return;
  const now = Date.now();
  if (!force && now - lastSyncAt < MIN_SYNC_INTERVAL) return;

  lastSyncAt = now;
  lastHash = hash;

  const stamp = new Date().toISOString();
  const rows = [
    { user_id: userId, nickname: nick.slice(0, 15), period_type: 'week', period_key: keys.week, points: week.points, games: week.games, updated_at: stamp },
    { user_id: userId, nickname: nick.slice(0, 15), period_type: 'month', period_key: keys.month, points: month.points, games: month.games, updated_at: stamp },
  ].filter(r => r.points > 0);

  try {
    await supabase.from('period_scores').upsert(rows, { onConflict: 'user_id,period_type,period_key' });
  } catch {
    lastHash = ''; // pozwól spróbować ponownie
  }
}

// --- ARCHIWUM: przeglądanie zakończonych okresów ------------------------

export interface PeriodOption { key: string; label: string; current: boolean; }

/** Lista okresów do wyboru: bieżący + `count` poprzednich. */
export function getPastPeriods(type: PeriodType, count = 6): PeriodOption[] {
  const now = new Date();
  const seen = new Set<string>();
  const out: PeriodOption[] = [];
  for (let i = 0; i <= count; i++) {
    const d = new Date(now);
    if (type === 'month') d.setMonth(now.getMonth() - i);
    else d.setDate(now.getDate() - i * 7);
    const keys = getPeriodKeys(d);
    const key = type === 'month' ? keys.month : keys.week;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, label: getPeriodLabel(type, d), current: i === 0 });
  }
  return out;
}

/** Moje punkty w DOWOLNYM okresie (też zakończonym) — lokalnie. */
export function computePeriodPointsFor(
  periodType: PeriodType,
  periodKey: string,
  completedDays: Record<string, DayLike>
): { points: number; games: number } {
  let points = 0, games = 0;
  for (const r of readDailyRewards()) {
    const when = new Date(`${r.date}T12:00:00`);
    if (isNaN(when.getTime())) continue;
    const k = getPeriodKeys(when);
    const key = periodType === 'week' ? k.week : k.month;
    if (key === periodKey) points += r.points || 0;
  }
  for (const [key, v] of Object.entries(completedDays || {})) {
    if (!v || (v.status !== 'won' && v.status !== 'lost')) continue;
    let when: Date | null = null;
    if (typeof v.ts === 'number' && v.ts > 0) when = new Date(v.ts);
    else {
      const m = key.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) when = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00`);
    }
    if (!when || isNaN(when.getTime())) continue;
    const k = getPeriodKeys(when);
    if ((periodType === 'week' ? k.week : k.month) !== periodKey) continue;
    let pts = v.partialPoints || 0;
    if (v.status === 'won') {
      const idx = Math.min(Math.max(v.attempt || 1, 1), 6) - 1;
      pts += BASE_POINTS[idx];
    }
    points += pts;
    games += 1;
  }
  return { points, games };
}

/** TOP N okresu — domyślnie bieżący (bez periodKey). */
export async function fetchTopScores(periodType: PeriodType, limit = 10, periodKey?: string): Promise<TopEntry[]> {
  const keys = getPeriodKeys();
  const key = periodKey ?? (periodType === 'week' ? keys.week : keys.month);
  try {
    const { data } = await supabase
      .from('period_scores')
      .select('user_id, nickname, points, games')
      .eq('period_type', periodType)
      .eq('period_key', key)
      .order('points', { ascending: false })
      .limit(limit);
    return (data as TopEntry[]) || [];
  } catch { return []; }
}

/** Moja pozycja — sam COUNT (head: true), więc transfer ~zerowy. */
export async function fetchMyRank(periodType: PeriodType, myPoints: number, periodKey?: string): Promise<number | null> {
  if (myPoints <= 0) return null;
  const keys = getPeriodKeys();
  const key = periodKey ?? (periodType === 'week' ? keys.week : keys.month);
  try {
    const { count } = await supabase
      .from('period_scores')
      .select('*', { count: 'exact', head: true })
      .eq('period_type', periodType)
      .eq('period_key', key)
      .gt('points', myPoints);
    return (count || 0) + 1;
  } catch { return null; }
}
