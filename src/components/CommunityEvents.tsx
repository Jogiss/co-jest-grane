'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ArrowLeft, Plus, Trash2, ChevronRight, Send, Check, XCircle,
  Play, Pause, AlertCircle, Loader2, Shield, Music, Users, Search, Copy, 
  TrendingUp, Clock, Link2, ThumbsUp, ThumbsDown, Pencil, Save
} from 'lucide-react';
import { supabase } from '../lib/supabase';

type EventCategory = 'music' | 'cartoon' | 'game' | 'other';
type EventStatus = 'pending_review' | 'approved' | 'rejected' | 'active' | 'archived';

export interface CommunityEvent {
  id: string; creator_id: string; creator_nickname: string; title: string; description: string;
  category: EventCategory; status: EventStatus; code: string; play_count: number;
  likes: number; dislikes: number; created_at: string; activated_at: string | null;
  song_count?: number;
}
export interface CommunityEventSong {
  id: string; event_id: string; title: string; artist: string; youtube_url: string;
  audio_url?: string; start_time_seconds: number; order_index: number; date: string;
}
interface SongFormEntry { title: string; artist: string; youtube_url: string; audio_url: string; start_time_seconds: number; date: string; }

interface CommunityEventsProps {
  isOpen: boolean; onClose: () => void; userId: string; nickname: string; isAdmin?: boolean;
  theme: { primary: string; text: string; border: string; hover: string; gradient: string; };
  onPlayEvent?: (event: CommunityEvent, song?: CommunityEventSong, index?: number, allSongs?: CommunityEventSong[]) => void;
  initialEventId?: string | null;
  onInitialEventHandled?: () => void;
}

