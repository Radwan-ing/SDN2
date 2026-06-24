import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, addDoc, where, getDocs } from '../firebase';
import { db } from '../firebase';
import { User } from '../types';
import { ShieldCheck, UserPlus, Trash2, Edit2, ShieldAlert, Loader2, Save, X, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';

export default function UserManagement({ currentUser }: { currentUser: User }) {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState<Partial<User>>({ username: '', password: '', name: '', role: 'data_entry' });

  useEffect(() => {
    const q = collection(db, 'users');
    const unsubscribe = onSnapshot(q, (s) => {
      setUsers(s.docs.map(d => ({ id: d.id, ...d.data() } as User)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), where('username', '==', formData.username));
      const snap = await getDocs(q);
      if (!snap.empty) {
        alert(t('users.userExists'));
        return;
      }
      
      // Auto-generate a userNumber (max + 1)
      const allUsersSnap = await getDocs(collection(db, 'users'));
      let maxNumber = 100;
      allUsersSnap.forEach((doc) => {
         const data = doc.data();
         if (data.userNumber && data.userNumber > maxNumber) {
            maxNumber = data.userNumber;
         }
      });
      const nextUserNumber = maxNumber + 1;

      await addDoc(collection(db, 'users'), { ...formData, userNumber: nextUserNumber, isPrimary: false });
      setShowAddModal(false);
      setFormData({ username: '', password: '', name: '', role: 'data_entry' });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser?.id) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', editingUser.id), {
        name: editingUser.name,
        password: editingUser.password,
        role: editingUser.role
      });
      setEditingUser(null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (confirm(t('users.confirmDelete'))) {
      await deleteDoc(doc(db, 'users', id));
    }
  };

  const ROLE_MAP = {
    admin: 'المدير العام',
    manager: 'مدير نظام',
    data_entry: 'مدخل بيانات'
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-600/10 text-orange-500 rounded-lg">
             <ShieldCheck size={20} />
          </div>
          <h2 className="font-outfit font-black text-xl text-white uppercase tracking-tight">{t('users.title')}</h2>
        </div>
        {(currentUser.role === 'admin' || currentUser.role === 'manager') && (
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-orange-900/20 transition-all font-sans"
          >
            <UserPlus size={18} />
            {t('users.addUser')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {users.map(u => (
          <div key={u.id} className="bg-[#242424] p-5 rounded-2xl border border-white/5 flex items-center justify-between group">
            <div className="flex items-center gap-4">
               <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${u.isPrimary ? 'bg-orange-600 text-white' : 'bg-white/5 text-gray-400'}`}>
                  {u.name.charAt(0)}
               </div>
               <div>
                  <h3 className="font-bold flex items-center gap-2">
                    {u.name}
                    {u.userNumber && <span className="text-[10px] bg-white/10 text-gray-300 px-1.5 py-0.5 rounded border border-white/5 font-mono">#{u.userNumber}</span>}
                    {u.isPrimary && <span className="text-[10px] bg-orange-600/20 text-orange-500 px-1.5 py-0.5 rounded border border-orange-500/20 uppercase tracking-widest font-black">{t('users.primaryAdmin')}</span>}
                    <span className="text-[10px] text-gray-600 uppercase tracking-tighter">@{u.username}</span>
                  </h3>
                  <p className="text-xs text-gray-500">{ROLE_MAP[u.role as keyof typeof ROLE_MAP] || u.role}</p>
               </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
               {(u.isPrimary ? currentUser.id === u.id : (currentUser.role === 'admin' || (currentUser.role === 'manager' && u.role === 'data_entry') || currentUser.id === u.id)) && (
                 <button 
                   onClick={() => setEditingUser(u)}
                   className="p-2 hover:bg-white/5 text-gray-400 hover:text-orange-500 rounded-lg transition-colors"
                  >
                    <Edit2 size={16} />
                 </button>
               )}
               {!u.isPrimary && currentUser.id !== u.id && (currentUser.role === 'admin' || (currentUser.role === 'manager' && u.role === 'data_entry')) && (
                 <button 
                  onClick={() => u.id && handleDeleteUser(u.id)}
                  className="p-2 hover:bg-red-400/10 text-gray-600 hover:text-red-400 rounded-lg transition-colors"
                 >
                   <Trash2 size={16} />
                 </button>
               )}
            </div>
          </div>
        ))}
      </div>

      {/* Add User Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1a1a1a] border-0 sm:border sm:border-white/10 rounded-none sm:rounded-3xl p-6 sm:p-8 w-full max-w-md h-full sm:h-auto shadow-2xl relative overflow-y-auto"
            >
            {/* Unified Header for Modal */}
            <div className="flex items-center gap-2 mb-6" dir="rtl">
              <button 
                onClick={() => setShowAddModal(false)} 
                className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all"
              >
                <ArrowLeft size={18} className="rtl:rotate-180" />
              </button>
              <h3 className="text-xl font-bold text-white m-0 p-0">{t('users.registerUser')}</h3>
            </div>
              <form onSubmit={handleAddUser} className="space-y-4">
                <div className="space-y-1.5 rtl:text-right">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1 rtl:ml-0 rtl:mr-1">{t('users.fullName')}</label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 focus:border-orange-500 outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 rtl:text-right">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-1 rtl:ml-0 rtl:mr-1">{t('users.username')}</label>
                    <input 
                      type="text" 
                      required
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 focus:border-orange-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1.5 rtl:text-right">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-1 rtl:ml-0 rtl:mr-1">{t('users.password')}</label>
                    <input 
                      type="password" 
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 focus:border-orange-500 outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1.5 rtl:text-right">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1 rtl:ml-0 rtl:mr-1">{t('users.role')}</label>
                  <select 
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 focus:border-orange-500 outline-none appearance-none"
                  >
                    <option value="data_entry">{ROLE_MAP.data_entry} (Data Entry)</option>
                    <option value="manager">{ROLE_MAP.manager} (Manager)</option>
                  </select>
                </div>
                <button type="submit" disabled={loading} className="w-full bg-orange-600 hover:bg-orange-700 py-3 rounded-2xl font-bold mt-4 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="animate-spin" /> : t('users.createAccount')}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Edit Modal */}
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1a1a1a] border-0 sm:border sm:border-white/10 rounded-none sm:rounded-3xl p-6 sm:p-8 w-full max-w-md h-full sm:h-auto shadow-2xl relative overflow-y-auto"
            >
            {/* Unified Header for Modal */}
            <div className="flex items-center gap-2 mb-2" dir="rtl">
              <button 
                onClick={() => setEditingUser(null)} 
                className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all"
              >
                <ArrowLeft size={18} className="rtl:rotate-180" />
              </button>
              <h3 className="text-xl font-bold text-white m-0 p-0">{t('users.editUser')}</h3>
            </div>
              <p className="text-xs text-gray-500 mb-6 uppercase tracking-wider">Account ID: {editingUser.id}</p>
              
              <form onSubmit={handleUpdateUser} className="space-y-4">
                <div className="space-y-1.5 rtl:text-right">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1 rtl:ml-0 rtl:mr-1">{t('users.fullName')}</label>
                  <input 
                    type="text" 
                    required
                    disabled={currentUser.role === 'data_entry'}
                    value={editingUser.name}
                    onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 focus:border-orange-500 outline-none disabled:opacity-50"
                  />
                </div>
                <div className="space-y-1.5 rtl:text-right">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1 rtl:ml-0 rtl:mr-1">{t('users.newPassword')}</label>
                  <input 
                    type="password" 
                    required
                    value={editingUser.password}
                    onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 focus:border-orange-500 outline-none"
                  />
                </div>
                <div className="space-y-1.5 rtl:text-right">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1 rtl:ml-0 rtl:mr-1">{t('users.role')}</label>
                  <select 
                    value={editingUser.role}
                    disabled={editingUser.isPrimary || currentUser.role === 'data_entry'}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 focus:border-orange-500 outline-none disabled:opacity-50"
                  >
                    <option value="data_entry">{ROLE_MAP.data_entry} (Data Entry)</option>
                    <option value="manager">{ROLE_MAP.manager} (Manager)</option>
                    <option value="admin">{ROLE_MAP.admin} (Admin)</option>
                  </select>
                </div>
                <button type="submit" disabled={loading} className="w-full bg-orange-600 hover:bg-orange-700 py-3 rounded-2xl font-bold mt-4 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="animate-spin" /> : t('users.applyChanges')}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
