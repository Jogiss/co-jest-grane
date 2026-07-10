import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export { supabase };

export interface PlaylistVideo {
  videoId: string;
  title: string;
  thumbnail?: string;
}

export interface PlayerData {
  id: string;
  nickname: string;
  answer: string | null;
  answer_time: string | null;
  score: number;
}

export interface Room {
  id: string;
  code: string;
  host_id: string;
  host_nickname: string;
  guest_id: string | null;
  guest_nickname: string | null;
  status: 'waiting' | 'playing' | 'round_end' | 'finished';
  playlist_url: string | null;
  playlist_videos: PlaylistVideo[];
  current_round: number;
  total_rounds: number;
  current_video_id: string | null;
  current_video_title: string | null;
  round_start_time: string | null;
  host_score: number;
  guest_score: number;
  host_answer: string | null;
  guest_answer: string | null;
  host_answer_time: string | null;
  guest_answer_time: string | null;
  round_winner: string | null;
  settings: { playDuration: number; maxRounds: number; startSeconds: number; };
  game_type: '1v1' | 'group';
  players: PlayerData[];
  max_players: number;
  created_at: string;
  updated_at: string;
}

function safeJsonParse(val: any, fallback: any) {
  if (Array.isArray(val) || (val && typeof val === 'object')) return val;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return fallback; } }
  return fallback;
}

function sanitizeRoom(raw: any): Room {
  return {
    ...raw,
    playlist_videos: safeJsonParse(raw.playlist_videos, []),
    settings: safeJsonParse(raw.settings, { playDuration: 30, maxRounds: 5, startSeconds: 30 }),
    players: safeJsonParse(raw.players, []),
    host_score: raw.host_score ?? 0,
    guest_score: raw.guest_score ?? 0,
    current_round: raw.current_round ?? 0,
    total_rounds: raw.total_rounds ?? 5,
    game_type: raw.game_type || '1v1',
    max_players: raw.max_players || 2,
  };
}

function extractPlaylistId(url: string): string | null {
  try { return new URL(url).searchParams.get('list'); } catch { const m = url.match(/[?&]list=([^&]+)/); return m ? m[1] : null; }
}

function generateRoomCode(): string {
  return Array.from({ length: 6 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 30)]).join('');
}

