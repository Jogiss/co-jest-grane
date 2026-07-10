'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Mail, Lock, User, LogIn, UserPlus, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { signInWithGoogle, signInWithEmail, registerWithEmail, logOut } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: {
    primary: string;
    text: string;
    border: string;
    hover: string;
  };
}

type AuthMode = 'login' | 'register';

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, theme }) => {
  const { user, migrateOldData, nickname, setNickname, syncProgressToCloud } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [editingNick, setEditingNick] = useState(false);
  const [newNick, setNewNick] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    
    const { user: newUser, error: authError } = await signInWithGoogle();
    
    if (authError) {
      setError(authError);
      setLoading(false);
      return;
    }

    if (newUser) {
      const oldUid = localStorage.getItem('mm_uid');
      if (oldUid && oldUid !== newUser.uid) {
        setMigrating(true);
        const migrated = await migrateOldData();
        setMigrating(false);
        if (migrated) {
          setSuccess('Zalogowano i przeniesiono postępy!');
        } else {
          setSuccess('Zalogowano pomyślnie!');
        }
      } else {
        setSuccess('Zalogowano pomyślnie!');
      }
      
      setTimeout(() => {
        onClose();
        setSuccess(null);
      }, 1500);
    }
    
    setLoading(false);
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (mode === 'register') {
      const { user: newUser, error: authError } = await registerWithEmail(
        email, 
        password, 
        displayName || nickname
      );
      
      if (authError) {
        setError(authError);
        setLoading(false);
        return;
      }

      if (newUser) {
        const oldUid = localStorage.getItem('mm_uid');
        if (oldUid && oldUid !== newUser.uid) {
          setMigrating(true);
          await migrateOldData();
          setMigrating(false);
        }
        setSuccess('Konto utworzone i zalogowano!');
        setTimeout(() => {
          onClose();
          setSuccess(null);
        }, 1500);
      }
    } else {
      const { user: newUser, error: authError } = await signInWithEmail(email, password);
      
      if (authError) {
        setError(authError);
        setLoading(false);
        return;
      }

      if (newUser) {
        const oldUid = localStorage.getItem('mm_uid');
        if (oldUid && oldUid !== newUser.uid) {
          setMigrating(true);
          const migrated = await migrateOldData();
          setMigrating(false);
          if (migrated) {
            setSuccess('Zalogowano i przeniesiono postępy!');
          } else {
            setSuccess('Zalogowano pomyślnie!');
          }
        } else {
          setSuccess('Zalogowano pomyślnie!');
        }
        setTimeout(() => {
          onClose();
          setSuccess(null);
        }, 1500);
      }
    }

    setLoading(false);
  };

  const handleLogout = async () => {
    setLoading(true);
    await logOut();
    setLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  const handleNickSave = async () => {
    const trimmed = newNick.trim();
    if (!trimmed || trimmed.length < 2) {
      setError('Nick musi mieć min. 2 znaki');
      return;
    }
    if (trimmed.length > 15) {
      setError('Nick może mieć max. 15 znaków');
      return;
    }
    
    setLoading(true);
    setError(null);
    setNickname(trimmed);
    
    await syncProgressToCloud();
    
    setSuccess('Nick zmieniony!');
    setEditingNick(false);
    setLoading(false);
    setTimeout(() => setSuccess(null), 2000);
  };

  if (user) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-slate-900 border border-white/10 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative"
        >
          <button onClick={onClose} className="absolute right-4 top-4 text-white/40 hover:text-white">
            <X size={20} />
          </button>

          <div className="text-center mb-5">
            <div className={`w-16 h-16 rounded-full ${theme.primary} flex items-center justify-center text-white text-2xl font-black mx-auto mb-3 shadow-lg`}>
              {nickname.charAt(0).toUpperCase()}
            </div>
            <h3 className="text-xl font-black text-white">{nickname}</h3>
            <p className="text-white/40 text-sm">{user.email}</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-3 flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500 shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 mb-3 flex items-center gap-2">
              <CheckCircle size={16} className="text-green-500 shrink-0" />
              <p className="text-green-400 text-sm">{success}</p>
            </div>
          )}

          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-3">
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-2">Nick w grze</p>
            {editingNick ? (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="text"
                    value={newNick}
                    onChange={(e) => setNewNick(e.target.value.slice(0, 15))}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleNickSave(); }}
                    placeholder="Nowy nick..."
                    autoFocus
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-9 pr-3 text-white text-sm placeholder:text-white/30 focus:border-white/30 focus:outline-none"
                  />
                </div>
                <button
                  onClick={handleNickSave}
                  disabled={loading}
                  className={`px-4 ${theme.primary} ${theme.hover} text-white rounded-lg font-bold text-sm transition-all disabled:opacity-50`}
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : 'OK'}
                </button>
                <button
                  onClick={() => { setEditingNick(false); setError(null); }}
                  className="px-3 bg-white/5 text-white/40 rounded-lg hover:bg-white/10 transition-all"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-white font-bold">{nickname}</span>
                <button
                  onClick={() => { setNewNick(nickname); setEditingNick(true); setError(null); }}
                  className={`text-xs ${theme.text} font-bold hover:underline`}
                >
                  Zmień nick
                </button>
              </div>
            )}
            <p className="text-white/20 text-[9px] mt-2">Ten nick jest widoczny w rankingu</p>
          </div>

          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-3 flex items-center gap-3">
            <CheckCircle size={20} className="text-green-500 shrink-0" />
            <div>
              <p className="text-green-400 text-sm font-bold">Konto połączone</p>
              <p className="text-white/40 text-xs">Postępy są synchronizowane</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            disabled={loading}
            className="w-full bg-red-500/10 border border-red-500/30 text-red-400 py-3 rounded-xl font-bold hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
            Wyloguj się
          </button>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-white/10 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative"
      >
        <button onClick={onClose} className="absolute right-4 top-4 text-white/40 hover:text-white">
          <X size={20} />
        </button>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-black text-white mb-1">
            {mode === 'login' ? 'Zaloguj się' : 'Utwórz konto'}
          </h2>
          <p className="text-white/40 text-sm">
            Synchronizuj postępy między urządzeniami
          </p>
        </div>

        {migrating && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4 flex items-center gap-3">
            <Loader2 size={20} className="text-yellow-500 animate-spin shrink-0" />
            <p className="text-yellow-400 text-sm">Przenoszenie postępów...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 flex items-center gap-2">
            <AlertCircle size={16} className="text-red-500 shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 mb-4 flex items-center gap-2">
            <CheckCircle size={16} className="text-green-500 shrink-0" />
            <p className="text-green-400 text-sm">{success}</p>
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-white text-slate-900 py-3 rounded-xl font-bold hover:bg-gray-100 transition-all flex items-center justify-center gap-3 mb-4 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Kontynuuj z Google
            </>
          )}
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-white/30 text-xs uppercase font-bold">lub</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-3">
          {mode === 'register' && (
            <div className="relative">
              <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                placeholder="Nazwa gracza"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
              />
            </div>
          )}
          
          <div className="relative">
            <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
            />
          </div>

          <div className="relative">
            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="password"
              placeholder="Hasło"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full ${theme.primary} ${theme.hover} text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50`}
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : mode === 'login' ? (
              <>
                <LogIn size={18} />
                Zaloguj się
              </>
            ) : (
              <>
                <UserPlus size={18} />
                Utwórz konto
              </>
            )}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
            }}
            className="text-white/40 text-sm hover:text-white transition-colors"
          >
            {mode === 'login' ? (
              <>Nie masz konta? <span className={theme.text}>Zarejestruj się</span></>
            ) : (
              <>Masz już konto? <span className={theme.text}>Zaloguj się</span></>
            )}
          </button>
        </div>

        <p className="text-white/20 text-[10px] text-center mt-4">
          Twoje lokalne postępy zostaną przeniesione po zalogowaniu
        </p>
      </motion.div>
    </motion.div>
  );
};

export default AuthModal;