const CATEGORY_LABELS: Record<EventCategory, { label: string; emoji: string }> = {
  music: { label: 'Muzyka', emoji: '🎵' }, cartoon: { label: 'Bajki', emoji: '🏰' },
  game: { label: 'Gry', emoji: '🎮' }, other: { label: 'Inne', emoji: '🌟' },
};
const STATUS_LABELS: Record<EventStatus, { label: string; color: string }> = {
  pending_review: { label: 'Oczekuje', color: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30' },
  approved: { label: 'Zatwierdzony', color: 'text-green-400 bg-green-500/20 border-green-500/30' },
  rejected: { label: 'Odrzucony', color: 'text-red-400 bg-red-500/20 border-red-500/30' },
  active: { label: 'Aktywny', color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30' },
  archived: { label: 'Archiwum', color: 'text-white/40 bg-white/5 border-white/10' },
};

function isValidYouTubeUrl(url: string): boolean { return /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]{11}/.test(url); }
function sanitizeText(text: string): string { return text.replace(/<[^>]*>/g, '').replace(/[<>"'`]/g, '').trim(); }
function extractYouTubeId(url: string): string | null { const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/); return m ? m[1] : null; }
function generateEventCode(): string { return Array.from({ length: 8 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 30)]).join(''); }

const CommunityEvents: React.FC<CommunityEventsProps> = ({ isOpen, onClose, userId, nickname, isAdmin = false, theme, onPlayEvent, initialEventId, onInitialEventHandled }) => {
  type ViewState = 'list' | 'create_step1' | 'create_step2' | 'my_events' | 'my_event_extend' | 'admin' | 'admin_detail' | 'event_detail';
  const [view, setView] = useState<ViewState>('list');
  const [activeEvents, setActiveEvents] = useState<CommunityEvent[]>([]);
  const [myEvents, setMyEvents] = useState<CommunityEvent[]>([]);
  const [pendingEvents, setPendingEvents] = useState<CommunityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'popular' | 'liked'>('newest');
  const [statusFilter, setStatusFilter] = useState<'all' | 'done' | 'started' | 'new'>('all');
  const [categoryFilter, setCategoryFilter] = useState<EventCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCategory, setFormCategory] = useState<EventCategory>('music');
  const [formSongs, setFormSongs] = useState<SongFormEntry[]>([{ title: '', artist: '', youtube_url: '', audio_url: '', start_time_seconds: 1, date: '' }]);
  const [detailEvent, setDetailEvent] = useState<CommunityEvent | null>(null);
  const [detailSongs, setDetailSongs] = useState<CommunityEventSong[]>([]);
  const [previewVideoId, setPreviewVideoId] = useState<string | null>(null);
  const [_previewStart, setPreviewStart] = useState(0);
  const [creatorProfile, setCreatorProfile] = useState<{ nickname: string; points: number; wins: number; total_games: number } | null>(null);
  const [editingSongId, setEditingSongId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState(0);
  const [myVotes, setMyVotes] = useState<Record<string, 'like' | 'dislike'>>(() => { try { return JSON.parse(localStorage.getItem('mm_event_votes') || '{}'); } catch { return {}; } });
  const [extendingEvent, setExtendingEvent] = useState<CommunityEvent | null>(null);
  const [extendSongs, setExtendSongs] = useState<SongFormEntry[]>([{ title: '', artist: '', youtube_url: '', audio_url: '', start_time_seconds: 1, date: '' }]);
  const [existingSongsCount, setExistingSongsCount] = useState(0);
  const [existingSongsList, setExistingSongsList] = useState<CommunityEventSong[]>([]);
  const [showExistingSongs, setShowExistingSongs] = useState(false);

  const fetchActiveEvents = useCallback(async () => { 
    try { 
      const { data } = await supabase.from('community_events').select('*').eq('status', 'active').order('activated_at', { ascending: false }); 
      if (data) {
        const withCounts = await Promise.all(data.map(async (ev: any) => {
          try {
            const { count } = await supabase.from('community_event_songs').select('*', { count: 'exact', head: true }).eq('event_id', ev.id);
            return { ...ev, song_count: count || 0 };
          } catch { return { ...ev, song_count: 0 }; }
        }));
        setActiveEvents(withCounts);
      }
    } catch {} 
  }, []);
  const fetchMyEvents = useCallback(async () => { try { const { data } = await supabase.from('community_events').select('*').eq('creator_id', userId).order('created_at', { ascending: false }); if (data) setMyEvents(data); } catch {} }, [userId]);
  const fetchPendingEvents = useCallback(async () => { if (!isAdmin) return; try { const { data } = await supabase.from('community_events').select('*').in('status', ['pending_review', 'approved']).order('created_at', { ascending: false }); if (data) setPendingEvents(data); } catch {} }, [isAdmin]);
  const fetchEventSongs = useCallback(async (eventId: string) => { try { const { data } = await supabase.from('community_event_songs').select('*').eq('event_id', eventId).order('order_index'); if (data) setDetailSongs(data); } catch {} }, []);

  const searchEvent = async () => {
    // Empty search = show all events
    if (!searchQuery.trim()) { fetchActiveEvents(); return; }
    setLoading(true); setError(null);
    try {
      const q = searchQuery.trim().toUpperCase();
      const { data } = await supabase.from('community_events').select('*').eq('code', q).eq('status', 'active').maybeSingle();
      if (data) { setDetailEvent(data); await fetchEventSongs(data.id); setView('event_detail'); setLoading(false); return; }
      const { data: nameResults } = await supabase.from('community_events').select('*').eq('status', 'active').ilike('title', `%${searchQuery.trim()}%`).limit(10);
      if (nameResults && nameResults.length > 0) { setActiveEvents(nameResults); } else { setError('Nie znaleziono eventu'); }
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { if (isOpen) { fetchActiveEvents(); fetchMyEvents(); if (isAdmin) fetchPendingEvents(); } }, [isOpen, fetchActiveEvents, fetchMyEvents, fetchPendingEvents, isAdmin]);
  
  useEffect(() => {
    if (isOpen && initialEventId) {
      (async () => {
        try {
          const { data: ev } = await supabase.from('community_events').select('*').eq('id', initialEventId).single();
          if (ev) { setDetailEvent(ev); await fetchEventSongs(ev.id); setView('event_detail'); }
        } catch {}
        onInitialEventHandled?.();
      })();
    }
  }, [isOpen, initialEventId, fetchEventSongs, onInitialEventHandled]);

  const getEventProgress = (ev: CommunityEvent) => {
    let progressData: Record<string, any> = {};
    try {
      const raw = JSON.parse(localStorage.getItem('mm_progress') || '{}');
      progressData = raw.completedDays || raw || {};
    } catch {}
    const keys = Object.keys(progressData).filter(k => k.startsWith(`event-community-${ev.id}-`));
    const played = keys.filter(k => { const s = progressData[k]; return s && (s.status === 'won' || s.status === 'lost'); }).length;
    const won = keys.filter(k => progressData[k]?.status === 'won').length;
    const total = ev.song_count || 0;
    return { played, won, total, completed: total > 0 && played >= total };
  };

  const sortedEvents = [...activeEvents]
    .filter(ev => {
      // Category filter
      if (categoryFilter !== 'all' && ev.category !== categoryFilter) return false;
      // Status filter
      if (statusFilter === 'all') return true;
      const { played, completed } = getEventProgress(ev);
      if (statusFilter === 'done') return completed;
      if (statusFilter === 'started') return played > 0 && !completed;
      if (statusFilter === 'new') return played === 0;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'popular') return (b.play_count || 0) - (a.play_count || 0);
      if (sortBy === 'liked') return ((b.likes || 0) - (b.dislikes || 0)) - ((a.likes || 0) - (a.dislikes || 0));
      return new Date(b.activated_at || b.created_at).getTime() - new Date(a.activated_at || a.created_at).getTime();
    });

  const validateStep1 = (): boolean => { const t = sanitizeText(formTitle); if (t.length < 3 || t.length > 50) { setError('Tytuł 3-50 znaków'); return false; } setError(null); return true; };
  const validateStep2 = (): boolean => {
    if (formSongs.length < 5) { setError('Min. 5 piosenek'); return false; }
    const dates = new Set<string>(); const titles = new Set<string>(); const urls = new Set<string>();
    for (let i = 0; i < formSongs.length; i++) {
      const s = formSongs[i];
      if (!sanitizeText(s.title).trim()) { setError(`#${i+1}: brak tytułu`); return false; }
      if (formCategory === 'music' && !sanitizeText(s.artist).trim()) { setError(`#${i+1}: wykonawca wymagany`); return false; }
      if (!isValidYouTubeUrl(s.youtube_url)) { setError(`#${i+1}: zły link YouTube`); return false; }
      if (s.start_time_seconds < 0) { setError(`#${i+1}: sekunda nie może być ujemna`); return false; }
      if (!s.date) { setError(`#${i+1}: data wymagana`); return false; }
      if (dates.has(s.date)) { setError(`#${i+1}: data ${s.date} już użyta`); return false; } dates.add(s.date);
      const tKey = sanitizeText(s.title).toLowerCase();
      if (titles.has(tKey)) { setError(`#${i+1}: tytuł "${s.title}" zduplikowany`); return false; } titles.add(tKey);
      if (urls.has(s.youtube_url.trim())) { setError(`#${i+1}: link YouTube zduplikowany`); return false; } urls.add(s.youtube_url.trim());
    }
    setError(null); return true;
  };

  const submitEvent = async () => {
    if (!validateStep2()) return; setLoading(true); setError(null);
    try {
      const code = generateEventCode();
      const { data: ev, error: evErr } = await supabase.from('community_events').insert([{ creator_id: userId, creator_nickname: sanitizeText(nickname), title: sanitizeText(formTitle).slice(0, 50), description: sanitizeText(formDesc).slice(0, 200), category: formCategory, status: 'pending_review', code, play_count: 0, likes: 0, dislikes: 0 }]).select().single();
      if (evErr || !ev) { const msg = evErr?.message || ''; setError(msg.includes('unique') ? 'Duplikat nazwy/kodu' : msg.includes('policy') ? 'Brak uprawnień' : `Błąd: ${msg || 'Nieznany'}`); setLoading(false); return; }
      const songs = formSongs.map((s, i) => ({ event_id: ev.id, title: sanitizeText(s.title).slice(0, 100), artist: sanitizeText(s.artist).slice(0, 100), youtube_url: s.youtube_url.trim(), audio_url: s.audio_url?.trim() || null, start_time_seconds: Math.max(0, Math.floor(s.start_time_seconds)), order_index: i + 1, date: s.date || null }));
      await supabase.from('community_event_songs').insert(songs);
      try { const cur = parseInt(localStorage.getItem('mm_events_created') || '0'); localStorage.setItem('mm_events_created', String(cur + 1)); } catch {}
      setSuccess(`Event zgłoszony! Kod: ${code}`);
      setFormTitle(''); setFormDesc(''); setFormCategory('music');
      setFormSongs([{ title: '', artist: '', youtube_url: '', audio_url: '', start_time_seconds: 1, date: '' }]);
      fetchMyEvents(); setTimeout(() => { setSuccess(null); setView('my_events'); }, 3000);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const adminAction = async (eventId: string, newStatus: EventStatus) => {
    setLoading(true);
    try { const upd: any = { status: newStatus }; if (newStatus === 'active') upd.activated_at = new Date().toISOString(); await supabase.from('community_events').update(upd).eq('id', eventId); setSuccess(newStatus === 'active' ? 'Aktywowany!' : 'Odrzucony'); fetchPendingEvents(); fetchActiveEvents(); setTimeout(() => setSuccess(null), 2000); }
    catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const saveSongEdit = async (songId: string) => {
    setLoading(true);
    try {
      const updateData: any = { title: sanitizeText(editTitle), artist: sanitizeText(editArtist), start_time_seconds: Math.max(0, editStartTime) };
      if (editDate) updateData.date = editDate;
      await supabase.from('community_event_songs').update(updateData).eq('id', songId);
      setEditingSongId(null); if (detailEvent) await fetchEventSongs(detailEvent.id); setSuccess('Zapisano!'); setTimeout(() => setSuccess(null), 1500);
    }
    catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const voteEvent = async (eventId: string, voteType: 'like' | 'dislike') => {
    const prev = myVotes[eventId];
    const isUnvote = prev === voteType;
    const delta: any = {};
    if (prev === 'like') delta.likes = -1; else if (prev === 'dislike') delta.dislikes = -1;
    if (!isUnvote) { if (voteType === 'like') delta.likes = (delta.likes || 0) + 1; else delta.dislikes = (delta.dislikes || 0) + 1; }
    const newVotes = { ...myVotes };
    if (isUnvote) delete newVotes[eventId]; else newVotes[eventId] = voteType;
    setMyVotes(newVotes); localStorage.setItem('mm_event_votes', JSON.stringify(newVotes));
    setActiveEvents(evs => evs.map(e => e.id === eventId ? { ...e, likes: (e.likes || 0) + (delta.likes || 0), dislikes: (e.dislikes || 0) + (delta.dislikes || 0) } : e));
    if (detailEvent?.id === eventId) setDetailEvent(d => d ? { ...d, likes: (d.likes || 0) + (delta.likes || 0), dislikes: (d.dislikes || 0) + (delta.dislikes || 0) } : d);
    try {
      const { data: fresh } = await supabase.from('community_events').select('likes, dislikes').eq('id', eventId).single();
      if (fresh) await supabase.from('community_events').update({ likes: Math.max(0, (fresh.likes || 0) + (delta.likes || 0)), dislikes: Math.max(0, (fresh.dislikes || 0) + (delta.dislikes || 0)) }).eq('id', eventId);
    } catch {}
  };

  const addSong = () => { if (formSongs.length >= 31) return; setFormSongs([...formSongs, { title: '', artist: '', youtube_url: '', audio_url: '', start_time_seconds: 1, date: '' }]); };
  const removeSong = (i: number) => { if (formSongs.length <= 1) return; setFormSongs(formSongs.filter((_, idx) => idx !== i)); };
  const updateSong = (i: number, f: keyof SongFormEntry, v: string | number) => { setFormSongs(formSongs.map((s, idx) => idx === i ? { ...s, [f]: v } : s)); };

  const openDetail = async (ev: CommunityEvent) => { setDetailEvent(ev); await fetchEventSongs(ev.id); setView(isAdmin && (ev.status === 'pending_review' || ev.status === 'approved') ? 'admin_detail' : 'event_detail'); };
  const openCreatorProfile = async (creatorId: string, creatorNick: string) => { try { const { data } = await supabase.from('leaderboard_view').select('points, wins, total_games').eq('user_id', creatorId).maybeSingle(); setCreatorProfile({ nickname: creatorNick, points: data?.points || 0, wins: data?.wins || 0, total_games: data?.total_games || 0 }); } catch { setCreatorProfile({ nickname: creatorNick, points: 0, wins: 0, total_games: 0 }); } };
  const copyCode = (code: string) => { navigator.clipboard.writeText(code); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); };
  const copyLink = (code: string) => { navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?community=${code}`); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); };

  if (!isOpen) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-slate-950 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-950/30 via-slate-950 to-black overflow-y-auto">
      <div className="min-h-screen flex flex-col items-center py-8 px-4">
        <div className="w-full max-w-3xl space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={() => { if (view === 'create_step2') setView('create_step1'); else if (view === 'my_event_extend') { setView('my_events'); setError(null); } else if (view === 'event_detail' || view === 'admin_detail') { setView('list'); setPreviewVideoId(null); setEditingSongId(null); } else if (view !== 'list') { setView('list'); setError(null); setSuccess(null); } else onClose(); }} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/10 px-4 py-2.5 rounded-xl transition-all group">
              <ArrowLeft size={16} className="text-white/60 group-hover:text-white" />
              <span className="text-white/60 group-hover:text-white text-xs font-bold uppercase tracking-wider">{view === 'create_step2' ? 'Wstecz' : view !== 'list' ? 'Powrót' : 'Menu'}</span>
            </button>
          </div>
          <AnimatePresence>
            {error && view !== 'create_step2' && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2"><AlertCircle size={16} className="text-red-500 shrink-0" /><p className="text-red-400 text-sm">{error}</p><button onClick={() => setError(null)} className="ml-auto text-red-400/50 hover:text-red-400"><X size={14} /></button></motion.div>}
            {success && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 flex items-center gap-2"><Check size={16} className="text-green-500 shrink-0" /><p className="text-green-400 text-sm">{success}</p></motion.div>}
          </AnimatePresence>

          {/* LIST */}
          {view === 'list' && (<div className="space-y-6">
            <div className="text-center relative"><div className="absolute -top-8 left-1/2 -translate-x-1/2 w-60 h-60 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" /><motion.span animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 3, repeat: Infinity }} className="text-5xl mb-3 block relative z-10">🌍</motion.span><h2 className="text-4xl font-black text-white uppercase tracking-tight relative z-10">SPOŁECZNOŚĆ</h2><p className="text-white/40 text-sm mt-2 relative z-10">Eventy tworzone przez graczy</p></div>
            <div className="flex gap-2"><div className="flex-1 relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" /><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchEvent()} placeholder="Szukaj po nazwie lub kodzie..." className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white text-sm placeholder:text-white/20 focus:border-white/30 focus:outline-none" /></div><button onClick={searchEvent} disabled={loading} className={`px-4 ${theme.primary} ${theme.hover} text-white rounded-xl font-bold text-sm transition-all`}>{loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}</button></div>
            <div className="grid grid-cols-2 gap-3"><motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { setView('create_step1'); setError(null); }} className={`${theme.primary} ${theme.hover} text-white py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg`}><Plus size={18} /> STWÓRZ EVENT</motion.button><motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { fetchMyEvents(); setView('my_events'); }} className="bg-white/10 border border-white/10 text-white py-4 rounded-2xl font-bold text-sm hover:bg-white/20 transition-all flex items-center justify-center gap-2"><Users size={18} /> MOJE EVENTY</motion.button></div>
            {isAdmin && <button onClick={() => { fetchPendingEvents(); setView('admin'); }} className="w-full bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 text-red-400 py-3 rounded-xl font-bold text-sm hover:bg-red-500/30 transition-all flex items-center justify-center gap-2"><Shield size={16} /> PANEL ADMINA {pendingEvents.length > 0 && <span className="bg-red-500 text-white text-[8px] font-black w-5 h-5 rounded-full flex items-center justify-center">{pendingEvents.length}</span>}</button>}
            <div className="flex gap-2"><button onClick={() => setSortBy('newest')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${sortBy === 'newest' ? `${theme.primary} text-white` : 'bg-white/5 text-white/40 hover:bg-white/10'}`}><Clock size={14} /> Najnowsze</button><button onClick={() => setSortBy('popular')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${sortBy === 'popular' ? `${theme.primary} text-white` : 'bg-white/5 text-white/40 hover:bg-white/10'}`}><TrendingUp size={14} /> Popularne</button><button onClick={() => setSortBy('liked')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${sortBy === 'liked' ? `${theme.primary} text-white` : 'bg-white/5 text-white/40 hover:bg-white/10'}`}><ThumbsUp size={14} /> Likowane</button></div>
            <div className="flex gap-2 flex-wrap">{(['all', 'new', 'started', 'done'] as const).map(f => (<button key={f} onClick={() => setStatusFilter(f)} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${statusFilter === f ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-white/5 text-white/30 hover:bg-white/10 border border-white/5'}`}>{f === 'all' ? 'Wszystkie' : f === 'done' ? '✅ Ukończone' : f === 'started' ? '⏳ Zaczęte' : '🆕 Nowe'}</button>))}</div>
            <div className="flex gap-2 flex-wrap">{(['all', 'music', 'cartoon', 'game', 'other'] as const).map(c => (<button key={c} onClick={() => setCategoryFilter(c)} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${categoryFilter === c ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-white/5 text-white/30 hover:bg-white/10 border border-white/5'}`}>{c === 'all' ? '🎵 Wszystkie' : CATEGORY_LABELS[c]?.emoji + ' ' + CATEGORY_LABELS[c]?.label}</button>))}</div>
            <div><h3 className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-3">Aktywne eventy</h3>
              {sortedEvents.length === 0 ? <div className="text-center py-10 bg-white/[0.02] rounded-2xl border border-white/5"><span className="text-4xl mb-2 block">🌱</span><p className="text-white/30 font-bold">Brak aktywnych eventów</p></div> : <div className="space-y-3">{sortedEvents.map(ev => {
                const { played: evPlayedCount, won: evWonCount, total: evTotalCount, completed: evIsCompleted } = getEventProgress(ev);
                return (
                <motion.button key={ev.id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={() => openDetail(ev)} className={`w-full relative bg-gradient-to-r ${evIsCompleted ? 'from-green-500/10 to-emerald-500/10 border-green-500/20 hover:border-green-500/40' : 'from-indigo-500/10 to-purple-500/10 border-indigo-500/20 hover:border-indigo-500/40'} border rounded-2xl p-5 text-left transition-all group`}>
                  <div className="flex items-center gap-4"><span className="text-3xl">{CATEGORY_LABELS[ev.category]?.emoji || '🎵'}</span>
                    <div className="flex-1 min-w-0"><p className="text-white font-black text-lg">{ev.title}</p><p className="text-white/40 text-xs mt-0.5 line-clamp-1">{ev.description}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-[9px] bg-white/10 text-white/50 px-2 py-0.5 rounded-full">{CATEGORY_LABELS[ev.category]?.label}</span>
                        <button onClick={(e) => { e.stopPropagation(); openCreatorProfile(ev.creator_id, ev.creator_nickname); }} className="text-[9px] text-white/30 hover:text-white underline transition-colors">by {ev.creator_nickname}</button>
                        <span className="text-[9px] text-white/20">{new Date(ev.created_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        {ev.play_count > 0 && <span className="text-[10px] text-white/40 flex items-center gap-1">👁 {ev.play_count} zagrań</span>}
                        <span className="text-[9px] text-green-400/60">👍{ev.likes || 0}</span>
                        <span className="text-[9px] text-red-400/60">👎{ev.dislikes || 0}</span>
                        <button onClick={(e) => { e.stopPropagation(); copyCode(ev.code); }} className="text-[9px] text-white/15 font-mono hover:text-white/40 transition-colors" title="Kopiuj kod">{codeCopied ? '✓' : ev.code}</button>
                      </div>
                    </div><ChevronRight size={18} className="text-white/20 group-hover:text-white/50 shrink-0" /></div>
                    {evTotalCount > 0 && <div className={`absolute top-3 right-3 text-[10px] font-black px-2.5 py-1 rounded-full border ${evIsCompleted ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>{evPlayedCount}/{evTotalCount}</div>}
                    {evPlayedCount > 0 && !evIsCompleted && (() => { const pct = evPlayedCount > 0 ? Math.round((evWonCount / evPlayedCount) * 100) : 0; return <div className="mt-2 text-[8px] text-yellow-400/60 font-bold">{evWonCount}W {evPlayedCount - evWonCount}L • {pct}%</div>; })()}
                    {evIsCompleted && (() => { const lostCount = evPlayedCount - evWonCount; const pct = evTotalCount > 0 ? Math.round((evWonCount / evTotalCount) * 100) : 0; return <div className="flex items-center gap-2 mt-2"><span className="bg-green-500/20 text-green-400 text-[8px] font-black px-2.5 py-1 rounded-full border border-green-500/30">✅ Ukończony</span><span className="text-[8px] text-green-400/70 font-bold">{evWonCount}W {lostCount}L • {pct}%</span></div>; })()}
                </motion.button>);})}</div>}
            </div>
          </div>)}

          {/* CREATE STEP 1 */}
          {view === 'create_step1' && (<div className="space-y-6"><div className="text-center"><span className="text-4xl mb-2 block">✨</span><h2 className="text-3xl font-black text-white">STWÓRZ EVENT</h2><p className="text-white/40 text-sm mt-1">Krok 1/2 — Informacje</p></div><div className="space-y-4"><div><label className="text-white/40 text-[10px] font-bold uppercase tracking-widest block mb-2">Tytuł *</label><input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value.slice(0, 50))} placeholder="np. Hity lat 90." maxLength={50} className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-white/20 focus:border-white/30 focus:outline-none" /><p className="text-white/20 text-[9px] mt-1 text-right">{formTitle.length}/50</p></div><div><label className="text-white/40 text-[10px] font-bold uppercase tracking-widest block mb-2">Opis</label><textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value.slice(0, 200))} placeholder="Krótki opis..." maxLength={200} rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-white/20 focus:border-white/30 focus:outline-none resize-none" /><p className="text-white/20 text-[9px] mt-1 text-right">{formDesc.length}/200</p></div><div><label className="text-white/40 text-[10px] font-bold uppercase tracking-widest block mb-2">Kategoria *</label><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{(Object.entries(CATEGORY_LABELS) as [EventCategory, { label: string; emoji: string }][]).map(([key, val]) => (<button key={key} onClick={() => setFormCategory(key)} className={`p-3 rounded-xl border text-center transition-all ${formCategory === key ? `${theme.primary} border-white/20 text-white` : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'}`}><span className="text-xl block mb-1">{val.emoji}</span><span className="text-xs font-bold">{val.label}</span></button>))}</div></div></div><button onClick={() => { if (validateStep1()) setView('create_step2'); }} className={`w-full ${theme.primary} ${theme.hover} text-white py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-2`}>DALEJ <ChevronRight size={20} /></button></div>)}

          {/* CREATE STEP 2 */}
          {view === 'create_step2' && (<div className="space-y-6"><div className="text-center"><span className="text-4xl mb-2 block">🎵</span><h2 className="text-3xl font-black text-white">DODAJ PIOSENKI</h2><p className="text-white/40 text-sm mt-1">Krok 2/2 — Min. 5, max. 31</p></div><div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">{formSongs.map((song, idx) => (<div key={idx} className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-3"><div className="flex items-center justify-between"><span className="text-white font-black text-sm">#{idx + 1}</span>{formSongs.length > 1 && <button onClick={() => removeSong(idx)} className="text-red-400/50 hover:text-red-400"><Trash2 size={14} /></button>}</div><div className={`grid grid-cols-1 ${formCategory === 'music' ? 'sm:grid-cols-2' : ''} gap-3`}><input type="text" value={song.title} onChange={(e) => updateSong(idx, 'title', e.target.value.slice(0, 100))} placeholder={formCategory === 'music' ? "Tytuł piosenki *" : formCategory === 'cartoon' ? "Nazwa bajki *" : formCategory === 'game' ? "Nazwa gry *" : "Tytuł *"} className="bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-white text-sm placeholder:text-white/20 focus:border-white/30 focus:outline-none" />{formCategory === 'music' && <input type="text" value={song.artist} onChange={(e) => updateSong(idx, 'artist', e.target.value.slice(0, 100))} placeholder="Wykonawca * (wielu po przecinku)" className="bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-white text-sm placeholder:text-white/20 focus:border-white/30 focus:outline-none" />}</div><div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><input type="text" value={song.youtube_url} onChange={(e) => updateSong(idx, 'youtube_url', e.target.value)} placeholder="Link YouTube *" className={`sm:col-span-2 bg-white/5 border rounded-lg py-2.5 px-3 text-white text-sm placeholder:text-white/20 focus:outline-none ${song.youtube_url && !isValidYouTubeUrl(song.youtube_url) ? 'border-red-500/50' : 'border-white/10'}`} /><div><input type="number" value={song.start_time_seconds} onChange={(e) => updateSong(idx, 'start_time_seconds', Math.max(0, parseInt(e.target.value) || 0))} placeholder="Sekunda" className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-white text-sm placeholder:text-white/20 focus:border-white/30 focus:outline-none" min={0} /><p className="text-white/15 text-[8px] mt-0.5">Sekunda od której leci fragment</p></div></div><input type="date" value={song.date} onChange={(e) => updateSong(idx, 'date', e.target.value)} className="bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-white text-sm focus:border-white/30 focus:outline-none w-full sm:w-auto" /></div>))}</div><button onClick={addSong} disabled={formSongs.length >= 31} className="w-full bg-white/5 border border-dashed border-white/20 text-white/40 py-3 rounded-xl font-bold text-sm hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-30"><Plus size={16} /> Dodaj ({formSongs.length}/31)</button><button onClick={submitEvent} disabled={loading || formSongs.length < 5} className={`w-full ${theme.primary} ${theme.hover} text-white py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50`}>{loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}{loading ? 'WYSYŁANIE...' : 'ZGŁOŚ DO WERYFIKACJI'}</button>{error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2"><AlertCircle size={16} className="text-red-500 shrink-0" /><p className="text-red-400 text-sm">{error}</p></div>}</div>)}

          {/* MY EVENTS */}
          {view === 'my_events' && (<div className="space-y-6"><div className="text-center"><h2 className="text-3xl font-black text-white">MOJE EVENTY</h2></div>{myEvents.length === 0 ? <div className="text-center py-10"><span className="text-4xl mb-2 block">📭</span><p className="text-white/30">Brak eventów</p></div> : <div className="space-y-3">{myEvents.map(ev => (<div key={ev.id} className="bg-white/[0.03] border border-white/10 rounded-2xl p-4"><div className="flex items-center justify-between mb-2"><h3 className="text-white font-bold">{ev.title}</h3><span className={`text-[9px] font-bold px-2.5 py-1 rounded-full border ${STATUS_LABELS[ev.status]?.color}`}>{STATUS_LABELS[ev.status]?.label}</span></div><p className="text-white/40 text-xs">{ev.description}</p><div className="flex items-center gap-3 mt-3"><span className="text-white/20 text-[9px]">{new Date(ev.created_at).toLocaleDateString('pl-PL')}</span>{ev.code && <button onClick={() => copyCode(ev.code)} className="flex items-center gap-1 text-[9px] text-white/30 hover:text-white transition-colors"><Link2 size={10} />{ev.code}</button>}
              {(ev.status === 'active' || ev.status === 'approved') && <button onClick={async () => { setExtendingEvent(ev); setExtendSongs([{ title: '', artist: '', youtube_url: '', audio_url: '', start_time_seconds: 1, date: '' }]); setShowExistingSongs(false); try { const { data: songs } = await supabase.from('community_event_songs').select('*').eq('event_id', ev.id).order('order_index'); setExistingSongsList(songs || []); setExistingSongsCount(songs?.length || 0); } catch { setExistingSongsList([]); setExistingSongsCount(0); } setView('my_event_extend'); }} className="flex items-center gap-1 text-[9px] text-indigo-400 hover:text-indigo-300 font-bold transition-colors"><Plus size={10} />Dodaj piosenki</button>}
            </div></div>))}</div>}</div>)}

          {/* EXTEND MY EVENT */}
          {view === 'my_event_extend' && extendingEvent && (<div className="space-y-6">
            <div className="text-center"><span className="text-4xl mb-2 block">➕</span><h2 className="text-3xl font-black text-white">DODAJ PIOSENKI</h2><p className="text-white/40 text-sm mt-1">Kontynuacja eventu: <span className="text-white font-bold">{extendingEvent.title}</span></p><p className="text-white/20 text-[9px] mt-1">Piosenek w evencie: <span className="text-white font-bold">{existingSongsCount + extendSongs.filter(s => sanitizeText(s.title).trim()).length}</span>/31 • Nie możesz zmienić istniejących</p></div>
            {/* Existing songs preview */}
            {existingSongsList.length > 0 && (
              <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
                <button onClick={() => setShowExistingSongs(!showExistingSongs)} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/5 transition-all">
                  <Music size={14} className="text-white/30" />
                  <span className="text-white/40 text-xs font-bold uppercase tracking-widest flex-1 text-left">Istniejące piosenki ({existingSongsCount})</span>
                  <ChevronRight size={14} className={`text-white/20 transition-transform ${showExistingSongs ? 'rotate-90' : ''}`} />
                </button>
                {showExistingSongs && (
                  <div className="px-3 pb-3 space-y-1 max-h-48 overflow-y-auto">
                    {existingSongsList.map((s, i) => (
                      <div key={s.id} className="flex items-center gap-2 bg-white/5 rounded-lg px-2.5 py-1.5">
                        <span className="text-white/20 text-[9px] w-5 shrink-0">#{i + 1}</span>
                        <div className="flex-1 min-w-0"><p className="text-white/60 text-[10px] font-bold truncate">{s.title}</p><p className="text-white/30 text-[8px] truncate">{s.artist}{s.date ? ` • ${s.date}` : ''}</p></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">{extendSongs.map((song, idx) => (<div key={idx} className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-3"><div className="flex items-center justify-between"><span className="text-white font-black text-sm">#{existingSongsCount + idx + 1}</span>{extendSongs.length > 1 && <button onClick={() => setExtendSongs(extendSongs.filter((_, i) => i !== idx))} className="text-red-400/50 hover:text-red-400"><Trash2 size={14} /></button>}</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><input type="text" value={song.title} onChange={(e) => { const ns = [...extendSongs]; ns[idx] = { ...ns[idx], title: e.target.value.slice(0, 100) }; setExtendSongs(ns); }} placeholder="Tytuł *" className="bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-white text-sm placeholder:text-white/20 focus:outline-none" /><input type="text" value={song.artist} onChange={(e) => { const ns = [...extendSongs]; ns[idx] = { ...ns[idx], artist: e.target.value.slice(0, 100) }; setExtendSongs(ns); }} placeholder="Wykonawca" className="bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-white text-sm placeholder:text-white/20 focus:outline-none" /></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><input type="text" value={song.youtube_url} onChange={(e) => { const ns = [...extendSongs]; ns[idx] = { ...ns[idx], youtube_url: e.target.value }; setExtendSongs(ns); }} placeholder="Link YouTube *" className="sm:col-span-2 bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-white text-sm placeholder:text-white/20 focus:outline-none" /><input type="number" value={song.start_time_seconds} onChange={(e) => { const ns = [...extendSongs]; ns[idx] = { ...ns[idx], start_time_seconds: Math.max(0, parseInt(e.target.value) || 0) }; setExtendSongs(ns); }} placeholder="Sekunda" min={0} className="bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-white text-sm placeholder:text-white/20 focus:outline-none" /></div><input type="date" value={song.date} onChange={(e) => { const ns = [...extendSongs]; ns[idx] = { ...ns[idx], date: e.target.value }; setExtendSongs(ns); }} className="bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-white text-sm focus:outline-none w-full sm:w-auto" /></div>))}</div>
            <button onClick={() => { if (extendSongs.length >= 20) return; setExtendSongs([...extendSongs, { title: '', artist: '', youtube_url: '', audio_url: '', start_time_seconds: 1, date: '' }]); }} disabled={extendSongs.length >= 20} className="w-full bg-white/5 border border-dashed border-white/20 text-white/40 py-3 rounded-xl font-bold text-sm hover:bg-white/10 flex items-center justify-center gap-2 disabled:opacity-30"><Plus size={16} /> Dodaj ({extendSongs.length})</button>
            <button onClick={async () => {
              const validSongs = extendSongs.filter(s => sanitizeText(s.title).trim() && isValidYouTubeUrl(s.youtube_url));
              if (validSongs.length === 0) { setError('Dodaj min. 1 poprawną piosenkę'); return; }
              // Check for duplicates against existing songs
              const existingTitles = new Set(existingSongsList.map(s => sanitizeText(s.title).toLowerCase()));
              const existingUrls = new Set(existingSongsList.map(s => s.youtube_url.trim()));
              const existingDates = new Set(existingSongsList.map(s => s.date).filter(Boolean));
              for (let i = 0; i < validSongs.length; i++) {
                const s = validSongs[i];
                if (existingTitles.has(sanitizeText(s.title).toLowerCase())) { setError(`"${s.title}" — tytuł już istnieje w evencie!`); return; }
                if (existingUrls.has(s.youtube_url.trim())) { setError(`Piosenka #${i + 1} — link YouTube już istnieje w evencie!`); return; }
                if (s.date && existingDates.has(s.date)) { setError(`Data ${s.date} jest już zajęta w evencie!`); return; }
              }
              if (existingSongsCount + validSongs.length > 31) { setError(`Za dużo piosenek! Max 31, masz ${existingSongsCount}, dodajesz ${validSongs.length}`); return; }
              setLoading(true); setError(null);
              try {
                const songs = validSongs.map((s, i) => ({ event_id: extendingEvent.id, title: sanitizeText(s.title).slice(0, 100), artist: sanitizeText(s.artist).slice(0, 100), youtube_url: s.youtube_url.trim(), audio_url: s.audio_url?.trim() || null, start_time_seconds: Math.max(0, Math.floor(s.start_time_seconds)), order_index: existingSongsCount + i + 1, date: s.date || null }));
                await supabase.from('community_event_songs').insert(songs);
                // Mark event for re-review
                await supabase.from('community_events').update({ status: 'pending_review' }).eq('id', extendingEvent.id);
                setSuccess(`Dodano ${validSongs.length} piosenek! Event czeka na ponowną weryfikację.`);
                fetchMyEvents(); setTimeout(() => { setSuccess(null); setView('my_events'); }, 3000);
              } catch (e: any) { setError(e.message); }
              setLoading(false);
            }} disabled={loading} className={`w-full ${theme.primary} ${theme.hover} text-white py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50`}>{loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}{loading ? 'WYSYŁANIE...' : 'ZGŁOŚ KONTYNUACJĘ'}</button>
            {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2"><AlertCircle size={16} className="text-red-500 shrink-0" /><p className="text-red-400 text-sm">{error}</p></div>}
          </div>)}

          {/* ADMIN */}
          {view === 'admin' && isAdmin && (<div className="space-y-6"><div className="text-center"><Shield size={40} className="mx-auto mb-2 text-red-400" /><h2 className="text-3xl font-black text-white">PANEL ADMINA</h2></div>{pendingEvents.length === 0 ? <div className="text-center py-10"><span className="text-4xl mb-2 block">✅</span><p className="text-white/30">Brak do weryfikacji</p></div> : <div className="space-y-3">{pendingEvents.map(ev => (<button key={ev.id} onClick={() => openDetail(ev)} className="w-full bg-white/[0.03] border border-white/10 hover:border-white/20 rounded-2xl p-4 text-left transition-all"><div className="flex items-center justify-between mb-1"><div className="flex items-center gap-2"><h3 className="text-white font-bold">{ev.title}</h3>{ev.activated_at && <span className="text-[8px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-bold border border-orange-500/30">KONTYNUACJA</span>}</div><span className={`text-[9px] font-bold px-2.5 py-1 rounded-full border ${STATUS_LABELS[ev.status]?.color}`}>{STATUS_LABELS[ev.status]?.label}</span></div><p className="text-white/40 text-xs">{ev.description}</p><div className="flex items-center gap-3 mt-2"><span className="text-white/20 text-[9px]">by {ev.creator_nickname}</span><span className="text-white/20 text-[9px]">{CATEGORY_LABELS[ev.category]?.emoji} {CATEGORY_LABELS[ev.category]?.label}</span></div></button>))}</div>}</div>)}

          {/* ADMIN DETAIL */}
          {view === 'admin_detail' && detailEvent && isAdmin && (<div className="space-y-6">
            <div className="text-center"><span className="text-4xl mb-2 block">{CATEGORY_LABELS[detailEvent.category]?.emoji}</span><h2 className="text-2xl font-black text-white">{detailEvent.title}</h2><p className="text-white/40 text-sm mt-1">{detailEvent.description}</p><p className="text-white/20 text-[9px] mt-2">Autor: {detailEvent.creator_nickname} • {CATEGORY_LABELS[detailEvent.category]?.label} • Kod: {detailEvent.code}</p></div>
            <div className="space-y-2"><p className="text-white/30 text-[10px] uppercase font-bold tracking-widest">{detailSongs.length} piosenek</p>
              {detailSongs.map((song, i) => (<div key={song.id} className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
                {editingSongId === song.id ? (
                  <div className="space-y-2">
                    <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Tytuł" className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-sm focus:outline-none" />
                    <input type="text" value={editArtist} onChange={(e) => setEditArtist(e.target.value)} placeholder="Wykonawca" className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-sm focus:outline-none" />
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="text-white/30 text-[8px] uppercase font-bold">Data</label><input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-sm focus:outline-none" /></div>
                      <div><label className="text-white/30 text-[8px] uppercase font-bold">Start (s)</label><input type="number" value={editStartTime} onChange={(e) => setEditStartTime(Math.max(0, parseInt(e.target.value) || 0))} min={0} className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-sm focus:outline-none" /></div>
                    </div>
                    <button onClick={() => saveSongEdit(song.id)} disabled={loading} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"><Save size={12} /> Zapisz</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3"><span className="text-white/30 text-xs font-bold w-6">#{i+1}</span><div className="flex-1 min-w-0"><p className="text-white text-sm font-bold truncate">{song.title}</p><p className="text-white/40 text-[10px]">{song.artist} • Start: {song.start_time_seconds}s {song.date && `• ${song.date}`}</p></div>
                    <button onClick={() => { setEditingSongId(song.id); setEditTitle(song.title); setEditArtist(song.artist); setEditDate(song.date || ''); setEditStartTime(song.start_time_seconds || 0); }} className="text-white/20 hover:text-yellow-400 transition-colors"><Pencil size={14} /></button>
                    <button onClick={() => { const vid = extractYouTubeId(song.youtube_url); if (vid) { setPreviewVideoId(vid === previewVideoId ? null : vid); setPreviewStart(song.start_time_seconds); } }} className="text-white/30 hover:text-white transition-colors">{previewVideoId === extractYouTubeId(song.youtube_url) ? <Pause size={16} /> : <Play size={16} />}</button></div>
                )}
              </div>))}
            </div>
            {previewVideoId && <div className="bg-black rounded-xl overflow-hidden"><iframe width="100%" height="200" src={`https://www.youtube.com/embed/${previewVideoId}?autoplay=1&start=${_previewStart}`} allow="autoplay; encrypted-media" allowFullScreen className="w-full" /></div>}
            <div className="grid grid-cols-2 gap-3"><button onClick={() => adminAction(detailEvent.id, 'active')} disabled={loading} className="bg-green-600 hover:bg-green-500 text-white py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"><Check size={18} /> AKTYWUJ</button><button onClick={() => adminAction(detailEvent.id, 'rejected')} disabled={loading} className="bg-red-600 hover:bg-red-500 text-white py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"><XCircle size={18} /> ODRZUĆ</button></div>
          </div>)}

          {/* EVENT DETAIL */}
          {view === 'event_detail' && detailEvent && (<div className="space-y-6">
            <div className="text-center relative"><div className="absolute -top-4 left-1/2 -translate-x-1/2 w-40 h-40 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none" />
              <motion.span animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }} className="text-5xl mb-3 block relative z-10">{CATEGORY_LABELS[detailEvent.category]?.emoji}</motion.span>
              <h2 className="text-3xl font-black text-white uppercase relative z-10">{detailEvent.title}</h2>
              <p className="text-white/40 text-sm mt-2 relative z-10">{detailEvent.description}</p>
              <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
                <span className="bg-indigo-500/20 text-indigo-400 text-[9px] font-bold px-3 py-1 rounded-full border border-indigo-500/30">🌍 Społeczność</span>
                <button onClick={() => openCreatorProfile(detailEvent.creator_id, detailEvent.creator_nickname)} className="text-white/30 text-[9px] hover:text-white transition-colors underline">by {detailEvent.creator_nickname}</button>
                {detailEvent.play_count > 0 && <span className="text-white/30 text-[9px] flex items-center gap-1">👁 {detailEvent.play_count} zagrań</span>}
                {detailSongs.length > 0 && <span className="bg-white/10 text-white/50 text-[9px] font-bold px-2.5 py-0.5 rounded-full">{detailSongs.length} wyzwań</span>}
              </div>
              <div className="flex items-center justify-center gap-2 mt-3">
                <button onClick={() => copyCode(detailEvent.code)} className="flex items-center gap-1 text-[10px] bg-white/10 text-white/60 hover:text-white px-3 py-1.5 rounded-full transition-colors font-mono"><Copy size={10} /> {codeCopied ? 'Skopiowano!' : `Kod: ${detailEvent.code}`}</button>
                <button onClick={() => copyLink(detailEvent.code)} className="flex items-center gap-1 text-[10px] bg-white/10 text-white/60 hover:text-white px-3 py-1.5 rounded-full transition-colors"><Link2 size={10} /> Kopiuj link</button>
              </div>
              <div className="flex items-center justify-center gap-3 mt-4">
                <button onClick={() => voteEvent(detailEvent.id, 'like')} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border transition-all ${myVotes[detailEvent.id] === 'like' ? 'bg-green-500/20 border-green-500/30 text-green-400' : 'bg-white/5 border-white/10 text-white/40 hover:text-green-400 hover:border-green-500/30'}`}><ThumbsUp size={16} /> <span className="font-bold text-sm">{detailEvent.likes || 0}</span></button>
                <button onClick={() => voteEvent(detailEvent.id, 'dislike')} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border transition-all ${myVotes[detailEvent.id] === 'dislike' ? 'bg-red-500/20 border-red-500/30 text-red-400' : 'bg-white/5 border-white/10 text-white/40 hover:text-red-400 hover:border-red-500/30'}`}><ThumbsDown size={16} /> <span className="font-bold text-sm">{detailEvent.dislikes || 0}</span></button>
              </div>
            </div>
            {detailSongs.length === 0 ? <div className="text-center py-10"><p className="text-white/30">Brak wyzwań</p></div> : (<div className="space-y-4">
              <p className="text-white/30 text-[10px] uppercase font-bold tracking-widest text-center">{detailSongs.length} wyzwań • Kliknij aby zgadywać</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">{(() => { const now2 = new Date(); const off2 = now2.getTimezoneOffset(); const today2 = new Date(now2.getTime() - (off2*60*1000)).toISOString().split('T')[0]; let rawProg: any = {}; try { rawProg = JSON.parse(localStorage.getItem('mm_progress') || '{}'); } catch {} const progressDays: Record<string, any> = rawProg.completedDays || rawProg || {}; return detailSongs.map((song, i) => { const isFuture = song.date && song.date > today2; const isToday = song.date && song.date === today2; const dayKey = `event-community-${detailEvent.id}-${song.id}`; const saved = progressDays[dayKey]; return (<button key={song.id} disabled={!!isFuture || !onPlayEvent} onClick={() => { if (onPlayEvent && !isFuture) onPlayEvent(detailEvent, song, i + 1, detailSongs); }} className={`relative p-3 rounded-2xl border transition-all flex flex-col items-center group ${isFuture ? 'bg-white/[0.02] border-white/5 opacity-30' : saved?.status === 'won' ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/10 border-green-500/40' : saved?.status === 'lost' ? 'bg-gradient-to-br from-red-500/20 to-rose-500/10 border-red-500/40' : isToday ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border-indigo-500/50' : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'}`}>{isFuture && <span className="absolute top-1 right-1 text-white/20 text-[10px]">🔒</span>}{saved && !isFuture && <div className="absolute -top-1.5 -right-1.5 z-10">{saved.status === 'won' ? <span className="text-green-500 text-xs">✅</span> : saved.status === 'playing' ? <span className="text-yellow-500 text-xs">⏳</span> : <span className="text-red-500 text-xs">❌</span>}</div>}{isToday && !saved && <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[6px] font-black px-2 py-0.5 rounded-full uppercase z-20 animate-pulse">Dziś!</div>}{song.date && <span className="text-[7px] uppercase font-bold text-white/25">{song.date.split('-')[2]}.{song.date.split('-')[1]}</span>}<span className={`text-xl font-black leading-none mt-1 ${isToday && !saved ? 'text-indigo-400' : saved?.status === 'won' ? 'text-green-400' : 'text-white/30'} group-hover:scale-110 transition-transform`}>#{i+1}</span></button>); }); })()}</div>
              {onPlayEvent && detailEvent.status === 'active' && <button onClick={async () => { try { await supabase.from('community_events').update({ play_count: (detailEvent.play_count || 0) + 1 }).eq('id', detailEvent.id); } catch {} onPlayEvent(detailEvent, detailSongs[0], 1, detailSongs); }} className={`w-full ${theme.primary} ${theme.hover} text-white py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-2 shadow-lg`}><Music size={20} /> ZAGRAJ OD POCZĄTKU</button>}
            </div>)}
          </div>)}
        </div>
      </div>
      <AnimatePresence>{creatorProfile && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setCreatorProfile(null)}><motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="bg-slate-900 border border-white/10 w-full max-w-xs rounded-3xl p-6 shadow-2xl text-center relative"><button onClick={() => setCreatorProfile(null)} className="absolute right-4 top-4 text-white/40 hover:text-white"><X size={18} /></button><div className={`w-16 h-16 rounded-full ${theme.primary} flex items-center justify-center text-white text-2xl font-black mx-auto mb-3 shadow-lg`}>{creatorProfile.nickname.charAt(0).toUpperCase()}</div><h3 className="text-xl font-black text-white uppercase">{creatorProfile.nickname}</h3><div className="grid grid-cols-3 gap-2 mt-4"><div className="bg-white/5 rounded-xl p-2 text-center"><p className="text-lg font-black text-white">{creatorProfile.total_games}</p><p className="text-[8px] text-white/40 uppercase font-bold">Gier</p></div><div className="bg-white/5 rounded-xl p-2 text-center"><p className="text-lg font-black text-green-400">{creatorProfile.wins}</p><p className="text-[8px] text-white/40 uppercase font-bold">Wygranych</p></div><div className="bg-white/5 rounded-xl p-2 text-center"><p className="text-lg font-black text-yellow-400">{creatorProfile.points.toLocaleString()}</p><p className="text-[8px] text-white/40 uppercase font-bold">Punkty</p></div></div></motion.div></motion.div>)}</AnimatePresence>
    </motion.div>
  );
};

export default CommunityEvents;