export function useMultiplayer(userId: string, nickname: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [isHostOverride, setIsHost] = useState(false);
  const isHost = room ? room.host_id === userId : isHostOverride;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchRoom = useCallback(async (roomId: string) => {
    try {
      const { data } = await supabase.from('multiplayer_rooms').select('*').eq('id', roomId).single();
      if (data) setRoom(sanitizeRoom(data));
    } catch (e) { console.error('Fetch room error:', e); }
  }, []);

  const subscribeToRoom = useCallback((roomId: string) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'multiplayer_rooms', filter: `id=eq.${roomId}` },
        async (payload) => {
          if (payload.eventType === 'DELETE') { setRoom(null); setError('Pokój został zamknięty'); }
          else { await fetchRoom(roomId); }
        }
      ).subscribe();
    channelRef.current = channel;
  }, [fetchRoom]);

  const fetchPlaylist = async (playlistId: string): Promise<PlaylistVideo[] | null> => {
    setLoadingPlaylist(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/youtube-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ action: 'get_playlist', playlistId }),
      });
      const data = await res.json();
      setLoadingPlaylist(false);
      if (data.error) { setError(`Błąd playlisty: ${data.error}`); return null; }
      return data.videos || [];
    } catch (e: any) { setError(e.message); setLoadingPlaylist(false); return null; }
  };

  const createRoom = async (playlistUrl: string, settings?: any): Promise<string | null> => {
    setLoading(true); setError(null);
    try {
      const multiUrls: string[] = settings?.multiPlaylists || [playlistUrl];
      let allVideos: PlaylistVideo[] = [];

      for (const url of multiUrls) {
        const pid = extractPlaylistId(url);
        if (!pid) continue;
        const vids = await fetchPlaylist(pid);
        if (vids) allVideos.push(...vids);
      }

      if (allVideos.length < 3) { setError('Min. 3 filmy w playlistach'); setLoading(false); return null; }

      const seen = new Set<string>();
      allVideos = allVideos.filter(v => { if (seen.has(v.videoId)) return false; seen.add(v.videoId); return true; });

      const code = generateRoomCode();
      const gameType = settings?.gameType || '1v1';
      const maxPlayers = gameType === 'group' ? (settings?.maxPlayers || 10) : 2;
      const roomSettings = {
        playDuration: settings?.playDuration || 30,
        maxRounds: Math.min(settings?.maxRounds || 5, allVideos.length),
        startSeconds: settings?.startSeconds || 30,
      };

      const hostPlayer: PlayerData = { id: userId, nickname, answer: null, answer_time: null, score: 0 };

      const { data, error: err } = await supabase.from('multiplayer_rooms').insert([{
        code, host_id: userId, host_nickname: nickname,
        playlist_url: playlistUrl, playlist_videos: allVideos,
        total_rounds: roomSettings.maxRounds, settings: roomSettings,
        game_type: gameType, max_players: maxPlayers,
        players: [hostPlayer],
      }]).select().single();

      if (err) { console.error(err); setError('Nie udało się utworzyć pokoju'); setLoading(false); return null; }
      setRoom(sanitizeRoom(data)); setIsHost(true); subscribeToRoom(data.id);
      setLoading(false); return code;
    } catch (e: any) { setError(e.message); setLoading(false); return null; }
  };

  const joinRoom = async (code: string): Promise<boolean> => {
    setLoading(true); setError(null);
    try {
      const { data } = await supabase.from('multiplayer_rooms').select('*').eq('code', code.toUpperCase().trim()).maybeSingle();
      if (!data) { setError('Pokój nie istnieje'); setLoading(false); return false; }
      if (data.status !== 'waiting') { setError('Gra już trwa'); setLoading(false); return false; }
      if (data.host_id === userId) { setError('To Twój pokój'); setLoading(false); return false; }

      const gameType = data.game_type || '1v1';
      const currentPlayers: PlayerData[] = Array.isArray(data.players) ? data.players : [];

      if (gameType === '1v1') {
        if (data.guest_id) { setError('Pokój jest pełny'); setLoading(false); return false; }
        const newPlayer: PlayerData = { id: userId, nickname, answer: null, answer_time: null, score: 0 };
        const updatedPlayers = [...currentPlayers.filter(p => p.id !== userId), newPlayer];
        const { error: err } = await supabase.from('multiplayer_rooms').update({
          guest_id: userId, guest_nickname: nickname, players: updatedPlayers,
        }).eq('id', data.id);
        if (err) { setError('Błąd dołączania'); setLoading(false); return false; }
        setRoom(sanitizeRoom({ ...data, guest_id: userId, guest_nickname: nickname, players: updatedPlayers }));
      } else {
        const maxPlayers = data.max_players || 10;
        if (currentPlayers.length >= maxPlayers) { setError('Pokój pełny'); setLoading(false); return false; }
        if (currentPlayers.some(p => p.id === userId)) { setError('Już jesteś w pokoju'); setLoading(false); return false; }
        const newPlayer: PlayerData = { id: userId, nickname, answer: null, answer_time: null, score: 0 };
        const updatedPlayers = [...currentPlayers, newPlayer];
        const { error: err } = await supabase.from('multiplayer_rooms').update({
          players: updatedPlayers, guest_id: userId, guest_nickname: nickname, updated_at: new Date().toISOString(),
        }).eq('id', data.id);
        if (err) { setError('Błąd dołączania'); setLoading(false); return false; }
        setRoom(sanitizeRoom({ ...data, players: updatedPlayers }));
      }

      setIsHost(false); subscribeToRoom(data.id);
      setLoading(false); return true;
    } catch (e: any) { setError(e.message); setLoading(false); return false; }
  };

  const startGame = async () => {
    if (!room || !isHost) return;
    const videos = room.playlist_videos || [];
    if (videos.length === 0) return;
    const shuffled = [...videos].sort(() => Math.random() - 0.5);
    const resetPlayers = (room.players || []).map(p => ({ ...p, answer: null, answer_time: null, score: 0 }));
    await supabase.from('multiplayer_rooms').update({
      status: 'playing', playlist_videos: shuffled,
      current_round: 1, current_video_id: shuffled[0].videoId,
      current_video_title: shuffled[0].title,
      round_start_time: new Date().toISOString(),
      host_answer: null, guest_answer: null,
      host_answer_time: null, guest_answer_time: null,
      host_score: 0, guest_score: 0,
      round_winner: null, players: resetPlayers,
    }).eq('id', room.id);
  };

  const submitAnswer = async (answer: string) => {
    if (!room || !answer.trim()) return;
    const now = new Date().toISOString();
    const isGroup = room.game_type === 'group';
    const updatedPlayers = (room.players || []).map(p =>
      p.id === userId ? { ...p, answer: answer.trim(), answer_time: now } : p
    );
    if (isGroup) {
      await supabase.from('multiplayer_rooms').update({ players: updatedPlayers }).eq('id', room.id);
    } else {
      const field = isHost ? 'host_answer' : 'guest_answer';
      const timeField = isHost ? 'host_answer_time' : 'guest_answer_time';
      await supabase.from('multiplayer_rooms').update({
        [field]: answer.trim(), [timeField]: now, players: updatedPlayers,
      }).eq('id', room.id);
    }
  };

  const nextRound = async () => {
    if (!room || !isHost) return;
    const nextNum = room.current_round + 1;
    if (nextNum > room.total_rounds) {
      await supabase.from('multiplayer_rooms').update({ status: 'finished' }).eq('id', room.id);
      return;
    }
    const videos = room.playlist_videos || [];
    const nextVideo = videos[nextNum - 1];
    if (!nextVideo) { await supabase.from('multiplayer_rooms').update({ status: 'finished' }).eq('id', room.id); return; }
    const resetPlayers = (room.players || []).map(p => ({ ...p, answer: null, answer_time: null }));
    await supabase.from('multiplayer_rooms').update({
      status: 'playing', current_round: nextNum,
      current_video_id: nextVideo.videoId, current_video_title: nextVideo.title,
      round_start_time: new Date().toISOString(),
      host_answer: null, guest_answer: null,
      host_answer_time: null, guest_answer_time: null,
      round_winner: null, players: resetPlayers,
    }).eq('id', room.id);
  };

  const leaveRoom = async () => {
    if (!room) return;
    try {
      if (isHost) {
        await supabase.from('multiplayer_rooms').delete().eq('id', room.id);
      } else if (room.game_type === 'group') {
        const updated = (room.players || []).filter(p => p.id !== userId);
        await supabase.from('multiplayer_rooms').update({ players: updated }).eq('id', room.id);
      } else {
        await supabase.from('multiplayer_rooms').update({
          guest_id: null, guest_nickname: null, status: 'waiting',
          current_round: 0, host_score: 0, guest_score: 0,
          players: (room.players || []).filter(p => p.id !== userId),
        }).eq('id', room.id);
      }
    } catch (e) { console.error('Leave error:', e); }
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    setRoom(null); setIsHost(false); setError(null);
  };

  const refreshRoom = useCallback(async () => {
    if (room?.id) await fetchRoom(room.id);
  }, [room?.id, fetchRoom]);

  const kickPlayer = async (playerId: string) => {
    if (!room || !isHost || room.game_type !== 'group') return;
    if (playerId === userId) return;
    const updated = (room.players || []).filter(p => p.id !== playerId);
    await supabase.from('multiplayer_rooms').update({ players: updated, updated_at: new Date().toISOString() }).eq('id', room.id);
  };

  const changeSettings = async (playlistUrl: string, settings?: any): Promise<boolean> => {
    if (!room || !isHost) return false;
    setLoading(true); setError(null);
    try {
      const playlistId = extractPlaylistId(playlistUrl);
      if (!playlistId) { setError('Nieprawidłowy link'); setLoading(false); return false; }
      const videos = await fetchPlaylist(playlistId);
      if (!videos || videos.length < 3) { setError('Min. 3 filmy'); setLoading(false); return false; }
      const roomSettings = {
        playDuration: settings?.playDuration || room.settings.playDuration || 30,
        maxRounds: Math.min(settings?.maxRounds || room.settings.maxRounds || 5, videos.length),
        startSeconds: settings?.startSeconds || 30,
      };
      const resetPlayers = (room.players || []).map(p => ({ ...p, answer: null, answer_time: null, score: 0 }));
      await supabase.from('multiplayer_rooms').update({
        playlist_url: playlistUrl, playlist_videos: videos,
        total_rounds: roomSettings.maxRounds, settings: roomSettings,
        status: 'waiting', current_round: 0, current_video_id: null, current_video_title: null,
        round_start_time: null, host_score: 0, guest_score: 0,
        host_answer: null, guest_answer: null, host_answer_time: null, guest_answer_time: null,
        round_winner: null, players: resetPlayers,
      }).eq('id', room.id);
      await fetchRoom(room.id);
      setLoading(false); return true;
    } catch (e: any) { setError(e.message); setLoading(false); return false; }
  };

  useEffect(() => { return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); }; }, []);

  return { room, isHost, error, loading, loadingPlaylist, createRoom, joinRoom, startGame, submitAnswer, nextRound, leaveRoom, setError, refreshRoom, changeSettings, kickPlayer };
}
