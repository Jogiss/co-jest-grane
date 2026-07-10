'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Copy, Play, Check, X, Crown, Clock, ArrowLeft, 
  Link2, Loader2, Volume2, Trophy, Zap, SkipForward,
  Music, AlertCircle, RefreshCw
} from 'lucide-react';
import { useMultiplayer, supabase } from '../hooks/useMultiplayer';
import { PREDEFINED_PLAYLISTS, PLAYLIST_CATEGORIES, type PlaylistCategory, getTitleVariants, cleanYouTubeTitle } from '../data/playlists';

interface MultiplayerModeProps {
  userId: string; nickname: string;
  theme: { primary: string; text: string; border: string; hover: string; gradient: string; };
  onClose: () => void;
}

type ViewState = 'menu' | 'create' | 'join' | 'lobby' | 'playing' | 'round_end' | 'results';

const MultiplayerMode: React.FC<MultiplayerModeProps> = ({ userId, nickname, theme, onClose }) => {
  const {
    room, isHost, error, loading, loadingPlaylist,
    createRoom, joinRoom, startGame, submitAnswer, nextRound, leaveRoom,
    setError, refreshRoom, changeSettings, kickPlayer,
  } = useMultiplayer(userId, nickname);

  const initialJoinCode = (() => { try { return new URLSearchParams(window.location.search).get('join')?.toUpperCase() || ''; } catch { return ''; } })();
  const [view, setView] = useState<ViewState>(initialJoinCode ? 'join' : 'menu');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [roomCode, setRoomCode] = useState(initialJoinCode);
  const [copied, setCopied] = useState(false);
  const [guess, setGuess] = useState('');
  const [answered, setAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ytReady, setYtReady] = useState(false);
  const [roundSettings, setRoundSettings] = useState({ rounds: 5, duration: 30, gameType: '1v1' as '1v1' | 'group', maxPlayers: 10 });
  const [selectedCategory, setSelectedCategory] = useState<PlaylistCategory>('all');
  const [createMode, setCreateMode] = useState<'predefined' | 'custom'>('predefined');
  const [autoScoringDone, setAutoScoringDone] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);
  const [volume, setVolume] = useState(80);
  const [codeRevealed, setCodeRevealed] = useState(false);
  const [lastRoundTitle, setLastRoundTitle] = useState<string | null>(null);
  const [selectedPlaylists, setSelectedPlaylists] = useState<string[]>([]);
  const [songsExpanded, setSongsExpanded] = useState(false);
  const guessRef = useRef('');
  const playerRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  const normalizeText = (text: string): string => {
    if (!text) return '';
    return text.toLowerCase().replace(/ą/g,'a').replace(/ć/g,'c').replace(/ę/g,'e').replace(/ł/g,'l').replace(/ń/g,'n').replace(/ó/g,'o').replace(/ś/g,'s').replace(/ź/g,'z').replace(/ż/g,'z').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim();
  };
  const getLD = (a: string, b: string): number => { const m = Array.from({length:a.length+1},()=>Array(b.length+1).fill(0)); for(let i=0;i<=a.length;i++)m[i][0]=i; for(let j=0;j<=b.length;j++)m[0][j]=j; for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){const c=a[i-1]===b[j-1]?0:1;m[i][j]=Math.min(m[i-1][j]+1,m[i][j-1]+1,m[i-1][j-1]+c);}return m[a.length][b.length]; };
  // Strict matching - guess must match the TARGET specifically, not be a substring of a longer combined string
  const matchSingle = (nG: string, nT: string): boolean => {
    if(!nG||!nT||nG.length<3||nT.length<3) return nG===nT;
    if(nG===nT) return true;
    // Only allow substring if guess covers most of target (>70%) - prevents "adele" matching "adele hello"
    if(nG.includes(nT) && nT.length >= nG.length * 0.5) return true;
    if(nT.includes(nG) && nG.length >= nT.length * 0.7) return true;
    // Word-by-word: target words must be found in guess words
    const tW=nT.split(' ').filter(w=>w.length>2), gW=nG.split(' ').filter(w=>w.length>2);
    if(tW.length>0&&gW.length>0){
      const matched=tW.filter(tw=>gW.some(gw=>gw===tw||getLD(gw,tw)<=1));
      if(matched.length>=Math.ceil(tW.length*0.7))return true;
    }
    // Fuzzy whole string - only if similar length
    if(Math.abs(nG.length-nT.length)<=2){const d=getLD(nG,nT);if(d<=Math.max(1,Math.floor(nT.length*0.15)))return true;}
    return false;
  };

  const scoreAnswer = useCallback((userGuess: string, correctTitle: string, answerTime: string|null, roundStartTime: string|null) => {
    const r = {points:0,gotTitle:false,gotArtist:false,timeBonus:0};
    if(!userGuess.trim()||!correctTitle||userGuess==='SKIP'||userGuess==='CZAS') return r;
    const nG = normalizeText(userGuess);
    if(nG.length<3) return r;
    const {titleParts,artistParts}=getTitleVariants(correctTitle);
    for(const p of titleParts){if(matchSingle(nG,normalizeText(p))){r.gotTitle=true;break;}}
    for(const p of artistParts){
      const nP=normalizeText(p);
      if(matchSingle(nG,nP)){r.gotArtist=true;break;}
      const subs=p.split(/[,&]/).map(a=>normalizeText(a.trim())).filter(a=>a.length>2);
      for(const s of subs){if(matchSingle(nG,s)){r.gotArtist=true;break;}}
      if(r.gotArtist)break;
    }
    // Combined check - guess contains both title words AND artist words
    if((!r.gotTitle||!r.gotArtist)&&titleParts.length>0&&artistParts.length>0){
      const gW=nG.split(' ').filter(w=>w.length>2);
      const tMatch=titleParts.some(tp=>{const tw=normalizeText(tp).split(' ').filter(w=>w.length>2);return tw.length>0&&tw.filter(t=>gW.some(g=>g===t||getLD(g,t)<=1)).length>=Math.max(1,Math.ceil(tw.length*0.5));});
      const aMatch=artistParts.some(ap=>{const aw=normalizeText(ap).split(' ').filter(w=>w.length>2);return aw.length>0&&aw.filter(a=>gW.some(g=>g===a||getLD(g,a)<=1)).length>=Math.max(1,Math.ceil(aw.length*0.5));});
      if(tMatch&&!r.gotTitle)r.gotTitle=true;
      if(aMatch&&!r.gotArtist)r.gotArtist=true;
    }
    if(r.gotTitle&&r.gotArtist)r.points=100;else if(r.gotTitle)r.points=50;else if(r.gotArtist)r.points=30;
    if(r.points>0&&answerTime&&roundStartTime){const el=(new Date(answerTime).getTime()-new Date(roundStartTime).getTime())/1000;r.timeBonus=Math.max(0,Math.round(50*(1-el/30)));r.points+=r.timeBonus;}
    return r;
  },[]);

  // YT
  useEffect(()=>{if(typeof window==='undefined')return;if(window.YT?.Player){setYtReady(true);return;}window.onYouTubeIframeAPIReady=()=>setYtReady(true);if(!document.querySelector('script[src*="youtube.com/iframe_api"]')){const t=document.createElement('script');t.src='https://www.youtube.com/iframe_api';document.head.appendChild(t);}},[]);

  // Room status sync
  useEffect(()=>{if(!room)return;if(room.status==='waiting'){if(room.guest_id||(room.game_type==='group'&&(room.players||[]).length>=1))setView('lobby');}else if(room.status==='playing'){if(view!=='playing'){stopAudio();destroyPlayer();setView('playing');setAnswered(false);setGuess('');setAutoScoringDone(false);setLastRoundTitle(null);startRoundTimer();setTimeout(()=>playAudio(),500);}}else if(room.status==='round_end'){setView('round_end');stopTimer();if(room.current_video_title&&!lastRoundTitle)setLastRoundTitle(room.current_video_title);}else if(room.status==='finished'){setView('results');stopTimer();destroyPlayer();}},[room?.status,room?.current_round,room?.guest_id,room?.players?.length]);
  useEffect(()=>{if(view!=='lobby'||!room?.id)return;const p=setInterval(()=>refreshRoom(),3000);return()=>clearInterval(p);},[view,room?.id,refreshRoom]);
  // Track my answer
  useEffect(()=>{if(!room)return;const my=room.game_type==='group'?(room.players||[]).find(p=>p.id===userId)?.answer:(isHost?room.host_answer:room.guest_answer);if(my&&!answered)setAnswered(true);},[room?.host_answer,room?.guest_answer,room?.players,isHost,userId]);

  const startRoundTimer = useCallback(()=>{stopTimer();setTimeLeft(Math.max(30,room?.settings?.playDuration||30));timerRef.current=setInterval(()=>{setTimeLeft(p=>{if(p<=1){stopTimer();return 0;}return p-1;});},1000);},[room?.settings?.playDuration]);
  const stopTimer = useCallback(()=>{if(timerRef.current){clearInterval(timerRef.current);timerRef.current=null;}},[]);
  const destroyPlayer = useCallback(()=>{if(playerRef.current){try{playerRef.current.destroy();}catch{}playerRef.current=null;}},[]);
  const stopAudio = useCallback(()=>{if(playerRef.current){try{playerRef.current.stopVideo();}catch{}}setIsPlaying(false);},[]);
  const playAudio = useCallback(()=>{if(!room?.current_video_id||!ytReady)return;destroyPlayer();setTimeout(()=>{if(!playerContainerRef.current)return;try{playerRef.current=new window.YT!.Player('yt-player-hidden',{height:'1',width:'1',videoId:room.current_video_id,playerVars:{autoplay:1,controls:0,start:room.settings.startSeconds||30,playsinline:1},events:{onReady:(e:any)=>{e.target.setVolume(volume);e.target.playVideo();setIsPlaying(true);},onError:()=>setIsPlaying(false)}});}catch{setIsPlaying(false);}},100);},[room?.current_video_id,room?.settings,ytReady,volume,destroyPlayer]);

  // Time up = auto submit
  useEffect(()=>{if(timeLeft===0&&view==='playing'&&!answered){submitAnswer(guessRef.current.trim()||'CZAS');setAnswered(true);stopAudio();}},[timeLeft,view,answered]);
  useEffect(()=>{return()=>{stopTimer();destroyPlayer();};},[]);

  // === AUTO SCORING ===
  const doScoring = useCallback(async()=>{
    if(!room||!isHost)return;
    const{data:fr}=await supabase.from('multiplayer_rooms').select('*').eq('id',room.id).single();
    if(!fr)return;
    const title=fr.current_video_title||'';const players=Array.isArray(fr.players)?fr.players:[];
    if((fr.game_type||'1v1')==='group'){
      const scored=players.map((p:any)=>{const pts=scoreAnswer(p.answer||'',title,p.answer_time,fr.round_start_time);return{...p,score:(p.score||0)+pts.points};});
      const rs=players.map((p:any)=>({id:p.id,rp:scoreAnswer(p.answer||'',title,p.answer_time,fr.round_start_time).points}));
      const best=rs.reduce((a:any,b:any)=>a.rp>b.rp?a:b,{id:'draw',rp:0});
      await supabase.from('multiplayer_rooms').update({status:'round_end',round_winner:best.rp>0?best.id:'draw',players:scored}).eq('id',room.id);
    }else{
      const hP=scoreAnswer(fr.host_answer||'',title,fr.host_answer_time,fr.round_start_time);
      const gP=scoreAnswer(fr.guest_answer||'',title,fr.guest_answer_time,fr.round_start_time);
      let w='draw';if(hP.points>gP.points)w='host';else if(gP.points>hP.points)w='guest';
      await supabase.from('multiplayer_rooms').update({status:'round_end',round_winner:w,host_score:(fr.host_score||0)+hP.points,guest_score:(fr.guest_score||0)+gP.points}).eq('id',room.id);
    }
  },[room,isHost,scoreAnswer]);

  useEffect(()=>{if(!room||!isHost||autoScoringDone||room.status!=='playing')return;let all=false;if(room.game_type==='group'){const p=room.players||[];all=p.length>=1&&p.every(x=>x.answer!==null);}else{all=!!(room.host_answer&&room.guest_answer);}if(!all)return;setAutoScoringDone(true);setTimeout(()=>doScoring(),1500);},[room?.host_answer,room?.guest_answer,room?.players,room?.status,isHost,autoScoringDone,doScoring]);
  useEffect(()=>{if(timeLeft!==0||!isHost||!room||room.status!=='playing'||autoScoringDone)return;const t=setTimeout(()=>{if(!autoScoringDone){setAutoScoringDone(true);doScoring();}},3000);return()=>clearTimeout(t);},[timeLeft,isHost,room?.status,autoScoringDone,doScoring]);

  const handleCreateRoom = async()=>{const urls=selectedPlaylists.length>0?selectedPlaylists:(playlistUrl.trim()?[playlistUrl.trim()]:[]);if(urls.length===0){setError('Wybierz playlistę lub wklej link');return;}if(editingSettings&&room){const ok=await changeSettings(urls[0],{maxRounds:roundSettings.rounds,playDuration:roundSettings.duration,multiPlaylists:urls.length>1?urls:undefined});if(ok){setEditingSettings(false);setView('lobby');}return;}const code=await createRoom(urls[0],{maxRounds:roundSettings.rounds,playDuration:roundSettings.duration,gameType:roundSettings.gameType,maxPlayers:roundSettings.maxPlayers,multiPlaylists:urls.length>1?urls:undefined});if(code){setRoomCode(code);setView('lobby');}};
  const handleJoinRoom = async()=>{if(roomCode.length!==6){setError('Kod musi mieć 6 znaków');return;}const s=await joinRoom(roomCode);if(s)setView('lobby');};
  const copyC = ()=>{navigator.clipboard.writeText(room?.code||roomCode);setCopied(true);setTimeout(()=>setCopied(false),2000);};
  const handleSubmit = ()=>{if(!guess.trim()||answered)return;submitAnswer(guess);setAnswered(true);stopAudio();};
  const handleLeave = async()=>{stopTimer();destroyPlayer();await leaveRoom();setView('menu');setPlaylistUrl('');setRoomCode('');};
  const handleClose = ()=>{handleLeave();onClose();};

  type PtsT = {points:number;gotTitle:boolean;gotArtist:boolean;timeBonus:number};
  const renderCard = (nick:string,answer:string|null,pts:PtsT,isW:boolean)=>(
    <div className={`p-3 rounded-xl border text-center ${isW?'bg-green-500/20 border-green-500/50':pts.points>0?'bg-yellow-500/10 border-yellow-500/30':'bg-white/5 border-white/10'}`}>
      <p className="text-white/40 text-[9px] truncate">{nick}</p>
      <p className="text-white font-bold text-xs truncate mb-1">{answer||'-'}</p>
      <p className={`text-lg font-black ${pts.points>0?(isW?'text-green-400':'text-yellow-400'):'text-white/20'}`}>+{pts.points}</p>
      <div className="mt-1 space-y-0.5">
        {pts.gotTitle&&pts.gotArtist&&<span className="text-green-400 text-[8px] block">🎯 Tytuł+Artysta</span>}
        {pts.gotTitle&&!pts.gotArtist&&<span className="text-green-400 text-[8px] block">🎵 Tytuł</span>}
        {!pts.gotTitle&&pts.gotArtist&&<span className="text-yellow-400 text-[8px] block">🎤 Artysta</span>}
        {pts.timeBonus>0&&<span className="text-cyan-400 text-[8px] block">⚡+{pts.timeBonus} czas</span>}
        {!pts.gotTitle&&!pts.gotArtist&&answer&&answer!=='SKIP'&&answer!=='CZAS'&&<span className="text-red-400/60 text-[8px] block">✗ Pudło</span>}
        {(answer==='SKIP'||answer==='CZAS')&&<span className="text-white/30 text-[8px] block">{answer==='CZAS'?'⏰':'⏭'}</span>}
      </div>
    </div>
  );

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-start md:items-center justify-center p-4 md:p-6 overflow-y-auto">
      <div ref={playerContainerRef} className="fixed -top-[9999px] -left-[9999px] w-1 h-1 overflow-hidden opacity-0 pointer-events-none" aria-hidden="true"><div id="yt-player-hidden"/></div>
      <div className="bg-slate-900 border border-white/10 w-full max-w-lg lg:max-w-2xl rounded-3xl p-6 lg:p-8 shadow-2xl relative my-4 md:my-0 max-h-[calc(100vh-2rem)] overflow-y-auto">
        <button onClick={handleClose} className="absolute right-4 top-4 text-white/40 hover:text-white z-10"><X size={24}/></button>
        <AnimatePresence mode="wait">

          {/* MENU */}
          {view==='menu'&&(<motion.div key="menu" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}} className="space-y-6">
            <div className="text-center"><div className={`w-20 h-20 lg:w-24 lg:h-24 rounded-full ${theme.primary} flex items-center justify-center mx-auto mb-4 shadow-lg`}><Users size={40} className="text-white lg:w-12 lg:h-12"/></div><h2 className="text-3xl lg:text-4xl font-black text-white">MULTIPLAYER</h2><p className="text-white/40 text-sm mt-1">Rywalizuj ze znajomymi</p></div>
            <div className="space-y-3"><button onClick={()=>setView('create')} className={`w-full ${theme.primary} ${theme.hover} text-white py-4 lg:py-5 rounded-2xl font-bold text-lg lg:text-xl transition-all flex items-center justify-center gap-3 shadow-lg`}><Crown size={24}/>UTWÓRZ POKÓJ</button><button onClick={()=>setView('join')} className="w-full bg-white/10 border border-white/10 text-white py-4 lg:py-5 rounded-2xl font-bold text-lg lg:text-xl hover:bg-white/20 transition-all flex items-center justify-center gap-3"><Users size={24}/>DOŁĄCZ DO POKOJU</button></div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4"><h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2"><Zap size={16} className={theme.text}/>Jak to działa?</h3><ul className="text-white/50 text-xs space-y-2"><li className="flex items-start gap-2"><span className="text-lg">1️⃣</span><span>Wybierz playlistę lub wklej własny link YouTube</span></li><li className="flex items-start gap-2"><span className="text-lg">2️⃣</span><span>Wyślij kod pokoju znajomemu</span></li><li className="flex items-start gap-2"><span className="text-lg">3️⃣</span><span>Słuchajcie fragmentu i zgadujcie tytuł</span></li><li className="flex items-start gap-2"><span className="text-lg">🏆</span><span>Punkty przyznawane automatycznie!</span></li></ul></div>
          </motion.div>)}

          {/* CREATE */}
          {view==='create'&&(<motion.div key="create" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}} className="space-y-5">
            <button onClick={()=>{if(editingSettings){setEditingSettings(false);setView('results');}else{setView('menu');}setError(null);}} className="flex items-center gap-2 text-white/40 hover:text-white transition-colors"><ArrowLeft size={16}/> Wstecz</button>
            <div className="text-center"><Crown size={40} className={`mx-auto mb-2 ${theme.text}`}/><h2 className="text-2xl font-black text-white">{editingSettings?'ZMIEŃ USTAWIENIA':'UTWÓRZ POKÓJ'}</h2><p className="text-white/40 text-sm mt-1">{editingSettings?'Zmień playlistę lub rundy':'Wybierz playlistę lub wklej własny link'}</p></div>
            <div className="flex bg-white/5 rounded-xl p-1 border border-white/10"><button onClick={()=>setCreateMode('predefined')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${createMode==='predefined'?`${theme.primary} text-white`:'text-white/50 hover:text-white'}`}>🎵 Gotowe playlisty</button><button onClick={()=>setCreateMode('custom')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${createMode==='custom'?`${theme.primary} text-white`:'text-white/50 hover:text-white'}`}>🔗 Własny link</button></div>
            {createMode==='predefined'&&(<div className="space-y-3"><div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">{PLAYLIST_CATEGORIES.map(cat=>(<button key={cat.id} onClick={()=>setSelectedCategory(cat.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${selectedCategory===cat.id?`${theme.primary} text-white`:'bg-white/5 text-white/40 hover:bg-white/10'}`}><span>{cat.emoji}</span><span>{cat.label}</span></button>))}</div><div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">{PREDEFINED_PLAYLISTS.filter(p=>selectedCategory==='all'||p.tags?.includes(selectedCategory)).map(pl=>(<button key={pl.id} disabled={pl.locked} onClick={()=>{if(pl.locked)return;setSelectedPlaylists(prev=>{const u=prev.includes(pl.url)?prev.filter(x=>x!==pl.url):[...prev,pl.url];setPlaylistUrl(u[0]||'');return u;});}} className={`w-full p-3 rounded-xl border transition-all text-left group ${pl.locked?'opacity-50 cursor-not-allowed bg-white/[0.02] border-white/5':selectedPlaylists.includes(pl.url)?`bg-gradient-to-r ${pl.color} border-white/30 scale-[1.02]`:'bg-white/5 border-white/10 hover:border-white/20 hover:scale-[1.02] active:scale-[0.98]'}`}><div className="flex items-center gap-3"><span className="text-2xl">{pl.locked?'🔒':pl.emoji}</span><div className="flex-1 min-w-0"><p className={`font-bold text-sm truncate ${pl.locked?'text-white/30':'text-white'}`}>{pl.name}{pl.beta&&<span className="ml-2 text-[8px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full font-bold">BETA</span>}</p><p className="text-white/40 text-[10px] truncate">{pl.locked?'Wkrótce!':pl.description}</p></div>{!pl.locked&&(selectedPlaylists.includes(pl.url)?<Check size={16} className="text-green-400 shrink-0"/>:<Play size={16} className="text-white/30 group-hover:text-white shrink-0"/>)}</div></button>))}</div>{selectedPlaylists.length>0&&<div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 flex items-center gap-2"><Check size={16} className="text-green-500"/><span className="text-green-400 text-xs font-bold">{selectedPlaylists.length===1?'Playlista wybrana!':`${selectedPlaylists.length} playlisty — mieszanka!`}</span></div>}</div>)}
            {createMode==='custom'&&(<div className="space-y-2"><div className="relative"><Link2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"/><input type="text" value={playlistUrl} onChange={e=>setPlaylistUrl(e.target.value)} placeholder="https://youtube.com/playlist?list=..." className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-white/20 focus:border-white/30 focus:outline-none text-sm" autoFocus/></div><p className="text-white/20 text-[10px]">Link do publicznej playlisty YouTube (min. 3 filmy)</p></div>)}
            {!editingSettings&&(<div><label className="text-white/40 text-[10px] font-bold uppercase tracking-widest block mb-1">Tryb gry</label><div className="flex gap-2"><button onClick={()=>setRoundSettings(s=>({...s,gameType:'1v1'}))} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${roundSettings.gameType==='1v1'?`${theme.primary} border-white/20 text-white`:'bg-white/5 border-white/10 text-white/50'}`}>⚔️ 1v1</button><button onClick={()=>setRoundSettings(s=>({...s,gameType:'group'}))} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${roundSettings.gameType==='group'?`${theme.primary} border-white/20 text-white`:'bg-white/5 border-white/10 text-white/50'}`}>👥 Grupowo</button></div>{roundSettings.gameType==='group'&&<p className="text-white/30 text-[9px] mt-2 text-center">👥 Do {roundSettings.maxPlayers} graczy w pokoju</p>}</div>)}
            <div className="grid grid-cols-2 gap-3"><div><label className="text-white/40 text-[10px] font-bold uppercase tracking-widest block mb-1">Liczba rund</label><select value={roundSettings.rounds} onChange={e=>setRoundSettings(s=>({...s,rounds:parseInt(e.target.value)}))} className="w-full bg-slate-800 border border-white/10 rounded-xl py-2.5 px-3 text-white text-sm focus:outline-none cursor-pointer">{[3,5,7,10,15].map(n=><option key={n} value={n}>{n} rund</option>)}</select></div><div><label className="text-white/40 text-[10px] font-bold uppercase tracking-widest block mb-1">Czas fragmentu</label><select value={roundSettings.duration} onChange={e=>setRoundSettings(s=>({...s,duration:parseInt(e.target.value)}))} className="w-full bg-slate-800 border border-white/10 rounded-xl py-2.5 px-3 text-white text-sm focus:outline-none cursor-pointer">{[5,10,15,20,30,45,60].map(n=><option key={n} value={n}>{n} sekund</option>)}</select></div></div>
            {error&&<div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2"><AlertCircle size={16} className="text-red-500 shrink-0"/><p className="text-red-400 text-sm">{error}</p></div>}
            <button onClick={handleCreateRoom} disabled={!playlistUrl.trim()||loading||loadingPlaylist} className={`w-full ${theme.primary} ${theme.hover} text-white py-4 rounded-2xl font-black text-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2`}>{(loading||loadingPlaylist)?<><Loader2 size={20} className="animate-spin"/>{loadingPlaylist?'POBIERANIE PLAYLISTY...':'TWORZENIE...'}</>:<><Play size={20}/>{editingSettings?'ZAPISZ I WRÓĆ':'UTWÓRZ POKÓJ'}</>}</button>
          </motion.div>)}

          {/* JOIN */}
          {view==='join'&&(<motion.div key="join" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}} className="space-y-6"><button onClick={()=>{setView('menu');setError(null);setRoomCode('');}} className="flex items-center gap-2 text-white/40 hover:text-white"><ArrowLeft size={16}/> Wstecz</button><div className="text-center"><Users size={40} className={`mx-auto mb-2 ${theme.text}`}/><h2 className="text-2xl font-black text-white">DOŁĄCZ DO POKOJU</h2></div><div><label className="text-white/40 text-xs font-bold uppercase tracking-widest block mb-2">Kod pokoju</label><input type="text" value={roomCode} onChange={e=>setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6))} placeholder="ABC123" maxLength={6} className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-4 text-white text-center text-3xl font-black tracking-[0.5em] placeholder:text-white/20 focus:border-white/30 focus:outline-none uppercase" autoFocus/></div>{error&&<div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2"><AlertCircle size={16} className="text-red-500 shrink-0"/><p className="text-red-400 text-sm">{error}</p></div>}<button onClick={handleJoinRoom} disabled={roomCode.length!==6||loading} className={`w-full ${theme.primary} ${theme.hover} text-white py-4 rounded-2xl font-black text-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2`}>{loading?<><Loader2 size={20} className="animate-spin"/>ŁĄCZENIE...</>:<><Users size={20}/>DOŁĄCZ</>}</button></motion.div>)}

          {/* LOBBY */}
          {view==='lobby'&&room&&(<motion.div key="lobby" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}} className="space-y-5">
            <div className="text-center"><h2 className="text-2xl font-black text-white mb-3">POCZEKALNIA</h2><div className="bg-white/5 border border-white/10 rounded-2xl p-4 inline-block"><p className="text-white/40 text-[10px] uppercase tracking-widest mb-2">Kod pokoju</p><div className="flex items-center justify-center gap-3"><button onClick={()=>setCodeRevealed(!codeRevealed)} className="text-3xl font-black text-white tracking-[0.3em] font-mono hover:opacity-80">{codeRevealed?room.code:'••••••'}</button><button onClick={copyC} className={`p-2 rounded-lg ${copied?'bg-green-500/20':'bg-white/10 hover:bg-white/20'}`}>{copied?<Check size={18} className="text-green-400"/>:<Copy size={18} className="text-white/40"/>}</button></div><p className="text-white/20 text-[9px] mt-1">{codeRevealed?'Kliknij aby ukryć':'Kliknij aby odkryć'}</p></div><button onClick={()=>{navigator.clipboard.writeText(`${window.location.origin}?join=${room.code}`);setCopied(true);setTimeout(()=>setCopied(false),2000);}} className="mt-2 text-white/30 text-[10px] hover:text-white/60 underline block mx-auto">📎 Kopiuj link zaproszenia</button></div>
            <div className="space-y-2">{room.game_type==='group'?(<>{(room.players||[]).map((p,i)=>(<div key={p.id} className={`p-3 rounded-xl border flex items-center gap-3 ${p.id===userId?`${theme.border}/50 bg-gradient-to-r ${theme.gradient} to-transparent`:'border-white/10 bg-white/5'}`}>{i===0?<Crown size={16} className="text-yellow-500 shrink-0"/>:<Users size={16} className="text-white/40 shrink-0"/>}<span className="font-bold text-white flex-1 text-sm truncate">{p.nickname}</span>{p.id===userId&&<span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-bold">TY</span>}{isHost&&p.id!==userId&&<button onClick={()=>kickPlayer(p.id)} className="text-red-400/50 hover:text-red-400" title="Wyrzuć"><X size={14}/></button>}</div>))}{(room.players||[]).length<room.max_players&&<div className="p-3 rounded-xl border border-dashed border-white/15 bg-white/5 text-center"><p className="text-white/30 text-xs">Czekam na graczy... ({(room.players||[]).length}/{room.max_players})</p></div>}</>):(<><div className={`p-3 rounded-xl border flex items-center gap-3 ${isHost?`${theme.border}/50 bg-gradient-to-r ${theme.gradient} to-transparent`:'border-white/10 bg-white/5'}`}><Crown size={16} className="text-yellow-500"/><span className="font-bold text-white flex-1 text-sm">{room.host_nickname}</span>{isHost&&<span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full font-bold">TY</span>}</div>{room.guest_id?(<div className={`p-3 rounded-xl border flex items-center gap-3 ${!isHost?`${theme.border}/50 bg-gradient-to-r ${theme.gradient} to-transparent`:'border-white/10 bg-white/5'}`}><Users size={16} className={theme.text}/><span className="font-bold text-white flex-1 text-sm">{room.guest_nickname}</span>{!isHost&&<span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-bold">TY</span>}</div>):(<div className="p-3 rounded-xl border border-dashed border-white/15 bg-white/5 text-center"><Loader2 size={16} className="mx-auto mb-1 text-white/30 animate-spin"/><p className="text-white/30 text-xs">Czekam na gracza...</p></div>)}</>)}</div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center space-y-1"><p className="text-white/40 text-xs flex items-center justify-center gap-2"><Music size={14}/>{room.playlist_videos?.length||0} utworów</p><p className="text-white/40 text-xs">Rundy: <span className="text-white font-bold">{room.total_rounds}</span> • Fragment: <span className="text-white font-bold">{room.settings.playDuration}s</span></p></div>
            {isHost&&((room.game_type==='group'&&(room.players||[]).length>=2)||(room.game_type!=='group'&&room.guest_id))&&<button onClick={startGame} className={`w-full ${theme.primary} ${theme.hover} text-white py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-2 shadow-lg animate-pulse`}><Play size={24}/>ROZPOCZNIJ GRĘ!</button>}
            {!isHost&&<p className="text-center text-white/40 text-sm flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin"/>Czekaj aż host rozpocznie grę...</p>}
          </motion.div>)}

          {/* PLAYING */}
          {view==='playing'&&room&&(<motion.div key="playing" initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.95}} className="space-y-4">
            <div className="flex justify-between items-center"><div className="text-sm"><span className="text-white/40">Runda</span><span className={`font-black ${theme.text} ml-2 text-lg`}>{room.current_round}/{room.total_rounds}</span></div><div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl"><Volume2 size={14} className="text-white/40"/><input type="range" min="0" max="100" value={volume} onChange={e=>{const v=parseInt(e.target.value);setVolume(v);if(playerRef.current?.setVolume)playerRef.current.setVolume(v);}} className="w-16 h-1 accent-white"/></div><div className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-bold text-sm ${timeLeft<=5?'bg-red-500/20 text-red-400 animate-pulse':timeLeft<=10?'bg-yellow-500/20 text-yellow-400':'bg-white/10 text-white'}`}><Clock size={14}/><span className="font-mono">{timeLeft}s</span></div></div>
            {room.game_type==='group'?(<div className="flex flex-wrap gap-2 justify-center">{(room.players||[]).sort((a,b)=>b.score-a.score).map(p=>(<div key={p.id} className={`px-3 py-2 rounded-xl text-center border ${p.id===userId?`${theme.primary} border-white/20`:'bg-white/5 border-white/10'}`}><p className="text-white/60 text-[9px] uppercase truncate max-w-[70px]">{p.nickname}</p><p className="text-xl font-black text-white">{p.score}</p></div>))}</div>):(<div className="grid grid-cols-2 gap-3"><div className={`p-3 rounded-xl text-center border ${isHost?`${theme.primary} border-white/20`:'bg-white/5 border-white/10'}`}><p className="text-white/60 text-[10px] truncate">{room.host_nickname}</p><p className="text-3xl font-black text-white">{room.host_score}</p></div><div className={`p-3 rounded-xl text-center border ${!isHost?`${theme.primary} border-white/20`:'bg-white/5 border-white/10'}`}><p className="text-white/60 text-[10px] truncate">{room.guest_nickname}</p><p className="text-3xl font-black text-white">{room.guest_score}</p></div></div>)}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-center border border-white/10"><div className="flex items-center justify-center gap-4"><motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={()=>{if(isPlaying)stopAudio();else playAudio();}} disabled={!ytReady} className={`w-16 h-16 lg:w-20 lg:h-20 rounded-full flex items-center justify-center transition-all shadow-xl ${isPlaying?`${theme.primary} ring-4 ring-white/20`:'bg-white hover:bg-gray-100'}`}>{isPlaying?<Volume2 size={28} className="text-white animate-pulse"/>:<Play size={28} className="text-slate-900 ml-1" fill="currentColor"/>}</motion.button><div className="text-left"><p className={`text-sm font-bold ${isPlaying?theme.text:'text-white/40'}`}>{isPlaying?'🎵 Słuchaj i zgaduj!':'▶ Kliknij aby posłuchać'}</p><p className="text-white/20 text-[9px]">Muzyka leci do końca rundy</p></div></div></div>
            {!answered?(<div className="space-y-3"><input type="text" value={guess} onChange={e=>{setGuess(e.target.value);guessRef.current=e.target.value;}} onKeyDown={e=>e.key==='Enter'&&handleSubmit()} placeholder="🎵 Wpisz tytuł i wykonawcę..." className="w-full bg-white/5 border border-white/10 rounded-xl py-4 lg:py-5 px-4 text-white text-center text-lg lg:text-xl placeholder:text-white/20 focus:border-white/30 focus:outline-none" autoFocus disabled={timeLeft===0}/>{timeLeft===0&&<p className="text-red-400 text-xs text-center font-bold animate-pulse">⏰ Czas minął!</p>}<div className="flex gap-2"><button onClick={()=>{submitAnswer('SKIP');setAnswered(true);stopAudio();}} className="flex-1 bg-white/10 border border-white/10 text-white/60 py-3 rounded-xl font-bold hover:bg-white/20 transition-all">SKIP</button><button onClick={handleSubmit} disabled={!guess.trim()} className={`flex-[2] ${theme.primary} ${theme.hover} text-white py-3 rounded-xl font-bold transition-all disabled:opacity-50`}>ODPOWIEDZ</button></div></div>):(<div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center"><Check size={28} className="mx-auto text-green-500 mb-2"/><p className="text-green-400 font-bold">Odpowiedź wysłana!</p><p className="text-white/40 text-sm mt-1 truncate">{room.game_type==='group'?(room.players||[]).find(p=>p.id===userId)?.answer:(isHost?room.host_answer:room.guest_answer)}</p><div className="mt-3"><Loader2 size={16} className="mx-auto text-white/30 animate-spin mb-1"/><p className="text-white/30 text-xs">Czekam na drugiego gracza...</p></div></div>)}
          </motion.div>)}

          {/* ROUND END */}
          {view==='round_end'&&room&&(<motion.div key="round_end" initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.9}} className="space-y-5">
            <div className="text-center"><h2 className="text-xl font-black text-white mb-1">RUNDA {room.current_round}/{room.total_rounds}</h2><div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-2xl p-4 mt-3"><p className="text-yellow-400 text-xs uppercase font-bold mb-1">Prawidłowa odpowiedź</p>{(()=>{const t=lastRoundTitle||room.current_video_title||'';const c=cleanYouTubeTitle(t);return(<><p className="text-white font-black text-lg leading-tight">{c}</p>{t!==c&&<p className="text-white/20 text-[10px] mt-1 truncate">{t}</p>}</>);})()}</div></div>
            {(()=>{const title=lastRoundTitle||room.current_video_title||'';if(room.game_type==='group'){return(<div className="grid grid-cols-2 gap-2">{(room.players||[]).map(p=>{const pts=scoreAnswer(p.answer||'',title,p.answer_time,room.round_start_time);return<div key={p.id}>{renderCard(p.nickname,p.answer,pts,room.round_winner===p.id)}</div>;})}</div>);}else{const hP=scoreAnswer(room.host_answer||'',title,room.host_answer_time,room.round_start_time);const gP=scoreAnswer(room.guest_answer||'',title,room.guest_answer_time,room.round_start_time);return(<div className="grid grid-cols-2 gap-3">{renderCard(room.host_nickname,room.host_answer,hP,room.round_winner==='host')}{renderCard(room.guest_nickname||'',room.guest_answer,gP,room.round_winner==='guest')}</div>);}})()}
            {(()=>{if(!room.round_winner||room.round_winner==='draw')return<div className="text-center p-3 rounded-xl bg-white/5 border border-white/10"><p className="text-white/60 font-bold">🤝 Remis w tej rundzie</p></div>;let wn=room.round_winner;if(room.game_type==='group'){const p=(room.players||[]).find(x=>x.id===room.round_winner);wn=p?.nickname||wn;}else{wn=room.round_winner==='host'?room.host_nickname:(room.guest_nickname||'');}return<div className={`text-center p-3 rounded-xl ${theme.primary}/20 border ${theme.border}/30`}><p className="text-white font-black text-lg">🏆 {wn} wygrywa rundę!</p></div>;})()}
            {/* Total scores */}
            {room.game_type==='group'?(<div className="flex flex-wrap justify-center gap-3 py-2">{(room.players||[]).sort((a,b)=>b.score-a.score).map(p=>(<div key={p.id} className="text-center"><p className="text-white/40 text-[10px] truncate max-w-[80px]">{p.nickname}</p><p className="text-2xl font-black text-white">{p.score}</p></div>))}</div>):(<div className="flex justify-center gap-6 py-2"><div className="text-center"><p className="text-white/40 text-xs">{room.host_nickname}</p><p className="text-3xl font-black text-white">{room.host_score}</p></div><div className="text-white/20 text-2xl font-bold self-center">:</div><div className="text-center"><p className="text-white/40 text-xs">{room.guest_nickname}</p><p className="text-3xl font-black text-white">{room.guest_score}</p></div></div>)}
            {isHost&&<button onClick={()=>{stopAudio();destroyPlayer();nextRound();}} className={`w-full ${theme.primary} ${theme.hover} text-white py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-2`}>{room.current_round>=room.total_rounds?<><Trophy size={20}/>ZOBACZ WYNIKI</>:<><SkipForward size={20}/>NASTĘPNA RUNDA</>}</button>}
            {!isHost&&<p className="text-center text-white/40 text-sm flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin"/>Czekam na następną rundę...</p>}
          </motion.div>)}

          {/* RESULTS */}
          {view==='results'&&room&&(<motion.div key="results" initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.9}} className="space-y-6 text-center">
            <div><Trophy size={48} className="mx-auto text-yellow-500 mb-3 lg:w-16 lg:h-16"/><h2 className="text-3xl lg:text-4xl font-black text-white mb-2">KONIEC GRY!</h2>{(()=>{if(room.game_type==='group'){const s=[...(room.players||[])].sort((a,b)=>b.score-a.score);const t=s[0];const tie=s.length>1&&s[0].score===s[1].score;if(tie)return<p className="text-xl font-bold text-white/60">🤝 Remis!</p>;return<p className={`text-xl font-bold ${theme.text}`}>🏆 {t?.nickname} wygrywa!</p>;}if(room.host_score>room.guest_score)return<p className={`text-xl font-bold ${theme.text}`}>🏆 {room.host_nickname} wygrywa!</p>;if(room.guest_score>room.host_score)return<p className={`text-xl font-bold ${theme.text}`}>🏆 {room.guest_nickname} wygrywa!</p>;return<p className="text-xl font-bold text-white/60">🤝 Remis!</p>;})()}</div>
            {room.game_type==='group'?(<div className="space-y-2">{[...(room.players||[])].sort((a,b)=>b.score-a.score).map((p,i)=>(<div key={p.id} className={`flex items-center gap-3 p-4 rounded-2xl ${i===0?'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500/50':'bg-white/5 border border-white/10'}`}><span className="text-xl font-black w-8">{i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`}</span><span className="text-white font-bold flex-1 text-left truncate">{p.nickname}</span><span className="text-2xl font-black text-white">{p.score}</span></div>))}</div>):(<div className="grid grid-cols-2 gap-4"><div className={`p-6 rounded-2xl ${room.host_score>=room.guest_score?'bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500/50':'bg-white/5 border border-white/10'}`}>{room.host_score>room.guest_score&&<Crown size={24} className="mx-auto mb-2 text-yellow-500"/>}<p className="text-white/60 text-sm truncate">{room.host_nickname}</p><p className="text-5xl font-black text-white">{room.host_score}</p></div><div className={`p-6 rounded-2xl ${room.guest_score>=room.host_score?'bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500/50':'bg-white/5 border border-white/10'}`}>{room.guest_score>room.host_score&&<Crown size={24} className="mx-auto mb-2 text-yellow-500"/>}<p className="text-white/60 text-sm truncate">{room.guest_nickname}</p><p className="text-5xl font-black text-white">{room.guest_score}</p></div></div>)}
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"><button onClick={()=>setSongsExpanded(!songsExpanded)} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/5 transition-all"><Music size={16} className={theme.text}/><span className="text-white/50 text-xs font-bold uppercase tracking-widest flex-1 text-left">Piosenki z gry ({room.total_rounds})</span><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className={`text-white/20 transition-transform ${songsExpanded?'rotate-180':''}`} viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button>{songsExpanded&&<div className="px-3 pb-3 space-y-1 max-h-48 overflow-y-auto">{(room.playlist_videos||[]).slice(0,room.total_rounds).map((v,i)=>(<a key={i} href={`https://www.youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all group"><span className="text-white/30 text-[9px] w-4 shrink-0">#{i+1}</span><span className="text-white/60 text-[10px] flex-1 truncate group-hover:text-white transition-colors">{cleanYouTubeTitle(v.title)}</span></a>))}</div>}</div>
            <div className="space-y-3">{isHost&&<button onClick={()=>{stopAudio();destroyPlayer();startGame();}} className={`w-full ${theme.primary} ${theme.hover} text-white py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2`}><RefreshCw size={18}/>ZAGRAJ PONOWNIE</button>}{isHost&&<button onClick={()=>{stopAudio();destroyPlayer();setEditingSettings(true);setPlaylistUrl(room.playlist_url||'');setRoundSettings(s=>({...s,rounds:room.total_rounds,duration:room.settings.playDuration}));setCreateMode('predefined');setView('create');}} className="w-full bg-white/10 border border-white/10 text-white py-3 rounded-xl font-bold hover:bg-white/20 transition-all flex items-center justify-center gap-2"><Zap size={18}/>ZMIEŃ USTAWIENIA</button>}<button onClick={async()=>{stopTimer();destroyPlayer();await leaveRoom();setView('menu');}} className="w-full bg-white/5 border border-white/10 text-white/60 py-3 rounded-xl font-bold hover:bg-white/10 transition-all">WYJDŹ</button></div>
          </motion.div>)}

        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default MultiplayerMode;
