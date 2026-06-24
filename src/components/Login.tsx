import React, { useState } from 'react';
import { motion } from 'motion/react';
import { collection, query, where, getDocs, doc, setDoc } from '../firebase';
import { db } from '../firebase';
import { Router, ShieldCheck, Zap, Lock, User as UserIcon, Key, Loader2, Eye, EyeOff } from 'lucide-react';
import { User } from '../types';
import { useTranslation } from 'react-i18next';

export default function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const { t, i18n } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'users'), where('username', '==', username));
      const snap = await getDocs(q);
      
      let authenticatedUser: User | null = null;

      if (!snap.empty) {
        const userData = snap.docs[0].data() as User;
        if (userData.password === password) {
          authenticatedUser = { ...userData, id: snap.docs[0].id };
        }
      } else if (username === 'admin' && password === 'admin') {
        // Emergency fallback: Create and login if it's the default admin and not found
        const adminData: User = {
          username: 'admin',
          password: 'admin',
          name: 'المدير العام',
          role: 'admin',
          isPrimary: true
        };
        const docRef = doc(db, 'users', 'primary-admin');
        await setDoc(docRef, adminData);
        authenticatedUser = { ...adminData, id: 'primary-admin' };
      }

      if (authenticatedUser) {
        onLogin(authenticatedUser);
      } else {
        setError(t('login.invalid'));
      }
    } catch (err: any) {
      console.error(err);
      setError(t('login.connError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      
      <div className="absolute top-6 right-6 z-20">
        <button 
          onClick={() => i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar')}
          className="px-4 py-2 bg-[#1a1a1a] border border-white/5 rounded-xl font-bold hover:bg-white/5 transition-colors"
        >
          {i18n.language === 'ar' ? 'English' : 'العربية'}
        </button>
      </div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-[#1a1a1a] border border-white/5 rounded-3xl p-8 shadow-2xl relative z-10"
      >
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center shadow-xl shadow-orange-900/40">
             <Router className="text-white w-8 h-8" />
          </div>
          
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">SND System</h1>
            <p className="text-gray-400 text-sm">{t('login.prompt')}</p>
          </div>

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div className="text-left rtl:text-right space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1 rtl:ml-0 rtl:mr-1">{t('login.username')}</label>
              <div className="relative">
                <UserIcon className="absolute left-4 rtl:left-auto rtl:right-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 rtl:pl-4 rtl:pr-12 py-3.5 focus:border-orange-500 outline-none transition-all"
                  placeholder="admin"
                />
              </div>
            </div>

            <div className="text-left rtl:text-right space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1 rtl:ml-0 rtl:mr-1">{t('login.password')}</label>
              <div className="relative">
                <Key className="absolute left-4 rtl:left-auto rtl:right-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-12 py-3.5 focus:border-orange-500 outline-none transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 rtl:right-auto rtl:left-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-400/10 border border-red-400/20 rounded-xl text-red-500 text-xs font-medium">
                {error}
              </div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-orange-900/20 flex items-center justify-center gap-2 group"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : t('login.title')}
            </button>
          </form>

          <div className="pt-4 flex items-center gap-4 text-gray-600">
             <div className="w-8 h-[1px] bg-white/5"></div>
             <p className="text-[10px] font-bold uppercase tracking-widest">{t('login.authorized')}</p>
             <div className="w-8 h-[1px] bg-white/5"></div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
